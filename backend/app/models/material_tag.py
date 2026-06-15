"""Association-таблица для связи материалов и тегов (many-to-many).

Используется через secondary="material_tags" в Material.tags и Tag.materials.
Отдельный класс MaterialTag нужен, чтобы SQLAlchemy корректно построил
таблицу с правильными каскадами; объект material_tags = MaterialTag.__table__
предоставляется для использования в secondary= (там ожидается Table, не модель).
"""

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MaterialTag(Base):
    __tablename__ = "material_tags"

    material_id: Mapped[int] = mapped_column(
        ForeignKey("materials.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[int] = mapped_column(
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )


material_tags = MaterialTag.__table__