from services.catalog_service.app.delivery import calculate_delivery_quote, haversine_km, GeoPoint


def test_free_delivery_from_threshold():
    quote = calculate_delivery_quote(
        subtotal=3500,
        distance_km=12.5,
        free_delivery_threshold=3000,
        delivery_price_per_km=45,
    )
    assert quote.free_delivery is True
    assert quote.delivery_fee == 0
    assert quote.grand_total == 3500
    assert quote.amount_until_free_delivery == 0


def test_paid_delivery_below_threshold():
    quote = calculate_delivery_quote(
        subtotal=2500,
        distance_km=10,
        free_delivery_threshold=3000,
        delivery_price_per_km=45,
    )
    assert quote.free_delivery is False
    assert quote.delivery_fee == 450
    assert quote.grand_total == 2950
    assert quote.amount_until_free_delivery == 500


def test_haversine_distance_positive():
    moscow = GeoPoint(55.7558, 37.6173)
    nearby = GeoPoint(55.80, 37.70)
    assert haversine_km(moscow, nearby) > 0
