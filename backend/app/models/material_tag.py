from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class MaterialTag(Base):
    __tablename__ = "material_tags"

    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)