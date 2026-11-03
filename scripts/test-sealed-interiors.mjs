import assert from 'node:assert/strict';
import {blankEdgeMap} from '../js/exploration-authoring.mjs';
import {paintEdge,upgradeEdgeMap} from '../js/exploration-edges.mjs';
import {paintQuarter} from '../js/quarter-walls.mjs';
import {accessibleFloor} from '../js/exploration-accessibility.mjs';
import {terrainForEncounter} from '../js/exploration-encounters.mjs';
import {wallFrameGeometry,CELL,HEIGHT} from '../js/exploration-materials.mjs';
const map=blankEdgeMap('sealed','Sealed interiors');map.start={x:1,z:1,facing:0};map.entrances=[];map.exits=[];
for(let x=4;x<7;x++){paintEdge(map,{axis:'h',x,z:4},'wall');paintEdge(map,{axis:'h',x,z:7},'wall');}
for(let z=4;z<7;z++){paintEdge(map,{axis:'v',x:4,z},'wall');paintEdge(map,{axis:'v',x:7,z},'wall');}
let field=accessibleFloor(map);assert(!field.at({x:5,z:5}));assert(field.at({x:3,z:5}));assert.equal(accessibleFloor(map),field,'Reuse static connectivity');
paintEdge(map,{axis:'h',x:5,z:7},'window',{width:.6});assert(!accessibleFloor(map).at({x:5,z:5}),'Windows are not entrances');
paintEdge(map,{axis:'h',x:5,z:7},'door');assert(accessibleFloor(map).at({x:5,z:5}),'A closed but openable door keeps the room renderable');
paintEdge(map,{axis:'h',x:5,z:7},'wall');map.entrances=[{x:5,z:5}];assert(accessibleFloor(map).at({x:5,z:5}),'Authored entrances permit access');map.entrances=[];
for(const [x,z,corner] of [[10,5,'nw'],[11,5,'ne'],[11,6,'se'],[10,6,'sw']])paintQuarter(map,x,z,corner);
field=accessibleFloor(map);assert(!field.at({x:10.5,z:5.5}),'Four curved quarters seal a real circular interior');assert(field.at({x:9.55,z:4.55}),'Outside corner floor stays visible');
const t=terrainForEncounter(map,map.start,new Set());assert(!t.isRenderablePoint(t.project(10.5,5.5)));assert(!t.spaces.some(s=>s.id==='floor-10-5'));assert(t.walls.some(w=>w.curve),'Exterior walls remain');assert(t.spaces.some(s=>s.id.startsWith('outside-10-5')));
assert(accessibleFloor(map,{x:10,z:5}).at({x:10.5,z:5.5}),'A party already inside retains its room');
const old=structuredClone(map);old.doorWidthVersion=3;old.edges=old.edges.filter(e=>e.axis!=='h'||e.x!==5||e.z!==7);old.edges.push({axis:'h',x:5,z:7,id:'test-door',kind:'door',width:.375,material:'stone'});const wider=upgradeEdgeMap(old);assert.equal(wider.doors[0].width,.5625);assert.equal(upgradeEdgeMap(wider).doors[0].width,.5625);
for(const [w,h,x,y] of [[.65,HEIGHT,-1.17,HEIGHT/2],[CELL,.4,0,HEIGHT-.2]]){const g=wallFrameGeometry(w,h,.36,x,y),p=g.getAttribute('position'),uv=g.getAttribute('uv');for(let i=16;i<24;i++){assert(Math.abs(uv.getX(i)-((p.getX(i)+x)/CELL+.5))<1e-6);assert(Math.abs(uv.getY(i)-(p.getY(i)+y)/HEIGHT)<1e-6);}g.dispose();}
console.log('PASS sealed square/curved interiors, exterior floor preservation, closed doors/windows/entrances, cache reuse, visible floor omission, width migration and physical frame UVs');
