// Sıra Gecesi — ana döngü: sahne, oyun, kamera, efektler, arayüz, canlı bağlantı.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildSalon } from './salon.js';
import { createGame } from './oyun.js';
import { createDirector, TOUR } from './kamera.js';
import { createUI } from './arayuz.js';
import { createDemo } from './demo.js';

const W = 1080, H = 1920;
const qs = new URLSearchParams(location.search);
const LOW = qs.get('kalite') === 'dusuk';

// ---------- render ----------
const canvas = document.getElementById('cv');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // gölge iki karede bir güncellenir (performans)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#120905');
scene.fog = new THREE.Fog('#120905', 30, 62);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.22;
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 90);

const salon = buildSalon(scene);
const G = createGame(scene, salon);
window.CD = window.CD || {}; window.CD.game = G; // ses.js tempo seviyesini buradan okur
const director = createDirector(camera);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 6, aperture: 0.0009, maxblur: 0.006 });
if (!LOW) composer.addPass(bokeh);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.42, 0.55, 0.8);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function setQuality(q) {
  const s = LOW ? Math.min(q, 0.6) : q;
  renderer.setPixelRatio(1);
  renderer.setSize(Math.round(W * s), Math.round(H * s), false);
  composer.setSize(Math.round(W * s), Math.round(H * s));
}

// ---------- demo + canlı ----------
const demo = createDemo(G);
const live = { status: { state: 'idle' } };
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).catch(() => {});
live.connect = (u) => post('/api/connect', { username: u });
live.disconnect = () => post('/api/disconnect');

const UI = createUI(G, camera, salon, {
  onQuality: setQuality, demo, live,
  onFocus: (name) => director.focusOn(name, 6),
  onJump: (i) => director.jump(TOUR[i][0]),
});

// hediye kuralları (hediyeler.json)
fetch('/api/rules').then((r) => r.json()).then((j) => { if (Array.isArray(j.kurallar) && j.kurallar.length) G.rules = j.kurallar; UI.renderRuleButtons(); }).catch(() => UI.renderRuleButtons());
UI.renderRuleButtons();

// sunucudan gerçek olaylar (SSE)
if (location.protocol !== 'file:' && window.EventSource) {
  demo.paused = true;
  setTimeout(() => { demo.paused = false; }, 3000);
  const es = new EventSource('/api/events');
  es.onmessage = (e) => {
    let ev; try { ev = JSON.parse(e.data); } catch { return; }
    if (ev.type === 'status') { live.status = ev.status; UI.setLive(ev.status); demo.paused = false; return; }
    G.handle(ev);
  };
}
// müzik
const A = window.CD.audio;
A.loadTracks().then(() => UI.refreshSoundBtn());

// ---------- döngü ----------
const clock = new THREE.Clock();
let frames = 0;
function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  demo.tick(dt);
  A.bpm = G.bpm; // sentez davul tempo
  const mb = A.musicBpm ? A.musicBpm() : 0;
  G.bpm += ((mb || [92, 106, 122, 138][G.level]) - G.bpm) * Math.min(1, dt * 1.2);
  if (A.tick) A.tick(G.level, dt);
  G.update(dt, A.beatAt());
  director.update(dt);
  bokeh.uniforms.focus.value = director.dist;
  // ışık kıpırtısı
  const t = G.time;
  salon.lamps.forEach((l, i) => { l.intensity = 5 + Math.sin(t * 11 + i * 3) * 0.35 + Math.sin(t * 6.3 + i) * 0.25; });
  salon.bulbs.forEach((b, i) => { b.material.emissiveIntensity = G.level >= 3 ? 3 + 4 * ((Math.sin(t * 8 - i * 0.6) + 1) / 2) : 5; });
  if (frames % 2 === 0) renderer.shadowMap.needsUpdate = true;
  composer.render();
  UI.draw(dt);
  UI.tick(dt);
  if (++frames === 30) window.__ready = true;
  requestAnimationFrame(loop);
}
loop();
