"""WebSocket bridge · backend ↔ browser WebLLM."""
from __future__ import annotations
import asyncio
import json
import logging
import uuid
from typing import Optional

logger = logging.getLogger(__name__)


class WebLLMBridge:
    """Browser WebLLM is the inference target · backend just orchestrates.

    Privacy benefit: no LLM call leaves the browser · ideal for PII-sensitive
    use cases. Per §76 privacy pillar.
    """

    def __init__(self):
        self.pending: dict[str, asyncio.Future] = {}
        self.ws = None

    async def connect(self, ws) -> None:
        await ws.accept()
        self.ws = ws

    async def prompt(self, text: str, max_tokens: int = 512, timeout: float = 30) -> str:
        if not self.ws:
            raise RuntimeError("WebLLM not connected · ensure browser tab open")
        req_id = str(uuid.uuid4())
        future = asyncio.get_event_loop().create_future()
        self.pending[req_id] = future
        await self.ws.send_text(json.dumps({
            "type": "prompt",
            "req_id": req_id,
            "text": text,
            "max_tokens": max_tokens,
        }))
        try:
            return await asyncio.wait_for(future, timeout=timeout)
        finally:
            self.pending.pop(req_id, None)

    async def receive_loop(self) -> None:
        while True:
            try:
                raw = await self.ws.receive_text()
            except Exception as e:
                logger.warning(f"WebLLM ws closed: {e}")
                return
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            if msg.get("type") == "response":
                req_id = msg.get("req_id")
                if req_id in self.pending:
                    self.pending[req_id].set_result(msg.get("text", ""))
