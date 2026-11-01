import puppeteer from 'puppeteer-core'; import path from 'node:path'; import fs from 'node:fs';
const file='file://'+path.resolve('dist/chess-trivia-rpg-3d.html'); const out='/tmp/sim/shots5'; fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:90000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],defaultViewport:{width:1000,height:640}});
const page=await browser.newPage(); const errs=[]; page.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.text())}); page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ev=(f,...a)=>page.evaluate(f,...a);
const shot=async n=>{await page.screenshot({path:`${out}/${n}.png`});};
await page.goto(file); await sleep(1500); await page.click('#introGo'); await sleep(300);
// 每種棋子對決：佈置後強制答錯，截取招式畫面。測試皇后／城堡／主教／國王的招式
const setups = [
  ['Q', 'R'], ['R', 'N'], ['B', 'N'], ['K', 'P'],
];
for (const [at, df] of setups) {
  await ev(([at,df])=>{
    __api.newGame();
    document.getElementById('selMode').value='2p'; __G.mode='2p';
    const b=__G.st.board; for(let r=0;r<8;r++) for(let c=0;c<8;c++) b[r][c]=null;
    const mk=(t,col)=>({id:Math.floor(Math.random()*1e9),type:t,color:col,kills:0,gHP:0,gATK:0,gDEF:0});
    b[7][4]=at==='K'?null:mk('K','w'); b[0][4]=mk('K','b');
    b[4][3]=mk(at,'w'); b[3][4]=mk(df,'b');
    if(at==='K'){ b[4][3]=mk('K','w'); }
    __G.st.castle={wK:false,wQ:false,bK:false,bQ:false};
    __view.syncAll(b); __G.st.hist.clear(); __api.refreshTurn(); __api.onPick(4,3); __api.onPick(3,4);
  },[at,df]);
  await sleep(1500);
  const hasQ = await ev(()=>!document.getElementById('quiz').hidden);
  if(!hasQ){ console.log(at,'no quiz'); continue; }
  await ev(()=>{const q=__G.curQ; const w=[0,1,2,3].find(i=>i!==q.ans); document.querySelectorAll('#qOpts button')[w].click();}); await sleep(200);
  await page.click('#qGo');
  let k=0;
  for(let i=0;i<220;i++){ await sleep(300); const st=await ev(()=>({hud:!document.getElementById('duelhud').hidden, phase:__G.phase, tw:__view.tweens.length}));
    if(st.hud && k<3 && i%3===1){ await shot(`${at}v${df}_${k++}`); }
    if(st.phase==='idle'||st.phase==='over') break; }
  console.log(at,'vs',df, JSON.stringify(await ev(()=>[...document.querySelectorAll('#log div')].map(d=>d.textContent).slice(-2))));
}
// 回顧中重播決鬥：HUD 應可見
await ev(()=>{__api.endGame('resign','b');}); await sleep(1200);
await ev(()=>{__api.enterReview();}); await sleep(600);
await ev(()=>{__api.replayStep(1,true);});
for(let i=0;i<20;i++){ await sleep(400); const st=await ev(()=>({hud:!document.getElementById('duelhud').hidden, rv:document.getElementById('review').hidden})); if(st.hud){ await shot('rv_replay_hud'); console.log('replay hud visible, review hidden:',st.rv); break; } }
await ev(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));}); await sleep(800);
console.log('after esc', JSON.stringify(await ev(()=>({phase:__G.phase, rvHidden:document.getElementById('review').hidden, ts:__view.timeScale}))));
console.log('errors',JSON.stringify(errs));
await browser.close();
