// Web Audio 合成音效（不使用任何外部音檔）
let ctx = null, master = null, muted = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}
function tone(freq, t0, dur, { type = 'sine', vol = 0.25, slide = 0, attack = 0.01 } = {}) {
  if (muted || !ensure()) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime + t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), ctx.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
  o.connect(g); g.connect(master); o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.05);
}
function noise(t0, dur, { vol = 0.3, lp = 1800 } = {}) {
  if (muted || !ensure()) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(ctx.currentTime + t0);
}

export const sfx = {
  unlock() { ensure(); },
  setMuted(m) { muted = m; },
  isMuted() { return muted; },
  move() { tone(220, 0, 0.09, { type: 'triangle', vol: 0.22, slide: -80 }); noise(0, 0.05, { vol: 0.12, lp: 900 }); },
  select() { tone(660, 0, 0.06, { type: 'sine', vol: 0.12 }); },
  quizStart() { [392, 494, 587].forEach((f, i) => tone(f, i * 0.07, 0.35, { type: 'sine', vol: 0.14 })); },
  tick() { tone(1000, 0, 0.04, { type: 'square', vol: 0.06 }); },
  correct() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.28, { type: 'triangle', vol: 0.2 })); },
  wrong() { tone(180, 0, 0.35, { type: 'sawtooth', vol: 0.2, slide: -60 }); tone(170, 0.12, 0.35, { type: 'sawtooth', vol: 0.18, slide: -60 }); },
  shockwave() { tone(90, 0, 0.5, { type: 'sine', vol: 0.5, slide: -50 }); noise(0, 0.4, { vol: 0.35, lp: 3200 }); tone(1400, 0, 0.3, { type: 'triangle', vol: 0.12, slide: 600 }); },
  hit() { tone(140, 0, 0.18, { type: 'square', vol: 0.25, slide: -90 }); noise(0, 0.14, { vol: 0.35, lp: 2200 }); },
  crit() { tone(100, 0, 0.3, { type: 'sawtooth', vol: 0.3, slide: -60 }); noise(0, 0.25, { vol: 0.45, lp: 3800 }); tone(900, 0.02, 0.2, { type: 'triangle', vol: 0.15, slide: 500 }); },
  shield() { tone(740, 0, 0.3, { type: 'sine', vol: 0.15, slide: 400 }); },
  knock() { noise(0, 0.5, { vol: 0.3, lp: 1500 }); tone(70, 0, 0.5, { type: 'sine', vol: 0.4, slide: -30 }); },
  bounce() { tone(300, 0, 0.35, { type: 'triangle', vol: 0.2, slide: -180 }); },
  levelUp() { [440, 554, 659, 880, 1109].forEach((f, i) => tone(f, i * 0.08, 0.3, { type: 'triangle', vol: 0.18 })); },
  check() { tone(880, 0, 0.12, { type: 'square', vol: 0.12 }); tone(880, 0.16, 0.12, { type: 'square', vol: 0.12 }); },
  promote() { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.3, { type: 'triangle', vol: 0.2 })); },
  // 棋種移動音效
  moveKind(kind) {
    switch (kind) {
      case 'step': tone(260, 0, 0.07, { type: 'triangle', vol: 0.16, slide: -60 }); noise(0, 0.04, { vol: 0.08, lp: 900 }); break;
      case 'leap': tone(300, 0, 0.35, { type: 'sine', vol: 0.12, slide: 500 }); noise(0, 0.3, { vol: 0.06, lp: 3000 }); break;
      case 'land': tone(110, 0, 0.18, { type: 'triangle', vol: 0.3, slide: -50 }); noise(0, 0.14, { vol: 0.2, lp: 1200 }); break;
      case 'glide': [660, 880].forEach((f, i) => tone(f, i * 0.06, 0.4, { type: 'sine', vol: 0.06, slide: 120 })); break;
      case 'rumble': noise(0, 0.45, { vol: 0.16, lp: 420 }); break;
      case 'thud': tone(70, 0, 0.3, { type: 'sine', vol: 0.45, slide: -25 }); noise(0, 0.2, { vol: 0.25, lp: 700 }); break;
      case 'chime': [784, 1175].forEach((f, i) => tone(f, i * 0.08, 0.45, { type: 'triangle', vol: 0.1 })); break;
      default: tone(220, 0, 0.09, { type: 'triangle', vol: 0.22, slide: -80 });
    }
  },
  // 棋種招式音效（首次出手喊招）
  skill(type) {
    switch (type) {
      case 'P': tone(520, 0, 0.12, { type: 'square', vol: 0.1, slide: 300 }); break;
      case 'N': tone(220, 0, 0.3, { type: 'sawtooth', vol: 0.12, slide: 600 }); break;
      case 'B': [523, 784, 1047].forEach((f, i) => tone(f, i * 0.05, 0.6, { type: 'sine', vol: 0.1 })); break;
      case 'R': tone(90, 0, 0.45, { type: 'sawtooth', vol: 0.2, slide: 40 }); break;
      case 'Q': tone(1200, 0, 0.18, { type: 'triangle', vol: 0.1, slide: -600 }); tone(1400, 0.1, 0.18, { type: 'triangle', vol: 0.1, slide: -700 }); break;
      case 'K': [392, 494, 587, 784].forEach((f, i) => tone(f, i * 0.07, 0.5, { type: 'triangle', vol: 0.12 })); break;
      default:
    }
  },
  ko() { tone(55, 0, 1.2, { type: 'sine', vol: 0.55, slide: -20 }); noise(0, 0.6, { vol: 0.4, lp: 2500 }); tone(880, 0, 0.9, { type: 'triangle', vol: 0.12, slide: -700 }); },
  slowWhoosh() { noise(0, 1.4, { vol: 0.14, lp: 600 }); tone(160, 0, 1.4, { type: 'sine', vol: 0.12, slide: -90, attack: 0.3 }); },
  land() { tone(80, 0, 0.35, { type: 'sine', vol: 0.4, slide: -30 }); noise(0, 0.25, { vol: 0.3, lp: 900 }); },
  win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.13, 0.4, { type: 'triangle', vol: 0.22 })); },
  lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.2, 0.5, { type: 'sawtooth', vol: 0.16 })); },
  draw() { [440, 440, 392].forEach((f, i) => tone(f, i * 0.18, 0.4, { type: 'sine', vol: 0.18 })); },
};
