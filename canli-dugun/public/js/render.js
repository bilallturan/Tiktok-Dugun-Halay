// Çizim: düğün salonu arka planı (önbellekli), karakterler, çift, müzisyenler, takılar, efektler.
(function () {
  const CD = window.CD, G = CD.G, W = G.W, H = G.H, PI = Math.PI, TAU = PI * 2;
  const R = CD.render = {};
  const FONT = 'Nunito, "Segoe UI", "Segoe UI Emoji", system-ui, sans-serif';
  const names = R.names = { gelin: 'Zeynep', damat: 'Koray' }; // ayarlardaki (başlangıç) adlar
  const coupleNames = () => {
    const r = CD.game.roles;
    return { gelin: (r.gelin && r.gelin.nick) || names.gelin, damat: (r.damat && r.damat.nick) || names.damat };
  };
  let ctx, q = 1, bg, vig, bulbs = [], flames = [];
  let hands = { L: null, R: null };

  const BRIDE = { gender: 'f', skin: '#f3cfb0', hair: '#3a2418' };
  const GROOM = { gender: 'm', skin: '#e8b893', hair: '#20150f' };
  const DAVUL = { gender: 'm', skin: '#d9a07a', hair: '#1f1510', main: '#7b1e2b', acc: '#e7b84a', shirt: '#f3eee2', pants: '#1a1a22', stache: true, cap: true, capCol: '#3b3530' };
  const ZURNA = { gender: 'm', skin: '#c98f66', hair: '#2b1d16', main: '#1e3a5f', acc: '#c0392b', shirt: '#f5f0e6', pants: '#1a1a22', stache: true, cap: false };

  // ---------- küçük çizim yardımcıları ----------
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  }
  const line = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); };
  const ell = (x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };
  const circ = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  function glow(x, y, r, col) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  function mk() {
    const c = document.createElement('canvas');
    c.width = Math.round(W * q); c.height = Math.round(H * q);
    const x = c.getContext('2d'); x.setTransform(q, 0, 0, q, 0, 0);
    return [c, x];
  }

  R.init = (c) => { ctx = c; R.rebuild(); CD.game.on('roles', () => R.rebuild()); }; // kemerdeki isimler rolle değişir
  R.setNames = (g, d) => { names.gelin = g || 'Gelin'; names.damat = d || 'Damat'; R.rebuild(); };
  R.setQuality = (nq) => {
    nq = CD.clamp(Math.round(nq * 4) / 4, 1, 2);
    if (nq === q) return;
    q = nq; ctx.canvas.width = Math.round(W * q); ctx.canvas.height = Math.round(H * q);
    R.rebuild();
  };
  R.rebuild = () => { if (!ctx) return; bg = buildBg(); vig = buildVig(); };

  // ---------- arka plan: düğün salonu ----------
  function archPath(x, cx, base, hw, top) {
    const cy = top + hw;
    x.beginPath(); x.moveTo(cx - hw, base); x.lineTo(cx - hw, cy); x.arc(cx, cy, hw, PI, 0); x.lineTo(cx + hw, base); x.closePath();
  }

  function table(x, cx, cy, r) {
    for (const dx of [-r * 0.6, r * 0.6]) {
      x.fillStyle = '#efe7ef'; rr(x, cx + dx - 13, cy - 48, 26, 44, 9); x.fill();
      x.fillStyle = '#d4a63a'; x.beginPath(); x.ellipse(cx + dx, cy - 26, 8, 3, 0, 0, TAU); x.fill();
    }
    const g = x.createLinearGradient(0, cy, 0, cy + r * 0.6);
    g.addColorStop(0, '#fbf6fb'); g.addColorStop(1, '#d6cbe0');
    x.fillStyle = g; x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx - r * 0.96, cy + r * 0.55);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const x0 = cx - r * 0.96 + (2 * r * 0.96) * i / n, x1 = cx - r * 0.96 + (2 * r * 0.96) * (i + 1) / n;
      x.quadraticCurveTo((x0 + x1) / 2, cy + r * 0.64, x1, cy + r * 0.55);
    }
    x.lineTo(cx + r, cy); x.closePath(); x.fill();
    x.fillStyle = '#fffafe'; x.beginPath(); x.ellipse(cx, cy, r, r * 0.26, 0, 0, TAU); x.fill();
    x.fillStyle = '#d4a63a'; rr(x, cx - 5, cy - 22, 10, 18, 3); x.fill();
    const rnd = CD.rng(Math.round(cx * 7 + cy));
    for (let i = 0; i < 10; i++) {
      x.fillStyle = ['#ffffff', '#ffc2d1', '#ff7aa2', '#f7e1ff'][i % 4];
      x.beginPath(); x.arc(cx + (rnd() - 0.5) * 26, cy - 26 - rnd() * 14, 4 + rnd() * 3, 0, TAU); x.fill();
    }
  }

  function chandelier(x, cx) {
    x.strokeStyle = '#c9a24a'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx, 60); x.stroke();
    x.strokeStyle = '#d9b45a'; x.lineWidth = 3;
    for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(cx, 62); x.quadraticCurveTo(cx + i * 22, 62, cx + i * 24, 88); x.stroke(); }
    x.fillStyle = '#d9b45a'; x.beginPath(); x.ellipse(cx, 92, 58, 12, 0, 0, TAU); x.fill();
    x.fillStyle = '#a77f2a'; x.beginPath(); x.ellipse(cx, 92, 58, 12, 0, 0, PI); x.fill();
    for (let i = -2; i <= 2; i++) {
      x.fillStyle = '#fff6e0'; x.fillRect(cx + i * 24 - 2.5, 72, 5, 14);
      flames.push({ x: cx + i * 24, y: 68 });
    }
    for (let i = 0; i < 15; i++) {
      const px = cx - 54 + i * (108 / 14), py = 100 + Math.sin((i / 14) * PI) * 12;
      x.fillStyle = 'rgba(225,240,255,.9)';
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + 2.5, py + 5); x.lineTo(px, py + 10); x.lineTo(px - 2.5, py + 5); x.closePath(); x.fill();
    }
  }

  function buildBg() {
    const [c, x] = mk();
    flames = []; bulbs = [];
    const WL = G.WALL, A = G.ARCH, CP = G.CARPET;

    // duvar
    let g = x.createLinearGradient(0, 0, 0, WL);
    g.addColorStop(0, '#24102c'); g.addColorStop(1, '#4d2140');
    x.fillStyle = g; x.fillRect(0, 0, W, WL);

    // yan kemerli paneller
    for (const ax of [135, 945]) {
      g = x.createLinearGradient(0, 250, 0, WL - 70);
      g.addColorStop(0, '#6d3557'); g.addColorStop(1, '#43203a');
      x.fillStyle = g; archPath(x, ax, WL - 70, 95, 250); x.fill();
      x.strokeStyle = 'rgba(246,196,83,.5)'; x.lineWidth = 3; x.stroke();
      x.strokeStyle = 'rgba(246,196,83,.18)'; x.lineWidth = 1.5; archPath(x, ax, WL - 82, 80, 266); x.stroke();
    }
    // lambri
    x.fillStyle = '#2b1124'; x.fillRect(0, WL - 70, W, 70);
    x.fillStyle = 'rgba(246,196,83,.55)'; x.fillRect(0, WL - 73, W, 3);

    // zemin (parke, perspektif)
    g = x.createLinearGradient(0, WL, 0, H);
    g.addColorStop(0, '#5a3320'); g.addColorStop(1, '#2a170d');
    x.fillStyle = g; x.fillRect(0, WL, W, H - WL);
    x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1.5;
    for (let i = -18; i <= 18; i++) { x.beginPath(); x.moveTo(G.CX + i * 40, WL); x.lineTo(G.CX + i * 110, H); x.stroke(); }
    for (let k = 1; k < 20; k++) { const y = WL + (H - WL) * Math.pow(k / 20, 1.5); x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
    // pist ışığı
    x.save(); x.translate(G.CX, G.CY); x.scale(1, 0.66);
    g = x.createRadialGradient(0, 0, 60, 0, 0, 620);
    g.addColorStop(0, 'rgba(255,214,150,.32)'); g.addColorStop(1, 'rgba(255,214,150,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 620, 0, TAU); x.fill(); x.restore();

    // çiçekli kemer (çiftin arkası)
    x.fillStyle = '#3a1630'; archPath(x, A.x, A.base, A.hw, A.top); x.fill();
    x.save(); archPath(x, A.x, A.base, A.hw, A.top); x.clip();
    g = x.createRadialGradient(A.x, A.top + 230, 10, A.x, A.top + 230, 320);
    g.addColorStop(0, 'rgba(255,170,200,.38)'); g.addColorStop(1, 'rgba(255,170,200,0)');
    x.fillStyle = g; x.fillRect(A.x - A.hw, A.top, A.hw * 2, A.base - A.top); x.restore();
    x.strokeStyle = '#f0c25a'; x.lineWidth = 4; archPath(x, A.x, A.base, A.hw, A.top); x.stroke();
    const rnd = CD.rng(42), pts = [], acy = A.top + A.hw;
    for (let y = A.base; y > acy; y -= 18) { pts.push([A.x - A.hw, y]); pts.push([A.x + A.hw, y]); }
    for (let a = PI; a <= TAU + 0.001; a += PI / 20) pts.push([A.x + Math.cos(a) * A.hw, acy + Math.sin(a) * A.hw]);
    for (const [px, py] of pts) {
      x.fillStyle = '#4f8a4a'; x.beginPath(); x.ellipse(px + (rnd() - 0.5) * 18, py + (rnd() - 0.5) * 18, 11, 5, rnd() * PI, 0, TAU); x.fill();
      for (let k = 0; k < 3; k++) {
        x.fillStyle = ['#fff5f7', '#ffd1dc', '#ff8fab', '#f4f1e8', '#e75480'][Math.floor(rnd() * 5)];
        x.beginPath(); x.arc(px + (rnd() - 0.5) * 24, py + (rnd() - 0.5) * 24, 8 + rnd() * 6, 0, TAU); x.fill();
      }
    }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    g = x.createLinearGradient(0, 360, 0, 440);
    g.addColorStop(0, '#ffe6a3'); g.addColorStop(1, '#e0a63a');
    x.fillStyle = g; x.font = '72px "Great Vibes", cursive';
    x.fillText('Mutluluklar', A.x, 405);
    x.fillStyle = '#ffffff';
    let fs = 44; x.font = `900 ${fs}px ${FONT}`;
    const cn = coupleNames(), nm = `${cn.gelin}  ♥  ${cn.damat}`;
    while (x.measureText(nm).width > A.hw * 2 - 30 && fs > 24) { fs -= 2; x.font = `900 ${fs}px ${FONT}`; }
    x.fillText(nm, A.x, 500);

    // masalar
    table(x, 62, WL + 120, 72); table(x, W - 62, WL + 120, 72);
    table(x, 40, H - 110, 130); table(x, W - 40, H - 110, 130);

    // pist halısı (çiftin altı)
    x.fillStyle = '#8e1630'; x.beginPath(); x.ellipse(CP.x, CP.y, CP.rx, CP.ry, 0, 0, TAU); x.fill();
    x.strokeStyle = '#f0c25a'; x.lineWidth = 4; x.stroke();
    x.strokeStyle = 'rgba(240,194,90,.5)'; x.lineWidth = 2; x.beginPath(); x.ellipse(CP.x, CP.y, CP.rx * 0.86, CP.ry * 0.8, 0, 0, TAU); x.stroke();
    x.fillStyle = 'rgba(240,194,90,.55)';
    for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; x.beginPath(); x.arc(CP.x + Math.cos(a) * CP.rx * 0.93, CP.y + Math.sin(a) * CP.ry * 0.9, 3, 0, TAU); x.fill(); }

    // tavan perdeleri
    for (let i = 0; i < 11; i++) {
      const x0 = i * 100;
      g = x.createLinearGradient(0, 0, 0, 62);
      g.addColorStop(0, '#fbf3f8'); g.addColorStop(1, '#e8cfe0');
      x.fillStyle = g; x.beginPath(); x.moveTo(x0, 0); x.quadraticCurveTo(x0 + 50, 66, x0 + 100, 0); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(240,194,90,.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(x0, 0); x.quadraticCurveTo(x0 + 50, 66, x0 + 100, 0); x.stroke();
    }
    x.fillStyle = '#6a1f3d'; x.fillRect(0, 0, W, 12);
    x.fillStyle = '#f0c25a'; x.fillRect(0, 12, W, 2);

    // avizeler
    for (const cx of G.CHAND) chandelier(x, cx);

    // ışık zincirleri (teller burada, ampuller her karede çizilir)
    const strands = [{ xs: [0, 270, 540, 810, 1080], y0: 16, sag: 52 }, { xs: [-135, 135, 405, 675, 945, 1215], y0: 12, sag: 96 }];
    x.strokeStyle = 'rgba(30,12,20,.6)'; x.lineWidth = 1.5;
    for (const st of strands) {
      for (let s = 0; s < st.xs.length - 1; s++) {
        const a = st.xs[s], b = st.xs[s + 1];
        x.beginPath();
        for (let k = 0; k <= 16; k++) {
          const u = k / 16, bx = CD.lerp(a, b, u), by = st.y0 + st.sag * 4 * u * (1 - u);
          if (k === 0) x.moveTo(bx, by); else x.lineTo(bx, by);
          if (k % 2 === 1 && bx > -5 && bx < W + 5) bulbs.push({ x: bx, y: by + 4, ph: rnd() * TAU, sp: rnd(), c: rnd() < 0.7 ? 'rgba(255,225,160,' : 'rgba(255,190,120,' });
        }
        x.stroke();
      }
    }
    return c;
  }

  function buildVig() {
    const [c, x] = mk();
    x.save(); x.translate(G.CX, 1000); x.scale(1, 1.6);
    const g = x.createRadialGradient(0, 0, 330, 0, 0, 760);
    g.addColorStop(0, 'rgba(8,3,12,0)'); g.addColorStop(1, 'rgba(8,3,12,.55)');
    x.fillStyle = g; x.fillRect(-W, -H, W * 2, H * 2); x.restore();
    return c;
  }

  // ---------- dinamik ışıklar ----------
  function lights(gm) {
    const t = gm.time, lvl = gm.level;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const cx of G.CHAND) glow(cx, 92, 210, `rgba(255,200,120,${0.2 * (0.92 + 0.08 * Math.sin(t * 7 + cx))})`);
    for (const f of flames) glow(f.x, f.y, 10, 'rgba(255,190,90,.7)');
    bulbs.forEach((b, i) => {
      let a = 0.5 + 0.5 * Math.sin(t * (1.3 + b.sp) + b.ph), col = b.c;
      if (lvl >= 3) { a = 0.3 + 0.7 * ((Math.sin(t * 9 - i * 0.5) + 1) / 2); col = `hsla(${(i * 25 + t * 120) % 360},100%,70%,`; }
      glow(b.x, b.y, 12, col + (0.45 * a) + ')');
      ctx.fillStyle = col + (0.6 + 0.4 * a) + ')'; circ(b.x, b.y, 3);
    });
    glow(G.CX, G.CY, 380, 'rgba(255,225,180,.16)');
    if (lvl >= 2) {
      const al = lvl >= 3 ? 0.13 : 0.07;
      [[150, 'rgba(255,80,150,'], [930, 'rgba(80,190,255,']].forEach(([ox, col], k) => {
        const fx = G.CX + Math.sin(t * 0.7 + k * 2.2) * 330, fy = G.CY + 60;
        const g = ctx.createLinearGradient(ox, 0, fx, fy);
        g.addColorStop(0, col + al + ')'); g.addColorStop(1, col + '0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ox - 14, -20); ctx.lineTo(ox + 14, -20); ctx.lineTo(fx + 120, fy); ctx.lineTo(fx - 120, fy); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.translate(fx, fy); ctx.scale(1, 0.45); glow(0, 0, 150, col + al * 1.5 + ')'); ctx.restore();
      });
    }
    ctx.restore();
  }

  // ---------- karakter ----------
  function anim(g, gm) {
    const t = gm.time, lvl = gm.level;
    if (g.walking) {
      const w = Math.sin(t * 13 + g.seed);
      return { lift: Math.abs(w) * 1.6, bob: Math.abs(w) * 1.6, squat: 0, sx: 0, kickL: Math.max(0, w), kickR: Math.max(0, -w), jump: 0, blink: false };
    }
    const b = gm.beat + (g.phase || 0), fr = b - Math.floor(b), k = Math.sin(fr * PI);
    const bob = k * (1.6 + lvl * 1.1), even = (Math.floor(b) & 1) === 0;
    let squat = 0;
    if (lvl >= 3) { const p = b % 4; if (p >= 3) squat = Math.sin((p - 3) * PI) * 7; } // coşkuda çökme figürü
    const sx = lvl >= 2 ? Math.sin(b * PI * 4) * (lvl - 1) * 0.7 : 0;                   // omuz titretme
    const jt = t - (g.jumpT || -99), jump = jt < 0.7 ? Math.sin((jt / 0.7) * PI) * 18 : 0;
    const blink = ((t + (g.seed % 97) * 0.13) % 4.3) < 0.12;
    return { lift: bob + jump, bob, squat, sx, kickL: even ? k : 0, kickR: even ? 0 : k, jump, blink };
  }

  function armTo(sx, sy, T, side, col, skin, an, o) {
    let tx, ty;
    if (T === 'up') { tx = sx + side * 6; ty = -62; }
    else if (T && typeof T === 'object') { tx = T.x; ty = T.y; }
    else { tx = sx + side * 5; ty = -18.5; }
    let dx = tx - sx, dy = ty - sy;
    const d = Math.hypot(dx, dy), M = 28;
    if (d > M) { dx *= M / d; dy *= M / d; }
    const hx = sx + dx, hy = sy + dy;
    ctx.strokeStyle = col; ctx.lineWidth = 4.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + dx * 0.5 + side * 1.5, sy + dy * 0.5 + 3, hx, hy); ctx.stroke();
    ctx.fillStyle = skin; circ(hx, hy, 2.6);
    if (T === 'up' && o.mendil && Math.sign(o.mendil) === side) mendil(hx, hy, side, o.t || 0);
    return { x: hx, y: hy };
  }

  function mendil(hx, hy, side, t) {
    const w = Math.sin(t * 9) * 4, w2 = Math.cos(t * 9) * 3;
    ctx.fillStyle = '#e11d48';
    ctx.beginPath(); ctx.moveTo(hx, hy);
    ctx.quadraticCurveTo(hx + side * 6, hy - 9 + w, hx + side * 15 + w2, hy - 7 + w);
    ctx.quadraticCurveTo(hx + side * 11, hy + 2, hx + side * 14 + w2, hy + 7 - w);
    ctx.quadraticCurveTo(hx + side * 6, hy + 3, hx, hy);
    ctx.fill();
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 0.8; ctx.stroke();
  }

  function drawHead(lk, an, o = {}) {
    ctx.fillStyle = lk.skin; rr(ctx, -2.6, -41.5, 5.2, 4.5, 1); ctx.fill();
    circ(0, -51, 12.5);
    if (lk.gender === 'f') {
      if (lk.scarf) {
        ctx.fillStyle = lk.scarfCol;
        ctx.beginPath(); ctx.arc(0, -51.5, 14.6, PI * 0.86, PI * 2.14);
        ctx.bezierCurveTo(9, -59, -9, -59, -13.2, -45.2); ctx.fill();
        ctx.fillStyle = lk.acc;
        for (let i = 1; i < 8; i++) { // oya
          const t = i / 8, mt = 1 - t;
          const bx = mt * mt * mt * 13.2 + 3 * mt * mt * t * 9 + 3 * mt * t * t * -9 + t * t * t * -13.2;
          const by = mt * mt * mt * -45.2 + 3 * mt * mt * t * -59 + 3 * mt * t * t * -59 + t * t * t * -45.2;
          circ(bx, by, 1.15);
        }
      } else {
        ctx.fillStyle = lk.hair;
        ctx.beginPath(); ctx.arc(0, -51, 13.4, PI * 0.92, PI * 2.08);
        ctx.bezierCurveTo(9, -57, -5, -61, -12.7, -47.7); ctx.fill();
      }
    } else {
      ctx.fillStyle = lk.hair;
      ctx.beginPath(); ctx.arc(0, -51, 13.2, PI, TAU); ctx.bezierCurveTo(9, -57, -9, -57, -13.2, -51); ctx.fill();
      ctx.fillRect(-13, -52, 2.4, 5); ctx.fillRect(10.6, -52, 2.4, 5);
      if (lk.cap) {
        ctx.fillStyle = lk.capCol; ctx.beginPath(); ctx.arc(0, -54, 13.8, PI, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(4, -54, 13.5, 3);
      }
    }
    // yüz
    ctx.fillStyle = '#2a1a14';
    if (an.blink) { ctx.fillRect(-6, -51, 3.4, 0.9); ctx.fillRect(2.6, -51, 3.4, 0.9); }
    else { circ(-4.3, -50.5, 1.75); circ(4.3, -50.5, 1.75); ctx.fillStyle = 'rgba(255,255,255,.8)'; circ(-3.8, -51.1, 0.55); circ(4.8, -51.1, 0.55); }
    if (o.puff) { ctx.fillStyle = lk.skin; circ(-7, -46.5, 4.2); circ(7, -46.5, 4.2); }
    ctx.fillStyle = 'rgba(255,110,130,.33)'; circ(-7.4, -46.5, 2.5); circ(7.4, -46.5, 2.5);
    if (lk.stache) {
      ctx.fillStyle = lk.hair; ell(-2.6, -45.6, 3.1, 1.5, 0.25); ell(2.6, -45.6, 3.1, 1.5, -0.25);
    } else {
      ctx.strokeStyle = o.lips || '#8a3b2c'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(0, -46.5, 3.2, 0.15 * PI, 0.85 * PI); ctx.stroke();
    }
  }

  // Ayaklar yerde (0,0); vücut çerçevesi sallanma/zıplama ile kayar.
  function drawFigure(lk, an, L, Rt, o = {}) {
    const f = lk.gender === 'f';
    const shs = Math.max(0.5, 1 - an.jump / 30);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ell(0, 0, 13 * shs, 3.8 * shs);
    ctx.save(); ctx.translate(an.sx, -an.lift + an.squat);
    const fb = an.bob - an.squat;
    if (f && !lk.scarf && lk.long) { ctx.fillStyle = lk.hair; rr(ctx, -13.5, -60, 27, 32, 11); ctx.fill(); }
    if (f && !lk.scarf && !lk.long) { ctx.fillStyle = lk.hair; circ(0, -64, 5.5); }
    const fl = { x: -4.5 - an.kickL * 2.5, y: fb - an.kickL * 5 }, fr = { x: 4.5 + an.kickR * 2.5, y: fb - an.kickR * 5 };
    ctx.lineCap = 'round';
    if (f) { ctx.strokeStyle = '#3b2a2e'; ctx.lineWidth = 3.4; line(-4, -8, fl.x, fl.y - 1); line(4, -8, fr.x, fr.y - 1); }
    else { ctx.strokeStyle = lk.pants; ctx.lineWidth = 5.6; line(-4.5, -17, fl.x, fl.y - 1.5); line(4.5, -17, fr.x, fr.y - 1.5); }
    ctx.fillStyle = '#2a1b17'; ell(fl.x - 0.8, fl.y - 0.8, 3.8, 2); ell(fr.x + 0.8, fr.y - 0.8, 3.8, 2);

    if (f) {
      ctx.fillStyle = lk.main;
      ctx.beginPath(); ctx.moveTo(-7, -38.5); ctx.lineTo(7, -38.5);
      ctx.quadraticCurveTo(10, -22, 13, -4); ctx.lineTo(-13, -4); ctx.quadraticCurveTo(-10, -22, -7, -38.5); ctx.fill();
      ctx.fillStyle = lk.acc; ctx.beginPath(); ctx.moveTo(-12.6, -7.6); ctx.lineTo(12.6, -7.6); ctx.lineTo(13, -4); ctx.lineTo(-13, -4); ctx.closePath(); ctx.fill();
      ctx.globalAlpha *= 0.75; circ(-5, -13, 1.1); circ(0, -12, 1.1); circ(5, -13, 1.1); ctx.globalAlpha /= 0.75;
      ctx.fillStyle = '#e7b84a'; rr(ctx, -8, -24.5, 16, 3, 1.2); ctx.fill();
    } else {
      ctx.fillStyle = lk.shirt; rr(ctx, -8.5, -38.5, 17, 24, 4); ctx.fill();
      ctx.fillStyle = lk.main;
      ctx.beginPath(); ctx.moveTo(-8.5, -35); ctx.quadraticCurveTo(-8.8, -38.5, -5.5, -38.5); ctx.lineTo(-2.2, -38.5); ctx.lineTo(-1.6, -17); ctx.lineTo(-8.5, -17); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8.5, -35); ctx.quadraticCurveTo(8.8, -38.5, 5.5, -38.5); ctx.lineTo(2.2, -38.5); ctx.lineTo(1.6, -17); ctx.lineTo(8.5, -17); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e7b84a'; ctx.lineWidth = 0.8; line(-2.2, -38.5, -1.6, -17); line(2.2, -38.5, 1.6, -17);
      ctx.fillStyle = lk.acc; rr(ctx, -8.8, -19.5, 17.6, 4, 1.5); ctx.fill();
    }
    if (o.afterTorso) o.afterTorso();
    const sleeve = f ? lk.main : lk.shirt;
    const arms = () => { hands.L = armTo(-7.6, -35, L, -1, sleeve, lk.skin, an, o); hands.R = armTo(7.6, -35, Rt, 1, sleeve, lk.skin, an, o); };
    if (!o.armsLate) arms();
    drawHead(lk, an, o);
    if (o.afterHead) o.afterHead();
    if (o.armsLate) arms();
    if (o.afterArms) o.afterArms();
    ctx.restore();
  }

  function toLocal(g, s, an, p) { return { x: (p.x - g.x) / s - an.sx, y: (p.y - g.y) / s + an.lift - an.squat }; }

  function drawGuest(g, order, gm, role) {
    const s = g._s, an = g._an;
    let L = null, Rt = null, mend = 0;
    const raise = (gm.level >= 3 ? 16 : gm.level === 2 ? 6 : 0) * s;
    if (role === 'sagdic') {
      if (g._linkPt) L = toLocal(g, s, an, g._linkPt);
      if (gm.level >= 2) Rt = 'up';
    } else if (order && !g.walking) {
      const nb = [];
      for (const n of [order[g.idx - 1], order[g.idx + 1]]) if (n && !n.walking && n._sh && Math.hypot(n.x - g.x, n.y - g.y) < 56 * s) nb.push(n);
      nb.sort((p, r) => p.x - r.x);
      const targ = (n) => toLocal(g, s, an, { x: (g._sh.x + n._sh.x) / 2, y: (g._sh.y + n._sh.y) / 2 + 4 * s - raise });
      if (nb.length === 2) { L = targ(nb[0]); Rt = targ(nb[1]); }
      else if (nb.length === 1) { if (nb[0].x < g.x) L = targ(nb[0]); else Rt = targ(nb[0]); }
      if (g.idx === 0) { if (!L) { L = 'up'; mend = -1; } else if (!Rt) { Rt = 'up'; mend = 1; } } // halaybaşı mendil sallar
    }
    ctx.save(); ctx.globalAlpha = CD.clamp(g.alpha, 0, 1);
    ctx.translate(g.x, g.y); ctx.scale(s, s);
    drawFigure(g.look, an, L, Rt, { mendil: mend, t: gm.time });
    ctx.restore();
    g._headY = g.y - (70 + an.lift - an.squat) * s;
  }

  // ---------- takı ----------
  function coin(x, y, r) {
    ctx.fillStyle = '#f5c542'; circ(x, y, r);
    ctx.strokeStyle = '#a87a12'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; circ(x - r * 0.35, y - r * 0.35, r * 0.3);
  }
  function medal(x, y) {
    ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.moveTo(x - 2.5, y - 6); ctx.lineTo(x + 2.5, y - 6); ctx.lineTo(x, y - 2); ctx.closePath(); ctx.fill();
    coin(x, y, 3.6);
    ctx.fillStyle = '#c8102e'; circ(x, y, 1.1);
  }
  function drawTaki(list, y0, y1) {
    ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 2.3; ctx.lineCap = 'butt';
    line(-4.6, y0, -6, y1); line(4.6, y0, 6, y1);
    const rows = Math.max(1, Math.floor((y1 - y0 - 2) / 3.3));
    let k = 0, bi = 0;
    for (const it of list) {
      if (it.tier === 'bilezik') continue;
      if (it.tier === 'besi') { if (bi < 3) medal(0, y0 + 9 + bi * 7.5); bi++; continue; }
      if (k >= rows * 4) break;
      const side = k % 2 ? 1 : -1, row = Math.floor(k / 2) % rows, col = Math.floor(k / (2 * rows));
      const yy = y0 + 2 + row * 3.3, u = (yy - y0) / (y1 - y0);
      coin(side * (4.6 + 1.4 * u + col * 3.1), yy, it.tier === 'ceyrek' ? 1.6 : it.tier === 'yarim' ? 1.95 : 2.3);
      k++;
    }
  }

  // ---------- gelin & damat ----------
  function drawBride(gm, an, handR) {
    const lk = BRIDE;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(0, 0, 24, 5.5);
    ctx.save(); ctx.translate(an.sx, -an.lift);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.moveTo(-6, -64); ctx.bezierCurveTo(-24, -50, -26, -20, -21, -2); ctx.lineTo(-8, -2); ctx.bezierCurveTo(-12, -25, -8, -50, 7, -64); ctx.closePath(); ctx.fill();
    const gr = ctx.createLinearGradient(-22, 0, 22, 0);
    gr.addColorStop(0, '#e4ddec'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#ddd5e6');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(-7.5, -38.5); ctx.lineTo(7.5, -38.5);
    ctx.bezierCurveTo(9, -26, 19, -14, 22, -1); ctx.quadraticCurveTo(0, 3, -22, -1); ctx.bezierCurveTo(-19, -14, -9, -26, -7.5, -38.5); ctx.fill();
    ctx.fillStyle = 'rgba(200,190,220,.6)';
    for (let i = -4; i <= 4; i++) circ(i * 4.6, -2 + Math.abs(i) * -0.1, 1.2);
    ctx.fillStyle = '#c8102e'; rr(ctx, -8.5, -26, 17, 4, 1.5); ctx.fill(); // kırmızı kuşak
    ctx.beginPath(); ctx.moveTo(1, -24); ctx.lineTo(6, -27.5); ctx.lineTo(6, -20.5); ctx.closePath(); ctx.fill();
    drawTaki(gm.taki.gelin, -36, -6);
    const hl = armTo(-7.6, -35, null, -1, '#f4efe9', lk.skin, an, {});
    const nb = Math.min(8, gm.takiCount.bilezik);
    ctx.strokeStyle = '#f2c240'; ctx.lineWidth = 1.2;
    for (let i = 0; i < nb; i++) {
      const u = 0.1 + i * 0.065;
      ctx.beginPath(); ctx.ellipse(CD.lerp(hl.x, -7.6, u), CD.lerp(hl.y, -35, u), 2.8, 1.1, 0.4, 0, TAU); ctx.stroke();
    }
    armTo(7.6, -35, handR, 1, '#f4efe9', lk.skin, an, {});
    ctx.fillStyle = lk.hair; circ(0, -63.5, 6.2);
    drawHead(lk, an, { lips: '#c2185b' });
    ctx.fillStyle = '#f6d36b'; // taç
    ctx.beginPath(); ctx.moveTo(-8, -61.5);
    for (let i = 0; i <= 8; i++) ctx.lineTo(-8 + i * 2, i % 2 ? -66 : -62);
    ctx.lineTo(8, -61); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff5c8a'; circ(0, -64.5, 1);
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, -55, 13.5, PI * 1.08, PI * 1.92); ctx.stroke();
    ctx.restore();
  }

  function drawGroom(gm, an, handL, handR) {
    const lk = GROOM;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(0, 0, 14, 4.2);
    ctx.save(); ctx.translate(an.sx, -an.lift);
    const fb = an.bob;
    ctx.strokeStyle = '#15161f'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    line(-4.5, -17, -4.6, fb - 1.5); line(4.5, -17, 4.6, fb - 1.5);
    ctx.fillStyle = '#0b0b10'; ell(-5.3, fb - 0.8, 4, 2); ell(5.3, fb - 0.8, 4, 2);
    ctx.fillStyle = '#1b1e2c'; rr(ctx, -9.6, -39, 19.2, 25, 4.5); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-3.8, -39); ctx.lineTo(3.8, -39); ctx.lineTo(0, -26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.moveTo(0, -36.5); ctx.lineTo(-3.4, -38.6); ctx.lineTo(-3.4, -34.4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -36.5); ctx.lineTo(3.4, -38.6); ctx.lineTo(3.4, -34.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; circ(-6, -33, 1.7); ctx.fillStyle = '#ff8fab'; circ(-6, -33, 0.8);
    drawTaki(gm.taki.damat, -36, -16);
    hands.L = armTo(-7.6, -35, handL, -1, '#1b1e2c', lk.skin, an, {});
    hands.R = armTo(7.6, -35, handR, 1, '#1b1e2c', lk.skin, an, {});
    drawHead(lk, an, {});
    ctx.restore();
  }

  function couple(gm, sd) {
    const S = G.HERO_S, b = gm.beat, lvl = gm.level, fr = b - Math.floor(b);
    const mkA = (ph) => {
      const bob = Math.sin(fr * PI) * (1 + lvl * 0.5);
      return { lift: bob, bob, squat: 0, sx: Math.sin(b * PI / 2 + ph) * 1.4, kickL: 0, kickR: 0, jump: 0, blink: ((gm.time + ph * 3) % 5) < 0.12 };
    };
    const aB = mkA(0), aG = mkA(0.4);
    const shB = { x: G.BRIDE.x + (7.6 + aB.sx) * S, y: G.BRIDE.y - (35 + aB.lift) * S };
    const shG = { x: G.GROOM.x + (-7.6 + aG.sx) * S, y: G.GROOM.y - (35 + aG.lift) * S };
    const m = { x: (shB.x + shG.x) / 2, y: (shB.y + shG.y) / 2 + 10 - (lvl >= 2 ? 20 : 0) };
    const loc = (P, an, p) => ({ x: (p.x - P.x) / S - an.sx, y: (p.y - P.y) / S + an.lift });
    let gR = lvl >= 3 ? 'up' : null;
    if (sd && sd._sh) {
      const shG2 = { x: G.GROOM.x + (7.6 + aG.sx) * S, y: G.GROOM.y - (35 + aG.lift) * S };
      const m2 = { x: (shG2.x + sd._sh.x) / 2, y: (shG2.y + sd._sh.y) / 2 + 6 };
      gR = loc(G.GROOM, aG, m2); sd._linkPt = m2;
    }
    ctx.save(); ctx.translate(G.GROOM.x, G.GROOM.y); ctx.scale(S, S); drawGroom(gm, aG, loc(G.GROOM, aG, m), gR); ctx.restore();
    ctx.save(); ctx.translate(G.BRIDE.x, G.BRIDE.y); ctx.scale(S, S); drawBride(gm, aB, loc(G.BRIDE, aB, m)); ctx.restore();
    R._heroHead = G.BRIDE.y - (74 + aB.lift) * S;
  }

  // ---------- davulcu & zurnacı ----------
  function drawDavulcu(gm) {
    const p = G.DAVUL, s = G.MUS_S, b = gm.beat;
    const bob = Math.sin((b % 1) * PI) * 1.2;
    const an = { lift: bob, bob, squat: 0, sx: 0, kickL: 0, kickR: 0, jump: 0, blink: (gm.time % 3.7) < 0.12 };
    const boost = gm.time < gm.davulBoost;
    const lift = boost ? CD.smooth(b % 1) : CD.smooth((b % 2) / 2); // tokmak: vuruşta aşağıda, sonra yavaşça kalkar
    const Rt = { x: CD.lerp(19, 15, lift), y: CD.lerp(-24, -56, lift) };
    const pl = (b * (boost ? 4 : 2)) % 1;
    const L = { x: -19 - pl * 2, y: -25 - Math.sin(pl * PI) * 7 };
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(s, s);
    drawFigure(DAVUL, an, L, Rt, {
      afterTorso: () => {
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 2; line(-7, -37, 12, -33);
        ctx.fillStyle = '#a8322b'; rr(ctx, -16, -34, 32, 22, 3); ctx.fill();
        ctx.strokeStyle = '#f1e3c6'; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i <= 8; i++) { const xx = -14 + i * 3.5, yy = i % 2 ? -14 : -32; if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
        ctx.stroke();
        ctx.fillStyle = '#efe0c0'; ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 1;
        for (const sx of [-16, 16]) { ctx.beginPath(); ctx.ellipse(sx, -23, 3.6, 11, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
      },
      afterArms: () => {
        const hr = hands.R, hl = hands.L;
        ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        const dx = 17 - hr.x, dy = -21 - hr.y, d = Math.hypot(dx, dy) || 1;
        line(hr.x, hr.y, hr.x + dx / d * 9, hr.y + dy / d * 9);
        ctx.fillStyle = '#5a3a22'; circ(hr.x + dx / d * 10, hr.y + dy / d * 10, 2.8);
        ctx.strokeStyle = '#c9a26b'; ctx.lineWidth = 1; line(hl.x, hl.y, -16.5, -20);
      },
    });
    ctx.restore();
    return p.y - (72 + bob) * s;
  }

  function drawZurnaci(gm) {
    const p = G.ZURNA, s = G.MUS_S, b = gm.beat;
    const bob = Math.sin((b % 1) * PI) * 1;
    const an = { lift: bob, bob, squat: 0, sx: 0, kickL: 0, kickR: 0, jump: 0, blink: false };
    const ang = Math.sin((b * PI) / 2) * 0.05 - (gm.level >= 3 ? 0.06 : 0);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang); ctx.scale(s, s);
    drawFigure(ZURNA, an, { x: -1, y: -33 }, { x: 3.5, y: -23 }, {
      armsLate: true, puff: true,
      afterHead: () => {
        ctx.fillStyle = '#7a4a22';
        ctx.beginPath(); ctx.moveTo(-1, -45.5); ctx.lineTo(1, -45.5); ctx.lineTo(7.5, -14); ctx.lineTo(-1.5, -14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a3416'; ell(3, -13.5, 5.2, 2);
        ctx.fillStyle = '#e7b84a'; rr(ctx, -1.7, -47.5, 3.4, 2.2, 0.6); ctx.fill();
        ctx.fillStyle = '#2a170a'; for (let i = 0; i < 5; i++) circ(0.8 + i * 0.9, -40 + i * 4.5, 0.6);
      },
    });
    ctx.restore();
    return p.y - 72 * s;
  }

  // ---------- etiketler & balonlar ----------
  function pill(x, y, txt, bgc, fg, fs, k = G.K) {
    fs *= k;
    ctx.font = `800 ${fs}px ${FONT}`;
    const w = ctx.measureText(txt).width + fs * 1.1, h = fs * 1.6;
    const X = CD.clamp(x - w / 2, 4, W - w - 4);
    ctx.fillStyle = bgc; rr(ctx, X, y - h, w, h, h / 2); ctx.fill();
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, X + w / 2, y - h / 2 + 0.5);
    return h;
  }

  function bubble(gx, y, text, a) {
    if (text.length > 28) text = text.slice(0, 27) + '…';
    const K = G.K, tl = 8 * K;
    ctx.font = `700 ${12.5 * K}px ${FONT}`;
    const w = ctx.measureText(text).width + 16 * K, h = 22 * K;
    const X = CD.clamp(gx - w / 2, 4, W - w - 4);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; rr(ctx, X + 2, y - h - tl + 2, w, h, 9 * K); ctx.fill();
    ctx.fillStyle = '#ffffff'; rr(ctx, X, y - h - tl, w, h, 9 * K); ctx.fill();
    ctx.beginPath(); ctx.moveTo(gx - tl * 0.6, y - tl - 0.5); ctx.lineTo(gx + tl * 0.6, y - tl - 0.5); ctx.lineTo(gx, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a1a2e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, X + w / 2, y - h / 2 - tl + 0.5);
    ctx.globalAlpha = 1;
  }

  function labels(gm, all, heads) {
    for (const g of all) {
      if (g._headY == null) continue;
      let txt = g.nick, bgc = 'rgba(18,10,26,.72)', fg = '#fff', fs = 9;
      if (g.id === gm.sagdic) { txt = '👑 Sağdıç · ' + g.nick; bgc = 'rgba(246,196,83,.96)'; fg = '#3a2300'; fs = 13; }
      else if (g.id === gm.halaybasi) { txt = '🧣 Halaybaşı · ' + g.nick; bgc = 'rgba(255,79,123,.95)'; fs = 12; }
      else if (g.vip) { txt = '💃 ' + g.nick; bgc = 'rgba(61,220,151,.95)'; fg = '#05301d'; fs = 10.5; }
      ctx.globalAlpha = CD.clamp(g.alpha, 0, 1);
      const h = pill(g.x, g._headY, txt, bgc, fg, fs);
      g._tagTop = g._headY - h;
    }
    ctx.globalAlpha = 1;
    const cn = coupleNames(), dv = gm.roles.davulcu;
    pill(G.CX, R._heroHead, `👰 ${cn.gelin}  ♥  ${cn.damat} 🤵`, 'rgba(255,255,255,.95)', '#7a1035', 14);
    if (dv) pill(G.DAVUL.x, heads.davul, '🥁 Davulcu · ' + dv.nick, gm.time < gm.davulBoost ? 'rgba(255,120,40,.96)' : 'rgba(246,196,83,.96)', '#3a1a00', 12);
    else pill(G.DAVUL.x, heads.davul, '🥁 Davulcu', 'rgba(123,30,43,.9)', '#fff', 11);
    pill(G.ZURNA.x, heads.zurna, '🎶 Zurnacı', 'rgba(30,58,95,.9)', '#fff', 11);
  }

  function bubbles(gm, all, heads) {
    const anchors = { gelin: [G.BRIDE.x - 30, R._heroHead - 48], damat: [G.GROOM.x + 30, R._heroHead - 48], davulcu: [G.DAVUL.x, heads.davul - 40] };
    for (const k in anchors) {
      const r = gm.roles[k], g = r && gm.guests.get(r.id), b = g && g.bubble;
      if (!b) continue;
      const age = gm.time - b.t;
      if (age > 5.5) { g.bubble = null; continue; }
      bubble(anchors[k][0], anchors[k][1], b.text, Math.min(1, age * 6, (5.5 - age) * 2));
    }
    for (const g of all) {
      if (g._tagTop == null) continue;
      const b = g.bubble;
      if (b) {
        const age = gm.time - b.t;
        if (age > 5.5) { g.bubble = null; continue; }
        bubble(g.x, g._tagTop - 3, b.text, Math.min(1, age * 6, (5.5 - age) * 2) * CD.clamp(g.alpha, 0, 1));
      } else if (gm.time - g.welcomeT < 2.6) {
        ctx.globalAlpha = Math.min(1, (2.6 - (gm.time - g.welcomeT)) * 2);
        pill(g.x, g._tagTop - 3, 'Hoş geldin! 👋', 'rgba(61,220,151,.95)', '#05301d', 11);
        ctx.globalAlpha = 1;
      }
    }
  }

  function plate(gm) {
    const c = gm.takiCount, coins = c.ceyrek + c.yarim + c.tam;
    let txt = '💛 Takı töreni başlasın!';
    if (coins || c.bilezik || c.besi) {
      const parts = [];
      if (coins) parts.push(`${coins} altın`);
      if (c.bilezik) parts.push(`${c.bilezik} bilezik`);
      if (c.besi) parts.push(`${c.besi} beşi bir yerde`);
      txt = '💛 Takılar: ' + parts.join(' · ');
    }
    pill(G.CX, G.PLATE_Y, txt, 'rgba(20,10,24,.78)', '#f6c453', 14);
  }

  function heart(x, y, s, col, a) {
    ctx.globalAlpha = a; ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.5, y - s, x, y - s * 0.45);
    ctx.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
    ctx.fill(); ctx.globalAlpha = 1;
  }

  function particles(gm) {
    for (const h of gm.hearts) heart(h.x, h.y, h.size, h.col, CD.clamp(h.life, 0, 1));
    for (const c of gm.coins) {
      if (c.t < 0) continue;
      const u = CD.clamp(c.t / c.dur, 0, 1), tp = gm.takiTarget(c.to);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const x = CD.lerp(c.sx, tp.x, e), y = CD.lerp(c.sy, tp.y, e) - Math.sin(u * PI) * 260;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(x, y, 32, 'rgba(255,200,80,.55)'); ctx.restore();
      if (c.tier === 'bilezik') { ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.stroke(); }
      else coin(x, y, c.tier === 'besi' ? 16 : 10);
    }
    for (const p of gm.sparks) {
      ctx.globalAlpha = CD.clamp(p.life / 0.6, 0, 1); ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 7); ctx.lineTo(p.x + 2, p.y); ctx.lineTo(p.x, p.y + 7); ctx.lineTo(p.x - 2, p.y); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(p.x - 7, p.y); ctx.lineTo(p.x, p.y + 2); ctx.lineTo(p.x + 7, p.y); ctx.lineTo(p.x, p.y - 2); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function money(gm) {
    const w = 46, h = 23;
    for (const m of gm.money) {
      if (m.delay > 0) continue;
      ctx.save(); ctx.globalAlpha = CD.clamp(m.life, 0, 1);
      ctx.translate(m.x, m.y); ctx.rotate(m.rot); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(m.rot * 1.3 + m.ph)));
      ctx.fillStyle = m.col; rr(ctx, -w / 2, -h / 2, w, h, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; rr(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `900 15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('₺', 0, 1);
      ctx.restore();
    }
  }

  function confetti(gm) {
    for (const c of gm.confetti) {
      ctx.save(); ctx.globalAlpha = CD.clamp(c.life, 0, 1);
      ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.scale(1, Math.cos(c.rot * 1.7));
      ctx.fillStyle = c.col; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
  }

  // ---------- kare ----------
  R.frame = () => {
    const gm = CD.game;
    ctx.setTransform(q, 0, 0, q, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bg, 0, 0, W, H);
    lights(gm);

    const order = gm.order, sd = gm.sagdic ? gm.guests.get(gm.sagdic) : null;
    const pre = (g) => {
      const s = g === sd ? G.SAGDIC_S : CD.depthS(g.y), an = anim(g, gm);
      g._s = s; g._an = an; g._linkPt = null; g._headY = null; g._tagTop = null;
      g._sh = { x: g.x + an.sx * s, y: g.y - (35 + an.lift - an.squat) * s };
    };
    order.forEach(pre); gm.leaving.forEach(pre); if (sd) pre(sd);

    const heads = {};
    const list = [];
    for (const g of order) list.push([g.y, () => drawGuest(g, order, gm, null)]);
    for (const g of gm.leaving) list.push([g.y, () => drawGuest(g, null, gm, null)]);
    if (sd) list.push([sd.y, () => drawGuest(sd, null, gm, 'sagdic')]);
    list.push([G.DAVUL.y, () => { heads.davul = drawDavulcu(gm); }]);
    list.push([G.ZURNA.y + 0.01, () => { heads.zurna = drawZurnaci(gm); }]);
    list.push([G.BRIDE.y, () => couple(gm, sd)]);
    list.sort((a, b) => a[0] - b[0]);
    for (const d of list) d[1]();

    money(gm);
    particles(gm);
    const all = order.slice(); if (sd) all.push(sd);
    all.sort((a, b) => a.y - b.y);
    labels(gm, all, heads);
    bubbles(gm, all, heads);
    confetti(gm);
    ctx.drawImage(vig, 0, 0, W, H);
  };
})();
