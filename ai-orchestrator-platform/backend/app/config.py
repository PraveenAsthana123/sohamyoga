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

APP_NAME = os.environ.get("ORCH_APP_NAME", "praveenchatbot")

# Required once this app is reachable over the internet via the Cloudflare
# tunnel -- gates every route except /auth/login and /auth/status (see
# app/auth.py). No safe default: an empty/missing password would mean the
# tunnel URL alone (a guessable-format trycloudflare.com subdomain) is the
# only thing standing between the internet and every local model this app
# can call, so the app refuses to start rather than run open.
AUTH_PASSWORD = os.environ.get("ORCH_AUTH_PASSWORD", "")

# 127.0.0.1:11434 is the older/smaller Ollama instance (10 models); 11435 is
# the full-catalog instance (39 models, including glm4) pointed at the real
# model store on the deepa drive — see decision log 2026-09-02. Defaulting to
# 11435 here so this app sees the full catalog; 11434 is left running
# untouched in case something else still depends on it.
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11435")
LOCALAI_URL = os.environ.get("LOCALAI_URL", "http://127.0.0.1:8081")
LLAMACPP_URL = os.environ.get("LLAMACPP_URL", "http://127.0.0.1:8082")
LMSTUDIO_URL = os.environ.get("LMSTUDIO_URL", "http://127.0.0.1:8083")

# llama.cpp is CPU-only here (no CUDA toolkit installed -- see decision log
# 2026-09-03), so this is genuinely slow, but it no longer has to be stuck on
# ONE model: each entry is its own llama-server process on its own port
# (llama-server itself can only ever serve one model per process -- there's
# no multi-model routing within a single instance the way Ollama has).
# Second instance added 2026-09-03 so llama.cpp has real model choice instead
# of being locked to the coder model; not managed by systemd yet (matches how
# the first instance was already running), so it won't survive a reboot.
LLAMACPP_EXTRA_URL = os.environ.get("LLAMACPP_EXTRA_URL", "http://127.0.0.1:8084")

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
    {"key": "ai-architecture-book", "name": "AI Architecture Book",
     "root_dir": "/mnt/deepa/AI/books/ai-architecture-book"},
    {"key": "ai-platform-code", "name": "AI Platform (code)",
     "root_dir": "/mnt/deepa/AI/projects/ai-platform"},
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

# Chat attachments (desktop file upload / clipboard paste) -- separate from
# the fs/* tree above, which only ever serves files already inside a known
# project root. Attachments come from OUTSIDE this app's known roots (the
# user's own desktop), so they get their own storage dir and their own caps.
ATTACHMENTS_DIR = os.environ.get(
    "ORCH_ATTACHMENTS_DIR",
    os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "attachments")),
)
ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024  # 20 MB per file
ATTACHMENT_MAX_TEXT_INLINE_BYTES = 200 * 1024  # cap on how much extracted text gets inlined into a prompt
ATTACHMENT_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}

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

# Selectable role/system-prompt presets ("agent personas"). Deliberately just
# a system-prompt swap, NOT a multi-step pipeline or separate agent process --
# clarified with the user this is what "personas" means here. Prepended to
# the prompt the same way _context_preamble already is (see main.py); "none"
# sends the raw message with no persona framing at all.
PERSONAS = {
    "none": None,
    "reviewer": (
        "You are a careful code/security reviewer. Read what's given for correctness, "
        "security issues, and edge cases. Be specific and cite exact lines/values. "
        "Say plainly when something looks fine -- don't invent problems to sound thorough."
    ),
    "researcher": (
        "You are a thorough researcher. Investigate the question in depth, note what's "
        "verified vs. uncertain, and flag gaps in your own knowledge rather than guessing. "
        "Prefer precise, sourced claims over confident-sounding generalities."
    ),
    "writer": (
        "You are a clear, concise technical writer. Prioritize plain language, short "
        "sentences, and correct structure (headings/lists/tables where they genuinely "
        "help). Cut filler -- say the thing once, well."
    ),
}
