import { newGame, getStatus, applyMove } from '../src/chess.js';
import { chooseMove } from '../src/ai.js';
import { carryPromotion, grantKill } from '../src/rpg.js';
let res={};
for (const [lw,lb] of [['hard','easy'],['hard','medium'],['medium','easy'],['hard','hard']]) {
  const st=newGame(); let t0=Date.now(), n=0, tmax=0; let out;
  for(;;){
    const s=getStatus(st); if(s.result){out=s.result+':'+st.turn; break;} if(st.plies>300){out='cap300';break;}
    const lvl=st.turn==='w'?lw:lb; const t1=Date.now();
    const {move,promo}=chooseMove(st,lvl,s.moves);
    tmax=Math.max(tmax,Date.now()-t1);
    const att=move.piece; if(move.cap) grantKill(att,move.cap.type);
    applyMove(st,move,promo); if(move.promo) carryPromotion(att);
    n++;
  }
  console.log(lw,'vs',lb,'->',out,'plies',st.plies,'ms',Date.now()-t0,'max move ms',tmax);
}
