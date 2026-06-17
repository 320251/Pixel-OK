from __future__ import annotations

import os
import re
import sys
from functools import lru_cache
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch


BASE_DIR = Path(__file__).resolve().parents[1]
HEARTLIB_SRC = BASE_DIR / "vendor" / "heartlib" / "src"
MODEL_ROOT = Path(os.environ.get("HEART_TRANSCRIPTOR_ROOT", BASE_DIR / "cache" / "hearttranscriptor")).expanduser()
MODEL_DIR = MODEL_ROOT / "HeartTranscriptor-oss"


class HeartTranscriberError(RuntimeError):
    pass


def is_heart_transcriptor_available() -> bool:
    return (
        HEARTLIB_SRC.exists()
        and (MODEL_DIR / "config.json").exists()
        and (MODEL_DIR / "model.safetensors").exists()
    )


def _ensure_runtime():
    if not is_heart_transcriptor_available():
        raise HeartTranscriberError(
            f"HeartTranscriptor-oss is not installed at {MODEL_DIR}."
        )
    src = str(HEARTLIB_SRC)
    if src not in sys.path:
        sys.path.insert(0, src)
    from heartlib import HeartTranscriptorPipeline

    return HeartTranscriptorPipeline


@lru_cache(maxsize=1)
def _pipeline():
    HeartTranscriptorPipeline = _ensure_runtime()
    use_cuda = torch.cuda.is_available()
    dtype = torch.float16 if use_cuda else torch.float32
    device = torch.device("cuda" if use_cuda else "cpu")
    return HeartTranscriptorPipeline.from_pretrained(
        str(MODEL_ROOT),
        device=device,
        dtype=dtype,
    )


def _load_audio(path: Path, target_sr: int = 16000) -> tuple[np.ndarray, int, float]:
    data, sr = sf.read(str(path), dtype="float32", always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    if sr != target_sr:
        data = librosa.resample(data, orig_sr=sr, target_sr=target_sr)
        sr = target_sr
    data = np.asarray(data, dtype=np.float32)
    duration = len(data) / float(sr or target_sr)
    return data, sr, duration


def split_lyrics_lines(text: str, max_words: int = 9) -> list[str]:
    normalized = (
        text.replace("＇", "'")
        .replace("’", "'")
        .replace("`", "'")
        .replace("  ", " ")
    )
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return []

    pieces = re.split(r"(?<=[.!?。！？;；])\s+|(?<=[,，])\s+", normalized)
    lines: list[str] = []
    for piece in pieces:
        words = piece.strip().split()
        if not words:
            continue
        while len(words) > max_words:
            lines.append(" ".join(words[:max_words]).strip(" ,.;!?，。；！？"))
            words = words[max_words:]
        if words:
            lines.append(" ".join(words).strip(" ,.;!?，。；！？"))
    return [line for line in lines if line]


def recognize_lyrics(media_path: Path, original_name: str | None = None) -> dict:
    media = Path(media_path).expanduser().resolve()
    if not media.exists():
        raise HeartTranscriberError(f"Audio not found: {media}")

    audio, sr, duration = _load_audio(media)
    pipe = _pipeline()
    with torch.no_grad():
        result = pipe(
            {"array": audio, "sampling_rate": sr},
            max_new_tokens=256,
            num_beams=2,
            task="transcribe",
            condition_on_prev_tokens=False,
            compression_ratio_threshold=1.8,
            temperature=(0.0, 0.1, 0.2, 0.4),
            logprob_threshold=-1.0,
            no_speech_threshold=0.4,
        )

    raw_text = str(result.get("text") if isinstance(result, dict) else result).strip()
    lines = split_lyrics_lines(raw_text)
    return {
        "text": "\n".join(lines) if lines else raw_text,
        "raw_text": raw_text,
        "segments": [],
        "summary": {
            "source_name": original_name or media.name,
            "model_path": str(MODEL_DIR),
            "line_count": len(lines),
        },
        "engine": "HeartTranscriptor-oss",
        "duration": round(duration, 3),
    }
