from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserOut(BaseModel):
    id: int
    username: str
    roles: list[str]
    email: str | None = None
    email_verified: bool = False

    model_config = {"from_attributes": True}


_EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class AdminCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    email: str | None = Field(default=None, max_length=254, pattern=_EMAIL_PATTERN)
    roles: list[str] | None = Field(
        default=None,
        description="Assignable permission codes; omit for default staff set without delete rights",
    )


class AdminUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=64)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    email: str | None = Field(default=None, max_length=254, pattern=_EMAIL_PATTERN)
    roles: list[str] | None = Field(
        default=None,
        description="When set, replaces assignable permissions (admin base role always kept)",
    )


class JwtPayload(BaseModel):
    """Claims echoed for debugging / integrations."""

    sub: str
    username: str
    roles: list[str]
