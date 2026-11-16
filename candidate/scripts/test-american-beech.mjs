import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ACTIVE_BROADLEAF,BROADLEAF_FAMILIES,isBroadleaf,broadleafForVariant} from '../js/broadleaf-family.mjs';
import {treeExclusionProfile} from '../js/tree-environment-profiles.mjs';
const directory=new URL('../assets/terrain/american-beech/',import.meta.url);
const load=id=>JSON.parse(fs.readFileSync(new URL(id+'.gltf',directory)));
const bark=[];
for(const season of ['green','fall','winter']){
 const g=load(season==='winter'?'beech-winter':'beech-'+season+'-balanced'),bin=fs.readFileSync(new URL(g.buffers[0].uri,directory));
 let triangles=0;
 for(const mesh of g.meshes)for(const p of mesh.primitives){const a=g.accessors[p.attributes.POSITION],v=g.bufferViews[a.bufferView];triangles+=a.count/3;for(let i=0;i<a.count;i++)for(let j=0;j<3;j++)assert(Number.isFinite(bin.readFloatLE(v.byteOffset+(a.byteOffset||0)+i*v.byteStride+j*4)));
  if(g.materials[p.material].name.includes('Bark'))bark.push(bin.subarray(v.byteOffset,v.byteOffset+v.byteLength));
 }
 assert.equal(triangles,season==='winter'?12188:22982);
 for(const file of [...g.images,...g.buffers])assert(fs.existsSync(new URL(file.uri,directory)));
}
assert(bark[0].equals(bark[1])&&bark[0].equals(bark[2]),'All seasons preserve identical wood, UVs and normals');
assert.equal(load('beech-detached-limbs').nodes.length,8);
const leaf=load('beech-particle-leaf');assert.equal(leaf.images[0].uri,'Beech_Leaf_Fall.png');assert.equal(leaf.extras.nominalBladeMetres,.10);
assert.equal(broadleafForVariant(5).species,'white-oak');assert.equal(broadleafForVariant(29).species,'american-beech');assert.equal(broadleafForVariant(31).species,'american-beech');assert.equal(BROADLEAF_FAMILIES['white-oak'].models.length,6);
assert(isBroadleaf({species:'american-beech'}));assert.deepEqual(treeExclusionProfile({species:'american-beech'}),{radius:2,feather:.65});
console.log('PASS matching seasonal beech wood, finite exported geometry, asset dependencies, eight limbs, leaf scale, preserved oak and exclusion profile');

const ground=await import('../js/combat-tree-litter.mjs');
assert.equal(ground.BEECH_LEAF_POSITIONS.length,6);
assert(Math.abs((ground.BEECH_LEAF_POSITIONS[1][0]-ground.BEECH_LEAF_POSITIONS[0][0])/.13-911/1726)<1e-9);
const face={grass:true,snowEligible:1,grassUnit:40,grassSquash:1,points:[{x:-200,y:-200},{x:200,y:-200},{x:200,y:200},{x:-200,y:200}]};
const zone={species:'american-beech',x:0,y:0,width:40,row:40,radius:2};
const leaves=ground.leafScatter(face,[zone],{},(x,y,s)=>((Math.sin(x*13+y*31+s)*10000)%1+1)%1,()=>true);
assert(leaves.length>0&&leaves.every(p=>p.type===6));
assert.equal(ground.leafScatter(face,[zone],{groundWater:()=>1},()=>.5,()=>true).length,0);
assert(BROADLEAF_FAMILIES['sugar-maple']&&BROADLEAF_FAMILIES['sugar-maple-broad']&&BROADLEAF_FAMILIES['sugar-maple-tall']);
console.log('PASS Beech portrait leaf proportions, separate litter type, water exclusion and preserved maple catalog');
