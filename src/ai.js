// 三階 AI：棋步決策（答題正確率見 rpg.AI_ACC）
import { cloneState, applyMove, attacked, inCheck, genLegal, opp } from './chess.js';
import { VALUE, hasFriendPawn, winProb, AI_ACC } from './rpg.js';

const centerBonus = (r, c) => 3.5 - (Math.abs(r - 3.5) + Math.abs(c - 3.5)) / 2;

function wpick(items, weights, rng) {
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

export function chooseMove(st, level, moves, rng = Math.random) {
  const me = st.turn;
  if (!moves.length) return null;
  let m;
  if (level === 'easy') {
    m = wpick(moves, moves.map((x) => (x.cap ? 1.6 : 1)), rng);
  } else if (level === 'medium') {
    let best = -1e9;
    for (const x of moves) {
      const s = (x.cap ? VALUE[x.cap.type] : 0) + centerBonus(x.to[0], x.to[1]) * 0.8 + (x.promo ? 80 : 0) + rng() * 6;
      if (s > best) { best = s; m = x; }
    }
  } else {
    let best = -1e9;
    const attackedNow = (x) => attacked(st.board, x.from[0], x.from[1], opp(me));
    for (const x of moves) {
      const p = x.piece;
      let s = centerBonus(x.to[0], x.to[1]) * 1.0 + rng() * 2;
      if (p.type === 'P') s += Math.abs(x.to[0] - x.from[0]) * 0 + (me === 'w' ? 6 - x.to[0] : x.to[0] - 1) * 1.2;
      if (x.promo) s += 80;
      if (x.castle) s += 6;
      if (x.cap) {
        const ctx = {
          attFriend: hasFriendPawn(st.board, x.from[0], x.from[1], me),
          defFriend: hasFriendPawn(st.board, x.capSq[0], x.capSq[1], x.cap.color),
        };
        const w = winProb(p, x.cap, ctx, 50);
        const acc = AI_ACC.hard, cv = VALUE[x.cap.type];
        s += acc * cv + (1 - acc) * (w * cv) - (1 - acc) * (1 - w) * 8;
      }
      // 暴露風險：模擬走完後目的格是否被對手攻擊
      const s2 = cloneState(st);
      const p2 = s2.board[x.from[0]][x.from[1]];
      applyMove(s2, { ...x, piece: p2 }, 'Q');
      const [tr, tc] = x.to;
      const val = VALUE[p.type] || 20;
      if (attacked(s2.board, tr, tc, opp(me))) {
        const defended = attacked(s2.board, tr, tc, me);
        s -= 0.65 * val * (defended ? 0.4 : 1);
      }
      if (attackedNow(x) && !attacked(s2.board, tr, tc, opp(me))) s += 0.5 * val;
      if (inCheck(s2, opp(me))) {
        s += 8;
        if (genLegal(s2, opp(me)).length === 0) s += 1000;
      }
      if (s > best) { best = s; m = x; }
    }
  }
  let promo = 'Q';
  if (m.promo && level === 'hard') {
    const s2 = cloneState(st);
    applyMove(s2, { ...m, piece: s2.board[m.from[0]][m.from[1]] }, 'Q');
    if (!inCheck(s2, opp(me)) && genLegal(s2, opp(me)).length === 0) promo = 'N';
  }
  return { move: m, promo };
}
