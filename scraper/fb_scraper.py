"""Facebook Marketplace scraper for Marketguessr.

*** READ scraper/README.md FIRST. ***

This script is intended to run LOCALLY, with YOUR OWN Facebook session cookies.
It violates Facebook's ToS; use only for personal / educational purposes and at
your own risk. Do not deploy this to a server. Do not run it at scale.

Usage (from repo root):

    pip install -r scraper/requirements.txt
    playwright install chromium
    python scraper/fb_scraper.py --query "haunted doll" --max 5

On first run, you'll be prompted to log in inside the opened browser. Your
cookies are saved to scraper/.cookies.json (gitignored). Subsequent runs reuse
them.

The scraper appends new entries to data/listings.json with source="fb_scrape"
and downloads cover images to assets/listings/.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from playwright.sync_api import (
    Page,
    Playwright,
    TimeoutError as PlaywrightTimeoutError,
    sync_playwright,
)

ROOT = Path(__file__).resolve().parent.parent
COOKIES_FILE = Path(__file__).resolve().parent / ".cookies.json"
DATA_FILE = ROOT / "data" / "listings.json"
IMG_DIR = ROOT / "assets" / "listings"

PRICE_RE = re.compile(r"\$([\d,]+)")
LISTING_ID_RE = re.compile(r"/marketplace/item/(\d+)")


def load_cookies() -> list[dict] | None:
    if COOKIES_FILE.exists():
        try:
            return json.loads(COOKIES_FILE.read_text())
        except Exception:
            return None
    return None


def save_cookies(cookies: list[dict]) -> None:
    COOKIES_FILE.write_text(json.dumps(cookies, indent=2))
    print(f"[cookies] saved to {COOKIES_FILE}")


def ensure_login(page: Page) -> None:
    page.goto("https://www.facebook.com/", wait_until="domcontentloaded")
    if page.locator("input[name='email']").count() > 0:
        print("[login] Please log in to Facebook in the opened browser window.")
        print("        Close any two-factor prompts, then return here.")
        page.wait_for_url(lambda u: "login" not in u, timeout=300_000)


def read_listings() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    try:
        return json.loads(DATA_FILE.read_text())
    except Exception:
        return []


def write_listings(listings: list[dict]) -> None:
    DATA_FILE.write_text(json.dumps(listings, indent=2) + "\n", encoding="utf-8")


def existing_ids(listings: list[dict]) -> set[str]:
    return {l.get("id") for l in listings if l.get("id")}


def download_image(url: str, listing_id: str) -> Path | None:
    try:
        r = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (compatible; Marketguessr/0.1)",
        })
        r.raise_for_status()
    except Exception as e:
        print(f"[img] failed {url}: {e}")
        return None
    ext = ".jpg"
    ctype = r.headers.get("Content-Type", "")
    if "png" in ctype:
        ext = ".png"
    elif "webp" in ctype:
        ext = ".webp"
    out = IMG_DIR / f"fb-{listing_id}{ext}"
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    out.write_bytes(r.content)
    return out


def parse_price(text: str) -> int | None:
    m = PRICE_RE.search(text)
    if not m:
        return None
    try:
        return int(m.group(1).replace(",", ""))
    except ValueError:
        return None


def extract_listing_id(url: str) -> str | None:
    m = LISTING_ID_RE.search(url)
    if m:
        return m.group(1)
    # Fall back to hash of URL.
    return hashlib.sha1(url.encode()).hexdigest()[:12]


def scrape_query(page: Page, query: str, max_items: int) -> list[dict]:
    """Open the search page and collect up to max_items listings for this query."""
    search_url = f"https://www.facebook.com/marketplace/search/?query={requests.utils.quote(query)}"
    print(f"[query] {query} -> {search_url}")
    page.goto(search_url, wait_until="domcontentloaded")
    time.sleep(random.uniform(3, 5))

    # Scroll to force more results to render.
    for _ in range(3):
        page.mouse.wheel(0, 2000)
        time.sleep(random.uniform(1.5, 2.5))

    # Marketplace listing links look like /marketplace/item/<id>/.
    links = set()
    for a in page.locator("a[href*='/marketplace/item/']").all():
        href = a.get_attribute("href") or ""
        if "/marketplace/item/" in href:
            # Normalize to absolute URL.
            if href.startswith("/"):
                href = "https://www.facebook.com" + href
            links.add(href.split("?")[0])
        if len(links) >= max_items * 3:
            break

    print(f"[query] found {len(links)} candidate links")
    results: list[dict] = []
    for href in list(links)[: max_items * 2]:
        if len(results) >= max_items:
            break
        try:
            item = scrape_item(page, href)
        except PlaywrightTimeoutError:
            print(f"[item] timeout on {href}, skipping")
            continue
        except Exception as e:
            print(f"[item] error on {href}: {e}")
            continue
        if item:
            results.append(item)
            time.sleep(random.uniform(3, 7))
    return results


def scrape_item(page: Page, url: str) -> dict | None:
    page.goto(url, wait_until="domcontentloaded", timeout=30_000)
    time.sleep(random.uniform(2, 3.5))

    body_text = page.locator("body").inner_text(timeout=10_000)
    price = parse_price(body_text)
    if price is None:
        print(f"[item] no price in {url}")
        return None

    # Title: FB marketplace page title contains it.
    title = ""
    try:
        title = page.title().split("|")[0].split("Marketplace")[0].strip(" -\u2013")
    except Exception:
        pass
    if not title:
        # Best-effort: the first <h1> on the page.
        h = page.locator("h1").first
        try:
            title = h.inner_text(timeout=3_000).strip()
        except Exception:
            title = "Untitled listing"

    # Image: the og:image meta, or the first visible listing image.
    image_url = None
    og = page.locator("meta[property='og:image']").first
    try:
        image_url = og.get_attribute("content", timeout=3_000)
    except Exception:
        pass
    if not image_url:
        img = page.locator("img[src*='scontent']").first
        try:
            image_url = img.get_attribute("src", timeout=3_000)
        except Exception:
            pass
    if not image_url:
        print(f"[item] no image for {url}")
        return None

    # Location and description are buried in repeated text; best-effort extract.
    location = ""
    m_loc = re.search(r"Location\s*\n([^\n]+)", body_text)
    if m_loc:
        location = m_loc.group(1).strip()[:80]

    description = ""
    # Description block often follows the title, up to "Seller's description".
    m_desc = re.search(r"(Details|Description)\s*\n(.+?)\n(?:Seller|Location|Condition|About this vehicle)", body_text, re.DOTALL)
    if m_desc:
        description = m_desc.group(2).strip()[:400]

    listing_id = extract_listing_id(url) or hashlib.sha1(url.encode()).hexdigest()[:12]
    img_path = download_image(image_url, listing_id)
    if not img_path:
        return None

    return {
        "id": f"fb-{listing_id}",
        "image": str(img_path.relative_to(ROOT)),
        "title": title[:120] or "Untitled listing",
        "description": description,
        "price": price,
        "location": location,
        "source": "fb_scrape",
        "source_url": url,
    }


def run(pw: Playwright, queries: list[str], max_per_query: int) -> None:
    cookies = load_cookies()
    browser = pw.chromium.launch(headless=False)
    ctx = browser.new_context(
        viewport={"width": 1280, "height": 900},
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        ),
    )
    if cookies:
        ctx.add_cookies(cookies)

    page = ctx.new_page()
    ensure_login(page)
    save_cookies(ctx.cookies())

    existing = read_listings()
    known_ids = existing_ids(existing)
    added = 0

    for q in queries:
        items = scrape_query(page, q, max_per_query)
        for item in items:
            if item["id"] in known_ids:
                continue
            existing.append(item)
            known_ids.add(item["id"])
            added += 1
            print(f"[add] {item['id']} — ${item['price']} — {item['title']}")
        write_listings(existing)

    print(f"\nDone. Added {added} new listings. Total: {len(existing)}.")
    ctx.close()
    browser.close()


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--query", action="append", default=None, help="Search query; can repeat. Defaults to a weird-stuff preset.")
    p.add_argument("--max", type=int, default=5, help="Max listings per query (default 5).")
    args = p.parse_args(argv)

    queries = args.query or [
        "haunted doll",
        "taxidermy",
        "clown painting",
        "weird painting",
        "used toilet",
        "antique dentist chair",
        "garden gnome",
        "vintage mannequin",
    ]

    with sync_playwright() as pw:
        run(pw, queries, args.max)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
