"""
GrowMate AI speech service.

Two operations, both powered by the OpenAI SDK against the OpenAI platform when
OPENAI_API_KEY is set (the chat agent's GROQ provider has no audio endpoints here):

* `transcribe(audio_bytes)`  – Speech-To-Text (Whisper / gpt-4o-mini-transcribe)
* `synthesize(text)`         – Text-To-Speech (gpt-4o-mini-tts) returning mp3 bytes

When the key is missing (or the setup is GROQ-only) these return None and the
frontend falls back to the browser Web Speech API / SpeechSynthesis, so the
demo never breaks.
"""
from __future__ import annotations

import logging
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)
_client = None

# Safety cap for an uploaded recording (OpenAI's own limit is 25 MB).
MAX_AUDIO_BYTES = 10 * 1024 * 1024


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI  # lazy so demo mode has no hard dependency
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def speech_enabled() -> bool:
    """True when the backend can do real STT/TTS (requires the OpenAI key).

    GROQ powers the chat agent; speech stays on the OpenAI platform, so a
    GROQ-only setup returns False and the frontend uses its in-browser speech.
    """
    return settings.speech_enabled


def transcribe(audio_bytes: bytes, filename: str = "voice.webm",
               mime_type: str = "audio/webm",
               language: Optional[str] = None,
               prompt: Optional[str] = None) -> Optional[str]:
    """Transcribe a recording to text (handles Hinglish). Returns None on failure.

    `language` / `prompt` default to the .env hints (OPENAI_TRANSCRIBE_HINT /
    OPENAI_TRANSCRIBE_PROMPT) which bias Whisper toward Hindi/Hinglish names
    and shopkeeper vocabulary.
    """
    if not speech_enabled() or not audio_bytes:
        return None
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        logger.warning("Audio upload too large: %d bytes", len(audio_bytes))
        return None
    kwargs = {
        "model": settings.OPENAI_TRANSCRIBE_MODEL,
        "file": (filename or "voice.webm", audio_bytes, mime_type or "audio/webm"),
        "response_format": "json",
    }
    if language is None:
        language = settings.OPENAI_TRANSCRIBE_HINT or None
    if prompt is None:
        prompt = settings.OPENAI_TRANSCRIBE_PROMPT or None
    if language:
        kwargs["language"] = language
    if prompt:
        kwargs["prompt"] = prompt
    try:
        result = _get_client().audio.transcriptions.create(**kwargs)
        text = (result.text or "").strip()
        return text or None
    except Exception as exc:  # never crash the server for a speech error
        logger.error("Transcription failed: %s", exc)
        return None


def synthesize(text: str, voice: Optional[str] = None) -> Optional[bytes]:
    """Synthesize speech as mp3 bytes. Returns None on failure."""
    if not speech_enabled() or not text or not text.strip():
        return None
    try:
        resp = _get_client().audio.speech.create(
            model=settings.OPENAI_TTS_MODEL,
            voice=voice or settings.OPENAI_TTS_VOICE,
            input=text.strip()[:1000],
        )
        return resp.content
    except Exception as exc:  # never crash the server for a speech error
        logger.error("TTS failed: %s", exc)
        return None
