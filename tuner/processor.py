from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import math
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from scipy.ndimage import median_filter


ANALYSIS_SR = 22050
OUTPUT_SR = 44100
F0_HOP = 512

MODE_SETTINGS = {
    "natural": {
        "strength": 0.34,
        "max_shift": 3.0,
        "smooth_frames": 15,
        "fallback_chunk": 0.86,
        "label": "自然",
    },
    "standard": {
        "strength": 0.66,
        "max_shift": 6.0,
        "smooth_frames": 9,
        "fallback_chunk": 0.56,
        "label": "标准",
    },
    "hard": {
        "strength": 0.95,
        "max_shift": 12.0,
        "smooth_frames": 3,
        "fallback_chunk": 0.30,
        "label": "电音",
    },
}


@dataclass
class PitchCurve:
    times: np.ndarray
    f0: np.ndarray
    voiced: np.ndarray
    source: str


def process_job(
    *,
    original_path: Path,
    vocal_path: Path,
    job_dir: Path,
    mode: str,
    auto_align: bool,
    use_demucs: bool,
    use_basic_pitch: bool,
    pitch_engine: str,
    offset_seconds: float,
    vocal_gain: float,
    backing_gain: float,
) -> dict:
    started = time.time()
    settings = MODE_SETTINGS.get(mode, MODE_SETTINGS["standard"])
    messages: list[str] = []

    reference_path = original_path
    backing_path = original_path
    mix_source = "原歌叠加预览"
    require_backing = bool(use_demucs)

    if use_demucs:
        demucs_result = _try_demucs(original_path, job_dir)
        messages.extend(demucs_result["messages"])
        if demucs_result["vocals"] is not None:
            reference_path = demucs_result["vocals"]
        if demucs_result["no_vocals"] is not None:
            backing_path = demucs_result["no_vocals"]
            mix_source = "AI 伴奏"
        else:
            backing_path = None
            mix_source = "无伴奏预览"
            messages.append("没有拿到 AI 伴奏，本次不会把人声叠回原歌。")

    ref_y_analysis = _load_mono(reference_path, ANALYSIS_SR)
    user_y_analysis = _load_mono(vocal_path, ANALYSIS_SR)
    user_y_output = _load_mono(vocal_path, OUTPUT_SR)

    user_mono_path = job_dir / "vocal_mono.wav"
    _write_wav(user_mono_path, user_y_output, OUTPUT_SR)

    reference_curve = _estimate_reference_curve(
        reference_path=reference_path,
        y=ref_y_analysis,
        pitch_engine=pitch_engine,
        use_basic_pitch=use_basic_pitch,
        messages=messages,
    )
    user_curve = _estimate_f0(
        user_y_analysis,
        ANALYSIS_SR,
        "your vocal",
        engine=pitch_engine,
        messages=messages,
    )

    mapped_reference_times, align_note = _map_user_times_to_reference(
        ref_y=ref_y_analysis,
        user_y=user_y_analysis,
        user_times=user_curve.times,
        ref_duration=len(ref_y_analysis) / ANALYSIS_SR,
        auto_align=auto_align,
        offset_seconds=offset_seconds,
    )
    messages.append(align_note)

    correction = _build_correction_curve(
        reference_curve=reference_curve,
        user_curve=user_curve,
        mapped_reference_times=mapped_reference_times,
        settings=settings,
    )
    messages.extend(correction["messages"])

    corrected_path = job_dir / "corrected_vocal.wav"
    engine = _apply_pitch_contour(
        input_wav=user_mono_path,
        output_wav=corrected_path,
        source_audio=user_y_output,
        user_curve=user_curve,
        target_hz=correction["target_hz"],
        valid_mask=correction["valid"],
        applied_steps=correction["applied_steps"],
        settings=settings,
        messages=messages,
    )

    corrected_raw = _load_mono(corrected_path, OUTPUT_SR)
    corrected_raw = _match_length(corrected_raw, len(user_y_output))

    if backing_path is None and require_backing:
        backing_y = np.zeros_like(corrected_raw)
    else:
        backing_y = _load_mono(backing_path, OUTPUT_SR)

    raw_vocal = _place_vocal_on_timeline(
        vocal=user_y_output,
        offset_seconds=offset_seconds,
        sr=OUTPUT_SR,
        reference_length=len(backing_y),
    )
    corrected = _place_vocal_on_timeline(
        vocal=corrected_raw,
        offset_seconds=offset_seconds,
        sr=OUTPUT_SR,
        reference_length=len(backing_y),
    )

    timeline_length = max(len(backing_y), len(raw_vocal), len(corrected))
    backing_y = _match_length(backing_y, timeline_length)
    raw_vocal = _match_length(raw_vocal, timeline_length)
    corrected = _match_length(corrected, timeline_length)

    backing_output_path = job_dir / "accompaniment.wav"
    _write_wav(backing_output_path, backing_y, OUTPUT_SR)

    raw_vocal_path = job_dir / "raw_vocal.wav"
    _write_wav(raw_vocal_path, raw_vocal, OUTPUT_SR)

    _write_wav(corrected_path, corrected, OUTPUT_SR)
    messages.append(_offset_message(offset_seconds))

    preview_path = job_dir / "preview_mix.wav"
    preview = _mix_preview(
        backing=backing_y,
        vocal=corrected,
        backing_gain=backing_gain,
        vocal_gain=vocal_gain,
    )
    _write_wav(preview_path, preview, OUTPUT_SR)

    debug_path = job_dir / "pitch_debug.csv"
    _write_debug_csv(
        debug_path,
        user_curve=user_curve,
        mapped_reference_times=mapped_reference_times,
        target_hz=correction["target_hz"],
        applied_steps=correction["applied_steps"],
        valid=correction["valid"],
    )

    summary = {
        "mode": settings["label"],
        "engine": engine,
        "mix_source": mix_source,
        "duration_seconds": round(len(user_y_output) / OUTPUT_SR, 2),
        "timeline_seconds": round(len(corrected) / OUTPUT_SR, 2),
        "offset_seconds": round(float(offset_seconds), 3),
        "processing_seconds": round(time.time() - started, 2),
        "reference_source": reference_curve.source,
        "pitch_engine": reference_curve.source,
        "reference_frame_ratio": round(float(correction["reference_ratio"]), 3),
        "corrected_frame_ratio": round(float(correction["valid_ratio"]), 3),
        "median_applied_cents": round(float(correction["median_abs_steps"] * 100), 1),
        "messages": messages,
    }
    (job_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return summary


def separate_original(*, original_path: Path, job_dir: Path) -> dict:
    demucs_result = _try_demucs(original_path, job_dir)
    messages = list(demucs_result["messages"])

    vocals_path = demucs_result["vocals"]
    accompaniment_path = demucs_result["no_vocals"]
    if vocals_path is None or accompaniment_path is None:
        raise RuntimeError("AI 分离没有产出伴奏和阿卡贝拉。请确认 Demucs 已安装，或换一首音质更清楚的原歌。")

    acapella_dest = job_dir / "acapella.wav"
    accompaniment_dest = job_dir / "accompaniment.wav"
    shutil.copy2(vocals_path, acapella_dest)
    shutil.copy2(accompaniment_path, accompaniment_dest)

    summary = {
        "tracks": ["original", "accompaniment", "acapella"],
        "messages": messages,
    }
    (job_dir / "separation_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return summary


def mix_backing_with_harmony(
    *,
    accompaniment_path: Path,
    harmony_path: Path,
    output_path: Path,
    accompaniment_gain: float = 1.0,
    harmony_gain: float = 1.0,
) -> dict:
    if not accompaniment_path.exists():
        raise RuntimeError(f"Cannot find accompaniment: {accompaniment_path.name}")
    if not harmony_path.exists():
        raise RuntimeError(f"Cannot find harmony/backing vocal: {harmony_path.name}")

    accompaniment = _load_mono(accompaniment_path, OUTPUT_SR) * float(accompaniment_gain)
    harmony = _load_mono(harmony_path, OUTPUT_SR) * float(harmony_gain)
    length = max(len(accompaniment), len(harmony))
    mix = _match_length(accompaniment, length) + _match_length(harmony, length)
    _write_wav(output_path, mix, OUTPUT_SR)
    return {
        "output": str(output_path),
        "duration_seconds": round(length / OUTPUT_SR, 2),
        "messages": ["已把和声/剩余人声混回伴奏，生成含和声的伴奏。"],
    }


def _load_mono(path: Path, sr: int) -> np.ndarray:
    try:
        y, _ = librosa.load(str(path), sr=sr, mono=True)
    except Exception as exc:
        raise RuntimeError(f"Cannot read audio file {path.name}: {exc}") from exc
    y = np.asarray(y, dtype=np.float32)
    y = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0)
    if y.size == 0:
        raise RuntimeError(f"Audio file is empty: {path.name}")
    return y


def _write_wav(path: Path, y: np.ndarray, sr: int) -> None:
    y = np.asarray(y, dtype=np.float32)
    y = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0)
    peak = float(np.max(np.abs(y))) if y.size else 0.0
    if peak > 0.98:
        y = y * (0.98 / peak)
    sf.write(str(path), y, sr, subtype="PCM_16")


def _estimate_reference_curve(
    *,
    reference_path: Path,
    y: np.ndarray,
    pitch_engine: str,
    use_basic_pitch: bool,
    messages: list[str],
) -> PitchCurve:
    if use_basic_pitch:
        curve = _try_basic_pitch(reference_path, len(y) / ANALYSIS_SR, messages)
        if curve is not None:
            return curve
    return _estimate_f0(y, ANALYSIS_SR, "reference", engine=pitch_engine, messages=messages)


def _estimate_f0(
    y: np.ndarray,
    sr: int,
    source: str,
    *,
    engine: str = "pyin",
    messages: list[str] | None = None,
) -> PitchCurve:
    if engine == "torchcrepe":
        try:
            return _estimate_f0_torchcrepe(y, sr, source)
        except Exception as exc:
            if messages is not None:
                messages.append(f"AI CREPE 音高识别失败，已回落到 pYIN：{exc}")

    frame_length = 2048
    if len(y) < frame_length:
        y = np.pad(y, (0, frame_length - len(y)))

    fmin = librosa.note_to_hz("C2")
    fmax = librosa.note_to_hz("C6")
    try:
        f0, voiced, voiced_prob = librosa.pyin(
            y,
            fmin=fmin,
            fmax=fmax,
            sr=sr,
            frame_length=frame_length,
            hop_length=F0_HOP,
            fill_na=np.nan,
        )
        voiced = np.asarray(voiced, dtype=bool) & np.isfinite(f0)
        voiced_prob = np.nan_to_num(voiced_prob, nan=0.0)
        voiced &= voiced_prob > 0.08
        f0 = np.where(voiced, f0, np.nan)
    except Exception:
        f0 = librosa.yin(
            y,
            fmin=fmin,
            fmax=fmax,
            sr=sr,
            frame_length=frame_length,
            hop_length=F0_HOP,
        )
        rms = librosa.feature.rms(
            y=y,
            frame_length=frame_length,
            hop_length=F0_HOP,
        )[0]
        n = min(len(f0), len(rms))
        f0 = f0[:n]
        rms = rms[:n]
        threshold = max(float(np.percentile(rms, 55)) * 0.2, float(np.max(rms)) * 0.015)
        voiced = (rms > threshold) & np.isfinite(f0)
        f0 = np.where(voiced, f0, np.nan)

    times = librosa.frames_to_time(np.arange(len(f0)), sr=sr, hop_length=F0_HOP)
    return PitchCurve(times=times, f0=np.asarray(f0), voiced=voiced, source=f"{source} pYIN")


def _estimate_f0_torchcrepe(y: np.ndarray, sr: int, source: str) -> PitchCurve:
    import torch
    import torchcrepe

    crepe_sr = 16000
    hop_seconds = F0_HOP / sr
    hop_length = max(1, int(round(hop_seconds * crepe_sr)))
    y = np.asarray(y, dtype=np.float32)
    if sr != crepe_sr:
        y = librosa.resample(y, orig_sr=sr, target_sr=crepe_sr)
    y = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)
    peak = float(np.max(np.abs(y))) if y.size else 0.0
    if peak > 0:
        y = y / max(peak, 1.0)

    audio = torch.from_numpy(y).float().unsqueeze(0)
    fmin = float(librosa.note_to_hz("C2"))
    fmax = float(librosa.note_to_hz("C6"))
    with torch.no_grad():
        pitch, periodicity = torchcrepe.predict(
            audio,
            crepe_sr,
            hop_length=hop_length,
            fmin=fmin,
            fmax=fmax,
            model="tiny",
            batch_size=4096,
            device="cpu",
            return_periodicity=True,
        )

    f0 = pitch.squeeze(0).cpu().numpy().astype(np.float64)
    confidence = periodicity.squeeze(0).cpu().numpy().astype(np.float64)
    voiced = np.isfinite(f0) & (confidence > 0.34)
    f0 = np.where(voiced, f0, np.nan)
    if int(np.sum(voiced)) >= 3:
        smoothed = median_filter(np.nan_to_num(f0, nan=0.0), size=3, mode="nearest")
        f0 = np.where(voiced, smoothed, np.nan)

    times = np.arange(len(f0), dtype=np.float64) * (hop_length / crepe_sr)
    return PitchCurve(times=times, f0=f0, voiced=voiced, source=f"{source} AI CREPE")


def _try_basic_pitch(
    reference_path: Path,
    duration: float,
    messages: list[str],
) -> PitchCurve | None:
    if importlib.util.find_spec("basic_pitch") is None:
        messages.append("Basic Pitch 未安装，已改用 pYIN 参考旋律。")
        return None

    try:
        from basic_pitch.inference import predict

        _, _, note_events = predict(str(reference_path))
    except Exception as exc:
        messages.append(f"Basic Pitch 运行失败，已改用 pYIN：{exc}")
        return None

    times = np.arange(0.0, max(duration, 0.01), F0_HOP / ANALYSIS_SR)
    midi = np.full_like(times, np.nan, dtype=np.float64)
    amp = np.zeros_like(times, dtype=np.float64)

    for event in note_events:
        if len(event) < 4:
            continue
        start, end, pitch_midi, amplitude = event[:4]
        if end <= start:
            continue
        mask = (times >= float(start)) & (times <= float(end))
        stronger = mask & (float(amplitude) >= amp)
        midi[stronger] = float(pitch_midi)
        amp[stronger] = float(amplitude)

    valid = np.isfinite(midi)
    if int(np.sum(valid)) < 8:
        messages.append("Basic Pitch 没有读到足够旋律，已改用 pYIN。")
        return None

    f0 = np.where(valid, librosa.midi_to_hz(midi), np.nan)
    messages.append("已使用 Basic Pitch 提取参考旋律。")
    return PitchCurve(times=times, f0=f0, voiced=valid, source="Basic Pitch")


def _try_demucs(original_path: Path, job_dir: Path) -> dict:
    messages: list[str] = []
    result = {"vocals": None, "no_vocals": None, "messages": messages}

    if importlib.util.find_spec("demucs") is None:
        messages.append("Demucs 未安装，无法 AI 分离伴奏；可运行 install_ai_models.bat 尝试安装。")
        return result

    cache_dir = Path(__file__).resolve().parents[1] / "cache" / "demucs" / _file_hash(original_path)
    cached_vocals = cache_dir / "vocals.wav"
    cached_no_vocals = cache_dir / "no_vocals.wav"
    if cached_vocals.exists() and cached_no_vocals.exists():
        result["vocals"] = cached_vocals
        result["no_vocals"] = cached_no_vocals
        messages.append("已复用缓存里的 Demucs 伴奏分离结果。")
        return result

    output_dir = job_dir / "demucs"
    cmd = [
        sys.executable,
        "-m",
        "tuner.demucs_runner",
        "--two-stems=vocals",
        "-n",
        "htdemucs",
        "-o",
        str(output_dir),
        str(original_path),
    ]
    try:
        completed = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
            timeout=1800,
        )
    except Exception as exc:
        messages.append(f"Demucs 启动失败：{exc}")
        return result

    if completed.returncode != 0:
        tail = (completed.stderr or completed.stdout or "").strip().splitlines()[-3:]
        messages.append("Demucs 分离失败：" + " / ".join(tail))
        return result

    vocals = list(output_dir.glob("**/vocals.wav"))
    no_vocals = list(output_dir.glob("**/no_vocals.wav"))
    if vocals:
        result["vocals"] = vocals[0]
    if no_vocals:
        result["no_vocals"] = no_vocals[0]

    if result["vocals"] is not None:
        messages.append("已使用 Demucs 分离原唱/伴奏。")
        if result["no_vocals"] is not None:
            cache_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(result["vocals"], cached_vocals)
            shutil.copy2(result["no_vocals"], cached_no_vocals)
            result["vocals"] = cached_vocals
            result["no_vocals"] = cached_no_vocals
            messages.append("已缓存本首歌的伴奏分离结果，后续微调会更快。")
    else:
        messages.append("Demucs 已运行，但没有找到 vocals.wav。")
    return result


def _file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()[:16]


def _map_user_times_to_reference(
    *,
    ref_y: np.ndarray,
    user_y: np.ndarray,
    user_times: np.ndarray,
    ref_duration: float,
    auto_align: bool,
    offset_seconds: float,
) -> tuple[np.ndarray, str]:
    if not auto_align:
        mapped = np.clip(user_times + offset_seconds, 0.0, ref_duration)
        return mapped, f"未启用自动对齐，手动偏移 {offset_seconds:+.2f}s。"

    try:
        hop = 2048
        ref_chroma = _chroma(ref_y, ANALYSIS_SR, hop)
        user_chroma = _chroma(user_y, ANALYSIS_SR, hop)
        if ref_chroma.shape[1] < 4 or user_chroma.shape[1] < 4:
            raise RuntimeError("audio too short for DTW")

        _, path = librosa.sequence.dtw(
            X=user_chroma,
            Y=ref_chroma,
            metric="cosine",
            subseq=True,
        )
        path = np.asarray(path[::-1])
        user_idx = path[:, 0]
        ref_idx = path[:, 1]
        unique_user = np.unique(user_idx)
        ref_for_user = np.array(
            [np.median(ref_idx[user_idx == idx]) for idx in unique_user],
            dtype=np.float64,
        )
        user_anchor = librosa.frames_to_time(unique_user, sr=ANALYSIS_SR, hop_length=hop)
        ref_anchor = librosa.frames_to_time(ref_for_user, sr=ANALYSIS_SR, hop_length=hop)
        mapped = np.interp(user_times, user_anchor, ref_anchor)
        mapped = np.clip(mapped + offset_seconds, 0.0, ref_duration)
        coverage = len(unique_user) / max(user_chroma.shape[1], 1)
        return mapped, f"已自动对齐人声到原歌，覆盖率 {coverage:.0%}，手动偏移 {offset_seconds:+.2f}s。"
    except Exception as exc:
        mapped = np.clip(user_times + offset_seconds, 0.0, ref_duration)
        return mapped, f"自动对齐失败，已使用同时间线：{exc}"


def _chroma(y: np.ndarray, sr: int, hop: int) -> np.ndarray:
    if float(np.max(np.abs(y))) < 1e-6:
        raise RuntimeError("silent audio")
    n_fft = 4096
    if len(y) < n_fft:
        y = np.pad(y, (0, n_fft - len(y)))
    stft = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop))
    chroma = librosa.feature.chroma_stft(S=stft, sr=sr, hop_length=hop)
    norm = np.linalg.norm(chroma, axis=0, keepdims=True)
    chroma = chroma / np.maximum(norm, 1e-8)
    return np.nan_to_num(chroma)


def _build_correction_curve(
    *,
    reference_curve: PitchCurve,
    user_curve: PitchCurve,
    mapped_reference_times: np.ndarray,
    settings: dict,
) -> dict:
    messages: list[str] = []
    user_valid = np.isfinite(user_curve.f0) & user_curve.voiced
    user_midi = _hz_to_midi(user_curve.f0)

    ref_valid = np.isfinite(reference_curve.f0) & reference_curve.voiced
    can_use_reference = int(np.sum(ref_valid)) >= 8
    reference_mask = np.zeros_like(user_valid, dtype=bool)
    delta = np.full_like(user_midi, np.nan, dtype=np.float64)

    if can_use_reference:
        ref_times = reference_curve.times[ref_valid]
        ref_midi = _hz_to_midi(reference_curve.f0[ref_valid])
        target_midi = np.interp(mapped_reference_times, ref_times, ref_midi)
        nearest = _nearest_distance(ref_times, mapped_reference_times)
        reference_mask = nearest < 0.36

        octave_shift = 12.0 * np.round((user_midi - target_midi) / 12.0)
        target_midi = target_midi + octave_shift
        reference_delta = target_midi - user_midi

        chromatic_delta = np.round(user_midi) - user_midi
        too_far = np.abs(reference_delta) > (settings["max_shift"] + 2.0)
        use_reference = reference_mask & ~too_far & user_valid
        delta[use_reference] = reference_delta[use_reference]
        fallback = user_valid & ~use_reference
        delta[fallback] = chromatic_delta[fallback]
        messages.append(f"参考旋律来源：{reference_curve.source}。无法可靠匹配的片段会退回半音阶修正。")
    else:
        chromatic_delta = np.round(user_midi) - user_midi
        delta[user_valid] = chromatic_delta[user_valid]
        messages.append("原歌里没有读到足够清晰的旋律，本次使用半音阶自动修正。")

    valid = user_valid & np.isfinite(delta)
    delta = np.clip(delta, -settings["max_shift"], settings["max_shift"])
    delta = _smooth_steps(delta, valid, settings["smooth_frames"])
    applied_steps = np.where(valid, delta * settings["strength"], 0.0)

    target_midi_applied = user_midi + applied_steps
    target_hz = np.where(valid, librosa.midi_to_hz(target_midi_applied), np.nan)

    valid_ratio = float(np.sum(valid)) / max(float(np.sum(user_valid)), 1.0)
    reference_ratio = float(np.sum(reference_mask & user_valid)) / max(float(np.sum(user_valid)), 1.0)
    median_abs_steps = float(np.nanmedian(np.abs(applied_steps[valid]))) if np.any(valid) else 0.0

    return {
        "target_hz": target_hz,
        "valid": valid,
        "applied_steps": applied_steps,
        "valid_ratio": valid_ratio,
        "reference_ratio": reference_ratio,
        "median_abs_steps": median_abs_steps,
        "messages": messages,
    }


def _hz_to_midi(hz: np.ndarray) -> np.ndarray:
    hz = np.asarray(hz, dtype=np.float64)
    with np.errstate(divide="ignore", invalid="ignore"):
        return 69.0 + 12.0 * np.log2(hz / 440.0)


def _nearest_distance(points: np.ndarray, queries: np.ndarray) -> np.ndarray:
    if len(points) == 0:
        return np.full_like(queries, np.inf, dtype=np.float64)
    idx = np.searchsorted(points, queries)
    left_idx = np.clip(idx - 1, 0, len(points) - 1)
    right_idx = np.clip(idx, 0, len(points) - 1)
    left = np.abs(queries - points[left_idx])
    right = np.abs(queries - points[right_idx])
    return np.minimum(left, right)


def _smooth_steps(values: np.ndarray, valid: np.ndarray, frames: int) -> np.ndarray:
    out = np.full_like(values, np.nan, dtype=np.float64)
    usable = valid & np.isfinite(values)
    if int(np.sum(usable)) < 2:
        out[usable] = values[usable]
        return out

    x = np.arange(len(values))
    filled = np.interp(x, x[usable], values[usable])
    frames = max(1, int(frames))
    if frames > 1:
        if frames % 2 == 0:
            frames += 1
        filled = median_filter(filled, size=frames, mode="nearest")
        kernel = np.ones(frames, dtype=np.float64) / frames
        filled = np.convolve(filled, kernel, mode="same")
    out[usable] = filled[usable]
    return out


def _apply_pitch_contour(
    *,
    input_wav: Path,
    output_wav: Path,
    source_audio: np.ndarray,
    user_curve: PitchCurve,
    target_hz: np.ndarray,
    valid_mask: np.ndarray,
    applied_steps: np.ndarray,
    settings: dict,
    messages: list[str],
) -> str:
    if importlib.util.find_spec("parselmouth") is not None:
        try:
            _apply_with_parselmouth(input_wav, output_wav, user_curve.times, target_hz, valid_mask)
            messages.append("已使用 Praat/Parselmouth 重绘人声音高轮廓。")
            return "Praat pitch contour"
        except Exception as exc:
            messages.append(f"Parselmouth 修音失败，已改用分块变调：{exc}")

    corrected = _fallback_chunk_pitch_shift(
        source_audio=source_audio,
        sr=OUTPUT_SR,
        user_curve=user_curve,
        applied_steps=applied_steps,
        valid_mask=valid_mask,
        chunk_seconds=settings["fallback_chunk"],
    )
    _write_wav(output_wav, corrected, OUTPUT_SR)
    return "chunked pitch shift"


def _apply_with_parselmouth(
    input_wav: Path,
    output_wav: Path,
    times: np.ndarray,
    target_hz: np.ndarray,
    valid_mask: np.ndarray,
) -> None:
    import parselmouth
    from parselmouth.praat import call

    sound = parselmouth.Sound(str(input_wav))
    duration = float(sound.get_total_duration())
    manipulation = call(sound, "To Manipulation", 0.01, 50, 900)
    pitch_tier = call(manipulation, "Extract pitch tier")
    point_count = int(call(pitch_tier, "Get number of points"))
    for index in range(point_count, 0, -1):
        call(pitch_tier, "Remove point", index)

    added = 0
    last_time = -1.0
    for t, hz, valid in zip(times, target_hz, valid_mask):
        if not valid or not math.isfinite(float(hz)):
            continue
        if hz < 50 or hz > 1200:
            continue
        if t < 0 or t > duration:
            continue
        if t - last_time < 0.015:
            continue
        call(pitch_tier, "Add point", float(max(t, 0.001)), float(hz))
        last_time = float(t)
        added += 1

    if added < 3:
        raise RuntimeError("not enough pitch points")

    call([pitch_tier, manipulation], "Replace pitch tier")
    tuned = call(manipulation, "Get resynthesis (overlap-add)")
    tuned.save(str(output_wav), "WAV")


def _fallback_chunk_pitch_shift(
    *,
    source_audio: np.ndarray,
    sr: int,
    user_curve: PitchCurve,
    applied_steps: np.ndarray,
    valid_mask: np.ndarray,
    chunk_seconds: float,
) -> np.ndarray:
    y = np.asarray(source_audio, dtype=np.float32)
    duration = len(y) / sr
    chunk = max(int(chunk_seconds * sr), 1024)
    hop = max(chunk // 2, 512)
    out = np.zeros_like(y, dtype=np.float64)
    weight = np.zeros_like(y, dtype=np.float64)

    for start in range(0, len(y), hop):
        end = min(start + chunk, len(y))
        if end <= start:
            continue
        t0 = start / sr
        t1 = end / sr
        frame_mask = (user_curve.times >= t0) & (user_curve.times <= t1) & valid_mask
        if np.any(frame_mask):
            steps = float(np.nanmedian(applied_steps[frame_mask]))
        else:
            steps = 0.0

        segment = y[start:end]
        if abs(steps) > 0.03:
            shifted = librosa.effects.pitch_shift(segment, sr=sr, n_steps=steps)
            shifted = _match_length(shifted, len(segment))
        else:
            shifted = segment

        window = np.hanning(len(segment))
        if len(window) < 4 or float(np.max(window)) == 0.0:
            window = np.ones(len(segment))
        out[start:end] += shifted * window
        weight[start:end] += window
        if end == len(y):
            break

    missing = weight < 1e-6
    corrected = np.zeros_like(out)
    corrected[~missing] = out[~missing] / weight[~missing]
    corrected[missing] = y[missing]
    return corrected.astype(np.float32)


def _match_length(y: np.ndarray, length: int) -> np.ndarray:
    y = np.asarray(y, dtype=np.float32)
    if len(y) == length:
        return y
    if len(y) > length:
        return y[:length]
    return np.pad(y, (0, length - len(y)))


def _mix_preview(
    *,
    backing: np.ndarray,
    vocal: np.ndarray,
    backing_gain: float,
    vocal_gain: float,
) -> np.ndarray:
    length = max(len(backing), len(vocal))
    backing = _match_length(backing, length)
    vocal = _match_length(vocal, length)
    mix = backing * float(backing_gain) + vocal * float(vocal_gain)
    peak = float(np.max(np.abs(mix))) if mix.size else 0.0
    if peak > 0.98:
        mix = mix * (0.98 / peak)
    return mix.astype(np.float32)


def _place_vocal_on_timeline(
    *,
    vocal: np.ndarray,
    offset_seconds: float,
    sr: int,
    reference_length: int,
) -> np.ndarray:
    shift = int(round(float(offset_seconds) * sr))
    vocal = np.asarray(vocal, dtype=np.float32)

    if shift >= 0:
        placed = np.pad(vocal, (shift, 0))
    else:
        trim = min(abs(shift), len(vocal))
        placed = vocal[trim:]

    length = max(int(reference_length), len(placed), 1)
    return _match_length(placed, length)


def _offset_message(offset_seconds: float) -> str:
    if abs(offset_seconds) < 0.001:
        return "人声位置：没有手动偏移。"
    if offset_seconds > 0:
        return f"人声位置：已整体延后 {offset_seconds:.2f} 秒。"
    return f"人声位置：已整体提前 {abs(offset_seconds):.2f} 秒。"


def _write_debug_csv(
    path: Path,
    *,
    user_curve: PitchCurve,
    mapped_reference_times: np.ndarray,
    target_hz: np.ndarray,
    applied_steps: np.ndarray,
    valid: np.ndarray,
) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "time_seconds",
                "mapped_reference_seconds",
                "user_hz",
                "target_hz",
                "applied_semitones",
                "used",
            ]
        )
        for row in zip(
            user_curve.times,
            mapped_reference_times,
            user_curve.f0,
            target_hz,
            applied_steps,
            valid,
        ):
            writer.writerow(
                [
                    round(float(row[0]), 4),
                    round(float(row[1]), 4),
                    "" if not np.isfinite(row[2]) else round(float(row[2]), 4),
                    "" if not np.isfinite(row[3]) else round(float(row[3]), 4),
                    round(float(row[4]), 4),
                    int(bool(row[5])),
                ]
            )
