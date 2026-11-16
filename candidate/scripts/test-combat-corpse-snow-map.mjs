import assert from 'node:assert/strict';
import {createCorpseSnowMap} from '../js/combat-corpse-snow-map.mjs?v=tree-snow-grains1';
import {kickSnow,updateSnowKickup,clearSnowKickup} from '../js/combat-snow-kickup.mjs';
const size=32,top=new Float32Array(size*size).fill(-Infinity);for(let y=4;y<28;y++)for(let x=4;x<28;x++)top[y*size+x]=.2;
const map=createCorpseSnowMap(top,size);map.update(.5);assert(map.coverage.first>0);assert.equal(map.coverage.second,0);assert.equal(map.coverage.depth,0);
map.update(1.5);assert.equal(map.coverage.first,1);assert(map.coverage.second>0);assert.equal(map.coverage.depth,0);
map.update(2.5);assert.equal(map.coverage.first,1);assert.equal(map.coverage.second,1);assert(map.coverage.depth>0);
assert.equal(map.texture.image.data[0],0,'No deposits outside body silhouette');assert.equal(map.update(2.5),false,'Idle maps do not upload');
map.update(3);assert.equal(map.progress,3);map.update(1);assert(map.progress<3);map.update(0);assert.equal(map.progress,0);map.dispose();
clearSnowKickup();kickSnow(0,0,0,[20,12]);assert.equal(updateSnowKickup(0).length,0);for(let i=0;i<100;i++)kickSnow(0,0,.4,[20,12]);assert.equal(updateSnowKickup(0).length,256);const initial=updateSnowKickup(0)[0].h;assert.notEqual(updateSnowKickup(.05)[0].h,initial);assert.equal(updateSnowKickup(1).length,0);
console.log('PASS corpse grain-map gates, silhouette, full/melt/clear, retained upload and bounded moving snow particles');

const full=createCorpseSnowMap(new Float32Array(256).fill(.2),16);
for(let layer=0;layer<4;layer++){
 full.update(layer+.5);const coverage=full.coverage.layers;
 for(let i=0;i<layer;i++)assert.equal(coverage[i],1);
 for(let i=layer+1;i<4;i++)assert.equal(coverage[i],0);
 assert(coverage[layer]>0&&coverage[layer]<1);assert(Math.abs(full.progress-(layer+.5))<.08);assert(full.texture.image.data.some(v=>v>0&&v<87),'Soft brush falloff retains intermediate grain values');
 full.update(layer+1);assert.equal(full.coverage.layers[layer],1);
}
full.update(100);assert.equal(full.progress,4);assert(full.texture.image.data.every(v=>v===255));full.dispose();
const {registerCorpseSnow,advanceCorpseSnow,adjustCorpseSnow,resetCorpseSnow}=await import('../js/combat-corpse-snow.mjs?v=tree-snow-grains1');
resetCorpseSnow(true);const amount=registerCorpseSnow({alive:false,x:0,y:0}),hexes=new Set(['0,0']);
for(let i=1;i<=4;i++){advanceCorpseSnow(hexes,30);assert.equal(amount.value,i);}
advanceCorpseSnow(hexes,600);assert.equal(amount.value,4);adjustCorpseSnow(hexes,6);assert.equal(amount.value,4);
resetCorpseSnow();assert.equal(amount.value,0);advanceCorpseSnow(new Set(),120);assert.equal(amount.value,0);advanceCorpseSnow(hexes,0);assert.equal(amount.value,0);resetCorpseSnow(true);
console.log('PASS four strict half-inch gates, 25/50/75/100% coverage, 120-second cap and outdoor/zero-time exclusion');
