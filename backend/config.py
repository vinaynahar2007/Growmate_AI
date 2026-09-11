"""
Central configuration for GrowMate AI backend.
All secrets stay server-side. Never expose API keys to the frontend.

LLM provider (chat agent) uses GROQ's OpenAI-compatible Responses API
(https://api.groq.com/openai/v1). Set GROQ_API_KEY to use it; falls back to
OPENAI_API_KEY when only that is set, and to "Demo AI mode" when neither is.
The OpenAI key is still used (optionally) for the speech service (STT/TTS).
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend/ first, then project root (whichever exists)
_BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(_BACKEND_DIR / ".env")
load_dotenv(_BACKEND_DIR.parent / ".env")


class Settings:
    # ---- LLM (chat agent) ---------------------------------------------------
    # Primary provider: GROQ, via the OpenAI-compatible Responses API.
    # (https://console.groq.com  ->  https://api.groq.com/openai/v1)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    GROQ_BASE_URL: str = (os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
                          .strip() or "https://api.groq.com/openai/v1")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b").strip() or "openai/gpt-oss-20b"

    # Fallback provider: the OpenAI platform (used when GROQ_API_KEY is empty).
    # The same key also powers the speech service below.
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "").strip()
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"

    # ---- Speech service (audio -> text and text -> audio, OpenAI only) ------
    OPENAI_TRANSCRIBE_MODEL: str = os.getenv("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-mini-transcribe").strip() or "gpt-4o-mini-transcribe"
    OPENAI_TTS_MODEL: str = os.getenv("OPENAI_TTS_MODEL", "gpt-4o-mini-tts").strip() or "gpt-4o-mini-tts"
    OPENAI_TTS_VOICE: str = os.getenv("OPENAI_TTS_VOICE", "nova").strip() or "nova"
    # Whisper transcription hints – bias the model toward Hindi/Hinglish names
    # and shopkeeper vocabulary ("Rahul", "Vikash", "s/o", khata, udhaar, ...)
    OPENAI_TRANSCRIBE_HINT: str = os.getenv("OPENAI_TRANSCRIBE_HINT", "hi").strip() or "hi"
    OPENAI_TRANSCRIBE_PROMPT: str = os.getenv(
        "OPENAI_TRANSCRIBE_PROMPT",
        "Hinglish shopkeeper dictating about a shop: customers, khata, udhaar, sales, "
        "names like Rahul, Ramesh, Vikash and 10-digit phone numbers.",
    ).strip()
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "").strip()
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000") or 8000)
    SHOP_ID: str = os.getenv("SHOP_ID", "shop_demo_001")
    SHOP_NAME: str = os.getenv("SHOP_NAME", "Sharma General Store")
    OWNER_NAME: str = os.getenv("OWNER_NAME", "Rajesh")

    ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
    ]

    @property
    def llm_provider(self) -> str:
        """Which backend powers the chat agent: 'groq', 'openai' or '' (demo)."""
        if self.GROQ_API_KEY:
            return "groq"
        if self.OPENAI_API_KEY:
            return "openai"
        return ""

    @property
    def llm_api_key(self) -> str:
        return self.GROQ_API_KEY or self.OPENAI_API_KEY

    @property
    def llm_base_url(self) -> str:
        """GROQ endpoint when GROQ is the provider, else None (OpenAI default)."""
        return self.GROQ_BASE_URL if self.GROQ_API_KEY else None

    @property
    def llm_model(self) -> str:
        return self.GROQ_MODEL if self.GROQ_API_KEY else self.OPENAI_MODEL

    @property
    def ai_enabled(self) -> bool:
        return bool(self.llm_api_key)

    @property
    def speech_enabled(self) -> bool:
        """Speech (STT/TTS) still runs on OpenAI — needs the OPENAI_API_KEY.

        With a GROQ-only setup this returns False so the frontend automatically
        falls back to the browser Web Speech API instead of failing silently.
        """
        return bool(self.OPENAI_API_KEY)

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.SUPABASE_URL and self.SUPABASE_KEY)


settings = Settings()
