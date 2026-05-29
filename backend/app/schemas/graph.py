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


# Алиас для роута /graph/tree. Сохраняем отдельный класс на случай,
# когда понадобится добавить мета-поля (generated_at, total_nodes
# и т. д.) — это будет не breaking change для клиента.
class GraphTreeResponse(GraphNode):
    pass


GraphNode.model_rebuild()