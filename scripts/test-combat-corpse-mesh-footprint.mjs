import assert from 'node:assert/strict';import {footprintFromTriangles} from '../js/corpse-mesh-footprint.mjs';
const rect=(x,z,w,h)=>[[{x,z},{x:x+w,z},{x,z:z+h}],[{x:x+w,z},{x:x+w,z:z+h},{x,z:z+h}]];
const triangles=[...rect(-.4,-.4,.8,.8),...rect(-1.8,-1,.8,.5),...rect(-1.8,.5,.8,.5)];
const cells=footprintFromTriangles(triangles),has=(x,y)=>cells.some(c=>c.x===x&&c.y===y);
assert.ok(has(0,0),'torso');assert.ok(cells.some(c=>c.y<0),'one leg');assert.ok(cells.some(c=>c.y>0),'other leg');assert.ok(!has(2,0),'empty space beyond head');assert.deepEqual(footprintFromTriangles([...triangles,...triangles]),cells,'overlapping triangles cannot inflate occupancy');console.log('Projected corpse: torso, both legs, empty head-adjacent space and union sampling passed');

const clearance=footprintFromTriangles([...rect(-.4,-.4,.8,.8),...rect(1,-.1,.1,.2)],{centerRadius:.38,minArea:.08,minCoreArea:.03});assert.ok(clearance.some(c=>c.x===0&&c.y===0));assert.ok(!clearance.some(c=>c.x===1&&c.y===0),'edge sliver must not close an open cell');
