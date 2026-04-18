from datetime import datetime
from pydantic import BaseModel, Field


class MaterialCreateText(BaseModel):
    collection_id: int
    material_name: str = Field(min_length=1, max_length=100)
    text_content: str = Field(min_length=1)


class MaterialUpdate(BaseModel):
    material_name: str | None = Field(None, min_length=1, max_length=100)
    text_content: str | None = Field(None, min_length=1)
    collection_id: int | None = None
    is_important: bool | None = None


class MaterialRead(BaseModel):
    id: int
    collection_id: int
    material_name: str
    source_type: str
    text_content: str | None = None
    file_path: str | None = None
    is_important: bool
    created_at: datetime
    updated_at: datetime | None = None        # ← для отображения "изменено"

    model_config = {"from_attributes": True}