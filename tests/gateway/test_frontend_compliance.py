from pathlib import Path

from fastapi.testclient import TestClient

from services.gateway_service.app.main import app


ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"


def read_frontend(name: str) -> str:
    return (FRONTEND / name).read_text(encoding="utf-8")


def test_local_seo_targets_brand_and_izhevsk_queries():
    html = read_frontend("index.html")

    assert "Петров мебель" in html
    assert "мебель на заказ в ижевске" in html.lower()
    assert '"addressLocality":"Ижевск"' in html
    assert '"areaServed"' in html


def test_top_plan_is_removed_and_3d_controls_are_present():
    html = read_frontend("index.html")
    admin_html = read_frontend("admin.html")

    assert "room2dPane" not in html + admin_html
    assert "data-open-plan" not in html
    assert 'id="roomPlan"' not in html + admin_html
    assert 'id="transformModeTranslate"' not in html + admin_html
    assert 'id="transformGizmoHint"' in html
    assert 'data-transform-plane' not in html + admin_html
    assert 'id="selectedObjectX"' in html
    assert 'id="selectedObjectY"' in html
    assert 'id="selectedObjectZ"' in html


def test_legal_documents_cookie_controls_and_form_consents_exist():
    index = read_frontend("index.html")
    required_pages = ("privacy.html", "consent.html", "terms.html", "cookies.html")

    for page in required_pages:
        assert (FRONTEND / page).is_file(), page
        assert page in index

    assert 'id="cookieConsent"' in index
    assert 'id="cookiePreferencesModal"' in index
    assert 'id="registrationConsent"' in index
    assert 'id="projectConsent"' in index
    assert 'id="checkoutConsent"' in index


def test_sitemap_and_robots_expose_public_pages_and_hide_admin():
    with TestClient(app) as client:
        sitemap = client.get("/sitemap.xml")
        robots = client.get("/robots.txt")

    assert sitemap.status_code == 200
    assert all(f"/{page}" in sitemap.text for page in ("privacy.html", "consent.html", "terms.html", "cookies.html"))
    assert "Disallow: /admin.html" in robots.text
    assert "Sitemap:" in robots.text


def test_landing_page_emits_absolute_canonical_url():
    with TestClient(app, base_url="https://petrov-mebel.example") as client:
        response = client.get("/")

    assert response.status_code == 200
    assert '<link rel="canonical" href="https://petrov-mebel.example/"' in response.text
