// Lab-only, map-wide grass. World-space coverage never changes ground textures.
export const CANOPY_STEP=.065;
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
// Static world-space density: smooth, warped patches instead of periodic bands.
function patchHash(x,y){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^1442695041;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
function patchNoise(x,y){const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,a=u*u*u*(u*(u*6-15)+10),b=v*v*v*(v*(v*6-15)+10);return (patchHash(ix,iy)*(1-a)+patchHash(ix+1,iy)*a)*(1-b)+(patchHash(ix,iy+1)*(1-a)+patchHash(ix+1,iy+1)*a)*b;}
export function canopySample(x,y){
 const wx=x+1.4*(patchNoise(x*.21+31,y*.21-17)-.5),wy=y+1.4*(patchNoise(x*.21-53,y*.21+29)-.5);
 const field=.78*patchNoise((wx*.8-wy*.6)*.43+11,(wx*.6+wy*.8)*.43-7)+.22*patchNoise(wx*.91+47,wy*.91-23);
 return {field,coverage:smooth(.20,.52,field),height:.35+.65*smooth(.22,.78,field)};
}
export function canopyPlacements(face,tuning,hash,contains){
 if(!tuning.canopyEnabled||!face.grass||face.snowEligible<=0||face.points.length<3)return [];
 const unit=face.grassUnit||128/3,squash=face.grassSquash||.568329,p=face.points,out=[];
 const x0=Math.floor(Math.min(...p.map(v=>v.x/unit))/CANOPY_STEP),x1=Math.ceil(Math.max(...p.map(v=>v.x/unit))/CANOPY_STEP);
 const y0=Math.floor(Math.min(...p.map(v=>v.y/(unit*squash)))/CANOPY_STEP),y1=Math.ceil(Math.max(...p.map(v=>v.y/(unit*squash)))/CANOPY_STEP);
 for(let gx=x0;gx<=x1;gx++)for(let gy=y0;gy<=y1;gy++){
  const mx=(gx+.1+.8*hash(gx,gy,80))*CANOPY_STEP,my=(gy+.1+.8*hash(gx,gy,81))*CANOPY_STEP,x=mx*unit,y=my*unit*squash,c=canopySample(mx,my);
  if(hash(gx,gy,82)>=c.coverage||!contains(p,x,y))continue;
  if(tuning.groundWater?.(x,y,unit,squash)>.02)continue;
  if(tuning.grassCoverage&&hash(gx,gy,83)>=tuning.grassCoverage(x,y,unit,squash))continue;
  out.push({x,y,unit,squash,groundElevation:tuning.groundElevation?.(x,y,unit,squash)||0,seed:hash(gx,gy,84),type:3,field:c.field,key:'canopy:'+gx+','+gy});
 }
 return out;
}
