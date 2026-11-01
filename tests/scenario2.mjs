import puppeteer from 'puppeteer-core'; import path from 'node:path'; import fs from 'node:fs';
const file='file://'+path.resolve('dist/chess-trivia-rpg-3d.html'); const out='/tmp/sim/shots2'; fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:60000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],defaultViewport:{width:1000,height:640}});
const page=await browser.newPage(); const errs=[]; page.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.text())}); page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ev=(f,...a)=>page.evaluate(f,...a);
const shot=async n=>{await page.screenshot({path:`${out}/${n}.png`});};
await page.goto(file); await sleep(1500); await page.click('#introGo'); await sleep(300);
// ---- A. 答對秒殺 + 成長 ----
await ev(()=>{const b=__G.st.board; const bp=b[1][4]; b[1][4]=null; b[5][4]=bp; __view.syncAll(b); __G.st.hist.clear(); __api.refreshTurn(); __api.onPick(6,3); __api.onPick(5,4);});
await sleep(1200);
await ev(()=>{const q=__G.curQ; document.querySelectorAll('#qOpts button')[q.ans].click();});
await sleep(1800); await shot('30_kill_a'); await sleep(1500); await shot('31_kill_b'); await sleep(6000); await shot('32_after_kill');
console.log('A', JSON.stringify(await ev(()=>({phase:__G.phase,turn:__G.st.turn,kills:__G.st.board[5][4]&&__G.st.board[5][4].kills,piece:__G.st.board[5][4]&&__G.st.board[5][4].type,log:[...document.querySelectorAll('#log div')].map(d=>d.textContent).slice(-4)}))));
await page.waitForFunction(()=>__G.phase==='idle',{timeout:60000}).catch(()=>console.log('A: not idle'));
await ev(()=>{__view.setPreset('side');}); await sleep(3000); await shot('33_side_view');
// ---- B. 愚人將死（雙人）----
await ev(()=>{document.getElementById('selMode').value='2p'; document.getElementById('selMode').dispatchEvent(new Event('change'));});
await sleep(500);
for (const [a,b] of [[[6,5],[5,5]],[[1,4],[3,4]],[[6,6],[4,6]],[[0,3],[4,7]]]) { await ev((a,b)=>{__api.onPick(...a);__api.onPick(...b);},a,b); await page.waitForFunction(()=>__G.phase==='idle'||__G.over,{timeout:30000}); await sleep(200); }
await sleep(2500); await shot('40_mate');
console.log('B over', await ev(()=>({over:__G.over,title:document.getElementById('overTitle').textContent,text:document.getElementById('overText').textContent})));
// ---- C. 王車易位 ----
await ev(()=>{document.getElementById('overNew').click();}); await sleep(500);
await ev(()=>{const b=__G.st.board; b[7][5]=null;b[7][6]=null; __view.syncAll(b); __G.st.hist.clear(); __api.refreshTurn(); __api.onPick(7,4);}); await sleep(300); await shot('50_castle_sel');
await ev(()=>{__api.onPick(7,6);}); await page.waitForFunction(()=>__G.phase==='idle',{timeout:30000}); await sleep(300);
console.log('C', await ev(()=>({k:__G.st.board[7][6]&&__G.st.board[7][6].type,r:__G.st.board[7][5]&&__G.st.board[7][5].type, vr:__view.rec(__G.st.board[7][5]).c, vk:__view.rec(__G.st.board[7][6]).c, turn:__G.st.turn})));
// ---- D. 升變 ----
await ev(()=>{__api.newGame();}); await sleep(300);
await ev(()=>{const b=__G.st.board; b[0][0]=null; const p=b[6][0]; b[6][0]=null; b[1][0]=p; __view.syncAll(b); __G.st.hist.clear(); __api.refreshTurn(); __api.onPick(1,0); __api.onPick(0,0);});
await sleep(2500); await shot('60_promo');
await ev(()=>{document.querySelectorAll('#promoBtns button')[1].click();}); await sleep(2500);
console.log('D', await ev(()=>({t:__G.st.board[0][0]&&__G.st.board[0][0].type, hasMesh:!!__view.rec(__G.st.board[0][0])})));
await shot('61_promoted');
console.log('errors',JSON.stringify(errs));
await browser.close();
