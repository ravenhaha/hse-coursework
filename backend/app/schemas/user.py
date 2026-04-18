from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    user_email: str | None = None
    display_name: str
    avatar_url: str | None = None
    is_active: bool

    model_config = {"from_attributes": True}