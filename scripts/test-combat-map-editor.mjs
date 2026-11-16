import assert from 'node:assert/strict';
import {createMap,validateMap,parseMap,exportMap,resizeMap,cornerWeights,corner,center,atPoint,hexLine,brush,axialCell} from '../js/combat-map-document.mjs';
const map=createMap(5,4);map.terrain.cells[1][2]='grass';map.terrain.cells[1][3]='dirt';map.terrain.cells[2][3]='stone';
assert.deepEqual(cornerWeights(map,2,1,0),{grass:1/3,dirt:1/3,stone:1/3});
for(let r=0;r<4;r++)for(let q=0;q<5;q++)map.terrain.cells[r][q]=['grass','dirt','stone'][(q+2*r)%3];
const vertices=new Map();for(let r=0;r<4;r++)for(let q=0;q<5;q++){const p=center(q,r);assert.deepEqual(atPoint(p.x,p.y),{q,r});for(let i=0;i<6;i++){
 const c=corner(i),key=[p.x+c.x,p.y+c.y].map(v=>v.toFixed(5)).join(','),weights=cornerWeights(map,q,r,i);assert(Math.abs(Object.values(weights).reduce((a,b)=>a+b,0)-1)<1e-10);
 if(vertices.has(key))assert.deepEqual(Object.entries(weights).sort(),Object.entries(vertices.get(key)).sort(),'All owners of a shared vertex must use identical blend weights');else vertices.set(key,weights);
}}
map.objects.push({id:'tree-one',type:'tree',assetId:'fir-03',q:4,r:3});map.name='Three materials';assert.deepEqual(parseMap(exportMap(map)),map);
const bigger=resizeMap(map,8,7);assert.equal(bigger.terrain.cells[6][7],'grass');assert.equal(bigger.objects.length,1);assert.equal(bigger.terrain.cells[1][3],map.terrain.cells[1][3]);assert.equal(resizeMap(map,2,2).objects.length,0);assert.equal(map.objects.length,1,'Resize does not mutate its source');
for(const [w,h]of [[0,1],[1,129],[1.1,2],[NaN,2]])assert.throws(()=>createMap(w,h));
for(const mutate of [m=>m.terrain.cells.pop(),m=>m.terrain.cells[0][0]='unknown',m=>m.objects.push({...m.objects[0]}),m=>m.objects[0].q=100,m=>m.version=2,m=>m.objects[0].assetId='missing',m=>m.objects[0].r=.5]){const broken=structuredClone(map);mutate(broken);assert.throws(()=>validateMap(broken));}
assert.equal(brush(map,2,2,1).length,7);assert.equal(brush(map,0,0,2).length,7);
const line=hexLine({q:0,r:0},{q:12,r:7});assert.deepEqual(line[0],{q:0,r:0});assert.deepEqual(line.at(-1),{q:12,r:7});for(let i=1;i<line.length;i++){const a=axialCell(line[i].q,line[i].r),b=axialCell(line[i-1].q,line[i-1].r),dq=a.q-b.q,dr=a.r-b.r;assert.equal(Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr)),1);}
console.log('PASS three-material junctions, shared-vertex continuity, hex picking/strokes, brush bounds, resize preservation/crop, portable round-trip and invalid map rejection');
