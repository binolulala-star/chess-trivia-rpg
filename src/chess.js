// 西洋棋規則引擎（標準規則；問答與決鬥由 game 層疊加）
// 座標 board[r][c]：r=0 為第 8 橫排（黑方底線），r=7 為第 1 橫排（白方底線）

let _id = 1;
export function createPiece(type, color) {
  return { id: _id++, type, color, kills: 0, gHP: 0, gATK: 0, gDEF: 0 };
}

const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DB = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const DR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
export const opp = (c) => (c === 'w' ? 'b' : 'w');

export function newGame() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let c = 0; c < 8; c++) {
    board[0][c] = createPiece(back[c], 'b');
    board[1][c] = createPiece('P', 'b');
    board[6][c] = createPiece('P', 'w');
    board[7][c] = createPiece(back[c], 'w');
  }
  const st = {
    board, turn: 'w', castle: { wK: true, wQ: true, bK: true, bQ: true },
    ep: null, half: 0, full: 1, plies: 0, hist: new Map(),
  };
  bump(st);
  return st;
}

export function fromFEN(fen) {
  const [pos, turn, cas, ep, half, full] = fen.split(' ');
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  pos.split('/').forEach((row, r) => {
    let c = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) c += +ch;
      else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        board[r][c++] = createPiece(ch.toUpperCase(), color);
      }
    }
  });
  const st = {
    board, turn, castle: { wK: cas.includes('K'), wQ: cas.includes('Q'), bK: cas.includes('k'), bQ: cas.includes('q') },
    ep: ep === '-' ? null : [8 - +ep[1], 'abcdefgh'.indexOf(ep[0])],
    half: +half || 0, full: +full || 1, plies: 0, hist: new Map(),
  };
  bump(st);
  return st;
}

export function cloneState(st) {
  return {
    board: st.board.map((row) => row.map((p) => (p ? { ...p } : null))),
    turn: st.turn, castle: { ...st.castle }, ep: st.ep ? [...st.ep] : null,
    half: st.half, full: st.full, plies: st.plies, hist: new Map(),
  };
}

export function posKey(st) {
  let s = '';
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = st.board[r][c];
    s += p ? (p.color === 'w' ? p.type : p.type.toLowerCase()) : '.';
  }
  const k = st.castle;
  return s + st.turn + (k.wK ? 'K' : '') + (k.wQ ? 'Q' : '') + (k.bK ? 'k' : '') + (k.bQ ? 'q' : '') + (st.ep ? st.ep.join('') : '');
}
function bump(st) {
  const k = posKey(st);
  st.hist.set(k, (st.hist.get(k) || 0) + 1);
}

export function attacked(board, r, c, by) {
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    if (inB(pr, c + dc)) {
      const p = board[pr][c + dc];
      if (p && p.color === by && p.type === 'P') return true;
    }
  }
  for (const [dr, dc] of KN) {
    const rr = r + dr, cc = c + dc;
    if (inB(rr, cc)) { const p = board[rr][cc]; if (p && p.color === by && p.type === 'N') return true; }
  }
  for (const [dr, dc] of KG) {
    const rr = r + dr, cc = c + dc;
    if (inB(rr, cc)) { const p = board[rr][cc]; if (p && p.color === by && p.type === 'K') return true; }
  }
  for (const [dr, dc] of DB) {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc)) {
      const p = board[rr][cc];
      if (p) { if (p.color === by && (p.type === 'B' || p.type === 'Q')) return true; break; }
      rr += dr; cc += dc;
    }
  }
  for (const [dr, dc] of DR) {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc)) {
      const p = board[rr][cc];
      if (p) { if (p.color === by && (p.type === 'R' || p.type === 'Q')) return true; break; }
      rr += dr; cc += dc;
    }
  }
  return false;
}

export function findKing(board, color) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (p && p.type === 'K' && p.color === color) return [r, c];
  }
  return null;
}
export function inCheck(st, color) {
  const k = findKing(st.board, color);
  return k ? attacked(st.board, k[0], k[1], opp(color)) : false;
}

function pseudo(st, color) {
  const { board } = st;
  const out = [];
  const add = (p, fr, fc, tr, tc, extra) => {
    const t = board[tr][tc];
    out.push({ from: [fr, fc], to: [tr, tc], piece: p, cap: t, capSq: t ? [tr, tc] : null, ep: false, castle: null, promo: false, dbl: false, ...extra });
  };
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (!p || p.color !== color) continue;
    switch (p.type) {
      case 'P': {
        const dir = color === 'w' ? -1 : 1;
        const start = color === 'w' ? 6 : 1;
        const last = color === 'w' ? 0 : 7;
        const r1 = r + dir;
        if (inB(r1, c) && !board[r1][c]) {
          add(p, r, c, r1, c, { promo: r1 === last });
          if (r === start && !board[r + 2 * dir][c]) add(p, r, c, r + 2 * dir, c, { dbl: true });
        }
        for (const dc of [-1, 1]) {
          const cc = c + dc;
          if (!inB(r1, cc)) continue;
          const t = board[r1][cc];
          if (t && t.color !== color) add(p, r, c, r1, cc, { promo: r1 === last });
          else if (!t && st.ep && st.ep[0] === r1 && st.ep[1] === cc) {
            const v = board[r][cc];
            if (v && v.type === 'P' && v.color !== color) {
              out.push({ from: [r, c], to: [r1, cc], piece: p, cap: v, capSq: [r, cc], ep: true, castle: null, promo: false, dbl: false });
            }
          }
        }
        break;
      }
      case 'N':
        for (const [dr, dc] of KN) {
          const rr = r + dr, cc = c + dc;
          if (inB(rr, cc) && (!board[rr][cc] || board[rr][cc].color !== color)) add(p, r, c, rr, cc);
        }
        break;
      case 'K':
        for (const [dr, dc] of KG) {
          const rr = r + dr, cc = c + dc;
          if (inB(rr, cc) && (!board[rr][cc] || board[rr][cc].color !== color)) add(p, r, c, rr, cc);
        }
        break;
      default: {
        const dirs = p.type === 'B' ? DB : p.type === 'R' ? DR : [...DB, ...DR];
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = c + dc;
          while (inB(rr, cc)) {
            const t = board[rr][cc];
            if (!t) add(p, r, c, rr, cc);
            else { if (t.color !== color) add(p, r, c, rr, cc); break; }
            rr += dr; cc += dc;
          }
        }
      }
    }
  }
  // 王車易位
  const row = color === 'w' ? 7 : 0;
  const k = board[row][4];
  if (k && k.type === 'K' && k.color === color && !attacked(board, row, 4, opp(color))) {
    const rights = st.castle;
    const rk = rights[color + 'K'], rq = rights[color + 'Q'];
    const rookAt = (c) => { const q = board[row][c]; return q && q.type === 'R' && q.color === color; };
    if (rk && rookAt(7) && !board[row][5] && !board[row][6] &&
      !attacked(board, row, 5, opp(color)) && !attacked(board, row, 6, opp(color))) {
      out.push({ from: [row, 4], to: [row, 6], piece: k, cap: null, capSq: null, ep: false, castle: 'K', promo: false, dbl: false });
    }
    if (rq && rookAt(0) && !board[row][1] && !board[row][2] && !board[row][3] &&
      !attacked(board, row, 3, opp(color)) && !attacked(board, row, 2, opp(color))) {
      out.push({ from: [row, 4], to: [row, 2], piece: k, cap: null, capSq: null, ep: false, castle: 'Q', promo: false, dbl: false });
    }
  }
  return out;
}

function makeLight(board, m) {
  const [fr, fc] = m.from, [tr, tc] = m.to;
  const p = m.piece;
  const capSq = m.capSq;
  const cap = capSq ? board[capSq[0]][capSq[1]] : null;
  if (capSq) board[capSq[0]][capSq[1]] = null;
  board[tr][tc] = p; board[fr][fc] = null;
  let rf = null, rt = null, rook = null;
  if (m.castle) {
    rf = m.castle === 'K' ? 7 : 0; rt = m.castle === 'K' ? 5 : 3;
    rook = board[fr][rf]; board[fr][rt] = rook; board[fr][rf] = null;
  }
  return () => {
    if (m.castle) { board[fr][rf] = rook; board[fr][rt] = null; }
    board[tr][tc] = null; board[fr][fc] = p;
    if (capSq) board[capSq[0]][capSq[1]] = cap;
  };
}

export function genLegal(st, color = st.turn) {
  const res = [];
  for (const m of pseudo(st, color)) {
    const undo = makeLight(st.board, m);
    const k = m.piece.type === 'K' ? m.to : findKing(st.board, color);
    const bad = k && attacked(st.board, k[0], k[1], opp(color));
    undo();
    if (!bad) res.push(m);
  }
  return res;
}

function touchRights(st, r, c) {
  const k = st.castle;
  if (r === 7 && c === 0) k.wQ = false;
  if (r === 7 && c === 7) k.wK = false;
  if (r === 0 && c === 0) k.bQ = false;
  if (r === 0 && c === 7) k.bK = false;
  if (r === 7 && c === 4) { k.wK = false; k.wQ = false; }
  if (r === 0 && c === 4) { k.bK = false; k.bQ = false; }
}

// 在 state 上執行移動（問答／決鬥結算完畢後呼叫）。promoType 為升變棋子種類。
export function applyMove(st, m, promoType = 'Q') {
  const { board } = st;
  const [fr, fc] = m.from, [tr, tc] = m.to;
  const p = m.piece;
  const wasPawn = p.type === 'P';
  if (m.capSq) board[m.capSq[0]][m.capSq[1]] = null;
  board[tr][tc] = p; board[fr][fc] = null;
  if (m.castle) {
    const rf = m.castle === 'K' ? 7 : 0, rt = m.castle === 'K' ? 5 : 3;
    board[fr][rt] = board[fr][rf]; board[fr][rf] = null;
  }
  if (m.promo) p.type = promoType;
  touchRights(st, fr, fc); touchRights(st, tr, tc);
  st.ep = m.dbl ? [(fr + tr) / 2, fc] : null;
  st.half = (wasPawn || m.cap) ? 0 : st.half + 1;
  if (st.turn === 'b') st.full++;
  st.turn = opp(st.turn);
  st.plies++;
  bump(st);
}

// 吃棋失敗並結束回合：局面不變，但輪替、50 回合計數增加
export function endTurnNoMove(st) {
  st.ep = null;
  st.half++;
  if (st.turn === 'b') st.full++;
  st.turn = opp(st.turn);
  st.plies++;
  bump(st);
}

function insufficient(st) {
  const rest = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = st.board[r][c];
    if (p && p.type !== 'K') rest.push({ p, sq: (r + c) % 2 });
  }
  if (rest.length === 0) return true;
  if (rest.length === 1 && (rest[0].p.type === 'N' || rest[0].p.type === 'B')) return true;
  if (rest.length === 2 && rest.every((x) => x.p.type === 'B') && rest[0].p.color !== rest[1].p.color && rest[0].sq === rest[1].sq) return true;
  return false;
}

// 回傳輪到走棋方的局面狀態
export function getStatus(st) {
  const moves = genLegal(st, st.turn);
  const check = inCheck(st, st.turn);
  let result = null;
  if (moves.length === 0) result = check ? 'checkmate' : 'stalemate';
  else if (insufficient(st)) result = 'insufficient';
  else if ((st.hist.get(posKey(st)) || 0) >= 3) result = 'repetition';
  else if (st.half >= 100) result = 'fifty';
  return { check, moves, result };
}

export function perft(st, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of genLegal(st)) {
    const types = m.promo ? ['Q', 'R', 'B', 'N'] : [null];
    for (const t of types) {
      const s2 = cloneState(st);
      // 在副本中找到對應棋子
      const p2 = s2.board[m.from[0]][m.from[1]];
      const m2 = { ...m, piece: p2, cap: m.cap ? s2.board[m.capSq[0]][m.capSq[1]] : null };
      applyMove(s2, m2, t || 'Q');
      n += depth === 1 ? 1 : perft(s2, depth - 1);
    }
  }
  return n;
}
