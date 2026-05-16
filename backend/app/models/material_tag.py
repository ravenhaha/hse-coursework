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
    )


material_tags = MaterialTag.__table__