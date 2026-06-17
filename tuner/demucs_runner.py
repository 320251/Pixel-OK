from __future__ import annotations

from pathlib import Path

import soundfile as sf


def _save_audio_with_soundfile(
    wav,
    path,
    samplerate,
    bitrate=320,
    clip="rescale",
    bits_per_sample=16,
    as_float=False,
    preset=2,
):
    from demucs.audio import encode_mp3, prevent_clip

    wav = prevent_clip(wav, mode=clip)
    path = Path(path)
    suffix = path.suffix.lower()

    if suffix == ".mp3":
        encode_mp3(wav, path, samplerate, bitrate, preset, verbose=True)
        return
    if suffix not in {".wav", ".flac"}:
        raise ValueError(f"Invalid suffix for path: {suffix}")

    data = wav.detach().cpu().numpy()
    if data.ndim == 2:
        data = data.T

    if as_float:
        subtype = "FLOAT"
    elif bits_per_sample == 24:
        subtype = "PCM_24"
    elif bits_per_sample == 32:
        subtype = "PCM_32"
    else:
        subtype = "PCM_16"

    sf.write(str(path), data, int(samplerate), subtype=subtype)


def main() -> None:
    import demucs.audio
    import demucs.separate

    demucs.audio.save_audio = _save_audio_with_soundfile
    demucs.separate.save_audio = _save_audio_with_soundfile
    demucs.separate.main()


if __name__ == "__main__":
    main()
