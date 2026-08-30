"""Central config for the orchestrator backend. Every value is env-overridable;
sane local defaults match what's actually running on this machine today."""
import os

BACKEND_HOST = os.environ.get("ORCH_BACKEND_HOST", "127.0.0.1")
BACKEND_PORT = int(os.environ.get("ORCH_BACKEND_PORT", "8100"))
FRONTEND_ORIGIN_DEFAULTS = [
    "http://localhost:8101",
    "http://127.0.0.1:8101",
]
FRONTEND_ORIGINS = os.environ.get("ORCH_FRONTEND_ORIGINS", ",".join(FRONTEND_ORIGIN_DEFAULTS)).split(",")

# The already-running agentic-ollama-platform this project extends (never
# duplicates) — its agents/, app/db.py, app/ollama_client.py.
OLLAMA_PLATFORM_ROOT = os.environ.get(
    "OLLAMA_PLATFORM_ROOT",
    os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "agentic-ollama-platform")),
)

OPENBAO_ADDR = os.environ.get("OPENBAO_ADDR", "http://127.0.0.1:18200")
OPENBAO_ROOT_TOKEN = os.environ.get("OPENBAO_ROOT_TOKEN", "")

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")

DB_PATH = os.environ.get(
    "ORCH_DB_PATH",
    os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "orchestrator.db")),
)

# Known real projects on this machine at build time. Extensible — a project
# string not in this list is still accepted and stored (see db.py); this is
# just what the UI shows as suggestions.
#
# root_dir ties a project tag to a real directory on disk (Filesystem
# workspace scope, added in the desktop-workspace pass). None = no
# filesystem workspace for that project tag (e.g. "general"). These are also
# the ONLY roots the filesystem endpoints (app/fsops.py) will ever serve —
# default-deny everything else, same discipline as
# agentic-ollama-platform/agents/file_write.py's ALLOWED_WRITE_ROOTS.
KNOWN_PROJECTS = [
    {"key": "general", "name": "General / unscoped", "root_dir": None},
    {"key": "sohamyoga-frontend", "name": "SohamYoga Frontend",
     "root_dir": "/mnt/deepa/sohamyoga/sohamyoga-frontend"},
    {"key": "voice-agent-platform", "name": "Voice Agent Platform",
     "root_dir": "/mnt/deepa/sohamyoga/voice-agent-platform"},
    {"key": "agentic-ollama-platform", "name": "Agentic Ollama Platform",
     "root_dir": "/mnt/deepa/sohamyoga/agentic-ollama-platform"},
    {"key": "ai-orchestrator-platform", "name": "AI Orchestrator Platform (this app)",
     "root_dir": "/mnt/deepa/sohamyoga/ai-orchestrator-platform"},
    {"key": "epilepsy-portal", "name": "Epilepsy Portal (research)",
     "root_dir": "/media/praveen/Asthana4/ upgrad/epilepsy-portal"},
]

# Directory names to always skip while walking a root for search/listing —
# huge, irrelevant, or generated trees that would otherwise dominate results
# and blow up scan time.
FS_SKIP_DIRS = {
    "node_modules", ".git", "venv", ".venv", "__pycache__", "dist", "build",
    ".next", "target", ".cache", ".turbo", "coverage", ".pytest_cache",
    "test-results", ".history",
}

# Search/scan bounds — honest limits, not silently-truncated-and-unlabeled.
FS_MAX_SEARCH_RESULTS = 200
FS_MAX_FILES_SCANNED = 20000
FS_MAX_CONTENT_SCAN_SECONDS = 6.0
FS_MAX_TEXT_READ_BYTES = 3 * 1024 * 1024  # 3 MB cap for /fs/read (editor/markdown)
FS_MAX_CONTENT_GREP_FILE_BYTES = 2 * 1024 * 1024  # skip grepping inside files bigger than this
FS_MAX_WRITE_BYTES = 5 * 1024 * 1024  # 5 MB cap for editor saves

# Extensions treated as text for /fs/read (editor + markdown viewer). Anything
# else falls back to /fs/raw (binary passthrough — PDFs, images, etc).
FS_TEXT_EXTENSIONS = {
    ".md", ".markdown", ".txt", ".py", ".ts", ".tsx", ".js", ".jsx", ".mjs",
    ".cjs", ".json", ".jsonl", ".yml", ".yaml", ".toml", ".ini", ".cfg",
    ".sh", ".bash", ".zsh", ".env", ".css", ".scss", ".html", ".htm",
    ".sql", ".xml", ".csv", ".txt", ".gitignore", ".dockerfile", ".rst",
    ".conf", ".log", ".tex", ".vue", ".svelte", ".go", ".rs", ".java",
    ".c", ".h", ".cpp", ".hpp", ".rb", ".php",
}
