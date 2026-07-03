from common.pricing import estimate_tier_prices


def test_tier_prices_increase_standard_to_premium():
    prices = estimate_tier_prices(
        material_cost=100000,
        hardware_cost=20000,
        labor_cost=30000,
        furniture_cost=50000,
    )
    assert prices["standard"] == 200000
    assert prices["comfort"] > prices["standard"]
    assert prices["premium"] > prices["comfort"]


def test_tier_keys_present():
    prices = estimate_tier_prices(
        material_cost=1000,
        hardware_cost=100,
        labor_cost=200,
        furniture_cost=0,
    )
    assert set(prices) == {"standard", "comfort", "premium"}
