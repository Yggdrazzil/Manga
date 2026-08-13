"""Build the bundled akiya-bank source catalogue from official directories.

Two public directories are merged:

1. **MLIT 空き家バンク リンク集** — the government's authoritative index of every
   local-authority akiya bank
   (https://www.mlit.go.jp/totikensangyo/const/akiyabank_link.html). One table
   row per municipality: prefecture / municipality / site name + link.
2. **アットホーム空き家バンク 参加自治体** — the municipalities whose bank is
   hosted by At Home (https://www.akiya-athome.jp/government/). Each one gets a
   subdomain of the form ``<romaji>-c<JIS code>.akiya-athome.jp`` that renders a
   *uniform* template, which is what makes structured ingestion possible.

The result is written to ``app/data/source_catalog.json`` and committed, so the
application never depends on these pages being reachable at runtime.

Run with::

    python scripts/build_source_catalog.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.mlit import PREFECTURE_CODES  # noqa: E402

MLIT_DIRECTORY = "https://www.mlit.go.jp/totikensangyo/const/akiyabank_link.html"
ATHOME_GOVERNMENT = "https://www.akiya-athome.jp/government/"
OUTPUT = Path(__file__).resolve().parents[1] / "app" / "data" / "source_catalog.json"

UA = "AkiyaRadarBot/0.2 (+catalogue build; respects robots.txt)"
TIMEOUT = 60.0

CODE_TO_PREFECTURE = {code: name for name, code in PREFECTURE_CODES.items()}

# MLIT publishes maps and PDFs alongside the real links; drop those.
_SKIP_LINK = re.compile(r"\.(jpg|jpeg|png|gif|pdf)$|mlit\.go\.jp", re.I)


def _get(url: str) -> str:
    resp = httpx.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT, follow_redirects=True)
    resp.raise_for_status()
    return resp.text


def parse_mlit_directory(html: str) -> list[dict]:
    """Extract (prefecture, municipality, name, url) rows from the MLIT table."""
    soup = BeautifulSoup(html, "html.parser")
    entries: list[dict] = []
    current_prefecture: str | None = None

    for row in soup.select("table tr"):
        cells = row.find_all(["td", "th"])
        if len(cells) < 3:
            continue
        prefecture = cells[0].get_text(" ", strip=True)
        municipality = cells[1].get_text(" ", strip=True)
        if prefecture in PREFECTURE_CODES:
            current_prefecture = prefecture
        elif prefecture:
            # Continuation rows leave the prefecture cell empty or merged.
            pass
        if current_prefecture is None:
            continue

        for anchor in cells[2].find_all("a", href=True):
            href = anchor["href"].strip()
            if not href.startswith("http") or _SKIP_LINK.search(href):
                continue
            name = anchor.get_text(" ", strip=True) or cells[2].get_text(" ", strip=True)
            entries.append(
                {
                    "prefecture": current_prefecture,
                    "municipality": municipality or None,
                    "name": name.strip()[:120],
                    "url": href,
                }
            )
    return entries


def parse_athome_government(html: str) -> list[dict]:
    """Extract the At Home per-municipality akiya-bank subdomains."""
    soup = BeautifulSoup(html, "html.parser")
    entries: list[dict] = []
    seen: set[str] = set()

    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        match = re.match(r"https?://([a-z0-9\-]+)-([ct])(\d{5})\.akiya-athome\.jp/?$", href)
        if not match:
            continue
        romaji, _kind, code = match.groups()
        prefecture = CODE_TO_PREFECTURE.get(code[:2])
        if prefecture is None:
            continue
        # Normalise to https — several entries are still listed as http.
        url = f"https://{match.group(1)}-{match.group(2)}{code}.akiya-athome.jp/"
        if url in seen:
            continue
        seen.add(url)
        municipality = anchor.get_text(" ", strip=True)
        entries.append(
            {
                "prefecture": prefecture,
                "municipality": municipality or None,
                "muni_code": code,
                "romaji": romaji,
                "name": f"{municipality} 空き家バンク（アットホーム）",
                "url": url,
            }
        )
    return entries


NATIONAL: list[dict] = [
    {
        "key": "mlit-directory",
        "name": "国土交通省 — 空き家バンク リンク集",
        "name_fr": "Répertoire officiel MLIT des banques d'akiya",
        "source_type": "public_dataset",
        "url": "https://www.mlit.go.jp/totikensangyo/const/akiyabank_link.html",
        "prefecture": None,
        "municipality": None,
        "crawlable": False,
        "notes_fr": (
            "Annuaire gouvernemental de toutes les banques d'akiya municipales. "
            "Sert de référence : c'est la source de ce catalogue."
        ),
    },
    {
        "key": "athome-national",
        "name": "アットホーム 空き家バンク（全国）",
        "name_fr": "At Home — banque d'akiya nationale",
        "source_type": "athome_akiya_bank",
        "url": "https://www.akiya-athome.jp/",
        "prefecture": None,
        "municipality": None,
        "crawlable": False,
        "notes_fr": (
            "Portail national. Les fiches exploitables sont sur les sites "
            "communaux dédiés (un sous-domaine par commune), pré-enregistrés ici."
        ),
    },
    {
        "key": "lifull-national",
        "name": "LIFULL HOME'S 空き家バンク",
        "name_fr": "LIFULL HOME'S — banque d'akiya nationale",
        "source_type": "lifull_akiya_bank",
        "url": "https://www.homes.co.jp/akiyabank/",
        "prefecture": None,
        "municipality": None,
        "crawlable": False,
        "notes_fr": (
            "Consultation manuelle uniquement : le site renvoie 403 aux robots. "
            "Utilisez « Importer une URL » pour récupérer une fiche précise."
        ),
    },
]


def main() -> None:
    print(f"fetching {MLIT_DIRECTORY} …")
    mlit_rows = parse_mlit_directory(_get(MLIT_DIRECTORY))
    print(f"  → {len(mlit_rows)} municipal links")

    print(f"fetching {ATHOME_GOVERNMENT} …")
    athome_rows = parse_athome_government(_get(ATHOME_GOVERNMENT))
    print(f"  → {len(athome_rows)} At Home municipalities")

    athome_hosts = {r["url"] for r in athome_rows}
    municipal: list[dict] = []

    for row in athome_rows:
        municipal.append(
            {
                "key": f"athome-{row['muni_code']}",
                "name": row["name"],
                "source_type": "athome_akiya_bank",
                "url": row["url"],
                "prefecture": row["prefecture"],
                "municipality": row["municipality"],
                "muni_code": row["muni_code"],
                "adapter": "athome_municipal",
                "crawlable": True,
            }
        )

    for row in mlit_rows:
        if row["url"].rstrip("/") + "/" in athome_hosts:
            continue  # already covered by the richer At Home entry
        municipal.append(
            {
                "key": None,
                "name": row["name"],
                "source_type": "municipal_akiya_bank",
                "url": row["url"],
                "prefecture": row["prefecture"],
                "municipality": row["municipality"],
                "adapter": "generic",
                "crawlable": True,
            }
        )

    # Stable, de-duplicated ordering: prefecture code, then municipality, then name.
    seen_urls: set[str] = set()
    deduped: list[dict] = []
    for entry in municipal:
        url = entry["url"].rstrip("/")
        if url in seen_urls:
            continue
        seen_urls.add(url)
        if entry.get("key") is None:
            entry["key"] = "muni-" + re.sub(r"[^a-z0-9]+", "-", url.lower())[:60].strip("-")
        deduped.append(entry)

    deduped.sort(
        key=lambda e: (
            PREFECTURE_CODES.get(e["prefecture"] or "", "99"),
            e["municipality"] or "",
            e["name"],
        )
    )

    payload = {
        "generated_from": [MLIT_DIRECTORY, ATHOME_GOVERNMENT],
        "national": NATIONAL,
        "municipal": deduped,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    by_pref: dict[str, int] = {}
    for entry in deduped:
        by_pref[entry["prefecture"] or "?"] = by_pref.get(entry["prefecture"] or "?", 0) + 1
    print(f"\nwrote {OUTPUT} — {len(deduped)} municipal + {len(NATIONAL)} national")
    print(f"prefectures covered: {len(by_pref)}")
    athome_count = sum(1 for e in deduped if e["adapter"] == "athome_municipal")
    print(f"At Home (structured ingestion): {athome_count}")


if __name__ == "__main__":
    main()
