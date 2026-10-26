from common.spreadsheet_pricing import estimate_spreadsheet_prices


def test_workbook_example_matches_all_four_variants():
    prices = estimate_spreadsheet_prices(
        procurement_cost=33125,
        quantities={"facade1M2": 1.1, "facade2M2": 4.2, "facade3M2": 0, "hinges": 28, "guides": 4, "countertop": 1.5, "backsplash": 1.5},
    )
    assert [row["price"] for row in prices] == [113770, 154866.6, 195258.6, 260905.8]
    assert [row["assembly_cost"] for row in prices] == [21760, 40790, 60590, 92770]


def test_unknown_quantities_are_zero():
    prices = estimate_spreadsheet_prices(procurement_cost=1000, quantities={"facade1M2": 2})
    assert prices[0]["assembly_cost"] == 2400
