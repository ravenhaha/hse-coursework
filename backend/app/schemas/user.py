from pydantic import BaseModel, EmailStr

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

#если польз без пароля
class UserResponse(BaseModel):
    id: int
    username: str
    email: str | None
    display_name: str
    avatar_url: str | None
    is_active: bool

    model_config = {"from_attributes": True}