import assert from 'node:assert/strict';
import {projection,project,unproject} from '../js/combat-map-view.mjs';
import {center,atPoint,createMap,exportMap,parseMap} from '../js/combat-map-document.mjs';
import {TEXTURES} from '../js/combat-map-palette.mjs';
for(const iso of [false,true])for(const q of [0,5,127])for(const r of [0,7,127]){const p=center(q,r),v=project(p,projection(iso)),back=unproject(v,projection(iso));assert(Math.abs(back.x-p.x)<1e-8);assert(Math.abs(back.y-p.y)<1e-8);const cell=atPoint(back.x,back.y);assert(cell.q===q&&cell.r===r);if(iso){const squash=31.5/(64*Math.sqrt(3)/2),angle=5*Math.PI/3;assert(Math.abs(v.x-(p.x*Math.cos(angle)-p.y*Math.sin(angle)))<1e-8);assert(Math.abs(v.y-(p.x*Math.sin(angle)+p.y*Math.cos(angle))*squash)<1e-8);}}
const map=createMap();TEXTURES.forEach((t,i)=>map.terrain.cells[0][i]=t.id);assert.deepEqual(parseMap(exportMap(map)),map);assert.equal(TEXTURES.length,10);console.log('PASS combat projection parity, inverse hex selection and ten-texture export round trip');

