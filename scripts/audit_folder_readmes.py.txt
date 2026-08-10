<!-- agent-py-sidecar: auto-generated; do not delete this line to allow refresh -->
# scripts/audit_folder_readmes.py
# auto-generated explainer · 2026-06-28T10:00:07Z

## Purpose
§58 + §63 audit · verify every ai-agents/<tool>/ has README + DEEP_DIVE + install.sh.

Per global §58 (folder-README standard) + §63 (two-file convention).

Walks ai-agents/<tool>/ (skipping _shared/). For each tool, verifies:
- README.md present + ≥ 200 bytes
- deep/docs/DEEP_DIVE.md present + ≥ 500 bytes (substantive)
- deep/scripts/install.sh present + executable
- §-references present in DEEP_DIVE.md (≥ 3 §-cites)

Reports per-tool pass/fail + grand summary. Exit 1 if any tool is incomplete.

## Imports
- from `_` import os
- from `_` import re
- from `_` import sys
- from `pathlib` import Path

## Inputs
(no CLI / env inputs — library module or implicit)

## Process
### Functions
- `audit_tool(tool_dir)`: Audit one tool folder. Returns {readme, deep_dive, install, sec_refs, pass}.
- `main()`: (no docstring)

## Outputs
- Return values from functions above

## Notable inline comments
- Files/dirs to skip
- Count § references in deep dive
