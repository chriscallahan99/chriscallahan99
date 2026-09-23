/* Priced — showtime effects: marquee intro, confetti, price reels, stamps, count-ups. */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const calm = () => reduceMotion.matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Restart a CSS animation by toggling its class.
  const replay = (el, cls) => {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };

  // ---------- Confetti ----------

  const confetti = (() => {
    const canvas = document.getElementById('confetti');
    const ctx = canvas && canvas.getContext('2d');
    const COLORS = ['#ffd23f', '#ff5a5f', '#4ade80', '#60a5fa', '#f472b6', '#fff6c9', '#fb8500'];
    let parts = [];
    let raf = 0;
    let last = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const frame = (now) => {
      const dt = Math.min(3, (now - last) / 16.667 || 1);
      last = now;
      ctx.clearRect(0, 0, w, h);
      parts = parts.filter((p) => p.life < p.ttl && p.y < h + 60);
      const drag = Math.pow(0.986, dt);
      for (const p of parts) {
        p.vy += 0.32 * dt;
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += p.vf * dt;
        p.life += dt;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, (p.ttl - p.life) / 30));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.flip));
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      if (parts.length) {
        raf = requestAnimationFrame(frame);
      } else {
        raf = 0;
        ctx.clearRect(0, 0, w, h);
      }
    };

    const burst = ({ x, y, count = 80, angle = -90, spread = 60, speed = 12 } = {}) => {
      if (!ctx || calm()) return;
      if (!w) resize();
      for (let i = 0; i < count; i++) {
        const a = ((angle + (Math.random() - 0.5) * spread) * Math.PI) / 180;
        const v = speed * (0.55 + Math.random() * 0.6);
        parts.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          w: 6 + Math.random() * 6,
          h: 9 + Math.random() * 9,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.35,
          flip: Math.random() * Math.PI,
          vf: 0.08 + Math.random() * 0.18,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          life: 0,
          ttl: 110 + Math.random() * 70,
          round: Math.random() < 0.2,
        });
      }
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const fromElement = (el, opts = {}) => {
      const r = el.getBoundingClientRect();
      burst({ x: r.left + r.width / 2, y: r.top + r.height / 2, ...opts });
    };

    window.addEventListener('resize', resize);
    resize();
    return { burst, fromElement };
  })();

  // ---------- Count-up numbers ----------

  const countUp = (el, to, { from = 0, duration = 700, format = (n) => n.toLocaleString('en-US') } = {}) => {
    if (calm() || duration <= 0) {
      el.textContent = format(to);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = format(Math.round(from + (to - from) * eased));
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  };

  // ---------- Slot-machine price reels ----------

  const REEL_EM = 1.15;

  const rollPrice = (el, value) => {
    const text = '$' + Math.round(value).toLocaleString('en-US');
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    const reels = document.createElement('span');
    reels.className = 'price-reels';
    reels.setAttribute('aria-hidden', 'true');

    const strips = [];
    for (const ch of text) {
      if (!/\d/.test(ch)) {
        const s = document.createElement('span');
        s.textContent = ch;
        reels.append(s);
        continue;
      }
      const n = strips.length;
      const loops = 2 + n; // later digits spin longer, like a slot machine
      const reel = document.createElement('span');
      reel.className = 'reel';
      const strip = document.createElement('span');
      strip.className = 'reel-strip';
      for (let i = 0; i < loops * 10 + 10; i++) {
        const d = document.createElement('span');
        d.textContent = i % 10;
        strip.append(d);
      }
      strip.style.setProperty('--dur', 900 + n * 220 + 'ms');
      reel.append(strip);
      reels.append(reel);
      strips.push([strip, loops * 10 + Number(ch)]);
    }

    el.replaceChildren(sr, reels);
    const land = () => strips.forEach(([s, target]) => {
      s.style.transform = `translateY(${-target * REEL_EM}em)`;
    });

    if (calm()) {
      land();
      return Promise.resolve();
    }
    void reels.offsetWidth;
    requestAnimationFrame(land);
    return wait(900 + (strips.length - 1) * 220 + 120);
  };

  // ---------- Rubber stamp on the listing photo ----------

  const stamp = (el, text, tone) => {
    el.textContent = text;
    el.dataset.tone = tone;
    replay(el, 'stamp--in');
  };

  // ---------- Intro: marquee sign ----------

  const buildTitle = (el, word) => {
    [...word].forEach((ch, i) => {
      const ltr = document.createElement('span');
      ltr.className = 'ltr';
      ltr.setAttribute('aria-hidden', 'true');
      ltr.style.setProperty('--i', i);
      ltr.style.setProperty('--r', (i % 2 ? 1 : -1) * (10 + ((i * 7) % 12)) + 'deg');
      const ext = document.createElement('span');
      ext.className = 'ext';
      ext.textContent = ch;
      const face = document.createElement('span');
      face.className = 'face';
      face.dataset.c = ch;
      face.textContent = ch;
      ltr.append(ext, face);
      el.append(ltr);
    });
  };

  // Lay bulbs clockwise around the sign's inner band.
  const layoutBulbs = (marquee, host, live) => {
    const w = marquee.clientWidth;
    const h = marquee.clientHeight;
    if (!w || !h) return;
    const inset = 11;
    const gap = w < 420 ? 22 : 26;
    const pw = w - inset * 2;
    const ph = h - inset * 2;
    const nx = Math.max(4, Math.round(pw / gap));
    const ny = Math.max(3, Math.round(ph / gap));
    const pts = [];
    for (let i = 0; i < nx; i++) pts.push([inset + (pw * i) / nx, inset]);
    for (let i = 0; i < ny; i++) pts.push([inset + pw, inset + (ph * i) / ny]);
    for (let i = 0; i < nx; i++) pts.push([inset + pw - (pw * i) / nx, inset + ph]);
    for (let i = 0; i < ny; i++) pts.push([inset, inset + ph - (ph * i) / ny]);

    const frag = document.createDocumentFragment();
    pts.forEach(([x, y], i) => {
      const b = document.createElement('span');
      b.className = live ? 'bulb live' : 'bulb';
      b.style.cssText = `left:${x}px;top:${y}px;--i:${i};--k:${i % 3}`;
      frag.append(b);
    });
    host.style.setProperty('--n', pts.length);
    host.replaceChildren(frag);
  };

  const JUNK_PRICES = [5, 12, 15, 25, 35, 40, 60, 69, 85, 110, 180, 220, 250, 420, 450, 650, 900, 1200, 1800];

  const rollTag = (el, final, duration) => {
    if (calm()) {
      el.textContent = final;
      return;
    }
    const t0 = performance.now();
    let next = 0;
    const tick = (now) => {
      const p = (now - t0) / duration;
      if (p >= 1) {
        el.textContent = final;
        replay(el, 'pop');
        return;
      }
      if (now >= next) {
        const price = JUNK_PRICES[(Math.random() * JUNK_PRICES.length) | 0];
        el.textContent = '$' + price.toLocaleString('en-US');
        next = now + 45 + 280 * p * p; // decelerate like a wheel winding down
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const intro = document.getElementById('intro');
  if (intro) intro.classList.add('armed');

  const playIntro = async () => {
    const marquee = document.getElementById('marquee');
    const bulbs = document.getElementById('bulbs');
    const title = document.getElementById('title');
    const tag = document.getElementById('hero-tag');
    const tagPrice = document.getElementById('hero-tag-price');
    if (!intro || !marquee) return;

    buildTitle(title, 'PRICED');

    // Wait for the display font so letters don't reflow mid-drop.
    if (document.fonts && document.fonts.load) {
      await Promise.race([document.fonts.load('1em Bungee').catch(() => {}), wait(1500)]);
    }

    layoutBulbs(marquee, bulbs, false);
    if ('ResizeObserver' in window) {
      let lastW = marquee.clientWidth;
      let lastH = marquee.clientHeight;
      new ResizeObserver(() => {
        const w = marquee.clientWidth;
        const h = marquee.clientHeight;
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        layoutBulbs(marquee, bulbs, true);
      }).observe(marquee);
    }

    void intro.offsetWidth;
    intro.classList.add('play');

    const settle = () => intro.classList.add('settled');

    tag.addEventListener('click', () => {
      if (!intro.classList.contains('settled')) return;
      replay(tag, 'swing');
      rollTag(tagPrice, '$???', 900);
    });
    tag.addEventListener('animationend', (e) => {
      if (e.animationName === 'tag-swing') tag.classList.remove('swing');
    });

    if (calm()) {
      settle();
      return;
    }

    // Letters land at ~1.5s: fire the confetti cannons from the sign's bottom corners.
    setTimeout(() => {
      if (intro.classList.contains('hidden')) return;
      const r = marquee.getBoundingClientRect();
      confetti.burst({ x: r.left + 26, y: r.bottom - 24, angle: -62, spread: 28, count: 55, speed: 17 });
      confetti.burst({ x: r.right - 26, y: r.bottom - 24, angle: -118, spread: 28, count: 55, speed: 17 });
    }, 1500);
    setTimeout(() => rollTag(tagPrice, '$???', 1400), 1700);
    setTimeout(settle, 3200);
  };

  const leaveIntro = () => {
    if (!intro || calm()) return Promise.resolve();
    intro.classList.add('leaving');
    return wait(380).then(() => intro.classList.remove('leaving'));
  };

  window.PricedFX = { calm, wait, replay, confetti, countUp, rollPrice, stamp, playIntro, leaveIntro };
})();
