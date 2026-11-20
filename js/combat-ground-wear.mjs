import * as T from '../assets/vendor/three/three.module.min.js';
import {coverField} from './combat-ground-cover.mjs?v=cover-profile1';
import {basinDepth,BASIN_MAX_METRES} from './combat-wet-basins.mjs';
export const WEAR_SETTINGS=Object.freeze({patchCoverage:.25,patchSize:3.4,patchSoftness:.4,patchWear:1,soilRelief:-1.8});
export function createGroundWear(){
 const size=1024,span=128,data=new Uint8Array(size*size),s=WEAR_SETTINGS,smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const mx=((x+.5)/size-.5)*span/s.patchSize,my=((y+.5)/size-.5)*span/s.patchSize,n=.8*coverField(mx*4,my*4)+.2*coverField(mx*19+80,my*19-30);data[y*size+x]=Math.round(255*s.patchWear*smooth((n-(.85-s.patchCoverage*.7))/s.patchSoftness+.5));}
 // R retains the exact wear mask; G is depth, BA store precomputed slopes.
 const packed=new Uint8Array(size*size*4),depth=new Float32Array(size*size);
 for(let k=0;k<data.length;k++)depth[k]=basinDepth(data[k]/255);
 const at=(x,y)=>depth[Math.max(0,Math.min(size-1,y))*size+Math.max(0,Math.min(size-1,x))];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const k=y*size+x,o=k*4;packed[o]=data[k];packed[o+1]=Math.round(depth[k]/BASIN_MAX_METRES*255);packed[o+2]=Math.round(255*(.5+Math.max(-1,Math.min(1,(at(x+1,y)-at(x-1,y))/(2*span/size)))*.5));packed[o+3]=Math.round(255*(.5+Math.max(-1,Math.min(1,(at(x,y+1)-at(x,y-1))/(2*span/size)))*.5));}
 const mask=new T.DataTexture(packed,size,size);mask.minFilter=mask.magFilter=T.LinearFilter;mask.needsUpdate=true;
 const soil=new T.TextureLoader().load('assets/textures/exploration/dirt-path-v1.png');soil.wrapS=soil.wrapT=T.RepeatWrapping;soil.colorSpace=T.NoColorSpace;
 const originalData=data.slice(),originalPacked=packed.slice();let revision=0;
 function stamp(a,b,radius,amount,profile=null){if(profile)radius=Math.max(profile.width,profile.depth)/2;
 const unit=128/3,squash=.568329,ax=a.x/unit,ay=a.y/(unit*squash),bx=b.x/unit,by=b.y/(unit*squash),dx=bx-ax,dy=by-ay;
 const x0=Math.max(0,Math.floor((Math.min(ax,bx)-radius)/span*size+size/2)-1),x1=Math.min(size-1,Math.ceil((Math.max(ax,bx)+radius)/span*size+size/2)+1),y0=Math.max(0,Math.floor((Math.min(ay,by)-radius)/span*size+size/2)-1),y1=Math.min(size-1,Math.ceil((Math.max(ay,by)+radius)/span*size+size/2)+1);
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=((x+.5)/size-.5)*span,py=((y+.5)/size-.5)*span,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(px-ax-dx*t,py-ay-dy*t)/radius;let cut=amount*(1-d*d)**2,fall=(1-d*d)**2;if(profile){const u=(px-ax)/profile.width+.5,v=(py-ay)/profile.depth+.5;if(u<0||v<0||u>1||v>1)continue;cut=profile.data[Math.round(v*(profile.n-1))*profile.n+Math.round(u*(profile.n-1))];fall=Math.min(1,cut/.025);if(cut<=0)continue;}else if(d>=1)continue;const k=y*size+x;data[k]=Math.max(data[k],Math.round(255*Math.min(1,fall*4)));packed[k*4]=data[k];packed[k*4+1]=Math.max(packed[k*4+1],Math.round(Math.min(.1524,cut)/.1524*255));}
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const o=(y*size+x)*4,d=(a,b)=>packed[(Math.max(0,Math.min(size-1,b))*size+Math.max(0,Math.min(size-1,a)))*4+1]/255*.1524;packed[o+2]=Math.round(255*(.5+Math.max(-1,Math.min(1,(d(x+1,y)-d(x-1,y))/(2*span/size)))*.5));packed[o+3]=Math.round(255*(.5+Math.max(-1,Math.min(1,(d(x,y+1)-d(x,y-1))/(2*span/size)))*.5));}
 revision++;mask.needsUpdate=true;
 }
 return {mask,soil,span,stamp,get revision(){return revision;},reset(){data.set(originalData);packed.set(originalPacked);revision++;mask.needsUpdate=true;},elevation(x,y,unit=128/3,squash=.568329){const fx=(x/unit/span+.5)*size-.5,fy=(y/(unit*squash)/span+.5)*size-.5,ix=Math.floor(fx),iy=Math.floor(fy),u=fx-ix,v=fy-iy,at=(a,b)=>packed[(Math.max(0,Math.min(size-1,b))*size+Math.max(0,Math.min(size-1,a)))*4+1]/255;return -BASIN_MAX_METRES*((at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v);},coverage(x,y,unit=128/3,squash=.568329){const fx=(x/unit/span+.5)*size-.5,fy=(y/(unit*squash)/span+.5)*size-.5,ix=Math.floor(fx),iy=Math.floor(fy),u=fx-ix,v=fy-iy,at=(a,b)=>data[Math.max(0,Math.min(size-1,b))*size+Math.max(0,Math.min(size-1,a))]/255;return 1-((at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v);},dispose(){mask.dispose();soil.dispose();}};
}
