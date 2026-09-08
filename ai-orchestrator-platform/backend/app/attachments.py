"""Chat attachments: desktop file upload / clipboard paste, attached to a
message. Deliberately separate from app/fsops.py, which only ever serves
files already inside a known project root -- an attachment comes from
OUTSIDE those roots (the user's own machine), so it gets its own storage
dir under data/attachments/ and is never treated as part of a project tree.

Three real, honest behaviors, no fabrication:
  - Text-like files (by extension, same allow-list fsops uses for /fs/read)
    get their content read and returned so it can be inlined into the
    prompt -- capped at ATTACHMENT_MAX_TEXT_INLINE_BYTES.
  - .docx/.pdf get REAL extraction via python-docx/pypdf (added 2026-09-03) --
    not a guess, an actual parse. If extraction raises (corrupt file,
    password-protected PDF, etc.) that failure is reported as a note, never
    silently swallowed into "not extracted".
  - Images get base64-encoded so a vision-capable model can actually see
    them (see providers.py's image support in _call_openai_compatible).
  - Anything else is stored and served back by URL, but its content is NOT
    extracted -- no fragile guessing parser. The caller is told this
    plainly, not left to assume.
"""
import mimetypes
import os
import uuid
from pathlib import Path

from . import config, db

os.makedirs(config.ATTACHMENTS_DIR, exist_ok=True)

DOCX_EXTENSIONS = {".docx"}
PDF_EXTENSIONS = {".pdf"}


def _extract_docx(path: str) -> str:
    import docx  # python-docx
    d = docx.Document(path)
    parts = [p.text for p in d.paragraphs]
    for table in d.tables:
        for row in table.rows:
            parts.append(" | ".join(cell.text for cell in row.cells))
    return "\n".join(parts)


def _extract_pdf(path: str) -> str:
    from pypdf import PdfReader
    reader = PdfReader(path)
    return "\n\n".join((page.extract_text() or "") for page in reader.pages)


class AttachmentError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def save_upload(filename: str, content: bytes) -> dict:
    if len(content) > config.ATTACHMENT_MAX_BYTES:
        raise AttachmentError(413, f"file too large ({len(content)} bytes, max {config.ATTACHMENT_MAX_BYTES})")

    safe_name = os.path.basename(filename or "upload")
    ext = Path(safe_name).suffix.lower()
    stored_name = f"{uuid.uuid4().hex}{ext}"
    stored_path = os.path.join(config.ATTACHMENTS_DIR, stored_name)
    with open(stored_path, "wb") as f:
        f.write(content)

    mime_type = mimetypes.guess_type(safe_name)[0] or "application/octet-stream"
    is_image = ext in config.ATTACHMENT_IMAGE_EXTENSIONS
    is_text = ext in config.FS_TEXT_EXTENSIONS
    is_docx = ext in DOCX_EXTENSIONS
    is_pdf = ext in PDF_EXTENSIONS

    extracted_text = None
    extraction_note = None
    if is_text:
        try:
            text = content[:config.ATTACHMENT_MAX_TEXT_INLINE_BYTES].decode("utf-8", errors="replace")
            extracted_text = text
            if len(content) > config.ATTACHMENT_MAX_TEXT_INLINE_BYTES:
                extraction_note = f"truncated to {config.ATTACHMENT_MAX_TEXT_INLINE_BYTES} bytes of {len(content)}"
        except Exception as e:
            extraction_note = f"text decode failed: {e}"
    elif is_docx or is_pdf:
        try:
            text = _extract_docx(stored_path) if is_docx else _extract_pdf(stored_path)
            extracted_text = text[:config.ATTACHMENT_MAX_TEXT_INLINE_BYTES]
            is_text = True  # so it's treated as inlineable text downstream
            if len(text) > config.ATTACHMENT_MAX_TEXT_INLINE_BYTES:
                extraction_note = f"truncated to {config.ATTACHMENT_MAX_TEXT_INLINE_BYTES} chars of {len(text)} extracted"
            elif not text.strip():
                extraction_note = "extracted but empty -- likely a scanned/image-only PDF or blank document"
        except Exception as e:
            extraction_note = f"{'docx' if is_docx else 'pdf'} extraction failed: {e}"
    elif is_image:
        extraction_note = "image -- sent to the model directly if it supports vision, not text-extracted"
    else:
        extraction_note = "not a recognized text/image/docx/pdf type -- stored, but content was not extracted"

    return db.create_attachment(
        filename=safe_name, mime_type=mime_type, size=len(content),
        stored_path=stored_path, is_image=is_image, is_text=is_text,
        extracted_text=extracted_text, extraction_note=extraction_note,
    )


def get_attachment(attachment_id: int) -> dict:
    row = db.get_attachment(attachment_id)
    if not row:
        raise AttachmentError(404, f"attachment {attachment_id} not found")
    return row


def read_bytes(attachment_id: int) -> bytes:
    row = get_attachment(attachment_id)
    with open(row["stored_path"], "rb") as f:
        return f.read()
