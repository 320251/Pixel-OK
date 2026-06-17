# Pixel OK VJ Spec

This spec keeps the animation chain general enough for any song while preventing random visualizer output.

## Pipeline

1. `identity`: artist, title, original file name, duration.
2. `lyrics`: trusted timestamped lyrics when available. User-corrected text is allowed. ASR is only a fallback when no title is known.
3. `analysis`: deterministic local audio profile:
   - `bins`: normalized energy over time.
   - `peaks`: high-energy moments.
   - `bpm`: estimated tempo.
   - `beatTimes`: beat grid in seconds.
   - `barTimes`: every fourth beat.
   - `energyCurve`: sampled energy points.
   - `onsetCurve`: positive energy changes.
   - `sections`: coarse intro/verse/chorus/bridge/outro style labels from energy and duration.
4. `artDirection`: Codex exec output. It chooses theme, palette, subject strategy, sprites, placements, scene intent, and rough scene timing.
5. `runtime`: browser canvas renderer. It maps beat/bar/section/energy/onset to sprite scale, flashes, camera pushes, floor glow, and scene cuts.
6. `project state`: save `lyrics`, `lyricCues`, `waveformProfile`, `visualPlan`, and `visualPlanKey`.

## Rhythm Mapping

- Beats trigger small pose snaps, sprite scale changes, and lyric entrance flashes.
- Bars trigger larger camera pushes, background tile pulses, and stronger lighting changes.
- Peaks/onsets trigger short white/color flashes or prop highlights.
- Sections influence density and palette pressure: intro quieter, chorus brighter, outro decays.
- Do not draw the waveform itself as the animation. The waveform controls the animation.

## Codex Exec Boundary

Codex exec may research and decide "what should be on screen." It must not be treated as the audio engine. It should output:

- song-specific subjects and props,
- pixel sprites using rows and colors,
- sprite placements,
- scene intent,
- rhythm trigger intent.

The frontend turns those into motion using the local `waveformProfile`.
