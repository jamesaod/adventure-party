import assert from 'node:assert/strict';
import {coverPlacements as placements,coverField,ORIGINAL_GRASS_DEFAULTS} from '../js/combat-ground-cover.mjs?v=cover-profile1';
const coverPlacements=face=>placements(face,ORIGINAL_GRASS_DEFAULTS);
const face=(left=0,right=512)=>({grass:true,grassUnit:128/3,grassSquash:.568329,snowEligible:1,points:[{x:left,y:0},{x:right,y:0},{x:right,y:290},{x:left,y:290}]});
const all=coverPlacements(face()),split=[...coverPlacements(face(0,137)),...coverPlacements(face(137,512))],sorted=a=>a.map(x=>JSON.stringify(x)).sort();
assert.deepEqual(sorted(all),sorted(split),'Fragment boundaries must not relocate or duplicate cover');
assert.deepEqual(coverPlacements(face()),all);
assert.equal(new Set(all.map(x=>x.key)).size,all.length);
assert(all.length>100&&all.length<2000);
for(const type of [0,1,2])assert(all.some(x=>x.type===type));
assert.equal(coverPlacements({...face(),grass:false}).length,0);
assert.equal(coverPlacements({...face(),snowEligible:0}).length,0);
for(const p of all){assert(Object.values(p).filter(v=>typeof v==='number').every(Number.isFinite));assert(Math.abs(coverField(p.x,p.y)-coverField(p.x+.001,p.y))<.005);}
console.log('PASS deterministic clustered cover, fragment invariance, bounded density, three materials and indoor exclusions');
