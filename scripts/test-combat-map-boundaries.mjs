import assert from 'node:assert/strict';
import {createMap,resizeMap,exportMap,parseMap} from '../js/combat-map-document.mjs';
import {boundaryAt,paintBoundary,automaticShapes} from '../js/combat-map-boundaries.mjs';
import {projection,project,unproject} from '../js/combat-map-view.mjs';
const map=createMap(5,5);map.terrain.cells[1][1]='dirt';paintBoundary(map,1,1,'hard');assert.equal(boundaryAt(map,2,1),'soft');assert.equal(automaticShapes(map).length,1);map.terrain.cells[1][2]='dirt';paintBoundary(map,2,1,'hard');assert.equal(automaticShapes(map).length,3,'Matching adjacent cells add a corner bridge');map.terrain.cells[1][2]='stone';assert.equal(automaticShapes(map).length,2,'Different textures cannot connect');paintBoundary(map,2,1,'soft');assert.equal(automaticShapes(map).length,1);map.terrain.textureScales={dirt:.25};assert.deepEqual(parseMap(exportMap(map)),map);assert.equal(resizeMap(map,6,6).terrain.boundaries[5][5],'soft');assert.throws(()=>exportMap({...map,terrain:{...map.terrain,textureScales:{dirt:0}}}));
for(const iso of [false,true])for(let r=0;r<6;r++){const p={x:123,y:456},m=projection(iso,r),back=unproject(project(p,m),m);assert(Math.abs(p.x-back.x)<1e-8&&Math.abs(p.y-back.y)<1e-8);}
console.log('PASS local hard membership, same-texture bridges, soft repaint, scales/export/resize validation and all rotated inverse views');
