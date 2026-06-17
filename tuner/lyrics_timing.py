from __future__ import annotations

from pathlib import Path
from typing import Any

import librosa
import numpy as np

_ACTIVITY_STEP_SECONDS = 0.2
_MAX_ACTIVITY_SEARCH_SECONDS = 120.0


def audio_duration(path: Path) -> float:
    try:
        return float(librosa.get_duration(path=str(path)))
    except Exception:
        return 0.0


def retime_synced_lyrics(
    cues: list[dict[str, Any]],
    *,
    audio_path: Path | None = None,
    media_duration: float = 0.0,
    lyric_duration: float = 0.0,
) -> tuple[list[dict[str, float | str]], dict[str, Any]]:
    clean = _clean_cues(cues)
    if not clean:
        return [], {"strategy": "none", "reason": "no synced lyric cues"}

    duration = float(media_duration or 0.0)
    if duration <= 0 and audio_path:
        duration = audio_duration(audio_path)

    shifted, meta = _shift_for_cropped_version(clean, duration, lyric_duration)
    meta["global_activity_shift_seconds"] = 0.0
    meta["global_activity_score"] = None
    meta["global_activity_applied"] = False

    if audio_path and audio_path.exists():
        try:
            activity_shift, activity_meta = _estimate_global_activity_shift(
                shifted,
                audio_path,
                duration,
                lyric_duration,
                float(meta.get("base_shift_seconds") or 0.0),
            )
            activity_steps = activity_meta.pop("steps", [])
            meta.update(activity_meta)
            for step_info in activity_steps:
                if isinstance(step_info, dict):
                    _append_step(meta, step_info)
            if abs(activity_shift) >= 0.001:
                shifted = _shift_cues(shifted, activity_shift)
                meta["strategy"] = _combine_strategy(str(meta.get("strategy") or "external-lrc"), "global-activity")
        except Exception as exc:
            meta.update(
                {
                    "global_activity_shift_seconds": 0.0,
                    "global_activity_score": None,
                    "global_activity_applied": False,
                    "global_activity_reason": f"error: {exc}",
                }
            )
            _append_step(meta, {"name": "global_activity", "applied": False, "reason": "error"})

        onsets = _estimate_onsets(audio_path)
        if onsets:
            shifted = _snap_to_onsets(shifted, onsets, duration)
            meta["onset_snap"] = True
            meta["onset_count"] = len(onsets)
            _append_step(meta, {"name": "onset_snap", "applied": True, "onset_count": len(onsets)})
        else:
            meta["onset_snap"] = False
            meta["onset_count"] = 0
            _append_step(meta, {"name": "onset_snap", "applied": False, "onset_count": 0})
    else:
        _append_step(meta, {"name": "global_activity", "applied": False, "reason": "no audio"})

    if duration > 0:
        shifted = _clip_to_duration(shifted, duration)
        meta["media_duration"] = round(duration, 3)
    return shifted, meta


def _clean_cues(cues: list[dict[str, Any]]) -> list[dict[str, float | str]]:
    clean: list[dict[str, float | str]] = []
    for cue in cues:
        if not isinstance(cue, dict):
            continue
        text = str(cue.get("text") or "").strip()
        start = _safe_float(cue.get("start"))
        end = _safe_float(cue.get("end"))
        if not text or end <= start:
            continue
        clean.append({"text": text, "start": round(start, 3), "end": round(end, 3)})
    clean.sort(key=lambda item: float(item["start"]))
    return clean


def _shift_for_cropped_version(
    cues: list[dict[str, float | str]],
    media_duration: float,
    lyric_duration: float,
) -> tuple[list[dict[str, float | str]], dict[str, Any]]:
    first = float(cues[0]["start"])
    last_end = float(cues[-1]["end"])
    duration = float(media_duration or 0.0)
    official_duration = float(lyric_duration or 0.0)
    shift = 0.0
    strategy = "external-lrc"

    if duration > 10 and official_duration > duration + 6:
        # A common case: the user imports a clip made by chopping intro from a
        # longer official/video version. Preserve line spacing and move the LRC.
        shift = -(official_duration - duration)
        strategy = "cropped-intro-duration"
    elif duration > 10 and last_end > duration + 5:
        shift = -(last_end - duration)
        strategy = "fit-last-lyric"

    # Avoid shifting every lyric out of the song for a clearly wrong metadata
    # duration. Leaving it unshifted is easier for the user to diagnose.
    if first + shift < -90 or last_end + shift < 10:
        shift = 0.0
        strategy = "external-lrc"

    shifted = [
        {
            "text": cue["text"],
            "start": round(float(cue["start"]) + shift, 3),
            "end": round(float(cue["end"]) + shift, 3),
        }
        for cue in cues
    ]
    return shifted, {
        "strategy": strategy,
        "base_shift_seconds": round(shift, 3),
        "lyric_duration": round(official_duration, 3) if official_duration else None,
        "original_first_start": round(first, 3),
        "original_last_end": round(last_end, 3),
        "steps": [
            {
                "name": "duration_shift",
                "strategy": strategy,
                "shift_seconds": round(shift, 3),
            }
        ],
    }


def _estimate_global_activity_shift(
    cues: list[dict[str, float | str]],
    audio_path: Path,
    media_duration: float,
    lyric_duration: float,
    base_shift_seconds: float,
) -> tuple[float, dict[str, Any]]:
    meta: dict[str, Any] = {
        "global_activity_shift_seconds": 0.0,
        "global_activity_score": None,
        "global_activity_applied": False,
    }
    if len(cues) < 4:
        meta["global_activity_reason"] = "too few cues"
        _append_step(meta, {"name": "global_activity", "applied": False, "reason": meta["global_activity_reason"]})
        return 0.0, meta

    audio_activity = _audio_activity_envelope(audio_path, _ACTIVITY_STEP_SECONDS)
    if audio_activity is None:
        meta["global_activity_reason"] = "no usable audio activity"
        _append_step(meta, {"name": "global_activity", "applied": False, "reason": meta["global_activity_reason"]})
        return 0.0, meta

    audio_env, step, audio_duration_seconds = audio_activity
    duration = float(media_duration or 0.0)
    if duration <= 0:
        duration = audio_duration_seconds
    if duration > 0:
        target_frames = max(1, int(round(duration / step)))
        if target_frames < audio_env.size:
            audio_env = audio_env[:target_frames]
        elif target_frames > audio_env.size and target_frames - audio_env.size <= 3:
            audio_env = np.pad(audio_env, (0, target_frames - audio_env.size), mode="edge")

    if audio_env.size < 20 or float(np.std(audio_env)) < 0.01:
        meta["global_activity_reason"] = "audio activity too flat"
        _append_step(meta, {"name": "global_activity", "applied": False, "reason": meta["global_activity_reason"]})
        return 0.0, meta

    cue_activity_seconds = _cue_activity_seconds(cues)
    if cue_activity_seconds < max(4.0, min(12.0, audio_env.size * step * 0.025)):
        meta["global_activity_reason"] = "lyric activity too sparse"
        _append_step(meta, {"name": "global_activity", "applied": False, "reason": meta["global_activity_reason"]})
        return 0.0, meta

    search_seconds = _activity_search_window(duration, lyric_duration, base_shift_seconds)
    pad_frames = max(1, int(round(search_seconds / step)))
    lyric_env = _lyric_activity_envelope(cues, audio_env.size, pad_frames, step)
    if lyric_env.size < audio_env.size + pad_frames * 2 or float(np.max(lyric_env)) <= 0:
        meta["global_activity_reason"] = "no usable lyric activity"
        _append_step(meta, {"name": "global_activity", "applied": False, "reason": meta["global_activity_reason"]})
        return 0.0, meta

    audio_z = _zscore(audio_env)
    scores: list[float] = []
    shifts: list[float] = []
    active_ratios: list[float] = []
    for frame_shift in range(-pad_frames, pad_frames + 1):
        start = pad_frames - frame_shift
        segment = lyric_env[start : start + audio_env.size]
        if segment.size != audio_env.size or float(np.std(segment)) < 0.01:
            score = float("-inf")
            active_ratio = 0.0
        else:
            score = float(np.dot(audio_z, _zscore(segment)) / audio_env.size)
            active_ratio = float(np.mean(segment > 0.05))
        scores.append(score)
        shifts.append(frame_shift * step)
        active_ratios.append(active_ratio)

    score_values = np.asarray(scores, dtype=np.float64)
    finite_mask = np.isfinite(score_values)
    if not np.any(finite_mask):
        meta["global_activity_reason"] = "no valid correlation scores"
        _append_step(meta, {"name": "global_activity", "applied": False, "reason": meta["global_activity_reason"]})
        return 0.0, meta

    finite_scores = score_values[finite_mask]
    best_index = int(np.nanargmax(score_values))
    best_shift = float(shifts[best_index])
    best_score = float(score_values[best_index])
    zero_index = min(range(len(shifts)), key=lambda index: abs(shifts[index]))
    zero_score = float(score_values[zero_index]) if np.isfinite(score_values[zero_index]) else float(np.median(finite_scores))
    median_score = float(np.median(finite_scores))
    mad = float(np.median(np.abs(finite_scores - median_score)))
    peak_z = (best_score - median_score) / max(1.4826 * mad, 0.001)
    second_mask = finite_mask & (np.abs(np.asarray(shifts, dtype=np.float64) - best_shift) > 4.0)
    second_score = float(np.max(score_values[second_mask])) if np.any(second_mask) else median_score
    prominence = best_score - second_score
    improvement = best_score - zero_score
    active_ratio = active_ratios[best_index]

    meta.update(
        {
            "global_activity_candidate_shift_seconds": round(best_shift, 3),
            "global_activity_score": round(best_score, 4),
            "global_activity_zero_shift_score": round(zero_score, 4),
            "global_activity_peak_z": round(peak_z, 3),
            "global_activity_prominence": round(prominence, 4),
            "global_activity_search_window_seconds": round(pad_frames * step, 3),
        }
    )

    if abs(best_shift) < step * 1.5:
        meta["global_activity_reason"] = "already aligned"
        _append_step(
            meta,
            {
                "name": "global_activity",
                "applied": False,
                "reason": meta["global_activity_reason"],
                "candidate_shift_seconds": round(best_shift, 3),
                "score": round(best_score, 4),
            },
        )
        return 0.0, meta

    reason = _activity_confidence_reason(
        best_score=best_score,
        peak_z=peak_z,
        prominence=prominence,
        improvement=improvement,
        active_ratio=active_ratio,
        overlap_seconds=_cue_overlap_seconds(cues, best_shift, duration),
        duration=duration,
    )
    if reason:
        meta["global_activity_reason"] = reason
        _append_step(
            meta,
            {
                "name": "global_activity",
                "applied": False,
                "reason": reason,
                "candidate_shift_seconds": round(best_shift, 3),
                "score": round(best_score, 4),
            },
        )
        return 0.0, meta

    applied_shift = round(best_shift, 3)
    meta.update(
        {
            "global_activity_shift_seconds": applied_shift,
            "global_activity_applied": True,
            "global_activity_reason": "confidence ok",
        }
    )
    _append_step(
        meta,
        {
            "name": "global_activity",
            "applied": True,
            "shift_seconds": applied_shift,
            "score": round(best_score, 4),
        },
    )
    return applied_shift, meta


def _audio_activity_envelope(audio_path: Path, step: float) -> tuple[np.ndarray, float, float] | None:
    try:
        y, sr = librosa.load(str(audio_path), sr=11025, mono=True)
    except Exception:
        return None
    if y.size < sr * 2:
        return None

    hop = max(1, int(round(sr * step)))
    frame_length = max(hop * 2, int(round(sr * 0.45)))
    try:
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop, center=True)[0]
    except Exception:
        return None
    rms = np.asarray(rms, dtype=np.float64)
    rms = rms[np.isfinite(rms)]
    if rms.size < 20:
        return None

    low = float(np.percentile(rms, 25))
    high = float(np.percentile(rms, 90))
    if high <= low:
        return None
    activity = np.clip((rms - low) / (high - low), 0.0, 1.0)
    activity = np.sqrt(activity)
    activity = _moving_average(activity, max(1, int(round(0.8 / step))))
    return activity.astype(np.float64), step, float(y.size / sr)


def _lyric_activity_envelope(
    cues: list[dict[str, float | str]],
    audio_frames: int,
    pad_frames: int,
    step: float,
) -> np.ndarray:
    total_frames = audio_frames + pad_frames * 2 + 1
    env = np.zeros(total_frames, dtype=np.float64)
    pad_seconds = pad_frames * step
    for cue in cues:
        start = float(cue["start"])
        end = float(cue["end"])
        if end <= start:
            continue
        active_end = start + _cue_activity_length(start, end)
        start_index = int(np.floor((start + pad_seconds) / step))
        end_index = int(np.ceil((active_end + pad_seconds) / step))
        start_index = max(0, min(total_frames, start_index))
        end_index = max(start_index + 1, min(total_frames, end_index))
        env[start_index:end_index] = 1.0

    if np.max(env) <= 0:
        return env
    return _moving_average(env, max(1, int(round(0.6 / step))))


def _activity_search_window(media_duration: float, lyric_duration: float, base_shift_seconds: float) -> float:
    duration = float(media_duration or 0.0)
    official_duration = float(lyric_duration or 0.0)
    if 0 < duration < 90:
        window = max(8.0, duration * 0.35)
    else:
        window = 30.0
    if duration > 5 and official_duration > 5:
        window = max(window, abs(official_duration - duration) + 8.0)
    if abs(base_shift_seconds) > 0:
        window = max(window, abs(base_shift_seconds) + 8.0)
    return min(_MAX_ACTIVITY_SEARCH_SECONDS, max(4.0, window))


def _activity_confidence_reason(
    *,
    best_score: float,
    peak_z: float,
    prominence: float,
    improvement: float,
    active_ratio: float,
    overlap_seconds: float,
    duration: float,
) -> str:
    if best_score < 0.08:
        return "correlation too weak"
    if peak_z < 2.6:
        return "correlation peak not distinct"
    if prominence < 0.012:
        return "ambiguous repeated activity"
    if improvement < 0.018:
        return "not enough improvement over current timing"
    if active_ratio < 0.025 or active_ratio > 0.9:
        return "lyric activity coverage unusable"
    required_overlap = max(4.0, min(12.0, float(duration or 0.0) * 0.025))
    if overlap_seconds < required_overlap:
        return "shift would leave too little lyric activity in audio"
    return ""


def _cue_activity_seconds(cues: list[dict[str, float | str]]) -> float:
    total = 0.0
    for cue in cues:
        start = float(cue["start"])
        end = float(cue["end"])
        if end > start:
            total += _cue_activity_length(start, end)
    return total


def _cue_overlap_seconds(cues: list[dict[str, float | str]], shift: float, duration: float) -> float:
    if duration <= 0:
        return _cue_activity_seconds(cues)
    total = 0.0
    for cue in cues:
        start = float(cue["start"]) + shift
        end = start + _cue_activity_length(float(cue["start"]), float(cue["end"]))
        total += max(0.0, min(end, duration) - max(start, 0.0))
    return total


def _cue_activity_length(start: float, end: float) -> float:
    span = max(0.0, end - start)
    if span <= 5.0:
        return span
    return min(8.0, max(1.0, span * 0.75))


def _moving_average(values: np.ndarray, width: int) -> np.ndarray:
    if width <= 1 or values.size == 0:
        return values
    kernel = np.ones(width, dtype=np.float64) / width
    return np.convolve(values, kernel, mode="same")


def _zscore(values: np.ndarray) -> np.ndarray:
    mean = float(np.mean(values))
    std = float(np.std(values))
    if std <= 0:
        return np.zeros_like(values, dtype=np.float64)
    return (values - mean) / std


def _shift_cues(cues: list[dict[str, float | str]], shift: float) -> list[dict[str, float | str]]:
    return [
        {
            "text": cue["text"],
            "start": round(float(cue["start"]) + shift, 3),
            "end": round(float(cue["end"]) + shift, 3),
        }
        for cue in cues
    ]


def _combine_strategy(current: str, addition: str) -> str:
    if addition in current.split("+"):
        return current
    return f"{current}+{addition}" if current else addition


def _append_step(meta: dict[str, Any], step: dict[str, Any]) -> None:
    steps = meta.get("steps")
    if not isinstance(steps, list):
        steps = []
        meta["steps"] = steps
    steps.append(step)


def _estimate_onsets(audio_path: Path) -> list[float]:
    try:
        y, sr = librosa.load(str(audio_path), sr=22050, mono=True)
    except Exception:
        return []
    if y.size < sr:
        return []

    hop = 512
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    if onset_env.size == 0:
        return []
    frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        hop_length=hop,
        units="frames",
        backtrack=True,
    )
    times = librosa.frames_to_time(frames, sr=sr, hop_length=hop)

    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
    if rms.size:
        threshold = max(float(np.percentile(rms, 45)), float(np.percentile(rms, 90)) * 0.08, 0.001)
        filtered: list[float] = []
        for frame, time_value in zip(frames, times):
            idx = int(min(max(frame, 0), rms.size - 1))
            if float(rms[idx]) >= threshold:
                filtered.append(float(time_value))
        times = np.asarray(filtered, dtype=np.float64)

    if times.size == 0:
        return []
    deduped: list[float] = []
    for value in sorted(float(item) for item in times):
        if deduped and value - deduped[-1] < 0.08:
            continue
        deduped.append(value)
    return deduped


def _snap_to_onsets(
    cues: list[dict[str, float | str]],
    onsets: list[float],
    duration: float,
) -> list[dict[str, float | str]]:
    starts: list[float] = []
    for index, cue in enumerate(cues):
        start = float(cue["start"])
        window = 0.9 if index < 12 else 0.65
        nearest = _nearest(start, onsets, window)
        starts.append(nearest if nearest is not None else start)

    fixed: list[float] = []
    previous = -0.2
    for start in starts:
        value = max(previous + 0.18, start)
        if duration > 0:
            value = min(value, max(duration - 0.35, 0.0))
        fixed.append(value)
        previous = value

    out: list[dict[str, float | str]] = []
    for index, cue in enumerate(cues):
        start = fixed[index]
        original_len = max(0.45, float(cue["end"]) - float(cue["start"]))
        next_start = fixed[index + 1] if index + 1 < len(fixed) else start + original_len
        end = min(start + original_len, next_start - 0.05 if next_start > start + 0.4 else start + original_len)
        if duration > 0:
            end = min(end, duration)
        end = max(start + 0.35, end)
        out.append({"text": cue["text"], "start": round(start, 3), "end": round(end, 3)})
    return out


def _clip_to_duration(cues: list[dict[str, float | str]], duration: float) -> list[dict[str, float | str]]:
    clipped: list[dict[str, float | str]] = []
    for cue in cues:
        start = float(cue["start"])
        end = float(cue["end"])
        if end <= 0 or start >= duration:
            continue
        start = max(0.0, min(start, duration))
        end = max(start + 0.35, min(end, duration))
        if start < duration:
            clipped.append({"text": cue["text"], "start": round(start, 3), "end": round(end, 3)})
    return clipped


def _nearest(value: float, candidates: list[float], window: float) -> float | None:
    best: float | None = None
    best_delta = window
    for candidate in candidates:
        delta = abs(candidate - value)
        if delta <= best_delta:
            best = candidate
            best_delta = delta
        if candidate > value + window:
            break
    return best


def _safe_float(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return number if number == number else 0.0
