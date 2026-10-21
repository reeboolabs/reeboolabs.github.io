/* Game Dev Mega Kit page: the one signature moment.
   "One style, one game": the section pins, and scrolling steps the camera into the kit scene, from the whole screen
   down to a single 16x32 hero frame, by whole-number zoom levels so every pixel stays square.
   Off under reduced motion and without GSAP: the section is then a plain image with all four notes visible. */
(() => {
  'use strict';
  const sec = document.querySelector('[data-zoom]');
  const gsap = window.gsap, ST = window.ScrollTrigger;
  if (!sec || !gsap || !ST || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ST);

  const stage = sec.querySelector('.mk-zoom__stage');
  const cam = sec.querySelector('.mk-zoom__camera');
  const world = sec.querySelector('.mk-zoom__world');
  const frame = sec.querySelector('.mk-zoom__frame');
  const readout = sec.querySelector('[data-zoom-readout]');
  const steps = [...sec.querySelectorAll('.mk-zoom__step')];
  const W = 320, H = 180; // the scene, in kit pixels

  sec.classList.add('is-live');
  gsap.set(world, { transformOrigin: '0 0' });

  // Whole-number zoom levels from the camera size: 'fit' shows the whole 320x180 screen, step 0 the knight's
  // full 16x32 frame as large as the camera allows.
  let levels = [];
  const measure = () => {
    const cw = cam.clientWidth, ch = cam.clientHeight;
    const fit = Math.max(1, Math.floor(Math.min(cw / W, ch / H))); // whole numbers only
    const s0 = Math.max(4, Math.floor((ch * 0.8) / 32));
    const s1 = Math.max(3, Math.round((s0 * 2) / 3));
    const s2 = Math.max(2, Math.min(s1 - 1, Math.round(s0 / 3)));
    const byStep = { 0: s0, 1: s1, 2: Math.max(s2, Math.ceil(fit)), fit };
    levels = steps.map((el) => byStep[el.dataset.zoomStep]);
  };

  let cur = -1;
  const place = (i, instant) => {
    const st = steps[i];
    const cw = cam.clientWidth, ch = cam.clientHeight;
    const s = levels[i];
    const fx = Number(st.dataset.fx), fy = Number(st.dataset.fy);
    // centre the focus point, but never show past the edge of the map; whole CSS pixels only
    const x = W * s <= cw ? Math.round((cw - W * s) / 2) : Math.round(Math.min(0, Math.max(cw - W * s, cw / 2 - fx * s)));
    const y = H * s <= ch ? Math.round((ch - H * s) / 2) : Math.round(Math.min(0, Math.max(ch - H * s, ch / 2 - fy * s)));
    world.style.setProperty('--s', String(s));
    gsap.to(world, { x, y, scale: s, duration: instant ? 0 : 0.3, ease: 'steps(3)', overwrite: true });
    frame.classList.toggle('is-on', st.dataset.zoomStep === '0');
    readout.textContent = (i + 1) + '/' + steps.length + ' ' + (st.dataset.zoomStep === 'fit' ? 'whole screen' : s + 'x');
    steps.forEach((el, j) => el.classList.toggle('is-on', j === i));
  };

  const pick = (p) => Math.min(steps.length - 1, Math.floor(p * steps.length));
  const trigger = ST.create({
    trigger: sec,
    start: 'top top',
    end: () => '+=' + Math.round(innerHeight * 2),
    pin: stage,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      const i = pick(self.progress);
      if (i !== cur) { cur = i; place(i, false); }
    },
    onRefreshInit: measure,
    onRefresh: (self) => { measure(); cur = pick(self.progress); place(cur, true); },
  });
  measure();
  place(0, true);
  cur = 0;

  // Reduce Motion switched on mid-visit: drop the pin and go back to the still layout.
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    if (!e.matches) return;
    trigger.kill(true);
    gsap.set(world, { clearProps: 'transform' });
    sec.classList.remove('is-live');
  });
})();
