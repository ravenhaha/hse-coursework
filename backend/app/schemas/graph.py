from __future__ import annotations

from pydantic import BaseModel


class GraphNode(BaseModel):
    id: str
    name: str
    type: str
    tags: list[str] | None = None
    content: str | None = None
    children: list["GraphNode"] | None = None


class GraphTreeResponse(GraphNode):
    pass
