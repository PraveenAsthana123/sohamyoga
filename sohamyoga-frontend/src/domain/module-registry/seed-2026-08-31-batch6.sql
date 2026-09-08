UPDATE module_registry SET
  built_status = 'partial',
  process_desc = 'Real audio post-processing added: EBU R128 loudness normalization (loudnorm I=-16 TP=-1.5 LRA=11) plus 0.3s fade-in/out on the TTS track, applied via ffmpeg -af/filter_complex before mux. Verified live: rendered output measured mean -18dB / max -0.9dB (near the -1.5dB true-peak target), confirming real, audible, correctly-processed speech, not a pass-through.',
  missing_items = 'Still no multi-track mixing, background music, or noise removal -- this is single-track TTS loudness/fade processing, not a full audio editor.',
  source_doc = 'chat session 2026-08-31 fix -- real loudnorm+fade added to VideoRenderer.ts, live-verified via volumedetect',
  last_verified_at = now()
WHERE app='sohamyoga-frontend' AND module_key='audio-editing';

UPDATE module_registry SET
  built_status = 'partial',
  missing_items = 'Still no multi-clip concatenation, trim, or transition capability -- render is single-script-to-video. Fixed a real self-introduced bug while adding audio processing: -shortest failed to terminate against the infinite lavfi colour source once loudnorm''s internal buffering was in the filter chain (a render ran to 20+ minutes instead of ~6 seconds before failing) -- replaced with an explicit -t duration cap from the real probed WAV length, verified live (1.5s render, correct 4.1s output duration).',
  source_doc = 'chat session 2026-08-31 -- confirmed still not_built for editing; found+fixed a real runaway-render bug introduced while working on audio',
  last_verified_at = now()
WHERE app='sohamyoga-frontend' AND module_key='video-editing';
