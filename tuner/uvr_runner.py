from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import time
from pathlib import Path

import numpy as np
import soundfile as sf

from tuner.processor import mix_backing_with_harmony, separate_original


BASE_DIR = Path(__file__).resolve().parents[1]
UVR_EXE = BASE_DIR / ".uvr-venv" / "Scripts" / "audio-separator.exe"
MODEL_DIR = BASE_DIR / "cache" / "uvr-models"

PIPELINE_VERSION = "uvr-kara-bve-v2"
PIPELINE_STATE_NAME = "uvr_pipeline.json"
VOCAL_SPLIT_MODEL = "UVR_MDXNET_KARA_2.onnx"
BVE_MODEL = "UVR-BVE-4B_SN-44100-1.pth"
VOCAL_SPLIT_TIMEOUT = 900
BVE_TIMEOUT = 1200


def is_uvr_available() -> bool:
    return UVR_EXE.exists()


def split_original_to_lead_and_backing(*, original_path: Path, job_dir: Path, status_callback=None) -> dict:
    """Build the app's three useful tracks from the original song.

    The app needs:
    - original
    - lead_vocal: clean enough for lyric recognition and pitch reference
    - backing_with_harmony: instrumental plus extracted backing vocals
    """
    _require_uvr()
    if not original_path.exists():
        raise RuntimeError("找不到原歌文件。")

    started = time.time()
    paths = _track_paths(job_dir)
    cache_dir = BASE_DIR / "cache" / "uvr-three-stems" / f"{_file_hash(original_path)}-{PIPELINE_VERSION}"
    messages: list[str] = []

    if _pipeline_ready(job_dir):
        _store_cache(paths, cache_dir)
        return _summary(started, ["已复用项目里的 UVR 两段式三轨结果。"])

    if _cache_ready(cache_dir):
        if status_callback:
            status_callback("正在复用同一首歌的分轨缓存。")
        _restore_cache(paths, cache_dir)
        _write_pipeline_state(job_dir, messages=["已复用同一首歌的 UVR 两段式缓存。"])
        return _summary(started, ["已复用同一首歌的 UVR 两段式缓存。"])

    try:
        if status_callback:
            status_callback("1/3 正在用 UVR KARA 快速拆出人声和伴奏。")
        vocal_stem, instrumental_stem = _run_fast_vocal_split(
            input_path=original_path,
            output_dir=job_dir / "uvr_vocal_clean",
        )
        shutil.copy2(vocal_stem, paths["acapella"])
        shutil.copy2(instrumental_stem, paths["accompaniment"])
        messages.append("已用 UVR KARA 拆出人声和伴奏。")
    except Exception as exc:
        raise RuntimeError(f"UVR KARA 拆分失败：{exc}") from exc

    try:
        if status_callback:
            status_callback("2/3 正在用 UVR-BVE 从人声里拆主唱和和声/剩余人声。")
        lead_stem, backing_vocal_stem = _run_bve_split(
            input_path=paths["acapella"],
            output_dir=job_dir / "uvr_vocal_layers",
        )
        shutil.copy2(lead_stem, paths["lead_vocal"])
        shutil.copy2(backing_vocal_stem, paths["backing_vocals"])
        messages.append("已用 UVR-BVE 在人声 stem 内拆出主唱和和声/剩余人声。")
    except Exception as exc:
        shutil.copy2(paths["acapella"], paths["lead_vocal"])
        _write_silence_like(paths["acapella"], paths["backing_vocals"])
        messages.append(f"BVE 主唱/和声拆分失败，已先使用全人声作为主唱：{exc}")

    if status_callback:
        status_callback("3/3 正在把和声混回伴奏，生成最终三轨。")
    mix_result = mix_backing_with_harmony(
        accompaniment_path=paths["accompaniment"],
        harmony_path=paths["backing_vocals"],
        output_path=paths["backing_with_harmony"],
        accompaniment_gain=1.0,
        harmony_gain=1.0,
    )
    messages.extend(mix_result.get("messages", []))

    _write_pipeline_state(job_dir, messages=messages)
    _store_cache(paths, cache_dir)

    return _summary(started, messages)


def split_vocal_layers(*, acapella_path: Path, job_dir: Path) -> dict:
    """Split an existing vocal stem into lead and residual/backing vocals."""
    _require_uvr()
    if not acapella_path.exists():
        raise RuntimeError("还没有可用的人声文件。")

    started = time.time()
    paths = _track_paths(job_dir)
    cache_dir = BASE_DIR / "cache" / "uvr-vocal-layers" / f"{_file_hash(acapella_path)}-{PIPELINE_VERSION}"
    cached_lead = cache_dir / "lead_vocal.wav"
    cached_backing = cache_dir / "backing_vocals.wav"

    if paths["lead_vocal"].exists() and paths["backing_vocals"].exists():
        cache_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(paths["lead_vocal"], cached_lead)
        shutil.copy2(paths["backing_vocals"], cached_backing)
        return {
            "model": BVE_MODEL,
            "pipeline": PIPELINE_VERSION,
            "processing_seconds": round(time.time() - started, 2),
            "messages": ["已复用项目里的 UVR-BVE 主唱/和声结果。"],
        }

    if cached_lead.exists() and cached_backing.exists():
        shutil.copy2(cached_lead, paths["lead_vocal"])
        shutil.copy2(cached_backing, paths["backing_vocals"])
        return {
            "model": BVE_MODEL,
            "pipeline": PIPELINE_VERSION,
            "processing_seconds": round(time.time() - started, 2),
            "messages": ["已复用同一人声文件的 UVR-BVE 缓存。"],
        }

    lead_stem, backing_vocal_stem = _run_bve_split(
        input_path=acapella_path,
        output_dir=job_dir / "uvr_vocal_layers",
    )
    shutil.copy2(lead_stem, paths["lead_vocal"])
    shutil.copy2(backing_vocal_stem, paths["backing_vocals"])
    cache_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(paths["lead_vocal"], cached_lead)
    shutil.copy2(paths["backing_vocals"], cached_backing)

    return {
        "model": BVE_MODEL,
        "pipeline": PIPELINE_VERSION,
        "processing_seconds": round(time.time() - started, 2),
        "messages": ["已用 UVR-BVE 把人声拆成主唱和和声/剩余人声。"],
    }


def _track_paths(job_dir: Path) -> dict[str, Path]:
    return {
        "acapella": job_dir / "acapella.wav",
        "accompaniment": job_dir / "accompaniment.wav",
        "lead_vocal": job_dir / "lead_vocal.wav",
        "backing_vocals": job_dir / "backing_vocals.wav",
        "backing_with_harmony": job_dir / "backing_with_harmony.wav",
    }


def _summary(started: float, messages: list[str]) -> dict:
    return {
        "model": f"{VOCAL_SPLIT_MODEL} + {BVE_MODEL}",
        "pipeline": PIPELINE_VERSION,
        "processing_seconds": round(time.time() - started, 2),
        "tracks": ["original", "lead_vocal", "backing_with_harmony"],
        "messages": messages,
    }


def _require_uvr() -> None:
    if not UVR_EXE.exists():
        raise RuntimeError("UVR/audio-separator 还没有安装。")


def _run_fast_vocal_split(*, input_path: Path, output_dir: Path) -> tuple[Path, Path]:
    _run_separator(
        input_path=input_path,
        output_dir=output_dir,
        model_args=["-m", VOCAL_SPLIT_MODEL],
        custom_output_names={
            "Vocals": "clean_vocals",
            "Instrumental": "clean_instrumental",
        },
        extra_args=[
            "--mdx_segment_size",
            "256",
            "--mdx_overlap",
            "0.15",
            "--mdx_batch_size",
            "1",
        ],
        timeout=VOCAL_SPLIT_TIMEOUT,
    )
    vocals = _find_output(output_dir, "clean_vocals")
    instrumental = _find_output(output_dir, "clean_instrumental")
    return vocals, instrumental


def _run_bve_split(*, input_path: Path, output_dir: Path) -> tuple[Path, Path]:
    _run_separator(
        input_path=input_path,
        output_dir=output_dir,
        model_args=["-m", BVE_MODEL],
        custom_output_names={
            "Vocals": "backing_vocals_tmp",
            "Instrumental": "lead_vocal_tmp",
            "Lead Vocals": "lead_vocal_tmp",
            "Backing Vocals": "backing_vocals_tmp",
            "lead_only": "lead_vocal_tmp",
            "backing_only": "backing_vocals_tmp",
        },
        extra_args=[
            "--vr_enable_post_process",
            "--vr_post_process_threshold",
            "0.2",
            "--vr_high_end_process",
        ],
        timeout=BVE_TIMEOUT,
    )
    lead = _find_output_optional(output_dir, "lead_vocal_tmp")
    backing = _find_output_optional(output_dir, "backing_vocals_tmp")
    if lead is None and backing is None:
        found = ", ".join(path.name for path in output_dir.glob("*.wav")) or "没有 WAV 输出"
        raise RuntimeError(f"UVR-BVE 没有产出主唱或和声文件：{found}")
    if lead is None:
        lead = output_dir / "lead_vocal_tmp.wav"
        _subtract_audio(input_path, backing, lead)
    if backing is None:
        backing = output_dir / "backing_vocals_tmp.wav"
        _subtract_audio(input_path, lead, backing)
    return lead, backing


def _run_separator(
    *,
    input_path: Path,
    output_dir: Path,
    model_args: list[str],
    custom_output_names: dict[str, str],
    extra_args: list[str] | None = None,
    timeout: int = 1800,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for stale in output_dir.glob("*.wav"):
        stale.unlink(missing_ok=True)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    cmd = [
        str(UVR_EXE),
        str(input_path),
        *model_args,
        "--output_format",
        "WAV",
        "--output_dir",
        str(output_dir),
        "--model_file_dir",
        str(MODEL_DIR),
        "--custom_output_names",
        json.dumps(custom_output_names, ensure_ascii=False),
        "--sample_rate",
        "44100",
        "--normalization",
        "0.9",
        "--log_level",
        "info",
        *(extra_args or []),
    ]
    log_path = output_dir / "separator.log"
    with log_path.open("w", encoding="utf-8", errors="replace") as log_handle:
        process = subprocess.Popen(
            cmd,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            text=True,
        )
        try:
            returncode = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            _kill_process_tree(process.pid)
            tail = _read_log_tail(log_path)
            detail = " / ".join(tail) if tail else "没有更多日志"
            raise RuntimeError(f"UVR 分离超过 {round(timeout / 60)} 分钟，已停止：{detail}") from exc

    if returncode != 0:
        tail = _read_log_tail(log_path)
        raise RuntimeError("UVR 分离失败：" + " / ".join(tail))


def _find_output(output_dir: Path, stem: str) -> Path:
    match = _find_output_optional(output_dir, stem)
    if match is not None:
        return match
    found = ", ".join(path.name for path in output_dir.glob("*.wav")) or "没有 WAV 输出"
    raise RuntimeError(f"UVR 没有产出 {stem}.wav：{found}")


def _find_output_optional(output_dir: Path, stem: str) -> Path | None:
    direct = output_dir / f"{stem}.wav"
    if direct.exists():
        return direct
    matches = sorted(output_dir.glob(f"{stem}*.wav"))
    return matches[0] if matches else None


def _pipeline_ready(job_dir: Path) -> bool:
    state_path = job_dir / PIPELINE_STATE_NAME
    if not state_path.exists():
        return False
    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
    except Exception:
        return False
    if state.get("version") != PIPELINE_VERSION:
        return False
    paths = _track_paths(job_dir)
    return all(paths[name].exists() for name in ("lead_vocal", "backing_with_harmony", "accompaniment", "acapella"))


def _write_pipeline_state(job_dir: Path, *, messages: list[str]) -> None:
    payload = {
        "version": PIPELINE_VERSION,
        "model": f"{VOCAL_SPLIT_MODEL} + {BVE_MODEL}",
        "messages": messages,
    }
    (job_dir / PIPELINE_STATE_NAME).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _cache_ready(cache_dir: Path) -> bool:
    return all((cache_dir / filename).exists() for filename in _cache_file_names().values())


def _store_cache(paths: dict[str, Path], cache_dir: Path) -> None:
    if _cache_ready(cache_dir):
        return
    cache_dir.mkdir(parents=True, exist_ok=True)
    for name, filename in _cache_file_names().items():
        source = paths[name]
        if source.exists():
            shutil.copy2(source, cache_dir / filename)


def _restore_cache(paths: dict[str, Path], cache_dir: Path) -> None:
    for name, filename in _cache_file_names().items():
        shutil.copy2(cache_dir / filename, paths[name])


def _cache_file_names() -> dict[str, str]:
    return {
        "acapella": "acapella.wav",
        "accompaniment": "accompaniment.wav",
        "lead_vocal": "lead_vocal.wav",
        "backing_vocals": "backing_vocals.wav",
        "backing_with_harmony": "backing_with_harmony.wav",
    }


def _write_silence_like(reference: Path, output: Path) -> None:
    info = sf.info(str(reference))
    channels = max(1, int(info.channels or 1))
    data = np.zeros((int(info.frames), channels), dtype=np.float32)
    sf.write(str(output), data, int(info.samplerate), subtype="PCM_16")


def _subtract_audio(full_mix_path: Path, stem_path: Path, output_path: Path) -> None:
    full_mix, sr = sf.read(str(full_mix_path), dtype="float32", always_2d=True)
    stem, stem_sr = sf.read(str(stem_path), dtype="float32", always_2d=True)
    if stem_sr != sr:
        raise RuntimeError("BVE 输出采样率和输入不一致，无法计算残差和声。")
    length = max(len(full_mix), len(stem))
    full_mix = _pad_audio(full_mix, length)
    stem = _pad_audio(stem, length)
    if full_mix.shape[1] != stem.shape[1]:
        channels = max(full_mix.shape[1], stem.shape[1])
        full_mix = _match_channels(full_mix, channels)
        stem = _match_channels(stem, channels)
    residual = full_mix - stem
    peak = float(np.max(np.abs(residual))) if residual.size else 0.0
    if peak > 0.98:
        residual *= 0.98 / peak
    sf.write(str(output_path), residual.astype(np.float32), sr, subtype="PCM_16")


def _pad_audio(audio: np.ndarray, length: int) -> np.ndarray:
    if len(audio) >= length:
        return audio[:length]
    return np.pad(audio, ((0, length - len(audio)), (0, 0)))


def _match_channels(audio: np.ndarray, channels: int) -> np.ndarray:
    if audio.shape[1] == channels:
        return audio
    if audio.shape[1] == 1:
        return np.repeat(audio, channels, axis=1)
    return audio[:, :channels]


def _file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()[:16]


def _read_log_tail(path: Path, lines: int = 8) -> list[str]:
    try:
        return path.read_text(encoding="utf-8", errors="replace").strip().splitlines()[-lines:]
    except Exception:
        return []


def _kill_process_tree(pid: int) -> None:
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return
    try:
        os.kill(pid, 9)
    except OSError:
        pass
