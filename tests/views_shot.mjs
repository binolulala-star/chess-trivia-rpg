import puppeteer from 'puppeteer-core'; import path from 'node:path'; import fs from 'node:fs';
const out='/tmp/sim/shots9'; fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],defaultViewport:{width:900,height:900}});
const page=await browser.newPage(); const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); page.on('pageerror',e=>errs.push(e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ev=(f,...a)=>page.evaluate(f,...a);
await page.goto('file://'+path.resolve('dist/debug.html')); await sleep(2000); await page.click('#introGo'); await sleep(500);
await ev(()=>{document.body.classList.add('cine'); __view._userZoomed=true; __view.resize(); __view.scene.traverse(o=>{if(o.isSprite&&!o.userData.hd)o.visible=false;});});
const T=Math.PI;
for (const [nm,th,r,c] of [['w_back',0.0,7,3],['w_45',0.8,7,3],['w_right90',T/2,7,3],['w_135',T*0.8,7,3],['w_front',T,7,3],['w_left90',-T/2,7,3],['b_front',0.0,0,3],['b_right90',-T/2,0,3]]) {
  await ev((r,c,th)=>{const v=__view; for (const rc of v.pieces.values()) rc.group.visible = (rc.piece.type==='Q'&&rc.r===r&&rc.c===c); v.cam.target.set(c-3.5,0.7,r-3.5); v.cam.radius=3.8; v.cam.phi=1.2; v.cam.theta=th; v._applyCam(1,true);},r,c,th);
  await sleep(700); await page.screenshot({path:`${out}/${nm}.png`,clip:{x:150,y:150,width:600,height:600}});
}
console.log(errs); await browser.close();
