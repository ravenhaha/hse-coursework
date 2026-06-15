"""Схемы для построения дерева материалов (графовая визуализация)."""

from __future__ import annotations

from pydantic import BaseModel


class GraphNode(BaseModel):
    """Узел дерева — коллекция (folder) или материал (document)."""

    id: str
    name: str
    type: str
    tags: list[str] | None = None
    content: str | None = None
    children: list["GraphNode"] | None = None


# Алиас для роута /graph/tree. Отдельный класс на случай,
# когда понадобится добавить мета-поля
class GraphTreeResponse(GraphNode):
    pass


GraphNode.model_rebuild()
