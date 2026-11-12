import assert from 'node:assert/strict';
import {configureSnowShelter,snowExposureAt,snowShelterRevision} from '../js/combat-snow-shelter.mjs';
const bounds=[-100,-100,200,200];configureSnowShelter([{x:0,y:0}],bounds,40);
assert.equal(snowExposureAt(0,0),0);assert.equal(snowExposureAt(3,0),0);
const samples=[0,5,10,20,30,40,60].map(x=>snowExposureAt(x,0));
for(let i=1;i<samples.length;i++)assert(samples[i]>=samples[i-1]);
assert.equal(samples.at(-1),1);assert.equal(snowExposureAt(200,200),1);
assert(Math.abs(snowExposureAt(20,0)-snowExposureAt(0,20))<1e-8);
const rev=snowShelterRevision();configureSnowShelter([{x:0,y:0},{x:20,y:0}],bounds,40);
assert.equal(snowExposureAt(20,0),0);assert(snowShelterRevision()>rev);
configureSnowShelter([],bounds,40);assert.equal(snowExposureAt(0,0),1);
console.log('PASS bare fir trunks, progressive canopy depth, symmetry, overlapping shelter and scene reset');

configureSnowShelter([{x:-50,y:0,radius:20},{x:50,y:0,radius:40}],[-150,-100,300,200],40,.57);
assert(Math.abs(snowExposureAt(-40,0)-snowExposureAt(-50,5.7))<.015,'Equal physical radii have equal shelter');
assert(Math.abs(snowExposureAt(-40,0)-snowExposureAt(70,0))<.015,'Canopy radius scales the shelter');
assert(snowExposureAt(-25,0)>.99);assert(snowExposureAt(75,0)<.8);
console.log('PASS circular ground metric and per-tree canopy sizing');
