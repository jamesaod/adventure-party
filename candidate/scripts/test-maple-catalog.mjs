import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAPLE_CATALOG,selectedMapleId,mapleCatalogEntry} from '../js/maple-catalog.mjs';
assert.equal(selectedMapleId('?mapleVariant=unknown'),'original');assert.equal(selectedMapleId('?mapleVariant=tall'),'tall');assert.equal(mapleCatalogEntry('missing'),MAPLE_CATALOG.original);
const fingerprints=[];
for(const [id,entry] of Object.entries(MAPLE_CATALOG)){
 const directory=new URL('../assets/terrain/'+entry.directory+'/',import.meta.url),wood=[];
 for(const season of ['green','fall','winter']){
  const g=JSON.parse(fs.readFileSync(new URL('maple-'+season+(season==='winter'?'':'-balanced')+'.gltf',directory))),bin=fs.readFileSync(new URL(g.buffers[0].uri,directory));let triangles=0;
  for(const mesh of g.meshes)for(const p of mesh.primitives){const a=g.accessors[p.attributes.POSITION],v=g.bufferViews[a.bufferView];triangles+=a.count/3;
   for(let i=0;i<a.count;i++)for(let j=0;j<3;j++)assert(Number.isFinite(bin.readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||12)+j*4)));
   if(g.materials[p.material].name.includes('Bark'))wood.push(bin.subarray(v.byteOffset,v.byteOffset+v.byteLength));
  }
  assert.equal(triangles,season==='winter'?entry.winterTriangles:entry.triangles,id+' '+season);
  for(const f of [...g.buffers,...g.images])assert(fs.existsSync(new URL(f.uri,directory)));
 }
 assert(wood[0].equals(wood[1])&&wood[0].equals(wood[2]),id+' seasonal wood matches');fingerprints.push(wood[0]);
 for(const model of ['stump','fallen','detached-limbs','particle-leaf']){const g=JSON.parse(fs.readFileSync(new URL('maple-'+model+'.gltf',directory)));for(const f of [...g.buffers,...g.images])assert(fs.existsSync(new URL(f.uri,directory)));if(model==='detached-limbs')assert.equal(g.nodes.length,8);if(model==='particle-leaf')assert.equal(g.extras.nominalBladeMetres,.10);}
}
for(let i=0;i<fingerprints.length;i++)for(let j=i+1;j<fingerprints.length;j++)assert(!fingerprints[i].equals(fingerprints[j]),'distinct authored structure');
console.log('PASS three distinct catalog trees, all seasonal geometry/dependencies/counts, matching wood, eight limbs and real-scale leaf cards');
