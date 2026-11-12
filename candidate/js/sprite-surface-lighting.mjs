// Brightness only: preserve baked artwork colors/alpha and never overexpose it.
export function spriteSurfaceBrightness(exposure,visibility,radiance=[0,0,0]){
 const weights=[.2126,.7152,.0722];let value=0;
 for(let i=0;i<3;i++){
  const multiplier=exposure.multiply[i]/255,boost=exposure.boost[i]/255;
  value+=weights[i]*(multiplier/Math.max(.001,1-boost)*visibility+Math.max(0,radiance[i]||0));
 }
 return Math.max(.02,Math.min(1,value));
}
