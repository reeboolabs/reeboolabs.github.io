/* Oho, the REEBOO Labs mascot: short muted reaction clips (2 s or less, our own flat style, no audio track).
   Clips load only when their screen comes near the viewport, pause off screen and in hidden tabs, and are never
   created under prefers-reduced-motion: then the still image stays, and a step swaps in a still of the reaction.
   Without JavaScript the still image (the resting face, which is the brand icon) is all there is. No network calls
   beyond our own /assets/media/oho/ files. */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const BASE = '/assets/media/oho/';
  const probe = document.createElement('video');
  const FMT = probe.canPlayType('video/mp4; codecs="avc1.640015"') ? 'mp4'
    : probe.canPlayType('video/webm; codecs="vp9"') ? 'webm' : '';
  const motionOn = () => !reduce.matches && FMT !== '';
  const all = [];

  class Oho {
    constructor(root) {
      this.root = root;
      this.screen = root.classList.contains('oho-screen') ? root : root.querySelector('.oho-screen');
      this.still = this.screen.querySelector('img');
      this.restSrc = this.still.getAttribute('src');
      this.size = root.dataset.ohoSize;
      this.idle = root.dataset.ohoIdle || '';
      this.intro = root.dataset.ohoIntro || '';
      this.names = [...new Set([this.idle, this.intro, ...(root.dataset.ohoClips || '').split(' ')].filter(Boolean))];
      this.videos = {};
      this.current = null;
      this.reacting = false;
      this.loaded = false;
      this.inView = false;
      this.introDone = false;
      new IntersectionObserver(([en]) => { if (en.isIntersecting) this.load(); }, { rootMargin: '400px 0px' }).observe(this.screen);
      new IntersectionObserver(([en]) => {
        this.inView = en.isIntersecting;
        if (!this.inView) { this.pause(); return; }
        if (!motionOn()) return;
        if (!this.introDone && this.intro) { this.introDone = true; this.play(this.intro); } else this.rest();
      }, { threshold: 0.4 }).observe(this.screen);
      if (!motionOn() && root.dataset.ohoStill) this.still.src = this.peak(root.dataset.ohoStill);
    }
    shown() { return this.screen.offsetParent !== null; }
    peak(name) { return `${BASE}${name}-${this.size}-peak.webp`; }
    load() {
      if (this.loaded || !motionOn() || !this.shown()) return;
      this.loaded = true;
      for (const name of this.names) {
        const v = document.createElement('video');
        v.className = 'oho-video';
        v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto';
        v.disablePictureInPicture = true; v.loop = name === this.idle;
        v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
        v.setAttribute('tabindex', '-1');
        v.src = `${BASE}${name}-${this.size}.${FMT}`;
        v.addEventListener('ended', () => { if (v === this.current) { this.reacting = false; this.rest(); } });
        this.screen.append(v);
        this.videos[name] = v;
      }
    }
    show(v) { for (const x of Object.values(this.videos)) x.classList.toggle('is-on', x === v); }
    play(name) {
      if (!motionOn()) { this.still.src = name && name !== this.idle ? this.peak(name) : this.restSrc; return; }
      this.load();
      const v = this.videos[name];
      if (!v) return;
      if (this.current && this.current !== v) this.current.pause();
      this.current = v;
      this.reacting = name !== this.idle;
      try { v.currentTime = 0; } catch (e) { /* not seekable yet */ }
      // A clip without a decoded frame draws nothing, so the still (the same resting face) shows through until it plays.
      this.show(v);
      const p = v.play();
      if (p && p.catch) p.catch(() => { this.reacting = false; });
    }
    react(name) { if (!this.reacting) this.play(name); }
    rest() {
      if (this.reacting) return;
      if (this.idle && this.inView && !document.hidden && motionOn()) this.play(this.idle);
      // without an idle loop the last frame stays: every clip ends on the resting face
    }
    pause() { for (const v of Object.values(this.videos)) v.pause(); this.reacting = false; }
  }

  const byName = {};
  document.querySelectorAll('[data-oho]').forEach((el) => { const o = new Oho(el); all.push(o); byName[el.dataset.oho] = o; });
  if (!all.length) return;

  document.addEventListener('visibilitychange', () => {
    for (const o of all) { if (document.hidden) o.pause(); else if (o.inView) o.rest(); }
  });
  reduce.addEventListener('change', () => {
    if (!reduce.matches) return;
    for (const o of all) { o.pause(); for (const v of Object.values(o.videos)) v.classList.remove('is-on'); }
  });

  /* Meet Oho: each test step plays a reaction and Oho's line. */
  const stage = byName.stage;
  const say = document.querySelector('[data-oho-say]');
  const steps = [...document.querySelectorAll('[data-oho-step]')];
  steps.forEach((btn) => {
    btn.addEventListener('click', () => {
      for (const b of steps) b.setAttribute('aria-pressed', String(b === btn));
      if (say) say.textContent = btn.dataset.say || '';
      if (stage) { stage.reacting = false; stage.play(btn.dataset.ohoStep); }
    });
  });

  /* Featured packs: the small Oho in the readout reacts when you move to another pack. */
  const rail = byName.rail;
  if (rail) {
    const looks = (rail.root.dataset.ohoClips || '').split(' ').filter(Boolean);
    let lastCard = null, n = 0;
    const onCard = (card) => {
      if (!card || card === lastCard || !rail.shown()) return;
      lastCard = card;
      rail.react(looks[n++ % looks.length]);
    };
    document.querySelectorAll('.card[data-pack]').forEach((card) => {
      card.addEventListener('pointerenter', () => onCard(card));
      card.addEventListener('focusin', () => onCard(card));
    });
  }

  /* Contact: Oho waves again when you point at or focus the address. 404: Oho looks around again. */
  const contact = byName.contact;
  const mail = document.querySelector('.contact__mail');
  if (contact && mail) for (const ev of ['pointerenter', 'focus']) mail.addEventListener(ev, () => contact.react('wave'));
  const lost = byName.lost;
  if (lost) lost.screen.addEventListener('pointerenter', () => lost.react('confused'));
})();
