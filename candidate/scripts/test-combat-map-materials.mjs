import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createMap,center} from '../js/combat-map-document.mjs';
import {paintBoundary,automaticShapes} from '../js/combat-map-boundaries.mjs';
import {surfaceAt,refreshAutomaticSurfaces} from '../js/combat-map-detail-rules.mjs';
import {TEXTURES} from '../js/combat-map-palette.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../assets/textures/polyhaven/effects/manifest.json',import.meta.url)));
assert.equal(Object.keys(manifest).length,7);for(const maps of Object.values(manifest)){for(const channel of ['nor_gl','arm','Displacement'])assert(maps[channel],channel);for(const entry of Object.values(maps)){const bytes=fs.readFileSync(new URL('../'+entry.src,import.meta.url));assert.equal(crypto.createHash('md5').update(bytes).digest('hex'),entry.md5);}}
for(const texture of TEXTURES){const map=createMap(5,5),other=texture.id==='dirt'?'stone':'dirt';for(const [q,r]of [[1,1],[2,1]]){map.terrain.cells[r][q]=texture.id;paintBoundary(map,q,r,'hard');}map.terrain.cells[0][2]=other;paintBoundary(map,2,0,'hard');refreshAutomaticSurfaces(map);const a=center(1,1),b=center(2,1),sample={x:(a.x+b.x)/2,y:a.y-27};assert.equal(surfaceAt(map,sample.x,sample.y),texture.id,'Bridge fills the partial receiving hex for '+texture.id);const shapes=automaticShapes(map),firstBridge=shapes.findIndex(s=>s.bridge);assert(shapes.slice(firstBridge).every(s=>s.bridge),'All cell interiors precede infill');}
console.log('PASS all seven material-channel inventories and checksums; partial-hex hard infill across every palette texture');
