import * as THREE from '../assets/vendor/three/three.module.min.js';
// A continuous crown/trunk footprint fills the spaces between fallen limbs.
// Capsule outlines are conservatively enclosed; navigation retains separate wood capsules.
export function fallenGrassHull(capsules){
 const points=[];for(const c of capsules)for(const p of [c.a,c.b])for(let i=0;i<16;i++){const a=i*Math.PI/8,r=c.radius/Math.cos(Math.PI/16);points.push({x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r});}
 points.sort((a,b)=>a.x-b.x||a.y-b.y);const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),half=ps=>{const h=[];for(const p of ps){while(h.length>1&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}return h;};if(points.length<3)return points;
 const lower=half(points),upper=half(points.slice().reverse());lower.pop();upper.pop();return lower.concat(upper);
}
export function createDebrisGrassPressure(){
 const size=256,data=new Uint8Array(size*size),texture=new THREE.DataTexture(data,size,size,THREE.RedFormat);
 texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 const uniforms={debrisPressure:{value:texture},debrisBounds:{value:new THREE.Vector4(0,0,1,1)},debrisStrength:{value:0}};let source=null,bakes=0;
 return {uniforms,update(capsules,strength=0){uniforms.debrisStrength.value=capsules?.length?strength:0;if(source===capsules)return;source=capsules;data.fill(0);bakes++;
 if(capsules?.length){const groups=new Map();for(const c of capsules){const key=c.fallGroup||'default';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}const hulls=[...groups.values()].map(fallenGrassHull),hull=hulls.flat(),feather=12,left=Math.min(...hull.map(p=>p.x))-feather,top=Math.min(...hull.map(p=>p.y))-feather,right=Math.max(...hull.map(p=>p.x))+feather,bottom=Math.max(...hull.map(p=>p.y))+feather,width=Math.max(1,right-left),height=Math.max(1,bottom-top);uniforms.debrisBounds.value.set(left,top,width,height);
 // Extend the solid core by a texel so bilinear filtering cannot leave interior tips.
 const pad=Math.hypot(width,height)/size;
 // Rasterize each hull only within its feathered bounds. Squared distances
 // avoid a square root for every edge; interior pixels need no distance work.
 for(const hull of hulls){
 const edges=hull.map((a,i)=>{const b=hull[(i+1)%hull.length],dx=b.x-a.x,dy=b.y-a.y;return {x:a.x,y:a.y,dx,dy,inv:1/Math.max(1e-9,dx*dx+dy*dy)};});
 const margin=feather+pad,minX=Math.max(0,Math.floor((Math.min(...hull.map(p=>p.x))-margin-left)/width*size)),maxX=Math.min(size-1,Math.ceil((Math.max(...hull.map(p=>p.x))+margin-left)/width*size)),minY=Math.max(0,Math.floor((Math.min(...hull.map(p=>p.y))-margin-top)/height*size)),maxY=Math.min(size-1,Math.ceil((Math.max(...hull.map(p=>p.y))+margin-top)/height*size));
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
 const index=y*size+x;if(data[index]===255)continue;
 const px=left+(x+.5)/size*width,py=top+(y+.5)/size*height;
 let inside=true;for(const e of edges)if(e.dx*(py-e.y)-e.dy*(px-e.x)<0){inside=false;break;}
 if(inside){data[index]=255;continue;}
 let squared=Infinity;for(const e of edges){const ax=px-e.x,ay=py-e.y,t=Math.max(0,Math.min(1,(ax*e.dx+ay*e.dy)*e.inv)),dx=ax-t*e.dx,dy=ay-t*e.dy;squared=Math.min(squared,dx*dx+dy*dy);}
 const v=Math.max(0,Math.min(1,1-(Math.sqrt(squared)-pad)/feather));data[index]=Math.max(data[index],Math.round(v*v*(3-2*v)*255));
 }
 }

 }texture.needsUpdate=true;},diagnostics:()=>({bakes,strength:uniforms.debrisStrength.value}),dispose(){texture.dispose();}};
}
