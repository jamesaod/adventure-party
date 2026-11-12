import assert from 'node:assert/strict';
import {createSnowCoatCoverage,SNOW_COAT_VISIBLE,SNOW_COAT_BLEND_START,SNOW_COAT_BLEND_END} from '../js/combat-snow-coats.mjs';
import {createHexSnow} from '../js/combat-snow-state.mjs';
const face=(key,x,y,w,h,snowEligible=1)=>({snowHex:key,snowEligible,points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]});
// Reproduce the reported visual failure: one grain touches a whole small
// receiver, but its material blend is only partial. It must not unlock powder.
const blend=mass=>{const t=Math.max(0,Math.min(1,(mass/255-SNOW_COAT_BLEND_START)/(SNOW_COAT_BLEND_END-SNOW_COAT_BLEND_START)));return t*t*(3-2*t);};
const tinyGround=createHexSnow();tinyGround.update([face('tiny',0,0,1,1)]);
const tiny=createSnowCoatCoverage();tiny.configure([0,0,1,1],1,1,tinyGround.hexes);
const grain=()=>tiny.deposit({x:.5,y:.5,landed:true},()=>0);
assert.equal(grain().layer,0);assert(blend(tiny.sample(0,0).first)>0&&blend(tiny.sample(0,0).first)<1);
assert.equal(tiny.coverage.first,0,'A touched but translucent-faint pixel is not a completed first coat');
assert.equal(grain().layer,0);assert.equal(blend(tiny.sample(0,0).first),1);assert.equal(tiny.coverage.first,1);
assert.equal(grain().layer,1);assert.equal(tiny.coverage.second,0);assert.equal(tiny.hasDepth,false);
assert.equal(grain().layer,1);assert.equal(blend(tiny.sample(0,0).second),1);
assert.equal(grain().layer,2);assert.equal(tiny.hasDepth,true);
tiny.melt(['tiny'],.25);assert.equal(tiny.coverage.first,0);assert.equal(tiny.coverage.second,0);
assert.equal(grain().layer,0);assert.equal(grain().layer,1);assert.equal(grain().layer,2);
const ground=createHexSnow();ground.update([face('left',-40,10,40,48),face('right',0,10,40,48),face('indoor',-40,58,80,12,0)]);
const coats=createSnowCoatCoverage();coats.configure([-40,10,80,60],80,60,ground.hexes);
assert.equal(coats.coverage.texels,80*48);
let seed=831;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
function independentlyCount(){const counts={first:0,second:0,depth:0};let total=0;for(let y=0;y<60;y++)for(let x=0;x<80;x++){const p=coats.sample(x,y);if(!p.eligible)continue;total++;for(const layer of Object.keys(counts))counts[layer]+=layer==='depth'?p[layer]>=SNOW_COAT_VISIBLE:blend(p[layer])===1;}for(const layer of Object.keys(counts))assert.equal(coats.coverage[layer],counts[layer]/total);assert.equal(coats.hasDepth,counts.depth>0);let progress=0;for(let y=0;y<60;y++)for(let x=0;x<80;x++){const p=coats.sample(x,y);if(p.eligible)progress+=blend(p.first)+blend(p.second)+p.depth/255;}assert(Math.abs(coats.progress-progress/total)<1e-9,'Incremental layer progress matches rendered texels');}
let secondStarted=false,depthStarted=false;
for(let i=0;i<12000;i++){
 const before=coats.coverage,point=ground.spawn(random);if(i%7===0)point.landed=true;
 const p=coats.deposit(point,random),after=coats.coverage;
 if(point.landed){assert.equal(p.x,Math.floor(point.x)+.5);assert.equal(p.y,Math.floor(point.y)+.5);}
 if(p.layer===1){assert.equal(before.first,1,'No powder before 100% base coverage');secondStarted=true;}
 if(p.layer===2){assert.equal(before.first,1);assert.equal(before.second,1,'No displacement before 100% powder coverage');depthStarted=true;}
 if(after.first<1){assert.equal(after.second,0);assert.equal(after.depth,0);}
 if(after.second<1)assert.equal(after.depth,0);
 if(i%37===0)independentlyCount();
 if(depthStarted&&after.depth>.3)break;
}
assert(secondStarted&&depthStarted,'Both 100% gates finish in bounded time');independentlyCount();
coats.melt(['left'],1);for(let y=0;y<48;y++)for(let x=0;x<40;x++){const p=coats.sample(x,y);for(const layer of ['first','second','depth'])assert.equal(p[layer],0,'Local melt removes every layer');}
assert(coats.coverage.first<.6);independentlyCount();
let repaired=false;
for(let i=0;i<12000;i++){
 const before=coats.coverage,p=coats.deposit(ground.spawn(random),random);
 if(before.first<1)assert.equal(p.layer,0,'Refill the melted base before new powder');
 else if(before.second<1)assert.equal(p.layer,1,'Refill powder before new displacement');
 else{assert.equal(p.layer,2);repaired=true;break;}
}
assert(repaired);coats.melt(['right'],.73);independentlyCount();
coats.clear();assert.deepEqual(coats.coverage,{first:0,second:0,depth:0,texels:80*48});assert.equal(coats.hasDepth,false);independentlyCount();
coats.configure([0,0,8,8],8,8,new Map());assert.equal(coats.coverage.texels,0);assert.equal(coats.deposit({x:1,y:1}),null);
console.log('PASS full material blend (not merely touched texels), strict 100% base → 100% powder → separate displacement; finite completion, visible landing positions, indoor exclusion, local melt/refill and clear.');
