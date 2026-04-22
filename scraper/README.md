# Facebook Marketplace scraper (local-only)

> **Warning.** Scraping Facebook violates their Terms of Service. This tool
> exists for personal, educational exploration. Do not run it on a server, do
> not run it at scale, and do not commit scraped content you do not have the
> right to republish. You are solely responsible for how you use it. Expect
> your account to be flagged or challenged.

## What it does

`fb_scraper.py` opens a real Chromium (via Playwright), lets you log in to
Facebook once, then walks Marketplace search results for a list of queries.
For each listing it finds, it extracts the title, price, location,
description and cover image, and appends a new entry to
`../data/listings.json` with `source: "fb_scrape"`. Cover images go to
`../assets/listings/fb-<id>.<ext>`.

The scraper never touches seed entries — re-running it only adds new data.

## Setup

```bash
cd scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

## Run

From the **repo root** (so paths resolve):

```bash
python scraper/fb_scraper.py --max 5
```

First run: a browser window opens; log in, solve any 2FA, then the script
continues automatically. Session cookies are saved to
`scraper/.cookies.json` (gitignored) and reused next time.

Custom queries:

```bash
python scraper/fb_scraper.py --query "haunted doll" --query "dentist chair" --max 8
```

Default preset: haunted doll, taxidermy, clown painting, weird painting, used
toilet, antique dentist chair, garden gnome, vintage mannequin.

## Known limitations

- Facebook rotates DOM class names constantly, so extraction is best-effort
  and will skip (rather than crash on) listings it can't parse.
- Listings without a numeric price are skipped.
- Marketplace is heavily geo-localized; set your FB location to a large US
  metro for best weirdness-per-minute yields.
- Rate limits: the script sleeps 3–8 seconds between actions. Don't remove
  that. Going too fast gets you a checkpoint.
- If Facebook challenges your session, cookies are invalidated — delete
  `.cookies.json` and rerun to log in again.

## Safety checklist before committing scraper output

- [ ] Scraped images don't contain people's faces / license plates / addresses.
- [ ] Listing text doesn't include phone numbers or personal info.
- [ ] You're comfortable republishing each listing publicly on your site.

When in doubt, don't commit it.
