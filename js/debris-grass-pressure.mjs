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
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const px=left+(x+.5)/size*width,py=top+(y+.5)/size*height;let strength=0;for(const hull of hulls){let inside=true,distance=Infinity;
 for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length],dx=b.x-a.x,dy=b.y-a.y;if(dx*(py-a.y)-dy*(px-a.x)<0)inside=false;const t=Math.max(0,Math.min(1,((px-a.x)*dx+(py-a.y)*dy)/Math.max(1e-9,dx*dx+dy*dy)));distance=Math.min(distance,Math.hypot(px-a.x-t*dx,py-a.y-t*dy));}
 const v=inside?1:Math.max(0,Math.min(1,1-(distance-pad)/feather));strength=Math.max(strength,v*v*(3-2*v));}data[y*size+x]=Math.round(strength*255);}
 }texture.needsUpdate=true;},diagnostics:()=>({bakes,strength:uniforms.debrisStrength.value}),dispose(){texture.dispose();}};
}
