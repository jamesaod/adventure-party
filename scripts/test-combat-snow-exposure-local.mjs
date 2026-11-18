import assert from 'node:assert/strict';
import {createSnowCoatCoverage} from '../js/combat-snow-coats.mjs';
import {createHexSnow} from '../js/combat-snow-state.mjs';
import {configureSnowShelter,finalizeSnowShelter,snowShelterRevision,snowShelterChange,snowExposureAt} from '../js/combat-snow-shelter.mjs';
const ground=createHexSnow();ground.update([{snowHex:'all',snowEligible:1,points:[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}]}]);
const a=createSnowCoatCoverage(),b=createSnowCoatCoverage();for(const c of [a,b])c.configure([0,0,1000,1000],256,256,ground.hexes);
const trees=[{x:100,y:100,radius:40},{x:500,y:500,radius:40},{x:900,y:900,radius:40}];
const set=t=>{configureSnowShelter(t,[0,0,1000,1000],40);finalizeSnowShelter();};
const compare=()=>{assert.deepEqual(a.coverage,b.coverage);assert(Math.abs(a.progress-b.progress)<1e-9);for(let y=0;y<256;y++)for(let x=0;x<256;x++)assert.deepEqual(a.sample(x,y),b.sample(x,y));};
set(trees);a.setExposureField(snowShelterRevision(),snowExposureAt);b.setExposureField(snowShelterRevision(),snowExposureAt);for(const c of [a,b])c.adjustDepth(.6);
for(const next of [trees.slice(1),trees,[],trees]){set(next);let samples=0;const sample=(x,y)=>{samples++;return snowExposureAt(x,y);};a.setExposureField(snowShelterRevision(),sample,snowShelterChange());b.setExposureField(snowShelterRevision(),snowExposureAt);compare();console.log({remainingTrees:next.length,sampledTexels:samples,totalTexels:65536});if(next.length===2)assert(samples<2048,'Local tree change must not resample the map');}
set(trees);let samples=0;a.setExposureField(snowShelterRevision(),()=>{samples++;return 1;},snowShelterChange());assert.equal(samples,0,'Unchanged shelter does no coat work');
set([]);set(trees.slice(1));a.setExposureField(snowShelterRevision(),snowExposureAt,snowShelterChange());b.setExposureField(snowShelterRevision(),snowExposureAt);compare();
let seed=1;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);for(let n=0;n<100;n++){const point={x:random()*1000,y:random()*1000,landed:true};const save=seed;assert.deepEqual(a.deposit(point,random),(()=>{seed=save;return b.deposit(point,random);})());}compare();
console.log('PASS local tree shelter removal/restoration, retained snow, coverage accounting, deposition, unchanged field and missed-revision fallback');
