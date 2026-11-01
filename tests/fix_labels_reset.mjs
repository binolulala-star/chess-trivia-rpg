import puppeteer from 'puppeteer-core'; import path from 'node:path'; import fs from 'node:fs';
const file='file://'+path.resolve('dist/debug.html'); const out='/tmp/sim/shots6'; fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:90000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],defaultViewport:{width:1100,height:700}});
const page=await browser.newPage(); const errs=[]; page.on('console',m=>{if(['error'].includes(m.type()))errs.push(m.text())}); page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ev=(f,...a)=>page.evaluate(f,...a);
await page.goto(file); await sleep(1500); await page.click('#introGo'); await sleep(300);
await ev(()=>{document.getElementById('selMode').value='2p'; document.getElementById('selMode').dispatchEvent(new Event('change'));}); await sleep(500);
await page.screenshot({path:out+'/labels.png'});
const base=await ev(()=>__view.scene.children.length);
await ev(()=>{__api.onPick(7,6); __api.onPick(5,5);}); await page.waitForFunction(()=>__G.phase==='idle',{timeout:30000});
await ev(()=>{__api.onPick(1,4); __api.onPick(3,4);}); await page.waitForFunction(()=>__G.phase==='idle',{timeout:30000});
await ev(()=>{__api.onPick(5,5); __api.onPick(3,4);}); await sleep(1500);
await ev(()=>{const q=__G.curQ; const w=[0,1,2,3].find(i=>i!==q.ans); document.querySelectorAll('#qOpts button')[w].click();}); await sleep(300);
await page.click('#qGo'); await sleep(6000); // 決鬥進行中途直接重開
const mid=await ev(()=>__view.scene.children.length);
await ev(()=>__api.newGame()); await sleep(800);
const after=await ev(()=>({n:__view.scene.children.length, fl:document.querySelectorAll('.floatnum').length, ts:__view.timeScale, cine:document.body.classList.contains('cine'), spot:__view.spot.intensity}));
console.log({base,mid,after}); await page.screenshot({path:out+'/after_reset.png'});
console.log('errs',errs); await browser.close();
