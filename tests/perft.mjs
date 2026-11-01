import { newGame, fromFEN, perft } from '../src/chess.js';
const t=(name,st,exp)=>{ exp.forEach((e,i)=>{ const t0=Date.now(); const n=perft(st,i+1); console.log(name,'depth',i+1,n,e,n===e?'OK':'FAIL',(Date.now()-t0)+'ms'); }); };
t('start',newGame(),[20,400,8902,197281]);
t('kiwipete',fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'),[48,2039,97862]);
t('pos3',fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'),[14,191,2812,43238]);
t('pos4',fromFEN('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1'),[6,264,9467]);
t('pos5',fromFEN('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8'),[44,1486,62379]);
