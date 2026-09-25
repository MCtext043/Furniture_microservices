"""Kitchen project pricing from cutting (whole sheets) and retail tiers."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PricingTier:
    key: str
    title: str
    material_multiplier: float
    hardware_multiplier: float
    labor_multiplier: float


TIERS: tuple[PricingTier, ...] = (
    PricingTier("standard", "Стандарт", 1.0, 1.0, 1.0),
    PricingTier("comfort", "Комфорт", 1.18, 1.25, 1.1),
    PricingTier("premium", "Премиум", 1.42, 1.55, 1.22),
)

DEFAULT_SHEET_WIDTH_MM = 2800
DEFAULT_SHEET_HEIGHT_MM = 2070
LDSP_PRICE_PER_M2 = 3200.0
EDGE_PRICE_PER_M = 180.0
RETAIL_MULTIPLIER = 2.2


def sheet_area_m2(width_mm: int, height_mm: int) -> float:
    return (width_mm * height_mm) / 1_000_000


def sheet_purchase_price(
    *,
    sheet_width: int = DEFAULT_SHEET_WIDTH_MM,
    sheet_height: int = DEFAULT_SHEET_HEIGHT_MM,
    price_per_m2: float = LDSP_PRICE_PER_M2,
) -> float:
    return sheet_area_m2(sheet_width, sheet_height) * price_per_m2


def estimate_from_cutting(
    *,
    total_sheets: int,
    edge_meters: float,
    hardware_factor: float = 1.0,
    sheet_width: int = DEFAULT_SHEET_WIDTH_MM,
    sheet_height: int = DEFAULT_SHEET_HEIGHT_MM,
    sheet_price_rub: float | None = None,
) -> dict[str, float]:
    """Retail tier prices billed from actual nest (whole sheets), not theoretical part area."""
    sheets = max(0, int(total_sheets))
    unit_sheet = sheet_price_rub if sheet_price_rub is not None else sheet_purchase_price(
        sheet_width=sheet_width,
        sheet_height=sheet_height,
    )
    material_cost = sheets * unit_sheet
    edge_cost = max(0.0, float(edge_meters)) * EDGE_PRICE_PER_M
    procurement = material_cost + edge_cost
    factor = max(0.5, float(hardware_factor))
    comfort = round(procurement * RETAIL_MULTIPLIER * factor)
    return {
        "material_cost": round(material_cost),
        "edge_cost": round(edge_cost),
        "procurement_cost": round(procurement),
        "standard": round(comfort * 0.8),
        "comfort": comfort,
        "premium": round(comfort * 1.3),
    }


def estimate_tier_prices(
    *,
    material_cost: float,
    hardware_cost: float,
    labor_cost: float,
    furniture_cost: float,
) -> dict[str, float]:
    """Return rounded tier totals from base cost components."""
    result: dict[str, float] = {}
    for tier in TIERS:
        total = (
            material_cost * tier.material_multiplier
            + hardware_cost * tier.hardware_multiplier
            + labor_cost * tier.labor_multiplier
            + furniture_cost
        )
        result[tier.key] = round(total)
    return result
