import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/three.module.min.js';
import {tearTrunkGeometry} from '../js/tree-torn-break.mjs';
import {INDIVIDUAL_TREE_CLUB_ASSETS} from '../js/individual-tree-clubs.mjs';
const source='C:/Users/james/OneDrive/Documents/ChatGPT/_Adventure Party Development_/outputs/tree-as-club';
const backup='.local/tree-club-flat-cap-backup';fs.mkdirSync(backup,{recursive:true});
const records=structuredClone(INDIVIDUAL_TREE_CLUB_ASSETS);
for(const rec of records){
 const file=rec.asset,save=path.join(backup,path.basename(file));if(!fs.existsSync(save))fs.copyFileSync(file,save);
 // Always rebuild from the saved flat source, never deform an already repaired asset.
 const b=fs.readFileSync(save),jl=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+jl)),bin=b.subarray(28+jl);let chunks=[bin],length=bin.length;
 const rootScale=j.nodes.find(n=>n.name==='StandingTreePhysicalScale')?.scale?.[0]||1;
 const vertices=fs.readFileSync(path.join(source,rec.source.replace('.spm','.obj')),'utf8').split(/\r?\n/).filter(l=>l.startsWith('v ')).map(l=>l.trim().split(/\s+/).slice(1,4).map(Number));
 const bottom=rec.cutBottomSourceMetres,top=rec.cutTopSourceMetres,gripZ=top-(top-bottom)*.1;
 let band=vertices.filter(v=>Math.abs(v[2]-gripZ)<(top-bottom)*.06);if(!band.length)band=vertices.slice().sort((a,b)=>Math.abs(a[2]-gripZ)-Math.abs(b[2]-gripZ)).slice(0,12);
 const grip=[0,1].map(k=>(Math.min(...band.map(v=>v[k]))+Math.max(...band.map(v=>v[k])))/2),ground=bottom-1,scale=rec.sourceToCombatScale,K=43.38933076913966;
 function read(i){const a=j.accessors[i],v=j.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],bytes={5126:4,5125:4,5123:2,5121:1}[a.componentType],out=[];for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const at=(v.byteOffset||0)+(a.byteOffset||0)+k*(v.byteStride||n*bytes)+c*bytes;out.push(a.componentType===5126?bin.readFloatLE(at):a.componentType===5125?bin.readUInt32LE(at):a.componentType===5123?bin.readUInt16LE(at):bin.readUInt8(at));}return {array:out,size:n};}
 function append(attr){const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}const data=Buffer.from(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength),view=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length});chunks.push(data);length+=data.length;const a={bufferView:view,componentType:5126,count:attr.count,type:{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[attr.itemSize]};const min=Array(attr.itemSize).fill(Infinity),max=Array(attr.itemSize).fill(-Infinity);for(let i=0;i<attr.count;i++)for(let k=0;k<attr.itemSize;k++){const v=attr.array[i*attr.itemSize+k];min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}a.min=min;a.max=max;j.accessors.push(a);return j.accessors.length-1;}
 let triangles=0,minY=Infinity,maxY=-Infinity;
 for(const mesh of j.meshes)for(const primitive of mesh.primitives){let g=new T.BufferGeometry();const names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv'};for(const [semantic,i]of Object.entries(primitive.attributes)){if(!names[semantic])continue;const a=read(i);g.setAttribute(names[semantic],new T.Float32BufferAttribute(a.array,a.size));}if(primitive.indices!=null){g.setIndex(read(primitive.indices).array);g=g.toNonIndexed();}
 const pos=g.attributes.position,norm=g.attributes.normal;
 for(let i=0;i<pos.count;i++){pos.setXYZ(i,(pos.getX(i)*rootScale/scale+grip[0])*K,(gripZ-pos.getY(i)*rootScale/scale-ground)*K,(pos.getZ(i)*rootScale/scale+grip[1])*K);if(norm)norm.setY(i,-norm.getY(i));}
 g=tearTrunkGeometry(g,K,rec.tileIndex);
 const cap=/end grain/i.test(j.materials[primitive.material]?.name||'');
 if(cap){const colors=[];for(let i=0;i<g.attributes.position.count;i++){const x=g.attributes.position.getX(i),z=g.attributes.position.getZ(i),v=.82+.18*Math.sin(Math.hypot(x,z)*1.8+Math.sin(x*.3)*.6);colors.push(v,v,v);}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));const m=j.materials[primitive.material];m.pbrMetallicRoughness={baseColorFactor:[...new T.Color(0x98734d).toArray(),1],metallicFactor:0,roughnessFactor:1};m.doubleSided=true;}
 for(let i=0;i<g.attributes.position.count;i++){const p=g.attributes.position,n=g.attributes.normal;p.setXYZ(i,(p.getX(i)/K-grip[0])*scale/rootScale,(gripZ-ground-p.getY(i)/K)*scale/rootScale,(p.getZ(i)/K-grip[1])*scale/rootScale);if(n)n.setY(i,-n.getY(i));minY=Math.min(minY,p.getY(i)*rootScale);maxY=Math.max(maxY,p.getY(i)*rootScale);}
 primitive.attributes={};for(const [name,attr]of Object.entries(g.attributes))primitive.attributes[({position:'POSITION',normal:'NORMAL',uv:'TEXCOORD_0',color:'COLOR_0'})[name]]=append(attr);delete primitive.indices;triangles+=g.attributes.position.count/3;
 }
 j.buffers[0].byteLength=length;let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);const out=Buffer.concat([header,json,bh,binary]);fs.writeFileSync(file,out);rec.sha256=createHash('sha256').update(out).digest('hex');rec.triangles=triangles;rec.fracturedBoundsMetres=[minY,maxY];rec.breakStyle='stump-matching-torn';console.log(rec.id,triangles,rec.fracturedBoundsMetres);
}
fs.writeFileSync('js/individual-tree-clubs.mjs','// Individually authored SpeedTree trunks; dimensions baked in combat metres.\nexport const INDIVIDUAL_TREE_CLUB_ASSETS='+JSON.stringify(records,null,2)+';\n');fs.writeFileSync('tools/tree-production/individual-clubs/manifest.json',JSON.stringify(records,null,2)+'\n');
