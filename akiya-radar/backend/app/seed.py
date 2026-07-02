"""Seed the database with realistic mock akiya listings.

Run with: ``python -m app.seed`` (idempotent — skips if listings already exist).
The descriptions contain genuine Japanese real-estate vocabulary so the
red-flag detector and scorer produce meaningful output on seed data.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Listing, PriceHistory, Source
from app.services import listing_ops

SOURCES = [
    {
        "name": "つるが暮らし 空き家バンク",
        "source_type": "municipal_akiya_bank",
        "base_url": "https://akiya.tsuruga.example.jp",
        "municipality": "敦賀市",
        "prefecture": "福井県",
        "crawl_enabled": False,
    },
    {
        "name": "隠岐の島町 空き家バンク",
        "source_type": "municipal_akiya_bank",
        "base_url": "https://akiya.okinoshima.example.jp",
        "municipality": "隠岐の島町",
        "prefecture": "島根県",
        "crawl_enabled": False,
    },
    {
        "name": "LIFULL HOME'S 空き家バンク (plateforme nationale MLIT)",
        "source_type": "lifull_akiya_bank",
        "base_url": "https://www.homes.co.jp/akiyabank/",
        "prefecture": None,
        "crawl_enabled": False,
        "terms_note": (
            "Plateforme nationale désignée par le MLIT. Import via URL uniquement ; "
            "vérifier CGU/robots.txt avant tout crawl automatisé."
        ),
    },
    {
        "name": "アットホーム 空き家バンク (plateforme nationale MLIT)",
        "source_type": "athome_akiya_bank",
        "base_url": "https://www.akiya-athome.jp/",
        "prefecture": None,
        "crawl_enabled": False,
        "terms_note": (
            "Seconde plateforme nationale désignée par le MLIT. Import via URL "
            "uniquement ; vérifier CGU/robots.txt avant tout crawl automatisé."
        ),
    },
    {
        "name": "MLIT 空き家・空き地バンク総合情報ページ",
        "source_type": "public_dataset",
        "base_url": "https://www.mlit.go.jp/totikensangyo/const/sosei_const_tk3_000131.html",
        "prefecture": None,
        "crawl_enabled": False,
        "terms_note": "Portail officiel : liste des banques municipales participantes.",
    },
    {
        "name": "Import manuel",
        "source_type": "manual",
        "base_url": None,
        "crawl_enabled": False,
    },
]

LISTINGS = [
    {
        "source_url": "https://akiya.tsuruga.example.jp/bukken/0001",
        "external_id": "TSU-0001",
        "title_original": "敦賀市 古民家 平屋 5DK 海まで徒歩10分",
        "description_original": (
            "築昭和48年の古民家です。5DK、広い庭付き。老朽化が進んでおり要修繕。"
            "雨漏りの跡があります。浄化槽。駐車場2台。落ち着いた住宅地。"
        ),
        "price_text_original": "380万円",
        "price_yen": Decimal(3_800_000),
        "prefecture": "福井県",
        "city": "敦賀市",
        "address_text": "福井県敦賀市櫛川",
        "lat": Decimal("35.654671"),
        "lon": Decimal("136.042694"),
        "geocode_accuracy": "approximate",
        "land_area_m2": Decimal("220.5"),
        "building_area_m2": Decimal("98.2"),
        "floor_plan": "5DK",
        "build_year": 1973,
        "property_type": "kominka",
        "transaction_type": "sale",
        "personal_status": "interesting",
        "favorite": True,
        "source_index": 0,
    },
    {
        "source_url": "https://akiya.okinoshima.example.jp/bukken/okino-12",
        "external_id": "OKI-12",
        "title_original": "隠岐の島町 一戸建て 3LDK 再建築不可",
        "description_original": (
            "海が見える高台の一戸建て。3LDK。再建築不可のため現況のままご利用ください。"
            "シロアリの被害が一部あり。残置物あり。"
        ),
        "price_text_original": "150万円",
        "price_yen": Decimal(1_500_000),
        "prefecture": "島根県",
        "city": "隠岐の島町",
        "address_text": "島根県隠岐郡隠岐の島町",
        "lat": Decimal("36.213398"),
        "lon": Decimal("133.311829"),
        "geocode_accuracy": "city",
        "land_area_m2": Decimal("160.0"),
        "building_area_m2": Decimal("82.0"),
        "floor_plan": "3LDK",
        "build_year": 1981,
        "property_type": "house",
        "transaction_type": "sale",
        "personal_status": "needs_verification",
        "source_index": 1,
    },
    {
        "source_url": "https://www.homes.example.co.jp/akiyabank/bukken/aki-3001",
        "external_id": "LIFULL-3001",
        "title_original": "南房総市 別荘向き 2LDK 海近",
        "description_original": (
            "南房総の別荘向き物件。2LDK。津波浸水想定区域に含まれます。"
            "上水道なし、井戸利用。リフォーム済みで状態良好。"
        ),
        "price_text_original": "680万円",
        "price_yen": Decimal(6_800_000),
        "prefecture": "千葉県",
        "city": "南房総市",
        "address_text": "千葉県南房総市千倉町",
        "lat": Decimal("34.934258"),
        "lon": Decimal("139.948578"),
        "geocode_accuracy": "approximate",
        "land_area_m2": Decimal("140.0"),
        "building_area_m2": Decimal("70.5"),
        "floor_plan": "2LDK",
        "build_year": 1998,
        "property_type": "house",
        "transaction_type": "sale",
        "personal_status": "to_review",
        "source_index": 2,
    },
    {
        "source_url": "https://www.homes.example.co.jp/akiyabank/bukken/aki-3045",
        "external_id": "LIFULL-3045",
        "title_original": "長野県 飯山市 雪国の古民家 6K",
        "description_original": (
            "豪雪地帯の古民家。6K、太い梁が魅力。大規模修繕が必要。"
            "傾きが見られます。汲み取り式トイレ。土砂災害警戒区域。"
        ),
        "price_text_original": "250万円",
        "price_yen": Decimal(2_500_000),
        "prefecture": "長野県",
        "city": "飯山市",
        "address_text": "長野県飯山市",
        "lat": Decimal("36.851665"),
        "lon": Decimal("138.365555"),
        "geocode_accuracy": "city",
        "land_area_m2": Decimal("330.0"),
        "building_area_m2": Decimal("120.0"),
        "floor_plan": "6K",
        "build_year": 1965,
        "property_type": "kominka",
        "transaction_type": "sale",
        "personal_status": "to_review",
        "source_index": 2,
    },
    {
        "source_url": "https://akiya.tsuruga.example.jp/bukken/0014",
        "external_id": "TSU-0014",
        "title_original": "敦賀市中心部 町家 4DK 商談中",
        "description_original": (
            "敦賀駅徒歩8分の町家。4DK。商談中。借地権物件のためご注意ください。"
            "リノベーション向き。"
        ),
        "price_text_original": "120万円",
        "price_yen": Decimal(1_200_000),
        "prefecture": "福井県",
        "city": "敦賀市",
        "address_text": "福井県敦賀市相生町",
        "lat": Decimal("35.655514"),
        "lon": Decimal("136.068314"),
        "geocode_accuracy": "approximate",
        "land_area_m2": Decimal("95.0"),
        "building_area_m2": Decimal("88.0"),
        "floor_plan": "4DK",
        "build_year": 1958,
        "property_type": "machiya",
        "transaction_type": "sale",
        "listing_status": "under_negotiation",
        "personal_status": "abandoned",
        "source_index": 0,
    },
    {
        "source_url": "https://www.homes.example.co.jp/akiyabank/bukken/aki-5512",
        "external_id": "LIFULL-5512",
        "title_original": "高知県 四万十町 平屋 3DK 田舎暮らし",
        "description_original": (
            "四万十川近くの平屋。3DK。家庭菜園に最適な広い農地付き。"
            "市街化調整区域。静かな環境。"
        ),
        "price_text_original": "430万円",
        "price_yen": Decimal(4_300_000),
        "prefecture": "高知県",
        "city": "四万十町",
        "address_text": "高知県高岡郡四万十町",
        "lat": Decimal("33.211605"),
        "lon": Decimal("133.137039"),
        "geocode_accuracy": "city",
        "land_area_m2": Decimal("520.0"),
        "building_area_m2": Decimal("76.0"),
        "floor_plan": "3DK",
        "build_year": 1989,
        "property_type": "house",
        "transaction_type": "sale",
        "personal_status": "new",
        "source_index": 2,
    },
    {
        "source_url": "https://akiya.okinoshima.example.jp/bukken/okino-31",
        "external_id": "OKI-31",
        "title_original": "隠岐の島町 海辺の一軒家 4LDK",
        "description_original": (
            "海辺の一軒家。4LDK。広い庭。リフォーム済みで即入居可能。"
            "駐車場3台。眺望良好。"
        ),
        "price_text_original": "880万円",
        "price_yen": Decimal(8_800_000),
        "prefecture": "島根県",
        "city": "隠岐の島町",
        "address_text": "島根県隠岐郡隠岐の島町都万",
        "lat": Decimal("36.21315"),
        "lon": Decimal("133.24324"),
        "geocode_accuracy": "approximate",
        "land_area_m2": Decimal("280.0"),
        "building_area_m2": Decimal("115.0"),
        "floor_plan": "4LDK",
        "build_year": 2005,
        "property_type": "house",
        "transaction_type": "sale",
        "personal_status": "very_interesting",
        "favorite": True,
        "source_index": 1,
    },
    {
        "source_url": "https://www.homes.example.co.jp/akiyabank/bukken/aki-7780",
        "external_id": "LIFULL-7780",
        "title_original": "新潟県 上越市 空き家 5DK 未登記部分あり",
        "description_original": (
            "上越市の空き家。5DK。増築部分が未登記です。洪水浸水想定区域。"
            "腐食が進んでいる箇所あり。要修繕。"
        ),
        "price_text_original": "90万円",
        "price_yen": Decimal(900_000),
        "prefecture": "新潟県",
        "city": "上越市",
        "address_text": "新潟県上越市",
        "lat": Decimal("37.147865"),
        "lon": Decimal("138.236099"),
        "geocode_accuracy": "city",
        "land_area_m2": Decimal("200.0"),
        "building_area_m2": Decimal("105.0"),
        "floor_plan": "5DK",
        "build_year": 1970,
        "property_type": "house",
        "transaction_type": "sale",
        "personal_status": "needs_verification",
        "source_index": 2,
    },
    {
        "source_url": "https://www.homes.example.co.jp/akiyabank/bukken/aki-9001",
        "external_id": "LIFULL-9001",
        "title_original": "大分県 由布市 温泉付き 戸建て 3LDK",
        "description_original": (
            "由布院近くの戸建て。3LDK。温泉引き込み可能。状態良好でリフォーム不要。"
            "駐車場あり。観光地に近い好立地。"
        ),
        "price_text_original": "1,250万円",
        "price_yen": Decimal(12_500_000),
        "prefecture": "大分県",
        "city": "由布市",
        "address_text": "大分県由布市湯布院町",
        "lat": Decimal("33.196159"),
        "lon": Decimal("131.349655"),
        "geocode_accuracy": "approximate",
        "land_area_m2": Decimal("250.0"),
        "building_area_m2": Decimal("110.0"),
        "floor_plan": "3LDK",
        "build_year": 2010,
        "property_type": "house",
        "transaction_type": "sale",
        "personal_status": "interesting",
        "source_index": 2,
    },
    {
        "source_url": "https://manual.example.com/listing/free-house-gifu",
        "external_id": None,
        "title_original": "岐阜県 郡上市 無償譲渡 古民家 7K",
        "description_original": (
            "郡上市の古民家を無償譲渡します。7K。解体費がかかる可能性あり。"
            "共有持分の一部。残置物多数。要相談。"
        ),
        "price_text_original": "0円（譲渡）",
        "price_yen": Decimal(0),
        "prefecture": "岐阜県",
        "city": "郡上市",
        "address_text": "岐阜県郡上市八幡町",
        "lat": Decimal("35.759174"),
        "lon": Decimal("136.945831"),
        "geocode_accuracy": "approximate",
        "land_area_m2": Decimal("410.0"),
        "building_area_m2": Decimal("140.0"),
        "floor_plan": "7K",
        "build_year": 1955,
        "property_type": "kominka",
        "transaction_type": "transfer",
        "personal_status": "new",
        "source_index": 5,
    },
]


def seed() -> None:
    db = SessionLocal()
    try:
        existing = db.execute(select(Listing).limit(1)).scalar_one_or_none()
        if existing is not None:
            print("Listings already present — skipping seed.")
            return

        sources: list[Source] = []
        for src in SOURCES:
            source = Source(**src)
            db.add(source)
            sources.append(source)
        db.flush()

        now = datetime.now(UTC)
        for data in LISTINGS:
            payload = dict(data)
            source_index = payload.pop("source_index")
            payload["source_id"] = sources[source_index].id
            payload["first_seen_at"] = now
            payload["last_seen_at"] = now
            listing = Listing(**payload)
            db.add(listing)
            db.flush()
            listing_ops.enrich_listing(db, listing)
            # A small price-history trail for the very first listing.
            if listing.external_id == "TSU-0001":
                db.add(
                    PriceHistory(
                        listing_id=listing.id,
                        price_yen=Decimal(4_500_000),
                        source_url=listing.source_url,
                    )
                )

        db.commit()
        count = db.execute(select(Listing)).scalars().all()
        print(f"Seeded {len(count)} listings and {len(sources)} sources.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
