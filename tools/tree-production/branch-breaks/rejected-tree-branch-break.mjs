import * as THREE from '../assets/vendor/three/three.module.min.js';
import {splitTrunk} from './oak-trunk-cut.mjs';
import {SPEEDTREE_BRANCH_CAP as native} from './speedtree-branch-cap.mjs';

// Fit the saved SpeedTree cap to each original limb once, during asset preparation.
// The animation continues to move eight rigid pieces; no per-frame vertex edits.
export function brokenBranch(source){
 const geometry=source.geometry.index?source.geometry.toNonIndexed():source.geometry;
 const p=geometry.attributes.position,unique=new Map(),parent=[],ids=[];
 function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(3)).join(',');if(!unique.has(key)){unique.set(key,parent.length);parent.push(parent.length);}ids.push(unique.get(key));}
 for(let i=0;i<ids.length;i+=3)for(let j=1;j<3;j++)parent[root(ids[i+j])]=root(ids[i]);
 const groups=new Map();for(let i=0;i<ids.length;i++){const r=root(ids[i]);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}
 const main=[...groups.values()].sort((a,b)=>b.length-a.length)[0];
 let lo=Infinity,hi=-Infinity;for(const i of main){lo=Math.min(lo,p.getY(i));hi=Math.max(hi,p.getY(i));}
 const cut=lo+(hi-lo)*.045,copy=source.clone();copy.geometry=geometry;
 const {upper,lower,cap}=splitTrunk(copy,cut);lower.geometry.dispose();
 const cp=cap.geometry.attributes.position;
 if(cp.count<9){upper.geometry.dispose();cap.geometry.dispose();cap.material.dispose();return source.clone();}
 const center=new THREE.Vector3(cp.getX(0),cut,cp.getZ(0));
 const rim=[...new Map(Array.from({length:cp.count},(_,i)=>[cp.getX(i),cp.getZ(i)]).filter(v=>Math.hypot(v[0]-center.x,v[1]-center.z)>1e-4).map(v=>[v.map(n=>n.toFixed(4)).join(','),v])).values()];
 rim.sort((a,b)=>Math.atan2(a[1]-center.z,a[0]-center.x)-Math.atan2(b[1]-center.z,b[0]-center.x));
 const radii=rim.map(v=>({a:Math.atan2(v[1]-center.z,v[0]-center.x),r:Math.hypot(v[0]-center.x,v[1]-center.z)}));
 const radius=radii.reduce((s,v)=>s+v.r,0)/radii.length;
 function edgeRadius(a){for(let i=0;i<radii.length;i++){const v=radii[i],w=radii[(i+1)%radii.length],span=(w.a-v.a+Math.PI*2)%(Math.PI*2),d=(a-v.a+Math.PI*2)%(Math.PI*2);if(d<=span+1e-7)return (v.r*w.r*Math.sin(span))/(w.r*Math.sin(span-d)+v.r*Math.sin(d)||1);}return radius;}
 const nativeRim=native.rim.map(i=>native.positions[i]);
 const nativeRadius=nativeRim.reduce((s,v)=>s+Math.hypot(v[0],v[2]),0)/nativeRim.length;
 const positions=native.positions.map(([x,y,z])=>{const a=Math.atan2(z,x),r=Math.hypot(x,z)/nativeRadius*edgeRadius(a);return [center.x+Math.cos(a)*r,cut-y*radius*.4,center.z+Math.sin(a)*r];});
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(native.triangles.flatMap(t=>t.flatMap(i=>positions[i])),3));result.computeVertexNormals();result.computeBoundingBox();
 cap.geometry.dispose();cap.geometry=result;cap.material.color.setHex(0x98734d);cap.name='speedtree-torn-branch-wood';cap.userData.speedTreeSource=native.source;
 upper.add(cap);upper.userData={...source.userData,nativeBranchBreak:true};upper.name=source.name;
 if(geometry!==source.geometry)geometry.dispose();
 return upper;
}
