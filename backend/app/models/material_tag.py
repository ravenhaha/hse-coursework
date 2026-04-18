from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from db.base import Base


class MaterialTag(Base):
    """Связующая таблица Material ↔ Tag (M:N)."""
    __tablename__ = "material_tags"

    material_id: Mapped[int] = mapped_column(
        ForeignKey("materials.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[int] = mapped_column(
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    )


# Алиас для Core-стиля запросов (material_tags.c.material_id)
material_tags = MaterialTag.__table__