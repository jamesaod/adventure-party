import assert from 'node:assert/strict';
import {createCoverSpatialIndex,createCoverPatchCache} from '../js/cover-patch-cache.mjs';
import {grassRetention} from '../js/tree-environment-profiles.mjs?v=sweet-birch1';
const trees=Array.from({length:40},(_,i)=>({x:(i%8)*170-600,y:Math.floor(i/8)*130-300,width:43,row:24,radius:2,feather:.65}));
const index=createCoverSpatialIndex(trees,t=>({left:t.x-t.radius*t.width*1.25,right:t.x+t.radius*t.width*1.25,top:t.y-t.radius*t.row*1.25,bottom:t.y+t.radius*t.row*1.25}));
let allChecks=0,localChecks=0;
for(let x=-800;x<900;x+=13)for(let y=-500;y<600;y+=17){const near=index.at(x,y);assert.equal(grassRetention(x,y,near),grassRetention(x,y,trees));allChecks+=trees.length;localChecks+=near.length;}
assert.ok(localChecks<allChecks/4,'Spatial queries remove most irrelevant trees');
assert.deepEqual(index.within({left:-1000,right:1000,top:-1000,bottom:1000}),trees,'Query preserves source order across buckets');
const cache=createCoverPatchCache(2),source=[],build=()=>[{x:1}];const first=cache.get('a',source,'summer:1',build);assert.equal(first.reused,false);assert.equal(cache.get('a',source,'summer:1',()=>{throw Error('rotation must reuse');}).items,first.items);assert.equal(cache.get('a',source,'summer:2',build).reused,false);assert.equal(cache.get('a',[], 'summer:2',build).reused,false);cache.clear();assert.equal(cache.get('a',source,'summer:2',build).reused,false);
console.log('PASS patch lifetime/invalidation, spatial exclusion parity, stable candidate order; tree checks '+localChecks+'/'+allChecks);
