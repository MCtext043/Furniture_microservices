from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    location: str = Field(default="", max_length=180)


class ProjectOut(ProjectCreate):
    id: int
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


class FurnitureOut(FurnitureCreate):
    id: int
    project_id: int
    model_config = ConfigDict(from_attributes=True)
