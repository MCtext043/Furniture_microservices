from pydantic import BaseModel, ConfigDict, Field

SELECTED_TIER_PATTERN = r"^(standard|comfort|premium)$"


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    location: str = Field(default="", max_length=180)
    user_id: str | None = Field(default=None, max_length=64)
    room_width: float = Field(default=6000, gt=0)
    room_length: float = Field(default=5000, gt=0)
    room_height: float = Field(default=2800, gt=0)
    price_standard: float | None = Field(default=None, ge=0)
    price_comfort: float | None = Field(default=None, ge=0)
    price_premium: float | None = Field(default=None, ge=0)
    bom_json: str = ""
    selected_tier: str = Field(default="standard", pattern=SELECTED_TIER_PATTERN)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=180)
    location: str | None = Field(default=None, max_length=180)
    user_id: str | None = Field(default=None, max_length=64)
    room_width: float | None = Field(default=None, gt=0)
    room_length: float | None = Field(default=None, gt=0)
    room_height: float | None = Field(default=None, gt=0)
    price_standard: float | None = Field(default=None, ge=0)
    price_comfort: float | None = Field(default=None, ge=0)
    price_premium: float | None = Field(default=None, ge=0)
    bom_json: str | None = None
    selected_tier: str | None = Field(default=None, pattern=SELECTED_TIER_PATTERN)


class ProjectSubmitIn(BaseModel):
    selected_tier: str = Field(default="standard", pattern=SELECTED_TIER_PATTERN)


class ProjectOut(ProjectCreate):
    id: int
    status: str
    submitted_at: str | None = None
    model_config = ConfigDict(from_attributes=True)


class FurnitureCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    width: float = Field(gt=0)
    depth: float = Field(gt=0)
    height: float = Field(gt=0)
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    rotation_y: float = 0.0
    furniture_type: str = Field(default="cabinet", max_length=32)
    texture: str = Field(default="wood_oak", max_length=64)
    custom_color: str = Field(default="", max_length=16)
    drawers: int = Field(default=0, ge=0, le=20)
    handles: int = Field(default=0, ge=0, le=40)


class FurnitureOut(FurnitureCreate):
    id: int
    project_id: int
    model_config = ConfigDict(from_attributes=True)
