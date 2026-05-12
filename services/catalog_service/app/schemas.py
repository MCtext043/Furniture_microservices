from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    parent_id: int | None = None


class CategoryOut(CategoryCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    parent_id: int | None = None


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    sku: str = Field(min_length=2, max_length=64)
    brand: str = Field(default="", max_length=120)
    description: str = ""
    price: float = Field(gt=0)
    category_id: int | None = None
    stock: int = Field(ge=0)
    is_active: bool = True


class ProductOut(ProductCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=180)
    brand: str | None = Field(default=None, max_length=120)
    description: str | None = None
    price: float | None = Field(default=None, gt=0)
    category_id: int | None = None
    stock: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ReviewCreate(BaseModel):
    author_name: str = Field(min_length=2, max_length=120)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)


class ReviewOut(ReviewCreate):
    id: int
    product_id: int
    model_config = ConfigDict(from_attributes=True)


class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=999)


class CartItemUpdate(BaseModel):
    quantity: int = Field(gt=0, le=999)


class CartItemOut(BaseModel):
    id: int
    user_id: str
    product_id: int
    quantity: int
    model_config = ConfigDict(from_attributes=True)


class WishlistItemOut(BaseModel):
    id: int
    user_id: str
    product_id: int
    model_config = ConfigDict(from_attributes=True)


class ProductFiltersOut(BaseModel):
    min_price: float
    max_price: float
    brands: list[str]
