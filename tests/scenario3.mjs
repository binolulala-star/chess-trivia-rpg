import puppeteer from 'puppeteer-core'; import path from 'node:path';
const file='file://'+path.resolve('dist/chess-trivia-rpg-3d.html');
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:90000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],defaultViewport:{width:800,height:500}});
const page=await browser.newPage(); const errs=[]; page.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.text())}); page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto(file); await sleep(1200); await page.click('#introGo');
for (const level of ['easy','medium','hard']) {
  await page.evaluate((lv)=>{__G.level=lv; __api.newGame(); const b=__G.st.board; const wp=b[6][4]; b[6][4]=null; b[4][4]=wp; const bp=b[1][3]; b[1][3]=null; b[3][3]=bp; __view.syncAll(b); __G.st.hist.clear(); __api.refreshTurn(); __api.onPick(6,0); __api.onPick(5,0);},level);
  // 等電腦回應（可能出題）
  let sawQuiz=false;
  for (let i=0;i<120;i++){ await sleep(500); const s=await page.evaluate(()=>({q:!document.getElementById('quiz').hidden,phase:__G.phase,turn:__G.st.turn,plies:__G.st.plies})); if(s.q) sawQuiz=true; if(s.phase==='idle'&&s.turn==='w'&&s.plies>=2) break; }
  const r=await page.evaluate(()=>({phase:__G.phase,plies:__G.st.plies,log:[...document.querySelectorAll('#log div')].map(d=>d.textContent).slice(-5)}));
  console.log(level,'sawQuiz',sawQuiz,JSON.stringify(r));
}
console.log('errors',JSON.stringify(errs));
await browser.close();
