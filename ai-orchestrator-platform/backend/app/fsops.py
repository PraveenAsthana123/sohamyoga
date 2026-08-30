"""Real filesystem workspace surface for the desktop-workspace pass: project
search, doc/PDF viewing, and code-editor read/write — all scoped to an
explicit allow-list of project roots (config.KNOWN_PROJECTS' root_dir
values), mirroring the safety discipline already proven in
agentic-ollama-platform/agents/file_write.py's ALLOWED_WRITE_ROOTS:

  1. Every root is resolved to its real absolute path once, at import time.
  2. Every incoming path is joined onto its claimed root and re-resolved,
     THEN checked to still be inside that root with Path.relative_to() —
     this is what actually catches "../../etc/passwd" style traversal and
     symlink escapes, not string prefix-matching (which is spoofable).
  3. Anything that fails that check is rejected with a clear 400, never a
     silent "not found" and never fabricated content.

This module is read/write for the filesystem itself; it does not touch the
Ollama/OpenAI/Claude call path at all (that stays in providers.py/router.py).
"""
import mimetypes
import os
import time
from pathlib import Path
from typing import Optional

from . import config

_ROOTS: dict[str, Path] = {}
for _p in config.KNOWN_PROJECTS:
    if _p.get("root_dir"):
        rp = Path(_p["root_dir"])
        if rp.is_dir():
            _ROOTS[_p["key"]] = rp.resolve()
        # A root_dir that doesn't exist on this machine is silently excluded
        # from the *usable* set here, but still reported by list_roots() below
        # with exists=False — honest about what's actually servable right now.


class FsError(Exception):
    """Raised for any rejected filesystem operation. .status carries the
    HTTP status the API layer should use (400 for bad input / traversal,
    404 for genuinely missing files, 413 for too-large)."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def list_roots():
    out = []
    for p in config.KNOWN_PROJECTS:
        root_dir = p.get("root_dir")
        entry = {"key": p["key"], "name": p["name"], "root_dir": root_dir, "exists": False}
        if root_dir:
            entry["exists"] = p["key"] in _ROOTS
        out.append(entry)
    return out


def _resolve(root_key: str, rel_path: str) -> Path:
    """The one real security boundary in this module. Returns a verified
    in-bounds absolute Path or raises FsError — never returns a path outside
    an allow-listed root, however the input tries to get there."""
    if root_key not in _ROOTS:
        raise FsError(
            f"unknown or unavailable root '{root_key}' — allowed roots: {sorted(_ROOTS.keys())}",
            status=400,
        )
    root = _ROOTS[root_key]
    rel_path = rel_path or "."
    # Reject absolute-looking input outright rather than letting os.path
    # silently reinterpret it — an absolute path joined with "/" in Python
    # replaces the base entirely, which is itself a traversal vector.
    if os.path.isabs(rel_path):
        raise FsError(f"rejected: '{rel_path}' is an absolute path, only paths relative to the root are accepted", status=400)
    candidate = (root / rel_path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        raise FsError(
            f"rejected: '{rel_path}' resolves outside allow-listed root '{root_key}' ({root}) — path traversal blocked",
            status=400,
        )
    return candidate


def _is_skippable_dir(name: str) -> bool:
    return name in config.FS_SKIP_DIRS or (name.startswith(".") and name not in {".env"})


def list_dir(root_key: str, rel_path: str = "."):
    target = _resolve(root_key, rel_path)
    if not target.exists():
        raise FsError(f"'{rel_path}' not found under root '{root_key}'", status=404)
    if not target.is_dir():
        raise FsError(f"'{rel_path}' is not a directory", status=400)
    root = _ROOTS[root_key]
    entries = []
    try:
        for child in sorted(target.iterdir(), key=lambda c: (not c.is_dir(), c.name.lower())):
            if child.is_dir() and _is_skippable_dir(child.name):
                continue
            try:
                st = child.stat()
            except OSError:
                continue
            entries.append({
                "name": child.name,
                "rel_path": str(child.relative_to(root)),
                "is_dir": child.is_dir(),
                "size": st.st_size if not child.is_dir() else None,
                "mtime": st.st_mtime,
            })
    except PermissionError as e:
        raise FsError(f"permission denied reading '{rel_path}': {e}", status=400)
    return {"root": root_key, "path": str(target.relative_to(root)) if target != root else "", "entries": entries}


def search(root_key: str, query: str, content: bool = False, limit: Optional[int] = None):
    """Filename substring search (always) plus optional content grep.
    Bounded by config.FS_MAX_FILES_SCANNED / FS_MAX_CONTENT_SCAN_SECONDS so a
    huge tree degrades to an honestly-labeled partial result instead of
    hanging the request."""
    root = _ROOTS.get(root_key)
    if root is None:
        raise FsError(f"unknown or unavailable root '{root_key}' — allowed roots: {sorted(_ROOTS.keys())}", status=400)
    if not query or not query.strip():
        raise FsError("query must not be empty", status=400)
    q = query.strip().lower()
    limit = min(limit or config.FS_MAX_SEARCH_RESULTS, config.FS_MAX_SEARCH_RESULTS)

    name_matches = []
    content_matches = []
    files_scanned = 0
    truncated_by_scan_cap = False
    truncated_by_time = False
    t0 = time.monotonic()

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not _is_skippable_dir(d)]
        if time.monotonic() - t0 > config.FS_MAX_CONTENT_SCAN_SECONDS:
            truncated_by_time = True
            break
        for fname in filenames:
            if files_scanned >= config.FS_MAX_FILES_SCANNED:
                truncated_by_scan_cap = True
                break
            files_scanned += 1
            fpath = Path(dirpath) / fname
            rel = str(fpath.relative_to(root))

            if q in fname.lower():
                if len(name_matches) < limit:
                    try:
                        st = fpath.stat()
                        name_matches.append({
                            "rel_path": rel, "name": fname, "size": st.st_size, "mtime": st.st_mtime,
                        })
                    except OSError:
                        pass

            if content and len(content_matches) < limit:
                try:
                    st = fpath.stat()
                except OSError:
                    continue
                ext = fpath.suffix.lower()
                if st.st_size > config.FS_MAX_CONTENT_GREP_FILE_BYTES:
                    continue
                if ext and ext not in config.FS_TEXT_EXTENSIONS:
                    continue
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as fh:
                        for lineno, line in enumerate(fh, start=1):
                            if q in line.lower():
                                content_matches.append({
                                    "rel_path": rel, "line": lineno, "snippet": line.strip()[:300],
                                })
                                if len(content_matches) >= limit:
                                    break
                except OSError:
                    continue
        if truncated_by_scan_cap:
            break

    return {
        "root": root_key,
        "query": query,
        "content_search": content,
        "files_scanned": files_scanned,
        "name_matches": name_matches,
        "content_matches": content_matches if content else None,
        "truncated": truncated_by_scan_cap or truncated_by_time,
        "truncated_reason": (
            "file-scan cap reached" if truncated_by_scan_cap else
            "time budget exceeded" if truncated_by_time else None
        ),
    }


def read_text(root_key: str, rel_path: str):
    target = _resolve(root_key, rel_path)
    if not target.exists():
        raise FsError(f"'{rel_path}' not found under root '{root_key}'", status=404)
    if target.is_dir():
        raise FsError(f"'{rel_path}' is a directory, not a file", status=400)
    st = target.stat()
    if st.st_size > config.FS_MAX_TEXT_READ_BYTES:
        raise FsError(
            f"'{rel_path}' is {st.st_size} bytes, over the {config.FS_MAX_TEXT_READ_BYTES}-byte text-read cap "
            f"— use /fs/raw for binary/large-file passthrough instead",
            status=413,
        )
    try:
        content = target.read_text(encoding="utf-8")
        encoding = "utf-8"
    except UnicodeDecodeError:
        content = target.read_text(encoding="utf-8", errors="replace")
        encoding = "utf-8 (lossy — file is not valid UTF-8)"
    return {
        "root": root_key, "rel_path": rel_path, "content": content,
        "encoding": encoding, "size": st.st_size, "mtime": st.st_mtime,
    }


def read_raw_path(root_key: str, rel_path: str):
    """Returns (absolute_path, media_type) for binary passthrough (PDFs,
    images, etc) — the API layer streams it via FastAPI's FileResponse."""
    target = _resolve(root_key, rel_path)
    if not target.exists():
        raise FsError(f"'{rel_path}' not found under root '{root_key}'", status=404)
    if target.is_dir():
        raise FsError(f"'{rel_path}' is a directory, not a file", status=400)
    media_type, _ = mimetypes.guess_type(str(target))
    return target, (media_type or "application/octet-stream")


def write_text(root_key: str, rel_path: str, content: str):
    target = _resolve(root_key, rel_path)
    if target.is_dir():
        raise FsError(f"'{rel_path}' is a directory, cannot write", status=400)
    byte_len = len(content.encode("utf-8"))
    if byte_len > config.FS_MAX_WRITE_BYTES:
        raise FsError(f"refusing to write {byte_len} bytes, over the {config.FS_MAX_WRITE_BYTES}-byte cap", status=413)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    # Verify against disk, never just trust the write call succeeded.
    st = target.stat()
    on_disk = target.read_text(encoding="utf-8")
    verified = (on_disk == content) and (st.st_size == byte_len)
    return {
        "root": root_key, "rel_path": rel_path, "bytes_written": st.st_size,
        "verified": verified, "mtime": st.st_mtime, "written_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
