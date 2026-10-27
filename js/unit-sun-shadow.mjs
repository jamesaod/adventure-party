/** Shared, presentation-only sun path and ground projection. No combat state. */
import { CAMERA_ELEVATION } from './studio-core.mjs?v=R238C99';

export const DEFAULT_SUN_HOUR=12;
export function normalizeSunHour(value){
  const hour=typeof value==='number'?value:Number(value);
  return value===null||value===''||!Number.isFinite(hour)?DEFAULT_SUN_HOUR:((hour%24)+24)%24;
}
export function sunPosition(hour=DEFAULT_SUN_HOUR){
  hour=normalizeSunHour(hour);
  const phase=(hour-6)*Math.PI/12;
  const up=Math.sin(phase);
  const daylight=hour>6&&hour<18;
  const x=Math.cos(phase),y=up*Math.sin(Math.PI/3),z=up*Math.cos(Math.PI/3);
  // A fixed game-day arc: east (+X), south (+Z) at noon, west (-X).
  // Fade at the horizon and cap projection at six body heights.
  const denominator=Math.max(y,Math.hypot(x,z)/6,0.001);
  return {hour,x,y,z,daylight,elevation:Math.asin(y)*180/Math.PI,
    groundX:daylight?-x/denominator:0,groundZ:daylight?-z/denominator:0,
    opacity:daylight?0.30*Math.min(1,y/0.18):0};
}
export function shadowProjection(hour){
  const sun=sunPosition(hour),cos=Math.cos(CAMERA_ELEVATION);
  return {...sun,shearX:-sun.groundX/cos,shearY:-sun.groundZ*Math.sin(CAMERA_ELEVATION)/cos};
}
export function sunDescription(hour){
  const sun=sunPosition(hour),minutes=Math.round(sun.hour*60)%1440;
  const clock=String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  return `${clock} · ${sun.daylight?`Sun ${sun.hour<12?'east':sun.hour>12?'west':'south'}, ${Math.round(sun.elevation)}° high`:'Sun below horizon'}`;
}

// Image masks are cached by decoded image identity. The animated Studio atlas
// supplies a revision; only its current six tiles remain cached. No readback,
// recolor or mutation of original PNG pixels is required.
const masks=new WeakMap();
export function shadowMask(source,{sx=0,sy=0,sw=source.naturalWidth||source.width,sh=source.naturalHeight||source.height,revision=0}={}){
  if(!sw||!sh)return null;
  let entry=masks.get(source);
  if(!entry||entry.revision!==revision){entry={revision,tiles:new Map()};masks.set(source,entry);}
  const key=[sx,sy,sw,sh].join(':');
  if(entry.tiles.has(key))return entry.tiles.get(key);
  const mask=document.createElement('canvas');mask.width=sw;mask.height=sh;
  const ctx=mask.getContext('2d');
  ctx.drawImage(source,sx,sy,sw,sh,0,0,sw,sh);
  ctx.globalCompositeOperation='source-in';ctx.fillStyle='#000';ctx.fillRect(0,0,sw,sh);
  entry.tiles.set(key,mask);return mask;
}
export function drawUnitShadow(ctx,source,{x,y,width,height,anchorX=0.5,anchorY=1,flip=false,hour=DEFAULT_SUN_HOUR,opacity=1,...crop}){
  const sun=shadowProjection(hour);
  if(sun.opacity<=0||width<=0||height<=0||opacity<=0)return;
  const mask=shadowMask(source,crop);if(!mask)return;
  ctx.save();ctx.globalAlpha*=sun.opacity*opacity;ctx.imageSmoothingEnabled=false;
  // Reflect the character's silhouette, never the world-fixed sun direction.
  ctx.transform(flip?-1:1,0,sun.shearX,sun.shearY,x,y);
  ctx.drawImage(mask,-anchorX*width,-anchorY*height,width,height);
  ctx.restore();
}

function preferenceKey(){return 'adventure-party-sun-hour:'+new URL('.',location.href).pathname;}
let currentHour=DEFAULT_SUN_HOUR;
try{
  const query=new URLSearchParams(location.search);
  currentHour=normalizeSunHour(query.has('sunHour')?query.get('sunHour'):localStorage.getItem(preferenceKey()));
}catch{ /* Node tests, disabled storage and older drafts use noon. */ }
const controls=new Set();
export const unitSun={
  drawingGround:false,
  get hour(){return currentHour;},
  setHour(value){
    currentHour=normalizeSunHour(value);
    try{localStorage.setItem(preferenceKey(),String(currentHour));}catch{}
    for(const {input,output} of controls){input.value=String(currentHour);output.textContent=sunDescription(currentHour);}
    return currentHour;
  },
  bind(input,output,onChange=()=>{}){
    controls.add({input,output});this.setHour(currentHour);
    input.addEventListener('input',()=>{
      this.setHour(input.value);
      try{const url=new URL(location.href);url.searchParams.set('sunHour',String(currentHour));history.replaceState(history.state,'',url);}catch{}
      onChange(currentHour);
    });
  },
  draw(ctx,source,options){drawUnitShadow(ctx,source,{...options,hour:currentHour});}
};
