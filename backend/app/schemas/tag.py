from pydantic import BaseModel, Field
from datetime import datetime


class TagCreate(BaseModel):
    tag_name: str = Field(min_length=1, max_length=100)


class TagUpdate(BaseModel):
    tag_name: str | None = Field(default=None, min_length=1, max_length=100)


class TagResponse(BaseModel):
    id: int
    user_id: int
    tag_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TagAssign(BaseModel):
    tag_id: int