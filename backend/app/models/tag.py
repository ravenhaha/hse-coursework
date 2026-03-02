from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base

class Tag(Base):
    __tablename__="tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(100))