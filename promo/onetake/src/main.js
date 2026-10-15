import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import helvBold from 'three/examples/fonts/helvetiker_bold.typeface.json';
import COPY from '../strings.json';

const OM = window.OM, LOOK = window.LOOK;
const { clamp, lerp, seg, sstep, ease } = OM;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const W = 1920, H = 1080, DUR = 43.5, FPS = 30;

// ── timeline ────────────────────────────────────────────────────────────────────────────────────────────────────────
const T = {
  flapA: 1.15, flapB: 1.45, billUp: [1.5, 2.4],
  click: 8.0, word: 8.1, tick1: 12.4, tick2: 13.4,
  m1: [14.6, 16.9], snap: 16.4, ripple: 17.45, hang: 20.0,
  fly: 21.0, heroGo: 25.55, youHit: 27.3, m2: [27.9, 29.65], dropB: [29.55, 30.05],
  trophy: 31.6, trophyLand: 31.92, lidB: 34.55, trophyUp: [34.7, 35.7],
  card: 37.7, m3: [39.1, 43.5],
};
const RESTS = [[0, 1.3], [8.95, 9.8], [12.35, 14.3], [20.0, 21.0], [32.6, 34.55], [40.4, DUR]];
const SHAKES = [[8.12, 3, 9], [27.3, 11, 8], [31.92, 6, 9]];
const C = LOOK.color;
const ACE_BLUE = C.accent2;

// ── renderer, scene ─────────────────────────────────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.ground);
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(35, W / H, 0.001, 80);

scene.add(new THREE.HemisphereLight(0xfffaf2, 0xd8d0c2, 1.15));
const key = new THREE.DirectionalLight(0xffffff, 2.3);
key.position.set(2.6, 5.2, 3.4); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2, near: 0.5, far: 14 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.004;
scene.add(key);
const fill = new THREE.DirectionalLight(0xfff1dc, 0.5); fill.position.set(-4, 2.5, 2); scene.add(fill);

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.62, ...o });
const mat = {
  ground: M(C.ground, { roughness: 0.9 }), deep: M(C.deep, { roughness: 0.85 }), card: M(C.card, { roughness: 0.5 }),
  line: M(C.line), ink: M(C.ink, { roughness: 0.45 }), mute: M(C.mute), accent: M(C.accent, { roughness: 0.48 }),
  blue: M(ACE_BLUE, { roughness: 0.4 }), paper: M('#f7f1e4', { roughness: 0.8 }),
  paperIn: M('#e8dcc6', { roughness: 0.85, side: THREE.DoubleSide }), panel: M(C.card, { roughness: 0.5, side: THREE.DoubleSide }),
  gold: new THREE.MeshStandardMaterial({ color: '#ffcf5c', metalness: 0.85, roughness: 0.25, envMap: env, envMapIntensity: 2.6, emissive: '#5a3a00', emissiveIntensity: 0.35 }),
  skin: M('#e9d3bd'), shirts: ['#d5d0c6', '#c8d3e6', '#e6d4c8', '#cfdccf', '#e2ddd2', '#d8cfe4'].map((c) => M(c)),
};
const shadowy = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const box = (w, h, d, m, r = 0.004) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1)), m);
const place = (o, x, y, z, parent) => { o.position.set(x, y, z); (parent || scene).add(o); return o; };

function canvasTex(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, g: cv.getContext('2d'), tex, key: '' };
}
const font3d = new Font(helvBold);
function text3d(str, size, depth, m) {
  const geo = new TextGeometry(str, { font: font3d, size, height: depth, curveSegments: 8, bevelEnabled: true, bevelThickness: depth * 0.25, bevelSize: size * 0.03, bevelSegments: 3 });
  geo.computeBoundingBox(); geo.center(); return new THREE.Mesh(geo, m);
}

// ── the desk and the diorama ────────────────────────────────────────────────────────────────────────────────────────
const desk = place(new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat.ground), 0, 0, 0); desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true;
const floorTex = canvasTex(1024, 832);
{ const { g, cv } = floorTex; g.fillStyle = C.deep; g.fillRect(0, 0, cv.width, cv.height); g.strokeStyle = C.line; g.lineWidth = 2;
  for (let x = 0; x <= cv.width; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, cv.height); g.stroke(); }
  for (let y = 0; y <= cv.height; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(cv.width, y); g.stroke(); } floorTex.tex.needsUpdate = true; }
const base = shadowy(place(box(4.2, 0.06, 3.4, [mat.deep, mat.deep, new THREE.MeshStandardMaterial({ map: floorTex.tex, roughness: 0.85 }), mat.deep, mat.deep, mat.deep], 0.02), 0, 0.03, 0.1));
const FLOOR = 0.06;

// stage, projector, presenter, podium + laptop
shadowy(place(box(3.0, 0.12, 0.72, mat.card, 0.01), 0, FLOOR + 0.06, -1.3));
const STAGE = FLOOR + 0.12;
shadowy(place(box(1.74, 1.0, 0.03, mat.ink, 0.01), 0, 0.86, -1.64));
const projTex = canvasTex(2048, 1152);
const projector = place(new THREE.Mesh(new THREE.PlaneGeometry(1.64, 0.92), new THREE.MeshBasicMaterial({ map: projTex.tex, toneMapped: false })), 0, 0.86, -1.62);
[-0.7, 0.7].forEach((x) => shadowy(place(box(0.03, 0.4, 0.03, mat.ink), x, STAGE + 0.14, -1.64)));

function person({ shirt, head = mat.skin, scale = 1 }) {
  const p = new THREE.Group();
  const body = place(box(0.13, 0.15, 0.085, shirt, 0.012), 0, 0.235, 0, p);
  const hd = place(box(0.1, 0.1, 0.1, head, 0.018), 0, 0.37, 0, p);
  const armL = new THREE.Group(), armR = new THREE.Group();
  place(armL, -0.075, 0.29, 0, p); place(armR, 0.075, 0.29, 0, p);
  place(box(0.035, 0.035, 0.11, shirt, 0.008), 0, -0.02, -0.05, armL);
  place(box(0.035, 0.035, 0.11, shirt, 0.008), 0, -0.02, -0.05, armR);
  p.scale.setScalar(scale);
  return Object.assign(shadowy(p), { body, hd, armL, armR });
}
const presenter = person({ shirt: mat.ink });
place(presenter, -0.5, STAGE - 0.08, -1.22); presenter.rotation.y = 0;
[-0.035, 0.035].forEach((x) => shadowy(place(box(0.045, 0.16, 0.06, mat.ink), x, 0.08, 0, presenter)));
presenter.body.position.y = 0.235; presenter.position.y = STAGE - 0.0;
const clicker = place(box(0.02, 0.012, 0.04, mat.blue), 0, -0.03, -0.11, presenter.armR);

const podium = shadowy(place(box(0.22, 0.26, 0.15, mat.card, 0.01), 0.42, STAGE + 0.13, -1.2));
const PODTOP = STAGE + 0.26;
const laptop = new THREE.Group(); place(laptop, 0.42, PODTOP, -1.2);
shadowy(place(box(0.17, 0.008, 0.11, mat.mute, 0.003), 0, 0.004, 0, laptop));
const lid = new THREE.Group(); place(lid, 0, 0.008, -0.055, laptop); lid.rotation.x = -0.18;
shadowy(place(box(0.17, 0.11, 0.006, mat.mute, 0.003), 0, 0.055, 0, lid));
const lapTex = canvasTex(1024, 640);
const lapScreen = place(new THREE.Mesh(new THREE.PlaneGeometry(0.158, 0.098), new THREE.MeshBasicMaterial({ map: lapTex.tex, toneMapped: false })), 0, 0.055, 0.0032, lid);

// boxes on a table in front of the stage
const TABLE_Z = -0.78, TABLE_TOP = 0.25;
shadowy(place(box(1.4, 0.02, 0.24, mat.card, 0.006), 0, TABLE_TOP - 0.01, TABLE_Z));
[[-0.66, -0.09], [0.66, -0.09], [-0.66, 0.09], [0.66, 0.09]].forEach(([x, z]) => shadowy(place(box(0.02, TABLE_TOP - FLOOR - 0.02, 0.02, mat.card), x, (TABLE_TOP + FLOOR) / 2 - 0.01, TABLE_Z + z)));
const BOX = 0.13, BOX_X = [-0.48, -0.16, 0.16, 0.48];
function labelTex(txt, color, w = 512, h = 512) {
  const t = canvasTex(w, h); const { g } = t;
  g.fillStyle = C.card; g.fillRect(0, 0, w, h); g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = LOOK.font('display', txt.length > 1 ? 170 : 300); g.fillText(txt, w / 2, h / 2 + 10); t.tex.needsUpdate = true; return t.tex;
}
function makeBallot(i) {
  const b = new THREE.Group(), h = BOX / 2, th = 0.003, isYou = i === 3;
  const wall = (w, hh, d, x, y, z) => place(new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), mat.panel), x, y, z, b);
  wall(BOX, th, BOX, 0, -h, 0);
  wall(th, BOX, BOX, -h, 0, 0); wall(th, BOX, BOX, h, 0, 0);
  wall(BOX, BOX, th, 0, 0, -h);
  const front = place(new THREE.Mesh(new THREE.BoxGeometry(BOX, BOX, th), [mat.panel, mat.panel, mat.panel, mat.panel, new THREE.MeshStandardMaterial({ map: labelTex(COPY.boxes[i], isYou ? C.ink : ACE_BLUE), roughness: 0.5 }), mat.panel]), 0, 0, h, b);
  const lidA = new THREE.Group(), lidB = new THREE.Group();
  place(lidA, 0, h, -h, b); place(lidB, 0, h, h, b);
  const half = (BOX - 0.014) / 2;
  place(new THREE.Mesh(new THREE.BoxGeometry(BOX, th, half), mat.panel), 0, 0, half / 2, lidA);
  place(new THREE.Mesh(new THREE.BoxGeometry(BOX, th, half), mat.panel), 0, 0, -half / 2, lidB);
  const slotEdge = new THREE.Group(); place(slotEdge, 0, h + 0.0015, 0, b);
  [-0.0085, 0.0085].forEach((z) => place(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.002, 0.003), isYou ? mat.ink : mat.blue), 0, 0, z, slotEdge));
  place(b, BOX_X[i], TABLE_TOP + h, TABLE_Z);
  return Object.assign(shadowy(b), { lidA, lidB, front, slotEdge, isYou });
}
const ballots = [0, 1, 2, 3].map(makeBallot);
const youShut = place(new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.004, 0.02), mat.accent), 0, BOX / 2 + 0.002, 0, ballots[3]);

// inside box B: a pile of bills, the trophy, a warm light
const billTex = canvasTex(2048, 1260);
{ const { g, cv } = billTex, w = cv.width, h = cv.height;
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#eaf1e4'); bg.addColorStop(1, '#cfe0c6'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(47,74,42,0.55)'; g.lineWidth = 12; g.strokeRect(40, 40, w - 80, h - 80);
  g.strokeStyle = 'rgba(47,74,42,0.16)'; g.lineWidth = 4; for (let r = 90; r < 560; r += 34) { g.beginPath(); g.arc(w * 0.5, h * 0.5, r, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = '#2f4a2a'; g.font = LOOK.font('display', 92); g.fillText('ACE CLUB', 110, 190); g.font = LOOK.font('mono', 70); g.fillText(COPY.bill, 110, h - 110);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = LOOK.font('display', 820); g.fillText('?', w * 0.5, h * 0.53);
  g.font = '230px sans-serif'; g.textAlign = 'right'; g.fillText('♠', w - 110, h - 90); billTex.tex.needsUpdate = true; }
const billMat = new THREE.MeshStandardMaterial({ map: billTex.tex, roughness: 0.7, side: THREE.DoubleSide });
const BILL = [0.078, 0.048];
const makeBill = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(BILL[0], BILL[1]), billMat); m.castShadow = true; return m; };
const pileGroup = place(new THREE.Group(), 0, -BOX / 2 + 0.002, 0, ballots[1]);
{ const r = OM.rng(17); for (let i = 0; i < 26; i++) { const m = makeBill(); m.scale.setScalar(0.62); m.rotation.set(-Math.PI / 2 + (r() - 0.5) * 0.3, 0, r() * Math.PI * 2); place(m, (r() - 0.5) * 0.07, 0.002 + i * 0.0006, (r() - 0.5) * 0.07, pileGroup); } }
const vaultLight = place(new THREE.PointLight(0xffd27a, 0, 0.25, 1.5), 0, 0.03, 0.02, ballots[1]);
const trophy = new THREE.Group(); place(trophy, 0, -BOX / 2 + 0.02, 0, ballots[1]);
const one = text3d('#1', 0.02, 0.007, mat.gold); one.position.y = 0.026; trophy.add(one);
place(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.023, 0.012, 40), mat.ink), 0, 0.008, 0, trophy);
const plateTex = canvasTex(1024, 300);
{ const { g, cv } = plateTex; g.fillStyle = C.ink; g.fillRect(0, 0, cv.width, cv.height); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#f5e2b0'; g.font = LOOK.font("display", 88); g.fillText(COPY.plateTop, cv.width / 2, 110); g.fillStyle = '#c9b98d'; g.font = LOOK.font('mono', 62); g.fillText(COPY.plateSub, cv.width / 2, 225); plateTex.tex.needsUpdate = true; }
const plate = place(new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.0129), new THREE.MeshBasicMaterial({ map: plateTex.tex, toneMapped: false })), 0, 0.009, 0.0242, trophy);
shadowy(trophy);

// ── the audience: every student holds an envelope ───────────────────────────────────────────────────────────────────
const ENV = { w: 0.085, h: 0.055, d: 0.03 };
function makeEnvelope() {
  const e = new THREE.Group(), { w, h, d } = ENV, th = 0.0015;
  place(new THREE.Mesh(new THREE.BoxGeometry(w, h, th), mat.paperIn), 0, 0, -d / 2, e);
  place(new THREE.Mesh(new THREE.BoxGeometry(w, h, th), [mat.paper, mat.paper, mat.paper, mat.paper, mat.paper, mat.paperIn]), 0, 0, d / 2, e);
  place(new THREE.Mesh(new THREE.BoxGeometry(th, h, d), mat.paperIn), -w / 2, 0, 0, e);
  place(new THREE.Mesh(new THREE.BoxGeometry(th, h, d), mat.paperIn), w / 2, 0, 0, e);
  place(new THREE.Mesh(new THREE.BoxGeometry(w, th, d), mat.paperIn), 0, -h / 2, 0, e);
  const flap = new THREE.Group(); place(flap, 0, h / 2, -d / 2, e);
  place(new THREE.Mesh(new THREE.BoxGeometry(w, th, d), mat.paper), 0, 0, d / 2, flap);
  const tipPivot = new THREE.Group(); place(tipPivot, 0, 0, d, flap);
  const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, -h * 0.62); tri.closePath();
  const tip = place(new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: th, bevelEnabled: false }), mat.paper), 0, 0, 0, tipPivot);
  const seal = place(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.003, 24), mat.blue), 0, -h * 0.5, th + 0.0015, tipPivot);
  seal.rotation.x = Math.PI / 2;
  const bill = makeBill(); place(bill, 0, -0.002, -d / 2 + 0.004, e);
  return Object.assign(shadowy(e), { flap, tipPivot, bill, seal });
}
const ROWS = [-0.22, 0.24, 0.7, 1.16], SEATS = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0];
const students = [];
{ let n = 0; for (let ri = 0; ri < ROWS.length; ri++) for (let si = 0; si < SEATS.length; si++) {
  const hero = ri === 3 && si === 3;
  const p = person({ shirt: mat.shirts[(ri * 5 + si * 3) % mat.shirts.length], head: mat.skin });
  place(p, SEATS[si], FLOOR, ROWS[ri]);
  shadowy(place(box(0.13, 0.1, 0.12, mat.line), 0, 0.05, 0.02, p));
  p.armL.rotation.x = -0.35; p.armR.rotation.x = -0.35;
  const e = makeEnvelope(); place(e, 0, 0.27, -0.13, p);
  students.push({ p, e, ri, si, hero, n: n++, box: (ri * 7 + si * 5 + 1) % 3 });
} }
const hero = students.find((s) => s.hero);

// ── the mascot ──────────────────────────────────────────────────────────────────────────────────────────────────────
const mascot = new THREE.Group();
{ const body = place(box(0.11, 0.075, 0.07, mat.accent, 0.012), 0, 0.06, 0, mascot);
  const eyes = [-0.024, 0.024].map((x) => place(box(0.012, 0.02, 0.006, mat.ink, 0.002), x, 0.067, 0.036, mascot));
  const arms = [-1, 1].map((sd) => { const pv = place(new THREE.Group(), sd * 0.055, 0.055, 0, mascot); place(box(0.026, 0.018, 0.03, mat.accent, 0.005), sd * 0.013, 0, 0, pv); return pv; });
  [-0.04, -0.014, 0.014, 0.04].forEach((x) => place(box(0.013, 0.025, 0.022, mat.accent, 0.004), x, 0.0125, 0, mascot));
  Object.assign(mascot, { body, eyes, arms }); shadowy(mascot); scene.add(mascot); }
const MASCOT_SPOTS = [
  { win: T.m1, from: V3(0.45, PODTOP - 0.07, -1.29), to: V3(0.45, PODTOP + 0.03, -1.29), s: 1, yaw: 0 },
  { win: T.m2, from: V3(0.64, TABLE_TOP - 0.09, TABLE_Z), to: V3(0.64, TABLE_TOP, TABLE_Z), s: 1, yaw: -0.25 },
  { win: T.m3, from: V3(0.42, 0.1, 2.28), to: V3(0.42, 0.62, 2.28), s: 3.2, yaw: -0.15 },
];

// ── the end card ────────────────────────────────────────────────────────────────────────────────────────────────────
const CARD = V3(0, 0, 2.36);
const endCard = new THREE.Group(); place(endCard, CARD.x, CARD.y, CARD.z);
const cardTex = canvasTex(2400, 1000);
const cardFace = place(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.625, 0.008), [mat.card, mat.card, mat.card, mat.card, new THREE.MeshStandardMaterial({ map: cardTex.tex, roughness: 0.55 }), mat.card]), 0, 0.305, 0, endCard);
cardFace.rotation.x = -0.2;
shadowy(place(box(1.5, 0.6, 0.008, mat.card), 0, 0.29, -0.12, endCard)).rotation.x = 0.2;
shadowy(endCard);

// ── canvases that change with time ─────────────────────────────────────────────────────────────────────────────────
function drawLetters(g, str, cx, baseY, px, t, t0, color) {
  g.font = LOOK.font('display', px); g.letterSpacing = LOOK.track('display', px);
  const ws = [...str].map((ch) => g.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0);
  let x = cx - tot / 2;
  [...str].forEach((ch, i) => {
    const d = OM.letterDrop(t, t0, i, { dist: px * 0.55 });
    g.save(); g.globalAlpha = d.op; g.translate(x + ws[i] / 2, baseY + d.y); g.scale(d.sx, d.sy); g.fillStyle = color; g.textAlign = 'center'; g.fillText(ch, 0, 0); g.restore();
    x += ws[i];
  });
}
function drawProjector(t) {
  const k = t < T.word ? 'blank' : t > T.word + 1.4 ? 'full' : 'w' + Math.round(t * 60);
  if (k === projTex.key) return; projTex.key = k;
  const { g, cv } = projTex; const w = cv.width, h = cv.height;
  g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, w, h);
  g.textBaseline = 'alphabetic';
  if (t >= T.word) {
    drawLetters(g, COPY.wordmark, w / 2, h * 0.56, 250, Math.min(t, T.word + 1.4), T.word, C.ink);
    const s = OM.wordRise(Math.min(t, T.word + 1.4), T.word + 0.55);
    g.globalAlpha = s.op; g.fillStyle = C.mute; g.font = LOOK.font('text', 62); g.letterSpacing = '0px'; g.textAlign = 'center'; g.fillText(COPY.wordmarkSub, w / 2, h * 0.72 + s.y); g.globalAlpha = 1;
    g.fillStyle = C.accent; g.fillRect(w / 2 - 60, h * 0.24, 120, 10);
  }
  projTex.tex.needsUpdate = true;
}
function drawLaptop(t) {
  const fillK = ease.cubicInOut(seg(t, 10.5, 12.3));
  const label = t >= T.tick2 ? COPY.timer[2] : t >= T.tick1 ? COPY.timer[1] : COPY.timer[0];
  const k = label + Math.round(fillK * 200);
  if (k === lapTex.key) return; lapTex.key = k;
  const { g, cv } = lapTex; const w = cv.width, h = cv.height;
  g.fillStyle = C.card; g.fillRect(0, 0, w, h);
  g.strokeStyle = C.line; g.lineWidth = 26; g.beginPath(); g.arc(w / 2, h / 2, 230, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = ACE_BLUE; g.lineCap = 'round'; g.beginPath(); g.arc(w / 2, h / 2, 230, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, fillK)); g.stroke();
  g.fillStyle = C.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = LOOK.font('mono', 170); g.fillText(label, w / 2, h / 2 + 8);
  g.fillStyle = C.mute; g.font = LOOK.font('text', 40); g.fillText('PITCH', w / 2, h / 2 - 120);
  lapTex.tex.needsUpdate = true;
}
function drawCard(t) {
  const k = t < T.card ? 'blank' : t > T.card + 1.6 ? 'full' : 'c' + Math.round(t * 60);
  if (k === cardTex.key) return; cardTex.key = k;
  const { g, cv } = cardTex; const w = cv.width, h = cv.height;
  g.fillStyle = C.card; g.fillRect(0, 0, w, h);
  g.fillStyle = C.accent; g.fillRect(w / 2 - 70, 150, 140, 12);
  if (t >= T.card) {
    drawLetters(g, COPY.endTitle, w / 2, 520, 300, Math.min(t, T.card + 1.6), T.card, C.ink);
    const s = OM.wordRise(Math.min(t, T.card + 1.6), T.card + 0.6);
    g.globalAlpha = s.op; g.textAlign = 'center'; g.letterSpacing = '0px';
    g.fillStyle = ACE_BLUE; g.font = LOOK.font('mono', 84); g.fillText(COPY.endDate, w / 2, 690 + s.y);
    g.fillStyle = C.mute; g.font = LOOK.font('text', 70); g.fillText(COPY.endSub, w / 2, 820 + s.y); g.globalAlpha = 1;
  }
  cardTex.tex.needsUpdate = true;
}

// ── camera: keys of {look, off}; off's direction slerps and its length eases in log space ──────────────────────────
let KEYS;
function buildKeys() {
  const hb = new THREE.Vector3(); hero.e.bill.getWorldPosition(hb);
  const heroEnv = new THREE.Vector3(); hero.e.getWorldPosition(heroEnv);
  const lap = new THREE.Vector3(); lapScreen.getWorldPosition(lap);
  const slotB = V3(BOX_X[1], TABLE_TOP + BOX, TABLE_Z), you = V3(BOX_X[3], TABLE_TOP + BOX, TABLE_Z);
  const inB = V3(BOX_X[1], TABLE_TOP + BOX * 0.42, TABLE_Z);
  const k = (t, look, off, o = {}) => ({ t, look, off, fov: o.fov ?? 35, curve: o.curve ?? ease.cubicInOut });
  const q = hb.clone().add(V3(0, 0.002, 0));
  return [
    k(0, q, V3(0, 0, 0.016), { fov: 55 }),
    k(1.45, q, V3(0, 0, 0.016), { fov: 55 }),
    k(2.4, q.clone().add(V3(0, 0.072, 0)), V3(0, 0.001, 0.02), { fov: 50 }),
    k(3.1, q.clone().add(V3(0, 0.072, 0)), V3(0.02, 0.16, 0.12), { fov: 42 }),
    k(4.4, heroEnv.clone().add(V3(0, 0.06, -0.4)), V3(0.06, 0.42, 0.55), { fov: 38 }),
    k(8.6, V3(-0.12, 0.56, -1.32), V3(0.12, 0.34, 2.05), { curve: ease.sineInOut }),
    k(9.8, V3(-0.12, 0.56, -1.32), V3(0.12, 0.34, 2.05)),
    k(11.7, lap.clone(), V3(0, 0.025, 0.3), { fov: 30 }),
    k(14.3, lap.clone(), V3(0, 0.025, 0.3), { fov: 30 }),
    k(14.95, lap.clone().add(V3(0.0, 0.075, -0.03)), V3(-0.08, 0.04, 0.44), { fov: 32, curve: ease.sineInOut }),
    k(16.45, lap.clone().add(V3(0.0, 0.075, -0.03)), V3(-0.08, 0.04, 0.44), { fov: 32 }),
    k(17.35, V3(0.1, 0.3, 0.55), V3(0.05, 0.5, -1.2), { fov: 38, curve: ease.expoInOut }),
    k(21.0, V3(0.1, 0.3, 0.55), V3(0.05, 0.5, -1.2), { fov: 38 }),
    k(22.7, V3(0.1, 0.42, -0.12), V3(0.6, 0.36, 0.7), { fov: 36 }),
    k(25.0, V3(0.16, 0.34, TABLE_Z), V3(0.14, 0.2, 0.56), { fov: 36 }),
    k(25.5, V3(0.16, 0.34, TABLE_Z), V3(0.14, 0.2, 0.56), { fov: 36 }),
    k(27.05, you.clone().add(V3(-0.03, -0.03, 0)), V3(0.06, 0.16, 0.42), { fov: 34, curve: ease.expoInOut }),
    k(28.3, V3(0.56, TABLE_TOP + 0.09, TABLE_Z), V3(0.0, 0.1, 0.42), { fov: 34, curve: ease.sineInOut }),
    k(29.45, V3(0.56, TABLE_TOP + 0.09, TABLE_Z), V3(0.0, 0.1, 0.42), { fov: 34 }),
    k(30.0, slotB.clone(), V3(0.0, 0.13, 0.05), { fov: 40 }),
    k(30.95, inB.clone(), V3(0.0, 0.03, 0.0008), { fov: 60, curve: ease.cubicInOut }),
    k(31.5, inB.clone().add(V3(0, -0.022, 0)), V3(0.0, 0.016, 0.054), { fov: 74, curve: ease.cubicOut }),
    k(34.6, inB.clone().add(V3(0, -0.022, 0)), V3(0.0, 0.016, 0.054), { fov: 74 }),
    k(35.7, slotB.clone().add(V3(0, 0.07, 0)), V3(0.02, 0.17, 0.05), { fov: 45 }),
    k(38.1, V3(0, 0.3, 0.75), V3(1.0, 2.7, 4.8), { fov: 38 }),
    k(39.7, CARD.clone().add(V3(0, 0.4, 0)), V3(0, 0.36, 2.5), { fov: 38 }),
    k(DUR, CARD.clone().add(V3(0, 0.4, 0)), V3(0, 0.36, 2.5), { fov: 38 }),
  ];
}
function slerpDir(a, b, k) {
  const ua = a.clone().normalize(), ub = b.clone().normalize();
  const dot = clamp(ua.dot(ub), -1, 1), om = Math.acos(dot);
  if (om < 1e-4) return ua.lerp(ub, k).normalize();
  const s = Math.sin(om);
  return ua.multiplyScalar(Math.sin((1 - k) * om) / s).add(ub.multiplyScalar(Math.sin(k * om) / s));
}
const restEnv = (t) => { let m = 0; for (const [a, b] of RESTS) m = Math.max(m, sstep(a - 0.35, a, t) * (1 - sstep(b, b + 0.35, t))); return 1 - m; };
function camAt(t) {
  let i = 0; while (i < KEYS.length - 2 && t >= KEYS[i + 1].t) i++;
  const A = KEYS[i], B = KEYS[i + 1], k = B.curve(seg(t, A.t, B.t));
  const look = A.look.clone().lerp(B.look, k);
  const len = Math.exp(lerp(Math.log(A.off.length()), Math.log(B.off.length()), k));
  const dir = slerpDir(A.off, B.off, k);
  const pos = look.clone().add(dir.clone().multiplyScalar(len));
  const fov = lerp(A.fov, B.fov, k);
  const e = restEnv(t) * len * 0.012;
  const right = V3(0, 1, 0).cross(dir).normalize(), up = dir.clone().cross(right).normalize();
  let sx = e * (Math.sin(1.7 * t) + 0.6 * Math.sin(2.9 * t + 1)), sy = e * (Math.sin(1.3 * t + 2) + 0.5 * Math.sin(3.3 * t)), rot = 0;
  for (const [th, amp, decay] of SHAKES) { const s = OM.shake(t, th, { amp, decay, seed: Math.round(th * 100) }); sx += s.x * len * 0.0011; sy += s.y * len * 0.0011; rot += s.rot; }
  pos.add(right.multiplyScalar(sx)).add(up.multiplyScalar(sy));
  return { pos, look, fov, len, rot };
}
function applyCam(c) {
  camera.position.copy(c.pos); camera.up.set(0, 1, 0); camera.lookAt(c.look); camera.rotateZ(c.rot);
  camera.fov = c.fov; camera.near = Math.max(0.0004, c.len * 0.02); camera.far = 60; camera.updateProjectionMatrix();
}

// ── the story: every value a function of t ─────────────────────────────────────────────────────────────────────────
const springUp = (t, t0) => OM.spring(t - t0, 0.55, 18);
function envelopeAt(s, t) {
  const open = s.hero ? T.flapA : T.ripple + (3 - s.ri) * 0.32 + Math.abs(s.si - 2.5) * 0.06;
  const kTip = ease.cubicInOut(seg(t, open, open + 0.28)), kFlap = ease.expoOut(seg(t, open + 0.2, open + 0.6));
  s.e.flap.rotation.x = -kFlap * (Math.PI * 0.62);
  s.e.tipPivot.rotation.x = -kTip * Math.PI / 2;
  const rise = s.hero ? ease.cubicInOut(seg(t, T.billUp[0], T.billUp[1])) : springUp(t, open + 0.45) * (t > open + 0.45 ? 1 : 0);
  return { open, rise };
}
function billPath(s, t) {
  const env = new THREE.Vector3(); s.e.getWorldPosition(env);
  const { rise } = envelopeAt(s, t);
  const hang = env.clone().add(V3(0, 0.002 + rise * 0.072, -ENV.d / 2 + 0.004));
  if (s.hero) {
    if (t < T.heroGo) return { p: hang, rot: 0, vis: true };
    const you = V3(BOX_X[3], TABLE_TOP + BOX + 0.045, TABLE_Z), bounce = V3(BOX_X[3] - 0.08, TABLE_TOP + BOX + 0.16, TABLE_Z + 0.06);
    const overB = V3(BOX_X[1], TABLE_TOP + BOX + 0.07, TABLE_Z), inB = V3(BOX_X[1] - 0.026, TABLE_TOP + 0.022, TABLE_Z - 0.02);
    if (t < T.youHit) { const k = ease.smoother(seg(t, T.heroGo, T.youHit)); const h = OM.hop(t, T.heroGo, T.youHit, { x: hang.x, y: hang.z }, { x: you.x, y: you.z }, { height: 0 }); return { p: V3(h.x, lerp(hang.y, you.y, k) + Math.sin(k * Math.PI) * 0.28, h.y), rot: Math.sin(k * Math.PI * 3) * 0.4, vis: true }; }
    if (t < T.youHit + 0.6) { const k = ease.expoOut(seg(t, T.youHit, T.youHit + 0.6)); return { p: you.clone().lerp(bounce, k), rot: k * 1.6, vis: true }; }
    if (t < T.dropB[0]) { const k = ease.smoother(seg(t, T.youHit + 0.6, T.dropB[0])); const p = bounce.clone().lerp(overB, k); p.y += Math.sin(k * Math.PI) * 0.05; return { p, rot: 1.6 * (1 - k), vis: true }; }
    const k = ease.cubicIn ? ease.cubicIn(seg(t, ...T.dropB)) : Math.pow(seg(t, ...T.dropB), 2);
    return { p: overB.clone().lerp(inB, k), rot: 0, vis: true, lying: seg(t, T.dropB[1] - 0.12, T.dropB[1]) };
  }
  const t0 = T.fly + s.n * 0.075, t1 = t0 + 0.95 + (s.n % 5) * 0.08;
  if (t < t0) return { p: hang, rot: 0, vis: true };
  const tgt = V3(BOX_X[s.box] + ((s.n % 3) - 1) * 0.012, TABLE_TOP + BOX + 0.03, TABLE_Z);
  if (t < t1) { const k = ease.smoother(seg(t, t0, t1)); const p = hang.clone().lerp(tgt, k); p.y += Math.sin(k * Math.PI) * (0.18 + (s.n % 4) * 0.03); return { p, rot: Math.sin(k * Math.PI * 2) * 0.5, vis: true }; }
  const kd = seg(t, t1, t1 + 0.16); const p = tgt.clone(); p.y -= kd * 0.06;
  return { p, rot: 0, vis: kd < 1, landed: t1 };
}

let pending = [];
function seek(t) {
  t = clamp(t, 0, DUR - 1e-6);
  // presenter
  const press = OM.press(t, T.click);
  presenter.armR.rotation.x = -0.6 - press.down * 0.5 - sstep(T.click - 0.5, T.click - 0.1, t) * 0.6 * (1 - sstep(T.click + 0.5, T.click + 1.2, t));
  presenter.armL.rotation.x = -0.15; presenter.rotation.y = Math.sin(t * 0.6) * 0.15 * restEnv(t);
  drawProjector(t); drawLaptop(t); drawCard(t);
  // envelopes and bills
  for (const s of students) {
    envelopeAt(s, t);
    const b = billPath(s, t);
    const local = s.e.worldToLocal(b.p.clone());
    s.e.bill.position.copy(local); s.e.bill.rotation.set(0, b.rot * 0.3, b.rot * 0.25);
    if (b.lying) s.e.bill.rotation.x = -b.lying * Math.PI / 2;
    s.e.bill.visible = b.vis;
  }
  // ballots: the YOU box shuts its slot, B opens its lid at the end
  const shut = t >= T.youHit - 0.12 ? OM.impact(t, T.youHit) : null;
  youShut.visible = t >= T.youHit - 0.12; youShut.scale.set(1, 1 + (shut ? shut.sy - 1 : 0) * 2, 1);
  ballots[3].scale.set(shut ? shut.sx : 1, shut ? 2 - shut.sx : 1, shut ? shut.sx : 1);
  const lidK = ease.expoOut(seg(t, T.lidB, T.lidB + 0.5));
  ballots[1].lidA.rotation.x = -lidK * 1.9; ballots[1].lidB.rotation.x = lidK * 1.9; ballots[1].slotEdge.visible = lidK < 0.02;
  vaultLight.intensity = 0.16 * sstep(30.0, 31.0, t) * (1 - sstep(35.6, 36.2, t));
  // the trophy
  const up = t < T.trophy ? 0 : springUp(t, T.trophy);
  const out = ease.cubicInOut(seg(t, ...T.trophyUp));
  trophy.position.y = -BOX / 2 + 0.002 - 0.04 + up * 0.06 + out * 0.1;
  const land = OM.impact(t, T.trophyLand); trophy.scale.set(land.sx, land.sy, land.sx);
  trophy.rotation.y = Math.sin(t * 0.7) * 0.25 * restEnv(t);
  trophy.visible = t >= T.trophy - 0.05;
  // the mascot
  mascot.visible = false;
  for (const sp of MASCOT_SPOTS) {
    const [a, b] = sp.win; if (t < a || t > b) continue;
    mascot.visible = true;
    const pin = OM.popIn(t, a, { rise: 0 }), outK = b >= DUR - 0.01 ? 0 : ease.cubicIn ? 0 : 0;
    const k = Math.min(1, springUp(t, a)) * (1 - ease.smoother(seg(t, b - 0.3, b)) * (b >= DUR - 0.01 ? 0 : 1));
    mascot.position.copy(sp.from.clone().lerp(sp.to, k));
    const imp = OM.impact(t, a + 0.18);
    mascot.scale.set(sp.s * imp.sx, sp.s * imp.sy, sp.s * imp.sx);
    const talk = t > a + 0.3 && t < b - 0.4;
    mascot.body.scale.y = 1 + (talk ? Math.sin(t * 26) * 0.05 : 0);
    const blink = (t % 1.9) > 1.8 && restEnv(t) > 0.5 ? 0.15 : 1; mascot.eyes.forEach((e) => { e.scale.y = blink; });
    const snap = sp === MASCOT_SPOTS[0] ? sstep(T.snap - 0.2, T.snap, t) * (1 - sstep(T.snap + 0.15, T.snap + 0.5, t)) : 0;
    mascot.arms[0].rotation.z = talk ? Math.sin(t * 7) * 0.3 : 0;
    mascot.arms[1].rotation.z = sp === MASCOT_SPOTS[2] ? -(0.9 + Math.sin(t * 13) * 0.55) * sstep(a + 0.3, a + 0.5, t) * (1 - sstep(41.0, 41.3, t)) : -snap * 1.4 + (talk ? -Math.sin(t * 7) * 0.3 : 0);
    mascot.rotation.y = sp.yaw + (sp === MASCOT_SPOTS[1] ? Math.sin((t - a) * 14) * 0.35 * sstep(a + 0.25, a + 0.35, t) * (1 - sstep(a + 1.2, a + 1.4, t)) : 0);
    void pin; void outK;
  }
  // camera
  const c = camAt(t); applyCam(c);
  renderer.render(scene, camera);
  overlays(t);
  hud.textContent = 't=' + t.toFixed(3);
  const p = pending; pending = []; return Promise.all(p);
}

// ── overlays: subtitles and the mascot's bubble, drawn in the comp ──────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const hud = $('hud'), subEn = $('subEn'), subZh = $('subZh'), subs = $('subs'), bub = $('bubble'), bubEn = $('bubEn'), bubZh = $('bubZh');
function overlays(t) {
  const s = COPY.subs.find(([a, b]) => t >= a - 0.08 && t <= b + 0.35);
  if (s) { const k = Math.min(sstep(s[0] - 0.08, s[0] + 0.12, t), 1 - sstep(s[1] + 0.15, s[1] + 0.35, t)); subs.style.opacity = k; if (subEn.textContent !== s[2]) { subEn.textContent = s[2]; subZh.textContent = s[3]; } }
  else subs.style.opacity = 0;
  const b = COPY.bubbles.find(([a, e]) => t >= a - 0.1 && t <= e);
  if (b && mascot.visible) {
    const head = new THREE.Vector3(); mascot.getWorldPosition(head); head.y += 0.1 * mascot.scale.y;
    const p = head.project(camera), x = (p.x + 1) / 2 * W, y = (1 - p.y) / 2 * H;
    const pin = OM.popIn(t, b[0] - 0.1, { rise: 18 });
    const out = b[1] >= DUR - 0.01 ? 1 : 1 - sstep(b[1] - 0.2, b[1], t);
    bub.style.opacity = pin.op * out; bub.style.transform = `translate(${x - 40}px, ${y - 150 + pin.dy}px) scale(${pin.s})`;
    if (bubEn.textContent !== b[2]) { bubEn.textContent = b[2]; bubZh.textContent = b[3]; }
  } else bub.style.opacity = 0;
}

// ── probe / render hooks ───────────────────────────────────────────────────────────────────────────────────────────
function screenBox(obj) {
  if (!obj.visible) return null;
  const bx = new THREE.Box3().setFromObject(obj); if (bx.isEmpty()) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = 0;
  for (const cx of [bx.min.x, bx.max.x]) for (const cy of [bx.min.y, bx.max.y]) for (const cz of [bx.min.z, bx.max.z]) {
    const v = V3(cx, cy, cz); const cam = v.clone().applyMatrix4(camera.matrixWorldInverse); if (cam.z > 0) behind++;
    v.project(camera); const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H; x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
  }
  if (behind === 8) return null;
  x0 = clamp(x0, -4 * W, 5 * W); x1 = clamp(x1, -4 * W, 5 * W); y0 = clamp(y0, -4 * H, 5 * H); y1 = clamp(y1, -4 * H, 5 * H);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, op: 1 };
}
const TRACKED = () => ({ envelope: hero.e, bill: hero.e.bill, presenter, projector, laptop, mascot, boxB: ballots[1], boxYou: ballots[3], trophy, card: endCard });
function track(t) { seek(t); const out = {}; for (const [k, o] of Object.entries(TRACKED())) { const b = screenBox(o); if (b) out[k] = b; } return out; }
function travel(t0, t1) {
  const a = track(t0), b = track(t1); let far = 0;
  for (const k of Object.keys(a)) if (b[k]) { const A = a[k], B = b[k]; far = Math.max(far, Math.hypot(A.x - B.x, A.y - B.y), Math.hypot(A.x + A.w - B.x - B.w, A.y + A.h - B.y - B.h)); }
  const c0 = camAt(t0), c1 = camAt(t1); applyCam(c0); camera.updateMatrixWorld();
  const pts = [-1, 1].flatMap((sx) => [-1, 1].map((sy) => V3(sx * 0.6, sy * 0.6, 0.5).unproject(camera)));
  applyCam(c1); camera.updateMatrixWorld();
  for (const p of pts) { const q = p.clone().project(camera); far = Math.max(far, Math.hypot((q.x + 1) / 2 * W - 960 - 0.6 * 960 * Math.sign(q.x), 0) * 0 + 0); }
  const proj0 = pts.map((p) => { const q = p.clone().project(camera); return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H]; });
  const base0 = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sy]) => [(sx * 0.6 + 1) / 2 * W, (1 - sy * 0.6) / 2 * H]);
  proj0.forEach((p, i) => { far = Math.max(far, Math.hypot(p[0] - base0[i][0], p[1] - base0[i][1])); });
  return Math.min(far, 4000);
}
function events() {
  const ev = [], pan = (o) => { const b = screenBox(o); return b ? clamp(((b.x + b.w / 2) / W) * 2 - 1, -1, 1) : 0; };
  const at = (t, kind, obj, v = 1) => { seek(t); ev.push({ t, kind, pan: obj ? pan(obj) : 0, v }); };
  at(T.flapA, 'paper', hero.e, 0.8); at(T.billUp[0], 'slide', hero.e.bill, 0.6);
  at(T.click, 'click', presenter, 0.7); at(T.word + 0.15, 'land', projector, 0.6);
  at(T.tick1, 'tick', laptop, 0.5); at(T.tick2, 'tick', laptop, 0.5);
  at(T.m1[0] + 0.12, 'pop', mascot, 0.9); at(T.snap, 'snap', mascot, 0.9);
  [0, 1, 2, 3].forEach((r) => at(T.ripple + (3 - r) * 0.32 + 0.1, 'paper', students.find((s) => s.ri === r && s.si === 2).e, 0.55));
  [0, 1, 2].forEach((bi) => { const ls = students.filter((s) => !s.hero && s.box === bi).map((s) => billPath(s, 99).landed || 0).sort((a, b) => a - b); [ls[0], ls[Math.floor(ls.length / 2)], ls[ls.length - 1]].forEach((t1) => at(t1 + 0.06, 'drop', ballots[bi], 0.5)); });
  at(T.heroGo + 0.1, 'whoosh', hero.e.bill, 0.7); at(T.youHit, 'slam', ballots[3], 1.0);
  at(T.m2[0] + 0.12, 'pop', mascot, 0.9); at(T.dropB[1], 'drop', ballots[1], 0.8);
  at(T.trophyLand, 'trophy', trophy, 1.0); at(T.lidB, 'lid', ballots[1], 0.7);
  at(T.card + 0.2, 'land', endCard, 0.6); at(T.m3[0] + 0.12, 'pop', mascot, 0.9);
  return { T: DUR, events: ev.sort((a, b) => a.t - b.t) };
}
function camSpeed(t) {
  const h = 1 / 60, a = camAt(Math.max(0, t - h)), b = camAt(Math.min(DUR, t + h));
  const dlog = Math.abs(Math.log(b.len) - Math.log(a.len)) / (2 * h);
  const ang = a.pos.clone().sub(a.look).normalize().angleTo(b.pos.clone().sub(b.look)) / (2 * h);
  const mv = a.look.distanceTo(b.look) / ((a.len + b.len) / 2) / (2 * h);
  return dlog + ang + mv * 0.5;
}

window.__meta = { dur: DUR, fps: FPS, w: W, h: H, cuts: [], inFrame: { bill: [25.6, 29.4], mascot: [14.9, 16.2], trophy: [32.0, 34.5], card: [40.0, DUR - 0.05, 'whole'] } };
window.__ready = LOOK.ready.then(() => { KEYS = buildKeys(); projTex.key = lapTex.key = cardTex.key = ''; return seek(0); });
window.__seek = async (t) => { await seek(t); return true; };
window.__track = (t) => track(t);
window.__motion = (t0, t1) => travel(t0, t1);
window.__events = () => events();
window.__camSpeed = (t) => camSpeed(t);

const q = new URLSearchParams(location.search);
if (q.has('hud')) hud.style.display = 'block';
if (q.has('t')) window.__ready.then(() => seek(parseFloat(q.get('t'))));
if (q.has('play')) window.__ready.then(() => { const t0 = performance.now(); (function loop() { seek(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); })(); });
