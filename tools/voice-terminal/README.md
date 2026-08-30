# Voice Terminal

Local speech-to-text command entry for Codex and Claude Code. Audio is recorded to a temporary WAV, transcribed locally with faster-whisper, deleted, displayed, and explicitly confirmed before it is passed as one argument to the selected agent. Recognized speech is never evaluated by a shell.

Run `./setup.sh`, then use `voice-terminal --agent codex` or `voice-terminal --agent claude`. Add `--one-shot --speak-response` for a single response read by local espeak-ng. The first transcription downloads the selected open-source Whisper model; `tiny.en` is the default. Audit records contain only a transcript hash and character count, not transcript text or audio.

The desktop application menu also gets **Voice Terminal — Codex** with a microphone icon. Voice commands retain the normal Codex/Claude permission model; this tool never adds bypass or auto-approval flags.
