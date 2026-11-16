// Offline authoring only. No simplification runs when entering combat.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {SimplifyModifier} from '../assets/vendor/three/addons/modifiers/SimplifyModifier.js';
import {mergeVertices} from '../assets/vendor/three/addons/utils/BufferGeometryUtils.js';
const files=process.argv.slice(2);
if(!files.length)throw Error('Pass source GLB paths. Outputs <model>.shadow.json alongside each source.');
for(const file of files){
 const start=performance.now(),bytes=fs.readFileSync(file);let json,bin;
 for(let offset=12;offset<bytes.length;){const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4),chunk=bytes.subarray(offset+8,offset+8+length);if(type===0x4e4f534a)json=JSON.parse(chunk.toString());if(type===0x004e4942)bin=chunk;offset+=8+length;}
 const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},types={5126:['getFloat32',4],5123:['getUint16',2],5121:['getUint8',1],5125:['getUint32',4]};
 function read(index){const a=json.accessors[index],v=json.bufferViews[a.bufferView];if(a.sparse)throw Error('Sparse accessors need expansion before simplification');const [method,bytes]=types[a.componentType],size=sizes[a.type],view=new DataView(bin.buffer,bin.byteOffset,bin.byteLength),values=[];for(let i=0;i<a.count;i++)for(let j=0;j<size;j++){let n=view[method]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||size*bytes)+j*bytes,true);if(a.normalized)n/=a.componentType===5121?255:65535;values.push(n);}return values;}
 const output={version:1,sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),meshes:{}};
 let before=0,after=0;
 for(let mi=0;mi<json.meshes.length;mi++)for(let pi=0;pi<json.meshes[mi].primitives.length;pi++){
  const p=json.meshes[mi].primitives[pi];if(p.targets||p.mode&&p.mode!==4)continue;
  const positions=read(p.attributes.POSITION),indices=p.indices===undefined?positions.filter((_,i)=>i%3===0).map((_,i)=>i):read(p.indices),original=new THREE.BufferGeometry();original.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));original.setIndex(indices);
  const merged=mergeVertices(original),triangles=indices.length/3;before+=triangles;
  // Budget per primitive, retaining equipment and material boundaries.
  const keep=Math.max(12,Math.min(merged.attributes.position.count,252)),reduced=triangles>500?new SimplifyModifier().modify(merged,Math.max(0,merged.attributes.position.count-keep)):original;
  const pos=Array.from(reduced.attributes.position.array),idx=reduced.index?Array.from(reduced.index.array):pos.filter((_,i)=>i%3===0).map((_,i)=>i),record={position:pos,index:idx};
  if(p.attributes.JOINTS_0!==undefined){const joints=read(p.attributes.JOINTS_0),weights=read(p.attributes.WEIGHTS_0),byPosition=new Map();for(let i=0;i<positions.length;i+=3)byPosition.set(positions.slice(i,i+3).join(','),i/3);record.skinIndex=[];record.skinWeight=[];
   for(let i=0;i<pos.length;i+=3){let nearest=byPosition.get(pos.slice(i,i+3).join(','));if(nearest===undefined){let distance=Infinity;for(let j=0;j<positions.length;j+=3){const d=(positions[j]-pos[i])**2+(positions[j+1]-pos[i+1])**2+(positions[j+2]-pos[i+2])**2;if(d<distance){distance=d;nearest=j/3;}}}record.skinIndex.push(...joints.slice(nearest*4,nearest*4+4));record.skinWeight.push(...weights.slice(nearest*4,nearest*4+4));}
  }
  output.meshes[mi+':'+pi]=record;after+=idx.length/3;reduced.dispose();merged.dispose();original.dispose();
 }
 output.buildMs=performance.now()-start;fs.writeFileSync(file.replace(/\.glb$/i,'.shadow.json'),JSON.stringify(output));console.log(path.basename(file),{before,after,buildMs:Math.round(output.buildMs)});
}
