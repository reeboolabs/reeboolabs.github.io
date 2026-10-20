# reeboolabs.com (repo REEBO0/reebo0.github.io)

Static GitHub Pages site for REEBOO Labs.

| Path | What |
|---|---|
| `/index.html` | Company site (v1, branch `site-v1`). Built from `../tools/build_site.py` (outside this repo) with copy from `../docs/copy.md` and `../docs/packs.json` |
| `/404.html` | Designed 404 (GitHub Pages serves it for missing paths) |
| `/assets/` | CSS, JS, self-hosted Outfit font (OFL, `assets/fonts/OFL.txt`), brand images, pack covers (our own itch.io cover art, webp) |
| `/sarfi/`, `/nanieh/` | App home and privacy pages. Do not change |
| `/google81c1f74d41483d65.html` | Search Console verification. Keep |
| `robots.txt`, `sitemap.xml`, `site.webmanifest`,## Domain (reeboolabs.com)
The base URL is **https://reeboolabs.com/** (`BASE` in `../tools/build_site.py`, `CNAME`, `sitemap.xml`, `robots.txt`).
https://reebo0.github.io/ 301-redirects here. Store links use **https://reeboolabs.itch.io/<slug>**
(the itch store was renamed from reebo0.itch.io on 2026-10-20; old links 302-redirect).

purpose until DNS is ready.

## Dated content
- Pixel VFX Mega Pack launch sale ($6 until 2026-10-28): the line is in the HTML with `hidden` and is shown by JS
  only until 2026-10-28 23:59 Oman time. After that date, remove `sale_price`/`sale_ends` from `packs.json` and rebuild.

## Third-party code
- GSAP 3.15.0 + ScrollTrigger (GreenSock standard no-charge licence) and Lenis 1.3.26 (MIT), from jsDelivr with exact
  versions and SRI hashes. Lenis CSS rules are inlined in `assets/css/site.css`.
- No trackers, cookies, forms or analytics. CSP is set by a meta tag (GitHub Pages cannot send headers, so
  `frame-ancestors`, HSTS and `X-Content-Type-Options` cannot be set from here).
