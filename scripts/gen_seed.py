"""One-shot generator: emits SVG placeholder images + data/listings.json.

Run from repo root: python3 scripts/gen_seed.py
Overwrites seed-*.svg and rewrites data/listings.json (preserving any fb-*
scraped entries already present).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "assets" / "listings"
DATA_FILE = ROOT / "data" / "listings.json"

# (title, description, location, price_usd, emoji, bg1, bg2)
LISTINGS = [
    ("Haunted porcelain clown doll", "Belonged to grandma. Eyes follow you across the room. No refunds.", "Tampa, FL", 450, "🤡", "#d9c7a1", "#7a5a3a"),
    ("Used toilet (slightly)", "Works fine. You pick up. No lowballers I know what I have.", "Bakersfield, CA", 25, "🚽", "#c9d6e0", "#4a5a6a"),
    ("Taxidermy squirrel holding tiny beer", "Handcrafted. Beer is actually a thimble. Very cute.", "Ypsilanti, MI", 180, "🐿️", "#b8965a", "#4a3820"),
    ("Anime body pillow of Guy Fieri", "Welcome to Flavortown. Dakimakura, full length.", "Columbus, OH", 85, "🌶️", "#f7c245", "#a84b1f"),
    ("Full suit of knight armor (no helmet)", "Found in a basement. Fits someone 5'10\". Slight rust.", "Albany, NY", 1200, "🛡️", "#9aa3b2", "#3c4455"),
    ("1995 elliptical, smells like ham", "Works perfect. Smells weird. You haul.", "Scranton, PA", 40, "🏋️", "#e8b0a0", "#5a3838"),
    ("Dogs-playing-poker painting (original??)", "Pretty sure it's real. Oil on canvas. Bidding encouraged.", "Fort Wayne, IN", 150, "🐕", "#8c5a2e", "#2e1a10"),
    ("Deep freezer full of sourdough starter", "20 years old. Mother of them all. Takes the whole freezer.", "Portland, OR", 75, "🥖", "#e0d2a8", "#7a6840"),
    ("Life-size cardboard cutout of Gary Busey", "Startles my wife every morning. She wants it gone.", "Tulsa, OK", 60, "🎬", "#d6c6a2", "#574a2e"),
    ("Giant porcelain rooster, 4 feet tall", "Doesn't crow. Mostly intact. Crack in comb.", "Atlanta, GA", 220, "🐓", "#f2d785", "#a13c2f"),
    ("Single shoe, left foot, size 13", "Found it. Clean. Leather.", "Reno, NV", 15, "👞", "#a58160", "#3e2a18"),
    ("Vintage dentist chair, minor stains", "Hydraulics work. Perfect for Halloween party.", "Phoenix, AZ", 350, "🦷", "#c7cfd8", "#3a4450"),
    ("Bag of buttons (3000+)", "Estate sale find. All shapes, sizes, eras. Heavy.", "St. Louis, MO", 20, "🔘", "#c2a36b", "#5a4428"),
    ("Homemade throne from PVC pipe", "Spray-painted gold. Sturdy. Fits king-sized behind.", "Orlando, FL", 500, "👑", "#e8c75c", "#6a4d18"),
    ("Used CPAP machine, slight mildew", "Works. Probably wash the hose. No warranty.", "Topeka, KS", 50, "💨", "#c6d4dc", "#3e4e58"),
    ("Cursed velvet Elvis painting", "Eyes glow in moonlight. Not joking. $110 or trade for guns.", "Memphis, TN", 110, "🎤", "#5a2a6a", "#1a0a20"),
    ("Massive hand-carved wizard statue", "6 feet tall. Solid wood. Smells vaguely of patchouli.", "Asheville, NC", 900, "🧙", "#6e5e3a", "#2a2010"),
    ("400 VHS tapes, mostly Shrek", "Every Shrek plus bonuses. Cases included. Pickup only.", "Boise, ID", 100, "📼", "#3c7a3c", "#0e2a10"),
    ("Giant inflatable leg, unclear purpose", "Was at a car dealership I think. Blower included.", "Wichita, KS", 45, "🦵", "#f2b8a0", "#6a3030"),
    ("Very angry garden gnome", "Glare is startling. Made of concrete. 40 lbs.", "Eugene, OR", 35, "🧝", "#a8b55c", "#3a4418"),
    ("Porcelain cat army (47 cats)", "Must take all. No splitting the army. They are a family.", "Des Moines, IA", 250, "🐈", "#e0d8cf", "#6a604f"),
    ("Slightly melted Tupperware set", "Dishwasher accident. Still seals. Mostly.", "Flint, MI", 12, "🥡", "#d6c2e8", "#483a5a"),
    ("Handmade mannequin wedding dress", "Mannequin included. Long story. Don't ask.", "Lubbock, TX", 700, "👰", "#f0e6d8", "#6a5a40"),
    ("Mystery jar labeled 'DO NOT OPEN'", "Found in late uncle's shed. Heavy. Sloshes.", "Bangor, ME", 5, "🫙", "#a8c6a0", "#2c4028"),
    ("Antique iron lung", "Non-functional. Great conversation piece. Weighs 600 lbs.", "Cleveland, OH", 1800, "🛏️", "#8a9098", "#2a2e34"),
    ("Chandelier made from forks", "300+ forks welded together. Lights up. Dangerous.", "Brooklyn, NY", 275, "🍴", "#c5cdd5", "#3a444e"),
    ("Life-sized E.T. statue", "Was at a Blockbuster. One finger broken. Still phones home.", "Tucson, AZ", 650, "👽", "#a08560", "#34281a"),
    ("Box of 'unused' wigs", "Different styles. Blonde, black, purple. All human hair (?).", "Las Vegas, NV", 40, "💇", "#d8a0c0", "#5a2e48"),
    ("Glass eye collection, mismatched", "37 eyes. None match. Stored in velvet case.", "Providence, RI", 90, "👁️", "#c0c8d0", "#2c3440"),
    ("1987 Buick, runs on prayer", "Starts 60% of the time. Has personality. Needs love.", "Detroit, MI", 400, "🚗", "#8a6d3a", "#2a1e10"),
]

SVG_TEMPLATE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="g" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="{bg1}"/>
      <stop offset="100%" stop-color="{bg2}"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="{seed}"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.08 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
  </defs>
  <rect width="400" height="300" fill="url(#g)"/>
  <g opacity="0.9">
    <text x="200" y="195" font-size="160" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">{emoji}</text>
  </g>
  <rect width="400" height="300" fill="transparent" filter="url(#grain)"/>
  <circle cx="72" cy="58" r="22" fill="white" opacity="0.22"/>
  <rect x="0" y="252" width="400" height="48" fill="rgba(0,0,0,0.35)"/>
  <text x="16" y="282" font-size="16" fill="#ffffff" font-family="system-ui, sans-serif" opacity="0.85">{loc}</text>
</svg>
"""


def slugify(title: str, n: int) -> str:
    return f"seed-{n:03d}"


def main() -> None:
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

    listings_out = []
    for i, (title, desc, loc, price, emoji, bg1, bg2) in enumerate(LISTINGS, start=1):
        slug = slugify(title, i)
        svg_path = IMG_DIR / f"{slug}.svg"
        svg = SVG_TEMPLATE.format(
            bg1=bg1, bg2=bg2, emoji=emoji, seed=i, loc=loc
        )
        svg_path.write_text(svg, encoding="utf-8")
        listings_out.append({
            "id": slug,
            "image": f"assets/listings/{slug}.svg",
            "title": title,
            "description": desc,
            "price": price,
            "location": loc,
            "source": "seed",
        })

    # Preserve any already-scraped entries.
    existing = []
    if DATA_FILE.exists():
        try:
            existing = json.loads(DATA_FILE.read_text())
        except Exception:
            existing = []
    scraped = [l for l in existing if l.get("source") == "fb_scrape"]

    merged = listings_out + scraped
    DATA_FILE.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(listings_out)} seed listings + kept {len(scraped)} scraped. Total: {len(merged)}")


if __name__ == "__main__":
    main()
