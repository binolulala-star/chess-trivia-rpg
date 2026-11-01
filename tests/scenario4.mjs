import puppeteer from 'puppeteer-core'; import path from 'node:path'; import fs from 'node:fs';
const file='file://'+path.resolve('dist/chess-trivia-rpg-3d.html'); const out='/tmp/sim/shots4'; fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:90000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],defaultViewport:{width:1000,height:640}});
const page=await browser.newPage(); const errs=[]; page.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.text())}); page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ev=(f,...a)=>page.evaluate(f,...a);
const shot=async n=>{await page.screenshot({path:`${out}/${n}.png`});};
await page.goto(file); await sleep(1500); await shot('00_intro'); await page.click('#introGo'); await sleep(300);
await ev(()=>{document.getElementById('selMode').value='2p'; document.getElementById('selMode').dispatchEvent(new Event('change'));}); await sleep(300);
// 1) 一般移動：騎士 g1-f3
await ev(()=>{__api.onPick(7,6); __api.onPick(5,5);}); await sleep(900); await shot('10_knight_leap');
await page.waitForFunction(()=>__G.phase==='idle',{timeout:30000});
// 黑方走 e7-e5
await ev(()=>{__api.onPick(1,4); __api.onPick(3,4);}); await page.waitForFunction(()=>__G.phase==='idle',{timeout:30000});
// 2) 白騎士 f3 吃 e5 → 答錯 → 決鬥（騎士 vs 兵，騎士幾乎必勝）
await ev(()=>{__api.onPick(5,5); __api.onPick(3,4);}); await sleep(1500);
await ev(()=>{const q=__G.curQ; const w=[0,1,2,3].find(i=>i!==q.ans); document.querySelectorAll('#qOpts button')[w].click();}); await sleep(300);
await page.click('#qGo');
// 截圖：決鬥中與 K.O.
let koShots=0, n=0;
for (let i=0;i<160;i++){ await sleep(350); const st=await ev(()=>({cine:document.querySelector('.cinebars').classList.contains('on'), ts:__view.timeScale, hud:!document.getElementById('duelhud').hidden, phase:__G.phase}));
  if (st.hud && n<3 && i%4===0){ await shot('20_duel_'+(n++)); }
  if (st.cine && koShots<4){ await shot('30_ko_'+(koShots++)+'_ts'+st.ts.toFixed(2)); }
  if (st.phase==='idle') break; }
console.log('after duel', JSON.stringify(await ev(()=>({phase:__G.phase, turn:__G.st.turn, e5: __G.st.board[3][4]&&(__G.st.board[3][4].color+__G.st.board[3][4].type), hist:__G.hist.length, ts:__view.timeScale, log:[...document.querySelectorAll('#log div')].map(d=>d.textContent).slice(-4)}))));
// 3) 黑方：騎士 b8-c6；白方：主教 f1-c4（主教滑行）
await ev(()=>{__api.onPick(0,1); __api.onPick(2,2);}); await page.waitForFunction(()=>__G.phase==='idle',{timeout:30000});
await ev(()=>{__api.onPick(6,4); __api.onPick(4,4);}); await sleep(500); await shot('11_pawn_hop'); await page.waitForFunction(()=>__G.phase==='idle',{timeout:30000});
// 4) 黑騎士 c6 吃 白騎士 e5 → 答錯 → 騎士 vs 騎士（防守方大多勝 → 擊退）
await ev(()=>{__api.onPick(2,2); __api.onPick(3,4);}); await sleep(1500);
await ev(()=>{const q=__G.curQ; const w=[0,1,2,3].find(i=>i!==q.ans); document.querySelectorAll('#qOpts button')[w].click();}); await sleep(300);
await page.click('#qGo');
let bs=0;
for (let i=0;i<200;i++){ await sleep(350); const st=await ev(()=>({cine:document.querySelector('.cinebars').classList.contains('on'), ts:__view.timeScale, phase:__G.phase}));
  if (st.cine && bs<2 && i%2===0){ await shot('40_cine_'+(bs++)+'_ts'+st.ts.toFixed(2)); }
  if (st.phase==='idle') break; }
console.log('after duel2', JSON.stringify(await ev(()=>({phase:__G.phase, turn:__G.st.turn, hist:__G.hist.length, log:[...document.querySelectorAll('#log div')].map(d=>d.textContent).slice(-3)}))));
// 白主教 f1-c4（滑行）
const t1=await ev(()=>__G.st.turn); console.log('turn before bishop', t1);
if (t1==='w') { await ev(()=>{__api.onPick(7,5); __api.onPick(4,2);}); await sleep(700); await shot('12_bishop_glide'); await page.waitForFunction(()=>__G.phase==='idle',{timeout:30000}); }
// 5) 認輸並進入回顧
await ev(()=>{__api.endGame('resign', __G.st.turn);}); await sleep(1500); await shot('50_over');
await ev(()=>{document.getElementById('overReview').click();}); await sleep(1200); await shot('51_review_last');
await ev(()=>{__api.gotoStep(3);}); await sleep(900); await shot('52_review_step3');
console.log('review', JSON.stringify(await ev(()=>({phase:__G.phase, idx:__G.rvIdx, chips:[...document.querySelectorAll('#rvList button')].map(b=>b.textContent), detail:document.getElementById('rvDetail').innerText.slice(0,300)}))));
// 重播第 3 步（決鬥）
await ev(()=>{ document.getElementById('rvReplay').click(); });
let rs=0; for (let i=0;i<220;i++){ await sleep(350); const st=await ev(()=>({hud:!document.getElementById('duelhud').hidden,cine:document.querySelector('.cinebars').classList.contains('on'),pos:document.getElementById('rvPos').textContent}));
  if ((st.hud||st.cine) && rs<2 && i%5===0) await shot('53_replay_'+(rs++));
  if (!st.pos.includes('重播中') && i>3) break; }
console.log('after replay', await ev(()=>document.getElementById('rvPos').textContent));
// 自動播放
await ev(()=>{__api.gotoStep(0); document.getElementById('rvPlay').click();}); await sleep(6000); await shot('54_autoplay');
console.log('autoplay idx', await ev(()=>__G.rvIdx));
await ev(()=>{document.getElementById('rvClose').click();}); await sleep(500);
console.log('exit', JSON.stringify(await ev(()=>({phase:__G.phase, pieces:__view.pieces.size, rv:document.getElementById('review').hidden}))));
console.log('errors',JSON.stringify(errs));
await browser.close();
