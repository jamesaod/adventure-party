// Probe just outside the CPU LOS footprint of a rendered surface. Display
// wall thickness is compressed, so a fixed metric normal offset can remain
// inside the occluder. Do not alter gameplay geometry or ignore other walls.
const indexes=new WeakMap(),key=p=>Math.round(p.x*1e6)+','+Math.round(p.y*1e6);
export function wallSurfaceNeighbours(wall,walls){
 let index=indexes.get(walls);if(!index){index={ends:new Map(),owners:new WeakMap()};for(const w of walls)for(const p of [w.a,w.b]){const k=key(p);if(!index.ends.has(k))index.ends.set(k,[]);index.ends.get(k).push(w);}indexes.set(walls,index);}
 let result=index.owners.get(wall);if(!result){result=[...new Set([...index.ends.get(key(wall.a))||[],...index.ends.get(key(wall.b))||[]])].filter(w=>w!==wall&&w.id!==wall.id);index.owners.set(wall,result);}return result;
}
function shellExit(p,eye,wall){
 const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,len=Math.hypot(dx,dy);if(len<1e-8)return null;
 const tx=dx/len,ty=dy/len,nx=-ty,ny=tx,half=Math.max(3,Number(wall.thickness)||9)/2;
 const u=(p.x-wall.a.x)*tx+(p.y-wall.a.y)*ty,v=(p.x-wall.a.x)*nx+(p.y-wall.a.y)*ny;
 if(u<-.00001||u>len+.00001||v< -half-.00001||v>half+.00001)return null;
 const ex=eye.x-p.x,ey=eye.y-p.y,du=ex*tx+ey*ty,dv=ex*nx+ey*ny;
 const limits=[];if(Math.abs(du)>1e-10)limits.push((du>0?len-u:-u)/du);if(Math.abs(dv)>1e-10)limits.push((dv>0?half-v:-half-v)/dv);
 const exit=Math.min(...limits.filter(t=>t>=-1e-8));if(!Number.isFinite(exit)||exit>=1)return null;
 const t=Math.max(0,exit)+.1/Math.max(.1,Math.hypot(ex,ey));return {x:p.x+ex*t,y:p.y+ey*t};
}
export function wallSurfaceProbe(point,eye,wall,neighbours=[]){
 let p={...point};const shells=[wall,...neighbours];for(let i=0;i<=shells.length;i++){let moved=false;for(const shell of shells){const next=shellExit(p,eye,shell);if(next){p=next;moved=true;}}if(!moved)break;}return p;
}

// Painter-sorted prisms must not draw the far vertical face over the near one.
// Miter tips can reverse max-endpoint sorting without reversing the true face.
export function wallFaceFacesCamera(face,project,squash=1){
 if(face.cap||face.normal.y>0)return true;
 const origin=project({x:0,y:0}),tip=project({x:face.normal.x,y:face.normal.z*squash});
 return tip.y-origin.y>=-1e-8;
}
