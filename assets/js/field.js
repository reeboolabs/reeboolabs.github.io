/* REEBOO Labs hero field. The pixel-goggle grid lights up under your pointer or finger, and a click or tap plays an
   effect in the style of our VFX packs. One WebGL draw per frame on the GSAP ticker (rAF only if GSAP is missing).
   Off under reduced motion, Save-Data, without WebGL, and on devices that cannot hold the frame rate: the static
   grid image and all text stay as they are. No network calls except our own sound files, and only after "Sound" is on. */
(() => {
  'use strict';

  const hero = document.querySelector('.hero');
  const canvas = hero && hero.querySelector('.hero__field');
  if (!canvas) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const conn = navigator.connection;
  if (reduce.matches || (conn && conn.saveData)) { document.documentElement.classList.add('field-off'); return; }

  const doc = document.documentElement;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const PITCH = 20;          // one cell of the brand pattern tile (480 px tile, 24 cells)
  const CREAM = [0.945, 0.933, 0.902];
  const RED = [1.0, 0.29, 0.239];

  /* ---------- Effects: soft glows, dots and sparks on the cell grid (no star or line-drawn shapes) ---------- */
  const KINDS = ['sparks', 'shockwave', 'pickup', 'dissolve'];
  const NAMES = { sparks: 'Hit sparks', shockwave: 'Shockwave', pickup: 'Pickup glow', dissolve: 'Dissolve' };
  let kind = 'sparks';

  let gl, prog, tex, buf, uni = {};
  let cols = 0, rows = 0, W = 0, H = 0, dpr = 1;
  let heat, red, fheat, fred, base, pixels;
  let fresh = false; // stamps into the one-frame buffer (crisp rings and discs) instead of the trail buffer
  const fx = [];
  const ptr = { x: -1e4, y: -1e4, t: -1e9, lastX: 0, lastY: 0, travel: 0, inside: false };
  let inView = true, running = false, dead = false;
  let mask = [0, 0, 0, 0];
  const rnd = Math.random;
  const hash = (i, j) => {
    let h = (i * 374761393 + j * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FRAG = [
    'precision mediump float;',
    'uniform sampler2D uT;uniform vec2 uGrid;uniform vec2 uRes;uniform float uPitch;uniform float uDpr;uniform vec4 uMask;',
    'uniform vec3 uCream;uniform vec3 uRed;',
    'void main(){',
    ' vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uDpr;',
    ' vec2 c=px/uPitch; vec2 id=floor(c); vec2 f=c-id;',
    ' vec4 s=texture2D(uT,(id+0.5)/uGrid);',
    // one rounded cell: 0.88 of the pitch, corner 19.3% (the logo pixel)
    ' vec2 q=abs(f-0.5)-vec2(0.44-0.085); float d=length(max(q,0.))-0.085;',
    ' float aa=1.2/(uPitch*uDpr); float inside=1.-smoothstep(-aa,aa,d);',
    // soft glow between cells: a small blur of the same cell data
    ' vec2 g=c/uGrid; vec2 o=vec2(0.8)/uGrid;',
    ' vec4 b=(texture2D(uT,g)*2.+texture2D(uT,g+vec2(o.x,0.))+texture2D(uT,g-vec2(o.x,0.))+texture2D(uT,g+vec2(0.,o.y))+texture2D(uT,g-vec2(0.,o.y)))/6.;',
    ' float m=1.;',
    ' if(uMask.z>0.){vec2 e=max(uMask.xy-px,px-uMask.zw); m=mix(0.3,1.,smoothstep(-8.,40.,max(e.x,e.y)));}',
    ' float lit=s.r*m; float a=inside*clamp(s.b+lit*0.92,0.,1.);',
    ' vec3 col=mix(uCream,uRed,s.g);',
    ' float glow=pow(b.r,1.6)*0.22*m; vec3 gcol=mix(uCream,uRed,b.g)*glow;',
    ' gl_FragColor=vec4(col*a+gcol*(1.-a),a+glow*(1.-a));',
    '}',
  ].join('\n');

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };

  const setup = () => {
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return false;
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uT', 'uGrid', 'uRes', 'uPitch', 'uDpr', 'uMask', 'uCream', 'uRed']) uni[n] = gl.getUniformLocation(prog, n);
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.uniform1i(uni.uT, 0);
    gl.uniform3fv(uni.uCream, CREAM);
    gl.uniform3fv(uni.uRed, RED);
    gl.clearColor(0, 0, 0, 0);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); }, false);
    return true;
  };

  let dprCap = coarse ? 1.25 : 2;
  const resize = () => {
    const r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    const nc = Math.ceil(W / PITCH) + 1, nr = Math.ceil(H / PITCH) + 1;
    if (nc !== cols || nr !== rows) {
      cols = nc; rows = nr;
      heat = new Float32Array(cols * rows);
      red = new Float32Array(cols * rows);
      fheat = new Float32Array(cols * rows);
      fred = new Float32Array(cols * rows);
      base = new Uint8Array(cols * rows);
      pixels = new Uint8Array(cols * rows * 4);
      // the resting grid matches the brand pattern: most cells faint, a few brighter, a few missing
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const h = hash(i, j);
        base[j * cols + i] = h < 0.05 ? 0 : h < 0.86 ? 8 : h < 0.96 ? 14 : 22;
      }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    gl.uniform2f(uni.uGrid, cols, rows);
    gl.uniform2f(uni.uRes, canvas.width, canvas.height);
    gl.uniform1f(uni.uPitch, PITCH);
    gl.uniform1f(uni.uDpr, dpr);
    const copy = hero.querySelector('.hero__copy');
    if (copy) {
      const c = copy.getBoundingClientRect();
      mask = [c.left - r.left, c.top - r.top, c.right - r.left, c.bottom - r.top];
    }
    gl.uniform4f(uni.uMask, mask[0], mask[1], mask[2], mask[3]);
  };

  /* ---------- Stamping into the cell buffer ---------- */
  const put = (i, j, v, rv) => {
    if (i < 0 || j < 0 || i >= cols || j >= rows) return;
    const k = j * cols + i;
    const H = fresh ? fheat : heat, Rr = fresh ? fred : red;
    if (v > H[k]) H[k] = v;
    if (rv > Rr[k]) Rr[k] = rv;
  };
  const dot = (x, y, v, rv) => put(Math.floor(x / PITCH), Math.floor(y / PITCH), v, rv);
  const disc = (x, y, rad, v, rv, soft) => {
    const ci = x / PITCH, cj = y / PITCH, rc = rad / PITCH;
    for (let j = Math.floor(cj - rc); j <= Math.ceil(cj + rc); j++) {
      for (let i = Math.floor(ci - rc); i <= Math.ceil(ci + rc); i++) {
        const d = Math.hypot(i + 0.5 - ci, j + 0.5 - cj);
        if (d > rc) continue;
        const k = soft ? Math.pow(1 - d / rc, soft) : 1;
        put(i, j, v * k, rv * k);
      }
    }
  };
  const ring = (x, y, rad, th, v, rv) => {
    const ci = x / PITCH, cj = y / PITCH, rc = rad / PITCH, tc = th / PITCH;
    const j0 = Math.max(0, Math.floor(cj - rc - tc)), j1 = Math.min(rows - 1, Math.ceil(cj + rc + tc));
    const i0 = Math.max(0, Math.floor(ci - rc - tc)), i1 = Math.min(cols - 1, Math.ceil(ci + rc + tc));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const e = Math.abs(Math.hypot(i + 0.5 - ci, j + 0.5 - cj) - rc);
        if (e > tc) continue;
        const k = 1 - e / tc;
        put(i, j, v * k, rv * k);
      }
    }
  };
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  /* ---------- Effect builders ---------- */
  const make = {
    sparks(x, y, s = 1) {
      const parts = [];
      const n = Math.round(26 * s);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, sp = (150 + Math.pow(rnd(), 0.6) * 560) * s;
        parts.push({ x, y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0.45 + rnd() * 0.55 });
      }
      return { x, y, T: 1.1, R: 260 * s, parts, step(t, dt) {
        if (t < 0.1) { fresh = true; disc(x, y, 32 * s, 1, 1, 1); fresh = false; }
        for (const p of parts) {
          if (t > p.life) continue;
          p.px = p.x; p.py = p.y;
          const drag = Math.exp(-2.4 * dt);
          p.vx *= drag; p.vy = p.vy * drag + 620 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
          const k = Math.pow(1 - t / p.life, 0.7), rv = t / p.life < 0.45 ? 1 : 0.35;
          // a bright dot at the head and a short fading tail behind it (the trail buffer decays it)
          fresh = true; dot(p.x, p.y, k, rv); fresh = false;
          dot(p.px, p.py, k * 0.4, rv * 0.5);
        }
      } };
    },
    shockwave(x, y, s = 1, big = false) {
      const R = big ? Math.hypot(W, H) * 1.02 : 380 * s, T = big ? 1.35 : 1.0;
      return { x, y, T: T + 0.2, R, wave: true, Tw: T, fresh: true, step(t) {
        if (t < 0.12) disc(x, y, 30, 1, 1, 0.5);
        for (const [delay, amp, th] of [[0, 1, big ? 2.4 : 1.7], [0.16, 0.5, 1.2]]) {
          const u = (t - delay) / T;
          if (u <= 0 || u >= 1) continue;
          const v = Math.pow(1 - u, 1.15) * amp * (big ? 0.85 : 1);
          ring(x, y, R * easeOut(u), PITCH * th, v, Math.max(0, 1 - u * 1.6) * 0.95);
        }
      } };
    },
    pickup(x, y, s = 1) {
      const parts = [];
      for (let i = 0; i < Math.round(30 * s); i++) {
        parts.push({ ox: (rnd() - 0.5) * 110 * s, y: y + (rnd() - 0.5) * 30, vy: -(60 + rnd() * 260) * s, w: 1 + rnd() * 2.5, ph: rnd() * 6.28, d: rnd() * 0.5, life: 0.8 + rnd() * 1.0 });
      }
      return { x, y, T: 2.0, R: 220 * s, parts, step(t, dt) {
        fresh = true;
        if (t < 0.9) disc(x, y, (36 + 34 * Math.sin(Math.min(1, t / 0.9) * Math.PI)) * s, 0.9 * (1 - t / 0.9), 0.75 * (1 - t / 0.9), 0.8);
        if (t < 0.5) ring(x, y, 110 * s * easeOut(t / 0.5), PITCH * 1.1, 0.7 * (1 - t / 0.5), 0.2);
        fresh = false;
        for (const p of parts) {
          const a = t - p.d;
          if (a < 0 || a > p.life) continue;
          p.y += p.vy * dt;
          const k = Math.sin(Math.PI * a / p.life);
          const px = x + p.ox + Math.sin(p.ph + a * p.w * 3) * 12;
          fresh = true; dot(px, p.y, k, a / p.life < 0.35 ? 0.9 : 0.1); fresh = false;
          dot(px, p.y, k * 0.45, 0);
        }
      } };
    },
    dissolve(x, y, s = 1) {
      const R = 150 * s, ci = x / PITCH, cj = y / PITCH, rc = R / PITCH;
      return { x, y, T: 1.25, R: R + 80, fresh: true, step(t) {
        const grow = Math.min(1, t / 0.22);
        const p = (t - 0.26) / 0.9; // dissolve progress, from the rim inward with a noisy edge
        for (let j = Math.floor(cj - rc); j <= Math.ceil(cj + rc); j++) {
          for (let i = Math.floor(ci - rc); i <= Math.ceil(ci + rc); i++) {
            const d = Math.hypot(i + 0.5 - ci, j + 0.5 - cj) / rc;
            if (d > easeOut(grow)) continue;
            const th = 0.55 * hash(i * 7 + 3, j * 13 + 1) + 0.45 * (1 - d);
            if (p <= 0) { put(i, j, 0.85 - d * 0.3, 0); continue; }
            if (th < p) continue;
            if (th < p + 0.1) put(i, j, 1, 1); else put(i, j, 0.8 - d * 0.3, 0.05);
          }
        }
      } };
    },
    wake(x, y) {
      return { x, y, T: 0.5, R: 80, fresh: true, step(t) { const u = t / 0.5; ring(x, y, 80 * easeOut(u), PITCH * 1.1, 0.26 * (1 - u), 0); } };
    },
  };

  /* ---------- Sound (off by default; our own files, loaded only after the visitor turns it on) ---------- */
  let soundOn = false;
  const sounds = {};
  const playSound = (k) => {
    if (!soundOn) return;
    let a = sounds[k];
    if (!a) { a = sounds[k] = new Audio('/assets/media/sfx/' + k + '.mp3'); a.preload = 'auto'; }
    try {
      const n = a.paused ? a : a.cloneNode();
      n.volume = 0.5; n.currentTime = 0;
      const pr = n.play(); if (pr && pr.catch) pr.catch(() => {});
    } catch (e) { /* audio blocked: stay silent */ }
  };

  /* ---------- Headline words hop when an effect reaches them ---------- */
  const words = [];
  const tag = hero.querySelector('.hero__tag');
  const splitWords = () => {
    if (!tag || tag.dataset.split) return;
    tag.dataset.split = '1';
    const text = tag.textContent;
    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    vis.className = 'hero__words';
    text.trim().split(/\s+/).forEach((w, wi) => {
      if (wi) vis.append(' ');
      const s = document.createElement('span');
      s.className = 'hero__word';
      s.textContent = w;
      vis.append(s);
      words.push(s);
    });
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    tag.textContent = '';
    tag.append(sr, vis);
  };
  const hopWords = (e) => {
    if (!words.length) return;
    const hr = hero.getBoundingClientRect();
    for (const w of words) {
      const r = w.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - hr.left - e.x, r.top + r.height / 2 - hr.top - e.y);
      if (d > e.R) continue;
      // when the wave front reaches the word (inverse of the ease), or soon after for bursts
      const delay = e.wave ? e.Tw * (1 - Math.cbrt(Math.max(0, 1 - d / e.R))) : d / 900;
      const lift = Math.max(4, Math.round((1 - d / e.R) * 3) * 4);
      setTimeout(() => {
        w.animate([{ transform: 'translateY(0)' }, { transform: `translateY(-${lift}px)` }, { transform: 'translateY(0)' }],
          { duration: 260, easing: 'steps(4, jump-none)' });
      }, delay * 1000);
    }
  };

  const spawn = (k, x, y, opts = {}) => {
    const e = make[k](x, y, opts.s || 1, opts.big);
    e.t = 0;
    fx.push(e);
    if (fx.length > 12) fx.shift();
    if (k !== 'wake') {
      if (!opts.quiet) lastFx = performance.now();
      hopWords(e);
      const hr = hero.getBoundingClientRect();
      document.dispatchEvent(new CustomEvent('reeboo:fx', { detail: { x: x + hr.left, y: y + hr.top } }));
      if (!opts.silent) playSound(k);
    }
  };

  /* ---------- Frame ---------- */
  const goggles = hero.querySelector('.hero__goggles');
  const gazeLight = { x: -1e4, y: -1e4 };
  let tickN = 0, last = 0, frames = 0, workAcc = 0, slow = 0, twinkleAcc = 0, lastFx = 0, autoLeft = 3;
  const frame = (now) => {
    if (!running || !inView || document.hidden) { last = now; return; }
    // phones: while nothing is playing and no finger is on the grid, draw every other frame (keeps scrolling smooth)
    if (coarse && !fx.length && now - ptr.t > 1200 && (tickN++ & 1)) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;

    // cost guard: our own work per frame, in windows of 90 frames (the frame interval also counts other tabs and
    // throttled windows, so it is not used). Two heavy windows in a row drop to 1x pixels, two more stop the field.
    const t0 = performance.now();
    if (frames === 90) {
      const avg = workAcc / 90; frames = 0; workAcc = 0;
      slow = avg > 7 ? slow + 1 : 0;
      if (slow >= 2) {
        slow = 0;
        if (dprCap > 1) { dprCap = 1; resize(); } else { stop(); return; }
      }
    }

    const kd = Math.pow(0.5, dt / 0.16), kr = Math.pow(0.5, dt / 0.1);
    for (let i = 0; i < heat.length; i++) { heat[i] *= kd; red[i] *= kr; fheat[i] = 0; fred[i] = 0; }

    // idle life: a few cells breathe on and off, like the pattern catching light
    twinkleAcc += dt * (coarse ? 3 : 5);
    while (twinkleAcc > 1) {
      twinkleAcc -= 1;
      const k = (rnd() * heat.length) | 0;
      heat[k] = Math.max(heat[k], 0.12 + rnd() * 0.1);
    }

    const hr = hero.getBoundingClientRect();
    const recent = now - ptr.t < (coarse ? 900 : 2600);
    let lx, ly;
    if (recent && ptr.inside) { lx = ptr.x - hr.left; ly = ptr.y - hr.top; }
    else {
      const g = window.REEBOO && window.REEBOO.gaze;
      if (g) { lx = g.x - hr.left; ly = g.y - hr.top; }
      else if (goggles) { const r = goggles.getBoundingClientRect(); lx = r.left + r.width / 2 - hr.left; ly = r.top + r.height / 2 - hr.top; }
    }
    if (lx !== undefined) {
      // the light trails the target a little, so it travels across the grid cell by cell
      if (gazeLight.x < -1e3) { gazeLight.x = lx; gazeLight.y = ly; }
      gazeLight.x += (lx - gazeLight.x) * Math.min(1, dt * 14);
      gazeLight.y += (ly - gazeLight.y) * Math.min(1, dt * 14);
      fresh = true;
      disc(gazeLight.x, gazeLight.y, recent ? 74 : 56, recent ? 0.5 : 0.32, 0, 1.4);
      fresh = false;
      if (recent) disc(gazeLight.x, gazeLight.y, 30, 0.34, 0, 1);
    }

    // idle: after a quiet spell the grid plays a small effect near the goggles now and then (three times at most)
    if (now - Math.max(ptr.t, lastFx) > 6500 && autoLeft > 0 && !fx.length) {
      autoLeft--; lastFx = now;
      const c = center(), a = rnd() * Math.PI * 2, d = 60 + rnd() * 120;
      spawn(KINDS[(rnd() * KINDS.length) | 0], c.x + Math.cos(a) * d, c.y + Math.abs(Math.sin(a)) * d * 0.6, { s: 0.6, silent: true, quiet: true });
    }

    for (let n = fx.length - 1; n >= 0; n--) {
      const e = fx[n];
      e.t += dt;
      if (e.t > e.T) { fx.splice(n, 1); continue; }
      fresh = !!e.fresh;
      e.step(e.t, dt);
      fresh = false;
    }

    for (let k = 0, p = 0; k < heat.length; k++, p += 4) {
      const hv = heat[k] > fheat[k] ? heat[k] : fheat[k], rv = red[k] > fred[k] ? red[k] : fred[k];
      pixels[p] = hv >= 1 ? 255 : (hv * 255) | 0;
      pixels[p + 1] = rv >= 1 ? 255 : (rv * 255) | 0;
      pixels[p + 2] = base[k];
      pixels[p + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frames++; workAcc += performance.now() - t0;
  };

  const stop = () => {
    running = false; dead = true;
    doc.classList.remove('field-on');
    doc.classList.add('field-off');
    if (tray) tray.hidden = true;
  };

  /* ---------- Playground tray: pick an effect, sound toggle ---------- */
  const tray = hero.querySelector('[data-fx-tray]');
  const chips = tray ? [...tray.querySelectorAll('[data-fx]')] : [];
  const hint = tray && tray.querySelector('[data-fx-hint]');
  const soundBtn = tray && tray.querySelector('[data-fx-sound]');
  const setHint = () => {
    if (!hint) return;
    hint.textContent = soundOn
      ? 'Sounds from our Sci-Fi & Magic Combat SFX free sample.'
      : (coarse ? 'Tap the grid to play ' : 'Click the grid to play ') + NAMES[kind].toLowerCase() + '.';
  };
  const center = () => {
    const hr = hero.getBoundingClientRect();
    if (!goggles) return { x: hr.width / 2, y: hr.height / 3 };
    const r = goggles.getBoundingClientRect();
    return { x: r.left + r.width / 2 - hr.left, y: r.top + r.height * 0.55 - hr.top };
  };
  // where a picked effect plays: the open grid between the goggles and the tray, if there is room
  const showSpot = () => {
    const c = center();
    if (!goggles || !tray) return c;
    const hr = hero.getBoundingClientRect(), g = goggles.getBoundingClientRect(), t = tray.getBoundingClientRect();
    const gap = t.top - g.bottom;
    if (gap > 160 && t.left > hr.left + hr.width * 0.4) return { x: c.x, y: g.bottom - hr.top + gap * 0.5 };
    return c;
  };
  chips.forEach((b) => b.addEventListener('click', () => {
    kind = b.dataset.fx;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    setHint();
    const c = showSpot();
    spawn(kind, c.x, c.y);
  }));
  if (soundBtn) soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    setHint();
    if (soundOn) playSound(kind);
  });

  /* ---------- Input (passive; touch scrolling is never blocked) ---------- */
  const onMove = (ev) => {
    const hr = hero.getBoundingClientRect();
    const x = ev.clientX, y = ev.clientY;
    ptr.inside = x >= hr.left && x <= hr.right && y >= hr.top && y <= hr.bottom;
    if (!ptr.inside) return;
    const moved = Math.hypot(x - ptr.lastX, y - ptr.lastY);
    if (ptr.t > 0 && moved < 200) {
      ptr.travel += moved;
      if (ptr.travel > (coarse ? 120 : 150)) { ptr.travel = 0; if (running) spawn('wake', x - hr.left, y - hr.top); }
    }
    ptr.x = x; ptr.y = y; ptr.lastX = x; ptr.lastY = y; ptr.t = performance.now(); autoLeft = 3;
  };
  hero.addEventListener('pointermove', onMove, { passive: true });
  hero.addEventListener('pointerdown', onMove, { passive: true });
  hero.addEventListener('pointerleave', () => { ptr.inside = false; }, { passive: true });
  hero.addEventListener('click', (ev) => {
    if (!running || ev.target.closest('a, button, input, label, select, textarea, [role="button"]')) return;
    const hr = hero.getBoundingClientRect();
    spawn(kind, ev.clientX - hr.left, ev.clientY - hr.top);
  });

  reduce.addEventListener('change', () => { if (reduce.matches) stop(); });

  /* ---------- Start after the page has painted (keeps LCP and input free) ---------- */
  const start = () => {
    if (dead || running || reduce.matches) return;
    if (!setup()) { doc.classList.add('field-off'); return; }
    resize();
    running = true;
    doc.classList.add('field-on');
    splitWords();
    if (tray) { tray.hidden = false; setHint(); }
    // run only while a good part of the hero is on screen
    new IntersectionObserver(([en]) => { inView = en.isIntersecting && en.intersectionRatio > 0.2; }, { threshold: [0, 0.2, 0.4] }).observe(hero);
    let rz;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (running) resize(); }, 150); }, { passive: true });
    if (window.gsap) window.gsap.ticker.add(() => frame(performance.now()));
    else { const loop = () => { frame(performance.now()); if (!dead) requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
    // the first screen boots: one wave from the goggles sweeps the whole grid, then a small burst where they sit
    const boot = () => {
      const c = center();
      spawn('shockwave', c.x, c.y, { big: true, silent: true });
      setTimeout(() => { const d = center(); spawn('sparks', d.x, d.y, { s: 0.8, silent: true }); }, 520);
    };
    // once per visit: coming back to the home page in the same tab skips the boot wave
    let seen = false;
    try { seen = sessionStorage.getItem('reeboo-boot') === '1'; sessionStorage.setItem('reeboo-boot', '1'); } catch (e) { /* storage off */ }
    if (!seen) setTimeout(boot, Math.max(0, 500 - performance.now()));
  };
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
  const go = () => idle(start, { timeout: 600 });
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
})();
