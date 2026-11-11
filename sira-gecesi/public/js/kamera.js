// Kamera yönetmeni: sabit tur (orkestra → çiğ köfte → sol masalar → sağ masalar → genel plan)
// + olaylara kısa odak (biri sazcı olunca orkestraya gider vb.). Planlar arası yumuşak geçiş.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

const SHOTS = {
  orkestra: (u) => ({ pos: V(lerp(-0.5, 0.5, u), 4.4, lerp(-2.2, -2.8, u)), look: V(0, 1.0, -8.6), fov: 42 }),
  cigkofte: (u) => { const a = lerp(0.98, 1.12, u); return { pos: V(Math.cos(a) * 1.95, 2.25, Math.sin(a) * 1.95), look: V(0, 0.15, 0), fov: 52 }; },
  halay: (u) => { const a = lerp(-0.5, 0.5, u); return { pos: V(Math.sin(a) * 9.5, 5.2, Math.cos(a) * 9.5), look: V(0, 0.6, 0), fov: 50 }; },
  masaSol: (u) => ({ pos: V(-5.4, 3.6, lerp(12.0, 10.5, u)), look: V(-7.4, 0.4, lerp(1.5, -1.5, u)), fov: 46 }),
  masaSag: (u) => ({ pos: V(5.4, 3.6, lerp(12.0, 10.5, u)), look: V(7.4, 0.4, lerp(1.5, -1.5, u)), fov: 46 }),
  // genel plan: halay halkaları ekranı doldursun (insanlar kendini görsün), sahne arkada görünsün
  genel: (u) => ({ pos: V(Math.sin(u * 1.2 - 0.6) * 2.0, lerp(10.6, 9.8, u), lerp(11.4, 10.4, u)), look: V(0, 0, -1.2), fov: 50 }),
};
// süreler (sn): genel plan en uzun (herkes kendini görsün), halay 20, orkestra ve çiğ köfte 5
export const TOUR = [['genel', 30], ['orkestra', 5], ['cigkofte', 5], ['halay', 20], ['masaSol', 6], ['masaSag', 6]];
const BLEND = 2.2;

export function createDirector(camera) {
  const D = { i: 0, t: 0, cur: TOUR[0][0], dur: TOUR[0][1], from: null, focus: null, look: V(0, 0, 0), dist: 5 };
  // olay odağı sırasında aynı bölüme yeni olay gelirse süre uzar (art arda hediyeler kamerayı oynatmasın)

  function pose(name, u) { return SHOTS[name](Math.min(1, Math.max(0, u))); }
  function snapshot() { return { pos: camera.position.clone(), look: D.look.clone(), fov: camera.fov }; }
  function go(name, dur) { D.from = snapshot(); D.cur = name; D.dur = dur; D.t = 0; }

  // olay odağı: turu bölüp kısa süre o bölüme gider, sonra tura devam eder
  D.focusOn = (name, dur = 6) => {
    if (!SHOTS[name]) return;
    if (D.focus && D.cur === name) { D.dur = Math.max(D.dur, D.t + dur); return; }
    D.focus = true; go(name, dur);
  };
  D.jump = (name) => { const k = TOUR.findIndex((s) => s[0] === name); if (k >= 0) { D.i = k; D.focus = false; go(name, TOUR[k][1]); } };

  D.update = (dt) => {
    D.t += dt;
    if (D.t >= D.dur) {
      if (D.focus) { D.focus = false; }
      else D.i = (D.i + 1) % TOUR.length;
      go(TOUR[D.i][0], TOUR[D.i][1]);
    }
    const p = pose(D.cur, D.t / D.dur);
    if (D.from && D.t < BLEND) {
      const k = smooth(D.t / BLEND);
      p.pos.lerpVectors(D.from.pos, p.pos, k); p.look.lerpVectors(D.from.look, p.look, k); p.fov = lerp(D.from.fov, p.fov, k);
    }
    camera.position.copy(p.pos); D.look.copy(p.look); camera.lookAt(p.look);
    if (Math.abs(camera.fov - p.fov) > 0.01) { camera.fov = p.fov; camera.updateProjectionMatrix(); }
    D.dist = p.pos.distanceTo(p.look);
    return D;
  };
  return D;
}
