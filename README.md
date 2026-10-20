# reebo0.github.io

Static GitHub Pages site for REEBOO Labs.

| Path | What |
|---|---|
| `/index.html` | Company site (v1, branch `site-v1`). Built from `../tools/build_site.py` (outside this repo) with copy from `../docs/copy.md` and `../docs/packs.json` |
| `/404.html` | Designed 404 (GitHub Pages serves it for missing paths) |
| `/assets/` | CSS, JS, self-hosted Outfit font (OFL, `assets/fonts/OFL.txt`), brand images, pack covers (our own itch.io cover art, webp) |
| `/sarfi/`, `/nanieh/` | App home and privacy pages. Do not change |
| `/google81c1f74d41483d65.html` | Search Console verification. Keep |
| `robots.txt`, `sitemap.xml`, `site.webmanifest`, favicons | Site metadata |

## Domain switch (reeboolabs.com)
The base URL is **https://reebo0.github.io/** for now. When DNS for reeboolabs.com is connected, switch it:
1. In `../tools/build_site.py` set `BASE = "https://reeboolabs.com/"`, run `python -I build_site.py`.
2. Update `sitemap.xml` (`<loc>`) and `robots.txt` (`Sitemap:`).
3. Add the `CNAME` file (`reeboolabs.com`) and set the custom domain + "Enforce HTTPS" in the repo's Pages settings.
   No CNAME is committed on purpose until DNS is ready.

## Dated content
- Pixel VFX Mega Pack launch sale ($6 until 2026-10-28): the line is in the HTML with `hidden` and is shown by JS
  only until 2026-10-28 23:59 Oman time. After that date, remove `sale_price`/`sale_ends` from `packs.json` and rebuild.

## Third-party code
- GSAP 3.15.0 + ScrollTrigger (GreenSock standard no-charge licence) and Lenis 1.3.26 (MIT), from jsDelivr with exact
  versions and SRI hashes. Lenis CSS rules are inlined in `assets/css/site.css`.
- No trackers, cookies, forms or analytics. CSP is set by a meta tag (GitHub Pages cannot send headers, so
  `frame-ancestors`, HSTS and `X-Content-Type-Options` cannot be set from here).
