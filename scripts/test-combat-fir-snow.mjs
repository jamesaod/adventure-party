import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/three.module.min.js';
import {branchSnowGeometry} from '../js/combat-fir-snow.mjs?v=natural-ac1';
const source=new T.BufferGeometry();
// One horizontal support and one vertical card; UVs must survive refinement.
source.setAttribute('position',new T.Float32BufferAttribute([0,0,0,2,0,0,0,0,2, 0,0,0,0,2,0,2,0,0],3));
source.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1, 0,0,0,1,1,0],2));
const before=Array.from(source.attributes.position.array),snow=branchSnowGeometry(source);
assert.equal(snow.attributes.position.count,12,'Only the horizontal triangle produces four snow triangles');
for(let i=0;i<12;i++){
 assert.equal(snow.attributes.position.getY(i),0,'Base snow geometry follows branch surface');
 assert.equal(snow.attributes.normal.getY(i),1,'Snow faces upward regardless of card winding');
 assert(Math.abs(snow.attributes.uv.getX(i)-snow.attributes.position.getX(i)/2)<1e-6);
 assert(Math.abs(snow.attributes.uv.getY(i)-snow.attributes.position.getZ(i)/2)<1e-6);
}
assert.deepEqual(Array.from(source.attributes.position.array),before,'The tree geometry remains unchanged');
source.dispose();snow.dispose();
console.log('PASS branch snow support filtering, bounded subdivision, UV alignment and fixed foliage geometry');
