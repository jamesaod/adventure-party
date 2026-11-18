import * as THREE from '../assets/vendor/three/three.module.min.js';
const records=new WeakMap();
// Geometry is intersected only when a settled body or its water level changes.
export function cacheCorpseWaterline(root,entity,matrix,factor,bedDepth,sample,revision){
 if(!entity||entity.alive!==false)return false;
 const key=[entity.deathPresentationStartedAt,entity.x,entity.y,bedDepth,factor,revision,...matrix.elements.map(v=>Math.round(v*1e5)/1e5),root.rotation.y].join(':');
 if(records.get(entity)?.key===key)return false;
 const segments=[],p=new THREE.Vector3(),ground=new THREE.Vector3();
 root.updateMatrixWorld(true);
 root.traverseVisible(mesh=>{
  if(!mesh.isMesh||mesh.userData.corpseSnowShell)return;
  const g=mesh.geometry,pos=g?.attributes.position;if(!pos)return;
  const vertices=[];
  for(let i=0;i<pos.count;i++){
   p.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
   ground.set(p.x,0,p.z).applyMatrix4(matrix);
   const w=sample(ground.x,ground.y);
   vertices.push({x:ground.x,y:ground.y,h:p.y/factor-bedDepth-((w?.water||0)-(w?.depth||0)),wet:(w?.water||0)>.0005});
  }
  const index=g.index,n=index?index.count:pos.count;
  for(let i=0;i+2<n;i+=3){
   const v=[0,1,2].map(j=>vertices[index?index.getX(i+j):i+j]),hits=[];
   for(let j=0;j<3;j++){const a=v[j],b=v[(j+1)%3];if((a.h<0)===(b.h<0)||!a.wet&&!b.wet)continue;const t=a.h/(a.h-b.h);hits.push([a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t]);}
   if(hits.length===2)segments.push([...hits[0],...hits[1]]);
  }
 });
 records.set(entity,{key,segments});return true;
}
export function corpseWaterline(entity){return records.get(entity);}
// A shared world-space distance mask: fixed 4 MiB, rebuilt only on record changes.
export function createCorpseWaterlineMask(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
 const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.generateMipmaps=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;
 let previous=[];
 function update(movers){
  const next=movers.filter(m=>m.entity?.alive===false&&!m.entity.fled).map(m=>records.get(m.entity)).filter(Boolean);
  if(next.length===previous.length&&next.every((r,i)=>r===previous[i]))return;
  previous=next;ctx.fillStyle='white';ctx.fillRect(0,0,1024,1024);
  const path=new Path2D(),scale=1024/128,unit=128/3;
  for(const r of next)for(const [ax,ay,bx,by]of r.segments){path.moveTo((ax/unit+64)*scale,(64-ay/unit/.568329)*scale);path.lineTo((bx/unit+64)*scale,(64-by/unit/.568329)*scale);}
  ctx.lineCap='round';ctx.lineJoin='round';
  for(let i=12;i>=1;i--){const distance=i*.015;ctx.strokeStyle='rgb('+Array(3).fill(Math.round(distance/.25*255)).join(',')+')';ctx.lineWidth=distance*2*scale;ctx.stroke(path);}
  texture.needsUpdate=true;
 }
 ctx.fillStyle='white';ctx.fillRect(0,0,1024,1024);texture.needsUpdate=true;
 return {texture,update,dispose:()=>texture.dispose()};
}
