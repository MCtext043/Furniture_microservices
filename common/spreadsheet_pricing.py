"""Editable pricing defaults transcribed from the supplied workbook."""

from __future__ import annotations

from copy import deepcopy

PRICING_QUANTITY_KEYS = ("facade1M2", "facade2M2", "facade3M2", "hinges", "guides", "countertop", "backsplash")

DEFAULT_PRICING_CONFIG: dict = {
    "packaging": 1000,
    "delivery": 3000,
    "tax_coefficient": 1.02,
    "tiers": [
        {"key": "standard", "title": "Вариант 0", "coefficient": 2.0, "tax_coefficient": 1.0, "prices": {"facade1": 1200, "facade2": 1200, "facade3": 1200, "hinges": 50, "guides": 500, "countertop": 4000, "backsplash": 4000}},
        {"key": "comfort", "title": "Вариант 1 · МДФ + Boyard", "coefficient": 2.0, "tax_coefficient": 1.02, "prices": {"facade1": 5900, "facade2": 4500, "facade3": 4500, "hinges": 50, "guides": 500, "countertop": 4000, "backsplash": 4000}},
        {"key": "premium", "title": "Вариант 2 · МДФ + JAT", "coefficient": 2.0, "tax_coefficient": 1.02, "prices": {"facade1": 5900, "facade2": 4500, "facade3": 4500, "hinges": 150, "guides": 2500, "countertop": 10000, "backsplash": 4000}},
        {"key": "luxury", "title": "Вариант 3 · Эмаль + Blum", "coefficient": 2.0, "tax_coefficient": 1.02, "prices": {"facade1": 9100, "facade2": 7000, "facade3": 7000, "hinges": 370, "guides": 4000, "countertop": 10000, "backsplash": 8000}},
    ],
}


def default_pricing_config() -> dict:
    return deepcopy(DEFAULT_PRICING_CONFIG)


def estimate_spreadsheet_prices(*, procurement_cost: float, quantities: dict, config: dict | None = None) -> list[dict]:
    config = config or DEFAULT_PRICING_CONFIG
    q = {key: max(0.0, float(quantities.get(key) or 0)) for key in PRICING_QUANTITY_KEYS}
    procurement = max(0.0, float(procurement_cost or 0))
    result = []
    for tier in config["tiers"]:
        prices = tier["prices"]
        assembly = (
            q["facade1M2"] * float(prices["facade1"])
            + q["facade2M2"] * float(prices["facade2"])
            + q["facade3M2"] * float(prices["facade3"])
            + q["hinges"] * float(prices["hinges"])
            + q["guides"] * float(prices["guides"])
            + q["countertop"] * float(prices["countertop"])
            + q["backsplash"] * float(prices["backsplash"])
        )
        prime = procurement + assembly
        tax = float(tier.get("tax_coefficient", config.get("tax_coefficient", 1)))
        price = (prime * float(tier["coefficient"]) + float(config["packaging"]) + float(config["delivery"])) * tax
        result.append({"key": tier["key"], "title": tier["title"], "assembly_cost": assembly, "prime_cost": prime, "price": round(price, 2)})
    return result
