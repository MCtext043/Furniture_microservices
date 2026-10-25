from pathlib import Path
from html.parser import HTMLParser

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


def test_estimate_is_a_visible_section_below_the_planner_not_a_tab():
    html = read_frontend("index.html")
    assert 'data-bs-target="#costPane"' not in html
    assert '<section class="planner-estimate" id="costPane"' in html
    assert 'aria-labelledby="projectCostTitle"' in html
    assert html.index('id="costPane"') > html.index('id="room3d"')
    assert 'id="btnEstimateCost"' in html


def test_public_html_has_unique_live_ids_and_local_assets_resolve():
    class PageParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.ids = []
            self.assets = []

        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            if attrs.get("id"):
                self.ids.append(attrs["id"])
            value = attrs.get("src") if tag in ("script", "img") else attrs.get("href") if tag == "link" else None
            if value and not value.startswith(("http", "data:", "#")):
                self.assets.append(value)

    with TestClient(app) as client:
        for page in ("index.html", "admin.html", "privacy.html", "consent.html", "terms.html", "cookies.html"):
            parser = PageParser()
            parser.feed(read_frontend(page))
            assert len(parser.ids) == len(set(parser.ids)), page
            for asset in parser.assets:
                assert client.get("/" + asset.lstrip("./")).status_code == 200, (page, asset)


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
