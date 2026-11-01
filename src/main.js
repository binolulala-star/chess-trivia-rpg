import * as THREE from 'three';
import { View, sqPos } from './view3d.js';
import * as C from './chess.js';
import * as R from './rpg.js';
import { chooseMove } from './ai.js';
import { QUESTIONS } from './questions.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const ABORT = Symbol('abort');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sqName = (r, c) => 'abcdefgh'[c] + (8 - r);
const CN = { w: '白方', b: '黑方' };

const G = {
  st: null, mode: 'ai', level: 'medium', grade: 'mixed', extra: false,
  phase: 'idle', sel: null, status: null, moves: [], captureTried: false,
  deck: new R.QuizDeck(QUESTIONS), last: [], over: false, humanColor: 'w',
  token: 0, duelSpeed: 1, quizCancel: null, checkAnnounced: false,
  hist: [], rvIdx: 0, rvBoard: null, rvAuto: 0, style: 'hd',
};
const PIECE_SYM = { w: { P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔' }, b: { P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚' } };
const snapBoard = (b) => b.map((row) => row.map((p) => (p ? { ...p } : null)));
const tc = (t) => R.THEME_CSS[t];
window.__G = G;

// ===== 設定 =====
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('chessTriviaSettings') || '{}');
    if (s.mode) G.mode = s.mode; if (s.level) G.level = s.level; if (s.grade) G.grade = s.grade;
    G.extra = !!s.extra; if (s.muted) sfx.setMuted(true); if (s.style) G.style = s.style;
  } catch (e) { /* 無痕模式等情況略過 */ }
}
function saveSettings() {
  try { localStorage.setItem('chessTriviaSettings', JSON.stringify({ mode: G.mode, level: G.level, grade: G.grade, extra: G.extra, muted: sfx.isMuted(), style: G.style })); } catch (e) { /* ignore */ }
}
loadSettings();

const view = new View($('stage'), { onPick, fxLayer: $('fxlayer') });
view.style = G.style;
window.__view = view;

// ===== 工具 =====
const humanTurn = () => G.mode === '2p' || G.st.turn === G.humanColor;
function log(text, cls = '') {
  const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = text;
  const el = $('log'); el.appendChild(d); el.scrollTop = el.scrollHeight;
}
function pName(p) { return CN[p.color].replace('方', '') + R.NAMES[p.type]; }
async function step(tok, p) { const r = await p; if (tok !== G.token) throw ABORT; return r; }

function setTurnbar() {
  const tb = $('turnbar'); const st = G.st;
  let t;
  if (G.over) t = '對局結束';
  else if (G.mode === 'ai') t = humanTurn() ? `輪到你（${CN[st.turn]}）— 點選棋子再點目的格` : `電腦（${CN[st.turn]}）思考中…`;
  else t = `輪到 ${CN[st.turn]} — 點選棋子再點目的格`;
  if (G.status && G.status.check && !G.over) t = '⚠ 將軍！ ' + t;
  if (G.captureTried && !G.over) t += '｜解將吃棋失敗：這回合只能走不吃棋的步';
  tb.textContent = t; tb.classList.toggle('check', !!(G.status && G.status.check));
}
function layoutTop() {
  const h = $('topbar').offsetHeight;
  document.documentElement.style.setProperty('--tb', h + 18 + 'px');
  document.documentElement.style.setProperty('--sidetop', h + 56 + 'px');
}
window.addEventListener('resize', layoutTop);

function drawHL() {
  const st = G.st;
  const targets = [];
  if (G.sel) {
    const seen = new Set();
    for (const m of G.moves) if (m.from[0] === G.sel[0] && m.from[1] === G.sel[1]) {
      const k = m.to.join(','); if (seen.has(k)) continue; seen.add(k);
      targets.push({ r: m.to[0], c: m.to[1], cap: !!m.cap });
    }
  }
  const k = C.findKing(st.board, st.turn);
  view.setHighlights({ sel: G.sel, targets, last: G.last, check: G.status && G.status.check && k ? k : null });
}

function showInfo(p) {
  const el = $('info');
  if (!p) { el.innerHTML = '<h3>棋子資訊</h3><div class="row">點選棋盤上的棋子查看數值</div>'; return; }
  const s = R.statsOf(p), b = R.BASE[p.type];
  const plus = (v, base) => (v > base ? ` <span style="color:#ffd54a">(+${v - base})</span>` : '');
  const sk = R.SKILL[p.type];
  el.style.setProperty('--tc', tc(p.type));
  el.innerHTML = `<h3>${CN[p.color].replace('方', '')}${R.NAMES[p.type]} · ${R.titleOf(p)}<span class="role">${sk.role}</span></h3>
    <div class="row"><span>生命 HP</span><b>${s.hp}${plus(s.hp, b.hp)}</b></div>
    <div class="row"><span>攻擊 ATK</span><b>${s.atk}${plus(s.atk, b.atk)}</b></div>
    <div class="row"><span>防禦 DEF</span><b>${s.def}${plus(s.def, b.def)}</b></div>
    <div class="row"><span>擊殺成長</span><b>${p.kills} / 3</b></div>
    <div class="row"><span>被攻擊時考科</span><b>${R.SUBJECTS[p.type]}</b></div>
    <div class="skill"><b>⚔ ${sk.name}</b>　${sk.desc}<small>被動｜${R.PASSIVE[p.type]}</small><small>移動｜${sk.move}</small></div>`;
}

// ===== 回合流程 =====
function newGame() {
  G.token++;
  if (G.quizCancel) G.quizCancel();
  G.st = C.newGame(); G.deck.reset(); G.sel = null; G.last = []; G.over = false; G.captureTried = false; G.checkAnnounced = false;
  stopAuto(); view.shiftY = 0; view.resize();
  view.fast = 1; view.resetTime(); view.releaseCam(); view.clearFx();
  view.syncAll(G.st.board); view.setPreset('white');
  $('log').innerHTML = ''; ['quiz', 'duelhud', 'promo', 'over', 'review'].forEach((i) => ($(i).hidden = true));
  $('btnReview').hidden = true;
  G.hist = [{ kind: 'start', text: '開局', snap: snapBoard(G.st.board), last: [] }];
  showInfo(null);
  log(`新局開始：${G.mode === 'ai' ? `單人 vs 電腦（${R.AI_NAME[G.level]}）` : '雙人同機'}`, 'sys');
  refreshTurn();
}

function refreshTurn() {
  const st = G.st;
  const s = C.getStatus(st); G.status = s;
  G.moves = G.captureTried ? s.moves.filter((m) => !m.cap) : s.moves;
  if (s.result) { G.phase = 'over'; return endGame(s.result); }
  if (G.captureTried && G.moves.length === 0) { G.phase = 'over'; return endGame('checkmate'); }
  if (s.check && !G.checkAnnounced) { sfx.check(); log(`${CN[st.turn]}被將軍！`, 'bad'); G.checkAnnounced = true; }
  if (!s.check) G.checkAnnounced = false;
  G.sel = null; drawHL(); setTurnbar();
  if (!humanTurn()) { G.phase = 'busy'; aiMove(); } else G.phase = 'idle';
}

const DRAW_TXT = { stalemate: '逼和（無子可動）', fifty: '50 回合內無兵移動且無成功吃棋', repetition: '同一局面重複 3 次', insufficient: '雙方子力不足以將死' };
function endGame(result, resigner) {
  G.over = true; G.phase = 'over'; setTurnbar(); drawHL();
  const st = G.st; let title, text, snd;
  if (result === 'checkmate' || result === 'resign') {
    const loser = result === 'resign' ? resigner : st.turn;
    const win = C.opp(loser);
    const wn = CN[win];
    if (G.mode === 'ai') { const me = win === G.humanColor; title = me ? '🎉 你贏了！' : '電腦獲勝'; snd = me ? 'win' : 'lose'; }
    else { title = `${wn}獲勝！`; snd = 'win'; }
    text = result === 'checkmate' ? `${wn}將死對手。` : `${CN[loser]}認輸。`;
  } else { title = '和局'; text = DRAW_TXT[result] || ''; snd = 'draw'; }
  sfx[snd](); log(`對局結束：${title} ${text}`, 'sys');
  G.result = { title, text };
  const lastE = G.hist[G.hist.length - 1]; if (lastE && result === 'checkmate') lastE.mate = true;
  $('btnReview').hidden = false; layoutTop();
  $('overTitle').textContent = title; $('overText').textContent = text;
  setTimeout(() => { if (G.over) $('over').hidden = false; }, 900);
}

function onPick(r, c) {
  if (!G.st) return;
  sfx.unlock();
  if (G.phase === 'review') { showInfo(G.rvBoard && G.rvBoard[r][c]); return; }
  const p = G.st.board[r][c];
  if (G.phase !== 'idle' || G.over) { showInfo(p); return; }
  if (G.sel) {
    const ms = G.moves.filter((x) => x.from[0] === G.sel[0] && x.from[1] === G.sel[1] && x.to[0] === r && x.to[1] === c);
    if (ms.length) return playMove(ms[0]);
  }
  if (p && p.color === G.st.turn && humanTurn()) { G.sel = [r, c]; sfx.select(); showInfo(p); drawHL(); }
  else { G.sel = null; showInfo(p); drawHL(); }
}

async function aiMove() {
  const tok = G.token;
  try {
    await step(tok, sleep(650));
    const pick = chooseMove(G.st, G.level, G.moves);
    if (!pick) return;
    await playMove(pick.move, pick.promo);
  } catch (e) { if (e !== ABORT) console.error(e); }
}

function addGrowth(att, defType) {
  const g = R.grantKill(att, defType);
  view.updateVisual(att); showInfo(att);
  if (g) {
    sfx.levelUp();
    const rec = view.rec(att);
    view.floatText(rec.group.position.clone().add(new THREE.Vector3(0, rec.h + 1.2, 0)), `+${g.hp}HP +${g.atk}ATK +${g.def}DEF`, 'grow');
    log(`  ${pName(att)} 成長：${R.titleOf(att)}（+${g.hp} HP / +${g.atk} ATK / +${g.def} DEF）`, 'kill');
  } else log(`  ${pName(att)} 已達成長上限（3 次）`, 'sys');
}

function moveText(m, color) {
  const no = G.st.full + (color === 'w' ? '.' : '…');
  const p = m.piece;
  if (m.castle) return { chip: `${no} ${m.castle === 'K' ? 'O-O' : 'O-O-O'}`, long: `${CN[color]} 王車易位（${m.castle === 'K' ? '短' : '長'}易位）` };
  const base = `${PIECE_SYM[color][p.type]}${m.cap ? '×' : ''}${sqName(...m.to)}`;
  return { chip: `${no} ${base}`, long: `${pName(p)} ${sqName(...m.from)} → ${sqName(...m.to)}${m.cap ? ` 吃 ${pName(m.cap)}${m.ep ? '（過路兵）' : ''}` : ''}` };
}
function pushHist(e) {
  e.snap = snapBoard(G.st.board);
  const k = C.findKing(G.st.board, G.st.turn);
  e.check = C.inCheck(G.st, G.st.turn); e.checkSq = e.check ? k : null;
  G.hist.push(e);
}
const moveSfx = (k) => sfx.moveKind(k);

async function animateMove(tok, board, m, att) {
  const jobs = [view.moveAnim(att, m.to[0], m.to[1], moveSfx)];
  if (m.castle) {
    const row = m.from[0], rf = m.castle === 'K' ? 7 : 0, rt = m.castle === 'K' ? 5 : 3;
    jobs.push(view.moveAnim(board[row][rf], row, rt, moveSfx));
  }
  await step(tok, Promise.all(jobs));
}

async function playMove(m, aiPromo) {
  const tok = G.token, st = G.st, att = m.piece;
  G.phase = 'busy'; G.sel = null;
  const wasCheck = G.status.check;
  view.setHighlights({ last: G.last });
  try {
    const color = att.color;
    const mt = moveText(m, color);
    log(mt.long);
    const entry = { kind: m.cap ? 'cap' : 'move', color, chip: mt.chip, text: mt.long, from: m.from, to: m.to, capSq: m.capSq, castle: m.castle, ep: m.ep, ptype: att.type };
    if (m.cap) {
      const res = await attack(m, tok);
      entry.quiz = res.quiz; entry.duel = res.duel;
      if (!res.ok) {
        entry.kind = 'fail'; entry.last = [m.from, m.to];
        if (wasCheck) { G.captureTried = true; log('  解將的吃棋失敗：這回合改走不吃棋的步', 'bad'); entry.note = '解將吃棋失敗，同回合改走他步'; }
        else { C.endTurnNoMove(st); log('  吃棋失敗，本回合結束', 'bad'); entry.note = '吃棋失敗，回合結束'; }
        pushHist(entry);
        refreshTurn(); return;
      }
    } else {
      await animateMove(tok, st.board, m, att);
    }
    let promoType = 'Q';
    if (m.promo) {
      promoType = (humanTurn() ? await step(tok, askPromotion(att.color)) : (aiPromo || 'Q'));
    }
    C.applyMove(st, m, promoType);
    if (m.promo) {
      R.carryPromotion(att); view.rebuild(att); sfx.promote();
      log(`  ${CN[att.color]}兵升變為${R.NAMES[promoType]}（保留 ${att.kills} 次擊殺，加成折半）`, 'kill');
      const rec = view.rec(att);
      view.floatText(rec.group.position.clone().add(new THREE.Vector3(0, rec.h + 1.0, 0)), `升變！${R.NAMES[promoType]}`, 'big');
      entry.promo = promoType; entry.chip += '=' + PIECE_SYM[color][promoType];
    }
    G.captureTried = false; G.last = [m.from, m.to];
    entry.last = G.last;
    pushHist(entry);
    refreshTurn();
  } catch (e) { if (e !== ABORT) console.error(e); }
}

// ===== 吃棋：問答 → 秒殺 / 原場決鬥 =====
async function attack(m, tok) {
  const st = G.st, att = m.piece, def = m.cap;
  const q = G.deck.draw(def.type, { grade: G.grade, full: st.full });
  view.quizFocus(att, def);
  sfx.quizStart();
  const human = humanTurn();
  const { out, choice } = await step(tok, runQuiz({ q, att, def, human, acc: R.AI_ACC[G.level] }));
  view.releaseCam();
  const quiz = { q, choice, out, human };
  if (out === 'correct') {
    log(`  【${q.subject}】答對！金色震波秒殺 ${pName(def)}`, 'good');
    await animateQuizKill(tok, att, def, m.to);
    addGrowth(att, def.type);
    return { ok: true, quiz };
  }
  log(`  【${q.subject}】${out === 'timeout' ? '逾時' : '答錯'}！進入原場決鬥（${pName(def)} 先手突襲）`, 'bad');
  const ctx = {
    attFriend: R.hasFriendPawn(st.board, m.from[0], m.from[1], att.color),
    defFriend: R.hasFriendPawn(st.board, m.capSq[0], m.capSq[1], def.color),
  };
  const seed = (Math.random() * 2147483647) | 0;
  const res = R.resolveDuel(att, def, ctx, seed);
  const duel = { ctx, seed, events: res.events, winner: res.winner, capped: !!res.capped, AS: R.statsOf(att), DS: R.statsOf(def) };
  await animateDuel(tok, att, def, m, duel, true);
  if (res.winner === 'att') { addGrowth(att, def.type); return { ok: true, quiz, duel }; }
  return { ok: false, quiz, duel };
}

async function animateQuizKill(tok, att, def, to) {
  view.quizFocus(att, def); sfx.shockwave();
  const fly = await step(tok, view.quizKill(att, def)); sfx.knock();
  view.releaseCam();
  await step(tok, Promise.all([fly, view.slide(att, to[0], to[1], { hop: 0.1, dur: 0.35 })]));
}

// 決鬥演出（對局中與回顧重播共用）。live=true 時寫入戰報
async function animateDuel(tok, att, def, m, duel, live) {
  const { AS, DS, events, ctx } = duel;
  duelHud(att, def, AS.hp, DS.hp, 0, 0, AS.hp, DS.hp);
  view.fast = G.duelSpeed; $('dhSpeed').textContent = G.duelSpeed === 2 ? '標準速度' : '加速 ×2';
  await step(tok, view.duelBegin(att, def));
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    $('dhRound').textContent = `第 ${Math.ceil((i + 1) / 2)} 回合`;
    const final = i === events.length - 1 && !duel.capped;
    await step(tok, view.duelStrike(ev.side, ev.strikes, (s) => {
      if (s.crit) sfx.crit(); else sfx.hit();
      if (s.shieldGain) setTimeout(() => sfx.shield(), 120);
      if (ev.side === 'att') duelHudUpdate('D', s.tHp, DS.hp, s.tShield);
      else duelHudUpdate('A', s.tHp, AS.hp, s.tShield);
    }, { final, legion: ev.side === 'att' ? ctx.attFriend : ctx.defFriend, onSkill: (t) => sfx.skill(t) }));
    if (live) {
      const flag = ev.strikes.map((s) => (s.crit ? '暴擊' : '') + `-${s.dmg}`).join('、');
      log(`    ${ev.side === 'att' ? pName(att) : pName(def)} 打出 ${flag}（${ev.side === 'att' ? '防守方' : '進攻方'}剩 ${ev.side === 'att' ? ev.dHp : ev.aHp}）`);
    }
  }
  $('duelhud').hidden = true;
  if (duel.winner === 'att') {
    if (live) log(`  ${pName(att)} 贏得決鬥，強行吃棋！`, 'good');
    await step(tok, view.knockoutCinematic(def, att, { onImpact: () => { sfx.ko(); sfx.slowWhoosh(); }, onLand: () => sfx.land() }));
    await step(tok, view.duelEnd()); view.fast = 1; view.releaseCam();
    await step(tok, view.slide(att, m.to[0], m.to[1], { hop: 0.1, dur: 0.4 }));
  } else {
    if (live) log(`  ${pName(att)} 決鬥落敗，被擊退彈回原格`, 'bad');
    await step(tok, view.bounceCinematic(att, m.from[0], m.from[1], def, { onImpact: () => { sfx.crit(); sfx.slowWhoosh(); }, onLand: () => sfx.bounce() }));
    view.releaseCam();
    const dr = view.rec(def);
    await step(tok, Promise.all([view.duelEnd(), dr ? view.slide(def, dr.r, dr.c, { dur: 0.3 }) : null]));
    view.fast = 1;
  }
}

// ===== 決鬥 HUD =====
function duelHud(att, def, aHp, dHp, aSh, dSh, aMax, dMax) {
  $('duelhud').hidden = false; $('dhRound').textContent = '';
  const fill = (id, p, tag, hp, max, sh) => {
    $(id).style.setProperty('--tc', tc(p.type));
    $(id).innerHTML = `<h5>${tag} ${pName(p)} <small>${R.titleOf(p)}</small> <span class="sk">${R.SKILL[p.type].name}</span></h5>
      <div class="hpbar"><i style="width:${(hp / max) * 100}%"></i><u style="width:${Math.min(100, (sh / max) * 100)}%"></u></div>
      <div class="hpt"><span class="hv">${hp} / ${max}</span><span class="sv">${sh ? '🛡 ' + sh : ''}</span></div>`;
  };
  fill('dhA', att, '⚔ 進攻', aHp, aMax, aSh); fill('dhD', def, '🛡 防守', dHp, dMax, dSh);
  G.hudMax = { A: aMax, D: dMax };
}
function duelHudUpdate(side, hp, max, sh) {
  const el = $(side === 'A' ? 'dhA' : 'dhD');
  el.querySelector('.hpbar i').style.width = (hp / max) * 100 + '%';
  el.querySelector('.hpbar u').style.width = Math.min(100, (sh / max) * 100) + '%';
  el.querySelector('.hv').textContent = `${hp} / ${max}`;
  el.querySelector('.sv').textContent = sh ? '🛡 ' + sh : '';
}
$('dhSpeed').onclick = () => { G.duelSpeed = G.duelSpeed === 1 ? 2 : 1; view.fast = G.duelSpeed; $('dhSpeed').textContent = G.duelSpeed === 2 ? '標準速度' : '加速 ×2'; };
$('dhSkip').onclick = () => { view.fast = 'skip'; };

// ===== 問答 UI =====
function runQuiz({ q, att, def, human, acc }) {
  return new Promise((resolve) => {
    const box = $('quiz'); box.hidden = false; G.curQ = q;
    $('qSubject').textContent = `【${q.subject}】${q.diff}`;
    $('qWho').textContent = `${pName(att)} 進攻 ${pName(def)}${human ? '' : '（電腦作答）'}`;
    $('qText').textContent = q.q;
    const exp = $('qExp'); exp.className = 'exp'; exp.textContent = '';
    const go = $('qGo'); go.className = 'go';
    const optsEl = $('qOpts'); optsEl.innerHTML = '';
    const btns = q.opts.map((t, i) => {
      const b = document.createElement('button'); b.className = 'opt';
      b.innerHTML = `<b>${'ABCD'[i]}</b><span></span>`; b.lastChild.textContent = t;
      optsEl.appendChild(b); return b;
    });
    const limit = q.time + (G.extra ? 3 : 0);
    const t0 = Date.now();
    let done = false, lastSec = -1, aiT = 0;
    const bar = $('qBar'), sec = $('qSec');
    const keyH = (e) => {
      if (done) { if ((e.key === 'Enter' || e.key === ' ') && go.classList.contains('show')) go.click(); return; }
      if (!human) return;
      const k = e.key.toLowerCase(); const i = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
      if (i >= 0 && k.length === 1) finish(i);
    };
    document.addEventListener('keydown', keyH);
    const cleanup = () => { clearInterval(iv); clearTimeout(aiT); document.removeEventListener('keydown', keyH); G.quizCancel = null; };
    const finish = (choice) => {
      if (done) return; done = true; clearInterval(iv); clearTimeout(aiT);
      const ok = choice === q.ans;
      btns.forEach((b, i) => { b.disabled = true; if (i === q.ans) b.classList.add('ok'); else if (i === choice) b.classList.add('no'); });
      exp.textContent = (ok ? '✔ 答對！ ' : choice < 0 ? '⏰ 時間到！ ' : '✘ 答錯。 ') + `正解：${'ABCD'[q.ans]}。${q.exp}`;
      exp.classList.add('show');
      const out = ok ? 'correct' : choice < 0 ? 'timeout' : 'wrong';
      if (ok) sfx.correct(); else sfx.wrong();
      const end = () => { cleanup(); box.hidden = true; resolve({ out, choice }); };
      if (ok) setTimeout(end, 1500);
      else if (human) { go.classList.add('show'); go.onclick = end; }
      else setTimeout(end, 2300);
    };
    const iv = setInterval(() => {
      const rem = limit - (Date.now() - t0) / 1000;
      bar.style.transform = `scaleX(${Math.max(0, rem / limit)})`;
      const s = Math.max(0, Math.ceil(rem)); sec.textContent = s + ' 秒';
      if (s !== lastSec) { lastSec = s; if (s <= 3 && s > 0 && !done) sfx.tick(); }
      if (rem <= 0) finish(-1);
    }, 80);
    if (human) {
      btns.forEach((b, i) => { b.onclick = () => finish(i); });
    } else {
      btns.forEach((b) => { b.disabled = true; });
      const delay = 1300 + Math.random() * Math.min(limit * 450, 4500);
      aiT = setTimeout(() => {
        const good = Math.random() < acc;
        let pick = q.ans;
        if (!good) { const wrongs = [0, 1, 2, 3].filter((i) => i !== q.ans); pick = wrongs[Math.floor(Math.random() * 3)]; }
        btns[pick].classList.add('pick');
        setTimeout(() => finish(pick), 350);
      }, delay);
    }
    G.quizCancel = () => { cleanup(); done = true; box.hidden = true; resolve({ out: 'abort', choice: -1 }); };
  });
}

// ===== 升變 =====
function askPromotion(color) {
  return new Promise((resolve) => {
    const wrap = $('promoBtns'); wrap.innerHTML = '';
    for (const t of ['Q', 'R', 'B', 'N']) {
      const b = document.createElement('button'); if (t === 'Q') b.className = 'rec';
      const base = R.BASE[t];
      b.innerHTML = `<span style="font-size:26px">${{ Q: '♛', R: '♜', B: '♝', N: '♞' }[t]}</span><b>${R.NAMES[t]}</b><small>HP ${base.hp}｜ATK ${base.atk}｜DEF ${base.def}</small>`;
      b.onclick = () => { $('promo').hidden = true; resolve(t); };
      wrap.appendChild(b);
    }
    $('promo').hidden = false;
  });
}

// ===== 棋局回顧 =====
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function enterReview() {
  if (G.hist.length < 2) return;
  G.token++; if (G.quizCancel) G.quizCancel();
  G.phase = 'review';
  ['over', 'quiz', 'duelhud', 'promo'].forEach((i) => ($(i).hidden = true));
  $('review').hidden = false;
  view.resetTime(); view.releaseCam(); view.fast = 1;
  buildReviewList();
  gotoStep(G.hist.length - 1);
  view.shiftY = Math.round($('review').offsetHeight * 0.5); view.resize();
  $('turnbar').textContent = '棋局回顧中 — ← → 切換步數，空白鍵自動播放'; $('turnbar').classList.remove('check');
}
function exitReview() {
  stopAuto(); G.token++;
  view.resetTime(); view.releaseCam(); view.fast = 1; view._dim([], false);
  $('review').hidden = true; $('duelhud').hidden = true;
  view.shiftY = 0; view.resize();
  view.syncAll(G.st.board);
  G.phase = 'over'; G.rvBoard = null; drawHL(); setTurnbar();
}
function buildReviewList() {
  const el = $('rvList'); el.innerHTML = '';
  G.hist.forEach((e, i) => {
    const b = document.createElement('button');
    let cls = '';
    if (e.kind === 'cap') cls = 'cap ok'; else if (e.kind === 'fail') cls = 'cap fail';
    b.className = cls;
    const mark = e.kind === 'cap' ? (e.duel ? ' ⚔' : ' ✔') : e.kind === 'fail' ? ' ✘' : '';
    b.textContent = (i === 0 ? '開局' : e.chip) + mark + (e.mate ? '#' : e.check ? '+' : '');
    b.onclick = () => { stopAuto(); G.token++; gotoStep(i); };
    el.appendChild(b);
  });
}
function gotoStep(i) {
  i = Math.max(0, Math.min(G.hist.length - 1, i));
  G.rvIdx = i;
  const e = G.hist[i];
  if (G.phase === 'review' && $('review').hidden) { $('review').hidden = false; view.shiftY = Math.round($('review').offsetHeight * 0.5); view.resize(); $('turnbar').textContent = '棋局回顧中 — ← → 切換步數，空白鍵自動播放'; }
  view.resetTime(); view.releaseCam(); view._dim([], false); $('duelhud').hidden = true;
  G.rvBoard = snapBoard(e.snap);
  view.syncAll(G.rvBoard);
  view.setHighlights({ last: e.last || [], check: e.checkSq || null });
  [...$('rvList').children].forEach((b, k) => b.classList.toggle('cur', k === i));
  const cur = $('rvList').children[i]; if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
  $('rvPos').textContent = `第 ${i} / ${G.hist.length - 1} 步${G.result && i === G.hist.length - 1 ? `｜${G.result.title}` : ''}`;
  $('rvReplay').disabled = i === 0;
  renderDetail(e, i);
}
function renderDetail(e, i) {
  const d = $('rvDetail');
  if (i === 0) { d.innerHTML = '雙方就位。用「下一步」逐步檢視，或按「🎬 重播此步」觀看該步的完整動畫與決鬥。'; return; }
  let h = `<div><b>${esc(e.text)}</b>${e.promo ? `，升變為${R.NAMES[e.promo]}` : ''}${e.mate ? ' — <b style="color:#ff8a8a">將死！</b>' : e.check ? ' — <span style="color:#ff8a8a">將軍</span>' : ''}</div>`;
  if (e.quiz) {
    const { q, choice, out, human } = e.quiz;
    const who = human ? '玩家' : '電腦';
    const res = out === 'correct' ? '✔ 答對，知識秒殺' : out === 'timeout' ? '⏰ 逾時' : '✘ 答錯';
    h += `<div class="q">【${q.subject}｜${q.diff}｜${who}作答】${esc(q.q)}</div><div>`;
    q.opts.forEach((o, k) => { h += `<span class="o ${k === q.ans ? 'ok' : k === choice ? 'no' : ''}">${'ABCD'[k]}. ${esc(o)}</span>`; });
    h += `</div><div>${res}。<span class="dl">解析：${esc(q.exp)}</span></div>`;
  }
  if (e.duel) {
    const D = e.duel;
    const prev = G.hist[i - 1].snap;
    const a = prev[e.from[0]][e.from[1]], df = prev[e.capSq[0]][e.capSq[1]];
    if (!a || !df) { d.innerHTML = h; return; }
    h += `<div style="margin-top:6px"><b>⚔ 原場決鬥</b>：${pName(a)}（HP ${D.AS.hp}，${R.SKILL[a.type].name}） vs ${pName(df)}（HP ${D.DS.hp}，${R.SKILL[df.type].name}）`;
    h += ` → <b style="color:${D.winner === 'att' ? '#8dffd0' : '#ff9a9a'}">${D.winner === 'att' ? '進攻方勝，K.O. 擊飛' : '防守方勝，進攻方被擊退'}</b></div><div class="dl">`;
    h += D.events.map((ev, k) => `${k + 1}. ${ev.side === 'att' ? pName(a) : pName(df)} ${ev.strikes.map((s) => (s.crit ? '暴擊' : '') + '-' + s.dmg + (s.shieldGain ? '（護盾+25）' : '')).join('、')}`).join('　') + '</div>';
  }
  if (e.note) h += `<div style="color:#ff9a9a">${esc(e.note)}</div>`;
  d.innerHTML = h;
}

// 重播第 i 步：full=true 播完整問答／決鬥；false 為自動播放用的精簡版
async function replayStep(i, full = true) {
  if (i <= 0) return gotoStep(0);
  const tok = ++G.token;
  const e = G.hist[i], prev = G.hist[i - 1];
  G.rvIdx = i;
  view.resetTime(); view.releaseCam();
  const board = snapBoard(prev.snap); G.rvBoard = board;
  view.syncAll(board);
  view.setHighlights({ last: prev.last || [] });
  [...$('rvList').children].forEach((b, k) => b.classList.toggle('cur', k === i));
  renderDetail(e, i);
  $('rvPos').textContent = `第 ${i} / ${G.hist.length - 1} 步（重播中）`;
  const bigShow = full && e.kind !== 'move';
  if (bigShow) { $('review').hidden = true; view.shiftY = 0; view.resize(); $('turnbar').textContent = `重播第 ${i} 步：${e.text}（Esc 停止）`; }
  const restore = () => {
    if (!bigShow || G.phase !== 'review') return;
    $('review').hidden = false; view.shiftY = Math.round($('review').offsetHeight * 0.5); view.resize();
    $('turnbar').textContent = '棋局回顧中 — ← → 切換步數，空白鍵自動播放';
  };
  try {
    const att = board[e.from[0]][e.from[1]];
    if (!att) throw ABORT;
    const m = { from: e.from, to: e.to, capSq: e.capSq, castle: e.castle };
    if (e.kind === 'move') {
      await animateMove(tok, board, m, att);
      if (e.promo) { att.type = e.promo; view.rebuild(att); sfx.promote(); }
    } else {
      const def = board[e.capSq[0]][e.capSq[1]];
      if (e.quiz) {
        view.quizFocus(att, def);
        const rec = view.rec(def);
        view.floatText(rec.group.position.clone().add(new THREE.Vector3(0, rec.h + 0.9, 0)),
          `【${e.quiz.q.subject}】${e.quiz.out === 'correct' ? '答對！' : e.quiz.out === 'timeout' ? '逾時' : '答錯'}`, 'skill', e.quiz.out === 'correct' ? '#8dffd0' : '#ff9a9a');
        if (e.quiz.out === 'correct') sfx.correct(); else sfx.wrong();
        await step(tok, sleep(full ? 1300 : 700));
      }
      if (!e.duel) await animateQuizKill(tok, att, def, e.to);
      else if (full) await animateDuel(tok, att, def, m, e.duel, false);
      else if (e.duel.winner === 'att') { view.releaseCam(); const fly = view.knockOff(def, view.rec(def).group.position.clone().sub(view.rec(att).group.position), {}); sfx.knock(); await step(tok, Promise.all([fly, view.moveAnim(att, e.to[0], e.to[1], moveSfx)])); }
      else { view.releaseCam(); sfx.bounce(); await step(tok, view.bounceBack(att, e.from[0], e.from[1])); }
    }
    await step(tok, sleep(250));
    restore(); gotoStep(i);
  } catch (err) { if (err !== ABORT) console.error(err); restore(); }
}
function stopAuto() {
  G.rvAuto = 0;
  const b = $('rvPlay'); if (b) b.textContent = '▶ 自動播放';
}
async function autoPlay() {
  if (G.rvAuto) { stopAuto(); G.token++; gotoStep(G.rvIdx); return; }
  const run = ++G.rvAuto + Date.now(); G.rvAuto = run;
  $('rvPlay').textContent = '⏸ 暫停';
  if (G.rvIdx >= G.hist.length - 1) gotoStep(0);
  while (G.rvAuto === run && G.rvIdx < G.hist.length - 1) {
    await replayStep(G.rvIdx + 1, false);
    if (G.rvAuto !== run) return;
    await sleep(500);
  }
  if (G.rvAuto === run) stopAuto();
}
document.addEventListener('keydown', (e) => {
  if (G.phase !== 'review') return;
  if (e.key === 'ArrowLeft') { stopAuto(); G.token++; gotoStep(G.rvIdx - 1); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { stopAuto(); G.token++; gotoStep(G.rvIdx + 1); e.preventDefault(); }
  else if (e.key === ' ') { autoPlay(); e.preventDefault(); }
  else if (e.key === 'Escape') { if ($('review').hidden) { G.token++; view.resetTime(); view._dim([], false); $('review').hidden = false; view.shiftY = Math.round($('review').offsetHeight * 0.5); view.resize(); gotoStep(G.rvIdx); } else exitReview(); }
});

// ===== 控制列 =====
function bindUI() {
  $('selMode').value = G.mode; $('selLevel').value = G.level; $('selGrade').value = G.grade; $('chkExtra').checked = G.extra;
  $('btnMute').textContent = sfx.isMuted() ? '🔇' : '🔊';
  const lvl = () => ($('lblLevel').style.display = G.mode === 'ai' ? '' : 'none'); lvl();
  $('selMode').onchange = (e) => {
    const was = G.mode; G.mode = e.target.value; saveSettings(); lvl();
    if (was !== G.mode) newGame();
  };
  $('selLevel').onchange = (e) => { G.level = e.target.value; saveSettings(); log(`AI 強度切換為：${R.AI_NAME[G.level]}`, 'sys'); };
  $('selGrade').onchange = (e) => { G.grade = e.target.value; saveSettings(); };
  $('selStyle').value = G.style || 'hd';
  $('selStyle').onchange = (e) => {
    G.style = e.target.value; saveSettings(); view.style = G.style;
    if (G.phase === 'review') { gotoStep(G.rvIdx); return; }
    if (G.phase === 'idle' || G.phase === 'over') view.syncAll(G.st.board); // 動畫進行中則下一次重建時套用
  };
  $('chkExtra').onchange = (e) => { G.extra = e.target.checked; saveSettings(); };
  document.querySelectorAll('[data-view]').forEach((b) => { b.onclick = () => view.setPreset(b.dataset.view); });
  $('btnMute').onclick = () => { sfx.setMuted(!sfx.isMuted()); $('btnMute').textContent = sfx.isMuted() ? '🔇' : '🔊'; saveSettings(); sfx.unlock(); };
  $('btnNew').onclick = () => { if (!G.over && G.phase !== 'review' && G.st.plies > 0 && !confirm('確定要放棄目前對局並開新局？')) return; newGame(); };
  $('btnResign').onclick = () => {
    if (G.over || G.phase === 'busy') return;
    if (!confirm('確定要認輸嗎？')) return;
    G.token++; endGame('resign', G.mode === 'ai' ? G.humanColor : G.st.turn);
  };
  $('overNew').onclick = () => newGame();
  $('overReview').onclick = () => enterReview();
  $('btnReview').onclick = () => { if (G.phase === 'review') exitReview(); else if (G.over) enterReview(); };
  $('rvClose').onclick = () => exitReview();
  $('rvFirst').onclick = () => { stopAuto(); G.token++; gotoStep(0); };
  $('rvPrev').onclick = () => { stopAuto(); G.token++; gotoStep(G.rvIdx - 1); };
  $('rvNext').onclick = () => { stopAuto(); G.token++; gotoStep(G.rvIdx + 1); };
  $('rvLast').onclick = () => { stopAuto(); G.token++; gotoStep(G.hist.length - 1); };
  $('rvPlay').onclick = () => autoPlay();
  $('rvReplay').onclick = () => { stopAuto(); replayStep(G.rvIdx, true); };
  $('introTypes').innerHTML = ['P', 'N', 'B', 'R', 'Q', 'K'].map((t) => `<div style="--tc:${tc(t)}"><b>${PIECE_SYM.w[t]} ${R.NAMES[t]}・${R.SKILL[t].name}</b>${R.SKILL[t].desc}</div>`).join('');
  $('sideToggle').onclick = () => $('side').classList.toggle('open');
  $('introGo').onclick = () => { $('intro').hidden = true; sfx.unlock(); };
}
bindUI(); layoutTop();
newGame();
window.__api = { newGame, playMove, runQuiz, refreshTurn, onPick, enterReview, exitReview, gotoStep, replayStep, autoPlay, endGame };
