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
    gsap.ticker.add(() => runTick(performance.now())); // one clock, in performance.now() units like the input stamps
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

  /* ---------- Hero field (assets/js/field.js) reads the gaze; effects pull the goggles' eyes ---------- */
  const shared = window.REEBOO = window.REEBOO || {};
  shared.gaze = null;
  const fxLook = { x: 0, y: 0, t: -1e9 };
  document.addEventListener('reeboo:fx', (ev) => { fxLook.x = ev.detail.x; fxLook.y = ev.detail.y; fxLook.t = performance.now(); });

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
      const fxNow = now - fxLook.t < 900;
      const t = fxNow ? fxLook : foc && heroRoot.closest('section').contains(focusEl) ? foc : recent ? ptr : idleTarget(now, looks);
      hero.aim(t);
      hero.step(now);
      shared.gaze = t ? { x: t.x, y: t.y } : null;
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

  /* ---------- Magnetic buttons: big calls to action lean toward a fine pointer, in 2 px steps ---------- */
  if (motionOn() && finePointer && gsap) {
    document.querySelectorAll('[data-magnet]').forEach((el) => {
      const qx = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'expo.out' });
      const qy = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'expo.out' });
      el.addEventListener('pointermove', (ev) => {
        const r = el.getBoundingClientRect();
        const dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
        const c = (v) => Math.max(-12, Math.min(12, Math.round(v / 2) * 2));
        qx(c(dx * 0.18)); qy(c(dy * 0.3));
      }, { passive: true });
      el.addEventListener('pointerleave', () => { qx(0); qy(0); }, { passive: true });
    });
  }

  /* ---------- Custom work: one screen changes shape as you read (game, phone, browser) ---------- */
  const build = document.querySelector('[data-build]');
  const stage = build && build.querySelector('[data-stage]');
  const wide = matchMedia('(min-width: 1000px)');
  if (build && stage && motionOn() && 'IntersectionObserver' in window) {
    const frame = stage.querySelector('.stage__frame');
    const items = [...build.querySelectorAll('.build__item')];
    const layers = {};
    stage.querySelectorAll('[data-layer]').forEach((l) => { layers[l.dataset.layer] = l; });
    let state = '', on = false, video = null;
    const rects = {};
    const measure = () => {
      const w = frame.clientWidth, h = frame.clientHeight;
      const fit = (rw, rh) => { const s = Math.min(w / rw, h / rh); return { w: rw * s, h: rh * s }; };
      rects.game = fit(16, 9.6);
      rects.phone = fit(9, 20);
      rects.browser = fit(16, 11.4);
      for (const [k, r] of Object.entries(rects)) {
        const l = layers[k];
        if (!l) continue;
        l.style.width = r.w + 'px'; l.style.height = r.h + 'px';
        l.style.left = (w - r.w) / 2 + 'px'; l.style.top = (h - r.h) / 2 + 'px';
      }
      if (state) shape(state);
    };
    const shape = (k) => {
      const r = rects[k], w = frame.clientWidth, h = frame.clientHeight;
      const x = (w - r.w) / 2, y = (h - r.h) / 2, rad = k === 'phone' ? 34 : 12;
      frame.style.clipPath = `inset(${y}px ${x}px ${y}px ${x}px round ${rad}px)`;
    };
    const setState = (k) => {
      if (k === state) return;
      state = k;
      stage.dataset.state = k;
      shape(k);
      for (const [n, l] of Object.entries(layers)) l.classList.toggle('is-on', n === k);
      items.forEach((it) => it.classList.toggle('is-active', it.dataset.shape === k));
      if (k === 'game') {
        if (!video) {
          const holder = layers.game;
          video = document.createElement('video');
          video.muted = true; video.loop = true; video.playsInline = true;
          video.setAttribute('muted', ''); video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true');
          video.preload = 'auto';
          video.poster = holder.querySelector('img').currentSrc || holder.querySelector('img').src;
          video.src = '/assets/media/fx/vfx-loop-640.mp4';
          video.className = 'stage__video';
          holder.append(video);
        }
        const p = video.play(); if (p && p.catch) p.catch(() => {});
      } else if (video) video.pause();
    };
    const enable = () => {
      if (on || !wide.matches) return;
      on = true;
      stage.hidden = false;
      build.classList.add('build--stage');
      measure();
      setState(items[0].dataset.shape);
    };
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting && on) setState(en.target.dataset.shape);
    }, { rootMargin: '-45% 0px -45% 0px' });
    items.forEach((it) => io.observe(it));
    // pause the clip when the section is off screen
    new IntersectionObserver(([en]) => {
      if (!video) return;
      if (en.isIntersecting && state === 'game') { const p = video.play(); if (p && p.catch) p.catch(() => {}); } else video.pause();
    }).observe(stage);
    // the phone shows the app you point at; otherwise the two apps take turns
    const phone = layers.phone;
    let appIdx = 0, appHold = 0;
    const showApp = (name) => { if (phone) phone.dataset.app = name; };
    build.querySelectorAll('[data-app]').forEach((a) => {
      const pick = () => { showApp(a.dataset.app); appHold = performance.now() + 4000; };
      a.addEventListener('pointerenter', pick);
      a.addEventListener('focus', pick);
    });
    let appNext = 0;
    onTick((now) => {
      if (!on || state !== 'phone' || now < appHold) return;
      if (now > appNext) {
        if (appNext) { appIdx = 1 - appIdx; showApp(appIdx ? 'nanieh' : 'sarfi'); }
        appNext = now + 3200;
      }
    });
    let rz2;
    window.addEventListener('resize', () => { clearTimeout(rz2); rz2 = setTimeout(() => { if (on) measure(); }, 150); }, { passive: true });
    wide.addEventListener('change', () => {
      if (wide.matches) enable();
      else if (on) { on = false; stage.hidden = true; build.classList.remove('build--stage'); if (video) video.pause(); }
    });
    enable();
  }
})();
