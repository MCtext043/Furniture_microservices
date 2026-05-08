from pydantic import BaseModel, ConfigDict, Field


class Part(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    quantity: int = Field(gt=0, le=200)


class CuttingRequest(BaseModel):
    sheet_width: int = Field(gt=0)
    sheet_height: int = Field(gt=0)
    parts: list[Part] = Field(min_length=1)


class Placement(BaseModel):
    name: str
    x: int
    y: int
    width: int
    height: int
    sheet_index: int = 0


class SheetPlacement(BaseModel):
    sheet_index: int
    placements: list[Placement]
    utilized_area: int
    unused_area: int
    utilization_percent: float


class UnplacedPart(BaseModel):
    name: str
    width: int
    height: int
    quantity: int


class CuttingResponse(BaseModel):
    placed_count: int
    requested_count: int
    utilization_percent: float
    total_used_area: int
    total_unused_area: int
    total_sheets: int
    sheets: list[SheetPlacement]
    unplaced_parts: list[UnplacedPart]
    placements: list[Placement]


class CuttingJobOut(BaseModel):
    id: int
    sheet_width: int
    sheet_height: int
    parts_count: int
    placed_count: int
    utilization_percent: int
    model_config = ConfigDict(from_attributes=True)
