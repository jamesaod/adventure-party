import assert from 'node:assert/strict';
import {createHexSnow} from '../js/combat-snow-state.mjs';
let seed=12345;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const rectangle=(key,x,w)=>({snowHex:key,snowEligible:1,points:[{x,y:0},{x:x+w,y:0},{x:x+w,y:10},{x,y:10}]});
const snow=createHexSnow();snow.update([rectangle('a',0,10),rectangle('b',20,30),{...rectangle('indoor',60,10),snowEligible:0}]);
let a=0;for(let i=0;i<20000;i++)if(snow.spawn(random).hex==='a')a++;
assert.ok(a>4700&&a<5300,'spawn rate proportional to area');
const samples=[];for(let i=0;i<1000;i++)samples.push(...snow.land('a',random));
assert.ok(samples.every(p=>p.x>=0&&p.x<=10&&p.y>=0&&p.y<=10));
assert.ok(Math.abs(samples.reduce((n,p)=>n+p.x,0)/samples.length-5)<.2);
assert.equal(snow.hexes.has('indoor'),false);assert.equal(snow.hexes.get('b').amount,0);assert.equal(snow.hexes.get('a').amount,1);
snow.update([rectangle('a',0,10)]);assert.equal(snow.hexes.get('a').amount,1);
snow.melt('a',.5);assert.equal(snow.hexes.get('a').amount,.5);snow.melt('a',1);assert.equal(snow.hexes.get('a').amount,0);assert.equal(snow.melt('missing'),null);
snow.clear();assert.equal(snow.hexes.size,0);assert.equal(snow.spawn(random),null);
console.log('PASS area-weighted snowfall, random in-hex deposits, independent persistent hex amounts, indoor exclusion and clear');

const rateTest=createHexSnow();rateTest.update([rectangle("small",0,10),rectangle("large",20,30)]);rateTest.accumulate(30,1/60);assert.equal(rateTest.hexes.get("small").amount,.5);assert.equal(rateTest.hexes.get("large").amount,.5);rateTest.melt("small",1);rateTest.accumulate(6,1/60);assert.equal(rateTest.hexes.get("small").amount,.1);assert.equal(rateTest.hexes.get("large").amount,.6);console.log("PASS fixed time-based accumulation without particles; melting remains local and snow resumes");
