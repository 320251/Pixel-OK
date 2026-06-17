---
name: local-vj-director
description: Use when modifying Pixel OK local VJ behavior, including timestamped lyrics, LRCLIB/ASR lyric trust, audio analysis, waveformProfile, visual plans, Codex exec prompts, pixel sprites, beat/bar/section-driven rendering, preview, recording, or export. Enforces deterministic, readable, rhythm-driven visuals instead of random music visualizers or song-specific hard-coded templates.
---

# Local VJ Director

## Mission

Keep Pixel OK's animation chain deterministic, readable, rhythm-driven, and song-specific. The app is a local VJ engine: Codex exec is a director that proposes art direction and pixel sprites, while the browser renderer maps audio analysis to motion.

## Non-Negotiables

- Never use random waveform/equalizer/rectangle/particle filler as the main visual idea.
- Never silently accept ASR gibberish as final lyrics when artist/title are known. Prefer trusted synced lyrics or user-corrected text; ASR is alignment help or no-title fallback.
- Never hard-code one song's motifs into generic code. Use metadata/context to decide subjects per song.
- Do not render readable words inside clip artwork. Pixel OK title, song title, and lyrics are rendered by the app.
- Keep one current lyric group readable. Do not add "next lyric" text unless requested.
- Save `waveformProfile`, `visualPlan`, and signatures so a project can be reloaded without losing animation state.

## Data Contract

Use this chain when adding or fixing features:

1. `identity`: artist, title, original filename, duration.
2. `lyrics`: trusted text plus line timestamps.
3. `analysis`: local audio profile with `bins`, `peaks`, `bpm`, `beatTimes`, `barTimes`, `energyCurve`, `onsetCurve`, and `sections`.
4. `artDirection`: Codex exec JSON containing theme, palette, scene intent, sprites, placements, and rhythm trigger intent.
5. `runtime`: canvas renderer driven by beat/bar/section/energy/onset data.
6. `state`: persist lyrics, cues, waveform profile, visual plan, and plan key.

## Runtime Rules

- Beats create small pose snaps, sprite scale pulses, and lyric entrance flashes.
- Bars create larger camera pushes, floor/tile glow, and section transitions.
- Peaks/onsets create brief flashes or prop highlights.
- Sections shape density and color pressure: quieter intro/verse, brighter chorus, decaying outro.
- The waveform controls visible artwork. Do not draw the waveform as the artwork.

## Codex Exec Prompt Rules

When editing `/api/visual-plan` or prompt text, keep this boundary clear:

- Codex may research artist/title and transform context into drawable subjects, props, costumes, settings, palettes, and pixel sprites.
- Codex must output concrete sprites and placements, not abstract visualizer vocabulary.
- Codex must not quote lyrics.
- Codex must not invent factual MV details unless supported by metadata/context or user-provided notes.
- The frontend renderer decides how beat/bar/section data animates those sprites.

## Verification

Run these checks before returning VJ or lyric changes:

```powershell
node --check static\app.js
.venv\Scripts\python.exe -m py_compile app.py tuner\lyrics_resolver.py tuner\lyrics_timing.py
```

Also verify that a known artist/title search still returns trusted lyrics and that the preview canvas is not blank when a saved plan is loaded.
