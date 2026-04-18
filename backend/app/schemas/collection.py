from datetime import datetime
from pydantic import BaseModel, Field


class CollectionCreate(BaseModel):
    collection_name: str = Field(min_length=1, max_length=500)
    parent_id: int | None = None


class CollectionUpdate(BaseModel):
    collection_name: str | None = Field(None, min_length=1, max_length=500)
    parent_id: int | None = None


class CollectionResponse(BaseModel):
    id: int
    user_id: int
    collection_name: str
    parent_id: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}