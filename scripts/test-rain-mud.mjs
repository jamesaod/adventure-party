import assert from 'node:assert/strict';
import {WetGround,N} from '../js/rain-mud-sim.mjs';
const sim=new WetGround(),settings={rain:1,drying:0};
for(let i=0;i<100;i++)sim.step(.1,settings);
assert(sim.wet[sim.index(0,0)]>.9);assert.equal(sim.wet[sim.index(4,4)],0);
sim.wet.fill(1);sim.stamp(0,0,0,1);assert(sim.dent[sim.index(0,0)]<0);
sim.stamp(4,0,0,1);assert.equal(sim.dent[sim.index(4,0)],0);
for(let i=0;i<100;i++)sim.stamp(0,0,0,1);
assert(Math.min(...sim.dent)>-.121);
sim.step(.1,{rain:0,drying:2});assert(sim.wet[0]<1);
for(let i=0;i<100;i++)sim.step(.1,settings);
assert([...sim.water].every(x=>Number.isFinite(x)&&x>=0));assert.equal(sim.water.length,N*N);
sim.reset();assert(sim.wet.every(x=>x===0)&&sim.water.every(x=>x===0)&&sim.dent.every(x=>x===0));
console.log('PASS shelter exposure, saturation, bounded soil deformation, stone exclusion, drying, nonnegative water and reset');

const field=new WetGround({allGrass:true});field.shelterEnabled=false;
for(let i=0;i<100;i++)field.step(.1,{rain:1,drying:0});
assert(field.wet[field.index(4,4)]>.9,'Disabled shelter allows rain on the whole field');
field.stamp(4,0,0,1);assert(field.dent[field.index(4,0)]<0,'Former stone panel is deformable in field mode');
