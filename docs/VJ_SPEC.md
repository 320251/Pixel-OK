# Pixel OK VJ Spec v3

Pixel OK's VJ is not a waveform visualizer and not a sprite-acting cartoon. The target is:

**Key Visual + Reactive Lighting**

Each song gets a stable, recognizable pixel-art key visual: a cover-like frame, MV-inspired stage card, symbolic object, room, vehicle, skyline, performer silhouette, or story image. The music then drives lighting, camera pulse, flash, color shifts, lyric entrances, and scene changes.

## Pipeline

1. `identity`: artist, title, original filename, duration.
2. `lyrics`: trusted timestamped lyrics when available. User-corrected text is allowed. ASR is only fallback when no title is known.
3. `analysis`: deterministic local audio profile:
   - `bins`: normalized energy over time.
   - `peaks`: high-energy moments.
   - `bpm`: estimated tempo.
   - `beatTimes`: beat grid in seconds.
   - `barTimes`: every fourth beat.
   - `energyCurve`: sampled energy points.
   - `onsetCurve`: positive energy changes.
   - `sections`: coarse intro/verse/chorus/bridge/outro labels from energy and duration.
4. `visualPlan`: Codex exec output. It researches or infers this song's visual world and returns v3 key-visual scenes.
5. `runtime`: browser canvas renderer. It keeps the key visual readable and maps beat/bar/section/energy/onset to lighting, flash, floor glow, camera push, and small object pulses.
6. `project state`: save `lyrics`, `lyricCues`, `waveformProfile`, `visualPlan`, and `visualPlanKey`.

## V3 Plan Shape

Top level:

- `version`: `3`
- `vjMode`: `key-visual-reactive`
- `palette`: bright song palette.
- `paletteRoles`: `background`, `key`, `accent`, `flash`, `floor`, `lyric`.
- `brightness`: `base`, `chorusBoost`, `flash`, `backgroundLift`.
- `visualDNA`: song context, engine name, theme family, and rules.
- `scenes`: 3-5 scenes per minute where possible.

Each scene:

- `kind`: `key-visual`
- `composition`: `poster`, `stage-card`, `room-card`, `street-card`, `object-card`, `portrait-card`, or `world-card`.
- `keyVisual`: short structured description:
  - `subject`: one concrete main subject.
  - `setting`: specific place or frame.
  - `symbols`: concrete props/costume/location cues.
  - `foreground`, `midground`, `background`: what goes where.
  - `styleNotes`: pixel-art style and song/MV/era logic.
- `lighting`: how the beat affects the static art:
  - `base`: base color/contrast.
  - `beat`: small pulse.
  - `bar`: larger camera or floor pulse.
  - `peak`: flash or silhouette hit.
  - `quiet`: held/dim state.
  - `chorus`: brighter section behavior.

Legacy `clip` is still allowed for old saved plans, but v3 rendering must prioritize `keyVisual`.

## Banned Main Ideas

- No waveform/equalizer as the visual concept.
- No ribbon, ring, tunnel, vortex, random grid, random particles, or abstract audio graphics as the main idea.
- No drawing every lyric line as a literal object.
- No dark empty stage as the default.
- No rectangle-only compositions that require the user to guess what the picture is.
- No readable words inside the artwork. Pixel OK title, song title, and lyrics are rendered separately.

## Rhythm Mapping

- Beats trigger light flicker, subject glow, small scale pulse, or camera nudge.
- Bars trigger stronger floor pulse, color shift, or camera push.
- Peaks/onsets trigger short white/color flashes, silhouette hits, or prop highlights.
- Sections change brightness and density. Choruses should feel visibly brighter.
- Lyrics control subtitle timing and occasional entry flash, not object-by-object literal illustration.

## One-Click Rule

VJ generation must not require UVR stems. If only the original song is loaded, Pixel OK can still:

- search lyrics by artist/title,
- build waveform/rhythm from original audio,
- generate the v3 visual plan,
- preview the VJ.

UVR stems are needed for recording, ASR fallback, tuning, and stem export, not for making the visual.
