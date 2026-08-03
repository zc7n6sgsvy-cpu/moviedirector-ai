# Directing OS — Additive Roadmap (post this ship)

## Shipped in this pass

1. **Grok Imagine Video 1.5** default (`XAI_VIDEO_MODEL` override still works)
2. **Multi-ref video** up to 7 images + preset **voice ids** (face+voice lock path)
3. **Character packs v2** — visual refs + voice profile + TTS preset
4. **Director’s Mark** — studio signature insert as shot #1
5. **Location library** fields — layout + style notes for procedural set reuse
6. **Calibration Engine** — free structural sequence scan + timeline flags + fix brief
7. **Next-shot continuity** — prior frame + cast/set plates in scene refs

## Next concrete steps (priority order)

### A. Platform assemble + review (high)
- Worker path: stitch shot videos in order → temp MP4 on Blob
- Timeline **Review cut** player with jump-to-shot
- Export only after user confirms review

### B. Calibration vision pass (medium)
- Paid step: sample frames via `analyzeImage` for lighting/face drift
- Generate 1–2 fix stills via image-edit; user picks insert

### C. Story insertion assistant (medium)
- Expand-scene already exists; add “Insert beat after #N” + optional enhance chips
- Accept / ignore enhancement suggestions

### D. Full custom voice samples (blocked / partner)
- xAI public API: preset `voice_id` only for video `reference_audios`
- Keep `voiceSampleUrl` as director craft note until partner audio unlocks

### E. Location hierarchy (medium)
- parentLocationId town → building → room tree UI
- Auto-suggest location when description mentions saved place names

## Architecture rules
- Additive only — no rewrite of app shell
- Free path: plan + social + structural calibration
- Paid path: pixels (1.5 video, vision calibration, assemble)
