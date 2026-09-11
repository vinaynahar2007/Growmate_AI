"""
Pydantic models (API request / response schemas) for GrowMate AI.
"""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# ---------- Domain models ----------

class Customer(BaseModel):
    id: str
    shop_id: str
    name: str
    father_name: Optional[str] = None
    phone: Optional[str] = None
    outstanding_balance: float = 0.0
    created_at: str


class Product(BaseModel):
    id: str
    shop_id: str
    name: str
    quantity: float
    unit: str
    price: Optional[float] = None
    minimum_stock: float = 0
    status: Optional[Literal["good", "low", "out"]] = None


class TransactionItem(BaseModel):
    id: str
    transaction_id: str
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    quantity: float
    unit: Optional[str] = None
    price: Optional[float] = None  # None => price was not supplied


class Transaction(BaseModel):
    id: str
    shop_id: str
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    date: str
    amount: float
    transaction_type: Literal["credit", "cash", "payment"]
    payment_status: Literal["paid", "pending", "amount_missing"]
    notes: Optional[str] = None
    items: List[TransactionItem] = []


# ---------- Request models ----------

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., description="Shopkeeper message in English / Hindi / English")
    history: List[ChatMessage] = Field(default_factory=list)


class SpeechRequest(BaseModel):
    """Text to convert to spoken audio via the backend TTS service."""
    text: str = Field(..., min_length=1, max_length=1000)
    voice: Optional[str] = Field(default=None, max_length=30)


class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    father_name: Optional[str] = Field(default=None, max_length=80)
    phone: Optional[str] = Field(default=None, max_length=20)


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    father_name: Optional[str] = Field(default=None, max_length=80)
    phone: Optional[str] = Field(default=None, max_length=20)


class TransactionItemIn(BaseModel):
    product_name: str
    quantity: float = Field(..., gt=0)
    price: Optional[float] = Field(default=None, ge=0)


class TransactionCreate(BaseModel):
    customer_name: Optional[str] = None
    customer_id: Optional[str] = None
    amount: Optional[float] = Field(default=None, ge=0)
    transaction_type: Literal["credit", "cash", "payment"] = "credit"
    items: List[TransactionItemIn] = Field(default_factory=list)
    notes: Optional[str] = None


# ---------- Response models ----------

class ToolCallInfo(BaseModel):
    name: str
    arguments: dict
    result: Optional[dict] = None


class ChatResponse(BaseModel):
    reply: str
    mode: Literal["openai", "demo"]
    intent: Optional[str] = None
    tool_calls: List[ToolCallInfo] = Field(default_factory=list)
    data: Optional[dict] = None
    error: Optional[str] = None


class VoiceKhataResponse(BaseModel):
    """One-shot voice khata response (POST /api/audio/khata-voice).

    `audio_b64` is a base64 mp3 of `reply` so the frontend needs no extra
    round-trip to speak the confirmation.
    """
    transcript: Optional[str] = None
    reply: str
    mode: Optional[str] = None
    intent: Optional[str] = None
    tool_calls: List[ToolCallInfo] = Field(default_factory=list)
    data: Optional[dict] = None
    customer: Optional[dict] = None
    created: Optional[bool] = None
    audio_b64: Optional[str] = None
