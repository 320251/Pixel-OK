from __future__ import annotations

import hashlib
import json
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


LRCLIB_API = "https://lrclib.net/api"
USER_AGENT = "PixelOK/0.1 (local karaoke lyric matcher)"
LRCLIB_CACHE_DIR = Path(__file__).resolve().parents[1] / "cache" / "lrclib"

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "for",
    "from",
    "i",
    "i'm",
    "im",
    "in",
    "is",
    "it",
    "it's",
    "its",
    "me",
    "my",
    "not",
    "of",
    "on",
    "or",
    "she",
    "that",
    "the",
    "to",
    "was",
    "we",
    "you",
    "your",
}

LRC_TIME_RE = re.compile(r"\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]")


def improve_lyrics_with_lrclib(
    asr_result: dict[str, Any],
    *,
    title: str = "",
    duration: float = 0.0,
) -> dict[str, Any]:
    """Use ASR text as a fingerprint, then replace it with a matched lyrics record."""

    result = dict(asr_result)
    result["lyrics_source"] = "heart_transcriptor"
    asr_text = str(result.get("raw_text") or result.get("text") or "").strip()
    lookup_duration = _safe_float(duration) or _safe_float(result.get("duration"))
    if not asr_text and not title:
        return result

    try:
        match = resolve_official_lyrics(asr_text, title=title, duration=lookup_duration)
    except Exception as exc:  # Network lookup should never break local ASR.
        result["lyrics_lookup_error"] = str(exc)
        return result

    if not match:
        return result

    official_lines = list(match.get("lines") or [])
    if not official_lines:
        return result

    original_segments = result.get("segments") if isinstance(result.get("segments"), list) else []
    synced_segments = match.get("synced_segments") if isinstance(match.get("synced_segments"), list) else []
    alignment = align_asr_to_official(asr_text, official_lines, original_segments=original_segments)
    result["raw_asr_text"] = asr_text
    result["text"] = "\n".join(official_lines)
    result["segments"] = replace_segments_preserve_timing(
        original_segments,
        official_lines,
        synced_segments=synced_segments,
        alignment=alignment,
        duration=lookup_duration,
    )
    result["lyrics_source"] = "lrclib"
    result["engine"] = f"{result.get('engine') or 'Local ASR'} + LRCLIB"
    result["lyrics_match"] = {
        "provider": "LRCLIB",
        "id": match.get("id"),
        "track_name": match.get("track_name"),
        "artist_name": match.get("artist_name"),
        "album_name": match.get("album_name"),
        "duration": match.get("duration"),
        "score": match.get("score"),
        "query": match.get("query"),
        "synced": bool(synced_segments),
        "alignment": _public_alignment(alignment),
    }
    summary = dict(result.get("summary") or {})
    summary["lyrics_source"] = "LRCLIB"
    summary["lyrics_match"] = {
        "track_name": match.get("track_name"),
        "artist_name": match.get("artist_name"),
        "score": match.get("score"),
        "synced": bool(synced_segments),
        "alignment": _public_alignment(alignment),
    }
    result["summary"] = summary
    return result


def resolve_official_lyrics(
    asr_text: str,
    *,
    title: str = "",
    artist: str = "",
    duration: float = 0.0,
    max_records: int = 80,
) -> dict[str, Any] | None:
    title = _clean_title(title)
    artist = _clean_title(artist)
    queries = _build_queries(title, asr_text, artist=artist)
    if not queries:
        return None

    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    for query in queries:
        for record in _search_lrclib(query):
            key = str(record.get("id") or f"{record.get('trackName')}|{record.get('artistName')}|{record.get('duration')}")
            if key in seen:
                continue
            seen.add(key)
            record["_query"] = query
            records.append(record)
            if len(records) >= max_records:
                break
        if len(records) >= max_records:
            break

    if not records:
        return None

    scored = [_score_record(record, asr_text, title, artist, duration) for record in records]
    scored = [item for item in scored if item is not None]
    if not scored:
        return None

    best = max(scored, key=lambda item: item["score"])
    if not _is_confident_match(best, bool(asr_text.strip()), bool(title), bool(artist)):
        return None
    return best


def replace_segments_preserve_timing(
    original_segments: list[Any],
    official_lines: list[str],
    *,
    synced_segments: list[Any] | None = None,
    alignment: dict[str, Any] | None = None,
    duration: float = 0.0,
) -> list[dict[str, float | str]]:
    lines = [_clean_lyric_line(line) for line in official_lines]
    lines = [line for line in lines if line]
    if not lines:
        return []

    clean_synced = _clean_segments(synced_segments or [])
    if clean_synced:
        clean_original = _clean_segments(original_segments)
        return _shift_synced_with_alignment(clean_synced, clean_original, alignment, duration)

    clean_original = _clean_segments(original_segments)
    if clean_original:
        if len(clean_original) == len(lines):
            return [
                {
                    "text": lines[index],
                    "start": segment["start"],
                    "end": segment["end"],
                }
                for index, segment in enumerate(clean_original)
            ]
        return _interpolate_lines_over_segments(lines, clean_original, alignment=alignment, duration=duration)

    return []


def align_asr_to_official(
    asr_text: str,
    official_lines: list[str],
    *,
    original_segments: list[Any] | None = None,
) -> dict[str, Any] | None:
    """Find the official lyric window that best matches the ASR output."""

    clean_official = [_clean_lyric_line(line) for line in official_lines]
    clean_official = [line for line in clean_official if line]
    if not clean_official:
        return None

    source = "text"
    asr_lines: list[str] = []
    clean_segments = _clean_segments(original_segments or [])
    if clean_segments:
        asr_lines = [str(segment["text"]) for segment in clean_segments]
        source = "segments"
    if not asr_lines:
        asr_lines = _asr_candidate_lines(asr_text)
    if not asr_lines:
        return None

    best: dict[str, Any] | None = None
    max_window = min(4, len(asr_lines), len(clean_official))
    for asr_index in range(len(asr_lines)):
        for official_index in range(len(clean_official)):
            for window in range(1, max_window + 1):
                if asr_index + window > len(asr_lines) or official_index + window > len(clean_official):
                    continue
                asr_window = " ".join(asr_lines[asr_index : asr_index + window])
                official_window = " ".join(clean_official[official_index : official_index + window])
                score = _line_match_score(asr_window, official_window)
                if best is None or score > float(best["score"]):
                    best = {
                        "score": round(score, 4),
                        "asr_index": asr_index,
                        "official_index": official_index,
                        "window": window,
                        "source": source,
                        "asr_text": asr_window[:160],
                        "official_text": official_window[:160],
                    }

    if not best or float(best["score"]) < 0.38:
        return None
    return best


def _public_alignment(alignment: dict[str, Any] | None) -> dict[str, Any] | None:
    if not alignment:
        return None
    return {
        "score": alignment.get("score"),
        "asr_index": alignment.get("asr_index"),
        "official_index": alignment.get("official_index"),
        "window": alignment.get("window"),
        "source": alignment.get("source"),
    }


def _asr_candidate_lines(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", str(text or "")).strip()
    if not normalized:
        return []

    pieces = re.split(r"(?<=[.!?。！？;；])\s+|(?<=[,，])\s+|\n+", normalized)
    lines: list[str] = []
    for piece in pieces:
        words = piece.strip().split()
        if not words:
            continue
        if len(words) <= 10:
            lines.append(" ".join(words).strip(" ,.;!?，。；！？"))
            continue
        for index in range(0, len(words), 8):
            chunk = " ".join(words[index : index + 8]).strip(" ,.;!?，。；！？")
            if chunk:
                lines.append(chunk)
    return [line for line in lines if len(_normalize_text(line)) >= 3][:80]


def _line_match_score(left: str, right: str) -> float:
    left_norm = _normalize_text(left)
    right_norm = _normalize_text(right)
    if not left_norm or not right_norm:
        return 0.0
    sequence = SequenceMatcher(None, left_norm, right_norm).ratio()
    left_tokens = _token_set(left)
    right_tokens = _token_set(right)
    if left_tokens and right_tokens:
        token_overlap = len(left_tokens & right_tokens) / max(min(len(left_tokens), len(right_tokens)), 1)
        token_jaccard = len(left_tokens & right_tokens) / max(len(left_tokens | right_tokens), 1)
    else:
        token_overlap = 0.0
        token_jaccard = 0.0
    return max(sequence * 0.72, token_overlap * 0.82 + token_jaccard * 0.18, sequence * 0.45 + token_overlap * 0.55)


def _request_json(path: str, params: dict[str, Any]) -> Any:
    url = f"{LRCLIB_API}{path}?{urlencode(params)}"
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(request, timeout=12) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def _lrclib_search_cache_path(query: str) -> Path:
    digest = hashlib.sha256(query.strip().lower().encode("utf-8")).hexdigest()[:24]
    return LRCLIB_CACHE_DIR / f"search-{digest}.json"


def _search_lrclib(query: str) -> list[dict[str, Any]]:
    cache_path = _lrclib_search_cache_path(query)
    try:
        data = _request_json("/search", {"q": query})
        records = [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []
        if records:
            try:
                LRCLIB_CACHE_DIR.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
            except OSError:
                pass
        return records
    except Exception:
        if cache_path.exists():
            try:
                cached = json.loads(cache_path.read_text(encoding="utf-8", errors="replace"))
                if isinstance(cached, list):
                    return [item for item in cached if isinstance(item, dict)]
            except (OSError, json.JSONDecodeError):
                pass
        raise


def _score_record(
    record: dict[str, Any],
    asr_text: str,
    title: str,
    requested_artist: str,
    duration: float,
) -> dict[str, Any] | None:
    plain = str(record.get("plainLyrics") or "")
    synced = str(record.get("syncedLyrics") or "")
    synced_segments = _parse_synced_lrc(synced)
    lines = _lyrics_lines(plain) or [str(segment["text"]) for segment in synced_segments]
    if not lines:
        return None

    record_title = str(record.get("trackName") or "")
    artist = str(record.get("artistName") or "")
    album = str(record.get("albumName") or "")
    lyric_text = "\n".join(lines)

    asr_tokens = _token_set(asr_text)
    lyric_tokens = _token_set(lyric_text)
    shared = asr_tokens & lyric_tokens
    overlap = len(shared) / max(min(len(asr_tokens), len(lyric_tokens)), 1) if asr_tokens else 0.0
    title_score = _similarity(title, record_title)
    artist_score = _similarity(requested_artist, artist)
    query_score = _similarity(title, f"{record_title} {artist}") if title else 0.0
    duration_score = _duration_score(duration, _safe_float(record.get("duration")))
    source_bonus = 0.04 if synced_segments else 0.02

    score = (
        (0.44 * overlap)
        + (0.24 * title_score)
        + (0.16 * artist_score)
        + (0.08 * query_score)
        + (0.06 * duration_score)
        + source_bonus
    )
    if title and _normalize_text(title) == _normalize_text(record_title):
        score += 0.18
    if requested_artist and _normalize_text(requested_artist) == _normalize_text(artist):
        score += 0.16
    if title and _normalize_text(title) == _normalize_text(album):
        score += 0.06
    if len(shared) >= 4:
        score += 0.08
    elif len(shared) >= 2:
        score += 0.03

    return {
        "id": record.get("id"),
        "track_name": record_title,
        "artist_name": artist,
        "album_name": album,
        "duration": _safe_float(record.get("duration")),
        "score": round(float(score), 4),
        "query": str(record.get("_query") or ""),
        "lines": lines,
        "synced_segments": synced_segments,
        "_overlap": overlap,
        "_title_score": title_score,
        "_artist_score": artist_score,
        "_duration_score": duration_score,
        "_shared": len(shared),
    }


def _is_confident_match(match: dict[str, Any], has_asr: bool, has_title: bool, has_artist: bool) -> bool:
    score = float(match.get("score") or 0.0)
    overlap = float(match.get("_overlap") or 0.0)
    title_score = float(match.get("_title_score") or 0.0)
    artist_score = float(match.get("_artist_score") or 0.0)
    duration_score = float(match.get("_duration_score") or 0.0)
    shared = int(match.get("_shared") or 0)
    if has_title and has_artist and title_score >= 0.88 and artist_score >= 0.74:
        return True
    if has_asr and shared >= 4 and overlap >= 0.08 and score >= 0.16:
        return True
    if has_title and title_score >= 0.92 and (not has_artist or artist_score >= 0.58) and (duration_score >= 0.45 or score >= 0.45):
        return True
    if has_asr and shared >= 2 and title_score >= 0.65 and score >= 0.24:
        return True
    return False


def _build_queries(title: str, asr_text: str, *, artist: str = "") -> list[str]:
    queries: list[str] = []
    if title and artist:
        queries.append(f"{artist} {title}")
    if title:
        queries.append(title)

    words = re.findall(r"[A-Za-z0-9']+|[\u4e00-\u9fff]+", asr_text)
    if words:
        first_words = [word for word in words[:8] if len(word.strip("'")) > 1]
        if len(first_words) >= 4:
            queries.append(" ".join(first_words[:4]))
        non_stop = [word for word in words[:16] if _normalize_text(word) not in STOP_WORDS and len(word.strip("'")) > 1]
        if len(non_stop) >= 2:
            queries.append(" ".join(non_stop[:2]))
        if len(non_stop) >= 3:
            queries.append(" ".join(non_stop[:3]))

    unique: list[str] = []
    seen: set[str] = set()
    for query in queries:
        cleaned = _clean_title(query)
        key = _normalize_text(cleaned)
        if len(key) < 3 or key in seen:
            continue
        seen.add(key)
        unique.append(cleaned[:90])
    return unique[:5]


def _lyrics_lines(text: str) -> list[str]:
    lines = [_clean_lyric_line(line) for line in str(text or "").splitlines()]
    return [line for line in lines if line]


def _parse_synced_lrc(text: str) -> list[dict[str, float | str]]:
    parsed: list[dict[str, float | str]] = []
    for raw_line in str(text or "").splitlines():
        matches = list(LRC_TIME_RE.finditer(raw_line))
        if not matches:
            continue
        line_text = LRC_TIME_RE.sub("", raw_line).strip()
        line_text = _clean_lyric_line(line_text)
        if not line_text:
            continue
        stamp = matches[-1]
        minutes = int(stamp.group(1))
        seconds = int(stamp.group(2))
        fraction = stamp.group(3) or "0"
        if len(fraction) == 1:
            fraction_value = int(fraction) / 10
        elif len(fraction) == 2:
            fraction_value = int(fraction) / 100
        else:
            fraction_value = int(fraction[:3]) / 1000
        parsed.append({"text": line_text, "start": minutes * 60 + seconds + fraction_value, "end": 0.0})

    parsed.sort(key=lambda item: float(item["start"]))
    for index, segment in enumerate(parsed):
        next_start = float(parsed[index + 1]["start"]) if index + 1 < len(parsed) else float(segment["start"]) + 4.0
        segment["end"] = max(float(segment["start"]) + 0.5, next_start)
    return parsed


def _clean_segments(segments: list[Any]) -> list[dict[str, float | str]]:
    clean: list[dict[str, float | str]] = []
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        text = _clean_lyric_line(str(segment.get("text") or ""))
        start = _safe_float(segment.get("start"))
        end = _safe_float(segment.get("end"))
        if text and end > start:
            clean.append({"text": text, "start": round(start, 3), "end": round(end, 3)})
    clean.sort(key=lambda item: float(item["start"]))
    return clean


def _interpolate_lines_over_segments(
    lines: list[str],
    segments: list[dict[str, float | str]],
    *,
    alignment: dict[str, Any] | None = None,
    duration: float = 0.0,
) -> list[dict[str, float | str]]:
    if alignment and alignment.get("source") == "segments":
        aligned = _interpolate_lines_from_anchor(lines, segments, alignment, duration)
        if aligned:
            return aligned

    start = float(segments[0]["start"])
    end = float(segments[-1]["end"])
    total = max(0.5, end - start)
    cues: list[dict[str, float | str]] = []
    for index, line in enumerate(lines):
        cue_start = start + total * (index / len(lines))
        cue_end = start + total * ((index + 1) / len(lines))
        cues.append({"text": line, "start": round(cue_start, 3), "end": round(max(cue_end, cue_start + 0.35), 3)})
    return cues


def _shift_synced_with_alignment(
    synced: list[dict[str, float | str]],
    original_segments: list[dict[str, float | str]],
    alignment: dict[str, Any] | None,
    duration: float,
) -> list[dict[str, float | str]]:
    if not synced:
        return []
    if not original_segments or not alignment or alignment.get("source") != "segments":
        return synced

    asr_index = int(alignment.get("asr_index") or 0)
    official_index = int(alignment.get("official_index") or 0)
    if asr_index >= len(original_segments) or official_index >= len(synced):
        return synced

    offset = float(original_segments[asr_index]["start"]) - float(synced[official_index]["start"])
    # Large shifts usually mean the external LRC is for a different edit; ignore those.
    if abs(offset) > 45:
        return synced

    max_end = duration if duration > 1 else max(float(item["end"]) for item in synced) + max(0, offset)
    shifted: list[dict[str, float | str]] = []
    for item in synced:
        start = max(0.0, float(item["start"]) + offset)
        end = max(start + 0.35, float(item["end"]) + offset)
        if duration > 1:
            start = min(start, max_end)
            end = min(max(end, start + 0.35), max_end)
        shifted.append({"text": item["text"], "start": round(start, 3), "end": round(end, 3)})
    return shifted


def _interpolate_lines_from_anchor(
    lines: list[str],
    segments: list[dict[str, float | str]],
    alignment: dict[str, Any],
    duration: float,
) -> list[dict[str, float | str]]:
    asr_index = int(alignment.get("asr_index") or 0)
    official_index = int(alignment.get("official_index") or 0)
    if asr_index >= len(segments) or official_index >= len(lines):
        return []

    starts = [float(segment["start"]) for segment in segments]
    diffs = [b - a for a, b in zip(starts, starts[1:]) if b > a]
    line_step = _median(diffs) if diffs else 3.4
    line_step = max(0.8, min(8.0, line_step))
    anchor_start = float(segments[asr_index]["start"])
    max_duration = duration if duration > 1 else max(float(segments[-1]["end"]), anchor_start + (len(lines) - official_index) * line_step)

    starts_out = [anchor_start + (index - official_index) * line_step for index in range(len(lines))]
    if starts_out[0] < 0:
        # Compress the official lines before the anchor into the real pre-anchor room.
        pre_count = official_index
        if pre_count > 0:
            for index in range(pre_count):
                starts_out[index] = (anchor_start * index) / max(1, pre_count)
        starts_out[official_index] = anchor_start

    cues: list[dict[str, float | str]] = []
    for index, line in enumerate(lines):
        start = max(0.0, min(max_duration, starts_out[index]))
        next_start = starts_out[index + 1] if index + 1 < len(starts_out) else start + line_step
        end = max(start + 0.35, min(max_duration, next_start))
        cues.append({"text": line, "start": round(start, 3), "end": round(end, 3)})
    return cues


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    midpoint = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[midpoint]
    return (ordered[midpoint - 1] + ordered[midpoint]) / 2


def _clean_lyric_line(line: str) -> str:
    cleaned = re.sub(r"\[[^\]]+\]", "", str(line or ""))
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    cleaned = re.sub(r"^L(?=(?:Uh|Oh|Ah|Whoa|Ooh)\b)", "", cleaned)
    return cleaned


def _token_set(text: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9']+|[\u4e00-\u9fff]", str(text or "").lower())
    return {token for token in tokens if (token.isdigit() or len(token.strip("'")) > 1) and token not in STOP_WORDS}


def _clean_title(title: str) -> str:
    cleaned = str(title or "")
    cleaned = re.sub(r"\.[A-Za-z0-9]{2,5}$", "", cleaned)
    cleaned = re.sub(r"[_-]+", " ", cleaned)
    cleaned = re.sub(
        r"\b(official|video|audio|lyrics?|karaoke|instrumental|伴奏|原版|原曲|歌词)\b",
        " ",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -_.")
    return cleaned


def _normalize_text(text: str) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", " ", str(text or "").lower()).strip()


def _similarity(left: str, right: str) -> float:
    left_norm = _normalize_text(left)
    right_norm = _normalize_text(right)
    if not left_norm or not right_norm:
        return 0.0
    return SequenceMatcher(None, left_norm, right_norm).ratio()


def _duration_score(expected: float, actual: float) -> float:
    expected = _safe_float(expected)
    actual = _safe_float(actual)
    if expected <= 10 or actual <= 10:
        return 0.0
    delta = abs(expected - actual)
    return max(0.0, 1.0 - min(delta / max(expected, actual), 1.0))


def _safe_float(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return number if number == number else 0.0
