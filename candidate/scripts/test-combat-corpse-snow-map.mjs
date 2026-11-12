import assert from 'node:assert/strict';
import {createCorpseSnowMap} from '../js/combat-corpse-snow-map.mjs';
import {kickSnow,updateSnowKickup,clearSnowKickup} from '../js/combat-snow-kickup.mjs';
const size=32,top=new Float32Array(size*size).fill(-Infinity);for(let y=4;y<28;y++)for(let x=4;x<28;x++)top[y*size+x]=.2;
const map=createCorpseSnowMap(top,size);map.update(.5);assert(map.coverage.first>0);assert.equal(map.coverage.second,0);assert.equal(map.coverage.depth,0);
map.update(1.5);assert.equal(map.coverage.first,1);assert(map.coverage.second>0);assert.equal(map.coverage.depth,0);
map.update(2.5);assert.equal(map.coverage.first,1);assert.equal(map.coverage.second,1);assert(map.coverage.depth>0);
assert.equal(map.texture.image.data[0],0,'No deposits outside body silhouette');assert.equal(map.update(2.5),false,'Idle maps do not upload');
map.update(3);assert.equal(map.progress,3);map.update(1);assert(map.progress<3);map.update(0);assert.equal(map.progress,0);map.dispose();
clearSnowKickup();kickSnow(0,0,0,[20,12]);assert.equal(updateSnowKickup(0).length,0);for(let i=0;i<100;i++)kickSnow(0,0,.4,[20,12]);assert.equal(updateSnowKickup(0).length,256);const initial=updateSnowKickup(0)[0].h;assert.notEqual(updateSnowKickup(.05)[0].h,initial);assert.equal(updateSnowKickup(1).length,0);
console.log('PASS corpse grain-map gates, silhouette, full/melt/clear, retained upload and bounded moving snow particles');

const {createSnowCoatCoverage}=await import('../js/combat-snow-coats.mjs');
const ground=createSnowCoatCoverage(),body=createCorpseSnowMap(new Float32Array(16*16).fill(.2),16);
ground.configure([0,0,16,16],16,16,new Map([['g',{triangles:[{a:{x:0,y:0},b:{x:16,y:0},c:{x:16,y:16}},{a:{x:0,y:0},b:{x:16,y:16},c:{x:0,y:16}}]}]]));
let seed=133;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<2000&&ground.progress<3;i++){ground.deposit({x:random()*16,y:random()*16},random);body.update(ground.progress);assert(body.progress<=ground.progress+.05);if(ground.coverage.first<1)assert.equal(body.coverage.second,0);if(ground.coverage.second<1)assert.equal(body.coverage.depth,0);}
assert.equal(ground.progress,3);body.dispose();console.log('PASS corpse map remains synchronized to actual ground grain deposition through both layer gates');
