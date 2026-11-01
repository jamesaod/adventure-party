import {effectiveEdges,edgeBetween,edgeKey,edgeGeometry,doorKey} from './exploration-edges.mjs?v=R238C232';
import {isOutdoor,ambientLightAt} from './exploration-environment.mjs?v=R238C238';
import {SCENE_STYLE,ambientForCell,sceneLightVisible} from './exploration-scene-style.mjs?v=R238C239';
export const DAYLIGHT=Object.freeze({rangeCells:5,portalIntensity:1.15,roomFill:.22,fillStep:.78,doorTransmission:.45,windowTransmission:.25});
const ZERO=Object.freeze({rgb:Object.freeze([0,0,0]),relief:0,direct:0,bounce:0});
const key=(x,z)=>x+','+z,dirs=[[1,0],[-1,0],[0,1],[0,-1]],sky=[.72,.84,1];
// A static field per authored map/door state. No gameplay state or timers.
export function buildDaylightField(map,opened=new Set()){
 const cell=SCENE_STYLE.cellMetres,floor=(x,z)=>'.D'.includes(map.grid[z]?.[x]||'#'),indoor=(x,z)=>floor(x,z)&&!isOutdoor(map,x,z);
 const edges=map.version===2?new Map(effectiveEdges(map).map(e=>[edgeKey(e),e])):null;
 const legacyDoors=new Map((map.doors||[]).map(d=>[key(d.x,d.z),d]));
 const legacyClosed=p=>map.grid[p.z]?.[p.x]==='D'&&!opened.has(doorKey(legacyDoors.get(key(p.x,p.z))||p));
 function crossing(a,b){
  if(!floor(a.x,a.z)||!floor(b.x,b.z))return null;
  if(!edges){if(legacyClosed(a)||legacyClosed(b))return null;return {width:1,transmission:map.grid[a.z][a.x]==='D'||map.grid[b.z][b.x]==='D'?DAYLIGHT.doorTransmission:1,kind:'open'};}
  const edge=edges.get(edgeKey(edgeBetween(a,b)));
  if(!edge)return {width:1,transmission:1,kind:'open'};
  if(edge.kind==='wall'||edge.kind==='door'&&!opened.has(edge.id))return null;
  return {edge,width:edge.width??1,kind:edge.kind,transmission:edge.kind==='door'?DAYLIGHT.doorTransmission:DAYLIGHT.windowTransmission};
 }
 const portals=[],buckets=new Map(),fill=new Map();
 for(let z=0;z<map.height;z++)for(let x=0;x<map.width;x++)if(indoor(x,z)){
  for(const [dx,dz] of dirs){const outside={x:x+dx,z:z+dz};if(!floor(outside.x,outside.z)||!isOutdoor(map,outside.x,outside.z))continue;
   const opening=crossing({x,z},outside);if(!opening)continue;
   const daylight=ambientLightAt(map,outside.x,outside.z)/100;if(daylight<=0)continue;
   const center=opening.edge?edgeGeometry(opening.edge).center:{x:x+dx/2,z:z+dz/2};
   const portal={id:opening.edge?.id||'sky:'+x+','+z+':'+dx+','+dz,inside:{x,z},outside,center,width:opening.width,daylight,dx,dz,kind:opening.kind,samples:[]};
   for(const t of [-.3,0,.3])portal.samples.push({x:(center.x+dx*.04-dz*opening.width*t)*cell,y:opening.kind==='window'?2:1.8,z:(center.z+dz*.04+dx*opening.width*t)*cell});
   portals.push(portal);
   // Limit direct sky queries to nearby indoor cells.
   const r=DAYLIGHT.rangeCells;
   for(let iz=Math.max(0,z-r);iz<=Math.min(map.height-1,z+r);iz++)for(let ix=Math.max(0,x-r);ix<=Math.min(map.width-1,x+r);ix++)if(indoor(ix,iz)&&Math.hypot(ix-center.x,iz-center.z)<=r+1){const k=key(ix,iz);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(portal);}
   // Approximate diffuse bounce by the strongest attenuated indoor path.
   // Crossing another door/window loses energy; closed boundaries never pass it.
   const seed=DAYLIGHT.roomFill*daylight*Math.sqrt(opening.width)*(opening.kind==='window'?.7:1),best=new Map([[key(x,z),seed]]),queue=[{x,z,value:seed}];
   for(let i=0;i<queue.length;i++){
    const p=queue[i];if(p.value<(best.get(key(p.x,p.z))||0)-1e-8)continue;
    for(const [sx,sz] of dirs){const next={x:p.x+sx,z:p.z+sz};if(!indoor(next.x,next.z))continue;const path=crossing(p,next);if(!path)continue;
     const value=p.value*DAYLIGHT.fillStep*path.transmission,k=key(next.x,next.z);if(value<.002||value<=(best.get(k)||0)+1e-8)continue;best.set(k,value);queue.push({...next,value});
    }
   }
   for(const [k,value] of best)fill.set(k,Math.min(.5,(fill.get(k)||0)+value));
  }
 }
 const profiles=new Map(),queryCaches=new WeakMap(),defaultVisible=(source,point)=>sceneLightVisible(map,opened,source,point);
 function ambientAt(x,z){
  const base=ambientForCell(map,x,z),painted=map.ambientLight?.[z]?.[x];if(painted===null||painted===undefined)return base;
  const k=(isOutdoor(map,x,z)?'o':'i')+painted;if(profiles.has(k))return profiles.get(k);
  const amount=painted/100,intensity=isOutdoor(map,x,z)?base.intensity*Math.max(.025,amount):base.intensity+(2.4-base.intensity)*amount;
  const value={...base,intensity};profiles.set(k,value);return value;
 }
 function sample(point,normal={x:0,y:1,z:0},visible=defaultVisible){
  const gx=point.x/cell,gz=point.z/cell,cx=Math.floor(gx+.5),cz=Math.floor(gz+.5);
  if(!portals.length||!indoor(cx,cz)||!fill.has(key(cx,cz))&&!buckets.has(key(cx,cz)))return ZERO;
  let cache=queryCaches.get(visible);if(!cache){cache=new Map();queryCaches.set(visible,cache);}
  const cacheKey=[point.x,point.y||0,point.z,normal.x,normal.y,normal.z].map(v=>Math.round(v*10000)).join(':');if(cache.has(cacheKey))return cache.get(cacheKey);
  let bounce=0,weight=0;
  // Smooth fill within connected cells, never average through a solid wall.
  for(let z=Math.floor(gz);z<=Math.ceil(gz);z++)for(let x=Math.floor(gx);x<=Math.ceil(gx);x++)if(indoor(x,z)){
   const w=(1-Math.abs(x-gx))*(1-Math.abs(z-gz));if(w<=0)continue;
   if((x!==cx||z!==cz)&&!visible({x:cx*cell,y:point.y||0,z:cz*cell},{...point,x:x*cell,z:z*cell}))continue;
   weight+=w;bounce+=w*(fill.get(key(x,z))||0);
  }
  bounce=weight?bounce/weight:fill.get(key(cx,cz))||0;
  let direct=0;
  for(const portal of buckets.get(key(cx,cz))||[]){
   const distance=Math.hypot(gx-portal.center.x,gz-portal.center.z);if(distance>DAYLIGHT.rangeCells)continue;
   let exposure=0;
   for(const source of portal.samples){if(!visible(source,point))continue;
    const dx=source.x-point.x,dy=source.y-(point.y||0),dz=source.z-point.z,len=Math.hypot(dx,dy,dz)||1;
    exposure+=Math.max(0,(dx*normal.x+dy*normal.y+dz*normal.z)/len)/portal.samples.length;
   }
   const cutoff=(1-(distance/DAYLIGHT.rangeCells)**2)**2;
   direct+=DAYLIGHT.portalIntensity*portal.daylight*Math.sqrt(portal.width)*(portal.kind==='window'?.7:1)*exposure*cutoff/(1+(distance/1.5)**2);
  }
  const amount=direct+bounce*(.65+.35*Math.max(0,normal.y));
  const result={rgb:sky.map(v=>v*amount),relief:Math.min(1,direct+bounce*2),direct,bounce};
  if(cache.size>=16384)cache.clear();cache.set(cacheKey,result);return result;
 }
 return {portals,fill,ambientAt,sample};
}
