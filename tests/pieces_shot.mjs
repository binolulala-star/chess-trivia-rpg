import puppeteer from 'puppeteer-core'; import path from 'node:path'; import fs from 'node:fs';
const out='/tmp/sim/shots7'; fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],defaultViewport:{width:900,height:900}});
const page=await browser.newPage(); const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); page.on('pageerror',e=>errs.push(e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ev=(f,...a)=>page.evaluate(f,...a);
await page.goto('file://'+path.resolve('dist/debug.html')); await sleep(1500); await page.click('#introGo'); await sleep(500);
await page.screenshot({path:out+'/board.png'});
const list=[['P',6,4,'w'],['N',7,1,'w'],['B',7,2,'w'],['R',7,0,'w'],['Q',7,3,'w'],['K',7,4,'w'],['Q',0,3,'b'],['K',0,4,'b']];
await ev(()=>{document.body.classList.add('cine'); __view._userZoomed=true; __view.resize(); __view.scene.traverse(o=>{if(o.isSprite)o.visible=false;});});
for (const [t,r,c,col] of list){
  for (const [nm,th] of [['back',0.45],['front',Math.PI+0.45]]) {
  await ev((r,c,th)=>{const v=__view; v.cam.target.set(c-3.5,0.65,r-3.5); v.cam.radius=3.6; v.cam.phi=1.2; v.cam.theta=th; v._applyCam(1,true);},r,c,th);
  await sleep(400); if(t==='K'&&nm==='back') console.log(await ev(()=>({r:__view.cam.radius,fit:__view.fitR,pos:__view.camera.position.toArray()}))); await page.screenshot({path:`${out}/${t}_${col}_${nm}.png`,clip:{x:150,y:100,width:600,height:700}}); }
}
console.log(errs); await browser.close();
