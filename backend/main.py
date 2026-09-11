"""
GrowMate AI – FastAPI backend.

Run:  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import base64
import json
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

import agent
import speech
import tools
from config import settings
from models import (ChatRequest, ChatResponse, CustomerCreate, CustomerUpdate,
                    SpeechRequest, TransactionCreate, VoiceKhataResponse)
from repository import get_repository

app = FastAPI(title="GrowMate AI API", version="1.0.0",
              description="AI Shopkeeper Copilot for small Indian businesses")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """The server must never crash because of user input."""
    # Log the real traceback server-side, never leak internals to the client
    import logging
    logging.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    repo = get_repository()
    return {
        "status": "ok",
        "service": "growmate-ai",
        "ai_mode": agent.get_agent_mode(),
        "llm_provider": settings.llm_provider,
        "model": settings.llm_model if settings.ai_enabled else None,
        "speech_enabled": speech.speech_enabled(),
        "transcribe_model": settings.OPENAI_TRANSCRIBE_MODEL if settings.speech_enabled else None,
        "tts_model": settings.OPENAI_TTS_MODEL if settings.speech_enabled else None,
        "repository": type(repo).__name__,
        "shop": {"id": settings.SHOP_ID, "name": settings.SHOP_NAME, "owner": settings.OWNER_NAME},
    }


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------
@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    history = [h.model_dump() for h in req.history]
    return agent.chat(req.message, history)


# ---------------------------------------------------------------------------
# Speech service (STT + TTS)
#   • POST /api/audio/transcribe  – multipart audio file -> { "text": "..." }
#   • POST /api/audio/speak       – { "text": "..." } -> audio/mpeg bytes
# Both require OPENAI_API_KEY (else 503) so the frontend can fall back safely.
# ---------------------------------------------------------------------------
@app.post("/api/audio/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not speech.speech_enabled():
        raise HTTPException(status_code=503, detail="Speech service not configured (OPENAI_API_KEY missing).")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio file.")
    if len(data) > speech.MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large (max 10 MB).")
    text = speech.transcribe(data, file.filename or "voice.webm",
                             file.content_type or "audio/webm")
    if not text:
        raise HTTPException(status_code=502, detail="Could not transcribe audio.")
    return {"text": text}


@app.post("/api/audio/speak")
def speak_text(body: SpeechRequest):
    if not speech.speech_enabled():
        raise HTTPException(status_code=503, detail="Speech service not configured (OPENAI_API_KEY missing).")
    audio = speech.synthesize(body.text, body.voice)
    if not audio:
        raise HTTPException(status_code=502, detail="Could not synthesize speech.")
    return Response(content=audio, media_type="audio/mpeg",
                    headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


@app.post("/api/audio/khata-voice", response_model=VoiceKhataResponse)
async def khata_voice(file: UploadFile = File(...),
                      history: str = Form(default="[]")):
    """One-shot voice khata: audio in -> transcript + AI action + spoken reply.

    The AI agent decides the action from the spoken words; the khata customer
    is stored in the database (atomically through the SQL function when
    Supabase is active). Returns the spoken reply as base64 mp3 so the frontend
    needs no extra round-trip.
    """
    if not speech.speech_enabled():
        raise HTTPException(status_code=503, detail="Speech service not configured (OPENAI_API_KEY missing).")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio file.")
    if len(data) > speech.MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large (max 10 MB).")

    text = speech.transcribe(data, file.filename or "voice.webm",
                             file.content_type or "audio/webm")
    if not text:
        raise HTTPException(status_code=422,
                            detail="Sorry, I couldn't understand the audio. Please try again.")

    history_list = []
    if history:
        try:
            parsed = json.loads(history)
            if isinstance(parsed, list):
                history_list = [h for h in parsed if isinstance(h, dict)]
        except Exception:
            history_list = []

    res = agent.chat(text, history_list)
    reply = res.get("reply") or "Khata update ho gaya."
    tool_calls = res.get("tool_calls") or []
    data_res = res.get("data")
    for tc in tool_calls:
        if tc.get("name") == "create_or_update_customer_khata" and isinstance(tc.get("result"), dict):
            data_res = tc["result"]
            break
    customer = None
    created = None
    if isinstance(data_res, dict):
        customer = data_res.get("customer") or (data_res.get("transaction") or {}).get("customer")
        created = bool(data_res.get("created"))

    audio = speech.synthesize(reply) if speech.speech_enabled() else None
    return {
        "transcript": text,
        "reply": reply,
        "mode": res.get("mode"),
        "intent": res.get("intent"),
        "tool_calls": tool_calls,
        "data": data_res,
        "customer": customer,
        "created": created,
        "audio_b64": base64.b64encode(audio).decode("ascii") if audio else None,
    }


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------
@app.get("/api/customers")
def list_customers(search: Optional[str] = Query(default=None, max_length=80)):
    repo = get_repository()
    rows = repo.list_customers(search=search)
    for c in rows:
        last = repo.last_transaction(c["id"])
        c["last_transaction_date"] = last["date"] if last else None
        c["last_transaction_ago"] = tools._human_ago(last["date"]) if last else "never"
    return rows


@app.post("/api/customers", status_code=201)
def create_customer(body: CustomerCreate):
    repo = get_repository()
    existing = repo.find_customer_by_name(body.name)
    if existing and existing["name"].lower() == body.name.strip().lower():
        raise HTTPException(status_code=409, detail=f"Customer '{existing['name']}' already exists.")
    return repo.create_customer(body.name, body.father_name, body.phone)


@app.get("/api/customers/{customer_id}")
def get_customer(customer_id: str):
    c = get_repository().get_customer(customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return c


@app.put("/api/customers/{customer_id}")
def update_customer(customer_id: str, body: CustomerUpdate):
    c = get_repository().update_customer(customer_id, **body.model_dump())
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return c


@app.get("/api/customers/{customer_id}/khata")
def customer_khata(customer_id: str):
    repo = get_repository()
    c = repo.get_customer(customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found.")
    result = tools.get_customer_khata(c["name"])
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    result["transactions"] = repo.list_transactions(customer_id=customer_id)
    return result


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------
@app.get("/api/inventory")
def inventory(product: Optional[str] = Query(default=None, max_length=80)):
    result = tools.get_inventory(product)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ---------------------------------------------------------------------------
# Sales & transactions
# ---------------------------------------------------------------------------
@app.get("/api/sales/today")
def sales_today():
    return tools.get_today_sales()


@app.get("/api/transactions")
def list_transactions(limit: int = Query(default=50, ge=1, le=500),
                      customer_id: Optional[str] = None):
    return get_repository().list_transactions(customer_id=customer_id, limit=limit)


@app.post("/api/transactions", status_code=201)
def create_transaction(body: TransactionCreate):
    repo = get_repository()
    customer_name = body.customer_name
    if body.customer_id:
        c = repo.get_customer(body.customer_id)
        if not c:
            raise HTTPException(status_code=404, detail="Customer not found.")
        customer_name = c["name"]
    result = tools.add_transaction(
        customer_name=customer_name,
        items=[i.model_dump() for i in body.items],
        amount=body.amount,
        transaction_type=body.transaction_type,
        notes=body.notes,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ---------------------------------------------------------------------------
# Analytics / dashboard
# ---------------------------------------------------------------------------
@app.get("/api/analytics")
def analytics(min_credit: float = Query(default=1000, ge=0),
              inactive_days: int = Query(default=10, ge=1, le=365)):
    inv = tools.get_inventory()
    return {
        "summary": tools.get_business_summary(),
        "high_credit": tools.find_high_credit_customers(min_credit),
        "inactive": tools.find_inactive_customers(inactive_days),
        "low_stock": inv["needs_attention"],
        "sales": tools.get_today_sales(),
    }


@app.get("/api/dashboard")
def dashboard():
    return tools.get_business_summary()


if __name__ == "__main__":  # python main.py
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.BACKEND_PORT, reload=True)
