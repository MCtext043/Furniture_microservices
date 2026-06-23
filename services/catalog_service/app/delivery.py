"""Delivery fee estimation by address (geocoding + distance)."""

from __future__ import annotations

import math
from dataclasses import dataclass

import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "FurnitureShop/1.0 (delivery estimate)"
ROAD_DISTANCE_FACTOR = 1.25


@dataclass(frozen=True)
class GeoPoint:
    lat: float
    lon: float


@dataclass(frozen=True)
class DeliveryQuote:
    subtotal: float
    delivery_fee: float
    distance_km: float
    free_delivery: bool
    free_delivery_threshold: float
    delivery_price_per_km: float
    amount_until_free_delivery: float
    grand_total: float


def haversine_km(a: GeoPoint, b: GeoPoint) -> float:
    r = 6371.0
    lat1, lon1 = math.radians(a.lat), math.radians(a.lon)
    lat2, lon2 = math.radians(b.lat), math.radians(b.lon)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


async def geocode_address(address: str) -> GeoPoint:
    query = address.strip()
    if len(query) < 5:
        raise ValueError("Укажите более полный адрес доставки")

    async with httpx.AsyncClient(timeout=12.0) as client:
        response = await client.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "ru"},
            headers={"User-Agent": USER_AGENT},
        )
        response.raise_for_status()
        rows = response.json()

    if not rows:
        raise ValueError("Не удалось найти адрес на карте. Уточните город, улицу и дом.")

    return GeoPoint(lat=float(rows[0]["lat"]), lon=float(rows[0]["lon"]))


def estimate_road_distance_km(origin: GeoPoint, destination: GeoPoint) -> float:
    straight = haversine_km(origin, destination)
    return round(straight * ROAD_DISTANCE_FACTOR, 1)


def calculate_delivery_quote(
    *,
    subtotal: float,
    distance_km: float,
    free_delivery_threshold: float,
    delivery_price_per_km: float,
) -> DeliveryQuote:
    subtotal = round(max(subtotal, 0), 2)
    threshold = round(max(free_delivery_threshold, 0), 2)
    rate = round(max(delivery_price_per_km, 0), 2)
    free_delivery = subtotal >= threshold
    delivery_fee = 0.0 if free_delivery else round(distance_km * rate)
    amount_until_free = 0.0 if free_delivery else round(max(threshold - subtotal, 0), 2)
    grand_total = round(subtotal + delivery_fee, 2)

    return DeliveryQuote(
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        distance_km=distance_km,
        free_delivery=free_delivery,
        free_delivery_threshold=threshold,
        delivery_price_per_km=rate,
        amount_until_free_delivery=amount_until_free,
        grand_total=grand_total,
    )
