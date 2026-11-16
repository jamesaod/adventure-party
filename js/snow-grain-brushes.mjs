// Half-diameter ground grains; keep physical accumulation per snowfall second.
export const SNOW_BRUSH_SIZE=3;
function brushes(scale){return Array.from({length:16},(_,id)=>{
 const diameter=(id<8?5:7)*scale,angle=(id%8)*Math.PI/8,c=Math.cos(angle),s=Math.sin(angle),pixels=[];
 for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++){
  const u=(c*x-s*y)/diameter,v=(s*x+c*y)/diameter;
  const t=Math.max(0,Math.min(1,(Math.hypot(u,v*1.35)-.30)/.20));
  const dose=Math.round(255*.18*(1-t*t*(3-2*t)));if(dose)pixels.push({x,y,dose});
 }return pixels;
});}
export const SNOW_BRUSHES=brushes(.5);
// Half-diameter grains cover one quarter of the area. Four deposits preserve
// the snowfall pace; seeded coverage checks include discrete-texel gap filling.
export const SNOW_GRAIN_RATE_SCALE=4;
