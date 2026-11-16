import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ACTIVE_BROADLEAF,BROADLEAF_FAMILIES,isBroadleaf,broadleafForVariant} from '../js/broadleaf-family.mjs';
import {treeExclusionProfile} from '../js/tree-environment-profiles.mjs';
const directory=new URL('../assets/terrain/sweet-birch/',import.meta.url);
const load=id=>JSON.parse(fs.readFileSync(new URL(id+'.gltf',directory)));
const bark=[];
for(const season of ['green','fall','winter']){
 const g=load(season==='winter'?'birch-winter':'birch-'+season+'-balanced'),bin=fs.readFileSync(new URL(g.buffers[0].uri,directory));
 let triangles=0;
 for(const mesh of g.meshes)for(const p of mesh.primitives){const a=g.accessors[p.attributes.POSITION],v=g.bufferViews[a.bufferView];triangles+=a.count/3;for(let i=0;i<a.count;i++)for(let j=0;j<3;j++)assert(Number.isFinite(bin.readFloatLE(v.byteOffset+(a.byteOffset||0)+i*v.byteStride+j*4)));
  if(g.materials[p.material].name.includes('Bark'))bark.push(bin.subarray(v.byteOffset,v.byteOffset+v.byteLength));
 }
 assert.equal(triangles,season==='winter'?7958:12918);
 for(const file of [...g.images,...g.buffers])assert(fs.existsSync(new URL(file.uri,directory)));
}
assert(bark[0].equals(bark[1])&&bark[0].equals(bark[2]),'All seasons preserve identical wood, UVs and normals');
assert.equal(load('birch-detached-limbs').nodes.length,8);
const leaf=load('birch-particle-leaf');assert.equal(leaf.images[0].uri,'Birch_Leaf_Fall.png');assert.equal(leaf.extras.nominalBladeMetres,.10);
assert.equal(broadleafForVariant(5).species,'white-oak');assert.equal(broadleafForVariant(35).species,'sweet-birch');assert.equal(broadleafForVariant(37).species,'sweet-birch');assert.equal(BROADLEAF_FAMILIES['white-oak'].models.length,6);
assert(isBroadleaf({species:'sweet-birch'}));assert.deepEqual(treeExclusionProfile({species:'sweet-birch'}),{radius:2,feather:.65});
console.log('PASS matching seasonal birch wood, finite exported geometry, asset dependencies, eight limbs, leaf scale, preserved oak and exclusion profile');

const ground=await import('../js/combat-tree-litter.mjs');
assert.equal(ground.BIRCH_LEAF_POSITIONS.length,6);
assert(Math.abs((ground.BIRCH_LEAF_POSITIONS[1][0]-ground.BIRCH_LEAF_POSITIONS[0][0])/.13-1086/1448)<1e-9);
const face={grass:true,snowEligible:1,grassUnit:40,grassSquash:1,points:[{x:-200,y:-200},{x:200,y:-200},{x:200,y:200},{x:-200,y:200}]};
const zone={species:'sweet-birch',x:0,y:0,width:40,row:40,radius:2};
const leaves=ground.leafScatter(face,[zone],{},(x,y,s)=>((Math.sin(x*13+y*31+s)*10000)%1+1)%1,()=>true);
assert(leaves.length>0&&leaves.every(p=>p.type===7));
assert.equal(ground.leafScatter(face,[zone],{groundWater:()=>1},()=>.5,()=>true).length,0);
assert(BROADLEAF_FAMILIES['sugar-maple']&&BROADLEAF_FAMILIES['sugar-maple-broad']&&BROADLEAF_FAMILIES['sugar-maple-tall']);
console.log('PASS Birch portrait leaf proportions, separate litter type, water exclusion and preserved maple catalog');
