from __future__ import annotations

import importlib.util
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import uuid
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from tuner.processor import process_job
from tuner.heart_transcriber import is_heart_transcriptor_available, recognize_lyrics
from tuner.lyrics_resolver import improve_lyrics_with_lrclib, resolve_official_lyrics
from tuner.lyrics_timing import audio_duration, retime_synced_lyrics
from tuner.uvr_runner import is_uvr_available, split_original_to_lead_and_backing, split_vocal_layers


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
JOBS_DIR = BASE_DIR / "jobs"
JOBS_DIR.mkdir(exist_ok=True)

VISUAL_SCENES = {"procedural"}
DEFAULT_PALETTE = ["#45f5a1", "#4fd8ff", "#ff5d9d", "#ffd166"]
PROCEDURAL_LAYOUTS = ["radial", "diagonal", "tunnel", "constellation", "stacked", "fluid", "split-screen"]
PROJECT_STATE_NAME = "project_state.json"
SEPARATION_STATUS_NAME = "separation_status.json"
PROJECT_UPLOADS = {".wav", ".mp3", ".flac", ".m4a", ".aac", ".ogg", ".webm"}
SEPARATION_THREADS: dict[str, threading.Thread] = {}
SEPARATION_LOCK = threading.Lock()

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 600 * 1024 * 1024
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0


@app.after_request
def no_cache(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


def _has_module(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def _now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _valid_job_id(job_id: str) -> bool:
    return len(job_id) == 12 and all(ch in "0123456789abcdef" for ch in job_id)


def _state_path(job_dir: Path) -> Path:
    return job_dir / PROJECT_STATE_NAME


def _separation_status_path(job_dir: Path) -> Path:
    return job_dir / SEPARATION_STATUS_NAME


def _read_separation_status(job_dir: Path) -> dict:
    path = _separation_status_path(job_dir)
    if not path.exists():
        return {"status": "idle", "message": "还没有开始分轨。"}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {"status": "idle", "message": "分轨状态为空。"}
    except Exception:
        return {"status": "idle", "message": "分轨状态读取失败。"}


def _write_separation_status(job_dir: Path, status: dict) -> dict:
    job_dir.mkdir(parents=True, exist_ok=True)
    payload = dict(status or {})
    payload.setdefault("status", "running")
    payload["updated_at"] = _now_iso()
    _separation_status_path(job_dir).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


def _has_active_separation_thread(job_id: str) -> bool:
    with SEPARATION_LOCK:
        thread = SEPARATION_THREADS.get(job_id)
        if thread is not None and thread.is_alive():
            return True
        SEPARATION_THREADS.pop(job_id, None)
    return False


def _separation_outputs_ready(job_dir: Path) -> bool:
    return (job_dir / "lead_vocal.wav").exists() and (job_dir / "backing_with_harmony.wav").exists()


def _complete_separation_from_files(job_id: str, job_dir: Path, original_path: Path) -> dict:
    downloads = _separation_downloads(job_id, original_path, job_dir)
    return _write_separation_status(
        job_dir,
        {
            "status": "complete",
            "job_id": job_id,
            "message": "三轨完成。现在只看原轨、主唱、含和声的伴奏。",
            "downloads": downloads,
        },
    )


def _read_project_state(job_dir: Path) -> dict:
    path = _state_path(job_dir)
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def _write_project_state(job_dir: Path, state: dict) -> dict:
    job_dir.mkdir(parents=True, exist_ok=True)
    merged = dict(state or {})
    merged.setdefault("created_at", _now_iso())
    merged["updated_at"] = _now_iso()
    _state_path(job_dir).write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    return merged


def _original_path(job_dir: Path) -> Path | None:
    for item in sorted(job_dir.glob("original.*")):
        if item.is_file():
            return item
    return None


def _stored_name(job_dir: Path, stem: str, fallback: str = "") -> str:
    path = job_dir / f"{stem}_original_name.txt"
    if path.exists():
        try:
            return path.read_text(encoding="utf-8").strip() or fallback
        except Exception:
            return fallback
    return fallback


def _project_downloads(job_id: str, job_dir: Path) -> dict:
    downloads: dict[str, str] = {}
    original = _original_path(job_dir)
    if original:
        downloads["original"] = f"/api/download/{job_id}/{original.name}"
    for key, filename in {
        "backing_with_harmony": "backing_with_harmony.wav",
        "lead_vocal": "lead_vocal.wav",
        "take": "take.webm",
    }.items():
        if (job_dir / filename).exists():
            downloads[key] = f"/api/download/{job_id}/{filename}"
    return downloads


def _project_summary(job_id: str, job_dir: Path) -> dict:
    state = _read_project_state(job_dir)
    original = _original_path(job_dir)
    original_name = _stored_name(job_dir, "original", original.name if original else "")
    title = state.get("title") or state.get("currentTitle") or Path(original_name).stem or job_id
    lyric_cues = state.get("lyricCues") if isinstance(state.get("lyricCues"), list) else []
    visual_state = state.get("visual") if isinstance(state.get("visual"), dict) else {}
    visual_plan = state.get("visualPlan") or visual_state.get("visualPlan") or visual_state.get("plan")
    has_visual_plan = isinstance(visual_plan, dict) and bool(visual_plan.get("scenes"))
    updated_at = state.get("updated_at")
    if not updated_at:
        candidates = [item.stat().st_mtime for item in job_dir.glob("*") if item.is_file()]
        updated_at = datetime.fromtimestamp(max(candidates) if candidates else job_dir.stat().st_mtime).astimezone().isoformat(timespec="seconds")
    return {
        "job_id": job_id,
        "title": title,
        "original_name": original_name,
        "created_at": state.get("created_at", ""),
        "updated_at": updated_at,
        "has_original": bool(original),
        "has_stems": (job_dir / "backing_with_harmony.wav").exists() and (job_dir / "lead_vocal.wav").exists(),
        "has_visual_plan": has_visual_plan,
        "visual_scene_count": len(visual_plan.get("scenes", [])) if isinstance(visual_plan, dict) else 0,
        "lyric_count": len(lyric_cues),
        "has_take": (job_dir / "take.webm").exists(),
        "downloads": _project_downloads(job_id, job_dir),
        "separation": _read_separation_status(job_dir),
    }


def _separation_downloads(job_id: str, original_path: Path, job_dir: Path) -> dict:
    downloads = {"original": f"/api/download/{job_id}/{original_path.name}"}
    for key, filename in {
        "acapella": "acapella.wav",
        "accompaniment": "accompaniment.wav",
        "lead_vocal": "lead_vocal.wav",
        "backing_with_harmony": "backing_with_harmony.wav",
        "backing_vocals": "backing_vocals.wav",
    }.items():
        if (job_dir / filename).exists():
            downloads[key] = f"/api/download/{job_id}/{filename}"
    return downloads


def _lyrics_timing_audio(job_dir: Path) -> Path | None:
    for name in ("lead_vocal.wav", "acapella.wav"):
        path = job_dir / name
        if path.exists():
            return path
    return _original_path(job_dir)


def _spread_lyric_lines(lines: list[str], duration: float) -> list[dict[str, float | str]]:
    clean = [str(line).strip() for line in lines if str(line).strip()]
    if not clean:
        return []
    start = 0.0
    end = max(float(duration or 0.0), len(clean) * 3.2)
    step = max(0.7, (end - start) / len(clean))
    return [
        {
            "text": line,
            "start": round(start + step * index, 3),
            "end": round(max(start + step * (index + 1), start + step * index + 0.35), 3),
        }
        for index, line in enumerate(clean)
    ]


def _public_lyrics_match(match: dict, timing: dict | None = None) -> dict:
    payload = {
        "provider": "LRCLIB",
        "id": match.get("id"),
        "track_name": match.get("track_name"),
        "artist_name": match.get("artist_name"),
        "album_name": match.get("album_name"),
        "duration": match.get("duration"),
        "score": match.get("score"),
        "query": match.get("query"),
        "synced": bool(match.get("synced_segments")),
    }
    if timing:
        payload["timing"] = timing
    return payload


def _codex_exec_lyrics_hint(title: str, artist: str) -> dict:
    prompt = f"""
You are a metadata lookup helper for a local karaoke tool.
Search the web if needed and identify the most likely official song title and artist for this request.
Do not include song lyrics. Do not quote copyrighted lyrics.
Return only compact JSON with these keys:
{{"title": "...", "artist": "...", "query": "...", "note": "..."}}

User supplied title: {title}
User supplied artist: {artist}
"""
    with tempfile.TemporaryDirectory() as tmp:
        output_path = Path(tmp) / "codex-lyrics-hint.json"
        codex_cmd = shutil.which("codex.cmd") or shutil.which("codex") or "codex"
        command_prefix = ["cmd.exe", "/c", codex_cmd] if codex_cmd.lower().endswith((".cmd", ".bat")) else [codex_cmd]
        cmd = [
            *command_prefix,
            "--search",
            "exec",
            "-c",
            'service_tier="fast"',
            "-c",
            'model_reasoning_effort="low"',
            "--skip-git-repo-check",
            "--ephemeral",
            "--sandbox",
            "read-only",
            "--color",
            "never",
            "-C",
            str(BASE_DIR),
            "-o",
            str(output_path),
            "-",
        ]
        completed = subprocess.run(
            cmd,
            input=prompt,
            cwd=str(BASE_DIR),
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            timeout=180,
        )
        text = ""
        if output_path.exists():
            text = output_path.read_text(encoding="utf-8", errors="replace")
        if not text:
            text = completed.stdout or completed.stderr
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise RuntimeError("codex exec did not return JSON")
        payload = json.loads(match.group(0))
        return payload if isinstance(payload, dict) else {}


def _run_separation_worker(job_id: str, original_path: Path) -> None:
    job_dir = JOBS_DIR / job_id

    def update(message: str) -> None:
        _write_separation_status(
            job_dir,
            {
                "status": "running",
                "job_id": job_id,
                "message": message,
                "downloads": _separation_downloads(job_id, original_path, job_dir),
            },
        )

    try:
        update("正在启动三轨分离。")
        result = split_original_to_lead_and_backing(original_path=original_path, job_dir=job_dir, status_callback=update)
        result["job_id"] = job_id
        result["downloads"] = _separation_downloads(job_id, original_path, job_dir)
        existing = _read_project_state(job_dir)
        original_name = _stored_name(job_dir, "original", original_path.name)
        title = existing.get("title") or existing.get("currentTitle") or Path(original_name).stem or job_id
        _write_project_state(
            job_dir,
            {
                **existing,
                "job_id": job_id,
                "title": title,
                "currentTitle": title,
                "original_name": original_name,
                "downloads": result["downloads"],
            },
        )
        _write_separation_status(
            job_dir,
            {
                "status": "complete",
                "job_id": job_id,
                "message": "三轨完成。现在只看原轨、主唱、含和声的伴奏。",
                "result": result,
                "downloads": result["downloads"],
            },
        )
    except Exception as exc:
        _write_separation_status(
            job_dir,
            {
                "status": "error",
                "job_id": job_id,
                "message": str(exc),
                "downloads": _separation_downloads(job_id, original_path, job_dir),
            },
        )
    finally:
        with SEPARATION_LOCK:
            SEPARATION_THREADS.pop(job_id, None)


def _save_upload(field_name: str, job_dir: Path, stem: str) -> Path:
    upload = request.files.get(field_name)
    if upload is None or not upload.filename:
        raise ValueError(f"Missing file: {field_name}")

    suffix = Path(upload.filename).suffix.lower()
    if suffix not in PROJECT_UPLOADS:
        raise ValueError("Supported audio files: wav, mp3, flac, m4a, aac, ogg, webm")

    safe_name = secure_filename(upload.filename) or f"{stem}{suffix}"
    dest = job_dir / f"{stem}{suffix}"
    upload.save(dest)
    (job_dir / f"{stem}_original_name.txt").write_text(safe_name, encoding="utf-8")
    return dest


def _clamp_number(value, default: float, min_value: float, max_value: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return max(min_value, min(max_value, number))


def _extract_json_object(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        raise ValueError("empty Codex response")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise
        return json.loads(text[start : end + 1])


def _sanitize_time_list(values: object, duration: float, limit: int) -> list[float]:
    if not isinstance(values, list):
        return []
    times = []
    for value in values[:limit]:
        number = round(_clamp_number(value, 0, 0, duration), 3)
        if not times or number > times[-1] + 0.001:
            times.append(number)
    return times


def _sanitize_curve(values: object, duration: float, limit: int = 240) -> list[dict]:
    if not isinstance(values, list):
        return []
    curve = []
    for raw in values[:limit]:
        if isinstance(raw, dict):
            time_value = raw.get("time")
            value = raw.get("value")
        elif isinstance(raw, (list, tuple)) and len(raw) >= 2:
            time_value, value = raw[0], raw[1]
        else:
            continue
        curve.append(
            {
                "time": round(_clamp_number(time_value, 0, 0, duration), 2),
                "value": round(_clamp_number(value, 0, 0, 1), 3),
            }
        )
    curve.sort(key=lambda item: item["time"])
    return curve


def _sanitize_sections(values: object, duration: float, limit: int = 32) -> list[dict]:
    if not isinstance(values, list):
        return []
    sections = []
    for index, raw in enumerate(values[:limit]):
        if not isinstance(raw, dict):
            continue
        start = _clamp_number(raw.get("start"), 0, 0, duration)
        end = _clamp_number(raw.get("end"), duration if index == len(values) - 1 else start, 0, duration)
        if end <= start:
            continue
        sections.append(
            {
                "start": round(start, 2),
                "end": round(end, 2),
                "label": str(raw.get("label") or raw.get("name") or "section")[:32],
                "intensity": round(_clamp_number(raw.get("intensity"), 0.5, 0, 1), 3),
            }
        )
    sections.sort(key=lambda item: item["start"])
    return sections


def _sanitize_waveform_profile(profile: object, duration: float) -> dict:
    if not isinstance(profile, dict):
        return {}

    raw_bins = profile.get("bins")
    if not isinstance(raw_bins, list):
        raw_bins = []
    bins = [round(_clamp_number(value, 0, 0, 1), 3) for value in raw_bins[:96]]
    if not bins:
        return {}

    raw_peaks = profile.get("peaks")
    peaks = []
    if isinstance(raw_peaks, list):
        for raw in raw_peaks[:12]:
            if isinstance(raw, dict):
                time_value = raw.get("time")
                energy_value = raw.get("value")
            else:
                time_value = raw
                energy_value = 1
            peaks.append(
                {
                    "time": round(_clamp_number(time_value, 0, 0, duration), 2),
                    "value": round(_clamp_number(energy_value, 1, 0, 1), 3),
                }
            )

    sources = []
    raw_sources = profile.get("sources")
    if isinstance(raw_sources, list):
        for raw_source in raw_sources[:3]:
            if not isinstance(raw_source, dict):
                continue
            source_bins = raw_source.get("bins")
            if not isinstance(source_bins, list):
                continue
            source_name = str(raw_source.get("name") or "audio")[:40]
            sources.append(
                {
                    "name": source_name,
                    "bins": [round(_clamp_number(value, 0, 0, 1), 3) for value in source_bins[:96]],
                }
            )

    raw_analysis = profile.get("analysis") if isinstance(profile.get("analysis"), dict) else {}
    beat_times = _sanitize_time_list(raw_analysis.get("beatTimes") or profile.get("beatTimes"), duration, 900)
    bar_times = _sanitize_time_list(raw_analysis.get("barTimes") or profile.get("barTimes"), duration, 240)
    energy_curve = _sanitize_curve(raw_analysis.get("energyCurve") or profile.get("energyCurve"), duration)
    onset_curve = _sanitize_curve(raw_analysis.get("onsetCurve") or profile.get("onsetCurve"), duration)
    sections = _sanitize_sections(raw_analysis.get("sections") or profile.get("sections"), duration)
    bpm = round(_clamp_number(raw_analysis.get("bpm") or profile.get("bpm"), 120, 40, 240), 2)

    sanitized = {
        "duration": round(_clamp_number(profile.get("duration"), duration, 0, 3600), 2),
        "binCount": len(bins),
        "source": str(profile.get("source") or "audio")[:120],
        "bins": bins,
        "peaks": peaks,
        "averageEnergy": round(_clamp_number(profile.get("averageEnergy"), sum(bins) / len(bins), 0, 1), 3),
        "sources": sources,
    }
    if beat_times or bar_times or energy_curve or onset_curve or sections:
        sanitized["bpm"] = bpm
        sanitized["beatTimes"] = beat_times
        sanitized["barTimes"] = bar_times
        sanitized["energyCurve"] = energy_curve
        sanitized["onsetCurve"] = onset_curve
        sanitized["sections"] = sections
        sanitized["analysis"] = {
            "bpm": bpm,
            "beatTimes": beat_times,
            "barTimes": bar_times,
            "energyCurve": energy_curve,
            "onsetCurve": onset_curve,
            "sections": sections,
        }
    return sanitized


def _format_waveform_prompt(waveform: dict) -> str:
    if not waveform:
        return "波形摘要：未提供。若没有波形，就按歌词情绪和句子密度设计。"

    peak_text = ", ".join(f"{peak['time']}s/{peak['value']}" for peak in waveform.get("peaks", [])[:8]) or "无明显峰值"
    analysis = waveform.get("analysis") if isinstance(waveform.get("analysis"), dict) else waveform
    beat_times = analysis.get("beatTimes") if isinstance(analysis.get("beatTimes"), list) else []
    bar_times = analysis.get("barTimes") if isinstance(analysis.get("barTimes"), list) else []
    sections = analysis.get("sections") if isinstance(analysis.get("sections"), list) else []
    section_text = (
        ", ".join(
            f"{section.get('label', 'section')} {section.get('start', 0)}-{section.get('end', 0)}s/{section.get('intensity', 0)}"
            for section in sections[:10]
            if isinstance(section, dict)
        )
        or "未切段"
    )
    beat_preview = ", ".join(f"{float(time):.2f}s" for time in beat_times[:12]) if beat_times else "无"
    bar_preview = ", ".join(f"{float(time):.2f}s" for time in bar_times[:8]) if bar_times else "无"
    lines = [
        "本地音频分析摘要（0 到 1 归一化；前端运行时会用这些数据驱动动画，不要把它画成波形）：",
        f"- 来源：{waveform.get('source', 'audio')}",
        f"- 平均能量：{waveform.get('averageEnergy', 0)}",
        f"- 估计 BPM：{analysis.get('bpm', waveform.get('bpm', 'unknown'))}",
        f"- beat 数：{len(beat_times)}；前 12 个 beat：{beat_preview}",
        f"- bar 数：{len(bar_times)}；前 8 个 bar：{bar_preview}",
        f"- 段落：{section_text}",
        f"- 综合能量 bins：{json.dumps(waveform.get('bins', []), ensure_ascii=False)}",
        f"- 峰值时间/强度：{peak_text}",
    ]
    if isinstance(analysis.get("energyCurve"), list):
        lines.append(f"- energyCurve 抽样：{json.dumps(analysis.get('energyCurve', [])[:24], ensure_ascii=False)}")
    if isinstance(analysis.get("onsetCurve"), list):
        lines.append(f"- onsetCurve 抽样：{json.dumps(analysis.get('onsetCurve', [])[:24], ensure_ascii=False)}")
    for source in waveform.get("sources", [])[:3]:
        lines.append(f"- {source.get('name', 'audio')} bins：{json.dumps(source.get('bins', []), ensure_ascii=False)}")
    return "\n".join(lines)


def _text_has_any(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in terms)


def _stable_seed(text: str) -> int:
    digest = hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()
    return int(digest[:8], 16)


def _seed_pick(items: list[str], seed: int, offset: int = 0) -> str:
    return items[(seed + offset * 7919) % len(items)]


def _hsl_to_hex(hue: float, saturation: float, lightness: float) -> str:
    chroma = (1 - abs(2 * lightness - 1)) * saturation
    middle = lightness - chroma / 2
    x_value = chroma * (1 - abs((hue / 60) % 2 - 1))
    if hue < 60:
        red, green, blue = chroma, x_value, 0
    elif hue < 120:
        red, green, blue = x_value, chroma, 0
    elif hue < 180:
        red, green, blue = 0, chroma, x_value
    elif hue < 240:
        red, green, blue = 0, x_value, chroma
    elif hue < 300:
        red, green, blue = x_value, 0, chroma
    else:
        red, green, blue = chroma, 0, x_value
    return f"#{round((red + middle) * 255):02x}{round((green + middle) * 255):02x}{round((blue + middle) * 255):02x}"


def _seed_palette(seed: int) -> list[str]:
    base = seed % 360
    return [
        _hsl_to_hex((base + 0) % 360, 0.86, 0.58),
        _hsl_to_hex((base + 88) % 360, 0.92, 0.62),
        _hsl_to_hex((base + 176) % 360, 0.82, 0.68),
        _hsl_to_hex((base + 252) % 360, 0.9, 0.6),
        "#f4f7fb",
    ]


def _extract_visual_tokens(title: str, lyrics: str, limit: int = 14) -> list[str]:
    text = f"{title}\n{lyrics}"
    raw_tokens = re.findall(r"[A-Za-z][A-Za-z']{2,}|[\u4e00-\u9fff]{1,4}", text)
    stop_words = {
        "the",
        "and",
        "you",
        "your",
        "that",
        "this",
        "with",
        "for",
        "from",
        "have",
        "just",
        "are",
        "was",
        "were",
        "啊",
        "呀",
        "啦",
        "的",
        "了",
        "我",
        "你",
        "他",
        "她",
    }
    tokens: list[str] = []
    seen: set[str] = set()
    for token in raw_tokens:
        cleaned = token.strip("'").strip()
        key = cleaned.lower()
        if not cleaned or key in stop_words or key in seen:
            continue
        seen.add(key)
        tokens.append(cleaned[:18])
        if len(tokens) >= limit:
            break
    return tokens or ["stage", "singer", "microphone", "city-light"]


def _waveform_energy_hint(waveform: dict | None, index: int, count: int) -> float:
    bins = waveform.get("bins") if isinstance(waveform, dict) else []
    if not isinstance(bins, list) or not bins:
        return 0.45 + (index % 3) * 0.12
    position = int(round((index + 0.5) / max(1, count) * (len(bins) - 1)))
    try:
        return _clamp_number(bins[position], 0.5, 0, 1)
    except (IndexError, TypeError):
        return 0.5


def _visual_block(seed: int, index: int, energy: float) -> dict:
    return {
        "seed": int((seed + index * 2654435761) % 4294967295),
        "layout": _seed_pick(PROCEDURAL_LAYOUTS, seed, index),
        "turbulence": round(0.28 + energy * 0.72, 3),
        "symmetry": round(0.15 + ((seed >> (index % 8)) & 7) / 10, 3),
        "scale": round(0.78 + energy * 0.62, 3),
        "colorShift": round(((seed + index * 37) % 360) / 360, 3),
        "beatLock": "waveform-peaks",
    }


ACTION_TRIGGERS = {"intro", "lyric", "beat", "peak", "quiet"}
ACTION_VERBS = {
    "pose-snap",
    "step",
    "lean",
    "pulse",
    "open",
    "close",
    "rise",
    "retract",
    "glow",
    "blink",
    "push-in",
    "hold",
}
CAMERA_MOVES = {"hold", "push-in", "pull-back", "pan-left", "pan-right", "shake-cut"}
ABSTRACT_PRIMARY_MOTIFS = {
    "pulse-orbit",
    "voice-ribbon",
    "light-grid",
    "wave-tunnel",
    "abstract-wave",
    "waveform",
    "waveform-spine",
    "audio-wave",
    "sound-wave",
}
ABSTRACT_THEME_FAMILIES = {"abstract-wave", "waveform", "orbit", "voice-ribbon", "light-grid", "wave-tunnel"}
CLIP_PART_TYPES = {"rect", "line", "poly"}
SPRITE_MAX_COUNT = 8
SPRITE_MAX_ROWS = 28
SPRITE_MAX_COLS = 36
SPRITE_TRANSPARENT_CHARS = {".", " ", "_", "0"}
CLIP_COLOR_TOKENS = {
    "primary",
    "secondary",
    "accent",
    "highlight",
    "shadow",
    "skin",
    "hair",
    "white",
    "black",
    "red",
    "blue",
    "yellow",
    "green",
    "palette0",
    "palette1",
    "palette2",
    "palette3",
    "palette4",
    "palette.0",
    "palette.1",
    "palette.2",
    "palette.3",
    "palette.4",
}
CLIP_MAX_PARTS = 48
CLIP_MAX_POINTS = 12
ASSET_MAX_COUNT = 8
ASSET_MAX_WIDTH = 36
ASSET_MAX_HEIGHT = 32
WIKI_CONTEXT_CACHE: dict[str, dict] = {}
THEME_KEYWORDS = [
    (
        "horror-pop",
        [
            "thriller",
            "ghost",
            "ghoul",
            "wolf",
            "werewolf",
            "zombie",
            "monster",
            "creature",
            "grave",
            "haunt",
            "haunted",
            "demon",
            "vampire",
            "skeleton",
            "terror",
            "horror",
            "scream",
            "midnight",
            "night",
            "dark",
            "darkness",
            "evil",
            "lurking",
            "sight",
            "nightmare",
            "corpse",
            "dead",
            "鬼",
            "狼",
            "僵尸",
            "怪物",
            "恐怖",
            "墓",
            "恶魔",
            "尖叫",
            "噩梦",
        ],
    ),
    (
        "rain-memory",
        [
            "rain",
            "raining",
            "storm",
            "thunder",
            "umbrella",
            "tears",
            "tear",
            "cry",
            "crying",
            "memory",
            "memories",
            "remember",
            "forget",
            "window",
            "puddle",
            "雨",
            "下雨",
            "暴雨",
            "雷",
            "伞",
            "眼泪",
            "泪",
            "哭",
            "回忆",
            "记忆",
            "想起",
            "忘记",
            "窗",
        ],
    ),
    (
        "dance-pop",
        [
            "dance",
            "dancing",
            "dancer",
            "disco",
            "party",
            "club",
            "dj",
            "beat",
            "beats",
            "groove",
            "rhythm",
            "move",
            "floor",
            "rock",
            "walk",
            "talk",
            "step",
            "spin",
            "spotlight",
            "stage",
            "show",
            "jump",
            "跳舞",
            "舞",
            "舞台",
            "节拍",
            "派对",
            "律动",
        ],
    ),
    (
        "romance-pop",
        [
            "love",
            "lover",
            "lovers",
            "heart",
            "kiss",
            "baby",
            "darling",
            "sweet",
            "girl",
            "woman",
            "changed",
            "feel",
            "same",
            "stay",
            "forever",
            "together",
            "touch",
            "hold",
            "romance",
            "rose",
            "valentine",
            "爱",
            "爱情",
            "心",
            "亲吻",
            "吻",
            "宝贝",
            "永远",
            "拥抱",
            "玫瑰",
            "恋",
        ],
    ),
    (
        "lonely-night",
        [
            "lonely",
            "alone",
            "empty",
            "silence",
            "silent",
            "miss",
            "missing",
            "goodbye",
            "shadow",
            "night",
            "midnight",
            "sleepless",
            "cold",
            "blue",
            "phone",
            "孤独",
            "寂寞",
            "独自",
            "想念",
            "再见",
            "夜",
            "午夜",
            "失眠",
            "影子",
            "空",
        ],
    ),
    (
        "cosmic-world",
        [
            "star",
            "stars",
            "starlight",
            "sky",
            "moon",
            "sun",
            "planet",
            "galaxy",
            "cosmic",
            "space",
            "universe",
            "world",
            "heaven",
            "dream",
            "fly",
            "light",
            "firework",
            "星",
            "星星",
            "星空",
            "天空",
            "月亮",
            "太阳",
            "宇宙",
            "世界",
            "梦",
            "飞",
            "光",
        ],
    ),
    (
        "urban-stage",
        [
            "city",
            "street",
            "neon",
            "lights",
            "downtown",
            "subway",
            "train",
            "car",
            "drive",
            "road",
            "hotel",
            "bar",
            "radio",
            "record",
            "vinyl",
            "microphone",
            "crowd",
            "城市",
            "街",
            "霓虹",
            "灯",
            "公路",
            "车",
            "地铁",
            "唱片",
            "麦克风",
            "人群",
        ],
    ),
]
KNOWN_THEME_FAMILIES = {theme for theme, _ in THEME_KEYWORDS}

def _keyword_score(text: str, terms: list[str]) -> int:
    return sum(1 for term in terms if term and term in text)


def _normalized_theme_family(theme_family: str) -> str:
    family = str(theme_family or "").strip().lower()
    if family in ABSTRACT_THEME_FAMILIES:
        return "urban-stage"
    if family in KNOWN_THEME_FAMILIES:
        return family
    aliases = [
        ("horror", "horror-pop"),
        ("romance", "romance-pop"),
        ("love", "romance-pop"),
        ("dance", "dance-pop"),
        ("lonely", "lonely-night"),
        ("night", "lonely-night"),
        ("cosmic", "cosmic-world"),
        ("space", "cosmic-world"),
        ("rain", "rain-memory"),
        ("memory", "rain-memory"),
        ("urban", "urban-stage"),
        ("city", "urban-stage"),
        ("stage", "urban-stage"),
    ]
    for needle, normalized in aliases:
        if needle in family:
            return normalized
    return "urban-stage"


def _is_abstract_primary_motif(primary_motif: object) -> bool:
    normalized = re.sub(r"[\s_]+", "-", str(primary_motif or "").strip().lower())
    return normalized in ABSTRACT_PRIMARY_MOTIFS


def _is_abstract_theme_family(theme_family: object) -> bool:
    normalized = re.sub(r"[\s_]+", "-", str(theme_family or "").strip().lower())
    return normalized in ABSTRACT_THEME_FAMILIES


def _theme_family(title: str, lyrics: str, motifs: list[str]) -> str:
    text = f"{title}\n{lyrics}\n{' '.join(motifs)}".lower()
    best_theme = "urban-stage"
    best_score = 0
    for theme, keywords in THEME_KEYWORDS:
        score = _keyword_score(text, keywords)
        if score > best_score:
            best_theme = theme
            best_score = score
    return best_theme


def _slugify_motif(value: object, fallback: str = "pixel-subject") -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", text).strip("-")
    text = re.sub(r"-{2,}", "-", text)
    if not text:
        text = fallback
    return text[:48].strip("-") or fallback


def _primary_motif(theme_family: str, index: int, motifs: list[str]) -> str:
    family = _normalized_theme_family(theme_family)
    clean_motifs = [_slugify_motif(item, "") for item in motifs if _slugify_motif(item, "")]
    if clean_motifs:
        subject = clean_motifs[index % len(clean_motifs)]
        if subject in {"song", "music", "lyrics", "voice", "beat", "light", "stage"}:
            return _slugify_motif(f"{family}-{subject}-figure")
        return subject
    return _slugify_motif(f"{family}-pixel-subject")


def _distinct_primary_motif(theme_family: str, index: int, previous: str, motifs: list[str]) -> str:
    candidate = _primary_motif(theme_family, index, motifs)
    if candidate != previous:
        return candidate
    options = [_slugify_motif(item, "") for item in motifs if _slugify_motif(item, "")]
    options.extend(
        [
            _slugify_motif(f"{theme_family}-silhouette"),
            _slugify_motif(f"{theme_family}-prop"),
            _slugify_motif(f"{theme_family}-place"),
        ]
    )
    for offset in range(1, len(options) + 1):
        alternative = options[(index + offset) % len(options)]
        if alternative != previous:
            return alternative
    return candidate


def _fallback_clip_actions() -> list[dict]:
    return [
        {
            "trigger": "beat",
            "verb": "pose-snap",
            "target": "subject-body",
            "camera": "push-in",
            "beatResponse": "clip parts scale and shift on waveform peaks",
        },
        {
            "trigger": "quiet",
            "verb": "hold",
            "target": "subject-head",
            "camera": "hold",
            "beatResponse": "clip parts settle during low-energy bins",
        },
    ]


def _fallback_clip(subject: str, theme_family: str, seed: int, index: int, energy: float) -> dict:
    subject_slug = _slugify_motif(subject)
    family = _normalized_theme_family(theme_family)
    sprite_id = "main-sprite"
    parts: list[dict] = [
        {
            "id": "subject-shadow",
            "type": "rect",
            "x": 0.36,
            "y": 0.82,
            "w": 0.28,
            "h": 0.035,
            "color": "shadow",
            "alpha": 0.5,
            "motion": {"kind": "beat-pulse", "amount": round(0.02 + energy * 0.03, 3), "axis": "x"},
        },
        {
            "id": "subject-body",
            "type": "rect",
            "x": 0.44,
            "y": 0.42,
            "w": 0.12,
            "h": 0.29,
            "color": "primary",
            "motion": {"kind": "beat-snap", "amount": round(0.03 + energy * 0.04, 3), "axis": "y"},
        },
        {
            "id": "subject-head",
            "type": "rect",
            "x": 0.455,
            "y": 0.29,
            "w": 0.09,
            "h": 0.09,
            "color": "highlight",
            "motion": {"kind": "beat-pulse", "amount": round(0.015 + energy * 0.025, 3)},
        },
        {"id": "left-leg", "type": "line", "x1": 0.47, "y1": 0.7, "x2": 0.42, "y2": 0.84, "color": "primary", "lineWidth": 0.025},
        {"id": "right-leg", "type": "line", "x1": 0.53, "y1": 0.7, "x2": 0.58, "y2": 0.84, "color": "primary", "lineWidth": 0.025},
        {"id": "left-arm", "type": "line", "x1": 0.44, "y1": 0.48, "x2": 0.34, "y2": 0.58, "color": "secondary", "lineWidth": 0.022},
        {"id": "right-arm", "type": "line", "x1": 0.56, "y1": 0.48, "x2": 0.66, "y2": 0.4, "color": "secondary", "lineWidth": 0.022},
    ]

    text = f"{subject_slug} {family}"
    if any(word in text for word in ["heart", "love", "romance"]):
        parts.append(
            {
                "id": "heart-prop",
                "type": "poly",
                "points": [[0.5, 0.17], [0.42, 0.1], [0.34, 0.19], [0.5, 0.34], [0.66, 0.19], [0.58, 0.1]],
                "color": "accent",
                "motion": {"kind": "peak-flash", "amount": 0.08},
            }
        )
    elif any(word in text for word in ["rain", "window", "storm", "memory"]):
        parts.extend(
            [
                {"id": "window-frame", "type": "rect", "x": 0.2, "y": 0.18, "w": 0.6, "h": 0.43, "color": "shadow", "alpha": 0.45},
                {"id": "rain-streak-a", "type": "line", "x1": 0.28, "y1": 0.19, "x2": 0.24, "y2": 0.58, "color": "palette1", "lineWidth": 0.012, "motion": {"kind": "beat-shift", "amount": 0.04, "axis": "y"}},
                {"id": "rain-streak-b", "type": "line", "x1": 0.72, "y1": 0.2, "x2": 0.67, "y2": 0.6, "color": "palette2", "lineWidth": 0.01, "motion": {"kind": "beat-shift", "amount": 0.035, "axis": "y"}},
            ]
        )
    elif any(word in text for word in ["moon", "wolf", "ghost", "zombie", "monster", "horror"]):
        parts.extend(
            [
                {"id": "moon-block", "type": "rect", "x": 0.68, "y": 0.12, "w": 0.13, "h": 0.13, "color": "white", "alpha": 0.8, "motion": {"kind": "peak-flash", "amount": 0.04}},
                {"id": "eye-left", "type": "rect", "x": 0.46, "y": 0.32, "w": 0.022, "h": 0.018, "color": "red"},
                {"id": "eye-right", "type": "rect", "x": 0.52, "y": 0.32, "w": 0.022, "h": 0.018, "color": "red"},
            ]
        )
    elif any(word in text for word in ["record", "vinyl", "radio", "music"]):
        parts.extend(
            [
                {"id": "record-disc", "type": "rect", "x": 0.2, "y": 0.58, "w": 0.18, "h": 0.18, "color": "black", "motion": {"kind": "sway", "amount": 0.02}},
                {"id": "record-label", "type": "rect", "x": 0.265, "y": 0.645, "w": 0.05, "h": 0.05, "color": "accent"},
                {"id": "tone-arm", "type": "line", "x1": 0.34, "y1": 0.58, "x2": 0.44, "y2": 0.68, "color": "highlight", "lineWidth": 0.014},
            ]
        )
    else:
        parts.append(
            {
                "id": "scene-symbol",
                "type": "poly",
                "points": [[0.5, 0.12], [0.62, 0.22], [0.56, 0.36], [0.44, 0.36], [0.38, 0.22]],
                "color": "accent",
                "motion": {"kind": "lyric-pop", "amount": 0.03},
            }
        )

    return {
        "subject": subject_slug,
        "styleNotes": f"song-specific pixel clip for {subject_slug}; blocky non-photoreal silhouette, props, costume colors, and genre cues",
        "sprites": [_fallback_pixel_sprite(sprite_id, subject_slug, family, seed, index)],
        "spritePlacements": [
            {
                "id": "main-subject",
                "sprite": sprite_id,
                "x": 0.36,
                "y": 0.2,
                "w": 0.28,
                "h": 0.5,
                "layer": "mid",
                "alpha": 1,
                "motion": {"kind": "beat-snap", "trigger": "beat", "axis": "both", "amount": round(0.025 + energy * 0.03, 3), "speed": 1, "phase": 0},
            }
        ],
        "parts": parts[:CLIP_MAX_PARTS],
        "actions": _fallback_clip_actions(),
    }


def _fallback_pixel_sprite(sprite_id: str, subject: str, theme_family: str, seed: int, index: int) -> dict:
    """Small generated sprite fallback. Codex-generated plans should replace this with song-specific pixel matrices."""
    text = f"{subject} {theme_family}".lower()
    if any(word in text for word in ["camera", "photo", "paparazzi", "movie", "scene"]):
        rows = [
            "................",
            "................",
            ".....XXXXXX.....",
            "...XXHHHHHHXX...",
            "..XHHHHHHHHHHX..",
            "..XHHCCCCCHHHX..",
            "..XHHCAAAACHHX..",
            "..XHHCAAAACHHX..",
            "..XHHCCCCCHHHX..",
            "..XHHHHHHHHHHX..",
            "...XXHHHHHHXX...",
            ".....XXXXXX.....",
            "................",
            "................",
        ]
        colors = {"X": "shadow", "H": "highlight", "C": "secondary", "A": "white"}
    elif any(word in text for word in ["heart", "love", "romance", "girl", "beauty"]):
        rows = [
            "................",
            "....RR....RR....",
            "...RRRR..RRRR...",
            "..RRRRRRRRRRRR..",
            "..RRRRRRRRRRRR..",
            "...RRRRRRRRRR...",
            "....RRRRRRRR....",
            ".....RRRRRR.....",
            "......RRRR......",
            ".......RR.......",
            "................",
            "................",
        ]
        colors = {"R": "accent"}
    elif any(word in text for word in ["moon", "night", "wolf", "horror", "ghost", "monster"]):
        rows = [
            "................",
            ".......WWWWW....",
            ".....WWWWWWWW...",
            "....WWWWWWWW....",
            "...WWWWWWW......",
            "...WWWWWW.......",
            "...WWWWWW.......",
            "....WWWWWW......",
            ".....WWWWWWWW...",
            ".......WWWWW....",
            "................",
            "................",
        ]
        colors = {"W": "white"}
    else:
        rows = [
            "................",
            "......BBBB......",
            ".....BBBBBB.....",
            "......SSSS......",
            "......SSSS......",
            ".....PPPPPP.....",
            "....PPPPPPPP....",
            "...PP..PP..PP...",
            "..PP...PP...PP..",
            "......PPPP......",
            ".....PP..PP.....",
            "....PP....PP....",
            "...WW......WW...",
            "................",
        ]
        colors = {"B": "shadow", "S": "skin", "P": "primary", "W": "white"}
    return {
        "id": _slugify_motif(sprite_id, "sprite"),
        "name": subject[:40],
        "colors": colors,
        "rows": rows,
    }


def _compact_text(value: object, fallback: str = "", limit: int = 160) -> str:
    text = re.sub(r"\s+", " ", str(value or "").strip())
    return (text[:limit].strip() or fallback)[:limit]


def _humanize_slug(value: object, fallback: str = "song subject") -> str:
    text = str(value or "").replace("-", " ").replace("_", " ").strip()
    text = re.sub(r"\s+", " ", text)
    return text[:80] or fallback


def _string_list(value: object, fallback: list[str], limit: int = 6, item_limit: int = 48) -> list[str]:
    raw_items = value if isinstance(value, list) else []
    items = [_compact_text(item, "", item_limit) for item in raw_items]
    items = [item for item in items if item]
    return items[:limit] or fallback[:limit]


def _sanitize_palette(value: object, fallback: list[str]) -> list[str]:
    raw_items = value if isinstance(value, list) else []
    colors = [color.strip().lower() for color in raw_items if isinstance(color, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", color.strip())]
    return _ensure_vibrant_palette(colors[:6] or fallback)


def _hex_luma(color: str) -> float:
    match = re.fullmatch(r"#([0-9a-fA-F]{6})", str(color or "").strip())
    if not match:
        return 0.5
    raw = match.group(1)
    red = int(raw[0:2], 16) / 255
    green = int(raw[2:4], 16) / 255
    blue = int(raw[4:6], 16) / 255
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def _ensure_vibrant_palette(colors: list[str]) -> list[str]:
    merged: list[str] = []
    for color in [*(colors or []), *DEFAULT_PALETTE]:
        text = str(color or "").strip().lower()
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", text) or text in merged:
            continue
        if _hex_luma(text) < 0.18:
            continue
        merged.append(text)
        if len(merged) >= 6:
            break
    return merged[:6] or DEFAULT_PALETTE[:]


COMPOSITIONS = {"poster", "stage-card", "room-card", "street-card", "object-card", "portrait-card", "world-card"}


def _fallback_composition(theme_family: str, index: int) -> str:
    family = _normalized_theme_family(theme_family)
    options = {
        "lonely-night": ["room-card", "street-card", "portrait-card"],
        "cosmic-world": ["world-card", "poster", "object-card"],
        "rain-memory": ["room-card", "street-card", "object-card"],
        "dance-pop": ["stage-card", "poster", "portrait-card"],
        "romance-pop": ["portrait-card", "room-card", "object-card"],
        "urban-stage": ["street-card", "stage-card", "poster"],
    }
    values = options.get(family, ["poster", "stage-card", "object-card"])
    return values[index % len(values)]


def _sanitize_composition(value: object, fallback: str) -> str:
    text = str(value or fallback or "poster").strip().lower()
    return text if text in COMPOSITIONS else fallback if fallback in COMPOSITIONS else "poster"


def _default_palette_roles(palette: list[str]) -> dict:
    safe = _ensure_vibrant_palette(palette)
    return {
        "background": "#111a3f",
        "key": safe[0],
        "accent": safe[1 % len(safe)],
        "flash": "#fff6b0",
        "floor": safe[2 % len(safe)],
        "lyric": "#f4f7fb",
    }


def _sanitize_palette_roles(value: object, palette: list[str]) -> dict:
    raw = value if isinstance(value, dict) else {}
    fallback = _default_palette_roles(palette)
    roles = {}
    for key, fallback_color in fallback.items():
        color = str(raw.get(key) or fallback_color).strip().lower()
        roles[key] = color if re.fullmatch(r"#[0-9a-fA-F]{6}", color) else fallback_color
    return roles


def _sanitize_brightness(value: object) -> dict:
    raw = value if isinstance(value, dict) else {}
    return {
        "base": round(_clamp_number(raw.get("base"), 0.68, 0.25, 1.0), 3),
        "backgroundLift": round(_clamp_number(raw.get("backgroundLift") or raw.get("background_lift"), 0.32, 0.0, 0.8), 3),
        "chorusBoost": round(_clamp_number(raw.get("chorusBoost") or raw.get("chorus_boost"), 0.36, 0.0, 0.9), 3),
        "flash": round(_clamp_number(raw.get("flash"), 0.72, 0.0, 1.0), 3),
    }


def _fallback_key_visual(
    *,
    primary_motif: str,
    secondary_motifs: list[str],
    theme_family: str,
    index: int,
) -> dict:
    subject = _humanize_slug(primary_motif)
    props = _fallback_props(theme_family, secondary_motifs, index)
    setting = _fallback_setting(theme_family, index)
    return {
        "subject": subject,
        "setting": setting,
        "symbols": props[:5],
        "foreground": f"large readable pixel silhouette or object for {subject}",
        "midground": ", ".join(props[:2]) or "one strong prop shape",
        "background": setting,
        "styleNotes": "poster-like static pixel key visual; one clear subject, bright reactive lighting, no readable text or waveform art",
    }


def _sanitize_key_visual(value: object, fallback: dict) -> dict:
    raw = value if isinstance(value, dict) else {}
    fallback_symbols = fallback.get("symbols") if isinstance(fallback.get("symbols"), list) else ["signature prop"]
    return {
        "subject": _compact_text(raw.get("subject"), str(fallback.get("subject") or "song subject"), 90),
        "setting": _compact_text(raw.get("setting"), str(fallback.get("setting") or "song-specific frame"), 120),
        "symbols": _string_list(raw.get("symbols") or raw.get("props"), [str(item) for item in fallback_symbols], 6, 48),
        "foreground": _compact_text(raw.get("foreground"), str(fallback.get("foreground") or "large foreground subject"), 140),
        "midground": _compact_text(raw.get("midground"), str(fallback.get("midground") or "supporting props"), 140),
        "background": _compact_text(raw.get("background"), str(fallback.get("background") or "bright stylized setting"), 140),
        "styleNotes": _compact_text(raw.get("styleNotes") or raw.get("style_notes"), str(fallback.get("styleNotes") or "pixel key visual"), 220),
    }


def _fallback_lighting(theme_family: str, energy: float, palette: list[str]) -> dict:
    roles = _default_palette_roles(palette)
    family = _normalized_theme_family(theme_family)
    base = {
        "lonely-night": "blue-magenta rim light with warm windows",
        "cosmic-world": "star-bright cyan/yellow glow",
        "rain-memory": "wet blue reflections with yellow window flashes",
        "dance-pop": "club spotlight and floor glow",
        "romance-pop": "warm key light with pink accent flashes",
        "urban-stage": "neon street light and stage wash",
    }.get(family, "bright pixel poster lighting")
    return {
        "base": base,
        "beat": "small glow pulse on the key visual",
        "bar": "camera push and solid floor tile lift",
        "peak": "short white/accent flash around the subject",
        "quiet": "hold the key visual with dimmer background",
        "chorus": "increase background lift, floor glow, and color saturation",
        "colors": {"key": roles["key"], "accent": roles["accent"], "flash": roles["flash"], "floor": roles["floor"]},
        "intensity": round(0.55 + energy * 0.4, 3),
    }


def _sanitize_lighting(value: object, fallback: dict, palette: list[str]) -> dict:
    raw = value if isinstance(value, dict) else {}
    colors_raw = raw.get("colors") if isinstance(raw.get("colors"), dict) else {}
    fallback_colors = fallback.get("colors") if isinstance(fallback.get("colors"), dict) else _default_palette_roles(palette)
    colors = {}
    for key in ("key", "accent", "flash", "floor"):
        color = str(colors_raw.get(key) or fallback_colors.get(key) or _default_palette_roles(palette).get(key) or "#ffffff").strip().lower()
        colors[key] = color if re.fullmatch(r"#[0-9a-fA-F]{6}", color) else str(fallback_colors.get(key) or "#ffffff")
    return {
        "base": _compact_text(raw.get("base"), str(fallback.get("base") or "bright pixel key light"), 120),
        "beat": _compact_text(raw.get("beat"), str(fallback.get("beat") or "small pulse"), 120),
        "bar": _compact_text(raw.get("bar"), str(fallback.get("bar") or "camera push"), 120),
        "peak": _compact_text(raw.get("peak"), str(fallback.get("peak") or "brief flash"), 120),
        "quiet": _compact_text(raw.get("quiet"), str(fallback.get("quiet") or "held dim frame"), 120),
        "chorus": _compact_text(raw.get("chorus"), str(fallback.get("chorus") or "brighter color lift"), 120),
        "colors": colors,
        "intensity": round(_clamp_number(raw.get("intensity"), fallback.get("intensity", 0.72), 0.2, 1.4), 3),
    }


def _fallback_setting(theme_family: str, index: int) -> str:
    family = _normalized_theme_family(theme_family)
    settings = {
        "lonely-night": ["neon street after midnight", "bedroom window with distant lights", "empty club corridor"],
        "cosmic-world": ["small planet stage", "star-map control room", "moonlit horizon"],
        "rain-memory": ["rainy window room", "puddle-lit sidewalk", "storm-blue train platform"],
        "dance-pop": ["tight stage floor", "backlit rehearsal room", "club entrance under flash lights"],
        "romance-pop": ["small room with warm lamps", "late-night phone booth", "open balcony with city glow"],
        "urban-stage": ["city rooftop stage", "subway-tile performance corner", "alley wall under sign light"],
    }
    options = settings.get(family, settings["urban-stage"])
    return options[index % len(options)]


def _fallback_props(theme_family: str, secondary_motifs: list[str], index: int) -> list[str]:
    family = _normalized_theme_family(theme_family)
    props = {
        "lonely-night": ["moon block", "long shadow", "door frame"],
        "cosmic-world": ["small planet", "signal flare", "orbit map"],
        "rain-memory": ["window frame", "umbrella", "rain streaks"],
        "dance-pop": ["microphone stand", "floor light", "jacket highlight"],
        "romance-pop": ["phone", "flower shape", "warm lamp"],
        "urban-stage": ["street light", "speaker stack", "painted wall"],
    }
    merged = [*_string_list(secondary_motifs, [], 3), *props.get(family, props["urban-stage"])]
    seen: set[str] = set()
    unique = []
    for item in merged:
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    if index % 3 == 1:
        unique = unique[1:] + unique[:1]
    return unique[:5]


def _fallback_scene_intent(
    *,
    title: str,
    primary_motif: str,
    secondary_motifs: list[str],
    theme_family: str,
    index: int,
    energy: float,
    palette: list[str],
) -> dict:
    subject = _humanize_slug(primary_motif)
    props = _fallback_props(theme_family, secondary_motifs, index)
    action_options = [
        f"{subject} enters the frame with one readable pose",
        f"{subject} turns toward the main prop as the beat rises",
        f"{subject} holds still while the setting changes around it",
        f"{subject} breaks into a sharper silhouette on the chorus hit",
    ]
    camera_options = ["hold", "push-in", "pull-back", "pan-left", "pan-right", "shake-cut"]
    trigger_effect = "larger pose change" if energy > 0.62 else "small light and posture change"
    return {
        "subject": subject,
        "setting": _fallback_setting(theme_family, index),
        "action": action_options[index % len(action_options)],
        "props": props,
        "palette": palette[:4],
        "lighting": "contrast pixel lighting keyed to the song palette",
        "camera": camera_options[index % len(camera_options)],
        "rhythmTriggers": [
            {"trigger": "beat", "target": subject, "effect": trigger_effect},
            {"trigger": "peak", "target": props[0] if props else subject, "effect": "flash or jump cut"},
        ],
        "lyricCue": _compact_text(title, "song title and chorus imagery", 80),
        "renderNotes": "Use large readable shapes, concrete props, and one staged action; no text overlays or generic waveform art.",
    }


def _sanitize_rhythm_triggers(value: object, fallback: list[dict]) -> list[dict]:
    raw_items = value if isinstance(value, list) else []
    clean = []
    for raw in raw_items[:5]:
        if isinstance(raw, dict):
            trigger = str(raw.get("trigger") or "beat").strip().lower()
            if trigger not in ACTION_TRIGGERS:
                trigger = "beat"
            clean.append(
                {
                    "trigger": trigger,
                    "target": _compact_text(raw.get("target"), "main subject", 64),
                    "effect": _compact_text(raw.get("effect") or raw.get("beatResponse") or raw.get("beat_response"), "visible change on the music cue", 120),
                }
            )
        else:
            clean.append({"trigger": "beat", "target": "main subject", "effect": _compact_text(raw, "visible change on the music cue", 120)})
    return clean or fallback


def _sanitize_scene_intent(intent: object, fallback: dict, scene_palette: list[str]) -> dict:
    raw = intent if isinstance(intent, dict) else {}
    fallback_props = fallback.get("props") if isinstance(fallback.get("props"), list) else ["main prop"]
    fallback_triggers = fallback.get("rhythmTriggers") if isinstance(fallback.get("rhythmTriggers"), list) else []
    return {
        "subject": _compact_text(raw.get("subject"), str(fallback.get("subject") or "main subject"), 80),
        "setting": _compact_text(raw.get("setting") or raw.get("scene"), str(fallback.get("setting") or "song-specific stage"), 100),
        "action": _compact_text(raw.get("action"), str(fallback.get("action") or "one clear staged action"), 140),
        "props": _string_list(raw.get("props"), [str(item) for item in fallback_props], 6, 48),
        "palette": _sanitize_palette(raw.get("palette"), scene_palette or fallback.get("palette") or []),
        "lighting": _compact_text(raw.get("lighting") or raw.get("colorNotes") or raw.get("color_notes"), str(fallback.get("lighting") or "song-colored pixel lighting"), 120),
        "camera": _compact_text(raw.get("camera"), str(fallback.get("camera") or "hold"), 48),
        "rhythmTriggers": _sanitize_rhythm_triggers(raw.get("rhythmTriggers") or raw.get("rhythm_triggers"), fallback_triggers),
        "lyricCue": _compact_text(raw.get("lyricCue") or raw.get("lyric_cue"), str(fallback.get("lyricCue") or "semantic lyric cue, not displayed text"), 100),
        "renderNotes": _compact_text(raw.get("renderNotes") or raw.get("render_notes"), str(fallback.get("renderNotes") or "Concrete visual instructions for renderer."), 220),
    }


def _fallback_visual_script(title: str, theme_family: str, motifs: list[str], palette: list[str]) -> dict:
    return {
        "logline": f"Pixel MV for {_compact_text(title, 'this song', 80)} built from its title, lyric images, and music energy.",
        "artDirection": f"{_normalized_theme_family(theme_family)} pixel stage with concrete subjects and props, not abstract audio graphics.",
        "subjectStrategy": _string_list(motifs, ["singer silhouette", "signature prop", "song location"], 6),
        "colorStrategy": "Use the returned palette as scene lighting; each section may shift one accent color on peaks.",
        "motionStrategy": "Use beats for pose changes, peaks for flashes or cuts, quiet sections for held frames.",
        "avoid": ["fixed song templates", "readable text", "generic waveform art", "rectangle-only clip plans"],
        "palette": palette,
    }


def _sanitize_visual_script(script: object, fallback: dict) -> dict:
    raw = script if isinstance(script, dict) else {}
    return {
        "logline": _compact_text(raw.get("logline"), str(fallback.get("logline") or "song-specific visual script"), 180),
        "artDirection": _compact_text(raw.get("artDirection") or raw.get("art_direction"), str(fallback.get("artDirection") or ""), 220),
        "subjectStrategy": _string_list(raw.get("subjectStrategy") or raw.get("subject_strategy"), [str(item) for item in fallback.get("subjectStrategy", [])], 6),
        "colorStrategy": _compact_text(raw.get("colorStrategy") or raw.get("color_strategy"), str(fallback.get("colorStrategy") or ""), 180),
        "motionStrategy": _compact_text(raw.get("motionStrategy") or raw.get("motion_strategy"), str(fallback.get("motionStrategy") or ""), 180),
        "avoid": _string_list(raw.get("avoid"), [str(item) for item in fallback.get("avoid", [])], 6),
        "palette": _sanitize_palette(raw.get("palette"), fallback.get("palette") if isinstance(fallback.get("palette"), list) else []),
    }


def _fallback_visual_plan(title: str, lyrics: str, duration: float, waveform: dict | None = None, song_context: dict | None = None) -> dict:
    context_text = ""
    if isinstance(song_context, dict):
        context_text = "\n".join(
            str(song_context.get(key) or "")
            for key in ("page", "description", "extract", "query", "note")
            if song_context.get(key)
        )
    seed = _stable_seed(f"{title}\n{lyrics}\n{context_text}\n{json.dumps(waveform or {}, ensure_ascii=False)}")
    motifs = _extract_visual_tokens(title, f"{context_text}\n{lyrics}")
    theme_family = _theme_family(title, f"{context_text}\n{lyrics}", motifs)
    palette = _ensure_vibrant_palette(_seed_palette(seed))
    palette_roles = _default_palette_roles(palette)
    brightness = _sanitize_brightness({})
    visual_script = _fallback_visual_script(title, theme_family, motifs, palette)
    count = max(2, min(32, int(round((duration / 60.0) * 4)) or 3))
    scenes = []
    for index in range(count):
        start = round((duration * index) / count, 3)
        end = round(duration if index == count - 1 else (duration * (index + 1)) / count, 3)
        energy = _waveform_energy_hint(waveform, index, count)
        scene_motifs = [motifs[(index + offset) % len(motifs)] for offset in range(min(4, len(motifs)))]
        previous_motif = scenes[-1]["primaryMotif"] if scenes else ""
        primary_motif = _distinct_primary_motif(theme_family, index, previous_motif, scene_motifs)
        secondary_motifs = [item for item in scene_motifs if item != primary_motif][:2]
        clip = _fallback_clip(primary_motif, theme_family, seed, index, energy)
        composition = _fallback_composition(theme_family, index)
        key_visual = _fallback_key_visual(
            primary_motif=primary_motif,
            secondary_motifs=secondary_motifs,
            theme_family=theme_family,
            index=index,
        )
        lighting = _fallback_lighting(theme_family, energy, palette)
        scenes.append(
            {
                "start": start,
                "end": end,
                "kind": "key-visual",
                "composition": composition,
                "themeFamily": theme_family,
                "primaryMotif": primary_motif,
                "secondaryMotifs": secondary_motifs,
                "motifs": [primary_motif, *scene_motifs][:5],
                "keyVisual": key_visual,
                "lighting": lighting,
                "intent": _fallback_scene_intent(
                    title=title,
                    primary_motif=primary_motif,
                    secondary_motifs=secondary_motifs,
                    theme_family=theme_family,
                    index=index,
                    energy=energy,
                    palette=palette,
                ),
                "motion": "waveform bins drive clip part pose, scale, opacity, light, and camera push",
                "clip": clip,
                "actions": clip["actions"],
                "density": round(0.38 + energy * 0.82, 3),
                "accent": "waveform_peak",
                "visual": _visual_block(seed, index, energy),
            }
        )

    return {
        "version": 3,
        "source": "fallback",
        "vjMode": "key-visual-reactive",
        "themeLabel": f"视觉 DNA {seed & 0xFFFF:04x}",
        "mood": "song-reactive",
        "summary": "无固定歌曲模板；先按歌词、歌名和歌曲上下文选主视觉，再用波形驱动灯光、闪白、镜头和切段。",
        "palette": palette,
        "paletteRoles": palette_roles,
        "brightness": brightness,
        "motifs": motifs[:8],
        "visualScript": visual_script,
        "visualDNA": {
            "seed": seed,
            "engine": "key-visual-reactive-vj",
            "themeFamily": theme_family,
            "rules": ["key-visual", "reactive-lighting", "waveform-bins", "lyric-cues", "per-song-seed", "scene-intent"],
        },
        "scenes": scenes,
    }


def _sanitize_visual_block(block: object, fallback: dict) -> dict:
    raw = block if isinstance(block, dict) else {}
    layout = str(raw.get("layout") or fallback["layout"])
    if layout not in PROCEDURAL_LAYOUTS:
        layout = fallback["layout"]
    return {
        "seed": int(_clamp_number(raw.get("seed"), fallback["seed"], 0, 4294967295)),
        "layout": layout,
        "turbulence": _clamp_number(raw.get("turbulence"), fallback["turbulence"], 0, 2),
        "symmetry": _clamp_number(raw.get("symmetry"), fallback["symmetry"], 0, 1),
        "scale": _clamp_number(raw.get("scale"), fallback["scale"], 0.25, 2.5),
        "colorShift": _clamp_number(raw.get("colorShift"), fallback["colorShift"], 0, 1),
        "beatLock": str(raw.get("beatLock") or fallback["beatLock"])[:48],
    }


def _fallback_scene_actions(primary_motif: str) -> list[dict]:
    return [
        {"trigger": "beat", "verb": "pose-snap", "target": "subject-body", "camera": "push-in", "beatResponse": "clip body part shifts and scales with waveform energy"},
        {"trigger": "peak", "verb": "glow", "target": "subject-head", "camera": "push-in", "beatResponse": "clip highlight parts flash on peak bins"},
    ]


def _sanitize_scene_actions(actions: object, primary_motif: str) -> list[dict]:
    if not isinstance(actions, list):
        return _fallback_scene_actions(primary_motif)
    clean: list[dict] = []
    for raw in actions[:4]:
        if not isinstance(raw, dict):
            continue
        trigger = str(raw.get("trigger") or "beat").strip().lower()
        verb = str(raw.get("verb") or "pulse").strip().lower()
        camera = str(raw.get("camera") or "hold").strip().lower()
        if trigger not in ACTION_TRIGGERS:
            trigger = "beat"
        if verb not in ACTION_VERBS:
            verb = "pulse"
        if camera not in CAMERA_MOVES:
            camera = "hold"
        clean.append(
            {
                "trigger": trigger,
                "verb": verb,
                "target": str(raw.get("target") or primary_motif)[:40],
                "camera": camera,
                "beatResponse": str(raw.get("beatResponse") or raw.get("beat_response") or "subject reacts to waveform energy")[:120],
            }
        )
    return clean or _fallback_scene_actions(primary_motif)


def _sanitize_clip_color(value: object, fallback: str = "primary") -> str:
    color = str(value or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", color):
        return color.lower()
    normalized = color.lower()
    if normalized in CLIP_COLOR_TOKENS:
        return normalized
    return fallback


def _sanitize_clip_motion(motion: object) -> dict | None:
    if not isinstance(motion, dict):
        return None
    kind = str(motion.get("kind") or motion.get("type") or "beat-pulse").strip().lower()[:32]
    trigger = str(motion.get("trigger") or "beat").strip().lower()
    axis = str(motion.get("axis") or "both").strip().lower()
    if trigger not in ACTION_TRIGGERS:
        trigger = "beat"
    if axis not in {"x", "y", "both", "scale", "alpha", "rotate"}:
        axis = "both"
    clean = {
        "kind": re.sub(r"[^a-z0-9_-]+", "-", kind).strip("-") or "beat-pulse",
        "trigger": trigger,
        "axis": axis,
        "amount": round(_clamp_number(motion.get("amount"), 0.04, 0, 0.5), 3),
        "speed": round(_clamp_number(motion.get("speed"), 1, 0, 12), 3),
        "phase": round(_clamp_number(motion.get("phase"), 0, 0, 1), 3),
    }
    return clean


def _sanitize_clip_point(point: object) -> list[float] | None:
    if isinstance(point, dict):
        x_value = point.get("x")
        y_value = point.get("y")
    elif isinstance(point, (list, tuple)) and len(point) >= 2:
        x_value, y_value = point[0], point[1]
    else:
        return None
    return [
        round(_clamp_number(x_value, 0, 0, 1), 4),
        round(_clamp_number(y_value, 0, 0, 1), 4),
    ]


def _sanitize_clip_part(part: object, index: int) -> dict | None:
    if not isinstance(part, dict):
        return None
    part_type = str(part.get("type") or part.get("kind") or "").strip().lower()
    if part_type not in CLIP_PART_TYPES:
        return None
    clean: dict = {
        "id": _slugify_motif(part.get("id") or f"part-{index}", f"part-{index}")[:40],
        "type": part_type,
        "color": _sanitize_clip_color(part.get("color"), "primary"),
        "alpha": round(_clamp_number(part.get("alpha"), 1, 0, 1), 3),
    }
    motion = _sanitize_clip_motion(part.get("motion"))
    if motion:
        clean["motion"] = motion

    if part_type == "rect":
        x_value = _clamp_number(part.get("x"), 0.4, 0, 0.995)
        y_value = _clamp_number(part.get("y"), 0.4, 0, 0.995)
        clean.update(
            {
                "x": round(x_value, 4),
                "y": round(y_value, 4),
                "w": round(min(_clamp_number(part.get("w"), 0.1, 0.005, 1), 1 - x_value), 4),
                "h": round(min(_clamp_number(part.get("h"), 0.1, 0.005, 1), 1 - y_value), 4),
            }
        )
        if clean["w"] <= 0 or clean["h"] <= 0:
            return None
    elif part_type == "line":
        clean.update(
            {
                "x1": round(_clamp_number(part.get("x1"), 0.25, 0, 1), 4),
                "y1": round(_clamp_number(part.get("y1"), 0.25, 0, 1), 4),
                "x2": round(_clamp_number(part.get("x2"), 0.75, 0, 1), 4),
                "y2": round(_clamp_number(part.get("y2"), 0.75, 0, 1), 4),
                "lineWidth": round(_clamp_number(part.get("lineWidth") or part.get("width"), 0.012, 0.002, 0.08), 4),
            }
        )
    elif part_type == "poly":
        raw_points = part.get("points")
        if not isinstance(raw_points, list):
            return None
        points = []
        for point in raw_points[:CLIP_MAX_POINTS]:
            clean_point = _sanitize_clip_point(point)
            if clean_point:
                points.append(clean_point)
        if len(points) < 3:
            return None
        clean["points"] = points
    elif part_type == "text":
        clean.update(
            {
                "text": str(part.get("text") or "")[:32],
                "x": round(_clamp_number(part.get("x"), 0.5, 0, 1), 4),
                "y": round(_clamp_number(part.get("y"), 0.5, 0, 1), 4),
                "size": round(_clamp_number(part.get("size"), 0.045, 0.01, 0.16), 4),
                "align": str(part.get("align") or "center")[:12] if str(part.get("align") or "center") in {"left", "center", "right"} else "center",
            }
        )
        if not clean["text"]:
            return None
    return clean


def _sanitize_sprite_rows(rows: object) -> list[str]:
    if not isinstance(rows, list):
        return []
    clean: list[str] = []
    for raw_row in rows[:SPRITE_MAX_ROWS]:
        row = str(raw_row or "")[:SPRITE_MAX_COLS]
        if not row:
            continue
        clean.append(row)
    if len(clean) < 3:
        return []
    non_empty = sum(1 for row in clean for char in row if char not in SPRITE_TRANSPARENT_CHARS)
    return clean if non_empty >= 8 else []


def _sanitize_pixel_sprite(sprite: object, fallback: dict | None, index: int) -> dict | None:
    raw = sprite if isinstance(sprite, dict) else {}
    fallback_raw = fallback if isinstance(fallback, dict) else {}
    sprite_id = _slugify_motif(raw.get("id") or raw.get("name") or fallback_raw.get("id") or f"sprite-{index}", f"sprite-{index}")[:40]
    rows = _sanitize_sprite_rows(raw.get("rows") or raw.get("pixels") or fallback_raw.get("rows"))
    if not rows:
        return None

    raw_colors = raw.get("colors") or raw.get("palette") or fallback_raw.get("colors") or {}
    colors: dict[str, str] = {}
    if isinstance(raw_colors, dict):
        for key, value in raw_colors.items():
            char = str(key or "")[:1]
            if not char or char in SPRITE_TRANSPARENT_CHARS:
                continue
            colors[char] = _sanitize_clip_color(value, f"palette{len(colors) % 5}")
    used_chars = []
    for row in rows:
        for char in row:
            if char in SPRITE_TRANSPARENT_CHARS or char in used_chars:
                continue
            used_chars.append(char)
    for offset, char in enumerate(used_chars):
        colors.setdefault(char, f"palette{offset % 5}")
    if not colors:
        return None
    return {
        "id": sprite_id,
        "name": str(raw.get("name") or fallback_raw.get("name") or sprite_id)[:48],
        "colors": colors,
        "rows": rows,
    }


def _sanitize_sprite_placement(placement: object, index: int, sprite_ids: set[str]) -> dict | None:
    if not isinstance(placement, dict) or not sprite_ids:
        return None
    raw_sprite = placement.get("sprite") or placement.get("spriteId") or placement.get("sprite_id")
    sprite_id = _slugify_motif(raw_sprite or sorted(sprite_ids)[0], sorted(sprite_ids)[0])[:40]
    if sprite_id not in sprite_ids:
        sprite_id = sorted(sprite_ids)[index % len(sprite_ids)]
    x_value = _clamp_number(placement.get("x"), 0.35, -0.2, 1.05)
    y_value = _clamp_number(placement.get("y"), 0.2, -0.2, 1.05)
    width_value = _clamp_number(placement.get("w") or placement.get("width"), 0.3, 0.04, 1.25)
    height_value = _clamp_number(placement.get("h") or placement.get("height"), 0.42, 0.04, 1.25)
    layer = str(placement.get("layer") or "mid").strip().lower()
    if layer not in {"back", "mid", "front"}:
        layer = "mid"
    clean = {
        "id": _slugify_motif(placement.get("id") or f"{sprite_id}-placement-{index}", f"placement-{index}")[:40],
        "sprite": sprite_id,
        "x": round(x_value, 4),
        "y": round(y_value, 4),
        "w": round(width_value, 4),
        "h": round(height_value, 4),
        "layer": layer,
        "alpha": round(_clamp_number(placement.get("alpha"), 1, 0, 1), 3),
    }
    motion = _sanitize_clip_motion(placement.get("motion"))
    if motion:
        clean["motion"] = motion
    return clean


def _sanitize_clip_actions(actions: object, fallback_actions: list[dict], part_ids: set[str]) -> list[dict]:
    if not isinstance(actions, list):
        return fallback_actions
    clean = []
    for raw in actions[:6]:
        if not isinstance(raw, dict):
            continue
        trigger = str(raw.get("trigger") or "beat").strip().lower()
        verb = str(raw.get("verb") or "pulse").strip().lower()
        camera = str(raw.get("camera") or "hold").strip().lower()
        target = _slugify_motif(raw.get("target") or "subject-body", "subject-body")[:40]
        if trigger not in ACTION_TRIGGERS:
            trigger = "beat"
        if verb not in ACTION_VERBS:
            verb = "pulse"
        if camera not in CAMERA_MOVES:
            camera = "hold"
        if part_ids and target not in part_ids:
            target = next((item for item in ("subject-body", "body", "subject-head") if item in part_ids), sorted(part_ids)[0])
        clean.append(
            {
                "trigger": trigger,
                "verb": verb,
                "target": target,
                "camera": camera,
                "beatResponse": str(raw.get("beatResponse") or raw.get("beat_response") or "clip parts react to waveform energy")[:120],
            }
        )
    return clean or fallback_actions


def _sanitize_clip(clip: object, fallback: dict) -> dict:
    raw = clip if isinstance(clip, dict) else {}
    subject = _slugify_motif(raw.get("subject") or fallback.get("subject") or "pixel-subject")
    fallback_sprites = fallback.get("sprites") if isinstance(fallback.get("sprites"), list) else []
    raw_sprites = raw.get("sprites") or raw.get("pixelSprites") or raw.get("pixel_sprites")
    if not isinstance(raw_sprites, list):
        raw_sprites = fallback_sprites
    sprites = []
    used_sprite_ids: set[str] = set()
    for index, raw_sprite in enumerate(raw_sprites[:SPRITE_MAX_COUNT]):
        fallback_sprite = fallback_sprites[index % len(fallback_sprites)] if fallback_sprites else None
        clean_sprite = _sanitize_pixel_sprite(raw_sprite, fallback_sprite, index)
        if not clean_sprite:
            continue
        base_id = clean_sprite["id"]
        if base_id in used_sprite_ids:
            clean_sprite["id"] = f"{base_id}-{index}"[:40]
        used_sprite_ids.add(clean_sprite["id"])
        sprites.append(clean_sprite)
    if not sprites and fallback_sprites:
        for index, fallback_sprite in enumerate(fallback_sprites[:SPRITE_MAX_COUNT]):
            clean_sprite = _sanitize_pixel_sprite(fallback_sprite, None, index)
            if clean_sprite:
                used_sprite_ids.add(clean_sprite["id"])
                sprites.append(clean_sprite)

    raw_placements = raw.get("spritePlacements") or raw.get("placements") or raw.get("sprite_placements")
    fallback_placements = fallback.get("spritePlacements") if isinstance(fallback.get("spritePlacements"), list) else []
    if not isinstance(raw_placements, list):
        raw_placements = fallback_placements
    placements = []
    used_placement_ids: set[str] = set()
    for index, raw_placement in enumerate(raw_placements[:SPRITE_MAX_COUNT * 2]):
        clean_placement = _sanitize_sprite_placement(raw_placement, index, used_sprite_ids)
        if not clean_placement:
            continue
        base_id = clean_placement["id"]
        if base_id in used_placement_ids:
            clean_placement["id"] = f"{base_id}-{index}"[:40]
        used_placement_ids.add(clean_placement["id"])
        placements.append(clean_placement)
    if sprites and not placements:
        placements.append(
            {
                "id": "main-subject",
                "sprite": sprites[0]["id"],
                "x": 0.36,
                "y": 0.2,
                "w": 0.28,
                "h": 0.5,
                "layer": "mid",
                "alpha": 1,
                "motion": {"kind": "beat-snap", "trigger": "beat", "axis": "both", "amount": 0.04, "speed": 1, "phase": 0},
            }
        )

    raw_parts = raw.get("parts")
    if not isinstance(raw_parts, list):
        raw_parts = []
    parts = []
    used_ids: set[str] = set()
    for index, raw_part in enumerate(raw_parts[:CLIP_MAX_PARTS]):
        clean_part = _sanitize_clip_part(raw_part, index)
        if not clean_part:
            continue
        base_id = clean_part["id"]
        if base_id in used_ids:
            clean_part["id"] = f"{base_id}-{index}"[:40]
        used_ids.add(clean_part["id"])
        parts.append(clean_part)
    if not parts:
        parts = list(fallback.get("parts") or [])
        used_ids = {str(part.get("id")) for part in parts if isinstance(part, dict)}
    used_ids.update(used_placement_ids)
    fallback_actions = fallback.get("actions") if isinstance(fallback.get("actions"), list) else _fallback_clip_actions()
    actions = _sanitize_clip_actions(raw.get("actions"), fallback_actions, used_ids)
    return {
        "subject": subject,
        "styleNotes": str(raw.get("styleNotes") or raw.get("style_notes") or fallback.get("styleNotes") or "")[:180],
        "sprites": sprites[:SPRITE_MAX_COUNT],
        "spritePlacements": placements[: SPRITE_MAX_COUNT * 2],
        "parts": parts[:CLIP_MAX_PARTS],
        "actions": actions,
    }


def _sanitize_visual_plan(plan: dict, title: str, lyrics: str, duration: float, waveform: dict | None = None, song_context: dict | None = None) -> dict:
    if not isinstance(plan, dict):
        return _fallback_visual_plan(title, lyrics, duration, waveform, song_context)

    fallback = _fallback_visual_plan(title, lyrics, duration, waveform, song_context)
    palette = _sanitize_palette(plan.get("palette"), fallback["palette"])
    palette_roles = _sanitize_palette_roles(plan.get("paletteRoles") or plan.get("palette_roles"), palette)
    brightness = _sanitize_brightness(plan.get("brightness"))
    visual_script = _sanitize_visual_script(plan.get("visualScript") or plan.get("visual_script"), fallback.get("visualScript", {}))

    raw_scenes = plan.get("scenes")
    if not isinstance(raw_scenes, list):
        raw_scenes = []

    scenes = []
    raw_visual_dna = plan.get("visualDNA") if isinstance(plan.get("visualDNA"), dict) else {}
    fallback_theme_family = str(fallback["visualDNA"].get("themeFamily") or "urban-stage")[:48]
    theme_family = str(plan.get("themeFamily") or raw_visual_dna.get("themeFamily") or fallback_theme_family)[:48]
    if _is_abstract_theme_family(theme_family):
        theme_family = fallback_theme_family
    for raw in raw_scenes[:48]:
        if not isinstance(raw, dict):
            continue
        start = _clamp_number(raw.get("start"), 0, 0, duration)
        end = _clamp_number(raw.get("end"), start + 12, start + 1, duration)
        motifs = raw.get("motifs")
        if not isinstance(motifs, list):
            motifs = fallback["motifs"]
        fallback_visual = fallback["scenes"][len(scenes) % len(fallback["scenes"])]["visual"]
        fallback_scene = fallback["scenes"][len(scenes) % len(fallback["scenes"])]
        scene_theme = str(raw.get("themeFamily") or theme_family or fallback_scene.get("themeFamily") or "urban-stage")[:48]
        if _is_abstract_theme_family(scene_theme):
            scene_theme = str(fallback_scene.get("themeFamily") or theme_family or "urban-stage")[:48]
        primary_motif = _slugify_motif(raw.get("primaryMotif") or raw.get("primary_motif") or fallback_scene.get("primaryMotif") or _primary_motif(scene_theme, len(scenes), [str(item) for item in motifs]))
        if _is_abstract_primary_motif(primary_motif):
            safe_motifs = [str(item) for item in motifs if not _is_abstract_primary_motif(item)]
            primary_motif = _slugify_motif(
                fallback_scene.get("primaryMotif") or _distinct_primary_motif(
                    scene_theme,
                    len(scenes),
                    str(scenes[-1].get("primaryMotif") if scenes else ""),
                    safe_motifs,
                )
            )
        secondary_motifs = raw.get("secondaryMotifs")
        if not isinstance(secondary_motifs, list):
            secondary_motifs = fallback_scene.get("secondaryMotifs", [])
        fallback_intent = fallback_scene.get("intent") if isinstance(fallback_scene.get("intent"), dict) else _fallback_scene_intent(
            title=title,
            primary_motif=primary_motif,
            secondary_motifs=[str(item) for item in secondary_motifs],
            theme_family=scene_theme,
            index=len(scenes),
            energy=_clamp_number(raw.get("density"), 0.5, 0, 1),
            palette=palette,
        )
        scene_palette = _sanitize_palette(raw.get("palette"), palette)
        composition = _sanitize_composition(raw.get("composition"), str(fallback_scene.get("composition") or _fallback_composition(scene_theme, len(scenes))))
        fallback_key_visual = fallback_scene.get("keyVisual") if isinstance(fallback_scene.get("keyVisual"), dict) else _fallback_key_visual(
            primary_motif=primary_motif,
            secondary_motifs=[str(item) for item in secondary_motifs],
            theme_family=scene_theme,
            index=len(scenes),
        )
        key_visual = _sanitize_key_visual(raw.get("keyVisual") or raw.get("key_visual"), fallback_key_visual)
        fallback_lighting = fallback_scene.get("lighting") if isinstance(fallback_scene.get("lighting"), dict) else _fallback_lighting(
            scene_theme,
            _clamp_number(raw.get("density"), 0.5, 0, 1),
            scene_palette,
        )
        lighting = _sanitize_lighting(raw.get("lighting"), fallback_lighting, scene_palette)
        scene_intent = _sanitize_scene_intent(raw.get("intent") or raw.get("sceneIntent") or raw.get("scene_intent"), fallback_intent, scene_palette)
        fallback_clip = fallback_scene.get("clip") if isinstance(fallback_scene.get("clip"), dict) else _fallback_clip(primary_motif, scene_theme, int(fallback_visual.get("seed") or 1), len(scenes), 0.5)
        clip = _sanitize_clip(raw.get("clip"), fallback_clip)
        part_ids = {str(part.get("id")) for part in clip.get("parts", []) if isinstance(part, dict)}
        part_ids.update(str(item.get("id")) for item in clip.get("spritePlacements", []) if isinstance(item, dict))
        scene_actions = _sanitize_clip_actions(
            raw.get("actions") or raw.get("actionScript") or raw.get("action_script") or clip.get("actions"),
            clip.get("actions") if isinstance(clip.get("actions"), list) else _fallback_clip_actions(),
            part_ids,
        )
        clip["actions"] = scene_actions
        scenes.append(
            {
                "start": round(start, 3),
                "end": round(max(end, start + 1), 3),
                "kind": "key-visual",
                "composition": composition,
                "themeFamily": scene_theme,
                "primaryMotif": primary_motif,
                "secondaryMotifs": [str(item)[:24] for item in secondary_motifs[:3]],
                "motifs": [primary_motif, *[str(item)[:24] for item in motifs[:4]]][:5],
                "keyVisual": key_visual,
                "lighting": lighting,
                "intent": scene_intent,
                "motion": str(raw.get("motion", "clip_parts_follow_waveform"))[:120],
                "clip": clip,
                "actions": scene_actions,
                "density": _clamp_number(raw.get("density"), 0.7, 0.2, 1.4),
                "accent": str(raw.get("accent", ""))[:80],
                "visual": _sanitize_visual_block(raw.get("visual"), fallback_visual),
            }
        )

    if not scenes:
        scenes = fallback["scenes"]
    scenes.sort(key=lambda item: item["start"])
    scenes[0]["start"] = 0
    for index in range(len(scenes) - 1):
        scenes[index]["end"] = min(scenes[index]["end"], scenes[index + 1]["start"])
        if scenes[index]["end"] <= scenes[index]["start"]:
            scenes[index]["end"] = min(duration, scenes[index]["start"] + 1)
    scenes[-1]["end"] = duration
    for index in range(1, len(scenes)):
        if scenes[index]["primaryMotif"] == scenes[index - 1]["primaryMotif"]:
            replacement = _distinct_primary_motif(
                str(scenes[index].get("themeFamily") or theme_family),
                index,
                str(scenes[index - 1].get("primaryMotif") or ""),
                [str(item) for item in scenes[index].get("motifs", [])],
            )
            scenes[index]["primaryMotif"] = replacement
            scenes[index]["motifs"] = [replacement, *[item for item in scenes[index]["motifs"] if item != replacement]][:5]
            if isinstance(scenes[index].get("intent"), dict):
                scenes[index]["intent"]["subject"] = _humanize_slug(replacement)
            if isinstance(scenes[index].get("keyVisual"), dict):
                scenes[index]["keyVisual"]["subject"] = _humanize_slug(replacement)
            if isinstance(scenes[index].get("clip"), dict):
                scenes[index]["clip"]["subject"] = replacement

    return {
        "version": 3,
        "source": str(plan.get("source", "codex"))[:24],
        "vjMode": str(plan.get("vjMode") or plan.get("vj_mode") or "key-visual-reactive")[:48],
        "themeLabel": str(plan.get("themeLabel", fallback["themeLabel"]))[:80],
        "mood": str(plan.get("mood", fallback["mood"]))[:60],
        "summary": str(plan.get("summary", fallback["summary"]))[:180],
        "palette": palette,
        "paletteRoles": palette_roles,
        "brightness": brightness,
        "motifs": [str(item)[:24] for item in (plan.get("motifs") or fallback["motifs"])[:8]] or fallback["motifs"],
        "visualScript": visual_script,
        "visualDNA": {**(raw_visual_dna or fallback["visualDNA"]), "themeFamily": theme_family},
        "scenes": scenes,
    }


def _wiki_summary_page(page_title: str) -> dict | None:
    page = str(page_title or "").strip()
    if not page:
        return None
    cache_key = page.lower()
    if cache_key in WIKI_CONTEXT_CACHE:
        return WIKI_CONTEXT_CACHE[cache_key]
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(page.replace(' ', '_'), safe='')}"
    request_obj = Request(
        url,
        headers={
            "User-Agent": "PixelOK/0.1 (local karaoke visual planner)",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request_obj, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8", errors="replace"))
    except (HTTPError, URLError, TimeoutError, ValueError, OSError):
        return None
    if not isinstance(payload, dict) or payload.get("type") == "disambiguation":
        return None
    extract = str(payload.get("extract") or "").strip()
    title = str(payload.get("title") or page).strip()
    if not extract:
        return None
    result = {
        "source": "wikipedia",
        "page": title[:120],
        "description": str(payload.get("description") or "")[:180],
        "extract": extract[:1400],
        "url": str(payload.get("content_urls", {}).get("desktop", {}).get("page") or "")[:260],
    }
    WIKI_CONTEXT_CACHE[cache_key] = result
    return result


def _wiki_visual_context(artist: str, track_title: str, combined_title: str) -> dict:
    artist = str(artist or "").strip()
    track_title = str(track_title or "").strip()
    combined_title = str(combined_title or "").strip()
    if not track_title and " - " in combined_title:
        left, right = combined_title.split(" - ", 1)
        artist = artist or left.strip()
        track_title = right.strip()
    track_title = track_title or combined_title
    candidates: list[str] = []
    if track_title:
        candidates.extend([f"{track_title} (song)", track_title])
    if artist and track_title:
        candidates.extend([f"{track_title} ({artist} song)", f"{artist} {track_title}"])
    if combined_title and combined_title not in candidates:
        candidates.append(combined_title)

    seen: set[str] = set()
    for candidate in candidates[:8]:
        key = candidate.lower()
        if key in seen:
            continue
        seen.add(key)
        summary = _wiki_summary_page(candidate)
        if summary:
            summary["query"] = candidate[:160]
            return summary
    return {
        "source": "none",
        "query": " / ".join(candidates[:3])[:260],
        "note": "No Wikipedia summary was resolved before codex exec. Codex should search Wikipedia or the web from artist/title if needed.",
    }


def _run_codex_visual_plan(
    title: str,
    lyrics: str,
    duration: float,
    waveform: dict | None = None,
    artist: str = "",
    track_title: str = "",
    song_context: dict | None = None,
) -> dict:
    target_count = max(2, min(32, int(round((duration / 60.0) * 4)) or 3))
    waveform_text = _format_waveform_prompt(waveform or {})
    metadata = {
        "artist": artist,
        "trackTitle": track_title or title,
        "combinedTitle": title,
        "wikipediaContext": song_context or {},
    }
    metadata_text = json.dumps(metadata, ensure_ascii=False, indent=2)
    prompt = f"""
You are Pixel OK's runtime visual-planning agent, invoked by `codex exec`.
Return only one JSON object. No markdown, no explanation, no prose outside JSON.

Your job runs later when the user clicks the app's one-key animation flow. Do not assume a fixed song. For each request, research and reason from the supplied artist/title, lyrics, waveform summary, and song context, then generate this song's own Pixel OK VJ v3 direction package.

Responsibility boundary:
- You are the visual director, not the audio-reactive renderer.
- The local browser VJ engine will drive movement from `analysis.beatTimes`, `analysis.barTimes`, sections, peaks, energy, onsets, and lyric cues.
- Your output must say what should be on screen: one stable key visual per scene, its setting, symbols, composition, palette, lighting behavior, and rough timing.
- The browser will draw the key visual mathematically and make it react. You should not require complex character acting or many tiny pose changes.
- Do not ask the frontend to show waveform/equalizer/particles as the concept. Waveform data is control data only.
- Every visual change should be explainable by at least one of: beat, bar, section, peak/onset, lyric entrance, or song-specific art direction.

Research setup:
- First use the supplied `wikipediaContext` below. It may come from Wikipedia's page summary API.
- If that context is missing, irrelevant, too generic, or obviously a disambiguation miss, use your web/Wikipedia lookup ability from inside codex exec to search the artist + song title.
- Use factual context such as release era, genre, music video setting, notable performers, costumes, choreography, props, story world, and cultural associations.
- Do not quote copyrighted lyrics. Do not output citations. Convert research into drawable visual decisions.

Hard ban:
- Do not reuse a fixed song template. Do not mention Billie Jean, Michael Jackson, moonwalk, glove, fedora, or thriller cues unless the supplied metadata/context is actually that song or artist.
- Do not use a fixed renderer vocabulary, stock motif whitelist, reusable song templates, equalizer, waveform drawing, ribbon, ring, tunnel, grid, shard, vortex, random particles, or generic audio visualization as the idea.
- Do not make rectangle-only visuals that require the viewer to guess the subject.
- Do not draw every lyric line as a literal object.
- `primaryMotif` is metadata only. The frontend never switches on it. The actual v3 drawing should be described by `scene.keyVisual`, `scene.composition`, and `scene.lighting`.
- Do not invent factual music-video details unless `wikipediaContext`, lyrics semantics, artist/title, or user-provided notes support them. If facts are thin, use genre/era/stage/costume inference and keep it visibly generic-but-intentional.

Scene contract:
- `kind` must always be "key-visual".
- `composition` must be one of: poster, stage-card, room-card, street-card, object-card, portrait-card, world-card.
- Every scene must include: start, end, kind, composition, themeFamily, primaryMotif, secondaryMotifs, motifs, keyVisual, lighting, intent, motion, density, accent, visual.
- Generate about {target_count} scenes, covering 0 to {duration:.2f} seconds. Aim for 3-5 scene changes per minute.
- Scene changes should align with waveform peaks, energy changes, or important lyric entrances.
- Prefer scene boundaries near supplied bars/sections when possible.
- Each scene must have one clear key visual. Adjacent scenes may reuse a subject only if composition, setting, symbol focus, or lighting clearly changes.

V3 key visual contract:
- `scene.keyVisual.subject`: one concrete drawable subject, object, place, performer silhouette, symbol, or scene frame.
- `scene.keyVisual.setting`: specific place or frame.
- `scene.keyVisual.symbols`: 2-6 concrete props, costume cues, location cues, era cues, or story cues.
- `scene.keyVisual.foreground`: what should be largest/readable in front.
- `scene.keyVisual.midground`: support object/shape/layer.
- `scene.keyVisual.background`: bright setting or environmental shape.
- `scene.keyVisual.styleNotes`: why this image belongs to this song/artist/context, and how to keep it readable as pixel art.

Lighting contract:
- `scene.lighting.base`: base color and contrast direction.
- `scene.lighting.beat`: small pulse behavior on each beat.
- `scene.lighting.bar`: stronger four-beat behavior: camera push, floor lift, or color shift.
- `scene.lighting.peak`: short flash/silhouette hit on peaks/onsets.
- `scene.lighting.quiet`: how to hold the frame during low energy.
- `scene.lighting.chorus`: how to make chorus/strong sections brighter.
- `scene.lighting.colors`: object with key/accent/flash/floor hex colors.
- `scene.lighting.intensity`: 0.2 to 1.4.

Scene intent contract:
- `scene.intent.subject`: one concrete drawable subject, not an abstract word such as vibe, energy, waveform, emotion, or music.
- `scene.intent.setting`: specific place or staged environment.
- `scene.intent.action`: visible action the renderer can stage.
- `scene.intent.props`: 2-6 concrete props, costume cues, or location cues.
- `scene.intent.palette`: 2-5 hex colors for this scene.
- `scene.intent.lighting`: color and contrast instruction.
- `scene.intent.camera`: hold, push-in, pull-back, pan-left, pan-right, or shake-cut.
- `scene.intent.rhythmTriggers`: 1-4 objects with trigger, target, effect. Triggers: intro, lyric, beat, peak, quiet.
- `scene.intent.lyricCue`: a short semantic cue, not a lyric quote.
- `scene.intent.renderNotes`: concise renderer guidance: composition, scale, subject priority, and what must not be drawn.

Legacy compatibility:
- You may include `clip` and `actions`, but v3 rendering will prioritize keyVisual/lighting. Do not rely on clip sprites as the main idea.
- No text, lettering, labels, signage, title cards, captions, watermarks, or readable marks inside the artwork. The app renders song title and lyrics separately.

Creative rules:
- Make each song different. If lyrics are abstract, lean on artist styling, real MV/stage context, genre, era, and props.
- For real singers, never draw a realistic portrait. Use non-photorealistic pixel silhouettes, costume blocks, pose language, and props.
- For an iconic performer, use abstract recognizable cues: hat, glove, socks, jacket blocks, dance lean, mic stand, stage silhouette, etc., only when context supports it.
- For a narrative video, produce key visuals that rotate through locations/actions/props from that video, not one crowded collage.
- Pixel art should feel intentionally composed: big readable shapes, few strong colors, clear foreground subject, bright beat-reactive lighting.

Output JSON shape:
{{
  "version": 3,
  "source": "codex",
  "vjMode": "key-visual-reactive",
  "themeLabel": "short theme label",
  "mood": "mood",
  "summary": "one sentence visual concept",
  "palette": ["#45f5a1", "#4fd8ff", "#ff5d9d", "#ffd166"],
  "paletteRoles": {{"background":"#111a3f", "key":"#45f5a1", "accent":"#4fd8ff", "flash":"#fff6b0", "floor":"#ff5d9d", "lyric":"#f4f7fb"}},
  "brightness": {{"base":0.68, "backgroundLift":0.32, "chorusBoost":0.36, "flash":0.72}},
  "motifs": ["song-specific motif", "costume cue", "place cue"],
  "visualScript": {{
    "logline": "one sentence for the whole visual script",
    "artDirection": "pixel art style, era, culture, and staging direction",
    "subjectStrategy": ["main subject family", "prop logic", "location logic"],
    "colorStrategy": "how colors evolve across sections",
    "motionStrategy": "how beat, peaks, quiet, and lyric entrances affect scenes",
    "avoid": ["fixed templates", "readable text", "generic waveform art"],
    "palette": ["#45f5a1", "#4fd8ff", "#ff5d9d", "#ffd166"]
  }},
  "visualDNA": {{"seed": 123456, "engine": "key-visual-reactive-vj", "themeFamily": "dance-pop", "rules": ["wiki-context", "key-visual", "reactive-lighting", "waveform-bins", "lyric-cues"]}},
  "scenes": [
    {{
      "start": 0,
      "end": 14,
      "kind": "key-visual",
      "composition": "stage-card",
      "themeFamily": "dance-pop",
      "primaryMotif": "descriptive-subject-slug",
      "secondaryMotifs": ["prop", "place"],
      "motifs": ["subject", "prop", "action"],
      "keyVisual": {{
        "subject": "one concrete readable subject",
        "setting": "specific place or frame",
        "symbols": ["prop one", "costume cue", "location cue"],
        "foreground": "largest subject or object",
        "midground": "supporting shape or prop",
        "background": "bright environment or graphic field",
        "styleNotes": "why this visual belongs to the song and how to draw it as readable pixel art"
      }},
      "lighting": {{
        "base": "base color and contrast direction",
        "beat": "small pulse behavior on each beat",
        "bar": "camera push or floor pulse every bar",
        "peak": "short white/accent flash on peaks",
        "quiet": "held dimmer frame",
        "chorus": "brighter background, stronger floor glow, stronger color saturation",
        "colors": {{"key":"#45f5a1", "accent":"#4fd8ff", "flash":"#fff6b0", "floor":"#ff5d9d"}},
        "intensity": 0.86
      }},
      "intent": {{
        "subject": "concrete drawable subject",
        "setting": "specific place or staged environment",
        "action": "visible staged action",
        "props": ["prop one", "costume cue", "location cue"],
        "palette": ["#45f5a1", "#4fd8ff", "#ff5d9d"],
        "lighting": "specific lighting direction",
        "camera": "push-in",
        "rhythmTriggers": [
          {{"trigger": "beat", "target": "subject", "effect": "pose changes on beat"}},
          {{"trigger": "peak", "target": "main prop", "effect": "brief flash or jump cut"}}
        ],
        "lyricCue": "semantic cue, not quoted lyric",
        "renderNotes": "large foreground subject, clear prop silhouette, no text or generic waveform graphics"
      }},
      "motion": "waveform peaks drive lighting, flash, floor glow, and small camera pushes",
      "density": 0.8,
      "accent": "what flashes or changes on lyric/beat",
      "visual": {{"seed": 93217, "layout": "poster", "turbulence": 0.72, "symmetry": 0.35, "scale": 1.1, "colorShift": 0.18, "beatLock": "waveform-peaks"}},
      "actions": [{{"trigger":"beat", "verb":"glow", "target":"key-visual", "camera":"push-in", "beatResponse":"key visual light pulses on waveform peaks"}}]
    }}
  ]
}}

Song metadata and context:
{metadata_text}

Estimated duration: {duration:.2f}s
{waveform_text}

Lyrics for semantic cues only:
{lyrics[:5000]}
""".strip()

    with tempfile.NamedTemporaryFile("w+", suffix=".json", delete=False, encoding="utf-8") as handle:
        output_path = Path(handle.name)

    try:
        codex_cmd = shutil.which("codex.cmd") or shutil.which("codex") or "codex"
        command_prefix = ["cmd.exe", "/c", codex_cmd] if codex_cmd.lower().endswith((".cmd", ".bat")) else [codex_cmd]
        command = [
            *command_prefix,
            "--search",
            "exec",
            "-c",
            'service_tier="fast"',
            "-c",
            'model_reasoning_effort="low"',
            "--skip-git-repo-check",
            "--ephemeral",
            "--sandbox",
            "read-only",
            "--color",
            "never",
            "-C",
            str(BASE_DIR),
            "-o",
            str(output_path),
            "-",
        ]
        subprocess.run(
            command,
            input=prompt,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=str(BASE_DIR),
            capture_output=True,
            timeout=360,
            check=True,
        )
        return _extract_json_object(output_path.read_text(encoding="utf-8"))
    finally:
        try:
            output_path.unlink(missing_ok=True)
        except OSError:
            pass

@app.get("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.get("/api/capabilities")
def capabilities():
    return jsonify(
        {
            "demucs": _has_module("demucs"),
            "basic_pitch": _has_module("basic_pitch"),
            "torchcrepe": _has_module("torchcrepe"),
            "parselmouth": _has_module("parselmouth"),
            "uvr": is_uvr_available(),
            "asr": is_heart_transcriptor_available(),
            "heart_transcriptor": is_heart_transcriptor_available(),
            "cloud_asr": False,
        }
    )


@app.get("/api/projects")
def list_projects():
    projects = []
    for job_dir in JOBS_DIR.iterdir():
        if not job_dir.is_dir() or not _valid_job_id(job_dir.name):
            continue
        if not _state_path(job_dir).exists() and not _original_path(job_dir):
            continue
        projects.append(_project_summary(job_dir.name, job_dir))
    projects.sort(key=lambda item: item.get("updated_at", ""), reverse=True)
    return jsonify({"projects": projects})


@app.post("/api/projects")
def create_project():
    job_id = uuid.uuid4().hex[:12]
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    try:
        original_path = _save_upload("original", job_dir, "original")
        original_name = _stored_name(job_dir, "original", original_path.name)
        title = Path(original_name).stem or job_id
        project_state = _write_project_state(
            job_dir,
            {
                "job_id": job_id,
                "title": title,
                "currentTitle": title,
                "original_name": original_name,
            },
        )
        return jsonify(
            {
                "job_id": job_id,
                "project": _project_summary(job_id, job_dir),
                "state": project_state,
                "downloads": _project_downloads(job_id, job_dir),
            }
        )
    except Exception as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        return jsonify({"error": str(exc), "job_id": job_id}), 500


@app.get("/api/projects/<job_id>")
def load_project(job_id: str):
    if not _valid_job_id(job_id):
        return jsonify({"error": "无效的项目 ID"}), 400
    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        return jsonify({"error": "找不到这个项目"}), 404
    return jsonify(
        {
            "job_id": job_id,
            "project": _project_summary(job_id, job_dir),
            "state": _read_project_state(job_dir),
            "downloads": _project_downloads(job_id, job_dir),
        }
    )


@app.post("/api/projects/<job_id>/state")
def save_project_state(job_id: str):
    if not _valid_job_id(job_id):
        return jsonify({"error": "无效的项目 ID"}), 400
    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        return jsonify({"error": "找不到这个项目"}), 404
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "项目状态格式错误"}), 400
    if "take" in payload and payload.get("take") is None:
        take_path = job_dir / "take.webm"
        if take_path.exists():
            take_path.unlink()
    existing = _read_project_state(job_dir)
    merged = {**existing, **payload, "job_id": job_id}
    state = _write_project_state(job_dir, merged)
    return jsonify({"ok": True, "state": state, "project": _project_summary(job_id, job_dir)})


@app.post("/api/projects/<job_id>/take")
def upload_project_take(job_id: str):
    if not _valid_job_id(job_id):
        return jsonify({"error": "无效的项目 ID"}), 400
    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        return jsonify({"error": "找不到这个项目"}), 404
    try:
        take_path = _save_upload("take", job_dir, "take")
        if take_path.name != "take.webm":
            target = job_dir / "take.webm"
            if target.exists():
                target.unlink()
            take_path.rename(target)
            take_path = target
        state = _read_project_state(job_dir)
        state["take"] = {
            "filename": take_path.name,
            "url": f"/api/download/{job_id}/{take_path.name}",
            "saved_at": _now_iso(),
        }
        _write_project_state(job_dir, state)
        return jsonify({"ok": True, "url": f"/api/download/{job_id}/{take_path.name}", "project": _project_summary(job_id, job_dir)})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.delete("/api/projects/<job_id>")
def delete_project(job_id: str):
    if not _valid_job_id(job_id):
        return jsonify({"error": "无效的项目 ID"}), 400
    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        return jsonify({"ok": True})
    shutil.rmtree(job_dir)
    return jsonify({"ok": True})


@app.post("/api/separate")
def separate():
    requested_job_id = str(request.form.get("job_id", "")).strip()
    job_id = requested_job_id if _valid_job_id(requested_job_id) else uuid.uuid4().hex[:12]
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        original_path = _original_path(job_dir)
        if original_path is None:
            original_path = _save_upload("original", job_dir, "original")

        status = _read_separation_status(job_dir)
        if status.get("status") == "running":
            if _has_active_separation_thread(job_id):
                return jsonify({"job_id": job_id, **status}), 202
            if _separation_outputs_ready(job_dir):
                status = _complete_separation_from_files(job_id, job_dir, original_path)
                return jsonify({"job_id": job_id, **status}), 200

        _write_separation_status(
            job_dir,
            {
                "status": "running",
                "job_id": job_id,
                "message": "已加入后台三轨分离任务。",
                "downloads": _separation_downloads(job_id, original_path, job_dir),
            },
        )
        with SEPARATION_LOCK:
            thread = SEPARATION_THREADS.get(job_id)
            if thread is None or not thread.is_alive():
                thread = threading.Thread(target=_run_separation_worker, args=(job_id, original_path), daemon=True)
                SEPARATION_THREADS[job_id] = thread
                thread.start()
        return jsonify(_read_separation_status(job_dir)), 202
    except Exception as exc:
        return jsonify({"error": str(exc), "job_id": job_id}), 500


@app.get("/api/separate-status/<job_id>")
def separate_status(job_id: str):
    if not _valid_job_id(job_id):
        return jsonify({"error": "无效的任务 ID"}), 400
    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        return jsonify({"error": "找不到这次分离任务。"}), 404
    status = _read_separation_status(job_dir)
    original_path = _original_path(job_dir)
    if original_path is not None:
        if status.get("status") == "running" and not _has_active_separation_thread(job_id):
            if _separation_outputs_ready(job_dir):
                status = _complete_separation_from_files(job_id, job_dir, original_path)
            else:
                status = _write_separation_status(
                    job_dir,
                    {
                        "status": "error",
                        "job_id": job_id,
                        "message": "上次三轨分离进程已经中断或卡住，请重新点击生成三轨。",
                        "downloads": _separation_downloads(job_id, original_path, job_dir),
                    },
                )
        status["downloads"] = _separation_downloads(job_id, original_path, job_dir)
    return jsonify({"job_id": job_id, **status})


@app.post("/api/process")
def process():
    job_id = uuid.uuid4().hex[:12]
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        original_path = _save_upload("original", job_dir, "original")
        vocal_path = _save_upload("vocal", job_dir, "vocal")

        mode = request.form.get("mode", "standard")
        auto_align = request.form.get("auto_align", "true") == "true"
        use_demucs = request.form.get("use_demucs", "true") == "true"
        use_basic_pitch = request.form.get("use_basic_pitch", "false") == "true"
        pitch_engine = request.form.get("pitch_engine", "pyin")
        offset_seconds = float(request.form.get("offset_seconds", "0") or 0)
        vocal_gain = float(request.form.get("vocal_gain", "0.9") or 0.9)
        backing_gain = float(request.form.get("backing_gain", "0.55") or 0.55)

        result = process_job(
            original_path=original_path,
            vocal_path=vocal_path,
            job_dir=job_dir,
            mode=mode,
            auto_align=auto_align,
            use_demucs=use_demucs,
            use_basic_pitch=use_basic_pitch,
            pitch_engine=pitch_engine,
            offset_seconds=offset_seconds,
            vocal_gain=vocal_gain,
            backing_gain=backing_gain,
        )

        result["job_id"] = job_id
        result["downloads"] = {
            "accompaniment": f"/api/download/{job_id}/accompaniment.wav",
            "raw_vocal": f"/api/download/{job_id}/raw_vocal.wav",
            "corrected_vocal": f"/api/download/{job_id}/corrected_vocal.wav",
            "preview_mix": f"/api/download/{job_id}/preview_mix.wav",
            "debug_csv": f"/api/download/{job_id}/pitch_debug.csv",
            "summary": f"/api/download/{job_id}/summary.json",
        }
        return jsonify(result)
    except Exception as exc:  # The UI needs a clear single error surface.
        return jsonify({"error": str(exc), "job_id": job_id}), 500


@app.post("/api/separate-vocal-layers")
def separate_vocal_layers():
    payload = request.get_json(silent=True) or {}
    job_id = str(payload.get("job_id", "")).strip()
    if len(job_id) != 12 or any(ch not in "0123456789abcdef" for ch in job_id):
        return jsonify({"error": "无效的任务 ID"}), 400

    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        return jsonify({"error": "找不到这次分离任务，请重新分离原歌。"}), 404

    try:
        original_path = _original_path(job_dir)
        if original_path is not None:
            result = split_original_to_lead_and_backing(original_path=original_path, job_dir=job_dir)
        else:
            result = split_vocal_layers(
                acapella_path=job_dir / "acapella.wav",
                job_dir=job_dir,
            )
        result["job_id"] = job_id
        result["downloads"] = {
            "lead_vocal": f"/api/download/{job_id}/lead_vocal.wav",
            "backing_with_harmony": f"/api/download/{job_id}/backing_with_harmony.wav",
            "backing_vocals": f"/api/download/{job_id}/backing_vocals.wav",
        }
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc), "job_id": job_id}), 500


@app.post("/api/visual-plan")
def visual_plan():
    payload = request.get_json(silent=True) or {}
    title = str(payload.get("title") or "Pixel OK").strip()[:160]
    artist = str(payload.get("artist") or "").strip()[:160]
    track_title = str(payload.get("trackTitle") or payload.get("track_title") or payload.get("songTitle") or "").strip()[:160]
    display_title = track_title or title
    codex_title = " - ".join(part for part in [artist, display_title] if part) or title
    lyrics = str(payload.get("lyrics") or "").strip()
    duration = _clamp_number(payload.get("duration"), max(12, len(lyrics.splitlines()) * 4), 6, 3600)
    waveform = _sanitize_waveform_profile(payload.get("waveform"), duration)
    song_context = _wiki_visual_context(artist, display_title, title)

    if not lyrics:
        return jsonify(_fallback_visual_plan(codex_title, lyrics, duration, waveform, song_context))

    try:
        plan = _run_codex_visual_plan(codex_title, lyrics, duration, waveform, artist=artist, track_title=display_title, song_context=song_context)
        return jsonify(_sanitize_visual_plan(plan, codex_title, lyrics, duration, waveform, song_context))
    except Exception as exc:
        plan = _fallback_visual_plan(codex_title, lyrics, duration, waveform, song_context)
        plan["warning"] = f"codex exec failed: {exc}"
        plan["songContext"] = song_context
        return jsonify(plan)


@app.post("/api/lyrics/search")
def search_lyrics():
    payload = request.get_json(silent=True) or {}
    job_id = str(payload.get("job_id", "")).strip()
    title = str(payload.get("title") or "").strip()[:160]
    artist = str(payload.get("artist") or "").strip()[:160]
    requested_duration = _clamp_number(payload.get("duration"), 0, 0, 36000)

    if not title:
        return jsonify({"error": "请输入歌名。"}), 400

    job_dir = JOBS_DIR / job_id if _valid_job_id(job_id) else None
    if job_dir is not None and not job_dir.exists():
        return jsonify({"error": "找不到当前项目。请先载入或创建项目。"}), 404

    timing_audio = _lyrics_timing_audio(job_dir) if job_dir is not None else None
    media_duration = audio_duration(timing_audio) if timing_audio else requested_duration
    if media_duration <= 0:
        media_duration = requested_duration

    codex_hint: dict | None = None
    try:
        match = resolve_official_lyrics("", title=title, artist=artist, duration=media_duration)
    except Exception as exc:
        return jsonify({"error": f"歌词库搜索失败：{exc}"}), 502

    if not match and payload.get("use_codex", True):
        try:
            codex_hint = _codex_exec_lyrics_hint(title, artist)
            hinted_title = str(codex_hint.get("title") or title).strip()
            hinted_artist = str(codex_hint.get("artist") or artist).strip()
            if hinted_title:
                match = resolve_official_lyrics("", title=hinted_title, artist=hinted_artist, duration=media_duration)
        except Exception as exc:
            codex_hint = {"error": str(exc)}

    if not match:
        return jsonify({"error": "没有找到足够可信的歌词匹配。可以补全歌手名，或手动粘歌词。", "codex_hint": codex_hint}), 404

    lines = [str(line).strip() for line in match.get("lines") or [] if str(line).strip()]
    synced = match.get("synced_segments") if isinstance(match.get("synced_segments"), list) else []
    timing: dict | None = None
    if synced:
        segments, timing = retime_synced_lyrics(
            synced,
            audio_path=timing_audio,
            media_duration=media_duration,
            lyric_duration=float(match.get("duration") or 0),
        )
    else:
        segments = _spread_lyric_lines(lines, media_duration)
        timing = {"strategy": "plain-lyrics-even-spread", "media_duration": round(float(media_duration or 0), 3)}

    result = {
        "job_id": job_id,
        "text": "\n".join(lines),
        "segments": segments,
        "duration": round(float(media_duration or 0), 3),
        "lyrics_source": "lrclib",
        "engine": "LRCLIB metadata search + local timing",
        "source": timing_audio.name if timing_audio else "",
        "lyrics_match": _public_lyrics_match(match, timing),
        "codex_hint": codex_hint,
        "summary": {
            "lyrics_source": "LRCLIB",
            "lyrics_match": _public_lyrics_match(match, timing),
            "line_count": len(lines),
            "timed_line_count": len(segments),
        },
    }
    return jsonify(result)


@app.post("/api/transcribe")
def transcribe():
    payload = request.get_json(silent=True) or {}
    job_id = str(payload.get("job_id", "")).strip()
    if len(job_id) != 12 or any(ch not in "0123456789abcdef" for ch in job_id):
        return jsonify({"error": "无效的任务 ID"}), 400

    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        return jsonify({"error": "找不到这次分离任务，请重新分离原歌。"}), 404

    source = str(payload.get("source", "lead")).strip().lower()
    if source == "original":
        candidates = sorted(job_dir.glob("original.*"))
        media_path = candidates[0] if candidates else job_dir / "lead_vocal.wav"
    elif source in {"lead", "vocal", "main_vocal", "acapella"}:
        media_path = job_dir / "lead_vocal.wav"
        if not media_path.exists():
            media_path = job_dir / "acapella.wav"
    else:
        media_path = job_dir / "lead_vocal.wav"

    if not media_path.exists():
        return jsonify({"error": "还没有可识别的主唱轨。先生成三轨。"}), 400

    try:
        result = recognize_lyrics(media_path, original_name=f"{job_id}-{media_path.name}")
        originals = sorted(job_dir.glob("original.*"))
        original_title = originals[0].stem if originals else media_path.stem
        result = improve_lyrics_with_lrclib(
            result,
            title=original_title,
            duration=float(result.get("duration") or 0),
        )
        result["job_id"] = job_id
        result["source"] = media_path.name
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc), "job_id": job_id}), 500


@app.get("/api/download/<job_id>/<filename>")
def download(job_id: str, filename: str):
    job_dir = JOBS_DIR / job_id
    return send_from_directory(job_dir, filename, as_attachment=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8787"))
    app.run(host="127.0.0.1", port=port, threaded=True)
