// =====================================================================
//  متحف حبّنا — v2  (Three.js)
// =====================================================================
import * as THREE from '../lib/three.module.js';

// ---------------------------------------------------------------- config
const CFG = Object.assign({
  title: 'متحف حبّنا', him: 'هو', her: 'هي', theme: 'modern',
  dedication: {}, endingTitle: 'وصلنا ❤️', endingMessage: '', music: '',
  herSays: [], himSays: [], photosPerRoom: 8, photos: {}, puzzles: [], autoPuzzles: true, looks: {},
}, window.MUSEUM_CONFIG || {});
CFG.photosPerRoom = Math.max(4, Math.min(8, (CFG.photosPerRoom | 0) || 8));
CFG.photos = CFG.photos || {};
const DED = Object.assign({ title: '', message: '', signature: '' }, CFG.dedication || {});
DED.title = DED.title || ('إلى ' + CFG.her);
DED.signature = DED.signature || ('دائماً، ' + CFG.him);

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- "together since" counter
function arCount(n, one, two, few, many) {
  if (n === 1) return one; if (n === 2) return two;
  return n + ' ' + (n >= 3 && n <= 10 ? few : many);
}
function sinceInfo() {
  const m = String(CFG.since || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const s = new Date(+m[1], +m[2] - 1, +m[3]), now = new Date();
  now.setHours(0, 0, 0, 0);
  if (isNaN(s) || s > now) return null;
  let y = now.getFullYear() - s.getFullYear(), mo = now.getMonth() - s.getMonth(), d = now.getDate() - s.getDate();
  if (d < 0) { mo--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (mo < 0) { y--; mo += 12; }
  const days = Math.round((now - s) / 86400000);
  const parts = [];
  if (y) parts.push(arCount(y, 'سنة', 'سنتين', 'سنين', 'سنة'));
  if (mo) parts.push(arCount(mo, 'شهر', 'شهرين', 'شهور', 'شهر'));
  if (d) parts.push(arCount(d, 'يوم', 'يومين', 'أيام', 'يوم'));
  const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
  return {
    date: `${s.getDate()} ${MONTHS[s.getMonth()]} ${s.getFullYear()}`,
    short: `${m[3].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[1]}`,
    span: parts.length ? parts.join(' و') : 'من اليوم',
    days,
  };
}
const SINCE = sinceInfo();
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

// ---------------------------------------------------------------- save
const SAVE_KEY = 'love-museum2:' + location.pathname;
const save = { found: [], solved: [], kind: null, looks: {}, theme: null, endingSeen: false, musicOff: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) {}
const found = new Set(save.found), solved = new Set(save.solved);
function persist() {
  save.found = [...found]; save.solved = [...solved];
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - t, 3);
const pick = (a) => a[(Math.random() * a.length) | 0];
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function normalizeAr(s) {
  return String(s || '').toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[.,!?؟،"'()\-_:;]/g, ' ').replace(/\s+/g, ' ').trim();
}
function prettyName(file) {
  let n = file.replace(/\.[^.]+$/, '');
  if (/^(img|dsc|pxl|whatsapp|screenshot|photo|image|vid|mvimg|signal|telegram|fb_img|received)/i.test(n)) return '';
  n = n.replace(/^[\d\s._-]+/, '').replace(/[_-]+/g, ' ').trim();
  if (!n || /^\d+$/.test(n.replace(/\s/g, ''))) return '';
  return n;
}
function canvasTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
const FONT_SERIF = 'Amiri, Tajawal, "Segoe UI", Tahoma, serif';
const FONT_SANS = 'Tajawal, "Segoe UI", Tahoma, sans-serif';

// =====================================================================
//  AUDIO — chimes + procedural music box (used when no music file)
// =====================================================================
let actx = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, t, dur, vol, type = 'sine', dest) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest || a.destination);
  o.start(t); o.stop(t + dur + 0.05);
}
function chime(freqs = [784, 988, 1319], dur = 0.9, vol = 0.08) {
  const a = audio(); if (!a) return;
  freqs.forEach((f, i) => tone(f, a.currentTime + i * 0.09, dur, vol));
}
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MusicBox = {
  on: false, timer: 0, next: 0, step: 0, gain: null, fast: false,
  start() {
    const a = audio(); if (!a || this.on) return;
    this.on = true;
    this.gain = a.createGain(); this.gain.gain.value = 0; this.gain.connect(a.destination);
    this.gain.gain.linearRampToValueAtTime(0.55, a.currentTime + 2);
    this.next = a.currentTime + 0.15;
    this.timer = setInterval(() => this.sched(), 60);
  },
  stop() {
    if (!this.on) return;
    this.on = false; clearInterval(this.timer);
    const g = this.gain, a = actx;
    g.gain.cancelScheduledValues(a.currentTime);
    g.gain.setValueAtTime(g.gain.value, a.currentTime);
    g.gain.linearRampToValueAtTime(0, a.currentTime + 0.6);
    setTimeout(() => g.disconnect(), 900);
  },
  sched() {
    const spb = 60 / (this.fast ? 104 : 76) / 2;
    while (this.next < actx.currentTime + 0.3) { this.note(this.step, this.next); this.next += spb; this.step++; }
  },
  note(step, t) {
    const chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
    const ch = chords[Math.floor(step / 8) % 4];
    const pat = [0, 1, 2, 1, 2, 0, 2, 1];
    const n = ch[pat[step % 8]] + 12 + (step % 16 === 6 ? 12 : 0);
    tone(midi(n), t, 1.3, 0.07, 'sine', this.gain);
    tone(midi(n) * 2, t, 0.5, 0.015, 'triangle', this.gain);
    if (step % 8 === 0) tone(midi(ch[0] - 12), t, 2.2, 0.06, 'sine', this.gain);
    if (this.fast && step % 2 === 0) tone(midi(ch[0] - 24) * 1.0, t, 0.25, 0.05, 'triangle', this.gain);
  },
};
const musicFile = CFG.music ? new Audio(CFG.music) : null;
let musicFileOK = !!musicFile, musicOn = !save.musicOff;
if (musicFile) {
  musicFile.loop = true; musicFile.volume = 0.45; musicFile.preload = 'auto';
  musicFile.addEventListener('error', () => { musicFileOK = false; if (musicOn && started) MusicBox.start(); });
}
function musicPlay() {
  if (!musicOn) return;
  if (musicFileOK) musicFile.play().catch(() => { musicFileOK = false; MusicBox.start(); });
  else MusicBox.start();
}
function musicStop() { if (musicFile) musicFile.pause(); MusicBox.stop(); }

// ---------------------------------------------------------------- UI basics
let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function hearts(n = 18, spread = 1) {
  const layer = $('hearts-layer');
  const chars = ['❤', '♥', '💖', '💕', '❣'];
  for (let i = 0; i < n; i++) {
    const h = document.createElement('div');
    h.className = 'fheart';
    h.textContent = pick(chars);
    h.style.left = (50 + (Math.random() - 0.5) * 100 * spread) + '%';
    h.style.fontSize = (16 + Math.random() * 30) + 'px';
    h.style.setProperty('--r', ((Math.random() - 0.5) * 120) + 'deg');
    h.style.animationDuration = (2.6 + Math.random() * 2.4) + 's';
    h.style.animationDelay = (Math.random() * 0.8) + 's';
    layer.appendChild(h);
    setTimeout(() => h.remove(), 6000);
  }
}
function fullscreen() {
  const d = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d);
}

// =====================================================================
//  PHOTOS
// =====================================================================
const IMG_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
async function getPhotoFiles() {
  let files = [];
  try {
    const r = await fetch('photos/manifest.json', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); if (Array.isArray(j)) files = j; }
  } catch (e) {}
  if (!files.length) files = [...Object.keys(CFG.photos), ...(CFG.puzzles || []).map((p) => p && p.photo)];
  files = [...new Set(files.filter((f) => typeof f === 'string' && IMG_RE.test(f)))];
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return files;
}
const AR_MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
function autoDate(file) {
  const m = file.match(/(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])/);
  return m ? `${+m[3]} ${AR_MONTHS[+m[2] - 1]} ${m[1]}` : '';
}
function loadImage(src) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}
function downscale(img, max = 1400) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const s = Math.min(1, max / Math.max(w, h));
  return makeCanvas(Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)), (x, cw, ch) => x.drawImage(img, 0, 0, cw, ch));
}
function makePlaceholder(i) {
  const portrait = i % 3 === 1;
  const w = portrait ? 768 : 1024, h = portrait ? 1024 : 768;
  const hues = [345, 20, 300, 200, 160, 35, 270, 0];
  const hue = hues[i % hues.length];
  return makeCanvas(w, h, (x) => {
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, `hsl(${hue},55%,66%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360},45%,36%)`);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) {
      x.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
      x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 90, 0, 7); x.fill();
    }
    x.fillStyle = 'rgba(255,255,255,.92)'; x.textAlign = 'center'; x.direction = 'rtl';
    x.font = `${Math.round(h * 0.28)}px "Segoe UI Emoji", sans-serif`;
    x.fillText('❤', w / 2, h * 0.5);
    x.font = `bold ${Math.round(h * 0.075)}px ${FONT_SANS}`;
    x.fillText('صورة رقم ' + (i + 1), w / 2, h * 0.68);
    x.font = `${Math.round(h * 0.045)}px ${FONT_SANS}`;
    x.fillStyle = 'rgba(255,255,255,.75)';
    x.fillText('حط صورك بمجلد photos', w / 2, h * 0.78);
  });
}
async function loadPhotos(onProgress) {
  const files = await getPhotoFiles();
  const photos = [];
  let done = 0;
  const results = await Promise.all(files.map(async (f) => {
    const src = 'photos/' + encodeURIComponent(f);
    const img = await loadImage(src);
    onProgress(++done / Math.max(1, files.length));
    return img ? { f, src, img } : null;
  }));
  results.filter(Boolean).forEach(({ f, src, img }) => {
    const meta = CFG.photos[f] || {};
    const canvas = downscale(img);
    photos.push({ id: f, src, canvas, aspect: canvas.width / canvas.height,
      title: meta.title || prettyName(f), date: meta.date || autoDate(f), caption: meta.caption || '' });
  });
  if (!photos.length) {
    for (let i = 0; i < 12; i++) {
      const canvas = makePlaceholder(i);
      photos.push({ id: 'placeholder-' + i, src: canvas.toDataURL('image/jpeg', 0.9), canvas, aspect: canvas.width / canvas.height,
        title: 'ذكرى رقم ' + (i + 1), date: '', caption: 'هون رح تطلع صورتكن — حطوا الصور بمجلد photos', placeholder: true });
    }
  }
  photos.forEach((p, i) => { if (!p.title) p.title = 'ذكرى رقم ' + (i + 1); });
  onProgress(1);
  return photos;
}
const sqCache = new Map();
function squareURL(photo, size = 600) {
  const k = photo.id + '|' + size;
  if (sqCache.has(k)) return sqCache.get(k);
  const s = photo.canvas, m = Math.min(s.width, s.height);
  const u = makeCanvas(size, size, (x) => x.drawImage(s, (s.width - m) / 2, (s.height - m) / 2, m, m, 0, 0, size, size)).toDataURL('image/jpeg', 0.88);
  sqCache.set(k, u);
  return u;
}
function photoTex(p) { if (!p.tex) p.tex = canvasTex(p.canvas); return p.tex; }

// =====================================================================
//  THREE SETUP
// =====================================================================
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.6 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf3dcd6, 30, 80);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 160);
const hemi = new THREE.HemisphereLight(0xfff4ea, 0x5a4048, 1.2);
scene.add(hemi);
scene.add(new THREE.AmbientLight(0xffffff, 0.22));
const sun = new THREE.DirectionalLight(0xffeedd, 1.25);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// =====================================================================
//  TEXTURES
// =====================================================================
function noiseFill(x, w, h, n, a, base) {
  for (let i = 0; i < n; i++) {
    const v = base + (Math.random() - 0.5) * 60;
    x.fillStyle = `rgba(${v},${v},${v},${a})`;
    x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
}
function repeatTex(c, srgb = true) { const t = canvasTex(c, srgb); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function woodTexture() {
  return repeatTex(makeCanvas(1024, 1024, (x, w, h) => {
    const pw = 128, pl = 512;
    for (let col = 0; col < w / pw; col++) {
      const off = (col % 2) * pl / 2;
      for (let r = -1; r < h / pl + 1; r++) {
        const y = r * pl + off;
        x.fillStyle = `hsl(${24 + Math.random() * 6},${42 + Math.random() * 10}%,${28 + Math.random() * 10}%)`;
        x.fillRect(col * pw, y, pw, pl);
        for (let g = 0; g < 18; g++) {
          x.strokeStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,220,180'},${0.04 + Math.random() * 0.06})`;
          x.lineWidth = 1 + Math.random() * 2; x.beginPath();
          const gx = col * pw + Math.random() * pw;
          x.moveTo(gx, y); x.bezierCurveTo(gx + (Math.random() - 0.5) * 20, y + pl / 3, gx + (Math.random() - 0.5) * 20, y + pl * 2 / 3, gx, y + pl); x.stroke();
        }
        x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(col * pw, y, pw, 3);
      }
      x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(col * pw, 0, 3, h);
    }
  }));
}
function concreteTexture() {
  return repeatTex(makeCanvas(1024, 1024, (x, w, h) => {
    x.fillStyle = '#d9d5cf'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      const g = x.createRadialGradient(Math.random() * w, Math.random() * h, 0, Math.random() * w, Math.random() * h, 80 + Math.random() * 200);
      g.addColorStop(0, `rgba(${Math.random() < 0.5 ? '255,255,255' : '160,150,140'},.08)`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }
    noiseFill(x, w, h, 12000, 0.08, 200);
    x.fillStyle = 'rgba(90,80,70,.35)';
    x.fillRect(0, 0, w, 2); x.fillRect(0, 0, 2, h); x.fillRect(0, h / 2, w, 2); x.fillRect(w / 2, 0, 2, h);
  }));
}
function stoneTexture() {
  return repeatTex(makeCanvas(1024, 1024, (x, w, h) => {
    const s = 128;
    for (let r = 0; r < h / s; r++) for (let c = 0; c < w / s; c++) {
      const l = 82 + Math.random() * 8;
      x.fillStyle = `hsl(32,${14 + Math.random() * 8}%,${l}%)`;
      x.fillRect(c * s + (r % 2) * s / 2, r * s, s, s);
      x.fillRect(c * s + (r % 2) * s / 2 - w, r * s, s, s);
    }
    noiseFill(x, w, h, 14000, 0.07, 190);
    x.strokeStyle = 'rgba(120,100,85,.45)'; x.lineWidth = 3;
    for (let r = 0; r < h / s; r++) {
      x.beginPath(); x.moveTo(0, r * s); x.lineTo(w, r * s); x.stroke();
      for (let c = 0; c <= w / s; c++) { const xx = c * s + (r % 2) * s / 2; x.beginPath(); x.moveTo(xx, r * s); x.lineTo(xx, r * s + s); x.stroke(); }
    }
  }));
}
function grassTexture() {
  return repeatTex(makeCanvas(512, 512, (x, w, h) => {
    x.fillStyle = '#6f9a5a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 16000; i++) {
      x.fillStyle = `hsla(${90 + Math.random() * 30},${35 + Math.random() * 20}%,${30 + Math.random() * 25}%,.5)`;
      x.fillRect(Math.random() * w, Math.random() * h, 1.5, 3 + Math.random() * 3);
    }
  }));
}
function plasterTexture(base) {
  const t = repeatTex(makeCanvas(512, 512, (x, w, h) => {
    x.fillStyle = `rgb(${base},${base},${base})`; x.fillRect(0, 0, w, h);
    noiseFill(x, w, h, 9000, 0.16, base);
    if (base < 200) {
      x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 2;
      for (let yy = 0; yy < h; yy += 64) for (let xx = 0; xx < w; xx += 64) {
        const ox = (yy / 64) % 2 ? 32 : 0;
        x.beginPath(); x.moveTo(xx + ox, yy - 22); x.lineTo(xx + ox + 14, yy); x.lineTo(xx + ox, yy + 22); x.lineTo(xx + ox - 14, yy); x.closePath(); x.stroke();
      }
    }
  }), false);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
function ceilingGridTexture() {
  return repeatTex(makeCanvas(256, 256, (x, w, h) => {
    x.fillStyle = '#1b1b1e'; x.fillRect(0, 0, w, h);
    noiseFill(x, w, h, 1500, 0.15, 40);
    x.fillStyle = '#2e2e33'; x.fillRect(0, 0, w, 4); x.fillRect(0, 0, 4, h);
  }));
}
function curtainTexture(kind) {
  return canvasTex(makeCanvas(256, 512, (x, w, h) => {
    const lin = kind === 'linen';
    for (let i = 0; i < w; i++) {
      const s = (lin ? 0.82 : 0.55) + (lin ? 0.18 : 0.45) * Math.pow(Math.sin(i / w * Math.PI * 7), 2);
      const c = lin ? [240, 232, 220] : [150, 18, 42];
      x.fillStyle = `rgb(${Math.round(c[0] * s)},${Math.round(c[1] * s)},${Math.round(c[2] * s)})`;
      x.fillRect(i, 0, 1, h);
    }
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,.25)'); g.addColorStop(0.15, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.18)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    if (lin) { x.fillStyle = '#b8a890'; x.fillRect(0, h - 10, w, 4); }
    else { x.fillStyle = '#d8b46a'; x.fillRect(0, h - 14, w, 6); for (let i = 6; i < w; i += 14) { x.beginPath(); x.arc(i, h - 4, 4, 0, 7); x.fill(); } }
  }));
}
function carpetTexture() {
  const t = canvasTex(makeCanvas(256, 1024, (x, w, h) => {
    x.fillStyle = '#7d1328'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#d8b46a'; x.fillRect(10, 0, 8, h); x.fillRect(w - 18, 0, 8, h);
    x.fillStyle = '#5c0c1d'; x.fillRect(24, 0, 4, h); x.fillRect(w - 28, 0, 4, h);
    x.fillStyle = 'rgba(216,180,106,.35)';
    for (let y = 32; y < h; y += 64) { x.save(); x.translate(w / 2, y); x.rotate(Math.PI / 4); x.fillRect(-10, -10, 20, 20); x.restore(); }
  }));
  t.wrapT = THREE.RepeatWrapping;
  return t;
}
function glowTexture(r = 255, g = 236, b = 200, a0 = 0.9) {
  return canvasTex(makeCanvas(256, 256, (x, w, h) => {
    const gr = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, `rgba(${r},${g},${b},${a0})`); gr.addColorStop(0.4, `rgba(${r},${g},${b},${a0 * 0.38})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
  }));
}
function wallWashTexture() {
  return canvasTex(makeCanvas(256, 256, (x, w, h) => {
    const gr = x.createRadialGradient(w / 2, h * 0.18, 4, w / 2, h * 0.45, w * 0.55);
    gr.addColorStop(0, 'rgba(255,240,215,.95)'); gr.addColorStop(0.5, 'rgba(255,235,205,.35)'); gr.addColorStop(1, 'rgba(255,235,205,0)');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
  }));
}
function skyTexture() {
  return canvasTex(makeCanvas(16, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#9fb6dc'); g.addColorStop(0.45, '#f1c9cf'); g.addColorStop(0.7, '#fde2cf'); g.addColorStop(1, '#fff1e2');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }));
}
function skylightTexture() {
  return canvasTex(makeCanvas(256, 256, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    const g = x.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6);
    g.addColorStop(0, '#fff3dc'); g.addColorStop(0.7, '#e8c79a'); g.addColorStop(1, '#3a2418');
    x.fillStyle = g; x.fillRect(12, 12, w - 24, h - 24);
    x.strokeStyle = '#2a1a14'; x.lineWidth = 6;
    for (let i = 1; i < 4; i++) {
      x.beginPath(); x.moveTo(i * w / 4, 12); x.lineTo(i * w / 4, h - 12); x.stroke();
      x.beginPath(); x.moveTo(12, i * h / 4); x.lineTo(w - 12, i * h / 4); x.stroke();
    }
  }));
}
// text sign — style: 'gold' | 'plain' (transparent bg) | 'engraved'
function signTexture(lines, w, h, style = 'gold', color) {
  return canvasTex(makeCanvas(w, h, (x) => {
    if (style === 'gold') {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2b1416'); g.addColorStop(1, '#160a0c');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#d8b46a'; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20);
      x.lineWidth = 2; x.strokeRect(24, 24, w - 48, h - 48);
    }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    const n = lines.length;
    let y = 0;
    const sizes = lines.map((ln, i) => ln.size || (n === 1 ? h * 0.46 : h * (i === 0 ? 0.36 : 0.2)));
    const total = sizes.reduce((a, b) => a + b * 1.25, 0);
    y = h / 2 - total / 2;
    lines.forEach((ln, i) => {
      const s = sizes[i];
      x.font = `${ln.weight || 700} ${Math.round(s)}px ${ln.font || FONT_SERIF}`;
      if (style === 'gold') {
        const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff2d6'); gr.addColorStop(1, '#d8b46a');
        x.fillStyle = ln.color || gr;
      } else if (style === 'engraved') {
        x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText(ln.text, w / 2 + 2, y + s * 0.625 + 2, w - 60);
        x.fillStyle = ln.color || color || '#7a6a58';
      } else x.fillStyle = ln.color || color || '#fff';
      x.fillText(ln.text, w / 2, y + s * 0.625, w - 60);
      y += s * 1.25;
    });
  }));
}
function plaqueTexture(title, date, dark) {
  return canvasTex(makeCanvas(512, 170, (x, w, h) => {
    x.fillStyle = dark ? '#141214' : '#f3e7d3'; x.fillRect(0, 0, w, h);
    if (!dark) { x.strokeStyle = '#a8843e'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6); }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    x.fillStyle = dark ? '#ffffff' : '#3a1a20';
    x.font = `700 ${date ? 52 : 58}px ${FONT_SERIF}`;
    x.fillText(title, w / 2, date ? h * 0.38 : h / 2, w - 40);
    if (date) {
      x.fillStyle = dark ? '#bfb5aa' : '#8a6528';
      x.font = `500 32px ${FONT_SANS}`;
      x.fillText(date, w / 2, h * 0.76, w - 40);
    }
  }));
}
function lockedTexture(photo) {
  const src = photo.canvas, w = 512, h = Math.round(512 / photo.aspect);
  return canvasTex(makeCanvas(w, h, (x) => {
    const tiny = makeCanvas(12, Math.max(2, Math.round(12 / photo.aspect)), (t, tw, th) => t.drawImage(src, 0, 0, tw, th));
    x.imageSmoothingEnabled = false; x.drawImage(tiny, 0, 0, w, h);
    x.fillStyle = 'rgba(25,8,14,.62)'; x.fillRect(0, 0, w, h);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    const s = Math.min(w, h);
    x.font = `${Math.round(s * 0.3)}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
    x.fillStyle = '#fff'; x.fillText('🔒', w / 2, h * 0.42);
    x.font = `800 ${Math.round(s * 0.1)}px ${FONT_SANS}`;
    x.fillStyle = '#ffd9e2'; x.fillText('حِلّ الأحجية 🧩', w / 2, h * 0.7);
  }));
}
function bannerTexture(name) {
  return canvasTex(makeCanvas(256, 768, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#a32a4a'); g.addColorStop(0.5, '#d2496c'); g.addColorStop(1, '#a32a4a');
    x.fillStyle = g; x.fillRect(0, 0, w, h - 60);
    x.beginPath(); x.moveTo(0, h - 60); x.lineTo(w / 2, h); x.lineTo(w, h - 60); x.fill();
    x.strokeStyle = '#f3d79a'; x.lineWidth = 6; x.strokeRect(16, 16, w - 32, h - 110);
    x.fillStyle = '#fff4dc'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    x.font = `${150}px "Segoe UI Emoji",sans-serif`; x.fillText('❤', w / 2, h * 0.3);
    x.font = `700 ${name.length > 6 ? 54 : 78}px ${FONT_SERIF}`; x.fillText(name, w / 2, h * 0.58, w - 40);
  }));
}

const TEX = {};
function initTextures() {
  TEX.wood = woodTexture(); TEX.concrete = concreteTexture(); TEX.stone = stoneTexture(); TEX.grass = grassTexture();
  TEX.plasterDark = plasterTexture(128); TEX.plasterLight = plasterTexture(238);
  TEX.ceilGrid = ceilingGridTexture(); TEX.velvet = curtainTexture('velvet'); TEX.linen = curtainTexture('linen');
  TEX.carpet = carpetTexture(); TEX.glow = glowTexture(); TEX.pinkGlow = glowTexture(255, 120, 160); TEX.wash = wallWashTexture();
  TEX.sky = skyTexture(); TEX.skylight = skylightTexture();
  TEX.petal = canvasTex(makeCanvas(64, 64, (x) => {
    x.fillStyle = '#ff7a9a'; x.beginPath(); x.ellipse(32, 32, 14, 24, 0.6, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(28, 26, 4, 10, 0.6, 0, 7); x.fill();
  }));
  TEX.ring = canvasTex(makeCanvas(256, 256, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, w * 0.25, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,90,140,0)'); g.addColorStop(0.55, 'rgba(255,90,140,.9)'); g.addColorStop(0.7, 'rgba(255,170,200,.6)'); g.addColorStop(1, 'rgba(255,90,140,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
    x.font = '90px "Segoe UI Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,120,160,.9)';
    x.fillText('❤', w / 2, w / 2 + 6);
  }));
  scene.background = TEX.sky;
}

// =====================================================================
//  THEMES & MATERIALS
// =====================================================================
const ROOM_COLORS = [0x7a2a38, 0x2c4a5c, 0x3c5a3e, 0x6e4a2c, 0x4a2f5e, 0x2f5552, 0x7a3a2a, 0x3e3e6a];
const THEMES = {
  modern: {
    roomWall: () => 0xdfdad3, divider: () => 0x1f1e22, finalWall: 0xf0d9da, farWall: 0x9c2f4f,
    floor: 'concrete', floorRough: 0.3, carpet: false, wainscot: false, ceiling: 'grid', track: true,
    frame: 'black', plaqueDark: true, curtain: 'linen', bench: 'oak', pedestal: 'plinth', plant: 'white', platforms: true,
    signStyle: 'plain', fog: 0xe6e0da, fogNear: 22, fogFar: 60, hemi: 1.05, exposure: 1.0, wash: 0.55,
  },
  classic: {
    roomWall: (i) => ROOM_COLORS[i % ROOM_COLORS.length], divider: (i) => ROOM_COLORS[i % ROOM_COLORS.length], finalWall: 0x8a2d4a, farWall: 0x8a2d4a,
    floor: 'wood', floorRough: 0.55, carpet: true, wainscot: true, ceiling: 'skylight', track: false,
    frame: 'gold', plaqueDark: false, curtain: 'velvet', bench: 'velvet', pedestal: 'column', plant: 'terracotta', platforms: false,
    signStyle: 'gold', fog: 0x2a1418, fogNear: 18, fogFar: 46, hemi: 1.45, exposure: 1.15, wash: 0.55,
  },
};
let themeName = save.theme || (THEMES[CFG.theme] ? CFG.theme : 'modern');
let TH = THEMES[themeName];

const MAT = {};
const std = (c, r = 0.8, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r }, extra));
function initMaterials() {
  MAT.gold = new THREE.MeshPhongMaterial({ color: 0xc99a3e, specular: 0xfff0c0, shininess: 70, emissive: 0x2a1a05 });
  MAT.black = std(0x131315, 0.45);
  MAT.white = std(0xf6f3ee, 0.6);
  MAT.marble = std(0xf1ece4, 0.5, { map: TEX.plasterLight });
  MAT.darkWood = std(0x3a2116, 0.6);
  MAT.oak = std(0xc8a27a, 0.55);
  MAT.backing = std(0x140a0c, 1);
  MAT.leaf = std(0x3f7a3a, 0.8, { flatShading: true });
  MAT.leafDark = std(0x2c5a2c, 0.75, { flatShading: true });
  MAT.pot = std(0xb8643c, 0.7);
  MAT.velvetBench = std(0x7d1328, 0.9);
  MAT.door = std(0x6e1f1a, 0.5);
  MAT.hedge = std(0x4c7a3e, 0.9, { flatShading: true });
  MAT.flower = std(0xf07aa0, 0.6);
  MAT.lampGlow = new THREE.MeshBasicMaterial({ color: 0xfff1d0, toneMapped: false });
  MAT.wash = new THREE.MeshBasicMaterial({ map: TEX.wash, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5, toneMapped: false });
  MAT.glow = new THREE.MeshBasicMaterial({ map: TEX.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55, toneMapped: false });
  MAT.skylight = new THREE.MeshBasicMaterial({ map: TEX.skylight, toneMapped: false });
}
const wallMatCache = new Map();
function wallMat(color, rx = 4, ry = 2) {
  const k = themeName + color + '|' + rx.toFixed(1) + '|' + ry.toFixed(1);
  if (wallMatCache.has(k)) return wallMatCache.get(k);
  const light = new THREE.Color(color).getHSL({}).l > 0.5;
  const t = (light ? TEX.plasterLight : TEX.plasterDark).clone();
  t.repeat.set(rx, ry); t.needsUpdate = true;
  const m = std(color, 0.92, { map: t });
  wallMatCache.set(k, m);
  return m;
}

// =====================================================================
//  WORLD CONTEXT  (ext = outside, int = museum interior; rebuilt on theme change)
// =====================================================================
const W = 16, D = 14, H = 5.2, DOOR = 3.2, DOOR_H = 3.4, TK = 0.4;
const EDW = 2.6, EDH = 3.6;   // entrance door
function ctxNew() { return { group: new THREE.Group(), boxes: [], walls: [], clickables: [], targets: [], frames: [], updaters: [], benches: [] }; }
const EXT = ctxNew(), INT = ctxNew();
scene.add(EXT.group, INT.group);
let C = EXT; // current build context
const allBoxes = () => EXT.boxes.concat(INT.boxes);
const allWalls = () => EXT.walls.concat(INT.walls);

function addMesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  (parent || C.group).add(m);
  return m;
}
function addBox(cx, cy, cz, sx, sy, sz, mat, { collide = true, camBlock = true, shadow = 'r' } = {}) {
  const m = addMesh(new THREE.BoxGeometry(sx, sy, sz), mat, cx, cy, cz);
  if (shadow.includes('r')) m.receiveShadow = true;
  if (shadow.includes('c')) m.castShadow = true;
  if (collide) C.boxes.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 });
  if (camBlock) C.walls.push(m);
  return m;
}
function addCollider(x, z, hx, hz) { C.boxes.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz }); }
function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return c.getHex(); }
function clearCtx(ctx) {
  ctx.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  ctx.group.clear();
  ['boxes', 'walls', 'clickables', 'targets', 'frames', 'updaters', 'benches'].forEach((k) => { ctx[k].length = 0; });
}

let _heartShape = null;
function heartGeometry(size = 1, depth = 0.35) {
  if (!_heartShape) {
    const s = new THREE.Shape();
    s.moveTo(0.5, 0.5); s.bezierCurveTo(0.5, 0.5, 0.4, 0, 0, 0); s.bezierCurveTo(-0.6, 0, -0.6, 0.7, -0.6, 0.7);
    s.bezierCurveTo(-0.6, 1.1, -0.3, 1.54, 0.5, 1.9); s.bezierCurveTo(1.2, 1.54, 1.6, 1.1, 1.6, 0.7);
    s.bezierCurveTo(1.6, 0.7, 1.6, 0, 1.0, 0); s.bezierCurveTo(0.7, 0, 0.5, 0.5, 0.5, 0.5);
    _heartShape = s;
  }
  const geo = new THREE.ExtrudeGeometry(_heartShape, { depth, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 4, curveSegments: 24 });
  geo.center(); geo.rotateZ(Math.PI); geo.scale(size, size, size);
  return geo;
}

// =====================================================================
//  EXTERIOR — plaza + classical facade + doors
// =====================================================================
const doors = { L: null, R: null, open: 0, target: 0 };
function buildExterior() {
  C = EXT;
  const grass = addMesh(new THREE.PlaneGeometry(140, 140), std(0xffffff, 1, { map: TEX.grass }), 0, -0.02, 20);
  grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true;
  TEX.grass.repeat.set(40, 40);
  TEX.stone.repeat.set(6, 4);
  const plaza = addMesh(new THREE.PlaneGeometry(24, 15), std(0xffffff, 0.75, { map: TEX.stone }), 0, 0.004, 8.3);
  plaza.rotation.x = -Math.PI / 2; plaza.receiveShadow = true;
  const path = addMesh(new THREE.PlaneGeometry(4, 30), std(0xffffff, 0.75, { map: TEX.stone }), 0, 0.003, 30);
  path.rotation.x = -Math.PI / 2;

  // facade wall (z 0.4 .. 1.0) with door hole
  const fw = 22, fh = 8, fz = 0.7, fd = 0.6;
  const segW = (fw - EDW) / 2;
  addBox(-(EDW / 2 + segW / 2), fh / 2, fz, segW, fh, fd, MAT.marble);
  addBox(EDW / 2 + segW / 2, fh / 2, fz, segW, fh, fd, MAT.marble);
  addBox(0, (fh + EDH) / 2, fz, EDW, fh - EDH, fd, MAT.marble, { collide: false });
  addBox(0, 0.25, fz + 0.35, fw, 0.5, 0.15, std(0xd8d0c4, 0.7), { collide: false, camBlock: false });
  addBox(0, 4.0, fz + 0.33, fw, 0.18, 0.12, MAT.marble, { collide: false, camBlock: false });
  // door frame
  for (const s of [-1, 1]) addBox(s * (EDW / 2 + 0.17), EDH / 2 + 0.1, fz + 0.36, 0.34, EDH + 0.2, 0.14, MAT.white, { collide: false, camBlock: false });
  addBox(0, EDH + 0.3, fz + 0.36, EDW + 0.8, 0.4, 0.16, MAT.white, { collide: false, camBlock: false });
  const arch = addMesh(new THREE.RingGeometry(0.75, 1.0, 32, 1, 0, Math.PI), MAT.white, 0, EDH + 0.55, fz + 0.45);
  arch.material = std(0xf6f3ee, 0.6, { side: THREE.DoubleSide });
  // door leaves
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * EDW / 2, 0, fz); C.group.add(pivot);
    const leaf = addMesh(new THREE.BoxGeometry(EDW / 2 - 0.02, EDH - 0.05, 0.09), MAT.door, -s * (EDW / 4), (EDH - 0.05) / 2, 0, pivot);
    leaf.castShadow = true;
    for (const py of [0.95, 2.45]) addMesh(new THREE.BoxGeometry(EDW / 2 - 0.36, 1.0, 0.04), std(0x5a1814, 0.5), -s * (EDW / 4), py, 0.06, pivot);
    const knob = addMesh(new THREE.TorusGeometry(0.08, 0.018, 8, 18), MAT.gold, -s * (EDW / 2 - 0.22), 1.6, 0.08, pivot);
    knob.rotation.x = 0;
    if (s < 0) doors.L = pivot; else doors.R = pivot;
  }
  // columns + portico
  const colZ = 2.1;
  for (const cx of [-9, -6, -3, 3, 6, 9]) {
    addBox(cx, 0.15, colZ, 0.95, 0.3, 0.95, MAT.white, { camBlock: false, shadow: 'rc' });
    const col = addMesh(new THREE.CylinderGeometry(0.34, 0.38, 6.2, 22), MAT.marble, cx, 3.4, colZ);
    col.castShadow = true; col.receiveShadow = true;
    addBox(cx, 6.62, colZ, 1.0, 0.25, 1.0, MAT.white, { collide: false, camBlock: false });
    C.walls.push(col);
  }
  addBox(0, 7.15, 1.6, 20.6, 0.8, 2.4, MAT.marble, { collide: false });
  addBox(0, 7.64, 1.65, 21.2, 0.2, 2.6, MAT.white, { collide: false, camBlock: false });
  const tri = new THREE.Shape(); tri.moveTo(-10.6, 0); tri.lineTo(10.6, 0); tri.lineTo(0, 2.1); tri.closePath();
  const ped = addMesh(new THREE.ExtrudeGeometry(tri, { depth: 0.6, bevelEnabled: false }), MAT.marble, 0, 7.74, 2.2);
  ped.castShadow = true;
  const innerTri = new THREE.Shape(); innerTri.moveTo(-9.2, 0); innerTri.lineTo(9.2, 0); innerTri.lineTo(0, 1.55); innerTri.closePath();
  addMesh(new THREE.ShapeGeometry(innerTri), std(0xe7e0d6, 0.7), 0, 7.95, 2.81);
  addMesh(heartGeometry(0.28, 0.12), std(0xe85a7a, 0.4, { emissive: 0x5a0a1e }), 0, 8.55, 2.85);
  addBox(0, 0.06, 1.85, 21, 0.12, 2.1, std(0xe9e3da, 0.7), { collide: false, camBlock: false });
  // frieze title
  const frieze = addMesh(new THREE.PlaneGeometry(8, 0.66),
    new THREE.MeshBasicMaterial({ map: signTexture([{ text: CFG.title }], 1024, 84, 'engraved', '#6d5a44'), transparent: true }), 0, 7.15, 2.815);
  frieze.renderOrder = 2;
  // banners
  for (const [bx, name] of [[4.5, CFG.him], [-4.5, CFG.her]]) {
    const b = addMesh(new THREE.PlaneGeometry(1.25, 3.75), new THREE.MeshStandardMaterial({ map: bannerTexture(name), roughness: 0.8, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }), bx, 4.7, 2.0);
    b.castShadow = true;
    addBox(bx, 6.58, 2.0, 1.5, 0.05, 0.05, MAT.gold, { collide: false, camBlock: false });
  }
  // planters with flowers next to the door
  for (const s of [-1, 1]) {
    const px = s * 2.1, pz = 1.55;
    addBox(px, 0.35, pz, 0.8, 0.7, 0.8, MAT.white, { camBlock: false, shadow: 'rc' });
    for (let k = 0; k < 9; k++) {
      const f = addMesh(new THREE.IcosahedronGeometry(0.12 + Math.random() * 0.06, 0), k % 3 ? MAT.flower : MAT.leaf, px + (Math.random() - 0.5) * 0.55, 0.82 + Math.random() * 0.25, pz + (Math.random() - 0.5) * 0.55);
      f.castShadow = true;
    }
  }
  // hedges + lamp posts + trees
  for (const s of [-1, 1]) {
    addBox(s * 11.6, 0.5, 8.3, 0.9, 1.0, 14.6, MAT.hedge, { camBlock: false, shadow: 'rc' });
    for (const lz of [5.5, 11]) {
      const lx = s * 4.4;
      addMesh(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 10), MAT.black, lx, 1.6, lz).castShadow = true;
      addMesh(new THREE.SphereGeometry(0.24, 16, 12), MAT.lampGlow, lx, 3.35, lz);
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
      g.scale.set(1.6, 1.6, 1); g.position.set(lx, 3.35, lz); C.group.add(g);
      addCollider(lx, lz, 0.15, 0.15);
    }
    for (let k = 0; k < 6; k++) {
      const tx = s * (14 + Math.random() * 10), tz = -4 + k * 5 + Math.random() * 2;
      addMesh(new THREE.CylinderGeometry(0.15, 0.22, 1.6, 8), MAT.darkWood, tx, 0.8, tz).castShadow = true;
      const crown = addMesh(new THREE.IcosahedronGeometry(1.3 + Math.random() * 0.6, 1), MAT.leafDark, tx, 2.6 + Math.random() * 0.5, tz);
      crown.castShadow = true;
    }
  }
  // boundaries
  addCollider(-12.2, 8, 0.6, 9); addCollider(12.2, 8, 0.6, 9); addCollider(0, 16.2, 13, 0.6);
}
function updateDoors(dt) {
  if (!doors.L) return;
  const d = Math.hypot(P.x, P.z - 0.7);
  if (started && d < 7) doors.target = 1;
  doors.open += (doors.target - doors.open) * (1 - Math.exp(-2.2 * dt));
  const a = ease(doors.open) * 1.75;
  doors.L.rotation.y = a; doors.R.rotation.y = -a;
}

// =====================================================================
//  INTERIOR
// =====================================================================
let ROOMS = 1, FINAL = 1;
function wallBlock(cx, cz, sx, sz, color, color2) {
  const len = Math.max(sx, sz);
  const m1 = wallMat(color, len / 3, H / 3);
  let mat = m1;
  if (color2 !== undefined && color2 !== color) { const m2 = wallMat(color2, len / 3, H / 3); mat = [m1, m1, m1, m1, m1, m2]; }
  addBox(cx, H / 2, cz, sx, H, sz, mat);
  const thin = sx < sz ? 'x' : 'z';
  const grow = (g) => (thin === 'x' ? [sx + g, sz] : [sx, sz + g]);
  if (TH.wainscot) {
    let [a, b] = grow(0.07);
    const w1 = std(shade(color, 0.5), 0.7);
    const wm = color2 !== undefined ? [w1, w1, w1, w1, w1, std(shade(color2, 0.5), 0.7)] : w1;
    addBox(cx, 0.5, cz, a, 1.0, b, wm, { collide: false, camBlock: false });
    [a, b] = grow(0.12); addBox(cx, 1.03, cz, a, 0.06, b, MAT.gold, { collide: false, camBlock: false });
    [a, b] = grow(0.2); addBox(cx, H - 0.09, cz, a, 0.18, b, MAT.darkWood, { collide: false, camBlock: false });
  } else {
    const [a, b] = grow(0.03);
    addBox(cx, 0.04, cz, a, 0.08, b, MAT.black, { collide: false, camBlock: false });
  }
}
function buildInterior() {
  C = INT;
  const total = (ROOMS + 1) * D;
  const floorTex = TH.floor === 'wood' ? TEX.wood : TEX.concrete;
  floorTex.repeat.set(W / 4, total / 4);
  const floor = addMesh(new THREE.PlaneGeometry(W + 1, total + 0.5), std(0xffffff, TH.floorRough, { map: floorTex }), 0, 0.001, -total / 2 + 0.2);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  if (TH.carpet) {
    TEX.carpet.repeat.set(1, total / 6);
    const carpet = addMesh(new THREE.PlaneGeometry(2.6, total - 0.6), std(0xffffff, 1, { map: TEX.carpet }), 0, 0.012, -total / 2);
    carpet.rotation.x = -Math.PI / 2; carpet.receiveShadow = true;
  }
  let ceilMat;
  if (TH.ceiling === 'grid') { TEX.ceilGrid.repeat.set(W / 1.2, total / 1.2); ceilMat = std(0xffffff, 1, { map: TEX.ceilGrid }); }
  else ceilMat = std(0x2a1a1c, 1);
  const ceil = addMesh(new THREE.PlaneGeometry(W + 1, total + 1), ceilMat, 0, H, -total / 2);
  ceil.rotation.x = Math.PI / 2;

  const allRooms = ROOMS + 1;
  const colOf = (i) => (i === FINAL ? TH.finalWall : TH.roomWall(i));
  for (let i = 0; i < allRooms; i++) {
    const z0 = -i * D, z1 = -(i + 1) * D, cz = (z0 + z1) / 2;
    const isFinal = i === FINAL;
    const col = colOf(i);
    wallBlock(-(W / 2 + TK / 2), cz, TK, D + TK, col);
    wallBlock(W / 2 + TK / 2, cz, TK, D + TK, col);
    if (TH.ceiling === 'skylight') {
      const sky = addMesh(new THREE.PlaneGeometry(6, 8), MAT.skylight, 0, H - 0.01, cz);
      sky.rotation.x = Math.PI / 2;
    }
    if (TH.track) {
      for (const s of [-1, 1]) {
        addBox(s * 4.8, H - 0.04, cz, 0.06, 0.05, D - 2, MAT.black, { collide: false, camBlock: false, shadow: '' });
        for (const zz of [z0 - 3.4, z0 - 7, z0 - 10.6]) {
          const head = addMesh(new THREE.CylinderGeometry(0.06, 0.08, 0.24, 12), MAT.black, s * 4.8, H - 0.2, zz);
          head.rotation.z = s * 0.9;
          addMesh(new THREE.CircleGeometry(0.055, 12), MAT.lampGlow, s * 4.89, H - 0.25, zz).rotation.y = s * Math.PI / 2;
        }
      }
    }
    if (i < allRooms - 1) {
      const dc = i + 1 === FINAL ? TH.divider(i) : TH.divider(i);
      const nextC = TH.wainscot ? colOf(i + 1) : dc;
      const segW = (W - DOOR) / 2;
      wallBlock(-(DOOR / 2 + segW / 2), z1, segW, TK, dc, nextC);
      wallBlock(DOOR / 2 + segW / 2, z1, segW, TK, dc, nextC);
      addBox(0, (H + DOOR_H) / 2, z1, DOOR, H - DOOR_H, TK, wallMat(dc, 1, 0.6), { collide: false });
      if (TH.frame === 'gold') {
        for (const s of [-1, 1]) addBox(s * (DOOR / 2 + 0.1), DOOR_H / 2, z1, 0.22, DOOR_H, TK + 0.16, MAT.gold, { collide: false, camBlock: false });
        addBox(0, DOOR_H + 0.1, z1, DOOR + 0.42, 0.22, TK + 0.16, MAT.gold, { collide: false, camBlock: false });
      }
      if (TH.platforms && !isFinal) {
        for (const s of [-1, 1]) addBox(s * (DOOR / 2 + segW / 2 + 0.05), 0.14, z1 + TK / 2 + 0.45, segW - 0.1, 0.28, 0.9, MAT.white, { camBlock: false });
      }
      const label = i === 0
        ? [{ text: CFG.title }, { text: `${CFG.him}  ♥  ${CFG.her}`, font: FONT_SANS, weight: 500 }]
        : [{ text: i + 1 === FINAL ? 'قاعة القلب ❤' : 'القاعة ' + (i + 2) }];
      const sw = i === 0 ? 6.4 : 3.6, sh = i === 0 ? 1.5 : 0.9;
      const sign = addMesh(new THREE.PlaneGeometry(sw, sh),
        new THREE.MeshBasicMaterial({ map: signTexture(label, 1024, Math.round(1024 * sh / sw), TH.signStyle), transparent: TH.signStyle !== 'gold', toneMapped: false }),
        0, DOOR_H + 0.25 + (H - DOOR_H - 0.25) / 2 - 0.05, z1 + TK / 2 + 0.02);
    }
    // plants & benches
    const pz = TH.platforms ? 1.7 : 0.8;
    for (const sx of [-1, 1]) {
      addPlant(sx * (W / 2 - 0.75), z0 - 0.8);
      addPlant(sx * (W / 2 - 0.75), z1 + (isFinal ? 0.8 : pz));
    }
    if (!isFinal) for (const sx of [-1, 1]) addBench(sx * 3.4, cz, sx < 0 ? -Math.PI / 2 : Math.PI / 2);
  }
  // entrance wall with door hole
  const ec = TH.roomWall(0);
  const bsw = (W - EDW) / 2;
  wallBlock(-(EDW / 2 + bsw / 2), TK / 2, bsw, TK, ec);
  wallBlock(EDW / 2 + bsw / 2, TK / 2, bsw, TK, ec);
  addBox(0, (H + EDH) / 2, TK / 2, EDW, H - EDH, TK, wallMat(ec, 1, 0.6), { collide: false });
  // corner fillers between interior and facade
  addBox(-(W / 2 + 1.5), H / 2, TK / 2, 3, H, TK, MAT.marble, { camBlock: false });
  addBox(W / 2 + 1.5, H / 2, TK / 2, 3, H, TK, MAT.marble, { camBlock: false });
  wallBlock(0, -total - TK / 2, W + TK * 2, TK, TH.farWall);
  addDedicationLectern(2.9, -2.4);
}
function addPlant(x, z) {
  const g = new THREE.Group(); C.group.add(g);
  if (TH.plant === 'white') {
    addMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 20), MAT.white, 0, 0.3, 0, g).castShadow = true;
    for (let k = 0; k < 7; k++) {
      const l = addMesh(new THREE.SphereGeometry(0.22, 8, 6), MAT.leafDark, (Math.random() - 0.5) * 0.4, 0.9 + k * 0.17, (Math.random() - 0.5) * 0.4, g);
      l.scale.set(1, 0.35, 0.7); l.rotation.set(Math.random(), Math.random() * 3, Math.random() * 0.6); l.castShadow = true;
    }
  } else {
    addMesh(new THREE.CylinderGeometry(0.32, 0.24, 0.55, 16), MAT.pot, 0, 0.275, 0, g).castShadow = true;
    for (let k = 0; k < 5; k++) {
      const l = addMesh(new THREE.IcosahedronGeometry(0.28 + Math.random() * 0.12, 0), MAT.leaf, (Math.random() - 0.5) * 0.35, 0.75 + Math.random() * 0.55, (Math.random() - 0.5) * 0.35, g);
      l.rotation.set(Math.random() * 3, Math.random() * 3, 0); l.castShadow = true;
    }
  }
  g.position.set(x, 0, z);
  addCollider(x, z, 0.36, 0.36);
}
// bench: length along local x; people face local +z; rotY turns it
function addBench(x, z, rotY, len = 2.0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; C.group.add(g);
  const seatMat = TH.bench === 'oak' ? MAT.oak : MAT.velvetBench;
  const legMat = TH.bench === 'oak' ? MAT.black : MAT.gold;
  const seat = addMesh(new THREE.BoxGeometry(len, 0.1, 0.5), seatMat, 0, 0.35, 0, g);
  seat.castShadow = true; seat.receiveShadow = true;
  for (const dx of [-len / 2 + 0.15, len / 2 - 0.15]) {
    if (TH.bench === 'oak') addMesh(new THREE.BoxGeometry(0.06, 0.3, 0.42), legMat, dx, 0.15, 0, g).castShadow = true;
    else for (const dz of [-0.18, 0.18]) addMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), legMat, dx, 0.15, dz, g);
  }
  const c = Math.abs(Math.cos(rotY)) > 0.5;
  addCollider(x, z, c ? len / 2 + 0.02 : 0.27, c ? 0.27 : len / 2 + 0.02);
  const fx = Math.sin(rotY), fz = Math.cos(rotY);
  const ax = Math.cos(rotY), az = -Math.sin(rotY);
  const bench = { x, z, rot: rotY, fx, fz,
    seats: [{ x: x + ax * 0.42 - fx * 0.05, z: z + az * 0.42 - fz * 0.05 }, { x: x - ax * 0.42 - fx * 0.05, z: z - az * 0.42 - fz * 0.05 }] };
  C.benches.push(bench);
  seat.userData.bench = bench; C.clickables.push(seat);
  C.targets.push({ kind: 'bench', bench, x: x + fx * 0.55, z: z + fz * 0.55, range: 1.5 });
  return bench;
}
function addDedicationLectern(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-0.45, 1); C.group.add(g);
  const dark = TH.plaqueDark;
  addMesh(new THREE.BoxGeometry(0.5, 1.0, 0.36), dark ? MAT.white : MAT.darkWood, 0, 0.5, 0, g).castShadow = true;
  const panel = new THREE.Group(); panel.position.set(0, 1.12, 0.02); panel.rotation.x = -0.75; g.add(panel);
  addMesh(new THREE.BoxGeometry(1.15, 0.78, 0.05), dark ? MAT.black : MAT.darkWood, 0, 0, 0, panel).castShadow = true;
  const tex = canvasTex(makeCanvas(1024, 700, (c, w, h) => {
    c.fillStyle = dark ? '#121113' : '#2a160f'; c.fillRect(0, 0, w, h);
    if (!dark) { c.strokeStyle = '#d8b46a'; c.lineWidth = 8; c.strokeRect(14, 14, w - 28, h - 28); }
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'rtl';
    c.fillStyle = dark ? '#b8b0a8' : '#d8b46a'; c.font = `500 34px ${FONT_SANS}`; c.fillText('مجموعة دائمة', w / 2, 110);
    c.fillStyle = '#fff'; c.font = `700 110px ${FONT_SERIF}`; c.fillText(DED.title, w / 2, 240, w - 80);
    c.font = `400 40px ${FONT_SANS}`; c.fillStyle = 'rgba(255,255,255,.85)';
    (DED.message || '').split('\n').slice(0, 3).forEach((ln, i) => c.fillText(ln, w / 2, 380 + i * 58, w - 90));
    c.font = `italic 400 46px ${FONT_SERIF}`; c.fillStyle = 'rgba(255,255,255,.6)'; c.fillText(DED.signature, w / 2, SINCE ? 570 : 600, w - 80);
    if (SINCE) { c.font = `500 30px ${FONT_SANS}`; c.fillStyle = '#ffb3c6'; c.fillText(`سوا من ${SINCE.short} · ${SINCE.days} يوم ❤`, w / 2, 645, w - 80); }
  }));
  const face = addMesh(new THREE.PlaneGeometry(1.08, 0.72), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), 0, 0, 0.03, panel);
  addCollider(x, z, 0.4, 0.4);
  face.userData.dedication = true; C.clickables.push(face);
  C.targets.push({ kind: 'dedication', x, z, range: 2.0 });
}

// ---------------------------------------------------------------- frames
function slotsForRoom(i) {
  const z0 = -i * D, z1 = -(i + 1) * D;
  const xL = -W / 2 + 0.06, xR = W / 2 - 0.06;
  const segX = DOOR / 2 + (W - DOOR) / 4;
  const out = [];
  for (const zz of [z0 - 3.4, z0 - 7, z0 - 10.6]) { out.push({ x: xL, z: zz, nx: 1, nz: 0 }); out.push({ x: xR, z: zz, nx: -1, nz: 0 }); }
  out.push({ x: -segX, z: z1 + TK / 2 + 0.04, nx: 0, nz: 1 });
  out.push({ x: segX, z: z1 + TK / 2 + 0.04, nx: 0, nz: 1 });
  return out;
}
function createFrame(ex, slot, index) {
  const { photo, puzzle } = ex;
  const g = new THREE.Group();
  const cy = slot.nz ? 2.25 : 2.05;
  g.position.set(slot.x, cy, slot.z);
  g.rotation.y = Math.atan2(slot.nx, slot.nz);
  C.group.add(g);
  const modern = TH.frame === 'black';
  const maxW = 2.4, maxH = 1.8, a = photo.aspect;
  let w, h;
  if (a > maxW / maxH) { w = maxW; h = w / a; } else { h = maxH; w = h * a; }
  const pad = modern ? 0.24 : 0.16, bw = modern ? 0.05 : 0.12;
  const OW = w + pad * 2, OH = h + pad * 2;

  const wash = addMesh(new THREE.PlaneGeometry(OW + 2.6, OH + 2.6), MAT.wash, 0, 0.5, 0.006, g);
  wash.material = MAT.wash;
  if (!modern) addMesh(new THREE.BoxGeometry(OW + bw, OH + bw, 0.05), MAT.backing, 0, 0, 0.03, g);
  const matB = addMesh(new THREE.BoxGeometry(OW, OH, 0.04), new THREE.MeshStandardMaterial({ color: modern ? 0xffffff : 0xefe6d6, roughness: 0.9 }), 0, 0, 0.04, g);
  matB.castShadow = true;
  const locked = puzzle && !solved.has(photo.id);
  const pic = addMesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: locked ? lockedTexture(photo) : photoTex(photo), toneMapped: false }), 0, 0, 0.062, g);
  const fm = modern ? MAT.black : MAT.gold, fd = modern ? 0.07 : 0.12;
  for (const [bx, by, px, py] of [[OW + bw * 2, bw, 0, OH / 2 + bw / 2], [OW + bw * 2, bw, 0, -OH / 2 - bw / 2], [bw, OH, -OW / 2 - bw / 2, 0], [bw, OH, OW / 2 + bw / 2, 0]]) {
    addMesh(new THREE.BoxGeometry(bx, by, fd), fm, px, py, 0.06, g).castShadow = true;
  }
  if (!modern) {
    const lamp = addMesh(new THREE.CylinderGeometry(0.05, 0.05, Math.min(1.2, OW * 0.6), 12), MAT.gold, 0, OH / 2 + bw + 0.22, 0.25, g);
    lamp.rotation.z = Math.PI / 2;
    const arm = addMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), MAT.gold, 0, OH / 2 + bw + 0.2, 0.12, g);
    arm.rotation.x = Math.PI / 2;
  }
  const plq = modern ? [0.62, 0.2, OW / 2 + bw + 0.5, -OH / 2 + 0.1] : [0.9, 0.3, 0, -OH / 2 - bw - 0.3];
  const plaque = addMesh(new THREE.PlaneGeometry(plq[0], plq[1]),
    new THREE.MeshBasicMaterial({ map: plaqueTexture(locked ? '؟؟؟' : photo.title, locked ? '' : photo.date, TH.plaqueDark), toneMapped: false }), plq[2], plq[3], 0.03, g);

  const rec = { ex, index, group: g, pic, plaque, w, h, OW, OH, slot, cy, wx: slot.x, wz: slot.z, revealed: true, curtainT: 1, curtain: null, gem: null };
  if (!puzzle) {
    rec.revealed = found.has(photo.id);
    const pivot = new THREE.Group(); pivot.position.set(0, OH / 2 + bw + 0.05, 0.2); g.add(pivot);
    const cw = OW + bw * 2 + 0.25, ch = OH + bw * 2 + 0.2;
    const cg = new THREE.PlaneGeometry(cw, ch); cg.translate(0, -ch / 2, 0);
    const cloth = addMesh(cg, new THREE.MeshStandardMaterial({ map: TH.curtain === 'linen' ? TEX.linen : TEX.velvet, roughness: 0.85, side: THREE.DoubleSide }), 0, 0, 0, pivot);
    cloth.castShadow = true;
    const rod = addMesh(new THREE.CylinderGeometry(0.03, 0.03, cw + 0.3, 10), modern ? MAT.black : MAT.gold, 0, 0.02, 0, pivot);
    rod.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) addMesh(new THREE.SphereGeometry(0.055, 10, 8), modern ? MAT.black : MAT.gold, s * (cw / 2 + 0.15), 0.02, 0, pivot);
    rec.curtain = pivot; rec.cloth = cloth; rec.curtainT = rec.revealed ? 1 : 0;
    setCurtain(rec);
    cloth.userData.rec = rec; C.clickables.push(cloth);
  }
  pic.userData.rec = rec; matB.userData.rec = rec; C.clickables.push(pic, matB);

  if (puzzle) {
    const px = slot.x + slot.nx * 2.3, pz = slot.z + slot.nz * 2.3;
    const ped = new THREE.Group(); ped.position.set(px, 0, pz); C.group.add(ped);
    let colM;
    if (TH.pedestal === 'plinth') colM = addMesh(new THREE.BoxGeometry(0.6, 1.05, 0.6), MAT.white, 0, 0.525, 0, ped);
    else {
      colM = addMesh(new THREE.CylinderGeometry(0.28, 0.34, 1.0, 20), std(0xece5dc, 0.35), 0, 0.5, 0, ped);
      addMesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 20), MAT.gold, 0, 1.04, 0, ped);
    }
    colM.castShadow = true;
    const gemMat = std(0xff5f8a, 0.2, { emissive: 0xff2a60, emissiveIntensity: 1.4 });
    const gem = addMesh(heartGeometry(0.16), gemMat, 0, 1.42, 0, ped);
    gem.castShadow = true;
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.pinkGlow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
    gl.scale.set(1.2, 1.2, 1); gl.position.y = 1.42; ped.add(gl);
    addCollider(px, pz, 0.38, 0.38);
    rec.gem = gem; rec.gemGlow = gl; rec.gemMat = gemMat;
    colM.userData.rec = rec; gem.userData.rec = rec; C.clickables.push(colM, gem);
    C.targets.push({ kind: 'puzzle', rec, x: px, z: pz, range: 1.9 });
    if (solved.has(photo.id)) setGemSolved(rec);
  }
  C.targets.push({ kind: puzzle ? 'puzzle' : 'photo', rec, x: slot.x, z: slot.z, nx: slot.nx, nz: slot.nz, range: 3.4, frame: true });
  C.frames.push(rec);
  return rec;
}
function setCurtain(rec) { rec.curtain.scale.y = 1 - ease(rec.curtainT) * 0.93; }
function setGemSolved(rec) {
  rec.gemMat.color.set(0xffd27a); rec.gemMat.emissive.set(0xc98a1a); rec.gemMat.emissiveIntensity = 0.6;
  rec.gemGlow.material.opacity = 0.35;
}

// ---------------------------------------------------------------- final room
let slideshow = null, heartSpot = null;
function buildFinalRoom() {
  C = INT;
  const z0 = -FINAL * D, z1 = -(FINAL + 1) * D, cz = (z0 + z1) / 2;
  const farZ = z1 + 0.05;
  const heart = addMesh(heartGeometry(0.95, 0.3), std(0xff4f7b, 0.3, { emissive: 0xff1f5a, emissiveIntensity: 1.1 }), 0, 2.75, farZ + 0.35);
  const hg = addMesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: TEX.pinkGlow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }), 0, 2.75, farZ + 0.02);
  C.updaters.push((dt, t) => { heart.scale.setScalar(1 + Math.sin(t * 3.2) * 0.04 + Math.max(0, Math.sin(t * 6.4)) * 0.03); });
  const pl = new THREE.PointLight(0xff6f95, 30, 16, 2); pl.position.set(0, 3.2, farZ + 3); C.group.add(pl);
  addMesh(new THREE.PlaneGeometry(3.6, 0.75), new THREE.MeshBasicMaterial({ map: signTexture([{ text: `${CFG.him}  ♥  ${CFG.her}` }], 1024, 214, 'plain', '#fff'), transparent: true, toneMapped: false }), 0, 4.5, farZ + 0.03);
  if (SINCE) {
    addMesh(new THREE.PlaneGeometry(5.6, 1.05), new THREE.MeshBasicMaterial({ map: signTexture([
      { text: `سوا من ${SINCE.date} لليوم`, size: 70, font: FONT_SANS, weight: 500, color: 'rgba(255,255,255,.85)' },
      { text: `${SINCE.span}  ·  ${SINCE.days.toLocaleString('en')} يوم 💞`, size: 84 },
    ], 1536, 288, 'plain', '#fff'), transparent: true, toneMapped: false }), 0, 1.3, farZ + 0.03);
  }
  // heart spot on the floor
  const spotZ = z1 + 4.0;
  const ring = addMesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: TEX.ring, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 0, 0.02, spotZ);
  ring.rotation.x = -Math.PI / 2;
  C.updaters.push((dt, t) => { ring.material.opacity = 0.65 + Math.sin(t * 3) * 0.3; ring.rotation.z += dt * 0.3; });
  heartSpot = { x: 0, z: spotZ };
  C.targets.push({ kind: 'heartspot', x: 0, z: spotZ, range: 1.6 });
  // slideshow screen on left wall + bench
  slideshow = buildScreen(-W / 2 + 0.08, 2.45, cz, Math.PI / 2, 5.4, 3.04);
  addBench(-4.6, cz, -Math.PI / 2, 2.2);
  // dedication wall on the right
  const tex = canvasTex(makeCanvas(1600, 900, (c, w, h) => {
    c.fillStyle = '#141214'; c.fillRect(0, 0, w, h);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'rtl';
    c.fillStyle = '#b8b0a8'; c.font = `500 40px ${FONT_SANS}`; c.fillText('مجموعة دائمة', w / 2, 130);
    c.fillStyle = '#fff'; c.font = `700 150px ${FONT_SERIF}`; c.fillText(DED.title, w / 2, 300, w - 120);
    c.font = `400 52px ${FONT_SANS}`; c.fillStyle = 'rgba(255,255,255,.86)';
    (CFG.endingMessage || DED.message || '').split('\n').slice(0, 3).forEach((ln, i) => c.fillText(ln, w / 2, 490 + i * 78, w - 140));
    c.font = `italic 400 64px ${FONT_SERIF}`; c.fillStyle = 'rgba(255,255,255,.6)'; c.fillText(DED.signature, w / 2, 780, w - 120);
  }));
  const dp = addMesh(new THREE.PlaneGeometry(5.2, 2.92), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), W / 2 - 0.05, 2.45, cz);
  dp.rotation.y = -Math.PI / 2;
  // petals
  const N = 170, pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * W; pos[i * 3 + 1] = Math.random() * H; pos[i * 3 + 2] = z0 - Math.random() * D; vel.push(0.3 + Math.random() * 0.5, Math.random() * 6); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  C.group.add(new THREE.Points(pg, new THREE.PointsMaterial({ map: TEX.petal, size: 0.16, transparent: true, depthWrite: false, alphaTest: 0.05 })));
  C.updaters.push((dt, t) => {
    if (P.z > z0 + 2) return;
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 1] -= vel[i * 2] * dt; pos[i * 3] += Math.sin(t * 1.5 + vel[i * 2 + 1]) * 0.25 * dt;
      if (pos[i * 3 + 1] < 0.02) { pos[i * 3 + 1] = H - 0.1; pos[i * 3] = (Math.random() - 0.5) * W; }
    }
    pg.attributes.position.needsUpdate = true;
  });
}
function buildScreen(x, y, z, rotY, w, h) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; C.group.add(g);
  addMesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.08), MAT.black, 0, 0, 0.04, g);
  const mk = () => addMesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), 0, 0, 0.085, g);
  const A = mk(), B = mk(); B.position.z = 0.088;
  const glow = addMesh(new THREE.PlaneGeometry(w + 3, h + 2.4), MAT.glow, 0, 0, 0.005, g);
  glow.material = MAT.glow;
  const S = { planes: [A, B], cur: 0, t: 0, idx: -1, life: [0, 0], dir: [1, -1], cache: new Map(), aspect: w / h, w, h, x, y, z };
  const texFor = (p) => {
    if (!S.cache.has(p.id)) { const t = photoTex(p).clone(); t.needsUpdate = true; S.cache.set(p.id, t); }
    return S.cache.get(p.id);
  };
  S.list = () => PHOTOS.filter((p) => !EXHIBITS.find((e) => e.photo === p && e.puzzle && !solved.has(p.id)));
  S.show = (plane, k) => {
    const list = S.list(); if (!list.length) return;
    const p = list[((k % list.length) + list.length) % list.length];
    plane.material.map = texFor(p); plane.material.needsUpdate = true;
    plane.userData.aspect = p.aspect;
  };
  S.kb = (plane, life, dir) => {
    const map = plane.material.map; if (!map) return;
    const a = plane.userData.aspect, s = S.aspect;
    let rx = 1, ry = 1;
    if (a > s) rx = s / a; else ry = a / s;
    const z = 1 - 0.14 * clamp(life / 7, 0, 1);
    rx *= z; ry *= z;
    map.repeat.set(rx, ry);
    const px = (1 - rx) * (dir > 0 ? life / 7 : 1 - life / 7), py = (1 - ry) * 0.5;
    map.offset.set(clamp(px, 0, 1 - rx), py);
  };
  S.update = (dt) => {
    if (S.idx < 0) { S.idx = 0; S.show(A, 0); A.material.opacity = 1; S.life = [0, 0]; }
    S.t += dt; S.life[0] += dt; S.life[1] += dt;
    const cur = S.planes[S.cur], nxt = S.planes[1 - S.cur];
    if (S.t > 5.8 && !nxt.userData.ready) { S.show(nxt, S.idx + 1); nxt.userData.ready = true; S.life[1 - S.cur] = 0; S.dir[1 - S.cur] *= -1; }
    if (S.t > 5.8) nxt.material.opacity = clamp((S.t - 5.8) / 1.2, 0, 1);
    S.kb(cur, S.life[S.cur], S.dir[S.cur]);
    if (nxt.userData.ready) S.kb(nxt, S.life[1 - S.cur], S.dir[1 - S.cur]);
    if (S.t >= 7) {
      cur.material.opacity = 0; cur.userData.ready = false; nxt.renderOrder = 1; cur.renderOrder = 2;
      cur.position.z = 0.088; nxt.position.z = 0.085;
      S.cur = 1 - S.cur; S.idx++; S.t = 0;
    }
  };
  C.updaters.push((dt) => { if (P.z < -FINAL * D + 1 || mode === 'sit') S.update(dt); });
  return S;
}

// =====================================================================
//  EXHIBITS
// =====================================================================
let PHOTOS = [], EXHIBITS = [];
const TYPES = ['slide', 'swap', 'memory', 'question'];
function planExhibits(photos) {
  const byId = new Map(photos.map((p) => [p.id, p]));
  let list = (CFG.puzzles || []).filter((p) => p && byId.has(p.photo) && TYPES.includes(p.type));
  list = list.map((p) => (p.type === 'question' && !(p.question && p.answers && p.answers.length)) ? { ...p, type: 'slide' } : p);
  if (!list.length && CFG.autoPuzzles && photos.length >= 5) {
    const auto = ['slide', 'memory', 'swap']; let k = 0;
    for (let i = 4; i < photos.length; i += 5) list.push({ photo: photos[i].id, type: auto[k++ % auto.length] });
  }
  const pmap = new Map(list.map((p) => [p.photo, p]));
  return photos.map((p) => ({ photo: p, puzzle: pmap.get(p.id) || null }));
}
function rebuildInterior() {
  clearCtx(INT);
  TH = THEMES[themeName];
  ROOMS = Math.max(1, Math.ceil(EXHIBITS.length / CFG.photosPerRoom));
  FINAL = ROOMS;
  buildInterior();
  C = INT;
  EXHIBITS.forEach((ex, i) => {
    const room = Math.floor(i / CFG.photosPerRoom);
    createFrame(ex, slotsForRoom(room)[i % CFG.photosPerRoom], i);
  });
  buildFinalRoom();
  renderer.toneMappingExposure = TH.exposure;
}

// =====================================================================
//  CHARACTERS
// =====================================================================
const SKINS = ['#f7dcc4', '#efc6a2', '#dcaa82', '#b8805a', '#8a5a3c', '#5e3d2a'];
const HAIRS = ['#17110e', '#3b2418', '#6b4226', '#a8743f', '#e0c07a', '#b23a3a', '#d9d4cc'];
const CLOTH = ['#ffffff', '#f6f1ea', '#d8c7a8', '#2a2a2e', '#3a4a6b', '#2f5d8a', '#5b7a4a', '#c2415d', '#e85a7a', '#7a2a38', '#f0b3c3', '#9a7ab8'];
const LOOK_OPTS = {
  boy: { hair: [['curly', 'كيرلي'], ['short', 'قصير'], ['side', 'جانبي'], ['buzz', 'محلوق']], outfit: [['vest', 'قميص وصدرية'], ['tee', 'تيشيرت'], ['hoodie', 'هودي']] },
  girl: { hair: [['long', 'طويل'], ['wavy', 'مموّج'], ['ponytail', 'ذيل حصان'], ['bun', 'كعكة'], ['bob', 'قصير']], outfit: [['dress', 'فستان'], ['blouse', 'بلوزة وبنطلون'], ['skirt', 'تنورة']] },
};
const DEFAULT_LOOK = {
  boy: Object.assign({ skin: 1, hair: 'curly', hairColor: '#17110e', outfit: 'vest', top: '#2a2a2e', bottom: '#d8c7a8' }, (CFG.looks || {}).him || {}),
  girl: Object.assign({ skin: 0, hair: 'long', hairColor: '#e0c07a', outfit: 'dress', top: '#f6f1ea', bottom: '#e85a7a' }, (CFG.looks || {}).her || {}),
};
const looks = { boy: Object.assign({}, DEFAULT_LOOK.boy, (save.looks || {}).boy || {}), girl: Object.assign({}, DEFAULT_LOOK.girl, (save.looks || {}).girl || {}) };

function makeCharacter(kind, look) {
  const girl = kind === 'girl';
  const L = Object.assign({}, DEFAULT_LOOK[kind], look || {});
  const skin = std(SKINS[L.skin] || SKINS[0], 0.62);
  const skinD = std(new THREE.Color(SKINS[L.skin] || SKINS[0]).multiplyScalar(0.85), 0.6);
  const hairM = std(L.hairColor, 0.5);
  const topM = std(L.top, 0.78), botM = std(L.bottom, 0.8), whiteM = std('#f7f5f0', 0.75);
  const darkM = std('#1d1d22', 0.6);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const add = (p, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 12);
  const j = {};
  const o = L.outfit;
  // colors per outfit
  const legM = girl ? (o === 'blouse' ? botM : skin) : botM;
  const shoeM = girl ? (o === 'dress' ? botM : o === 'blouse' ? whiteM : darkM) : (o === 'tee' ? whiteM : darkM);
  const torsoM = girl ? topM : (o === 'vest' ? whiteM : topM);
  const upperArmM = girl ? (o === 'blouse' ? topM : skin) : (o === 'vest' ? whiteM : topM);
  const foreArmM = girl ? (o === 'blouse' ? topM : skin) : (o === 'tee' ? skin : (o === 'vest' ? whiteM : topM));
  // legs
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0.095 * s, 0.8, 0); body.add(hip);
    add(hip, cap(girl ? 0.066 : 0.077, 0.26), legM, 0, -0.19, 0);
    const knee = new THREE.Group(); knee.position.y = -0.4; hip.add(knee);
    add(knee, cap(girl ? 0.056 : 0.066, 0.26), legM, 0, -0.18, 0);
    add(knee, new THREE.BoxGeometry(0.12, 0.08, 0.24), shoeM, 0, -0.36, 0.04);
    j[s < 0 ? 'hipL' : 'hipR'] = hip; j[s < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  // torso
  if (girl) {
    const chest = add(body, cap(0.15, 0.27), topM, 0, 1.2, 0); chest.scale.z = 0.74;
    if (o === 'dress') { j.skirt = add(body, new THREE.CylinderGeometry(0.15, 0.34, 0.6, 24), topM, 0, 0.77, 0); j.skirtTop = 1.07; }
    else if (o === 'skirt') { j.skirt = add(body, new THREE.CylinderGeometry(0.16, 0.27, 0.32, 22), botM, 0, 0.86, 0); j.skirtTop = 1.02; }
    else { add(body, new THREE.CylinderGeometry(0.155, 0.165, 0.2, 18), botM, 0, 0.88, 0); }
    if (o !== 'blouse') add(body, new THREE.TorusGeometry(0.15, 0.022, 6, 22), o === 'dress' ? botM : whiteM, 0, 1.05, 0).rotation.x = Math.PI / 2;
  } else {
    add(body, new THREE.CylinderGeometry(0.175, 0.175, 0.2, 18), botM, 0, 0.88, 0);
    const chest = add(body, cap(0.19, 0.3), torsoM, 0, 1.18, 0); chest.scale.z = 0.7;
    if (o === 'vest') {
      const v = add(body, cap(0.2, 0.2), topM, 0, 1.13, 0); v.scale.set(1.02, 1, 0.74);
      add(body, new THREE.BoxGeometry(0.03, 0.3, 0.02), whiteM, 0, 1.22, 0.142);
      for (let k = 0; k < 3; k++) add(body, new THREE.SphereGeometry(0.013, 6, 4), std('#d8c7a8', 0.5), 0.03, 1.05 + k * 0.08, 0.146);
    } else if (o === 'hoodie') {
      add(body, new THREE.TorusGeometry(0.13, 0.05, 8, 18), topM, 0, 1.5, -0.04).rotation.x = Math.PI / 2 - 0.3;
      add(body, new THREE.BoxGeometry(0.22, 0.1, 0.03), std(new THREE.Color(L.top).multiplyScalar(0.85), 0.8), 0, 1.02, 0.135);
    } else add(body, new THREE.TorusGeometry(0.085, 0.015, 6, 16), topM, 0, 1.5, 0.01).rotation.x = Math.PI / 2;
  }
  add(body, new THREE.CylinderGeometry(0.052, 0.058, 0.12, 10), skin, 0, 1.56, 0);
  // arms
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set((girl ? 0.205 : 0.25) * s, 1.44, 0); body.add(sh);
    add(sh, cap(girl ? 0.048 : 0.056, 0.2), upperArmM, 0, -0.15, 0);
    if (girl && o !== 'blouse') add(sh, new THREE.SphereGeometry(0.072, 12, 8), topM, 0, -0.03, 0);
    if (!girl && o === 'tee') add(sh, new THREE.CylinderGeometry(0.068, 0.072, 0.14, 12), topM, 0, -0.08, 0);
    const el = new THREE.Group(); el.position.y = -0.31; sh.add(el);
    add(el, cap(girl ? 0.043 : 0.05, 0.18), foreArmM, 0, -0.12, 0);
    add(el, new THREE.SphereGeometry(0.052, 10, 8), skin, 0, -0.27, 0);
    j[s < 0 ? 'shL' : 'shR'] = sh; j[s < 0 ? 'elL' : 'elR'] = el;
  }
  // head
  const head = new THREE.Group(); head.position.y = 1.73; body.add(head); j.head = head;
  const skull = add(head, new THREE.SphereGeometry(0.175, 28, 20), skin); skull.scale.y = 1.04;
  for (const s of [-1, 1]) {
    add(head, new THREE.SphereGeometry(0.034, 10, 8), skin, s * 0.17, -0.01, 0);
    const e = add(head, new THREE.SphereGeometry(0.026, 12, 8), std('#1a120e', 0.3), s * 0.062, 0.0, 0.158); e.scale.set(1, 1.15, 0.5);
    add(head, new THREE.SphereGeometry(0.008, 6, 4), std('#ffffff', 0.2, { emissive: 0xffffff, emissiveIntensity: 0.6 }), s * 0.055, 0.012, 0.172);
    const b = add(head, new THREE.BoxGeometry(0.05, 0.011, 0.012), hairM, s * 0.064, 0.055, 0.163); b.rotation.z = s * -0.12;
    const ch = add(head, new THREE.SphereGeometry(0.03, 10, 8), std('#f29a9a', 0.7), s * 0.105, -0.05, 0.133); ch.scale.z = 0.35;
  }
  add(head, new THREE.SphereGeometry(0.019, 8, 6), skinD, 0, -0.025, 0.175);
  const mouth = add(head, new THREE.TorusGeometry(0.026, 0.007, 6, 12, Math.PI), std('#a5523f', 0.6), 0, -0.07, 0.162); mouth.rotation.z = Math.PI;
  buildHair(head, L.hair, hairM, add);
  root.scale.setScalar(0.95);
  root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: root, body, j, kind, look: L, phase: Math.random() * 6, pose: blankPose(), state: 'idle', danceT: 0, waveT: 0 };
}
function buildHair(head, style, m, add) {
  const capG = (r, t) => new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI * t);
  const cap = (r = 0.19, t = 0.52, tilt = -0.25) => { const c = add(head, capG(r, t), m, 0, 0.012, -0.012); c.rotation.x = tilt; return c; };
  if (style === 'curly') {
    cap(0.185, 0.5);
    const n = 46;
    for (let i = 0; i < n; i++) {
      const th = Math.acos(1 - (i + 0.5) / n * 1.25);
      const ph = i * 2.399963;
      const r = 0.19;
      let x = r * Math.sin(th) * Math.cos(ph), y = r * Math.cos(th), z = r * Math.sin(th) * Math.sin(ph);
      if (z > 0.09 && y < 0.09) continue;
      if (y < -0.05) continue;
      add(head, new THREE.SphereGeometry(0.055 + Math.random() * 0.02, 10, 8), m, x, y + 0.02, z - 0.015);
    }
  } else if (style === 'short') {
    cap(0.188, 0.5);
    const f = add(head, new THREE.SphereGeometry(0.1, 14, 10), m, 0.02, 0.13, 0.11); f.scale.set(1.7, 0.45, 0.8); f.rotation.z = -0.15;
  } else if (style === 'side') {
    cap(0.19, 0.52);
    const sw = add(head, new THREE.CapsuleGeometry(0.06, 0.2, 4, 10), m, -0.03, 0.14, 0.1); sw.rotation.z = Math.PI / 2 - 0.3; sw.scale.z = 0.6;
    add(head, new THREE.SphereGeometry(0.08, 12, 8), m, 0.1, 0.17, 0.02);
  } else if (style === 'buzz') {
    cap(0.18, 0.48, -0.3);
  } else if (style === 'long' || style === 'wavy') {
    cap(0.192, 0.56);
    const back = add(head, new THREE.CapsuleGeometry(0.16, 0.34, 4, 14), m, 0, -0.2, -0.075); back.scale.set(1.14, 1, 0.62);
    for (const s of [-1, 1]) { const st = add(head, new THREE.CapsuleGeometry(0.05, 0.3, 4, 8), m, s * 0.155, -0.15, 0.02); st.rotation.z = s * 0.08; }
    const fr = add(head, new THREE.SphereGeometry(0.1, 14, 10), m, 0.03, 0.14, 0.11); fr.scale.set(1.6, 0.42, 0.8);
    if (style === 'wavy') for (let i = 0; i < 9; i++) add(head, new THREE.SphereGeometry(0.06, 10, 8), m, (i % 3 - 1) * 0.11, -0.36 - Math.floor(i / 3) * 0.05, -0.08 - (i % 2) * 0.03);
  } else if (style === 'ponytail') {
    cap(0.19, 0.55);
    const fr = add(head, new THREE.SphereGeometry(0.1, 14, 10), m, 0.03, 0.14, 0.11); fr.scale.set(1.6, 0.42, 0.8);
    add(head, new THREE.TorusGeometry(0.035, 0.014, 6, 12), std('#e85a7a', 0.5), 0, 0.06, -0.195).rotation.x = 0.4;
    const tail = add(head, new THREE.CapsuleGeometry(0.06, 0.3, 4, 10), m, 0, -0.12, -0.25); tail.rotation.x = 0.35;
  } else if (style === 'bun') {
    cap(0.19, 0.55);
    add(head, new THREE.SphereGeometry(0.095, 14, 10), m, 0, 0.2, -0.09);
    const fr = add(head, new THREE.SphereGeometry(0.1, 14, 10), m, 0.03, 0.14, 0.11); fr.scale.set(1.6, 0.4, 0.8);
  } else if (style === 'bob') {
    const gap = 1.7;
    const g = new THREE.SphereGeometry(0.2, 28, 16, Math.PI / 2 + gap / 2, Math.PI * 2 - gap, 0, Math.PI * 0.7);
    add(head, g, m, 0, 0.01, -0.01);
    cap(0.195, 0.4);
    const fr = add(head, new THREE.SphereGeometry(0.1, 14, 10), m, 0, 0.13, 0.12); fr.scale.set(1.75, 0.45, 0.8);
  }
}
function blankPose() { return { hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, shL: 0, shR: 0, shLz: 0.07, shRz: 0.07, elL: -0.12, elR: -0.12, by: 0, bry: 0, brz: 0, brx: 0, hx: 0, hy: 0, hz: 0 }; }
function poseTarget(c, dt, t, speed) {
  const p = blankPose();
  const st = c.state;
  if (st === 'walk' || (st === 'idle' && speed > 0.15)) {
    const amp = clamp(speed / 2.6, 0, 1.5);
    c.phase += dt * (3.6 + speed * 2.3);
    const s = Math.sin(c.phase);
    p.hipL = -s * 0.55 * amp; p.hipR = s * 0.55 * amp;
    p.kneeL = (0.1 + 0.65 * Math.max(0, Math.sin(c.phase - 1.3))) * amp;
    p.kneeR = (0.1 + 0.65 * Math.max(0, -Math.sin(c.phase - 1.3))) * amp;
    p.shL = s * 0.5 * amp; p.shR = -s * 0.5 * amp;
    p.elL = p.elR = -0.25 - 0.2 * amp;
    p.by = Math.abs(Math.cos(c.phase)) * 0.035 * amp; p.bry = s * 0.07 * amp; p.brx = 0.04 * amp;
  } else if (st === 'sit') {
    p.hipL = p.hipR = -1.52; p.kneeL = p.kneeR = 1.5;
    p.shL = p.shR = -0.42; p.elL = p.elR = -0.62; p.shLz = p.shRz = 0.12;
    p.by = -0.31; p.hy = Math.sin(t * 0.4) * 0.12; p.hx = -0.06;
  } else if (st === 'dance') {
    c.danceT += dt;
    const w = c.danceT * Math.PI * 2 * 0.95, mv = Math.floor(c.danceT / 4.2) % 4;
    const b = Math.abs(Math.sin(w));
    p.by = b * 0.045; p.kneeL = p.kneeR = 0.15 + b * 0.25; p.hipL = p.hipR = -0.1 - b * 0.12;
    if (mv === 0) {
      p.brz = Math.sin(w * 0.5) * 0.14; p.hipL += Math.sin(w * 0.5) * 0.2; p.hipR -= Math.sin(w * 0.5) * 0.2;
      p.shL = -2.6 + Math.sin(w) * 0.3; p.shR = -0.5 - Math.sin(w) * 0.3; p.elL = -0.4; p.elR = -1.2; p.shLz = 0.3;
    } else if (mv === 1) {
      p.shL = p.shR = -2.75; p.shLz = p.shRz = 0.35 + Math.sin(w) * 0.35; p.elL = p.elR = -0.3; p.hz = Math.sin(w * 0.5) * 0.15;
    } else if (mv === 2) {
      p.bry = Math.sin(w * 0.5) * 0.55; p.shL = -0.9 + Math.sin(w) * 0.4; p.shR = -0.9 - Math.sin(w) * 0.4; p.elL = p.elR = -1.7; p.shLz = p.shRz = 0.25;
    } else {
      p.shL = -1.4 + Math.sin(w * 2) * 0.15; p.shR = -1.4 - Math.sin(w * 2) * 0.15; p.shLz = p.shRz = -0.15 + b * 0.25; p.elL = p.elR = -0.9;
      p.brz = Math.sin(w) * 0.1; p.hy = Math.sin(w * 0.5) * 0.3;
    }
  } else {
    p.by = Math.sin(t * 2 + c.phase) * 0.006; p.hy = Math.sin(t * 0.45 + c.phase) * 0.18; p.hz = Math.sin(t * 0.7) * 0.03;
    p.shL = Math.sin(t * 1.1) * 0.03; p.shR = -p.shL;
  }
  if (c.waveT > 0) {
    c.waveT -= dt;
    p.shR = -0.2; p.shRz = 2.5; p.elR = -0.5 + Math.sin(t * 12) * 0.45;
  }
  return p;
}
function animateCharacter(c, dt, t, speed) {
  const tgt = poseTarget(c, dt, t, speed);
  const k = 1 - Math.exp(-(c.state === 'sit' ? 8 : 14) * dt);
  for (const key in tgt) c.pose[key] += (tgt[key] - c.pose[key]) * k;
  const p = c.pose, J = c.j;
  J.hipL.rotation.x = p.hipL; J.hipR.rotation.x = p.hipR;
  J.kneeL.rotation.x = p.kneeL; J.kneeR.rotation.x = p.kneeR;
  J.shL.rotation.x = p.shL; J.shR.rotation.x = p.shR;
  J.shL.rotation.z = -p.shLz; J.shR.rotation.z = p.shRz;
  J.elL.rotation.x = p.elL; J.elR.rotation.x = p.elR;
  c.body.position.y = p.by; c.body.rotation.set(p.brx, p.bry, p.brz);
  J.head.rotation.set(p.hx, p.hy, p.hz);
  if (J.skirt) {
    const sb = clamp(-(p.hipL + p.hipR) / 3.0, 0, 1);
    const h0 = J.skirt.geometry.parameters.height, sc = 1 - (h0 > 0.4 ? 0.5 : 0.3) * sb;
    J.skirt.scale.set(1 + 0.12 * sb, sc, 1 + 0.25 * sb);
    J.skirt.position.y = J.skirtTop - (h0 * sc) / 2;
    J.skirt.position.z = 0.05 * sb;
  }
}

// =====================================================================
//  PLAYER / PARTNER STATE
// =====================================================================
let player = null, partner = null, myKind = save.kind || 'boy';
const partnerKind = () => (myKind === 'boy' ? 'girl' : 'boy');
const partnerName = () => (partnerKind() === 'girl' ? CFG.her : CFG.him);
const P = { x: 0, z: 7.5, vx: 0, vz: 0, rot: Math.PI, speed: 0 };
const Q = { x: 1, z: 7.8, rot: Math.PI, speed: 0 }; // partner
const trail = [];
const camState = { yaw: 0, pitch: 0.3, dist: 4.4 };
const keys = new Set();
const joy = { x: 0, y: 0, active: false };
let uiOpen = 0, started = false;
let mode = 'title'; // title | custom | explore | view | sit | dance
const RADIUS = 0.3;
const camPos = new THREE.Vector3(0, 3, 16), camLook = new THREE.Vector3(0, 3, 0);

function rebuildCharacters() {
  if (player) scene.remove(player.group);
  if (partner) scene.remove(partner.group);
  player = makeCharacter(myKind, looks[myKind]);
  partner = makeCharacter(partnerKind(), looks[partnerKind()]);
  scene.add(player.group, partner.group);
  player.group.position.set(P.x, 0, P.z); player.group.rotation.y = P.rot;
  partner.group.position.set(Q.x, 0, Q.z); partner.group.rotation.y = Q.rot;
  $('tag-name').textContent = partnerName();
}

// =====================================================================
//  INPUT
// =====================================================================
addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code === 'Escape') { if (uiOpen) closeTopModal(); else if (mode === 'view') exitView(); else if (mode === 'sit' || mode === 'dance') toExplore(); return; }
  if (!started || uiOpen) return;
  keys.add(e.code);
  const act = e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space';
  if (act) e.preventDefault();
  if (mode === 'explore' && act) interact();
  else if (mode === 'view') {
    if (act) exitView();
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') viewStep(1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') viewStep(-1);
  } else if ((mode === 'sit' || mode === 'dance') && (act || /^(KeyW|KeyS|KeyA|KeyD|Arrow)/.test(e.code))) toExplore();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function getInput() {
  let x = 0, y = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (joy.active) { x += joy.x; y += joy.y; }
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || (joy.active && Math.hypot(joy.x, joy.y) > 0.92);
  return { x, y, run };
}
const look = { id: null, lx: 0, ly: 0, t: 0, moved: 0 };
let customYaw = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (uiOpen || look.id !== null) return;
  look.id = e.pointerId; look.lx = e.clientX; look.ly = e.clientY; look.t = performance.now(); look.moved = 0;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== look.id) return;
  const dx = e.clientX - look.lx, dy = e.clientY - look.ly;
  look.lx = e.clientX; look.ly = e.clientY; look.moved += Math.abs(dx) + Math.abs(dy);
  if (mode === 'custom') { customYaw += dx * 0.01; return; }
  if (mode !== 'explore') return;
  const k = isTouch ? 0.008 : 0.006;
  camState.yaw -= dx * k;
  camState.pitch = clamp(camState.pitch + dy * k * 0.7, -0.05, 1.05);
});
function endLook(e) {
  if (e.pointerId !== look.id) return;
  if (look.moved < 10 && performance.now() - look.t < 450 && started) onTap(e.clientX, e.clientY);
  look.id = null;
}
canvas.addEventListener('pointerup', endLook);
canvas.addEventListener('pointercancel', (e) => { if (e.pointerId === look.id) look.id = null; });
canvas.addEventListener('wheel', (e) => { camState.dist = clamp(camState.dist + e.deltaY * 0.003, 2.2, 7.5); }, { passive: true });
const joyEl = $('joystick'), stick = $('stick');
let joyId = null;
function joyMove(e) {
  const r = joyEl.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const max = r.width / 2 - 10, d = Math.hypot(dx, dy);
  if (d > max) { dx *= max / d; dy *= max / d; }
  stick.style.transform = `translate(${dx}px,${dy}px)`;
  joy.x = dx / max; joy.y = -dy / max;
  if ((mode === 'sit' || mode === 'dance') && d > 20) toExplore();
}
joyEl.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joy.active = true; joyEl.setPointerCapture(e.pointerId); joyMove(e); });
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
const joyEnd = (e) => { if (e.pointerId !== joyId) return; joyId = null; joy.active = false; joy.x = joy.y = 0; stick.style.transform = ''; };
joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
$('action-btn').addEventListener('click', () => { if (mode === 'explore') interact(); else if (mode === 'view') exitView(); else toExplore(); });

function resolve(p, r = RADIUS) {
  const boxes = allBoxes();
  for (let it = 0; it < 3; it++) {
    for (const b of boxes) {
      const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x += (dx / d) * (r - d); p.z += (dz / d) * (r - d); }
      else {
        const l = p.x - b.minX, rr = b.maxX - p.x, n = p.z - b.minZ, f = b.maxZ - p.z, m = Math.min(l, rr, n, f);
        if (m === l) p.x = b.minX - r; else if (m === rr) p.x = b.maxX + r; else if (m === n) p.z = b.minZ - r; else p.z = b.maxZ + r;
      }
    }
  }
}

// =====================================================================
//  SPEECH
// =====================================================================
const LINES = {
  girl: { idle: CFG.herSays && CFG.herSays.length ? CFG.herSays : ['بحبك ❤️'], reveal: ['واااو 😍', 'بتتذكر هاليوم؟ 🥹', 'هي من أحلى صورنا', 'كنت كتير مبسوطة هون'],
    solved: ['شاطر! 💖', 'يا ذكي 😄', 'عرفتها! ❤️'], sit: ['حلو هيك… جنبك ❤️', 'خلينا نتفرج سوا'], dance: ['يلا نرقص 💃', 'هيك أحلى ❤️', 'ما بتعرف ترقص؟ 😂'],
    room: ['يلا نشوف هالقاعة', 'في كمان صور هون 👀', 'شوف شوف! 😍'], view: ['هي حلوة كتير', 'بتتذكر شو صار هون؟', 'كنا صغار 😂', '❤️'], end: ['وصلنا… بحبك ❤️'] },
  boy: { idle: CFG.himSays && CFG.himSays.length ? CFG.himSays : ['بحبك ❤️'], reveal: ['واااو 😍', 'بتتذكري هاليوم؟ 🥹', 'هي من أحلى صورنا', 'كنت كتير مبسوط هون'],
    solved: ['شاطرة! 💖', 'يا ذكية 😄', 'عرفتيها! ❤️'], sit: ['حلو هيك… جنبك ❤️', 'خلينا نتفرج سوا'], dance: ['يلا نرقص 🕺', 'هيك أحلى ❤️', 'عم تدعسي على رجلي 😂'],
    room: ['يلا نشوف هالقاعة', 'في كمان صور هون 👀', 'شوفي شوفي! 😍'], view: ['هي حلوة كتير', 'بتتذكري شو صار هون؟', 'كنا صغار 😂', '❤️'], end: ['وصلنا… بحبك ❤️'] },
};
let bubbleUntil = 0, lastSay = 0, nextIdleSay = 18;
function say(kind, force = false) {
  const now = clock.getElapsed();
  if (!force && now - lastSay < 6) return;
  const arr = LINES[partnerKind()][kind] || LINES[partnerKind()].idle;
  showBubble(pick(arr));
}
function showBubble(text, ms = 3600) {
  const b = $('bubble');
  b.innerHTML = '<div></div>'; b.firstChild.textContent = text;
  b.classList.remove('hidden');
  bubbleUntil = clock.getElapsed() + ms / 1000;
  lastSay = clock.getElapsed();
}
const _v = new THREE.Vector3();
function placeOverlays() {
  const show = started && partner && mode !== 'custom' && !uiOpen;
  const tag = $('tag'), b = $('bubble');
  if (!show) { tag.classList.add('hidden'); b.classList.add('hidden'); return; }
  const yTop = partner.state === 'sit' ? 1.72 : 2.02;
  _v.set(partner.group.position.x, yTop, partner.group.position.z).project(camera);
  const vis = _v.z < 1 && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.2;
  const sx = (_v.x * 0.5 + 0.5) * innerWidth, sy = (-_v.y * 0.5 + 0.5) * innerHeight;
  tag.classList.toggle('hidden', !vis || mode === 'view');
  tag.style.transform = `translate(${sx}px,${sy}px)`;
  const bOn = vis && clock.getElapsed() < bubbleUntil;
  b.classList.toggle('hidden', !bOn);
  b.style.transform = `translate(${sx}px,${sy - 26}px)`;
}

// =====================================================================
//  INTERACTION
// =====================================================================
let currentTarget = null;
function inFront(t, px, pz, min = 0.25) { if (t.nx === undefined) return true; return (px - t.x) * t.nx + (pz - t.z) * t.nz > min; }
function findTarget() {
  let best = null, bs = Infinity;
  const fx = Math.sin(P.rot), fz = Math.cos(P.rot);
  for (const t of INT.targets) {
    const dx = t.x - P.x, dz = t.z - P.z, d = Math.hypot(dx, dz);
    if (d > t.range || !inFront(t, P.x, P.z)) continue;
    const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
    const score = d - facing * 0.9 - (t.kind === 'heartspot' ? 1 : 0);
    if (score < bs) { bs = score; best = t; }
  }
  return best;
}
function promptFor(t) {
  const key = isTouch ? '' : '<kbd>E</kbd>';
  const m = { photo: 'تأمّل الصورة 🖼️', bench: 'اقعدوا سوا 🪑', dedication: 'اقرا الإهداء 💌', heartspot: 'ارقصوا هون 💃' };
  if (t.kind === 'puzzle') return key + (solved.has(t.rec.ex.photo.id) ? 'تأمّل الصورة 🖼️' : 'حِلّ الأحجية 🧩');
  return key + (m[t.kind] || '');
}
function interact(t = currentTarget) {
  if (!t || uiOpen) return;
  if (t.kind === 'photo') enterView(t.rec);
  else if (t.kind === 'puzzle') { if (solved.has(t.rec.ex.photo.id)) enterView(t.rec); else openPuzzle(t.rec); }
  else if (t.kind === 'bench') sitDown(t.bench);
  else if (t.kind === 'dedication') openDedication();
  else if (t.kind === 'heartspot') startDance(true);
}
const raycaster = new THREE.Raycaster();
function onTap(cx, cy) {
  if (mode !== 'explore') return;
  const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([...INT.clickables, ...allWalls()], false);
  if (!hits.length) return;
  const o = hits[0].object;
  if (o.userData.dedication) { if (hits[0].distance < 9) openDedication(); return; }
  if (o.userData.bench) { const b = o.userData.bench; if (Math.hypot(b.x - P.x, b.z - P.z) < 7) sitDown(b); else toast('قرّب أكتر 😉'); return; }
  const rec = o.userData.rec;
  if (!rec) return;
  const t = INT.targets.find((x) => x.rec === rec && x.frame);
  if (Math.hypot(t.x - P.x, t.z - P.z) > 8 || !inFront(t, P.x, P.z, 0)) { toast('قرّب أكتر من اللوحة 😉'); return; }
  interact(t);
}

// ---------------------------------------------------------------- discovery
const nonPuzzleCount = () => EXHIBITS.filter((e) => !e.puzzle).length;
const puzzleCount = () => EXHIBITS.filter((e) => e.puzzle).length;
function updateCounters() {
  const fc = EXHIBITS.filter((e) => !e.puzzle && found.has(e.photo.id)).length;
  const sc = EXHIBITS.filter((e) => e.puzzle && solved.has(e.photo.id)).length;
  $('found-count').textContent = fc; $('found-total').textContent = nonPuzzleCount();
  $('puzzle-count').textContent = sc; $('puzzle-total').textContent = puzzleCount();
  $('puzzle-pill').classList.toggle('hidden', puzzleCount() === 0);
  return { fc, sc };
}
function checkAllDone() {
  const { fc, sc } = updateCounters();
  if (fc === nonPuzzleCount() && sc === puzzleCount()) setTimeout(() => toast('كل الذكريات انكشفت! روحوا لقاعة القلب ❤', 4500), 1200);
}
function revealFrame(rec, quiet) {
  if (rec.revealed || !rec.curtain) return;
  rec.revealed = true;
  found.add(rec.ex.photo.id); persist();
  chime([784, 988, 1175], 0.7, 0.06);
  const { fc } = updateCounters();
  if (!quiet) toast(`💖 ذكرى جديدة! (${fc}/${nonPuzzleCount()})`);
  if (Math.random() < 0.55) say('reveal');
  if (fc === nonPuzzleCount()) checkAllDone();
}
function unlockFrame(rec) {
  const { photo } = rec.ex;
  rec.pic.material.map = photoTex(photo); rec.pic.material.needsUpdate = true;
  rec.plaque.material.map = plaqueTexture(photo.title, photo.date, TH.plaqueDark); rec.plaque.material.needsUpdate = true;
  setGemSolved(rec);
  const fl = addMesh(new THREE.PlaneGeometry(rec.w, rec.h), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, toneMapped: false }), 0, 0, 0.07, rec.group);
  let a = 1;
  INT.updaters.push((dt) => { a -= dt * 1.2; fl.material.opacity = Math.max(0, a); if (a <= 0) { rec.group.remove(fl); return false; } });
}

// =====================================================================
//  MODES: view / sit / dance
// =====================================================================
let viewRec = null, sitBench = null, danceEnding = false;
const stateBtn = (label) => {
  $('state-btn').classList.toggle('hidden', !label);
  if (label) $('state-action').textContent = label;
};
$('state-action').addEventListener('click', () => toExplore());
function toExplore() {
  if (mode === 'view') { exitView(); return; }
  if (mode === 'sit') {
    player.state = partner.state = 'idle';
    const b = sitBench;
    P.x = b.seats[0].x + b.fx * 0.75; P.z = b.seats[0].z + b.fz * 0.75;
    Q.x = b.seats[1].x + b.fx * 0.75; Q.z = b.seats[1].z + b.fz * 0.75;
    camState.yaw = Math.atan2(-b.fx, -b.fz);
    sitBench = null;
  }
  if (mode === 'dance') { player.state = partner.state = 'idle'; MusicBox.fast = false; }
  mode = 'explore'; stateBtn(null);
  $('hud').classList.remove('hidden');
}
function viewables() { return INT.frames.filter((f) => !(f.ex.puzzle && !solved.has(f.ex.photo.id))); }
function placeForView(rec) {
  const { slot } = rec;
  const sx = -slot.nz, sz = slot.nx; // side vector (right of viewer)
  P.x = slot.x + slot.nx * 1.35 + sx * 1.45; P.z = slot.z + slot.nz * 1.35 + sz * 1.45;
  Q.x = slot.x + slot.nx * 1.35 - sx * 1.45; Q.z = slot.z + slot.nz * 1.35 - sz * 1.45;
  const r = Math.atan2(-slot.nx, -slot.nz);
  P.rot = r; Q.rot = r; P.vx = P.vz = 0;
  const pp = { x: P.x, z: P.z }; resolve(pp); P.x = pp.x; P.z = pp.z;
  const qq = { x: Q.x, z: Q.z }; resolve(qq); Q.x = qq.x; Q.z = qq.z;
  trail.length = 0;
}
function enterView(rec) {
  viewRec = rec; mode = 'view';
  revealFrame(rec, true);
  placeForView(rec);
  fillViewCard(rec);
  $('view-ui').classList.remove('hidden');
  $('hud').classList.add('hidden');
  $('prompt').classList.add('hidden');
  setTimeout(() => { if (mode === 'view') say('view'); }, 900);
}
function fillViewCard(rec) {
  const p = rec.ex.photo;
  const list = viewables();
  $('vu-num').textContent = `${list.indexOf(rec) + 1} / ${list.length}`;
  $('vu-title').textContent = p.title || '';
  $('vu-date').textContent = p.date || '';
  $('vu-cap').textContent = p.caption || '';
  $('view-ui').querySelector('.view-card').style.animation = 'none';
  void $('view-ui').offsetWidth;
  $('view-ui').querySelector('.view-card').style.animation = '';
}
function viewStep(d) {
  const list = viewables(); if (!list.length) return;
  const i = list.indexOf(viewRec);
  const rec = list[(i + d + list.length) % list.length];
  viewRec = rec; revealFrame(rec, true); placeForView(rec); fillViewCard(rec);
  player.group.position.set(P.x, 0, P.z); partner.group.position.set(Q.x, 0, Q.z);
}
function exitView() {
  if (mode !== 'view') return;
  const s = viewRec.slot;
  camState.yaw = Math.atan2(s.nx, s.nz) + 0.0;
  camState.pitch = 0.25;
  mode = 'explore'; viewRec = null;
  $('view-ui').classList.add('hidden');
  $('hud').classList.remove('hidden');
}
$('vu-prev').addEventListener('click', () => viewStep(-1));
$('vu-next').addEventListener('click', () => viewStep(1));
$('vu-exit').addEventListener('click', exitView);
$('vu-full').addEventListener('click', () => { if (viewRec) openViewer(viewRec.ex.photo); });

function sitDown(b) {
  sitBench = b; mode = 'sit';
  player.state = partner.state = 'sit';
  P.x = b.seats[0].x; P.z = b.seats[0].z; Q.x = b.seats[1].x; Q.z = b.seats[1].z;
  P.rot = Q.rot = b.rot; P.vx = P.vz = 0;
  trail.length = 0;
  stateBtn('قوموا 🚶');
  $('prompt').classList.add('hidden');
  setTimeout(() => { if (mode === 'sit') say('sit', true); }, 1200);
}
function startDance(ending) {
  mode = 'dance'; danceEnding = !!ending;
  const fx = Math.sin(P.rot), fz = Math.cos(P.rot);
  const rx = Math.cos(P.rot), rz = -Math.sin(P.rot);
  if (ending && heartSpot) { P.x = heartSpot.x - 0.45; P.z = heartSpot.z; Q.x = heartSpot.x + 0.45; Q.z = heartSpot.z; }
  else { Q.x = P.x + rx * 0.9; Q.z = P.z + rz * 0.9; const qq = { x: Q.x, z: Q.z }; resolve(qq); Q.x = qq.x; Q.z = qq.z; }
  P.rot = Math.atan2(Q.x - P.x, Q.z - P.z); Q.rot = P.rot + Math.PI;
  player.state = partner.state = 'dance'; player.danceT = 0; partner.danceT = 0.15;
  P.vx = P.vz = 0; trail.length = 0;
  danceCam = Math.atan2(fx, fz) + Math.PI;
  stateBtn('وقّفوا ✋');
  $('prompt').classList.add('hidden');
  MusicBox.fast = true;
  if (musicOn && !MusicBox.on && !musicFileOK) MusicBox.start();
  say('dance', true);
  if (ending) {
    hearts(30, 1.1);
    chime([523, 659, 784, 1047, 1319], 1.4, 0.07);
    setTimeout(() => { if (mode === 'dance') { say('end', true); openEnding(); } }, 2600);
  }
}
let danceCam = 0;
$('btn-dance').addEventListener('click', () => { if (mode === 'explore') startDance(false); else if (mode === 'dance') toExplore(); });

// =====================================================================
//  MODALS
// =====================================================================
const modalStack = [];
function openModal(id) { $(id).classList.remove('hidden'); modalStack.push(id); uiOpen = modalStack.length; keys.clear(); }
function closeModal(id) { $(id).classList.add('hidden'); const i = modalStack.lastIndexOf(id); if (i >= 0) modalStack.splice(i, 1); uiOpen = modalStack.length; }
function closeTopModal() { if (modalStack.length) closeModal(modalStack[modalStack.length - 1]); }
document.querySelectorAll('.modal').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m) closeModal(m.id); });
  m.querySelectorAll('.close').forEach((b) => b.addEventListener('click', () => closeModal(m.id)));
});
function openViewer(photo) { $('viewer-img').src = photo.src; openModal('viewer'); }
function openDedication() {
  $('ded-title').textContent = DED.title; $('ded-msg').textContent = DED.message; $('ded-sign').textContent = DED.signature;
  if (SINCE) { $('ded-since').textContent = `سوا من ${SINCE.date} لليوم — ${SINCE.span} (${SINCE.days.toLocaleString('en')} يوم) 💞`; $('ded-since').classList.remove('hidden'); }
  openModal('dedication');
}
function openEnding() {
  const { fc, sc } = updateCounters();
  $('ending-title').textContent = CFG.endingTitle;
  $('ending-msg').textContent = CFG.endingMessage || '';
  let stats = `اكتشفتوا ${fc} من ${nonPuzzleCount()} ذكرى`;
  if (puzzleCount()) stats += ` · وحليتوا ${sc} من ${puzzleCount()} أحجية`;
  if (SINCE) stats = `سوا من ${SINCE.short}: ${SINCE.span} ❤\n` + stats;
  $('ending-stats').textContent = stats;
  openModal('ending');
  hearts(36, 1.1);
  save.endingSeen = true; persist();
}
document.querySelector('.close-ending').addEventListener('click', () => closeModal('ending'));
$('btn-help').addEventListener('click', () => openModal('help'));
$('reset-progress').addEventListener('click', () => {
  if (confirm('أكيد بدك تمسح التقدم وتبدأ من الأول؟')) { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); }
});
$('btn-relook').addEventListener('click', () => { closeModal('help'); openCustomize(); });
$('btn-music').addEventListener('click', () => {
  musicOn = !musicOn; save.musicOff = !musicOn; persist();
  $('btn-music').classList.toggle('off', !musicOn);
  if (musicOn) musicPlay(); else musicStop();
});
$('btn-fs').addEventListener('click', fullscreen);
$('btn-fs2').addEventListener('click', fullscreen);

// =====================================================================
//  PUZZLES
// =====================================================================
let puzzleRec = null;
const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
const PUZ_DESC = {
  slide: 'حرّك القطع للمربع الفاضي لترجع الصورة متل ما كانت',
  swap: 'اكبس على قطعتين لتبدّل مكانهن، ورتّب الصورة',
  memory: 'اقلب الكروت ولاقي كل صورتين متشابهين',
  question: 'جاوب صح لتنفتح الصورة',
};
function openPuzzle(rec) {
  puzzleRec = rec;
  const pz = rec.ex.puzzle;
  $('puzzle-title').textContent = pz.title || 'أحجية 🧩';
  $('puzzle-desc').textContent = PUZ_DESC[pz.type];
  $('puzzle-reset').classList.toggle('hidden', pz.type === 'question');
  buildPuzzle();
  openModal('puzzle');
}
function buildPuzzle() {
  const rec = puzzleRec, pz = rec.ex.puzzle, area = $('puzzle-area');
  area.innerHTML = ''; $('puzzle-moves').textContent = '';
  const done = () => puzzleSolved(rec);
  if (pz.type === 'slide') puzzleSlide(area, squareURL(rec.ex.photo), 3, done);
  else if (pz.type === 'swap') puzzleSwap(area, squareURL(rec.ex.photo), 4, done);
  else if (pz.type === 'memory') puzzleMemory(area, rec.ex.photo, done);
  else puzzleQuestion(area, pz, done);
}
$('puzzle-reset').addEventListener('click', buildPuzzle);
function setMoves(n) { $('puzzle-moves').textContent = 'الحركات: ' + n; }
function puzzleSolved(rec) {
  if (solved.has(rec.ex.photo.id)) return;
  solved.add(rec.ex.photo.id); persist();
  el('div', 'solved-msg', $('puzzle-area')).textContent = 'انحلّت! 💖';
  chime([659, 784, 988, 1319], 1.2, 0.08);
  hearts(24);
  setTimeout(() => {
    closeModal('puzzle');
    unlockFrame(rec); updateCounters();
    setTimeout(() => { enterView(rec); say('solved', true); checkAllDone(); }, 600);
  }, 1500);
}
function tileBg(t, url, N) {
  return `background-image:url(${url});background-size:${N * 100}% ${N * 100}%;background-position:${(t % N) / (N - 1) * 100}% ${Math.floor(t / N) / (N - 1) * 100}%;width:${100 / N}%;height:${100 / N}%`;
}
function puzzleSlide(area, url, N, onSolve) {
  const board = el('div', 'board', area);
  const total = N * N, E = total - 1;
  let pos = [], moves = 0, finished = false;
  const nb = (c) => { const r = Math.floor(c / N), k = c % N, o = []; if (r > 0) o.push(c - N); if (r < N - 1) o.push(c + N); if (k > 0) o.push(c - 1); if (k < N - 1) o.push(c + 1); return o; };
  const solvedNow = () => pos.every((c, t) => c === t);
  const tiles = [];
  for (let t = 0; t < total; t++) {
    const d = el('div', 'tile', board);
    d.style.cssText = tileBg(t, url, N);
    if (t === E) d.style.display = 'none';
    d.addEventListener('click', () => {
      if (finished || t === E || !nb(pos[t]).includes(pos[E])) return;
      [pos[t], pos[E]] = [pos[E], pos[t]];
      setMoves(++moves); render();
      if (solvedNow()) { finished = true; tiles[E].style.display = ''; board.classList.add('solved'); onSolve(); }
    });
    tiles.push(d);
  }
  function render() { tiles.forEach((d, t) => { d.style.left = (pos[t] % N) * 100 / N + '%'; d.style.top = Math.floor(pos[t] / N) * 100 / N + '%'; }); }
  do {
    pos = [...Array(total).keys()];
    let prev = -1;
    for (let i = 0; i < 180; i++) { const e = pos[E], opts = nb(e).filter((c) => c !== prev), c = pick(opts); const t = pos.indexOf(c); pos[t] = e; pos[E] = c; prev = e; }
  } while (solvedNow());
  setMoves(0); render();
}
function puzzleSwap(area, url, N, onSolve) {
  const board = el('div', 'board', area);
  const total = N * N;
  let pos = [...Array(total).keys()], sel = -1, moves = 0, finished = false;
  do { for (let i = total - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pos[i], pos[j]] = [pos[j], pos[i]]; } } while (pos.every((c, t) => c === t));
  const tiles = [];
  for (let t = 0; t < total; t++) {
    const d = el('div', 'tile', board);
    d.style.cssText = tileBg(t, url, N);
    d.addEventListener('click', () => {
      if (finished) return;
      if (sel < 0) { sel = t; d.classList.add('sel'); return; }
      tiles[sel].classList.remove('sel');
      if (sel !== t) {
        [pos[sel], pos[t]] = [pos[t], pos[sel]];
        setMoves(++moves); render();
        if (pos.every((c, k) => c === k)) { finished = true; board.classList.add('solved'); onSolve(); }
      }
      sel = -1;
    });
    tiles.push(d);
  }
  function render() { tiles.forEach((d, t) => { d.style.left = (pos[t] % N) * 100 / N + '%'; d.style.top = Math.floor(pos[t] / N) * 100 / N + '%'; }); }
  setMoves(0); render();
}
function puzzleMemory(area, photo, onSolve) {
  const others = PHOTOS.filter((p) => p.id !== photo.id).sort(() => Math.random() - 0.5).slice(0, 6);
  const faces = others.map((p) => squareURL(p, 220));
  const emojis = ['❤', '🌹', '💍', '☕', '🌙', '✈️', '🎶', '🍰'];
  let ei = 0;
  while (faces.length < 6) {
    const e = emojis[ei++];
    faces.push(makeCanvas(220, 220, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ffd1dc'); g.addColorStop(1, '#f28aa5');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.font = '120px "Segoe UI Emoji","Apple Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(e, w / 2, h / 2 + 8);
    }).toDataURL());
  }
  const deck = [...faces.keys(), ...faces.keys()].sort(() => Math.random() - 0.5);
  const grid = el('div', 'mem-grid', area);
  let first = null, lock = false, matched = 0, moves = 0;
  deck.forEach((f) => {
    const card = el('div', 'card', grid);
    const inner = el('div', 'card-in', card);
    el('div', 'card-f', inner).textContent = '♥';
    const b = el('div', 'card-b', inner); b.style.backgroundImage = `url(${faces[f]})`;
    card.dataset.f = f;
    card.addEventListener('click', () => {
      if (lock || card.classList.contains('flip') || card.classList.contains('done')) return;
      card.classList.add('flip');
      if (!first) { first = card; return; }
      setMoves(++moves);
      if (first.dataset.f === card.dataset.f) {
        first.classList.add('done'); card.classList.add('done'); first = null;
        chime([880, 1175], 0.4, 0.05);
        if (++matched === faces.length) onSolve();
      } else {
        lock = true; const a = first; first = null;
        setTimeout(() => { a.classList.remove('flip'); card.classList.remove('flip'); lock = false; }, 850);
      }
    });
  });
  setMoves(0);
}
function puzzleQuestion(area, pz, onSolve) {
  el('div', 'q-text', area).textContent = pz.question;
  const input = el('input', 'q-input', area);
  input.placeholder = 'اكتب الجواب هون…'; input.setAttribute('dir', 'auto');
  const row = el('div', 'q-row', area);
  const ok = el('button', 'btn-primary', row); ok.textContent = 'تأكيد'; ok.style.padding = '10px 30px'; ok.style.fontSize = '17px';
  const hintB = el('button', 'btn-ghost', row); hintB.textContent = 'تلميح 💡';
  if (!pz.hint) hintB.classList.add('hidden');
  const hint = el('div', 'q-hint', area);
  let finished = false;
  const check = () => {
    if (finished) return;
    const v = normalizeAr(input.value); if (!v) return;
    const good = (pz.answers || []).some((a) => { const n = normalizeAr(a); return n && (v === n || (n.length >= 2 && v.includes(n))); });
    if (good) { finished = true; input.disabled = true; input.style.borderColor = '#e85a7a'; onSolve(); }
    else { input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake'); hint.textContent = 'لا… جرّب مرة تانية 😅'; }
  };
  ok.addEventListener('click', check);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
  hintB.addEventListener('click', () => { hint.textContent = '💡 ' + pz.hint; });
  setTimeout(() => input.focus(), 300);
}

// =====================================================================
//  CUSTOMIZE SCREEN
// =====================================================================
let editTab = 'me';
function openCustomize() {
  mode = 'custom';
  $('custom-screen').classList.remove('hidden');
  $('hud').classList.add('hidden');
  $('view-ui').classList.add('hidden');
  ['joystick', 'action-btn'].forEach((id) => $(id).classList.add('hidden'));
  stateBtn(null);
  P.x = -0.5; P.z = 5.2; Q.x = 0.5; Q.z = 5.2; P.rot = Q.rot = 0; customYaw = 0;
  if (player) { player.state = partner.state = 'idle'; }
  renderCustom();
}
function renderCustom() {
  $('who-boy').textContent = 'أنا ' + CFG.him; $('who-girl').textContent = 'أنا ' + CFG.her;
  document.querySelectorAll('#who-seg button').forEach((b) => b.classList.toggle('on', b.dataset.kind === myKind));
  document.querySelectorAll('#theme-seg button').forEach((b) => b.classList.toggle('on', b.dataset.theme === themeName));
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === editTab));
  $('tab-partner').textContent = 'شكل ' + partnerName();
  const kind = editTab === 'me' ? myKind : partnerKind();
  const L = looks[kind];
  const box = $('opts'); box.innerHTML = '';
  const row = (label, build) => { el('div', 'row-label', box).textContent = label; build(el('div', '', box)); };
  const sw = (wrap, list, key, isIdx) => {
    wrap.className = 'swatches';
    list.forEach((c, i) => {
      const b = el('button', 'sw', wrap); b.style.background = c;
      if ((isIdx ? i : c) === L[key]) b.classList.add('on');
      b.addEventListener('click', () => { L[key] = isIdx ? i : c; lookChanged(); });
    });
  };
  const chips = (wrap, list, key) => {
    wrap.className = 'chips';
    list.forEach(([v, name]) => {
      const b = el('button', 'chip', wrap); b.textContent = name;
      if (L[key] === v) b.classList.add('on');
      b.addEventListener('click', () => { L[key] = v; lookChanged(); });
    });
  };
  const O = LOOK_OPTS[kind];
  if (!O.hair.find((h) => h[0] === L.hair)) L.hair = O.hair[0][0];
  if (!O.outfit.find((h) => h[0] === L.outfit)) L.outfit = O.outfit[0][0];
  row('لون البشرة', (w) => sw(w, SKINS, 'skin', true));
  row('الشعر', (w) => chips(w, O.hair, 'hair'));
  row('لون الشعر', (w) => sw(w, HAIRS, 'hairColor'));
  row('اللبس', (w) => chips(w, O.outfit, 'outfit'));
  const lbl = { vest: ['لون الصدرية', 'لون البنطلون'], tee: ['لون التيشيرت', 'لون البنطلون'], hoodie: ['لون الهودي', 'لون البنطلون'],
    dress: ['لون الفستان', 'لون الشوز والزنّار'], blouse: ['لون البلوزة', 'لون البنطلون'], skirt: ['لون البلوزة', 'لون التنورة'] }[L.outfit];
  row(lbl[0], (w) => sw(w, CLOTH, 'top'));
  row(lbl[1], (w) => sw(w, CLOTH, 'bottom'));
}
function lookChanged() { save.looks = looks; persist(); rebuildCharacters(); renderCustom(); }
document.querySelectorAll('#who-seg button').forEach((b) => b.addEventListener('click', () => {
  myKind = b.dataset.kind; save.kind = myKind; persist(); rebuildCharacters(); renderCustom();
}));
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => { editTab = b.dataset.tab; renderCustom(); }));
document.querySelectorAll('#theme-seg button').forEach((b) => b.addEventListener('click', () => {
  if (themeName === b.dataset.theme) return;
  themeName = b.dataset.theme; save.theme = themeName; persist();
  rebuildInterior(); renderCustom();
  toast(themeName === 'modern' ? 'متحف عصري ◻︎' : 'متحف كلاسيكي ♛');
}));
$('btn-go').addEventListener('click', () => {
  $('custom-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  if (isTouch) { $('joystick').classList.remove('hidden'); $('action-btn').classList.remove('hidden'); }
  mode = 'explore'; started = true;
  P.x = -0.5; P.z = 6.2; Q.x = 0.6; Q.z = 6.5; P.rot = Q.rot = Math.PI; P.vx = P.vz = 0;
  camState.yaw = 0; camState.pitch = 0.28; camState.dist = innerWidth < 700 ? 5.4 : 4.6;
  trail.length = 0;
  updateCounters();
  musicPlay();
  chime([523, 659, 784], 1, 0.05);
  const first = PHOTOS.some((p) => p.placeholder) ? 'هي صور تجريبية — حط صوركن بمجلد photos وحدّث الصفحة' : 'امشوا لجوّا… الباب عم ينفتح ❤';
  setTimeout(() => toast(first, 4200), 600);
  setTimeout(() => { partner.waveT = 1.6; showBubble(LINES[partnerKind()].idle[0]); }, 1400);
});

// =====================================================================
//  MAIN LOOP
// =====================================================================
const clock = new THREE.Timer();
const camTarget = new THREE.Vector3(), camWanted = new THREE.Vector3(), camDir = new THREE.Vector3(), lookWanted = new THREE.Vector3();
let lastRoom = -2;
function roomIndex(z) { return z > 0.3 ? -1 : clamp(Math.floor(-z / D), 0, FINAL); }
function roomName(i) { return i < 0 ? 'برّا المتحف' : i === FINAL ? 'قاعة القلب ❤' : 'القاعة ' + (i + 1); }
const fogCol = new THREE.Color(), fogOut = new THREE.Color(0xf3dcd6);

function updatePlayer(dt) {
  const inp = uiOpen || mode !== 'explore' ? { x: 0, y: 0, run: false } : getInput();
  const fx = -Math.sin(camState.yaw), fz = -Math.cos(camState.yaw);
  const rx = Math.cos(camState.yaw), rz = -Math.sin(camState.yaw);
  let mx = rx * inp.x + fx * inp.y, mz = rz * inp.x + fz * inp.y;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  const sp = inp.run ? 4.8 : 2.6;
  const k = 1 - Math.exp(-10 * dt);
  P.vx += (mx * sp - P.vx) * k; P.vz += (mz * sp - P.vz) * k;
  if (mode === 'explore') {
    const np = { x: P.x + P.vx * dt, z: P.z + P.vz * dt };
    resolve(np);
    P.speed = Math.hypot(np.x - P.x, np.z - P.z) / Math.max(dt, 1e-4);
    P.x = np.x; P.z = np.z;
    if (ml > 0.1) P.rot = lerpAngle(P.rot, Math.atan2(mx, mz), 1 - Math.exp(-12 * dt));
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(last.x - P.x, last.z - P.z) > 0.2) { trail.push({ x: P.x, z: P.z }); if (trail.length > 300) trail.shift(); }
  } else P.speed = 0;
  const g = player.group;
  if (mode === 'view' || mode === 'sit' || mode === 'dance') {
    g.position.x += (P.x - g.position.x) * (1 - Math.exp(-10 * dt));
    g.position.z += (P.z - g.position.z) * (1 - Math.exp(-10 * dt));
  } else g.position.set(P.x, 0, P.z);
  g.rotation.y = lerpAngle(g.rotation.y, P.rot, 1 - Math.exp(-12 * dt));
  if (mode === 'explore') g.rotation.y = P.rot;
  player.state = mode === 'sit' ? 'sit' : mode === 'dance' ? 'dance' : 'idle';
}
function updatePartner(dt, t) {
  const g = partner.group;
  let moving = 0;
  if (mode === 'explore') {
    // walk beside the player: a point ~0.9m back on the trail, shifted to the player's right
    let base = null, acc = 0;
    for (let i = trail.length - 1; i > 0; i--) {
      acc += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].z - trail[i - 1].z);
      if (acc >= 0.55) { base = trail[i - 1]; break; }
    }
    if (!base) base = { x: P.x - Math.sin(P.rot) * 0.6, z: P.z - Math.cos(P.rot) * 0.6 };
    const tt = { x: base.x + Math.cos(P.rot) * 0.85, z: base.z - Math.sin(P.rot) * 0.85 };
    resolve(tt, 0.26);
    const dP = Math.hypot(P.x - Q.x, P.z - Q.z);
    if (dP > 9) { Q.x = tt.x; Q.z = tt.z; }
    const dx = tt.x - Q.x, dz = tt.z - Q.z, d = Math.hypot(dx, dz);
    if (d > 0.14) {
      const sp = Math.min(Math.max(P.speed, 2.2) * 1.15, d * 3.5);
      const np = { x: Q.x + (dx / d) * sp * dt, z: Q.z + (dz / d) * sp * dt };
      resolve(np, 0.26);
      const pd = Math.hypot(np.x - P.x, np.z - P.z);
      if (pd < 0.62) { np.x = P.x + (np.x - P.x) / Math.max(pd, 0.01) * 0.62; np.z = P.z + (np.z - P.z) / Math.max(pd, 0.01) * 0.62; }
      moving = Math.hypot(np.x - Q.x, np.z - Q.z) / Math.max(dt, 1e-4);
      Q.x = np.x; Q.z = np.z;
      if (moving > 0.3) Q.rot = lerpAngle(Q.rot, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
    }
    if (moving <= 0.3) {
      const toP = Math.atan2(P.x - Q.x, P.z - Q.z);
      Q.rot = lerpAngle(Q.rot, P.speed < 0.1 && Math.sin(t * 0.25) > 0.4 ? toP : P.rot, 1 - Math.exp(-4 * dt));
    }
    Q.speed = moving;
    g.position.set(Q.x, 0, Q.z);
    g.rotation.y = Q.rot;
  } else {
    g.position.x += (Q.x - g.position.x) * (1 - Math.exp(-10 * dt));
    g.position.z += (Q.z - g.position.z) * (1 - Math.exp(-10 * dt));
    g.rotation.y = lerpAngle(g.rotation.y, Q.rot, 1 - Math.exp(-10 * dt));
  }
  partner.state = mode === 'sit' ? 'sit' : mode === 'dance' ? 'dance' : 'idle';
  animateCharacter(partner, dt, t, mode === 'explore' ? moving : 0);
  if (mode === 'explore' && t > nextIdleSay) { nextIdleSay = t + 25 + Math.random() * 20; say('idle'); }
}
function updateCamera(dt, t) {
  let k = 1 - Math.exp(-8 * dt);
  if (mode === 'title') {
    const a = t * 0.1;
    camWanted.set(Math.sin(a) * 9, 3.2 + Math.sin(t * 0.2) * 0.4, 15 + Math.cos(a) * 2);
    lookWanted.set(0, 4.2, 1);
    k = 1 - Math.exp(-2 * dt);
  } else if (mode === 'custom') {
    const narrow = innerWidth < 700;
    const cx = Math.sin(customYaw) * 3.4, cz = Math.cos(customYaw) * 3.4;
    camWanted.set(cx + (narrow ? 0 : 0.9 * Math.cos(customYaw)), narrow ? 1.5 : 1.35, 5.2 + cz);
    lookWanted.set(narrow ? 0 : 0.9 * Math.cos(customYaw), narrow ? 0.75 : 1.05, 5.2);
    if (narrow) camWanted.y = 1.9;
    k = 1 - Math.exp(-6 * dt);
  } else if (mode === 'view' && viewRec) {
    const r = viewRec, s = r.slot;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const needH = (r.OH + 0.5) / (2 * Math.tan(fov / 2));
    const needW = (r.OW + 0.5) / (2 * Math.tan(fov / 2) * camera.aspect);
    const dist = clamp(Math.max(needH, needW) * (innerWidth < 700 ? 1.0 : 1.12), 1.2, 7);
    const shift = innerWidth >= 700 ? 0.0 : -0.35;
    camWanted.set(s.x + s.nx * dist, r.cy + shift * 0.4 - 0.05, s.z + s.nz * dist);
    lookWanted.set(s.x, r.cy - 0.05 + shift * 0.4, s.z);
    k = 1 - Math.exp(-5 * dt);
  } else if (mode === 'sit' && sitBench) {
    const b = sitBench, mx = (b.seats[0].x + b.seats[1].x) / 2, mz = (b.seats[0].z + b.seats[1].z) / 2;
    camWanted.set(mx - b.fx * 3.3, 2.35, mz - b.fz * 3.3);
    lookWanted.set(mx + b.fx * 4, 1.85, mz + b.fz * 4);
    k = 1 - Math.exp(-3 * dt);
  } else if (mode === 'dance') {
    danceCam += dt * 0.32;
    const mx = (P.x + Q.x) / 2, mz = (P.z + Q.z) / 2;
    camWanted.set(mx + Math.sin(danceCam) * 3.4, 1.8, mz + Math.cos(danceCam) * 3.4);
    lookWanted.set(mx, 1.05, mz);
    const pp = { x: camWanted.x, z: camWanted.z }; resolve(pp, 0.4); camWanted.x = pp.x; camWanted.z = pp.z;
    k = 1 - Math.exp(-3 * dt);
  } else {
    camTarget.set(P.x, 1.45, P.z);
    const cp = Math.cos(camState.pitch);
    camDir.set(Math.sin(camState.yaw) * cp, Math.sin(camState.pitch), Math.cos(camState.yaw) * cp).normalize();
    let dist = camState.dist;
    raycaster.set(camTarget, camDir); raycaster.far = dist + 0.3;
    const hit = raycaster.intersectObjects(allWalls(), false)[0];
    raycaster.far = Infinity;
    if (hit) dist = Math.max(0.6, hit.distance - 0.3);
    camWanted.copy(camTarget).addScaledVector(camDir, dist);
    if (P.z < 0.4) camWanted.y = Math.min(camWanted.y, H - 0.25);
    lookWanted.copy(camTarget);
    k = 1 - Math.exp(-14 * dt);
  }
  camPos.lerp(camWanted, k);
  camLook.lerp(lookWanted, mode === 'explore' ? 1 : k);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}
function updateWorld(dt, t) {
  // frames: curtains + gems
  for (const f of INT.frames) {
    if (f.curtain && !f.revealed && mode === 'explore') {
      const d = Math.hypot(f.wx - P.x, f.wz - P.z);
      if (d < 4.6 && (P.x - f.wx) * f.slot.nx + (P.z - f.wz) * f.slot.nz > 0.4) revealFrame(f);
    }
    if (f.curtain && f.revealed && f.curtainT < 1) { f.curtainT = Math.min(1, f.curtainT + dt / 1.3); setCurtain(f); }
    if (f.gem) { f.gem.rotation.y += dt * 1.4; f.gem.position.y = 1.42 + Math.sin(t * 2 + f.wx) * 0.05; }
  }
  // heart spot auto-trigger
  if (mode === 'explore' && heartSpot && Math.hypot(P.x - heartSpot.x, P.z - heartSpot.z) < 0.9 && !save.endingSeen && !uiOpen) startDance(true);
  // prompts
  const tgt = (mode === 'explore' && !uiOpen) ? findTarget() : null;
  if (tgt !== currentTarget) {
    currentTarget = tgt;
    const pr = $('prompt');
    if (tgt) { pr.innerHTML = promptFor(tgt); pr.classList.remove('hidden'); } else pr.classList.add('hidden');
    $('action-btn').classList.toggle('active', !!tgt);
  }
  const ri = roomIndex(P.z);
  if (ri !== lastRoom && started) {
    if (lastRoom !== -2 && ri > lastRoom && ri >= 0 && mode === 'explore') say(ri === FINAL ? 'end' : 'room');
    lastRoom = ri; $('room-name').textContent = roomName(ri);
  }
  // fog & sun follow
  const outside = (mode === 'title' || mode === 'custom') ? 1 : clamp((P.z - 0.2) / 2.5, 0, 1);
  fogCol.set(TH.fog).lerp(fogOut, outside);
  scene.fog.color.copy(fogCol);
  scene.fog.near = THREE.MathUtils.lerp(TH.fogNear, 30, outside);
  scene.fog.far = THREE.MathUtils.lerp(TH.fogFar, 90, outside);
  hemi.intensity = THREE.MathUtils.lerp(TH.hemi, 1.2, outside);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(TH.exposure, 1.05, outside);
  const fx = player ? player.group.position.x : 0, fz = player ? player.group.position.z : 5;
  sun.position.set(fx + 3.5, 11, fz + 5); sun.target.position.set(fx, 0, fz);
  updateDoors(dt);
}

let fpsN = 0, fpsC = 0, fpsT = 0;
function tick() {
  requestAnimationFrame(tick);
  fpsC++; if (performance.now() - fpsT > 1000) { fpsN = fpsC; fpsC = 0; fpsT = performance.now(); }
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsed() + simExtra;
  frame(dt, t);
  renderer.render(scene, camera);
}
let simExtra = 0;
function simulate(sec) { const n = Math.round(sec * 30); for (let i = 0; i < n; i++) { simExtra += 1 / 30; frame(1 / 30, clock.getElapsed() + simExtra); } }
function frame(dt, t) {
  if (player && partner) {
    if (mode === 'custom' || mode === 'title') {
      player.group.position.set(P.x, 0, P.z); partner.group.position.set(Q.x, 0, Q.z);
      player.group.rotation.y = P.rot + Math.sin(t * 0.5) * 0.15; partner.group.rotation.y = Q.rot - Math.sin(t * 0.5) * 0.15;
      animateCharacter(player, dt, t, 0); animateCharacter(partner, dt, t, 0);
      if (mode === 'custom' && Math.random() < dt * 0.12) (Math.random() < 0.5 ? player : partner).waveT = 1.4;
    } else {
      updatePlayer(dt);
      animateCharacter(player, dt, t, P.speed);
      updatePartner(dt, t);
    }
  }
  updateWorld(dt, t);
  updateCamera(dt, t);
  for (const ctx of [EXT, INT]) for (let i = ctx.updaters.length - 1; i >= 0; i--) if (ctx.updaters[i](dt, t) === false) ctx.updaters.splice(i, 1);
  placeOverlays();
}

// =====================================================================
//  INIT
// =====================================================================
async function waitFonts() {
  try {
    await Promise.race([
      Promise.all(['700 40px Amiri', '400 40px Amiri', '700 40px Tajawal', '500 40px Tajawal', '400 40px Tajawal'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) {}
}
async function init() {
  document.title = CFG.title;
  $('title').textContent = CFG.title;
  $('t-from').textContent = CFG.him; $('t-to').textContent = CFG.her;
  if (SINCE) { const ts = $('t-since'); ts.innerHTML = `سوا من ${SINCE.short} · <b>${SINCE.days.toLocaleString('en')}</b> يوم ❤`; ts.classList.remove('hidden'); }
  $('btn-music').classList.toggle('off', !musicOn);
  initTextures(); initMaterials();
  P.x = -0.5; P.z = 5.2; Q.x = 0.5; Q.z = 5.2; P.rot = Q.rot = 0;
  tick();
  const bar = document.querySelector('.loading .bar i');
  const [photos] = await Promise.all([loadPhotos((p) => { bar.style.width = Math.round(p * 100) + '%'; }), waitFonts()]);
  PHOTOS = photos;
  EXHIBITS = planExhibits(photos);
  buildExterior();
  rebuildInterior();
  rebuildCharacters();
  $('loading').classList.add('hidden');
  $('btn-start').disabled = false;
  window.__museum = { simulate, fps: () => fpsN, P, Q, camState, INT, EXHIBITS, enterView, openPuzzle, sitDown, startDance, get mode() { return mode; } };
}
$('btn-start').addEventListener('click', () => {
  audio();
  $('title-screen').classList.add('fade');
  setTimeout(() => $('title-screen').classList.add('hidden'), 900);
  openCustomize();
});
init();
