import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readCombatFixture,extractCombatFunction} from './combat-test-source.mjs';
const source=readCombatFixture(new URL('../js/adventure-party.js?v=tree-snow-grains1',import.meta.url),'utf8'),draw=extractCombatFunction(source,'drawHpBar');
// An oblique/rotated projection exercises both screen axes and large footprints.
const hexCenter=(x,y)=>({x:100+x*31-y*19,y:80+x*13+y*23});
for(const large of [false,true])for(const anchorX of [2,3]){
 const calls=[],entity={x:anchorX,y:4,hp:5,maxHp:10,walkPresentation:{from:{x:2,y:4},to:{x:3,y:4},t:0}},offset=large?{x:12,y:7}:{x:0,y:0};
 const context={entity,hexCenter,unitFootprintScreenCenter:e=>{const p=hexCenter(e.x,e.y);return {x:p.x+offset.x,y:p.y+offset.y};},unitFootprintCellCount:()=>large?7:1,enlargeVisualScale:()=>1,ctx:{fillRect:(...args)=>calls.push(args),strokeRect(){}}};
 vm.runInNewContext(draw,context);
 for(const t of [0,.25,.5,.75,1]){entity.walkPresentation.t=t;calls.length=0;context.drawHpBar(entity,'red');const start=hexCenter(2,4),end=hexCenter(3,4),width=large?64:34;assert.equal(calls[0][0],start.x+(end.x-start.x)*t+offset.x-width/2);assert.equal(calls[0][1],start.y+(end.y-start.y)*t+offset.y-(large?78:39));assert.equal(calls[1][2],width/2);}
 delete entity.walkPresentation;calls.length=0;context.drawHpBar(entity,'red');assert.equal(calls[0][0],hexCenter(entity.x,entity.y).x+offset.x-(large?64:34)/2);
 for(const hp of [0,10]){entity.hp=hp;calls.length=0;context.drawHpBar(entity,'red');assert.equal(calls.length,0);}
}
console.log('PASS health bars track interpolated movement, rotated projection and large footprints; stationary positions and HP visibility preserved');
