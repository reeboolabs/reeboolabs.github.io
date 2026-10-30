/* Our work pages (/audio/, /vfx/, /pixel/). No network calls of its own, no scroll listeners.
   - Audio: one preview at a time; the waveform shows what has played and seeks on click.
   - VFX clips: muted loops play while on screen, with a Pause button. Under reduced motion they never
     autoplay and keep the browser's own controls (same as without JavaScript).
   - Pixel loops: a Pause button swaps the animation for its still frame. Reduced motion shows the still. */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const motionOn = () => !reduce.matches;
  const safePlay = (m) => { const p = m.play(); if (p && p.catch) p.catch(() => {}); };

  /* ---------- Audio ---------- */
  const audios = [...document.querySelectorAll('.spec__media--audio audio')];
  audios.forEach((a) => {
    const box = a.closest('[data-wave]');
    const wave = box.querySelector('.spec__wave');
    const played = box.querySelector('.spec__played');
    let raf = 0;
    const draw = () => {
      const d = a.duration;
      played.style.transform = `scaleX(${d ? Math.min(1, a.currentTime / d) : 0})`;
      if (!a.paused) raf = requestAnimationFrame(draw);
    };
    a.addEventListener('play', () => {
      audios.forEach((o) => { if (o !== a) o.pause(); });
      cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
    });
    for (const ev of ['pause', 'seeked', 'ended', 'loadedmetadata']) a.addEventListener(ev, () => { cancelAnimationFrame(raf); draw(); });
    box.classList.add('is-seekable');
    wave.addEventListener('click', (ev) => {
      const r = wave.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      const go = () => { a.currentTime = f * a.duration; safePlay(a); };
      if (a.readyState >= 1 && a.duration) go();
      else { a.preload = 'metadata'; a.addEventListener('loadedmetadata', go, { once: true }); a.load(); }
    });
  });

  /* ---------- Pause buttons ---------- */
  const setLabel = (btn, paused) => { btn.querySelector('[data-state]').textContent = paused ? 'Play' : 'Pause'; };

  /* ---------- VFX clips ---------- */
  const clips = [...document.querySelectorAll('video[data-clip]')].map((v) => ({
    v, btn: v.closest('.spec').querySelector('[data-toggle]'), userPaused: false, seen: false,
  }));
  const applyMode = () => {
    for (const c of clips) {
      if (motionOn()) {
        c.v.controls = false;
        c.btn.hidden = false;
        setLabel(c.btn, c.userPaused);
        if (c.seen && !c.userPaused) safePlay(c.v);
      } else {
        c.v.pause();
        c.v.controls = true;
        c.btn.hidden = true;
      }
    }
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        const c = clips.find((x) => x.v === en.target);
        c.seen = en.isIntersecting;
        if (!motionOn()) continue;
        if (en.isIntersecting && !c.userPaused) safePlay(c.v); else c.v.pause();
      }
    }, { threshold: 0.4 });
    clips.forEach((c) => io.observe(c.v));
  }
  clips.forEach((c) => {
    c.btn.addEventListener('click', () => {
      c.userPaused = !c.userPaused;
      setLabel(c.btn, c.userPaused);
      if (c.userPaused) c.v.pause(); else safePlay(c.v);
    });
  });

  /* ---------- Pixel loops ---------- */
  const loops = [...document.querySelectorAll('img[data-anim]')].map((img) => ({
    img, btn: img.closest('.spec').querySelector('[data-toggle]'), paused: false,
  }));
  const applyPixel = () => {
    for (const l of loops) {
      l.btn.hidden = !motionOn();
      setLabel(l.btn, l.paused);
    }
  };
  loops.forEach((l) => {
    l.btn.addEventListener('click', () => {
      l.paused = !l.paused;
      l.img.src = l.paused ? l.img.dataset.still : l.img.dataset.anim;
      setLabel(l.btn, l.paused);
    });
  });

  applyMode();
  applyPixel();
  reduce.addEventListener('change', () => { applyMode(); applyPixel(); });
})();
