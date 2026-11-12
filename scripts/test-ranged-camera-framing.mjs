import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync('js/adventure-party.js','utf8');
const code=src.slice(src.indexOf('let rangedCameraGeneration=0;'),src.indexOf('async function focusRangedAttacker'));
for(let rotation=0;rotation<6;rotation++){
 let now=0;const W=1200,H=700,hex=80,row=40,anchor={x:W*.47,y:H*.57};
 const project=(p,inverse=false)=>{const angle=rotation*Math.PI/3*(inverse?-1:1),c=Math.cos(angle),s=Math.sin(angle),q=row/(hex*Math.sqrt(3)/2);return{x:p.x*c-p.y/q*s,y:p.x*s*q+p.y*c};};
 const world=(x,y)=>({x:x*hex+y*hex/2,y:y*row});
 const c={game:{},camera:{x:0,y:0},battlefieldZoom:1,BATTLEFIELD_LOGICAL_WIDTH:W,BATTLEFIELD_LOGICAL_HEIGHT:H,HEX_W:hex,HEX_ROW:row,worldPointForHex:world,battlefieldProjectVector:project,battlefieldZoomAnchor:()=>anchor,performance:{now:()=>now},window:{requestCombatAnimationTick(resolve){now+=1000/30;resolve();}},sleep:async()=>{now+=16;},draw(){},hoverHex:null};
 vm.createContext(c);vm.runInContext(code,c);
 await c.frameRangedAction({x:2,y:3},{x:18,y:14});
 for(const e of [{x:2,y:3},{x:18,y:14}]){const p=world(e.x,e.y),cam=world(c.camera.x,c.camera.y),v=project({x:p.x-cam.x,y:p.y-cam.y}),x=anchor.x+v.x*c.battlefieldZoom,y=anchor.y+v.y*c.battlefieldZoom;assert(x>0&&x<W&&y>0&&y<H);assert(y-hex*c.battlefieldZoom>0);}
 assert(now>=700&&now<735);
}
console.log('PASS ranged camera fits attacker and target at all six rotations with bounded smooth transition.');
