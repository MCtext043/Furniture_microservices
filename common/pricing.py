"""Kitchen project pricing tiers (standard / comfort / premium)."""

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
