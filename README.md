# Pixel OK

Pixel OK is a local karaoke and pixel-MV workstation. It lets you load a song, split it into stems, fetch or align lyrics, generate a beat-reactive pixel animation plan, record a vocal take, preview the mix, and export a WebM music video.

## What It Does

- Upload or drag in an original song.
- Generate three working tracks: original, lead vocal, and backing with backing vocals/harmony.
- Download the separated lead vocal or backing track from the app.
- Search trusted synced lyrics through LRCLIB when artist/title are known.
- Use HeartTranscriptor only as a local fallback when no title is known.
- Generate a Codex-assisted pixel visual plan from artist/title, lyrics, song context, and local audio analysis.
- Drive the canvas animation locally from beat, bar, section, energy, onset, and lyric timing data.
- Record a vocal take against the backing track.
- Preview the mix and export a pixel lyric MV.

## Public Repo Scope

This repository intentionally contains only source code, docs, and lightweight configuration. It does not include:

- user audio files,
- generated stems,
- recorded takes,
- saved projects,
- LRCLIB or Wikipedia caches,
- local virtual environments,
- UVR / HeartTranscriptor model weights,
- Chrome debug profiles,
- runtime logs.

Those are ignored by `.gitignore`.

## Quick Start

On Windows, run:

```bat
start.bat
```

The app opens at:

```text
http://127.0.0.1:8787
```

`start.bat` creates `.venv` if needed and installs `requirements.txt`.

## Optional AI Components

Some features require local optional models or tools:

- UVR/audio-separator models for stem separation.
- HeartTranscriptor model files under `cache/hearttranscriptor/HeartTranscriptor-oss`.
- Local Codex CLI for visual plan generation.

Large models are not committed. Configure or install them locally before expecting those features to be available.

## Main Workflow

1. Drag an original song into Pixel OK.
2. Fill artist and title when possible.
3. Click one-click production.
4. The app prepares stems, lyrics/timing, audio analysis, and animation.
5. Use the unified stem player to switch between original, lead vocal, and backing.
6. Download the lead or backing track if needed.
7. Record a vocal take, preview the mix, and export the MV.

## Developer Notes

- Flask serves the app from `app.py`.
- Frontend code lives in `static/`.
- Audio processing helpers live in `tuner/`.
- VJ behavior and agent rules are documented in `AGENTS.md` and `docs/VJ_SPEC.md`.

Before committing changes, run:

```powershell
node --check static\app.js
.venv\Scripts\python.exe -m py_compile app.py tuner\lyrics_resolver.py tuner\lyrics_timing.py tuner\processor.py tuner\uvr_runner.py tuner\heart_transcriber.py
```
