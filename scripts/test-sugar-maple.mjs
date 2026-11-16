import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ACTIVE_BROADLEAF,BROADLEAF_FAMILIES,isBroadleaf,broadleafForVariant} from '../js/broadleaf-family.mjs';
import {treeExclusionProfile} from '../js/tree-environment-profiles.mjs';
const directory=new URL('../assets/terrain/sugar-maple/',import.meta.url);
const load=id=>JSON.parse(fs.readFileSync(new URL(id+'.gltf',directory)));
const bark=[];
for(const season of ['green','fall','winter']){
 const g=load(season==='winter'?'maple-winter':'maple-'+season+'-balanced'),bin=fs.readFileSync(new URL(g.buffers[0].uri,directory));
 let triangles=0;
 for(const mesh of g.meshes)for(const p of mesh.primitives){const a=g.accessors[p.attributes.POSITION],v=g.bufferViews[a.bufferView];triangles+=a.count/3;for(let i=0;i<a.count;i++)for(let j=0;j<3;j++)assert(Number.isFinite(bin.readFloatLE(v.byteOffset+(a.byteOffset||0)+i*v.byteStride+j*4)));
  if(g.materials[p.material].name.includes('Bark'))bark.push(bin.subarray(v.byteOffset,v.byteOffset+v.byteLength));
 }
 assert.equal(triangles,season==='winter'?13162:25944);
 for(const file of [...g.images,...g.buffers])assert(fs.existsSync(new URL(file.uri,directory)));
}
assert(bark[0].equals(bark[1])&&bark[0].equals(bark[2]),'All seasons preserve identical wood, UVs and normals');
assert.equal(load('maple-detached-limbs').nodes.length,8);
const leaf=load('maple-particle-leaf');assert.equal(leaf.images[0].uri,'SugarMaple_Leaf_Fall.png');assert.equal(leaf.extras.nominalBladeMetres,.10);
assert.equal(broadleafForVariant(5).species,'white-oak');assert.equal(broadleafForVariant(11).species,'sugar-maple');assert.equal(broadleafForVariant(13).species,'sugar-maple');assert.equal(BROADLEAF_FAMILIES['white-oak'].models.length,6);
assert(isBroadleaf({species:'sugar-maple'}));assert.deepEqual(treeExclusionProfile({species:'sugar-maple'}),{radius:2,feather:.65});
console.log('PASS matching seasonal maple wood, finite exported geometry, asset dependencies, eight limbs, leaf scale, preserved oak and exclusion profile');
