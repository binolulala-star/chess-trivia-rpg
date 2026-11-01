// Three.js 3D 場景、程序化棋子、球面座標運鏡、射線互動、原場決鬥演出
import * as THREE from 'three';
import { titleOf, NAMES, THEME, SKILL } from './rpg.js';

const PI = Math.PI;
export const sqPos = (r, c) => new THREE.Vector3(c - 3.5, 0, r - 3.5);
const easeIO = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const Y = (y) => new THREE.Vector3(0, y, 0);
const HEIGHT = { P: 1.05, N: 1.3, B: 1.5, R: 1.17, Q: 1.4, K: 1.7 };
const LV_COL = ['#e9ecf5', '#6fd0ff', '#c58bff', '#ffd54a'];
const LV_HEX = [0xffffff, 0x5ec8ff, 0xb36bff, 0xffd34d];

const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

// ===== 棋子造型：大理石本體 + 金/銀金屬飾件 + 發光符文（參考雕像設定圖） =====
const _marbleCache = {};
function marbleTex(kind) { // 程序化大理石紋理（white / black / gold 紋）
  if (_marbleCache[kind]) return _marbleCache[kind];
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const x = cv.getContext('2d');
  const base = { white: '#f3f0e8', black: '#2a2d40' }[kind];
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  let s = kind === 'white' ? 1234 : 4321; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 26; i++) { // 柔霧斑
    const px = rnd() * 256, py = rnd() * 256, rr = 20 + rnd() * 50;
    const gr = x.createRadialGradient(px, py, 0, px, py, rr);
    gr.addColorStop(0, kind === 'white' ? 'rgba(200,196,185,0.18)' : 'rgba(120,125,160,0.13)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  for (let i = 0; i < 16; i++) { // 紋路
    x.beginPath(); let px = rnd() * 256, py = rnd() * 256; x.moveTo(px, py);
    for (let k = 0; k < 6; k++) { px += (rnd() - 0.5) * 90; py += (rnd() - 0.2) * 70; x.lineTo(px, py); }
    x.lineWidth = 0.6 + rnd() * 1.6;
    x.strokeStyle = kind === 'white' ? (rnd() < 0.45 ? 'rgba(196,150,72,0.55)' : 'rgba(120,118,112,0.35)') : (rnd() < 0.4 ? 'rgba(210,170,80,0.45)' : 'rgba(170,175,205,0.35)');
    x.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return (_marbleCache[kind] = t);
}
// 各棋種發光符文色（與 THEME 一致）：兵天藍、騎士翠綠、主教琥珀、城堡紫晶、皇后緋紅、國王金

function buildPiece(type, color) {
  const white = color === 'w';
  const mat = new THREE.MeshStandardMaterial({
    map: marbleTex(white ? 'white' : 'black'), color: 0xffffff, roughness: white ? 0.3 : 0.26, metalness: white ? 0.02 : 0.22,
    emissive: white ? 0x2a2820 : 0x0a0b18, emissiveIntensity: white ? 0.7 : 0.55,
  });
  const baseMat = new THREE.MeshStandardMaterial({ map: marbleTex('black'), color: white ? 0xb8bccf : 0xffffff, roughness: 0.35, metalness: 0.2, emissive: 0x0a0b18, emissiveIntensity: 0.5 });
  const tint = white ? 1 : 0.58;
  const gold = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xf0bd48).multiplyScalar(tint), roughness: 0.32, metalness: 0.4, emissive: 0x7a5614, emissiveIntensity: white ? 0.4 : 0.28 });
  const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xeef2f8).multiplyScalar(tint), roughness: 0.34, metalness: 0.3, emissive: 0x5a6578, emissiveIntensity: 0.4 });
  const glow = new THREE.MeshStandardMaterial({ color: THEME[type], emissive: THEME[type], emissiveIntensity: 1.0, roughness: 0.3, metalness: 0.2 });
  const g = new THREE.Group();
  const add = (geo, m = mat, x = 0, y = 0, z = 0, parent = g) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };
  const torus = (r, t, m, y, parent = g, seg = 32) => { const o = add(new THREE.TorusGeometry(r, t, 8, seg), m, 0, y, 0, parent); o.rotation.x = PI / 2; return o; };
  const grp = (x, y, z, parent = g) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
  const sph = (r, m, x, y, z, parent = g) => add(new THREE.SphereGeometry(r, 18, 14), m, x, y, z, parent);
  const cyl = (rt, rb, h, m, x, y, z, seg = 16, parent = g) => add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, parent);
  const cone = (r, h, m, x, y, z, seg = 10, parent = g) => add(new THREE.ConeGeometry(r, h, seg), m, x, y, z, parent);
  const box = (w, h, d, m, x, y, z, parent = g) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
  const idle = [];
  // 底座：深色大理石 + 金/銀邊 + 符文光環
  const pedestal = (rim, r = 0.42, runeRing = true) => {
    add(lathe([[0, 0], [r, 0], [r + 0.02, 0.03], [r + 0.02, 0.07], [r - 0.05, 0.1], [0, 0.1]], 36), baseMat);
    torus(r + 0.01, 0.017, rim, 0.065, g, 40);
    if (runeRing) torus(r - 0.1, 0.007, glow, 0.104, g, 40);
  };
  switch (type) {
    case 'P': { // 皇家重裝步兵：鋼鎧、天藍符文、左盾右矛
      pedestal(steel, 0.4);
      for (const sx of [-1, 1]) {
        box(0.11, 0.08, 0.2, mat, sx * 0.085, 0.14, -0.03);
        cyl(0.052, 0.058, 0.17, steel, sx * 0.085, 0.27, 0);
        sph(0.06, steel, sx * 0.085, 0.37, -0.01); // 護膝
      }
      cyl(0.16, 0.19, 0.3, mat, 0, 0.55, 0, 18);
      const bp = cyl(0.172, 0.205, 0.25, steel, 0, 0.55, 0, 18); bp.scale.z = 0.95;
      for (const y of [0.47, 0.57, 0.65]) torus(0.186, 0.007, glow, y);
      torus(0.2, 0.02, steel, 0.4);
      for (const sx of [-1, 1]) { sph(0.085, steel, sx * 0.21, 0.67, 0); add(new THREE.TorusGeometry(0.07, 0.007, 6, 20), glow, sx * 0.21, 0.67, -0.04); }
      sph(0.125, mat, 0, 0.84, 0);
      const helm = add(new THREE.SphereGeometry(0.15, 20, 14, 0, PI * 2, 0, PI * 0.66), steel, 0, 0.84, 0);
      box(0.17, 0.075, 0.06, steel, 0, 0.82, -0.115);
      for (let i = -2; i <= 2; i++) box(0.012, 0.045, 0.01, new THREE.MeshBasicMaterial({ color: 0x080a14 }), i * 0.03, 0.82, -0.148);
      const plume = add(new THREE.CapsuleGeometry(0.035, 0.16, 4, 10), mat, 0, 0.98, 0.17); plume.rotation.x = 1.15;
      // 左盾（朝外）
      const sh = cyl(0.16, 0.16, 0.03, steel, -0.26, 0.5, -0.04, 28); sh.rotation.z = PI / 2; sh.rotation.y = 0.25;
      const shr = add(new THREE.TorusGeometry(0.12, 0.009, 6, 28), glow, -0.28, 0.5, -0.04); shr.rotation.y = PI / 2 - 0.25;
      sph(0.045, gold, -0.285, 0.5, -0.04);
      // 右矛
      const spear = new THREE.Group();
      const stripe = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.4, metalness: 0.6 });
      cyl(0.017, 0.017, 1.0, steel, 0, 0.55, 0, 8, spear);
      for (let i = 0; i < 6; i++) cyl(0.019, 0.019, 0.06, stripe, 0, 0.2 + i * 0.12, 0, 8, spear);
      cone(0.042, 0.2, steel, 0, 1.14, 0, 8, spear);
      torus(0.03, 0.006, glow, 1.04, spear, 14);
      spear.position.set(0.28, 0.05, -0.06); spear.rotation.z = -0.1;
      spear.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.add(spear); g.userData.weapon = spear;
      idle.push({ kind: 'flicker', obj: shr });
      break;
    }
    case 'N': { // 翡翠龍騎戰馬：大理石馬身 + 銀甲 + 翠綠符文 + 側掛騎槍
      pedestal(steel, 0.4);
      cyl(0.29, 0.33, 0.12, mat, 0, 0.16, 0, 28);
      torus(0.3, 0.012, steel, 0.215, g, 32);
      const chest = sph(0.27, mat, 0, 0.5, 0.04); chest.scale.set(0.95, 1.0, 1.15);
      sph(0.2, mat, 0, 0.4, 0.2);
      for (const sx of [-1, 1]) { const leg = cyl(0.055, 0.04, 0.3, mat, sx * 0.1, 0.35, -0.22); leg.rotation.x = -0.5; }
      // 胸甲
      const shell = add(new THREE.SphereGeometry(0.295, 20, 12, 3.61, 2.2, 0.55, 1.5), steel, 0, 0.5, 0.04); shell.scale.set(0.95, 1.0, 1.15);
      for (const [x, y] of [[-0.09, 0.5], [0.09, 0.5], [0, 0.43]]) box(0.04, 0.05, 0.012, glow, x, y, -0.305);
      // 頸（朝 -z 前傾）
      const neck = grp(0, 0.84, -0.13); neck.rotation.x = -0.5;
      cyl(0.1, 0.17, 0.55, mat, 0, 0, 0, 14, neck);
      for (let i = 0; i < 5; i++) {
        const y = -0.2 + i * 0.1;
        box(0.12 - i * 0.008, 0.085, 0.05, steel, 0, y, 0.125, neck);
        box(0.05, 0.03, 0.012, glow, 0, y, 0.155, neck);
      }
      // 頭
      const head = grp(0, 1.0, -0.43); head.rotation.x = -(PI / 2 + 0.4);
      cyl(0.07, 0.115, 0.38, mat, 0, 0, 0, 14, head);
      box(0.1, 0.3, 0.03, steel, 0, 0.0, 0.105, head);
      box(0.05, 0.12, 0.012, glow, 0, 0.06, 0.125, head);
      box(0.15, 0.04, 0.14, steel, 0, -0.1, 0.07, head);
      for (const sx of [-1, 1]) {
        const ear = cone(0.032, 0.12, mat, sx * 0.065, -0.17, 0.1, 10, head); ear.rotation.x = PI / 2 - 0.3;
        add(new THREE.SphereGeometry(0.02, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22303a }), sx * 0.105, -0.06, 0.02, head);
      }
      // 側掛騎槍
      const lance = grp(0.3, 0.62, 0.0); lance.rotation.x = -(PI / 2 + 0.18); lance.rotation.z = 0.12;
      cyl(0.024, 0.024, 1.25, steel, 0, 0, 0, 10, lance);
      cone(0.034, 0.22, steel, 0, 0.73, 0, 10, lance);
      cyl(0.03, 0.075, 0.2, steel, 0, 0.18, 0, 12, lance);
      torus(0.06, 0.007, glow, 0.1, lance, 16).rotation.x = PI / 2;
      idle.push({ kind: 'flicker', obj: box(0.05, 0.03, 0.012, glow, 0, 0.0, 0.17, neck) });
      break;
    }
    case 'B': { // 聖光大賢者：金邊法袍、主教冠、琥珀水晶法杖
      pedestal(gold, 0.4);
      add(lathe([[0, 0.1], [0.31, 0.1], [0.33, 0.16], [0.27, 0.32], [0.2, 0.62], [0.17, 0.82], [0.2, 0.9], [0, 0.94]], 28), mat);
      torus(0.325, 0.02, gold, 0.17, g, 36);
      box(0.11, 0.62, 0.03, gold, 0, 0.5, -0.23).rotation.x = 0.16;
      for (const sx of [-1, 1]) box(0.012, 0.6, 0.032, glow, sx * 0.03, 0.5, -0.232).rotation.x = 0.16;
      torus(0.19, 0.025, gold, 0.6, g, 28);
      torus(0.21, 0.035, gold, 0.9, g, 28);
      for (const sx of [-1, 1]) { sph(0.08, mat, sx * 0.2, 0.86, 0); torus(0.075, 0.012, gold, 0.86, g, 14).position.x = sx * 0.2; }
      sph(0.13, mat, 0, 1.03, 0);
      const beard = cone(0.1, 0.26, new THREE.MeshStandardMaterial({ color: white ? 0xe3d8c0 : 0x585a70, roughness: 0.5 }), 0, 0.88, -0.09, 12); beard.rotation.x = PI + 0.15;
      add(new THREE.CylinderGeometry(0.07, 0.15, 0.34, 18), mat, 0, 1.3, 0);
      torus(0.15, 0.022, gold, 1.15, g, 24);
      const fin = cone(0.11, 0.3, gold, 0, 1.35, 0.1, 3); fin.scale.set(1, 1, 0.35);
      sph(0.028, glow, 0, 1.24, -0.12);
      cone(0.04, 0.1, gold, 0, 1.5, 0, 8);
      // 袖與手
      for (const sx of [-1, 1]) { const sl = cyl(0.06, 0.09, 0.34, mat, sx * 0.24, 0.66, -0.03, 12); sl.rotation.z = sx * 0.12; sph(0.045, mat, sx * 0.26, 0.48, -0.04); }
      // 法杖（左手）
      const staff = grp(-0.32, 0, -0.07);
      cyl(0.022, 0.022, 1.3, gold, 0, 0.75, 0, 8, staff);
      for (let i = 0; i < 4; i++) torus(0.03, 0.007, gold, 0.4 + i * 0.12, staff, 10);
      const ring = add(new THREE.TorusGeometry(0.13, 0.02, 8, 24), gold, 0, 1.55, 0, staff);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; const th = cone(0.016, 0.09, gold, Math.cos(a) * 0.15, 1.55 + Math.sin(a) * 0.15, 0, 6, staff); th.rotation.z = a - PI / 2; }
      const gem = add(new THREE.IcosahedronGeometry(0.07, 0), glow, 0, 1.55, 0, staff);
      idle.push({ kind: 'pulse', obj: gem });
      break;
    }
    case 'R': { // 符文重裝巨塔：八角石塔、紫晶核心
      add(lathe([[0, 0], [0.43, 0], [0.45, 0.05], [0.41, 0.1], [0.34, 0.15], [0, 0.15]], 36), baseMat);
      torus(0.44, 0.02, gold, 0.06, g, 40);
      torus(0.36, 0.008, glow, 0.155, g, 40);
      const oct = (rt, rb, h, m, y) => { const o = cyl(rt, rb, h, m, 0, y, 0, 8); o.rotation.y = PI / 8; return o; };
      oct(0.285, 0.33, 0.34, mat, 0.32);
      for (const y of [0.22, 0.34, 0.44]) { const o = oct(0.322 - (y - 0.22) * 0.1, 0.322 - (y - 0.22) * 0.1, 0.012, baseMat, y); }
      for (let i = 0; i < 4; i++) box(0.05, 0.1, 0.02, new THREE.MeshBasicMaterial({ color: 0x1a1230 }), Math.sin((i - 1.5) * 0.25 * PI) * 0.3, 0.3, -Math.cos((i - 1.5) * 0.25 * PI) * 0.3).rotation.y = (i - 1.5) * 0.25 * PI;
      oct(0.31, 0.3, 0.03, steel, 0.5);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + PI / 8; cyl(0.024, 0.024, 0.24, mat, Math.sin(a) * 0.26, 0.64, Math.cos(a) * 0.26, 8); }
      for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + PI / 8; sph(0.03, mat, Math.sin(a) * 0.26, 0.77, Math.cos(a) * 0.26); }
      const crystal = add(new THREE.IcosahedronGeometry(0.13, 0), glow, 0, 0.64, 0); crystal.scale.set(0.9, 1.35, 0.9);
      idle.push({ kind: 'pulse', obj: crystal });
      torus(0.27, 0.006, glow, 0.52, g, 8);
      oct(0.3, 0.3, 0.03, mat, 0.78);
      oct(0.335, 0.29, 0.2, mat, 0.89);
      oct(0.355, 0.35, 0.05, mat, 1.01);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; const m = box(0.13, 0.11, 0.07, mat, Math.sin(a) * 0.31, 1.1, Math.cos(a) * 0.31); m.rotation.y = a; }
      for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; const gar = cone(0.04, 0.12, mat, Math.sin(a) * 0.36, 0.9, Math.cos(a) * 0.36, 6); gar.rotation.x = Math.cos(a) * PI / 2.2; gar.rotation.z = -Math.sin(a) * PI / 2.2; }
      break;
    }
    case 'Q': { // 緋紅雙刃女武神：白金戰裙、羽翼、盾與權杖、背後雙刃
      pedestal(gold, 0.42);
      add(lathe([[0, 0.1], [0.35, 0.1], [0.37, 0.15], [0.31, 0.3], [0.21, 0.55], [0.14, 0.78], [0.16, 0.88], [0, 0.92]], 32), mat);
      torus(0.355, 0.02, gold, 0.16, g, 40);
      const panel = box(0.12, 0.6, 0.025, gold, 0, 0.45, -0.24); panel.rotation.x = 0.2;
      for (const sx of [-1, 1]) { const p2 = box(0.02, 0.5, 0.02, glow, sx * 0.075, 0.45, -0.235); p2.rotation.x = 0.2; }
      torus(0.145, 0.022, gold, 0.76, g, 24);
      torus(0.16, 0.03, gold, 0.9, g, 24);
      for (const sx of [-1, 1]) { sph(0.07, mat, sx * 0.16, 0.9, 0); torus(0.065, 0.011, gold, 0.9, g, 14).position.x = sx * 0.16; }
      // 翅膀
      for (const sx of [-1, 1]) {
        const wing = grp(sx * 0.12, 0.97, 0.1); wing.rotation.x = 0.35;
        for (let i = 0; i < 4; i++) {
          const geo = new THREE.BoxGeometry(0.055, 0.3 - i * 0.025, 0.014); geo.translate(0, (0.3 - i * 0.025) / 2, 0);
          const f = new THREE.Mesh(geo, mat); f.castShadow = true; f.rotation.z = -sx * (0.25 + i * 0.3); wing.add(f);
          const eg = new THREE.BoxGeometry(0.058, 0.02, 0.018); eg.translate(0, 0.3 - i * 0.025, 0);
          const e = new THREE.Mesh(eg, gold); e.rotation.z = f.rotation.z; wing.add(e);
        }
      }
      sph(0.12, mat, 0, 1.03, 0);
      sph(0.115, mat, 0, 1.02, 0.045);
      for (const sx of [-1, 1]) { const br = add(new THREE.CapsuleGeometry(0.028, 0.18, 4, 8), mat, sx * 0.1, 0.9, -0.04); br.rotation.z = sx * 0.1; }
      torus(0.118, 0.016, gold, 1.12, g, 24);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; const sp = cone(0.032, 0.2, mat, Math.sin(a) * 0.115, 1.23, Math.cos(a) * 0.115, 8); sp.rotation.x = Math.cos(a) * 0.18; sp.rotation.z = -Math.sin(a) * 0.18; sph(0.012, gold, Math.sin(a) * 0.125, 1.33, Math.cos(a) * 0.125); }
      // 盾（右）與權杖（左）
      const sh = cyl(0.15, 0.15, 0.03, mat, 0.27, 0.62, -0.02, 28); sh.rotation.z = PI / 2; sh.rotation.y = 0.2;
      const shr = add(new THREE.TorusGeometry(0.15, 0.014, 8, 28), gold, 0.285, 0.62, -0.02); shr.rotation.y = PI / 2 - 0.2;
      sph(0.04, glow, 0.3, 0.62, -0.02);
      const sc = grp(-0.27, 0, -0.1);
      cyl(0.016, 0.016, 0.8, mat, 0, 0.5, 0, 8, sc);
      sph(0.038, gold, 0, 0.93, 0, sc);
      cone(0.03, 0.08, gold, 0, 0.99, 0, 8, sc);
      for (const sx of [-1, 1]) sph(0.04, mat, sx * 0.22, 0.65, -0.05).scale.set(1, 1, 1);
      // 背後緋紅雙刃
      const blades = [];
      for (const s of [-1, 1]) {
        const bl = grp(s * 0.36, 0.95, 0.12); bl.rotation.z = -s * 0.6; bl.rotation.x = 0.15;
        const geo = new THREE.BoxGeometry(0.075, 0.7, 0.025); geo.translate(0, 0.37, 0);
        const b = new THREE.Mesh(geo, glow); b.castShadow = true; bl.add(b); blades.push(b);
        const tip = cone(0.0375, 0.14, glow, 0, 0.77, 0, 4, bl); tip.scale.z = 0.35;
        box(0.2, 0.03, 0.04, gold, 0, 0.0, 0, bl);
        cyl(0.018, 0.018, 0.14, gold, 0, -0.08, 0, 8, bl);
      }
      idle.push({ kind: 'flicker', obj: blades[0] });
      break;
    }
    case 'K': { // 黃金聖盾君王：金斗篷、十字帝冠、胸前聖盾
      pedestal(gold, 0.44);
      add(lathe([[0, 0.1], [0.36, 0.1], [0.38, 0.15], [0.3, 0.35], [0.22, 0.7], [0.18, 0.95], [0.22, 1.03], [0, 1.07]], 32), mat);
      for (const sx of [-1, 0, 1]) { const st = box(sx ? 0.03 : 0.07, 0.62, 0.02, gold, sx * 0.1, 0.46, -0.27 + Math.abs(sx) * 0.015); st.rotation.x = 0.17; }
      torus(0.37, 0.02, gold, 0.16, g, 40);
      torus(0.2, 0.025, gold, 0.62, g, 28);
      // 披風
      const capeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xf0bd48).multiplyScalar(white ? 1 : 0.62), roughness: 0.4, metalness: 0.4, emissive: 0x7a5614, emissiveIntensity: 0.4, side: THREE.DoubleSide });
      const cape = add(new THREE.CylinderGeometry(0.27, 0.44, 0.95, 28, 1, true, -2.25, 4.5), capeMat, 0, 0.62, 0.02);
      const train = add(new THREE.CylinderGeometry(0.44, 0.52, 0.06, 28, 1, true, -1.4, 2.8), capeMat, 0, 0.15, 0.1);
      for (const sx of [-2, -1, 0, 1, 2]) { // 披風背面金繡紋
        const em = box(sx % 2 ? 0.035 : 0.06, 0.78, 0.012, gold, sx * 0.1, 0.6, 0.0); em.rotation.x = -0.18;
        em.position.z = 0.02 + 0.36 + Math.abs(sx) * -0.02 + 0.006; em.rotation.y = -sx * 0.27; em.position.x = Math.sin(sx * 0.27) * 0.37;
        em.position.z = 0.02 + Math.cos(sx * 0.27) * 0.37;
      }
      for (const sx of [-1, 1]) { sph(0.045, gold, sx * 0.21, 1.0, -0.07); sph(0.085, mat, sx * 0.17, 0.97, 0.0).scale.set(1, 0.8, 1); }
      const chain = add(new THREE.TorusGeometry(0.2, 0.01, 6, 24, PI), gold, 0, 0.98, -0.07); chain.rotation.z = PI; chain.scale.set(1, 0.7, 1);
      // 胸前聖盾
      const sp = new THREE.Shape();
      sp.moveTo(-0.075, 0.085); sp.lineTo(0.075, 0.085); sp.lineTo(0.075, 0.0); sp.quadraticCurveTo(0.075, -0.07, 0, -0.105); sp.quadraticCurveTo(-0.075, -0.07, -0.075, 0.0); sp.closePath();
      const shield = add(new THREE.ExtrudeGeometry(sp, { depth: 0.018, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 }), glow, 0, 0.8, -0.245);
      shield.rotation.y = PI; shield.position.z = -0.215;
      idle.push({ kind: 'pulse', obj: shield });
      for (const sx of [-1, 1]) { const sl = cyl(0.06, 0.09, 0.32, mat, sx * 0.24, 0.72, -0.02, 12); sl.rotation.z = sx * 0.2; sph(0.05, mat, sx * 0.29, 0.54, -0.02); }
      sph(0.135, mat, 0, 1.17, 0);
      for (const sx of [-1, 1]) sph(0.085, mat, sx * 0.1, 1.1, 0.03);
      const beard = cone(0.11, 0.24, mat, 0, 1.03, -0.1, 12); beard.rotation.x = PI + 0.1;
      // 帝冠
      cyl(0.165, 0.15, 0.1, gold, 0, 1.31, 0, 24).material = gold;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; cone(0.022, 0.12, gold, Math.sin(a) * 0.16, 1.41, Math.cos(a) * 0.16, 6); }
      for (const ry of [0, PI / 2]) { const arc = add(new THREE.TorusGeometry(0.15, 0.013, 8, 20, PI), gold, 0, 1.36, 0); arc.rotation.y = ry; }
      sph(0.035, gold, 0, 1.52, 0);
      box(0.03, 0.11, 0.03, gold, 0, 1.6, 0);
      box(0.08, 0.026, 0.03, gold, 0, 1.62, 0);
      break;
    }
    default:
  }
  g.userData.idle = idle;
  g.scale.setScalar(1.0);
  return g;
}

function makeLabel(name, title, lv, white) {
  const cv = document.createElement('canvas');
  cv.width = 640; cv.height = 140;
  const x = cv.getContext('2d');
  x.textBaseline = 'middle'; x.textAlign = 'left';
  const f1 = 'bold 60px "Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
  const f2 = 'bold 40px "Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
  x.font = f1; const w1 = x.measureText(name).width;
  x.font = f2; const w2 = x.measureText(title).width;
  const w = Math.min(620, w1 + w2 + 108), x0 = (640 - w) / 2;
  x.fillStyle = 'rgba(10,12,30,0.78)';
  x.beginPath(); x.roundRect(x0, 14, w, 112, 36); x.fill();
  x.lineWidth = 5; x.strokeStyle = LV_COL[lv]; x.globalAlpha = lv ? 0.95 : 0.7; x.stroke(); x.globalAlpha = 1;
  x.fillStyle = white ? '#f4efe0' : '#3a3d55'; x.strokeStyle = white ? '#6b5a30' : '#c8cbe6'; x.lineWidth = 3;
  x.beginPath(); x.arc(x0 + 34, 70, 13, 0, PI * 2); x.fill(); x.stroke();
  x.lineJoin = 'round';
  x.font = f1; x.lineWidth = 8; x.strokeStyle = 'rgba(5,6,20,0.95)'; x.fillStyle = '#ffffff';
  x.strokeText(name, x0 + 58, 72); x.fillText(name, x0 + 58, 72);
  x.font = f2; x.fillStyle = LV_COL[lv]; x.lineWidth = 6;
  x.strokeText(title, x0 + 58 + w1 + 14, 76); x.fillText(title, x0 + 58 + w1 + 14, 76);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  const sw = lv ? 1.9 : 1.6;
  sp.scale.set(sw, sw * 140 / 640, 1);
  sp.renderOrder = 10;
  return sp;
}

export class View {
  constructor(el, { onPick, fxLayer }) {
    this.el = el; this.onPick = onPick; this.fxLayer = fxLayer;
    this.fast = 1; // 1, 2, 'skip'
    this.timeScale = 1; // 慢動作用：<1 時遊戲時間變慢
    this.tweens = []; this.fx = []; this.rfx = []; // rfx 以真實時間推進（不受慢動作影響）
    this.follow = null;
    this.pieces = new Map();
    this.shakeAmp = 0; this.shakeT = 0;
    this.cine = null;
    this.cineEl = document.createElement('div'); this.cineEl.className = 'cinebars'; this.cineEl.innerHTML = '<i></i><i></i><b></b>';
    this.flashEl = document.createElement('div'); this.flashEl.className = 'flash';
    fxLayer.appendChild(this.cineEl); fxLayer.appendChild(this.flashEl);
    this.cam = { theta: 0, phi: 0.9, radius: 15.5, target: new THREE.Vector3(0, 0, 0.4) };
    this.curPos = new THREE.Vector3(); this.curLook = new THREE.Vector3(0, 0, 0.3);

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    el.appendChild(r.domElement);
    r.domElement.style.display = 'block';
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1024);
    this.scene.fog = new THREE.Fog(0x0d1024, 22, 46);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this._lights(); this._board();
    this.hl = new THREE.Group(); this.scene.add(this.hl);
    this._base = new Set(this.scene.children);
    this.raycaster = new THREE.Raycaster(); this.ptr = new THREE.Vector2();
    this._input();
    this.resize();
    this._applyCam(1, true);
    window.addEventListener('resize', () => this.resize());
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(el);
    this._last = performance.now();
    const loop = (t) => { this._frame(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  _lights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xcfd8ff, 0x2a2018, 1.15); s.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xfff2dd, 2.6);
    this.key.position.set(6, 12, 7); this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 34 });
    this.key.shadow.bias = -0.0004; this.key.shadow.radius = 4;
    s.add(this.key);
    this.fill = new THREE.DirectionalLight(0x6a8cff, 0.7); this.fill.position.set(-8, 6, -6); s.add(this.fill);
    this.spot = new THREE.SpotLight(0xff6a48, 0, 16, 0.55, 0.7, 1.1);
    this.spot.position.set(0, 6, 0); s.add(this.spot); s.add(this.spot.target);
  }

  _board() {
    const s = this.scene;
    const base = new THREE.Mesh(new THREE.BoxGeometry(9.7, 0.6, 9.7), new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.55, metalness: 0.2 }));
    base.position.y = -0.38; base.receiveShadow = true; base.castShadow = true; s.add(base);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.1, 8.5), new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.8 }));
    trim.position.y = -0.1; s.add(trim);
    const lm = new THREE.MeshStandardMaterial({ color: 0xe9dcb8, roughness: 0.5, metalness: 0.05 });
    const dm = new THREE.MeshStandardMaterial({ color: 0x6a4630, roughness: 0.5, metalness: 0.08 });
    this.squares = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1), (r + c) % 2 === 0 ? lm : dm);
      const p = sqPos(r, c); m.position.set(p.x, -0.06, p.z);
      m.receiveShadow = true; m.userData.sq = [r, c]; s.add(m); this.squares.push(m);
    }
    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: 0x151a35, roughness: 0.95 }));
    ground.rotation.x = -PI / 2; ground.position.y = -0.72; ground.receiveShadow = true; s.add(ground);
    const mk = (t) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const x = cv.getContext('2d'); x.fillStyle = '#d9c48a'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 32, 34);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
      sp.scale.set(0.45, 0.45, 1); return sp;
    };
    for (let i = 0; i < 8; i++) {
      const f = mk('abcdefgh'[i]); f.position.set(i - 3.5, 0.02, 4.5); s.add(f);
      const f2 = mk('abcdefgh'[i]); f2.position.set(i - 3.5, 0.02, -4.5); s.add(f2);
      const n = mk(String(8 - i)); n.position.set(-4.5, 0.02, i - 3.5); s.add(n);
      const n2 = mk(String(8 - i)); n2.position.set(4.5, 0.02, i - 3.5); s.add(n2);
    }
  }

  // ===== 輸入 =====
  _input() {
    const cvs = this.renderer.domElement;
    cvs.style.touchAction = 'none';
    const ptrs = new Map();
    let moved = 0, pinch = 0;
    cvs.addEventListener('pointerdown', (e) => {
      cvs.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    });
    cvs.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId);
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      moved += Math.abs(dx) + Math.abs(dy);
      if (this.cine) return;
      if (ptrs.size === 1) {
        this.cam.theta -= dx * 0.006;
        this.cam.phi = Math.min(1.5, Math.max(0.08, this.cam.phi - dy * 0.006));
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        this.cam.radius = Math.min(32, Math.max(5, this.cam.radius * (pinch / d))); pinch = d; this._userZoomed = true;
      }
    });
    const up = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (moved < 7 && e.type === 'pointerup') this._pick(e);
    };
    cvs.addEventListener('pointerup', up);
    cvs.addEventListener('pointercancel', (e) => ptrs.delete(e.pointerId));
    cvs.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.cine) return;
      this.cam.radius = Math.min(32, Math.max(5, this.cam.radius * (1 + e.deltaY * 0.0012))); this._userZoomed = true;
    }, { passive: false });
  }

  _pick(e) {
    const rc = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ptr, this.camera);
    const meshes = [];
    for (const rec of this.pieces.values()) rec.group.traverse((o) => { if (o.isMesh) { o.userData.rec = rec; meshes.push(o); } });
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    if (hit) { const rec = hit.object.userData.rec; this.onPick(rec.r, rec.c); return; }
    const sq = this.raycaster.intersectObjects(this.squares, false)[0];
    if (sq) this.onPick(sq.object.userData.sq[0], sq.object.userData.sq[1]);
  }

  resize() {
    const w = this.el.clientWidth || window.innerWidth, h = this.el.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h; this.camera.fov = w / h < 0.8 ? 56 : 40;
    const sh = w > 900 ? 150 : 0, sy = this.shiftY || 0;
    if (sh || sy) this.camera.setViewOffset(w, h, sh, sy, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    const hf = Math.atan(Math.tan((this.camera.fov * PI) / 360) * this.camera.aspect);
    this.fitR = Math.max(15.5, 6.4 / Math.tan(hf));
    if (this.cam.radius < this.fitR && !this._userZoomed) this.cam.radius = this.fitR;
  }

  // ===== 運鏡 =====
  setPreset(name) {
    const P = { white: [0, 0.9, 15.5], black: [PI, 0.9, 15.5], top: [0, 0.14, 16.5], side: [0.85, 1.12, 14.5] };
    const [t, p, r] = P[name] || P.white;
    const d = ((((t - this.cam.theta + PI) % (2 * PI)) + 2 * PI) % (2 * PI)) - PI;
    this.cam.theta += d; this.cam.phi = p; this.cam.radius = Math.max(r, this.fitR || 0); this._userZoomed = false;
  }
  _applyCam(dt, snap = false) {
    let pos, look;
    if (this.cine) { pos = this.cine.pos; look = this.cine.look; }
    else {
      const { theta, phi, radius, target } = this.cam;
      pos = new THREE.Vector3(target.x + radius * Math.sin(phi) * Math.sin(theta), target.y + radius * Math.cos(phi), target.z + radius * Math.sin(phi) * Math.cos(theta));
      look = target;
    }
    const k = snap ? 1 : 1 - Math.exp(-dt * (this.follow ? this.follow.stiff : this.cine ? 5 : 7));
    this.curPos.lerp(pos, k); this.curLook.lerp(look, k);
    this.camera.position.copy(this.curPos);
    if (this.shakeT > 0) {
      const a = this.shakeAmp * (this.shakeT / 0.4);
      this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a));
    }
    this.camera.lookAt(this.curLook);
  }
  shake(amp = 0.25) { this.shakeAmp = amp; this.shakeT = 0.4; }
  _pairCam(a, b, dist, height, lookY, shiftDown = 0) {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a); dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    if (perp.dot(this.curPos.clone().sub(mid)) < 0) perp.negate();
    this.cine = {
      pos: mid.clone().addScaledVector(perp, dist).add(new THREE.Vector3(0, height, 0)),
      look: mid.clone().add(new THREE.Vector3(0, lookY - shiftDown, 0)),
    };
  }
  releaseCam() { this.cine = null; }

  // ===== 時間軸 =====
  tween(dur, fn, ease = easeIO) {
    return new Promise((res) => this.tweens.push({ dur: Math.max(dur, 0.0001), t: 0, fn, ease, res }));
  }
  wait(s) { return this.tween(s, () => {}); }
  _frame(now) {
    const dt = Math.min(0.1, (now - this._last) / 1000); this._last = now;
    const mul = this.fast === 'skip' ? 60 : this.fast;
    const ts = this.timeScale;
    for (const tw of [...this.tweens]) {
      tw.t += dt * mul * ts;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.ease(k));
      if (k >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.res(); }
    }
    const fdt = dt * Math.min(mul, 2.5) * ts;
    // 注意：特效執行中可能再新增特效（如 burst），不可用 filter 直接覆蓋陣列，否則新增者會遺失、網格永遠殘留
    for (const key of ['fx', 'rfx']) {
      const cur = this[key], d = key === 'fx' ? fdt : dt, keep = [];
      this[key] = [];
      for (const f of cur) if (f(d) !== false) keep.push(f);
      this[key] = keep.concat(this[key]);
    }
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    const tt = now / 1000;
    for (const rec of this.pieces.values()) {
      if (rec.ring) { rec.ring.rotation.z += dt * 0.8; rec.ring.material.opacity = 0.65 + Math.sin(tt * 3 + rec.piece.id) * 0.2; }
      if (rec.crown) { rec.crown.rotation.y += dt * 2; rec.crown.position.y = rec.h + 0.62 + Math.sin(tt * 2 + rec.piece.id) * 0.04; }
      for (const it of rec.group.userData.idle || []) {
        if (it.kind === 'halo') { it.obj.rotation.z += dt * 1.6; it.obj.position.y = it.y + Math.sin(tt * 2.2 + rec.piece.id) * 0.035; }
        else if (it.kind === 'flicker') it.obj.material.emissiveIntensity = 0.7 + Math.sin(tt * 9 + rec.piece.id) * 0.25 + Math.sin(tt * 23) * 0.1;
        else if (it.kind === 'pulse') { it.obj.rotation.y += dt * 1.5; it.obj.material.emissiveIntensity = 0.8 + Math.sin(tt * 3) * 0.4; }
      }
    }
    if (this.follow) { // 追蹤鏡頭：從側面跟拍飛行中的物體
      const p = this.follow.obj.position;
      this.cine = {
        pos: p.clone().addScaledVector(this.follow.side, this.follow.dist).addScaledVector(this.follow.fwd, -this.follow.back).add(new THREE.Vector3(0, this.follow.up, 0)),
        look: p.clone().add(new THREE.Vector3(0, 0.4, 0)),
      };
    }
    if (this.hl.userData.pulse) for (const m of this.hl.userData.pulse) m.material.opacity = 0.55 + Math.sin(tt * 5) * 0.3;
    this._applyCam(dt);
    this.renderer.render(this.scene, this.camera);
  }

  // ===== 棋子管理 =====
  addPiece(piece, r, c) {
    const group = buildPiece(piece.type, piece.color);
    const p = sqPos(r, c); group.position.copy(p);
    const rec = { piece, group, r, c, h: HEIGHT[piece.type], ring: null, crown: null, sprite: null };
    this.pieces.set(piece.id, rec);
    this.scene.add(group);
    this.resetFacing(rec);
    this.updateVisual(piece);
    return rec;
  }
  clearFx() { // 重開局：清除上一盤所有殘留特效
    for (const o of [...this.scene.children]) {
      if (this._base.has(o)) continue;
      this.scene.remove(o);
      o.traverse((q) => { if (q.geometry) q.geometry.dispose(); if (q.material) (Array.isArray(q.material) ? q.material : [q.material]).forEach((m) => m.dispose && m.dispose()); });
    }
    while (this.hl.children.length) this.hl.remove(this.hl.children[0]);
    this.hl.userData.pulse = null;
    this.tweens.length = 0; this.fx.length = 0; this.rfx.length = 0;
    this.fxLayer.querySelectorAll('.floatnum').forEach((e) => e.remove());
    this.timeScale = 1; this.follow = null; this._duel = null; this.shakeAmp = 0; this.shakeT = 0;
    this.cinema(false); this.flashEl.classList.remove('go');
    this.key.intensity = 2.6; this.hemi.intensity = 1.15; this.fill.intensity = 0.7; this.spot.intensity = 0;
    this._dim([], false);
  }
  syncAll(board) {
    for (const rec of this.pieces.values()) this.scene.remove(rec.group);
    this.pieces.clear();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c]) this.addPiece(board[r][c], r, c);
  }
  rec(piece) { return this.pieces.get(piece.id); }
  removePiece(piece) {
    const rec = this.rec(piece); if (!rec) return;
    this.scene.remove(rec.group); this.pieces.delete(piece.id);
  }
  rebuild(piece) { // 升變：重建模型
    const rec = this.rec(piece); if (!rec) return;
    const { r, c } = rec; this.removePiece(piece); this.addPiece(piece, r, c);
  }
  updateVisual(piece) {
    const rec = this.rec(piece); if (!rec) return;
    const lv = Math.min(3, piece.kills);
    if (rec.sprite) rec.group.remove(rec.sprite);
    const sp = makeLabel(NAMES[piece.type], titleOf(piece), lv, piece.color === 'w');
    const PROP = { P: 0.12, N: 0.1, B: 0.12, R: 0.12, Q: 0.15, K: 0.15 }[piece.type];
    sp.position.y = rec.h + PROP + (lv >= 3 ? 0.7 : lv ? 0.2 : 0);
    rec.group.add(sp); rec.sprite = sp;
    if (rec.ring) rec.group.remove(rec.ring);
    rec.ring = null;
    if (lv >= 1) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 48), new THREE.MeshBasicMaterial({ color: LV_HEX[lv], transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -PI / 2; ring.position.y = 0.03;
      rec.group.add(ring); rec.ring = ring;
    }
    if (rec.crown) rec.group.remove(rec.crown);
    rec.crown = null;
    if (lv >= 3) {
      const cr = new THREE.Group();
      const gold = new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xaa7a00, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.25 });
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 10, 28), gold); t.rotation.x = PI / 2; cr.add(t);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * PI * 2;
        const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.075), gold); o.position.set(Math.sin(a) * 0.2, 0.1, Math.cos(a) * 0.2); cr.add(o);
      }
      cr.position.y = rec.h + 0.62; rec.group.add(cr); rec.crown = cr;
    }
  }
  resetFacing(rec) {
    rec.group.rotation.y = rec.piece.color === 'w' ? 0 : PI;
  }
  face(rec, target) {
    const dx = target.x - rec.group.position.x, dz = target.z - rec.group.position.z;
    rec.group.rotation.y = Math.atan2(-dx, -dz);
  }

  // ===== 高亮 =====
  setHighlights({ sel = null, targets = [], last = [], check = null } = {}) {
    while (this.hl.children.length) this.hl.remove(this.hl.children[0]);
    const pulse = [];
    const flat = (r, c, color, op, size = 0.96) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
      m.rotation.x = -PI / 2; const p = sqPos(r, c); m.position.set(p.x, 0.012, p.z); this.hl.add(m); return m;
    };
    for (const [r, c] of last) flat(r, c, 0x4aa8ff, 0.28);
    if (check) pulse.push(flat(check[0], check[1], 0xff2a2a, 0.6));
    if (sel) flat(sel[0], sel[1], 0xffe14a, 0.55);
    for (const t of targets) {
      const p = sqPos(t.r, t.c);
      if (t.cap) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 40), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
        m.rotation.x = -PI / 2; m.position.set(p.x, 0.02, p.z); this.hl.add(m); pulse.push(m);
        flat(t.r, t.c, 0xff3b3b, 0.18);
      } else {
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), new THREE.MeshBasicMaterial({ color: 0x45e6c2, transparent: true, opacity: 0.85, depthWrite: false }));
        m.rotation.x = -PI / 2; m.position.set(p.x, 0.02, p.z); this.hl.add(m);
      }
    }
    this.hl.userData.pulse = pulse;
  }

  // ===== 動畫 =====
  async slide(piece, r, c, { hop = 0, dur = 0.45 } = {}) {
    const rec = this.rec(piece); if (!rec) return;
    const a = rec.group.position.clone(), b = sqPos(r, c);
    this.face(rec, b);
    await this.tween(dur, (k) => {
      rec.group.position.lerpVectors(a, b, k);
      rec.group.position.y = Math.sin(k * PI) * hop;
    });
    rec.group.position.copy(b); rec.r = r; rec.c = c;
    this.resetFacing(rec);
  }

  // 棋種專屬移動動畫；onSfx(kind) 讓外部播放對應音效
  async moveAnim(piece, r, c, onSfx) {
    const rec = this.rec(piece); if (!rec) return;
    const g = rec.group, a = g.position.clone(), b = sqPos(r, c);
    const dist = a.distanceTo(b), T = THEME[piece.type];
    this.face(rec, b);
    const fin = () => { g.position.copy(b); g.rotation.x = 0; g.rotation.z = 0; rec.r = r; rec.c = c; this.resetFacing(rec); };
    const snd = (k) => onSfx && onSfx(k);
    switch (piece.type) {
      case 'P': { // 小步快跑，雙步就跳兩下
        const hops = dist > 1.5 ? 2 : 1;
        for (let i = 0; i < hops; i++) {
          const s = a.clone().lerp(b, i / hops), e = a.clone().lerp(b, (i + 1) / hops);
          snd('step');
          await this.tween(0.2, (k) => { g.position.lerpVectors(s, e, k); g.position.y = Math.sin(k * PI) * 0.22; g.rotation.x = -Math.sin(k * PI) * 0.14; });
        }
        break;
      }
      case 'N': { // 高空翻躍，落地塵土
        snd('leap');
        await this.tween(0.62, (k) => {
          g.position.lerpVectors(a, b, k); g.position.y = Math.sin(k * PI) * 1.5;
          g.rotation.x = -Math.sin(k * PI) * 0.5;
          if (k > 0.08 && k < 0.92) this._trail(g.position, T, 0.06, 0.4);
        });
        fin(); this.dust(b, 12, 2.2); this.shake(0.12); snd('land');
        return;
      }
      case 'B': { // 浮起後沿斜線滑行，紫色光痕
        snd('glide');
        await this.tween(0.12, (k) => { g.position.y = k * 0.2; });
        const a2 = a.clone().setY(0.2), b2 = b.clone().setY(0.2);
        await this.tween(0.25 + dist * 0.07, (k) => { g.position.lerpVectors(a2, b2, k); this._trail(g.position, T, 0.07, 0.5); });
        await this.tween(0.12, (k) => { g.position.y = 0.2 * (1 - k); });
        break;
      }
      case 'R': { // 沉重推進，抵達震地
        snd('rumble');
        await this.tween(0.3 + dist * 0.07, (k) => { g.position.lerpVectors(a, b, k); if (Math.random() < 0.45) this.dust(g.position, 1, 0.8); });
        fin(); this.shake(0.18); this.shockwave(b, T, 1.7); snd('thud');
        return;
      }
      case 'Q': { // 浮空滑行，灑落星光
        snd('glide');
        const y0 = g.rotation.y;
        await this.tween(0.42 + dist * 0.06, (k) => {
          g.position.lerpVectors(a, b, k); g.position.y = Math.sin(k * PI) * 0.5;
          g.rotation.y = y0 + Math.sin(k * PI) * 0.6;
          this._trail(g.position, T, 0.06, 0.6);
        });
        fin(); this.sparkle(b, T);
        return;
      }
      case 'K': { // 莊重緩步，落腳金環
        snd('step');
        await this.tween(0.62, (k) => { g.position.lerpVectors(a, b, k); g.position.y = Math.abs(Math.sin(k * PI * 2)) * 0.1; });
        fin(); this.shockwave(b, T, 1.5); snd('chime');
        return;
      }
      default: await this.tween(0.42, (k) => g.position.lerpVectors(a, b, k));
    }
    fin();
  }

  floatText(world, text, cls = '', color = null) {
    const v = world.clone().project(this.camera);
    const rc = this.renderer.domElement.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'floatnum ' + cls; d.textContent = text;
    if (color) d.style.color = color;
    d.style.left = ((v.x + 1) / 2) * rc.width + 'px'; d.style.top = ((1 - v.y) / 2) * rc.height + 'px';
    this.fxLayer.appendChild(d);
    setTimeout(() => d.remove(), cls.includes('skill') ? 1700 : 1400);
  }

  // ===== 特效小工具 =====
  shockwave(pos, color = 0xffd34d, size = 4.2) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 56), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -PI / 2; m.position.set(pos.x, (pos.y < -0.3 ? pos.y : 0) + 0.04, pos.z); this.scene.add(m);
    let t = 0;
    this.fx.push((dt) => {
      t += dt / 0.7; const s = 0.4 + t * size; m.scale.set(s, s, s); m.material.opacity = Math.max(0, 0.95 * (1 - t));
      if (t >= 1) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); return false; }
    });
  }
  burst(pos, color = 0xffd34d, n = 22, power = 4, { y = 0.5, grav = 11, life = 0.9, geo = null } = {}) {
    const g0 = geo || (this._oct ||= new THREE.OctahedronGeometry(0.07));
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(g0, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(pos).add(Y(y)); this.scene.add(m);
      const floor = pos.y - 0.3;
      const v = new THREE.Vector3((Math.random() - 0.5) * power, Math.random() * power * 0.9 + 1.5 * (grav / 11), (Math.random() - 0.5) * power);
      let age = 0;
      this.fx.push((dt) => {
        age += dt; v.y -= grav * dt; m.position.addScaledVector(v, dt);
        m.rotation.x += dt * 8; m.rotation.y += dt * 6;
        const k = age / life; m.material.opacity = Math.max(0, 1 - k); m.scale.setScalar(Math.max(0.01, 1 - k * 0.6));
        if (k >= 1 || m.position.y < floor) { this.scene.remove(m); m.material.dispose(); return false; }
      });
    }
  }
  dust(pos, n = 12, power = 2) {
    this.burst(pos, 0xb9a98c, n, power, { y: 0.05, grav: 5, life: 0.7, geo: (this._dustGeo ||= new THREE.SphereGeometry(0.07, 6, 5)) });
  }
  debris(pos, n = 14) {
    this.burst(pos, 0x9aa3bb, n, 4.6, { y: 0.4, grav: 13, life: 1.0, geo: (this._boxGeo ||= new THREE.BoxGeometry(0.11, 0.11, 0.11)) });
  }
  sparkle(pos, color) { this.burst(pos, color, 16, 2.2, { y: 0.35, grav: 4, life: 0.8 }); }
  _trail(pos, color, size = 0.06, life = 0.45) {
    const m = new THREE.Mesh((this._sph ||= new THREE.SphereGeometry(1, 8, 6)),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.scale.setScalar(size);
    m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.16, 0.3 + Math.random() * 0.35, (Math.random() - 0.5) * 0.16));
    this.scene.add(m);
    let t = 0;
    this.fx.push((dt) => {
      t += dt / life; m.material.opacity = 0.85 * (1 - t); m.scale.setScalar(size * (1 - t * 0.5));
      if (t >= 1) { this.scene.remove(m); m.material.dispose(); return false; }
    });
  }
  beam(from, to, color, radius = 0.05, life = 0.35) {
    const len = from.distanceTo(to);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 12, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    m.scale.set(1, len, 1); this.scene.add(m);
    let t = 0;
    this.fx.push((dt) => {
      t += dt / life; m.material.opacity = 0.95 * (1 - t); m.scale.x = m.scale.z = 1 + t * 1.4;
      if (t >= 1) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); return false; }
    });
  }
  pillar(pos, color, radius = 0.38, life = 0.6) {
    this.beam(pos.clone().add(Y(7)), pos.clone().add(Y(-0.05)), color, radius, life);
    this.beam(pos.clone().add(Y(7)), pos.clone().add(Y(-0.05)), 0xffffff, radius * 0.35, life * 0.8);
    this.shockwave(pos, color, 2.2);
  }
  slash(pos, dir, color, mirror = false) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 6, 40, PI * 0.95),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const c = pos.clone().add(Y(0.6));
    m.position.copy(c); m.lookAt(c.clone().sub(dir)); m.rotateZ(mirror ? 2.4 : -0.7);
    this.scene.add(m);
    let t = 0;
    this.fx.push((dt) => {
      t += dt / 0.32; m.rotateZ((mirror ? -1 : 1) * dt * 6); m.scale.setScalar(0.7 + t * 0.6); m.material.opacity = 1 - t;
      if (t >= 1) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); return false; }
    });
  }
  hexShield(pos, color) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.66, 1), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.copy(pos).add(Y(0.5)); this.scene.add(m);
    let t = 0;
    this.fx.push((dt) => {
      t += dt / 0.45; m.scale.setScalar(0.9 + t * 0.25); m.material.opacity = 0.9 * (1 - t); m.rotation.y += dt * 2;
      if (t >= 1) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); return false; }
    });
  }
  bubble(pos, color) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.86, 24, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(pos).add(Y(0.6)); this.scene.add(m);
    let t = 0;
    this.fx.push((dt) => {
      t += dt / 0.7; m.material.opacity = 0.35 * (1 - t); m.scale.setScalar(1 + Math.sin(t * PI) * 0.08);
      if (t >= 1) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); return false; }
    });
  }
  flash(piece, color = 0xffd34d, dur = 0.5) {
    const rec = this.rec(piece); if (!rec) return;
    const mats = []; rec.group.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) mats.push([o.material, o.material.emissive.clone(), o.material.emissiveIntensity]); });
    let t = 0; const col = new THREE.Color(color);
    this.fx.push((dt) => {
      t += dt / dur; const k = Math.sin(Math.min(1, t) * PI);
      for (const [m, e0, i0] of mats) { m.emissive.copy(e0).lerp(col, k); m.emissiveIntensity = i0 + k * 1.4; }
      if (t >= 1) { for (const [m, e0, i0] of mats) { m.emissive.copy(e0); m.emissiveIntensity = i0; } return false; }
    });
  }
  whiteFlash(strength = 0.9) {
    const el = this.flashEl; el.style.setProperty('--fl', strength);
    el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  }
  cinema(on, caption = '') {
    this.cineEl.classList.toggle('on', on);
    document.body.classList.toggle('cine', on);
    const b = this.cineEl.querySelector('b');
    if (on) { b.textContent = caption; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
  }
  realWait(s) {
    return new Promise((res) => { let t = 0; this.rfx.push((dt) => { t += dt; if (t >= s) { res(); return false; } }); });
  }
  realRamp(s, from, to) {
    return new Promise((res) => {
      let t = 0;
      this.rfx.push((dt) => { t += dt; const k = Math.min(1, t / s); this.timeScale = from + (to - from) * easeIO(k); if (k >= 1) { res(); return false; } });
    });
  }
  resetTime() { this.timeScale = 1; this.follow = null; this.rfx.length = 0; this.cinema(false); }

  // 擊飛：沿推力向量拋物線翻滾飛出，落地彈跳揚塵後消失
  knockOff(piece, dir, opt = {}) {
    const rec = this.rec(piece); if (!rec) return Promise.resolve();
    this.pieces.delete(piece.id);
    const g = rec.group; if (rec.sprite) g.remove(rec.sprite); if (rec.ring) g.remove(rec.ring);
    const d = dir.clone(); d.y = 0; if (d.lengthSq() < 1e-6) d.set(0, 0, -1); d.normalize();
    const pw = opt.power || 1;
    const v = d.clone().multiplyScalar(7.5 * pw).add(new THREE.Vector3(0, 8.5 * pw, 0));
    const spin = new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12);
    let t = 0, bounces = 0, fade = -1;
    const lastEmit = g.position.clone();
    return new Promise((res) => {
      this.fx.push((dt) => {
        t += dt;
        if (fade < 0) {
          v.y -= 18 * dt; g.position.addScaledVector(v, dt);
          g.rotation.x += spin.x * dt; g.rotation.y += spin.y * dt; g.rotation.z += spin.z * dt;
          if (opt.trail !== undefined && g.position.distanceTo(lastEmit) > 0.16) {
            lastEmit.copy(g.position);
            this._trail(g.position, opt.trail, 0.055, 0.9); this._trail(g.position, 0xffffff, 0.025, 0.5);
          }
          const onBoard = Math.abs(g.position.x) < 4.85 && Math.abs(g.position.z) < 4.85;
          const gy = onBoard ? 0 : -0.72;
          if (g.position.y < gy && v.y < 0) {
            g.position.y = gy; bounces++;
            const first = bounces === 1;
            this.dust(g.position, first ? 20 : 8, first ? 3.2 : 1.6);
            if (first) { this.shake(0.3); this.shockwave(g.position, 0xb9a98c, 2.2); opt.onLand && opt.onLand(); }
            v.y = -v.y * 0.32; v.x *= 0.5; v.z *= 0.5; spin.multiplyScalar(0.45);
            if (bounces >= 2) fade = 0;
          }
        } else {
          fade += dt / 0.45; g.scale.setScalar(Math.max(0.01, 1 - fade));
        }
        if (fade >= 1 || t > 4) { this.scene.remove(g); res(); return false; }
      });
    });
  }

  // ===== 決鬥演出 =====
  quizFocus(attP, defP) {
    const a = this.rec(attP).group.position, b = this.rec(defP).group.position;
    this._pairCam(a, b, 5.2, 3.0, 0.5, 0.9);
  }
  async duelBegin(attP, defP) {
    const A = this.rec(attP), D = this.rec(defP);
    const dp = D.group.position.clone(), ap = A.group.position.clone();
    const dir = dp.clone().sub(ap); dir.y = 0; dir.normalize();
    const stop = dp.clone().addScaledVector(dir, -1.3);
    this.face(A, dp); this.face(D, ap);
    this.key.intensity = 0.9; this.hemi.intensity = 0.55; this.fill.intensity = 0.3;
    const mid = stop.clone().add(dp).multiplyScalar(0.5);
    this.spot.position.set(mid.x, 6.5, mid.z); this.spot.target.position.set(mid.x, 0, mid.z);
    this.spot.intensity = 0;
    this._dim([attP.id, defP.id], true);
    this._pairCam(stop, dp, 3.9, 1.55, 0.6, 0.35);
    const from = ap.clone();
    await Promise.all([
      this.tween(0.55, (k) => { A.group.position.lerpVectors(from, stop, k); A.group.position.y = Math.sin(k * PI) * 0.25; }),
      this.tween(0.7, (k) => { this.spot.intensity = 90 * k; }),
    ]);
    this._duel = { A, D, stop, dp, named: {} };
  }

  // 一次行動（1～2 次打擊）。info: { final, legion, onSkill }
  async duelStrike(side, strikes, onHit, info = {}) {
    const { A, D } = this._duel;
    const actor = side === 'att' ? A : D, target = side === 'att' ? D : A;
    const type = actor.piece.type, T = THEME[type];
    const g = actor.group;
    const home = g.position.clone();
    const dir = target.group.position.clone().sub(home); dir.y = 0; dir.normalize();
    if (!this._duel.named[side]) { // 首次出手喊出招式名
      this._duel.named[side] = true;
      const extra = type === 'P' && info.legion ? '・軍團 +5' : '';
      this.floatText(home.clone().add(Y(actor.h + 1.0)), `${SKILL[type].name}${extra}`, 'skill', '#' + T.toString(16).padStart(6, '0'));
      if (type === 'P' && info.legion) this.flash(actor.piece, 0x6fd0ff, 0.6);
      info.onSkill && info.onSkill(type);
      await this.wait(0.3);
    }
    for (let i = 0; i < strikes.length; i++) {
      const s = strikes[i];
      const last = info.final && i === strikes.length - 1;
      const tp = target.group.position.clone();
      const hit = home.clone().addScaledVector(dir, 0.62);
      // ---- 出招 ----
      switch (type) {
        case 'P': { // 後拉、突刺、槍芒
          const back = home.clone().addScaledVector(dir, -0.2);
          await this.tween(0.12, (k) => { g.position.lerpVectors(home, back, k); g.rotation.x = 0.12 * k; });
          await this.tween(0.1, (k) => { g.position.lerpVectors(back, hit, k); g.rotation.x = 0.12 - 0.3 * k; }, easeOut);
          g.rotation.x = 0;
          this.beam(home.clone().add(Y(0.75)), tp.clone().add(Y(0.5)), T, 0.035, 0.3);
          break;
        }
        case 'N': { // 躍起俯衝
          const over = tp.clone().addScaledVector(dir, -0.45);
          await this.tween(0.36, (k) => { g.position.lerpVectors(home, over, k); g.position.y = Math.sin(k * PI) * 1.45; g.rotation.x = -0.65 * k; this._trail(g.position, T, 0.06, 0.4); });
          g.rotation.x = 0; this.dust(over, 10, 2.4);
          break;
        }
        case 'B': { // 浮起、聖光柱
          await this.tween(0.22, (k) => { g.position.y = 0.35 * k; });
          this.flash(actor.piece, T, 0.5);
          this.pillar(tp, T);
          this.beam(g.position.clone().add(Y(1.25)), tp.clone().add(Y(0.6)), 0xffffff, 0.05, 0.35);
          await this.wait(0.12);
          break;
        }
        case 'R': { // 蓄力後衝撞
          const back = home.clone().addScaledVector(dir, -0.32);
          await this.tween(0.26, (k) => { g.position.lerpVectors(home, back, k); g.position.y = 0.28 * k; g.rotation.x = 0.22 * k; });
          await this.tween(0.13, (k) => { g.position.lerpVectors(back, hit, k); g.position.y = 0.28 * (1 - k); g.rotation.x = 0.22 - 0.45 * k; }, easeOut);
          g.rotation.x = 0; this.debris(tp, 14); this.shockwave(tp, T, 3);
          break;
        }
        case 'Q': { // 旋身斬擊（兩擊方向相反）
          const y0 = g.rotation.y;
          await this.tween(0.14, (k) => { g.position.lerpVectors(home, hit, k); g.rotation.y = y0 + (i % 2 ? -1 : 1) * k * PI * 2; }, easeOut);
          g.rotation.y = y0;
          this.slash(tp, dir, T, i % 2 === 1);
          break;
        }
        case 'K': { // 金光加身、權杖裁決
          this.pillar(home, T, 0.3, 0.45);
          await this.tween(0.22, (k) => { g.position.y = 0.22 * Math.sin(k * PI); });
          await this.tween(0.13, (k) => g.position.lerpVectors(home, hit, k), easeOut);
          this.slash(tp, dir, T, false); this.shockwave(tp, T, 2.6);
          break;
        }
        default:
          await this.tween(0.16, (k) => g.position.lerpVectors(home, hit, k), easeOut);
      }
      // ---- 命中 ----
      const tType = target.piece.type;
      this.shake(s.crit ? 0.45 : type === 'R' ? 0.36 : 0.22);
      this.burst(tp, s.crit ? 0xff9a2a : T, s.crit ? 30 : 14, s.crit ? 5.5 : 3.4);
      if (s.crit) { this.shockwave(tp, 0xff9a2a, 3.8); this.whiteFlash(0.35); }
      if (tType === 'R') this.hexShield(tp, THEME.R);
      if (s.absorbed > 0 || s.shieldGain) this.bubble(tp, THEME.K);
      const label = s.absorbed && s.absorbed >= s.dmg ? `🛡 ${s.dmg}` : `-${s.dmg}`;
      const tag = s.crit ? '暴擊 ' : '';
      this.floatText(tp.clone().add(Y(target.h + 0.3)), tag + label, s.crit ? 'crit' : (side === 'att' ? 'dmgA' : 'dmgD'));
      if (tType === 'R' && i === 0) this.floatText(tp.clone().add(Y(target.h - 0.2)), '鐵壁 −3', 'tiny', '#8ccaff');
      if (type === 'B' && i === 0) this.floatText(tp.clone().add(Y(target.h - 0.2)), '破甲 50%', 'tiny', '#c79bff');
      if (s.shieldGain) this.floatText(tp.clone().add(Y(target.h + 0.85)), '王之護佑 +25', 'shield');
      onHit && onHit(s);
      if (last) return; // 終結一擊：停在命中位置，由慢動作鏡頭接手
      // 受擊後仰，再回到原位
      const base = target.group.position.clone();
      await this.tween(0.12, (k) => { target.group.position.copy(base).addScaledVector(dir, 0.2 * Math.sin(k * PI)); target.group.rotation.x = -0.18 * Math.sin(k * PI); });
      target.group.rotation.x = 0;
      const now = g.position.clone();
      await this.tween(0.18, (k) => { g.position.lerpVectors(now, home, k); g.position.y = (1 - k) * now.y; });
      g.position.copy(home);
      await this.wait(0.1);
    }
  }

  // ===== 慢動作擊飛（決鬥勝利） =====
  async knockoutCinematic(loserP, winnerP, { onImpact, onLand, caption = 'K.O.!' } = {}) {
    const L = this.rec(loserP); if (!L) return;
    const W = this.rec(winnerP);
    const lp = L.group.position.clone();
    const wp = W ? W.group.position.clone() : lp.clone().add(Y(0)).setZ(lp.z + 1);
    const dir = lp.clone().sub(wp); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); dir.normalize();
    const col = THEME[winnerP.type];
    if (this.fast === 'skip') { // 跳過時只播普通擊飛
      this.fast = 1; onImpact && onImpact();
      return this.knockOff(loserP, dir, { onLand });
    }
    this.fast = 1;
    // 1) 定格＋閃白
    this.cinema(true, caption);
    this.whiteFlash(0.95);
    this.shockwave(lp, 0xffffff, 3.2); this.shockwave(lp, col, 5.6);
    this.burst(lp, col, 40, 6.5);
    onImpact && onImpact();
    this.timeScale = 0.04;
    await this.realWait(0.26);
    // 2) 慢動作飛出，側面追蹤
    this.timeScale = 0.14;
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    if (side.dot(this.curPos.clone().sub(lp)) < 0) side.negate();
    const fly = this.knockOff(loserP, dir, { power: 1.12, trail: col, onLand });
    this.follow = { obj: L.group, side, fwd: dir, dist: 3.3, back: 1.5, up: 1.0, stiff: 7 };
    await this.realWait(1.4);
    // 3) 回到正常速度看落地
    await this.realRamp(0.6, 0.14, 1);
    await fly;
    await this.realWait(0.35);
    this.follow = null; this.timeScale = 1; this.cinema(false);
  }

  // ===== 慢動作擊退（決鬥落敗的進攻方，依規則彈回原格） =====
  async bounceCinematic(attP, r, c, winnerP, { onImpact, onLand } = {}) {
    const A = this.rec(attP); if (!A) return;
    if (this.fast === 'skip') { this.fast = 1; onImpact && onImpact(); await this.bounceBack(attP, r, c); onLand && onLand(); return; }
    this.fast = 1;
    const ap = A.group.position.clone(), b = sqPos(r, c);
    const col = THEME[winnerP.type];
    this.cinema(true, '擊退！');
    this.whiteFlash(0.6);
    this.shockwave(ap, col, 3.6); this.burst(ap, col, 26, 5);
    onImpact && onImpact();
    this.timeScale = 0.04;
    await this.realWait(0.2);
    this.timeScale = 0.22;
    const dir = b.clone().sub(ap); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    if (side.dot(this.curPos.clone().sub(ap)) < 0) side.negate();
    this.follow = { obj: A.group, side, fwd: dir, dist: 3.1, back: 1.2, up: 1.2, stiff: 7 };
    const p = this.bounceBack(attP, r, c, { hop: 1.7, dur: 0.85, trail: THEME[attP.type], spin: true });
    await this.realWait(0.95);
    await this.realRamp(0.45, 0.22, 1);
    await p;
    this.dust(b, 14, 2.4); this.shake(0.2); onLand && onLand();
    await this.realWait(0.3);
    this.follow = null; this.timeScale = 1; this.cinema(false);
  }

  async duelEnd() {
    this._dim([], false);
    this.fast = this.fast === 'skip' ? 1 : this.fast;
    this.key.intensity = 2.6; this.hemi.intensity = 1.15; this.fill.intensity = 0.7;
    await this.tween(0.4, (k) => { this.spot.intensity = 90 * (1 - k); });
    this.spot.intensity = 0; this._duel = null;
  }
  _dim(keep, on) {
    for (const rec of this.pieces.values()) {
      if (keep.includes(rec.piece.id)) continue;
      rec.group.traverse((o) => {
        if (o.isMesh) { o.material.transparent = on; o.material.opacity = on ? 0.1 : 1; o.material.depthWrite = !on; o.material.needsUpdate = true; o.castShadow = !on; }
        else if (o.isSprite) o.visible = !on;
      });
    }
  }
  // 知識秒殺：衝刺、金色震波、擊飛
  async quizKill(attP, defP) {
    const A = this.rec(attP), D = this.rec(defP);
    const ap = A.group.position.clone(), dp = D.group.position.clone();
    const dir = dp.clone().sub(ap); dir.y = 0; dir.normalize();
    const stop = dp.clone().addScaledVector(dir, -0.85);
    this.face(A, dp);
    this.flash(attP, 0xffd34d, 0.9);
    await this.tween(0.34, (k) => { A.group.position.lerpVectors(ap, stop, k); this._trail(A.group.position, THEME[attP.type], 0.06, 0.4); }, easeOut);
    this.shake(0.5); this.shockwave(dp, 0xffd34d, 5.2); this.shockwave(dp, 0xffffff, 3);
    this.burst(dp, 0xffd34d, 36, 6);
    const fly = this.knockOff(defP, dir, { trail: 0xffd34d });
    await this.wait(0.45);
    return fly;
  }
  async bounceBack(attP, r, c, { hop = 0.9, dur = 0.5, trail, spin = false } = {}) {
    const A = this.rec(attP); if (!A) return;
    const a = A.group.position.clone(), b = sqPos(r, c);
    this.face(A, b);
    const y0 = A.group.rotation.y;
    await this.tween(dur, (k) => {
      A.group.position.lerpVectors(a, b, k); A.group.position.y = Math.sin(k * PI) * hop;
      if (spin) A.group.rotation.x = Math.sin(k * PI) * -1.1; else A.group.rotation.z = Math.sin(k * PI * 2) * 0.25;
      if (trail !== undefined && Math.random() < 0.35) this._trail(A.group.position, trail, 0.05, 0.6);
    });
    A.group.position.copy(b); A.group.rotation.set(0, y0, 0); A.r = r; A.c = c; this.resetFacing(A);
  }
}
