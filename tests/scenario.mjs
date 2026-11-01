import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/chess-trivia-rpg-3d.html');
const out = '/tmp/sim/shots'; fs.mkdirSync(out,{recursive:true});
const browser = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:'new', args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'], protocolTimeout:60000, defaultViewport:{width:1100,height:700} });
const page = await browser.newPage();
const errs=[]; page.on('console',m=>{ if(['error','warning'].includes(m.type())) errs.push(m.type()+': '+m.text()); }); page.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto(file); await sleep(1500); await page.click('#introGo'); await sleep(500);
const shot=async n=>{ const t0=Date.now(); await page.screenshot({path:`${out}/${n}.png`}); console.log('shot',n,Date.now()-t0,'ms'); };
await shot('10_start');
// 1) 一般走棋 e2-e4 並等電腦回應
await page.evaluate(()=>{ __G.level='easy'; __api.onPick(6,4); }); await sleep(300);
await shot('11_selected');
await page.evaluate(()=>{ __api.onPick(4,4); }); await sleep(1800);
await page.evaluate(()=>{});
// 等待電腦回走
await page.waitForFunction(()=>__G.phase==='idle' && __G.st.turn==='w', {timeout:20000});
console.log('after e4 and AI reply plies', await page.evaluate(()=>__G.st.plies));
await shot('12_after_ai');
// 2) 佈置吃棋場景：白兵(6,3) 吃 黑兵 放在 (5,4)
console.log('step newgame'); await page.evaluate(()=>{ __api.newGame(); }); console.log('step newgame done');
await sleep(300);
await page.evaluate(()=>{
  const b=__G.st.board; const bp=b[1][4]; b[1][4]=null; b[5][4]=bp; __view.syncAll(b); __G.st.hist.clear(); __api.refreshTurn();
});
await sleep(300);
await page.evaluate(()=>{ __api.onPick(6,3); }); await sleep(300);
await shot('20_capture_select');
await page.evaluate(()=>{ __api.onPick(5,4); }); await sleep(1500);
await shot('21_quiz');
// 答錯 → 決鬥
await page.evaluate(()=>{ const q=__G.curQ; const wrong=[0,1,2,3].find(i=>i!==q.ans); document.querySelectorAll('#qOpts button')[wrong].click(); });
await sleep(300); await shot('22_quiz_wrong');
await page.click('#qGo'); await sleep(1800);
await shot('23_duel_a'); await sleep(1500); await shot('24_duel_b'); await sleep(1500); await shot('25_duel_c');
await page.waitForFunction(()=>!document.getElementById('duelhud').hidden===false || true);
await sleep(9000); await shot('26_after_duel');
console.log('state', JSON.stringify(await page.evaluate(()=>({phase:__G.phase,turn:__G.st.turn,plies:__G.st.plies,log:[...document.querySelectorAll('#log div')].map(d=>d.textContent).slice(-14)}))));
console.log('errors',JSON.stringify(errs));
await browser.close();
