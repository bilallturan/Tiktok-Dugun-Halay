// Sıra Gecesi — yerel sunucu
//  • public/ klasörünü servis eder (sahne sayfası)
//  • tiktok-live-connector ile TikTok LIVE yayınına bağlanır
//  • gelen olayları oyunun formatına çevirip SSE (/api/events) ile açık tüm sayfalara yollar
//
// Kullanıcı adı: arayüzden girilir (ayarlar.json'a kaydedilir) veya `node server.js kullaniciadi`
// İsteğe bağlı Euler Stream anahtarı: ayarlar.json → "signApiKey" ya da EULER_API_KEY ortam değişkeni
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3100;
const THREE_DIR = path.join(__dirname, 'node_modules', 'three');
const ROOT = path.join(__dirname, 'public');
const CONFIG_FILE = path.join(__dirname, 'ayarlar.json');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg',
  '.opus': 'audio/ogg', '.wav': 'audio/wav', '.webm': 'audio/webm', '.flac': 'audio/flac',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime',
};
let MUSIC_DIR = path.join(ROOT, 'muzik'); // müzik klasörü (aşağıda ayarlara göre belirlenir)
const AUDIO_RE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|webm|flac|mp4|m4v|mov)$/i; // videolardan sadece sesi çalınır

// Statik dosya (müzikte ileri sarma için Range desteğiyle)
function serveFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('404'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m) {
      const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
      if (a > b) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1, 'Cache-Control': 'no-cache' });
      return fs.createReadStream(file, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

// ---------- ayarlar ----------
const config = { username: '', signApiKey: '' };
try { Object.assign(config, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))); } catch {}
if (process.env.EULER_API_KEY) config.signApiKey = process.env.EULER_API_KEY;
if (process.argv[2]) config.username = process.argv[2].replace(/^@/, '');
// Müzik klasörü: ayarlar.json "musicDir" > bu klasördeki "müzik" klasörü (düğün müzikleri KULLANILMAZ)
const OWN_MUSIC = [path.join(__dirname, 'müzik'), path.join(__dirname, 'muzik')].find((d) => fs.existsSync(d));
if (config.musicDir) MUSIC_DIR = path.resolve(__dirname, config.musicDir);
else if (OWN_MUSIC) MUSIC_DIR = OWN_MUSIC;

const IMG_FILE = path.join(__dirname, 'hediye-resimleri.json');
const readImages = () => { try { return JSON.parse(fs.readFileSync(IMG_FILE, 'utf8')); } catch { return {}; } };

const saveConfig = () => { try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch {} };

// ---------- SSE: sayfalara olay yayını ----------
const clients = new Set();
function broadcast(obj) {
  const s = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of clients) res.write(s);
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 20000);

// ---------- TikTok bağlantısı ----------
const live = { conn: null, username: '', gen: 0, timer: null, ended: false };
let status = { state: 'idle', username: '', message: 'Bağlı değil' };
function setStatus(state, message) {
  status = { state, username: live.username, message };
  broadcast({ type: 'status', status });
  console.log(`[TikTok] ${state.padEnd(10)} ${message}`);
}

let lib = null;
const loadLib = async () => {
  if (lib) return lib;
  lib = await import('tiktok-live-connector');
  // "Yayında mı?" kontrolü Euler'a düşmesin (her düşüş saatlik bağlantı kotasından yer):
  // TikTok'un kendi sayfası/API'si yeterli. Euler sadece gerçek bağlantıda kullanılır.
  if (lib.IsLiveRouteConfig) lib.IsLiveRouteConfig.skipFetchRoomIdFromEulerRoute = true;
  return lib;
};

// TikTok'un ham mesajlarını oyunun olay formatına çevir (kütüphane sürümüne göre alan adları değişebiliyor)
function userOf(d) {
  const u = (d && d.user) || {};
  const handle = u.uniqueId || u.displayId || '';
  const id = String(handle || u.userId || u.id || '');
  if (!id) return null;
  return { id: 'tt_' + id, nick: String(u.nickname || handle || id).slice(0, 24) };
}
function imageOf(img) {
  if (!img) return '';
  const list = img.urlList || img.url_list || img.mUrls || img.url || [];
  return Array.isArray(list) ? list[0] || '' : String(list);
}
const GIFT_ICONS = { rose: '🌹', gül: '🌹', heart: '💗', kalp: '💗', 'finger heart': '🫰', perfume: '🧴', parfüm: '🧴', doughnut: '🍩', donut: '🍩', 'hand hearts': '🫶', confetti: '🎊', konfeti: '🎊', galaxy: '🌌', galaksi: '🌌', lion: '🦁', aslan: '🦁', universe: '🪐', 'ice cream cone': '🍦', 'gg': '🎮', 'tiktok': '🎵', 'cap': '🧢', 'hat': '🎩', 'sunglasses': '🕶️', 'corgi': '🐶', 'money gun': '💸', 'rocket': '🚀', 'airplane': '✈️', 'sports car': '🏎️', 'crown': '👑' };

function send(type, d, extra) {
  const user = userOf(d);
  if (user) broadcast({ type, user, ...extra });
}

function attach(conn, gen) {
  const { WebcastEvent, ControlEvent } = lib;
  // Sadece güncel bağlantının olayları sayılır (eski/yenilenmiş bağlantılar susar)
  const mine = () => gen === live.gen && conn === live.conn;

  conn.on(ControlEvent.ERROR, (e) => { if (mine()) console.warn('[TikTok] hata:', (e && (e.info || e.message)) || e); });
  conn.on(ControlEvent.DISCONNECTED, () => {
    if (!mine() || live.ended) return;
    setStatus('waiting', 'Bağlantı koptu, 10 sn sonra tekrar denenecek…');
    retry(gen, 10000);
  });
  conn.on(WebcastEvent.STREAM_END, ({ action } = {}) => {
    if (!mine()) return;
    live.ended = true;
    console.log(`[TikTok] yayın bitti sinyali (oda ${conn.roomId || '?'}, action ${action})`);
    setStatus('waiting', `@${live.username} yayını bitti. Yeni yayın açılınca otomatik bağlanacak.`);
    // bağlanır bağlanmaz "bitti" geldiyse TikTok eski odayı gösteriyor: hemen tekrar denersek kota yanar
    const quick = Date.now() - (live.connectedAt || 0) < 30000;
    retry(gen, quick ? 90000 : 30000);
  });

  const on = (ev, fn) => conn.on(ev, (d) => { if (mine()) fn(d); });
  on(WebcastEvent.CHAT, (d) => send('chat', d, { text: String(d.comment || d.content || '') }));
  on(WebcastEvent.MEMBER, (d) => send('member', d));
  on(WebcastEvent.LIKE, (d) => send('like', d, { count: Number(d.likeCount ?? d.count ?? 1) || 1 }));
  on(WebcastEvent.FOLLOW, (d) => send('follow', d));
  on(WebcastEvent.SHARE, (d) => send('share', d));
  on(WebcastEvent.ROOM_USER, (d) => {
    const n = Number(d.viewerCount ?? d.total ?? d.totalUser);
    if (Number.isFinite(n) && n >= 0) broadcast({ type: 'viewers', count: n });
  });
  on(WebcastEvent.GIFT, (d) => {
    const g = d.gift || {}, gd = d.giftDetails || {}, ex = d.extendedGiftInfo || {};
    const giftType = gd.giftType ?? g.type ?? ex.type;
    // Seri gönderilebilen hediyeler (type 1) seri bitene kadar defalarca gelir: sadece son olayı işle
    if (giftType === 1 && !d.repeatEnd) return;
    const name = String(gd.giftName || g.name || ex.name || 'Hediye');
    const diamonds = Number(gd.diamondCount ?? g.diamondCount ?? ex.diamond_count ?? ex.diamondCount ?? 1) || 1;
    const count = Math.max(1, Number(d.repeatCount) || 1);
    const icon = GIFT_ICONS[name.toLocaleLowerCase('tr')] || '🎁';
    const image = imageOf(g.image) || imageOf(ex.image) || imageOf(gd.giftImage);
    const id = String(d.giftId || g.id || gd.id || '');
    const u = userOf(d);
    console.log(`[Hediye] ${u ? u.nick : '?'} → ${name} (id ${id || '-'}) ${diamonds} jeton ×${count}`);
    send('gift', d, { gift: { name, id, diamonds, count, icon, image } });
  });
}

function retry(gen, ms) {
  clearTimeout(live.timer);
  live.timer = setTimeout(() => tryConnect(gen), ms);
}

// Her denemede YENİ bağlantı nesnesi: eskisi bitmiş yayının oda numarasını aklında tutuyor,
// onu tekrar kullanınca yeni açılan yayın hiç bulunamıyordu.
function newConn(gen) {
  const c = new lib.TikTokLiveConnection(live.username, {
    // Hediye listesini çekmek Euler'de ücretli (Business) imza istiyor; gerek yok:
    // her hediye olayında ad, elmas değeri ve görsel zaten geliyor.
    enableExtendedGiftInfo: false,
    processInitialData: false, // bağlanınca eski yorumları/sinyalleri tekrar oynatma
    ...(config.signApiKey ? { signApiKey: config.signApiKey } : {}),
  });
  attach(c, gen);
  return c;
}

async function tryConnect(gen) {
  if (gen !== live.gen) return;
  const old = live.conn;
  if (old) { live.conn = null; old.disconnect().catch(() => {}); }
  const conn = live.conn = newConn(gen);
  live.ended = false;
  // 1) Önce ücretsiz kontrol: TikTok'un kendi sayfasından "yayında mı?" (Euler bağlantı kotasından yemez).
  //    Yayında değilse bağlanmayı hiç denemeyiz.
  let isLive = null;
  try { isLive = await conn.fetchIsLive(); } catch { isLive = null; }
  if (gen !== live.gen || conn !== live.conn) return;
  if (isLive === false) {
    setStatus('waiting', `@${live.username} şu an yayında değil. Yayın açılınca otomatik bağlanacak (30 sn'de bir kontrol).`);
    retry(gen, 30000);
    return;
  }
  setStatus('connecting', `@${live.username} yayınına bağlanılıyor…`);
  try {
    await conn.connect();
    if (gen !== live.gen || conn !== live.conn) { conn.disconnect().catch(() => {}); return; }
    live.connectedAt = Date.now();
    console.log(`[TikTok] oda ${conn.roomId}`);
    setStatus('live', `@${live.username} canlı yayınına bağlandı`);
  } catch (err) {
    if (gen !== live.gen || conn !== live.conn) return;
    const msg = String((err && err.message) || err);
    const offline = (lib.UserOfflineError && err instanceof lib.UserOfflineError) || /offline|not live|isn't online|not online/i.test(msg);
    const rate = /rate.?limit|too many/i.test(msg);
    if (rate) {
      // Euler ücretsiz katman saatlik bağlantı sınırı: sık denemek sadece süreyi uzatır
      setStatus('error', 'TikTok bağlantı servisinin (Euler) saatlik bağlantı sınırı doldu. 10 dk sonra kendiliğinden tekrar denenecek.');
      retry(gen, 10 * 60000);
      return;
    }
    if (offline) setStatus('waiting', `@${live.username} şu an yayında değil. Yayın açılınca otomatik bağlanacak (30 sn'de bir kontrol).`);
    else setStatus('error', `Bağlanamadı: ${msg.slice(0, 160)} — 45 sn sonra tekrar denenecek.`);
    retry(gen, offline ? 30000 : 45000);
  }
}

async function disconnect() {
  live.gen++;
  clearTimeout(live.timer);
  const c = live.conn;
  live.conn = null;
  if (c) { try { await c.disconnect(); } catch {} }
}

async function connect(username) {
  username = String(username || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '').replace(/\/.*$/, '');
  await disconnect();
  if (!username) { setStatus('idle', 'Bağlı değil'); return; }
  await loadLib();
  const gen = live.gen;
  live.username = username;
  config.username = username; saveConfig();
  tryConnect(gen);
}

// ---------- HTTP ----------
function readJson(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}
const json = (res, obj, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { p = '/'; }

  if (p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ type: 'status', status })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (p === '/api/status') return json(res, { status, savedUsername: config.username });
  if (p === '/api/connect' && req.method === 'POST') {
    const body = await readJson(req);
    connect(body.username).catch((e) => setStatus('error', 'Bağlanamadı: ' + e.message));
    return json(res, { ok: true });
  }
  if (p === '/api/disconnect' && req.method === 'POST') {
    await disconnect();
    config.username = ''; saveConfig();
    setStatus('idle', 'Bağlantı kesildi');
    return json(res, { ok: true });
  }

  if (p === '/api/rules') { // hediyeler.json her istekte okunur: düzenleyip sayfayı yenilemek yeter
    try {
      const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'hediyeler.json'), 'utf8'));
      const imgs = readImages();
      for (const r of data.kurallar || []) if (!r.resim && imgs[r.eylem]) r.resim = imgs[r.eylem];
      return json(res, data);
    } catch (e) { return json(res, { kurallar: [], hata: 'hediyeler.json okunamadı: ' + e.message }); }
  }
  if (p === '/api/rule-image' && req.method === 'POST') { // öğrenilen gerçek hediye resimleri
    const b = await readJson(req);
    if (b.eylem && /^https:\/\//.test(b.resim || '')) {
      const imgs = readImages(); imgs[String(b.eylem)] = String(b.resim);
      try { fs.writeFileSync(IMG_FILE, JSON.stringify(imgs, null, 2)); } catch {}
    }
    return json(res, { ok: true });
  }
  if (p === '/api/music') {
    let tracks = [];
    try { tracks = fs.readdirSync(MUSIC_DIR).filter((f) => AUDIO_RE.test(f)).sort((a, b) => a.localeCompare(b, 'tr')); } catch {}
    return json(res, { tracks });
  }

  if (p.startsWith('/muzik/')) {
    const mf = path.normalize(path.join(MUSIC_DIR, p.slice(7)));
    if (!mf.startsWith(MUSIC_DIR) || !AUDIO_RE.test(mf)) { res.writeHead(403); return res.end(); }
    return serveFile(req, res, mf);
  }

  if (p.startsWith('/three/')) { // three.js modülleri
    const tf = path.normalize(path.join(THREE_DIR, p.slice(7)));
    if (!tf.startsWith(THREE_DIR)) { res.writeHead(403); return res.end(); }
    return serveFile(req, res, tf);
  }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  serveFile(req, res, file);
}).listen(PORT, () => {
  console.log(`\n  💍 Sıra Gecesi hazır:        http://localhost:${PORT}`);
  console.log(`  🎬 OBS için (yayın modu):   http://localhost:${PORT}/?clean\n`);
  let n = 0; try { n = fs.readdirSync(MUSIC_DIR).filter((f) => AUDIO_RE.test(f)).length; } catch {}
  console.log(`  🎵 Müzik klasörü (${n} parça): ${MUSIC_DIR}\n`);
  if (config.username) connect(config.username); // kayıtlı kullanıcı varsa otomatik bağlan / yayını bekle
}).on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`\n  ✅ Sunucu zaten açık: http://localhost:${PORT}  (bu pencereyi kapatabilirsin)\n`);
    process.exit(0);
  }
  throw e;
});
