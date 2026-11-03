import assert from 'node:assert/strict';
import {createWallLightmap,wallLightingUv} from '../js/wall-lightmap.mjs';
import {selectShadowLights,shadowSceneTriangles} from '../js/combat-shadow-maps.mjs';
const paint=[];const canvas=()=>({getContext:()=>({set fillStyle(v){paint.push(v);},fillRect(...v){paint.push(v);}})});
const fragment=(x,color)=>({points:[{x,y:0,elevation:0},{x:x+1,y:0,elevation:0},{x:x+1,y:0,elevation:35},{x,y:0,elevation:35}],exposure:{multiply:color,boost:[0,0,0]}});
const a=fragment(0,[100,150,200]),b=fragment(1,[200,150,100]),atlas=createWallLightmap([a,b],canvas);
assert.equal(atlas.space,'uv');assert.equal(atlas.layers.length,2);
assert.notDeepEqual(atlas.islands.get(a),atlas.islands.get(b));
for(const f of [a,b])for(const p of f.points){const uv=wallLightingUv(atlas,f,p);assert(uv.every(n=>n>0&&n<1),'Lighting UV stays inside its padded island');}
const mesh=shadowSceneTriangles([a],p=>[p.x,p.elevation,p.y]);assert.equal(mesh.length,18);assert(mesh.includes(35));
const lights=[{kind:'torch',intensity:99},{kind:'spell',intensity:3},{kind:'lantern',intensity:1},{kind:'spell',intensity:2}];
assert.deepEqual(selectShadowLights(lights).map(v=>v.index),[2,1],'Lantern plus strongest spell; fixed sconces retain cached CPU silhouettes');
console.log('PASS independent padded wall light UV islands, face color transport, shadow proxy triangles and bounded dynamic-light priority');
