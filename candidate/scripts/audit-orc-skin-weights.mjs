#!/usr/bin/env node
/**
 * Report suspicious cross-limb skin influences in the original Orc GLB.
 * Non-destructive by design: before reweighting vertices we need evidence
 * from the actual geometry, not an animation screenshot alone.
 *
 * Run: node scripts/audit-orc-skin-weights.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'assets/models/orcs/male-orc-fighter/male-orc-fighter.glb');
const raw=fs.readFileSync(file);
if(raw.toString('utf8',0,4)!=='glTF'||raw.readUInt32LE(4)!==2)
  throw Error('Expected Orc GLB v2');
const jsonLength=raw.readUInt32LE(12);
const gltf=JSON.parse(raw.toString('utf8',20,20+jsonLength));
const binOffset=20+jsonLength+8;
const binary=raw.subarray(binOffset);
const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const sizes={5121:1,5123:2,5125:4,5126:4};
function accessor(index){
  const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView];
  if(a.sparse)throw Error('Sparse accessors require explicit handling');
  const c=components[a.type],w=sizes[a.componentType],stride=v.byteStride||c*w;
  const offset=(v.byteOffset||0)+(a.byteOffset||0);
  const read={5121:(i)=>binary.readUInt8(i),5123:(i)=>binary.readUInt16LE(i),
    5125:(i)=>binary.readUInt32LE(i),5126:(i)=>binary.readFloatLE(i)}[a.componentType];
  return Array.from({length:a.count},(_,i)=>Array.from({length:c},(_,j)=>read(offset+i*stride+j*w)));
}
const skins=gltf.skins||[];
let vertices=0, armVertices=0, suspicious=0;
const examples=[],summary={};
const arm=/((?:Left|Right)(?:Shoulder|Arm|ForeArm|Hand|HandThumb|HandIndex|HandMiddle|HandRing|HandPinky))/i;
const leg=/((?:Left|Right)(?:UpLeg|Leg|Foot|Toe))/i;
for(const node of gltf.nodes){
  if(node.mesh===undefined||node.skin===undefined)continue;
  const skin=skins[node.skin],names=skin.joints.map(i=>gltf.nodes[i].name||'');
  for(const primitive of gltf.meshes[node.mesh].primitives){
    const attributes=primitive.attributes;
    if(['POSITION','JOINTS_0','WEIGHTS_0'].some(key=>attributes[key]===undefined))continue;
    const positions=accessor(attributes.POSITION),joints=accessor(attributes.JOINTS_0);
    const weights=accessor(attributes.WEIGHTS_0);
    const hipsIndex=names.findIndex(n=>/(^|:)Hips$/i.test(n));
    const hipNode=hipsIndex<0?null:gltf.nodes[skin.joints[hipsIndex]];
    // This is a diagnostic heuristic. Coordinates are mesh-local; report rather
    // than rewrite. A limb's skin weights alone cannot prove bad deformation.
    const counts={armInfluenced:0,legInfluenced:0,mixedArmLeg:0};
    for(let i=0;i<positions.length;i++){
      vertices++;
      let aw=0,lw=0;const active=[];
      for(let j=0;j<4;j++){
        const weight=weights[i][j]/(gltf.accessors[attributes.WEIGHTS_0].normalized?
          (gltf.accessors[attributes.WEIGHTS_0].componentType===5121?255:65535):1);
        const name=names[joints[i][j]]||'';
        if(weight<0.001)continue;
        if(arm.test(name))aw+=weight;
        if(leg.test(name))lw+=weight;
        if(weight>=0.05)active.push({bone:name,weight:+weight.toFixed(3)});
      }
      if(aw>=0.15){armVertices++;counts.armInfluenced++;}
      if(lw>=0.15)counts.legInfluenced++;
      if(aw>=0.15&&lw>=0.15){
        suspicious++;counts.mixedArmLeg++;
        if(examples.length<25)examples.push({vertex:i,position:positions[i].map(x=>+x.toFixed(3)),
          armWeight:+aw.toFixed(3),legWeight:+lw.toFixed(3),influences:active});
      }
    }
    const label=(gltf.meshes[node.mesh].name||'unnamed mesh');
    summary[label]=counts;
  }
}
console.log(JSON.stringify({source:file,vertices,armVertices,mixedArmLegVertices:suspicious,
  note:'Mixed arm/leg influence is a screening signal, not proof of invalid weights. Review coordinate-space, bind matrices and deformation before editing.',summary,examples},null,2));
