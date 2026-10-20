/* REEBOO Labs website v1. One clock (GSAP ticker, rAF fallback), no scroll listeners, no network calls. */
(() => {
  'use strict';

  const doc = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const motionOn = () => !reduce.matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const gsap = window.gsap;

  /* ---------- One clock ---------- */
  const tickers = [];
  const onTick = (fn) => tickers.push(fn);
  const runTick = (time) => { for (const fn of tickers) fn(time); };
  if (gsap) {
    gsap.ticker.add((t) => runTick(t * 1000));
  } else {
    const loop = (t) => { runTick(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  /* ---------- Smooth scroll (long page; off under reduced motion) ---------- */
  let lenis = null;
  if (motionOn() && window.Lenis && gsap) {
    lenis = new window.Lenis({
      autoRaf: false,
      anchors: { offset: -88 },
      lerp: 0.12,
      wheelMultiplier: 1,
    });
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    if (window.ScrollTrigger) {
      gsap.registerPlugin(window.ScrollTrigger);
      lenis.on('scroll', window.ScrollTrigger.update);
    }
  }
  reduce.addEventListener('change', () => {
    if (reduce.matches && lenis) { lenis.destroy(); lenis = null; }
  });

  /* ---------- Header: solid after the hero top, steps aside on scroll down ---------- */
  const header = document.querySelector('.site-header');
  const nav = document.querySelector('.nav');
  let lastY = window.scrollY;
  onTick(() => {
    const y = window.scrollY;
    if (Math.abs(y - lastY) < 4) return;
    doc.classList.toggle('is-scrolled', y > 24);
    const navOpen = nav && nav.classList.contains('is-open');
    const focusInHeader = header && header.contains(document.activeElement);
    doc.classList.toggle('header-away', y > 320 && y > lastY && !navOpen && !focusInHeader);
    lastY = y;
  });
  if (header) header.addEventListener('focusin', () => doc.classList.remove('header-away'));

  /* ---------- Mobile menu (disclosure) ---------- */
  const toggle = document.querySelector('.nav-toggle');
  if (toggle && nav) {
    toggle.hidden = false;
    const setOpen = (open, returnFocus) => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (!open && returnFocus) toggle.focus();
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (ev) => { if (ev.target.closest('.nav__list a')) setOpen(false); });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false, true);
    });
    document.addEventListener('pointerdown', (ev) => {
      if (nav.classList.contains('is-open') && !nav.contains(ev.target)) setOpen(false);
    });
  }

  /* ---------- Sale line: shown only while the itch sale runs (ends 2026-10-28, Oman time) ---------- */
  document.querySelectorAll('[data-sale-ends]').forEach((el) => {
    const end = Date.parse(el.dataset.saleEnds + 'T23:59:59+04:00');
    if (!Number.isNaN(end) && Date.now() <= end) el.hidden = false;
  });

  /* ---------- Reveals: covers scan in, steps fill; content is visible without JS ---------- */
  if (motionOn() && 'IntersectionObserver' in window) {
    doc.classList.add('reveal-ready');
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      }
    }, { rootMargin: '0px 0px -12% 0px' });
    document.querySelectorAll('[data-scan], .steps').forEach((el) => io.observe(el));
  }

  /* ---------- The goggles: pupils look at what you look at, one cell at a time ---------- */
  const pointer = { x: -1, y: -1, t: -1e9 };
  let focusEl = null;
  window.addEventListener('pointermove', (ev) => { pointer.x = ev.clientX; pointer.y = ev.clientY; pointer.t = performance.now(); }, { passive: true });
  window.addEventListener('pointerdown', (ev) => { pointer.x = ev.clientX; pointer.y = ev.clientY; pointer.t = performance.now(); }, { passive: true });
  document.addEventListener('focusin', (ev) => {
    const el = ev.target;
    focusEl = el.matches && el.matches(':focus-visible') ? el : null;
  });
  document.addEventListener('focusout', () => { focusEl = null; });

  const center = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.width > 0;
  };

  // Pupil rest pose = the approved mark (looking up and right): top-left cell (3,2) inside the 7x7 eye.
  const REST = { x: 3, y: 2 };
  const STEP_MS = 64;

  class Goggles {
    constructor(root) {
      this.root = root;
      this.svg = root.querySelector('svg.goggles');
      this.eyes = [...root.querySelectorAll('.pupils')].map((g) => ({
        g, col: g.dataset.eye === 'L' ? 3.5 : 12.5, cur: { ...REST }, want: { ...REST },
      }));
      this.last = 0;
      this.inView = true;
      new IntersectionObserver(([en]) => { this.inView = en.isIntersecting; }).observe(root);
    }
    aim(target) {
      if (!target) { for (const e of this.eyes) e.want = { ...REST }; return; }
      const r = this.svg.getBoundingClientRect();
      const cs = r.width / 16;
      for (const e of this.eyes) {
        const ex = r.left + e.col * cs, ey = r.top + 3.5 * cs;
        const dx = target.x - ex, dy = target.y - ey;
        const dist = Math.hypot(dx, dy) || 1;
        const s = Math.min(1, dist / (cs * 5));
        const px = 2.5 + (dx / dist) * s * 1.9;
        const py = 2.5 + (dy / dist) * s * 1.9;
        e.want = { x: Math.max(1, Math.min(4, Math.round(px))), y: Math.max(1, Math.min(4, Math.round(py))) };
      }
    }
    step(now) {
      if (now - this.last < STEP_MS) return;
      this.last = now;
      for (const e of this.eyes) {
        const c = e.cur, w = e.want;
        if (c.x === w.x && c.y === w.y) continue;
        c.x += Math.sign(w.x - c.x);
        c.y += Math.sign(w.y - c.y);
        e.g.style.transform = `translate(${c.x - REST.x}px, ${c.y - REST.y}px)`;
      }
    }
  }

  const heroRoot = document.querySelector('[data-goggles="hero"]');
  const railRoot = document.querySelector('[data-goggles="rail"]');
  const lostRoot = document.querySelector('[data-goggles="lost"]');
  const hero = heroRoot && new Goggles(heroRoot);
  const rail = railRoot && new Goggles(railRoot);
  const lost = lostRoot && new Goggles(lostRoot);
  const contactRoot = document.querySelector('[data-goggles="contact"]');
  const contactG = contactRoot && new Goggles(contactRoot);
  const mailEl = document.querySelector('.contact__mail');
  const lostLooks = lostRoot ? [...document.querySelectorAll('.nf a, .nf h1, .site-header a')] : [];

  // Points of interest the goggles visit when nobody is moving.
  const looks = [...document.querySelectorAll('[data-look], .hero h1, .nf h1')];
  let idleIdx = 0, idleNext = 0, idlePoint = null;
  let lastInput = performance.now();
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
    window.addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true });
  }
  const idleTarget = (now, pool) => {
    if (now - lastInput > 5000) return null; // stop wandering: back to the approved rest pose
    if (now > idleNext) {
      const list = pool.filter(visible);
      idleNext = now + 1700 + Math.random() * 900;
      if (Math.random() < 0.3 || !list.length) {
        idlePoint = null; // back to the rest pose, as on the logo
      } else {
        idleIdx = (idleIdx + 1 + Math.floor(Math.random() * list.length)) % list.length;
        const el = list[idleIdx];
        const r = el.getBoundingClientRect();
        idlePoint = { x: r.left + r.width * (0.15 + Math.random() * 0.7), y: r.top + r.height / 2 };
      }
    }
    return idlePoint;
  };

  // Featured packs: the rail goggles look at the pack you are on; the readout names it.
  const cards = [...document.querySelectorAll('.card[data-pack]')];
  const readMeta = document.querySelector('.readout__meta');
  const readName = document.querySelector('.readout__name');
  let activeCard = cards[0] || null, hoverCard = null;
  const showCard = (card) => {
    if (!card || !readName) return;
    if (readName.textContent !== card.dataset.name) {
      readName.textContent = card.dataset.name;
      readMeta.textContent = card.dataset.meta;
    }
  };
  // Active card = the one with the most visible height below the header/sticky strip (checked every 150 ms).
  const sticky = document.querySelector('.packs__sticky');
  let lastPick = 0;
  const pickActive = (now) => {
    if (now - lastPick < 150) return;
    lastPick = now;
    const sr = sticky ? sticky.getBoundingClientRect() : null;
    const top = sr && sr.width > innerWidth * 0.6 ? Math.max(0, sr.bottom) : 0;
    let best = null, bestH = 0;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, top);
      if (h > bestH) { bestH = h; best = c; }
    }
    if (best) activeCard = best;
  };
  cards.forEach((c) => {
    c.addEventListener('pointerenter', () => { hoverCard = c; });
    c.addEventListener('pointerleave', () => { if (hoverCard === c) hoverCard = null; });
  });

  /* ---------- Hero pixel field: cells light up where the goggles look ---------- */
  const canvas = document.querySelector('.hero__field');
  const field = { ctx: null, w: 0, h: 0, dpr: 1, lx: -999, ly: -999, drawn: '' };
  const PITCH = 20, INSET = 1.2, SIZE = 17.6, RAD = 3.4;
  const LEVELS = ['rgba(241,238,230,0.05)', 'rgba(241,238,230,0.09)', 'rgba(241,238,230,0.16)'];
  const sizeField = () => {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    field.dpr = Math.min(2, window.devicePixelRatio || 1);
    field.w = r.width; field.h = r.height;
    canvas.width = Math.round(r.width * field.dpr);
    canvas.height = Math.round(r.height * field.dpr);
    field.ctx = canvas.getContext('2d');
    field.ctx.setTransform(field.dpr, 0, 0, field.dpr, 0, 0);
    field.drawn = '';
  };
  const roundRect = (ctx, x, y, s, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, s, s, r); else ctx.rect(x, y, s, s);
    ctx.fill();
  };
  const drawField = (pt) => {
    if (!field.ctx) return;
    const ctx = field.ctx;
    const hr = canvas.getBoundingClientRect();
    // the light trails the gaze point, so it travels across the grid cell by cell
    const tx = pt ? pt.x - hr.left : field.lx, ty = pt ? pt.y - hr.top : field.ly;
    field.lx += (tx - field.lx) * 0.18;
    field.ly += (ty - field.ly) * 0.18;
    const cx = Math.floor(field.lx / PITCH), cy = Math.floor(field.ly / PITCH);
    const key = cx + ',' + cy;
    if (key === field.drawn) return;
    field.drawn = key;
    ctx.clearRect(0, 0, field.w, field.h);
    const R = 6;
    for (let j = -R; j <= R; j++) {
      for (let i = -R; i <= R; i++) {
        const d = Math.hypot(i, j);
        if (d > R) continue;
        // a stable per-cell hash keeps the lit shape crisp and pixel-like, not a soft blob
        const h = ((cx + i) * 73856093 ^ (cy + j) * 19349663) >>> 0;
        const level = d < 2 ? 2 : d < 4 ? 1 : (h % 3 === 0 ? 0 : -1);
        if (level < 0) continue;
        ctx.fillStyle = LEVELS[level];
        roundRect(ctx, (cx + i) * PITCH + INSET, (cy + j) * PITCH + INSET, SIZE, RAD);
      }
    }
  };
  if (canvas && motionOn()) {
    sizeField();
    let rz;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(sizeField, 150); }, { passive: true });
  }

  /* ---------- Drive everything from the one clock ---------- */
  onTick((now) => {
    if (!motionOn()) {
      for (const g of [hero, rail, lost, contactG]) if (g) { g.aim(null); g.step(now); }
      return;
    }
    const recent = finePointer ? now - pointer.t < 2500 : now - pointer.t < 1200;
    const ptr = pointer.t > 0 ? { x: pointer.x, y: pointer.y } : null;
    const foc = focusEl && document.activeElement === focusEl ? center(focusEl) : null;

    if (hero && hero.inView) {
      const t = foc && heroRoot.closest('section').contains(focusEl) ? foc : recent ? ptr : idleTarget(now, looks);
      hero.aim(t);
      hero.step(now);
      if (field.ctx) drawField(t || (heroRoot ? center(heroRoot.querySelector('svg')) : null));
    }

    if (rail && rail.inView) {
      pickActive(now);
      const focCard = focusEl && focusEl.closest ? focusEl.closest('.card') : null;
      const card = focCard || hoverCard || activeCard;
      showCard(card);
      let t = null;
      if (focCard || hoverCard) t = center(card.querySelector('.card__media'));
      else if (recent && finePointer) t = ptr;
      else if (card) t = center(card.querySelector('.card__media'));
      rail.aim(t);
      rail.step(now);
    }

    if (contactG && contactG.inView) {
      const t = foc && contactRoot.closest('section').contains(focusEl) ? foc : (recent && finePointer) ? ptr : center(mailEl);
      contactG.aim(t);
      contactG.step(now);
    }

    if (lost && lost.inView) {
      lost.aim(recent ? ptr : idleTarget(now, lostLooks));
      lost.step(now);
    }
  });
})();
