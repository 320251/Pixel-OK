# Pixel OK Agent Rules

Pixel OK is a local singing and pixel-MV tool. Treat the app as a deterministic audio-reactive VJ engine, not a gallery of random visual effects.

## Core Contracts

- The user supplies an original song plus artist/title. One-click production should prepare stems, trusted lyrics/timing, an audio analysis profile, and a saved visual plan.
- Do not use ASR text as final lyrics when artist/title is known and a trusted lyrics provider can be queried. ASR may help alignment only; it must not silently replace official or user-corrected lyrics.
- `waveformProfile` must be saved with the project and should include energy bins, peaks, BPM, beat times, bar times, section labels, an energy curve, and an onset curve.
- Codex exec creates art direction, sprite descriptions, placements, and scene timing intent. The browser renderer owns rhythm mapping and must drive visible artwork from beat/bar/section/energy/onset data.
- Animation must preview in the in-app pixel screen and must not be blank. If a Codex plan fails, the fallback still needs a readable subject and beat-reactive movement.

## Visual Rules

- Use song-specific subjects derived from artist/title, lyrics, and factual context such as Wikipedia summaries or known MV/stage imagery.
- Do not hard-code a song template unless the metadata/context is actually that song.
- Avoid generic equalizers, waveform drawing, random rectangles, tunnels, grids, particles, and decorative filler as the main idea.
- The clip artwork must not contain readable words. Pixel OK title, song title, and lyrics are rendered separately by the app.
- Keep the current lyric readable and use only one lyric group. Do not render a "next line" prompt unless the user explicitly asks for it.

## Verification

Before handing back VJ or lyrics changes, run:

```powershell
node --check static\app.js
.venv\Scripts\python.exe -m py_compile app.py tuner\lyrics_resolver.py tuner\lyrics_timing.py
```

When possible, also verify that `/api/lyrics/search` still resolves a known artist/title and that the preview canvas is not blank after one-click production.
