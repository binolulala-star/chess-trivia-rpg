// RPG 數值、成長、頭銜、決鬥結算、抽題袋（依 v2.0 + v2.1 補遺）
export const NAMES = { P: '兵', N: '騎士', B: '主教', R: '城堡', Q: '皇后', K: '國王' };
export const SUBJECTS = { P: '英語', N: '數學', B: '社會', R: '自然', Q: '國文', K: '綜合素養' };
export const BASE = {
  P: { hp: 30, atk: 16, def: 3 },
  N: { hp: 50, atk: 28, def: 6 },
  B: { hp: 45, atk: 32, def: 4 },
  R: { hp: 75, atk: 26, def: 12 },
  Q: { hp: 85, atk: 42, def: 10 },
  K: { hp: 110, atk: 22, def: 15 },
};
export const PASSIVE = {
  P: '軍團刺擊：九宮格鄰近有友方兵時，攻擊力 +5',
  N: '神速突刺：攻擊有 35% 機率觸發 1.5 倍暴擊',
  B: '聖光穿透：攻擊直接無視目標 50% 防禦力',
  R: '鐵壁堅守：受到的所有攻擊傷害固定減少 3 點',
  Q: '女王威壓：每次普通攻擊皆發動連續 2 次打擊',
  K: '王之護佑：生命低於 35 時，自動獲得一次 25 點護盾',
};
// 棋種特色：專屬招式、代表色、移動風格（純演出，不影響數值）
export const SKILL = {
  P: { name: '長槍突刺', role: '前線步兵', move: '小步快跑，雙步前進時連跳兩下', desc: '持槍突進刺擊；身旁有友方兵時發動「軍團刺擊」' },
  N: { name: '神速突刺', role: '突擊騎兵', move: '高空翻躍越過棋子，落地揚起塵土', desc: '躍上半空俯衝而下，35% 機率爆發 1.5 倍暴擊' },
  B: { name: '聖光穿透', role: '光之祭司', move: '頭頂光環，沿斜線滑行並留下紫色光痕', desc: '降下聖光柱貫穿敵人，無視一半防禦' },
  R: { name: '鐵壁衝撞', role: '重裝堡壘', move: '沉重推進，抵達時震動棋盤', desc: '蓄力後全身衝撞；受擊時以鐵壁減傷 3 點' },
  Q: { name: '女王連斬', role: '雙刃女王', move: '浮空滑行，灑落桃紅星光', desc: '旋身揮出兩道刀光，每次行動連擊兩次' },
  K: { name: '王者裁決', role: '王權守護', move: '莊重緩步，落腳處綻放金環', desc: '金色權杖裁決；瀕危時展開 25 點王之護盾' },
};
export const THEME = { P: 0xc8894a, N: 0xff8a2a, B: 0xb47bff, R: 0x6fb8ff, Q: 0xff5fb0, K: 0xffd34d };
export const THEME_CSS = { P: '#e0a466', N: '#ff9a45', B: '#c79bff', R: '#8ccaff', Q: '#ff7fc2', K: '#ffd54a' };

export const GROWTH = {
  P: [8, 3, 1], N: [14, 5, 2], B: [14, 5, 2], R: [20, 7, 3], Q: [30, 12, 5],
};
export const PROMO_CARRY = 0.5;
export const AI_ACC = { easy: 0.4, medium: 0.65, hard: 0.85 };
export const AI_NAME = { easy: '簡單', medium: '中等', hard: '困難' };
export const VALUE = { P: 10, N: 32, B: 33, R: 50, Q: 95, K: 0 };

const TITLES = {
  P: ['新兵', '★先鋒', '★★百夫長', '★★★傳奇弒神者'],
  L: ['侍從', '★騎士長', '★★皇家近衛', '★★★傳奇戰神'],
  H: ['守衛', '★鐵衛', '★★堡壘戰將', '★★★永恆霸主'],
};
export function titleOf(p) {
  const cls = p.type === 'P' ? 'P' : (p.type === 'N' || p.type === 'B') ? 'L' : 'H';
  return TITLES[cls][Math.min(3, p.kills)];
}
export function statsOf(p) {
  const b = BASE[p.type];
  return { hp: b.hp + p.gHP, atk: b.atk + p.gATK, def: b.def + p.gDEF };
}
// 擊殺成長（最多 3 次），回傳實際獲得的加成
export function grantKill(p, victimType) {
  const g = GROWTH[victimType];
  if (!g || p.kills >= 3) return null;
  p.kills++; p.gHP += g[0]; p.gATK += g[1]; p.gDEF += g[2];
  return { hp: g[0], atk: g[1], def: g[2] };
}
// 升變後（type 已改變）：保留擊殺次數，成長加成折半（無條件捨去）
export function carryPromotion(p) {
  p.gHP = Math.floor(p.gHP * PROMO_CARRY);
  p.gATK = Math.floor(p.gATK * PROMO_CARRY);
  p.gDEF = Math.floor(p.gDEF * PROMO_CARRY);
}

// 九宮格內是否有友方兵（board 為棋盤，sq 為該棋子所在格）
export function hasFriendPawn(board, r, c, color) {
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
    const q = board[rr][cc];
    if (q && q.type === 'P' && q.color === color) return true;
  }
  return false;
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fighter(p, friend) {
  const s = statsOf(p);
  return { type: p.type, max: s.hp, hp: s.hp, atk: s.atk, def: s.def, friend, shield: 0, used: false };
}
function strike(a, d, rng, first) {
  let atk = a.atk + (a.type === 'P' && a.friend ? 5 : 0);
  if (first) atk = Math.floor(atk * 0.8);
  let crit = false;
  if (a.type === 'N' && rng() < 0.35) { atk = Math.floor(atk * 1.5); crit = true; }
  const df = a.type === 'B' ? Math.floor(d.def / 2) : d.def;
  const guard = d.type === 'R' ? 3 : 0;
  const dmg = Math.max(1, atk - df - guard);
  const absorbed = Math.min(d.shield, dmg);
  d.shield -= absorbed;
  d.hp -= dmg - absorbed;
  let shieldGain = 0;
  if (d.type === 'K' && !d.used && d.hp < 35 && d.hp > 0) { d.used = true; d.shield = 25; shieldGain = 25; }
  return { dmg, crit, absorbed, shieldGain };
}

// 單場決鬥結算。防守方先手；進攻方第 1 次行動 ATK ×0.8；上限各 30 次行動。
// 回傳 { winner:'att'|'def', events:[{side, strikes:[{dmg,crit,absorbed,shieldGain,tHp,tShield}], aHp,dHp,aSh,dSh}], seed }
export function resolveDuel(attP, defP, ctx, seed) {
  const rng = mulberry32(seed);
  const A = fighter(attP, ctx.attFriend), D = fighter(defP, ctx.defFriend);
  const events = [];
  let na = 0;
  const snap = (side, strikes) => events.push({ side, strikes, aHp: Math.max(0, A.hp), dHp: Math.max(0, D.hp), aSh: A.shield, dSh: D.shield });
  for (let round = 0; round < 30; round++) {
    // 防守方行動
    let strikes = [];
    for (let i = 0; i < (D.type === 'Q' ? 2 : 1); i++) {
      const s = strike(D, A, rng, false);
      s.tHp = Math.max(0, A.hp); s.tShield = A.shield; strikes.push(s);
      if (A.hp <= 0) break;
    }
    snap('def', strikes);
    if (A.hp <= 0) return { winner: 'def', events, seed, A, D };
    // 進攻方行動
    strikes = [];
    for (let i = 0; i < (A.type === 'Q' ? 2 : 1); i++) {
      const s = strike(A, D, rng, na === 0);
      s.tHp = Math.max(0, D.hp); s.tShield = D.shield; strikes.push(s);
      if (D.hp <= 0) break;
    }
    na++;
    snap('att', strikes);
    if (D.hp <= 0) return { winner: 'att', events, seed, A, D };
  }
  const winner = A.hp / A.max > D.hp / D.max ? 'att' : 'def';
  return { winner, events, seed, A, D, capped: true };
}

export function winProb(attP, defP, ctx, n = 120, seed0 = 7) {
  let w = 0;
  for (let i = 0; i < n; i++) if (resolveDuel(attP, defP, ctx, seed0 + i * 977).winner === 'att') w++;
  return w / n;
}

// ===== 抽題 =====
const DIFF_W = (full) => (full <= 10 ? { EASY: 50, MEDIUM: 40, HARD: 10 } : full <= 25 ? { EASY: 30, MEDIUM: 40, HARD: 30 } : { EASY: 20, MEDIUM: 40, HARD: 40 });

export class QuizDeck {
  constructor(questions, rng = Math.random) {
    this.rng = rng;
    this.pool = {};
    for (const q of questions) (this.pool[q.piece] ||= []).push(q);
    this.seen = {}; this.last = {};
  }
  reset() { this.seen = {}; this.last = {}; }
  draw(pieceType, { grade = 'mixed', full = 1 } = {}) {
    let pool = this.pool[pieceType] || [];
    if (grade === '5') { const f = pool.filter((q) => q.grade === 5); if (f.length >= 3) pool = f; }
    const seen = (this.seen[pieceType] ||= new Set());
    let cand = pool.filter((q) => !seen.has(q.id));
    if (!cand.length) { seen.clear(); cand = pool.filter((q) => q.id !== this.last[pieceType]); if (!cand.length) cand = pool; }
    const dw = DIFF_W(full);
    const weights = cand.map((q) => (dw[q.diff] || 1) * (grade === '6' ? (q.grade === 6 ? 3 : 1) : 1) + 0.05);
    let r = this.rng() * weights.reduce((a, b) => a + b, 0), idx = 0;
    for (; idx < weights.length - 1; idx++) { r -= weights[idx]; if (r <= 0) break; }
    const q = cand[idx];
    seen.add(q.id); this.last[pieceType] = q.id;
    return shuffleOptions(q, this.rng);
  }
}
export function shuffleOptions(q, rng = Math.random) {
  const order = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { ...q, opts: order.map((i) => q.opts[i]), ans: order.indexOf(q.ans) };
}
