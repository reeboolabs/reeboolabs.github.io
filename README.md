# reeboolabs.com (repo reeboolabs/reeboolabs.github.io)

Static GitHub Pages site for REEBOO Labs.

| Path | What |
|---|---|
| `/index.html` | Company home page. Edited by hand since 2026-10-21 (the first version came from `../tools/build_site.py`, which is now out of date; do not re-run it without porting the changes) |
| `/game-dev-mega-kit/` | Game Dev Mega Kit showcase page (from `../tools/mega_kit_page.tpl.html` + `../tools/build_mega_kit_page.py`) |
| `/404.html` | Designed 404 (GitHub Pages serves it for missing paths) |
| `/assets/` | CSS, JS, self-hosted Outfit font (OFL, `assets/fonts/OFL.txt`), brand images, pack covers (our own itch.io cover art, webp) |
| `/assets/img/og-home.png` | Link preview image for the home page (1200 x 630) |
| `/assets/media/oho/` | Oho, our mascot: short muted clips (MP4 + WebM) and WebP stills, built by `../tools/build_oho_media.py` from the approved flat clips in `B:/Projects/REEBOO Mascot`. Played by `/assets/js/oho.js` (never under reduced motion) |
| `/assets/js/field.js` | The interactive hero grid (WebGL): pointer light, click/tap effects, effect tray, optional sound. Off under reduced motion, Save-Data, without WebGL or on slow devices |
| `/assets/media/fx/` | `vfx-loop-640.mp4` (9.5 s muted loop cut from our Stylized VFX Pack trailer, captions cropped out) and its poster, for the Custom work stage |
| `/assets/media/sfx/` | Four short MP3s from our Sci-Fi & Magic Combat SFX free sample, played by the hero only after the visitor turns Sound on |
| `/assets/img/apps/` | Sarfi and Nanieh screenshots (from their Android builds) and a screenshot of this site's hero, for Custom work |
| `/sarfi/`, `/nanieh/` | App home and privacy pages. Do not change |
| `/google81c1f74d41483d65.html` | Search Console verification. Keep |
| `robots.txt`, `sitemap.xml`, `site.webmanifest`, `CNAME` | Crawling, install and domain files |

## Domain
The base URL is **https://reeboolabs.com/** (`CNAME`, canonical tags, `sitemap.xml`, `robots.txt`).
Store links use **https://reeboolabs.itch.io/<slug>**.

## When you change something
- Bump the `?v=` query on the CSS/JS links in every page (format `YYYYMMDD` + letter) so browsers load the new files.
- Update `<lastmod>` in `sitemap.xml` for the pages you changed.
- Prices and counts come from the live itch.io pages. Check them there before you edit a number.

## Dated content
- Pixel VFX Mega Pack launch sale ($6 until 2026-10-28): the sale line is in the HTML with `hidden` and is shown by JS
  only until 2026-10-28 23:59 Oman time. After that date, remove the sale line and set the Pixel VFX Mega Pack offer in
  the home page JSON-LD back to `"price":"12.00"` without `priceValidUntil`.
- Pack and sample counts on the home page (44 packs with a free sample, 2 starter templates with a browser demo, the Game Dev
  Mega Kit; 46 rows in Free samples) were checked on reeboolabs.itch.io on 2026-10-28. Several packs were on a 20% sale
  that day; the cards show the regular price.

## Third-party code
- GSAP 3.15.0 + ScrollTrigger (GreenSock standard no-charge licence) and Lenis 1.3.26 (MIT), from jsDelivr with exact
  versions and SRI hashes. Lenis CSS rules are inlined in `assets/css/site.css`.
- Oho clips are our own files on our own domain (CSP `media-src 'self'`); nothing is loaded from a third party for them.
- No trackers, cookies, forms or analytics. The hero stores one `sessionStorage` flag (`reeboo-boot`) so its intro wave plays once per tab. CSP and referrer policy are set by meta tags (GitHub Pages cannot send
  headers, so `frame-ancestors`, HSTS and `X-Content-Type-Options` cannot be set from here).
