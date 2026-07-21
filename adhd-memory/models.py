"""
Pydantic models for API request/response schemas.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class RememberRequest(BaseModel):
    project: str
    content: str
    cues: List[str]
    event_data: Dict[str, Any] = Field(default_factory=dict)


class RecallRequest(BaseModel):
    project: str
    cue: str
    query_text: Optional[str] = None
    query_embedding: Optional[List[float]] = None


class FocusRequest(BaseModel):
    project: str
    topic: str


class ForgetRequest(BaseModel):
    memory_id: str


class MemoryResponse(BaseModel):
    id: str
    content: str
    salience: float
    decay_score: float
    cues: List[str]
    status: str
    snarc: Dict[str, float] = Field(default_factory=dict)
    hit_count: int = 0
    stability: float = 1.0
