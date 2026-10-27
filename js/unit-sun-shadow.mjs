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
    opacity:daylight?0.45*Math.min(1,y/0.18):0};
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
// supplies a revision; only its current six tiles remain cached. Alpha is read
// once per mask to locate foot contacts; original PNG pixels are never changed.
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
// Locate independent lower-body silhouettes, so a wide stance can have two
// different projected ground depths. Padding and the unit pivot are not feet.
export function findShadowFootLine(rgba,width,height){
  let top=height,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(rgba[(y*width+x)*4+3]>=64){top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(bottom<0)return {slope:0,intercept:height,contacts:[]};
  const cut=Math.floor(top+(bottom-top+1)*0.60),seen=new Uint8Array(width*height),parts=[];
  for(let y=cut;y<=bottom;y++)for(let x=0;x<width;x++){
    const start=y*width+x;
    if(seen[start]||rgba[start*4+3]<64)continue;
    const queue=[start];seen[start]=1;
    let count=0,footY=-1,sumX=0,footPixels=0;
    for(let cursor=0;cursor<queue.length;cursor++){
      const at=queue[cursor],px=at%width,py=Math.floor(at/width);count++;
      if(py>footY){footY=py;sumX=0;footPixels=0;}
      if(py===footY){sumX+=px+0.5;footPixels++;}
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=px+dx,ny=py+dy,next=ny*width+nx;
        if(nx<0||nx>=width||ny<cut||ny>bottom||seen[next]||rgba[next*4+3]<64)continue;
        seen[next]=1;queue.push(next);
      }
    }
    parts.push({count,x:sumX/footPixels,y:footY+0.5});
  }
  parts.sort((a,b)=>b.count-a.count);
  const contacts=parts.filter(p=>p.count>=Math.max(3,(parts[0]?.count||0)*0.12)).slice(0,2).sort((a,b)=>a.x-b.x);
  if(contacts.length===2&&contacts[1].x-contacts[0].x>=2){
    const slope=(contacts[1].y-contacts[0].y)/(contacts[1].x-contacts[0].x);
    if(Math.abs(slope)<=1.5)return {slope,intercept:contacts[0].y-slope*contacts[0].x,contacts};
  }
  // Nearly overlapping feet cannot define a stable plane from a flat sprite.
  const front=contacts.reduce((best,p)=>!best||p.y>best.y?p:best,null);
  return {slope:0,intercept:front?.y??bottom+0.5,contacts:front?[front]:[]};
}
const footLines=new WeakMap();
export function shadowFootLine(mask){
  let line=footLines.get(mask);
  if(!line){
    line=findShadowFootLine(mask.getContext('2d').getImageData(0,0,mask.width,mask.height).data,mask.width,mask.height);
    footLines.set(mask,line);
  }
  return line;
}

export function drawUnitShadow(ctx,source,{x,y,width,height,anchorX=0.5,anchorY=1,flip=false,hour=DEFAULT_SUN_HOUR,opacity=1,...crop}){
  const sun=shadowProjection(hour);
  if(sun.opacity<=0||width<=0||height<=0||opacity<=0)return;
  const mask=shadowMask(source,crop);if(!mask)return;
  ctx.save();ctx.globalAlpha*=sun.opacity*opacity;ctx.imageSmoothingEnabled=false;
  // Every point on the visible foot-contact line stays fixed under projection.
  // Reflection changes the silhouette, never the world-fixed sun direction.
  const line=shadowFootLine(mask),sx=width/mask.width,sy=height/mask.height;
  const slope=line.slope*sy/sx;
  const baseline=(line.slope*anchorX*mask.width+line.intercept-anchorY*mask.height)*sy;
  ctx.transform((flip?-1:1)-sun.shearX*slope,(1-sun.shearY)*slope,
    sun.shearX,sun.shearY,x-sun.shearX*baseline,y+(1-sun.shearY)*baseline);
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
