"""Schemas for WebLLM + CDP + RAG + LangGraph agent."""
from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field


class AgentGoalRequest(BaseModel):
    goal: str = Field(..., min_length=1, max_length=2000)
    url: str = Field(..., min_length=8, max_length=2000)
    tenant_id: Optional[str] = None
    correlation_id: Optional[str] = None


class AgentRunResponse(BaseModel):
    request_id: str
    recommendation: str
    audit_log: list[dict[str, Any]]
    citations: list[str] = []
    hitl_required: bool = False
    completed: bool


class WebLLMPromptIn(BaseModel):
    type: str = "prompt"
    req_id: str
    text: str
    max_tokens: int = 512


class WebLLMResponseIn(BaseModel):
    type: str = "response"
    req_id: str
    text: str
