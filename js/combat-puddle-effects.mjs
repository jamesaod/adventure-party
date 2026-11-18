import {basinWaterDepth,BASIN_MAX_METRES} from './combat-wet-basins.mjs';
export const PUDDLE_RING_LIMIT=96,PUDDLE_PARTICLE_LIMIT=384;
export function puddleRainRate(weather){return weather?.type==='rain'?80*Math.max(0,Math.min(1,Number(weather.intensity)||0))**2:0;}
function contains(points,x,y){let odd=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)odd=!odd;}return odd;}
// Fixed budgets; no map-wide simulation, independent timer or per-drop mesh.
export class CombatPuddleEffects {
 constructor({elevation,water,waterAt=null,permanent=()=>false,visible=()=>true,random=Math.random,step=()=>{}}={}){this.waterAt=waterAt;this.permanent=permanent;this.step=step;this.elevation=elevation;this.water=water;this.visible=visible;this.random=random;this.identity=null;this.reset();}
 reset(){this.faceIndexes=new Map();this.rings=[];this.particles=[];this.faces=[];this.stepFaces=[];this.contacts=new WeakMap();this.rigContacts=new WeakMap();this.waterSteps=new WeakMap();this.wetUnits=0;this.idleHits=0;this.last=null;this.credit=0;this.elapsed=0;this.rainHits=0;this.footHits=0;}
 scene(id){if(id!==this.identity){this.identity=id;this.reset();}}
 collect(faces){for(const cache of this.faceIndexes.values())cache.frameFaces=null;for(const f of faces)if(f.snowEligible>0&&(f.grass||f.groundKind==='dirt'))this.stepFaces.push(f);for(const f of faces)if(f.grass&&f.snowEligible>0&&(f.visibility??1)>.1001)this.faces.push(f);}
 sampleFace(f,x,y){
  if(!f||!contains(f.points,x,y)||!this.visible(f))return null;
  const unit=f.grassUnit||128/3,squash=f.grassSquash||.568329,depth=-this.elevation(x,y,unit,squash),local=this.waterAt?.(x,y,unit,squash),water=local?local.water:basinWaterDepth(depth,this.water());
  return water>.002?{face:f,x,y,unit,squash,height:local?local.height:this.water()-BASIN_MAX_METRES,visibility:f.visibility??1}:null;
 }
 candidates(kind,x,y){
  const faces=this[kind];let cache=this.faceIndexes.get(kind);
  if(cache?.frameFaces!==faces){
   if(!faces.every(f=>f._groundKey!==undefined))return faces; // arbitrary callers may mutate polygons
   if(!cache||faces.length!==cache.faces.length||faces.some((f,i)=>f!==cache.faces[i])){
    const grid=new Map(),size=128;
    for(const f of faces){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of f.points){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}for(let ix=Math.floor(minX/size);ix<=Math.floor(maxX/size);ix++)for(let iy=Math.floor(minY/size);iy<=Math.floor(maxY/size);iy++){const key=ix+','+iy;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(f);}}
    cache={faces:faces.slice(),grid};this.faceIndexes.set(kind,cache);
   }cache.frameFaces=faces;
  }
  return cache.grid.get(Math.floor(x/128)+','+Math.floor(y/128))||[];
 }
 sample(x,y){if(this.water()<=.002&&!this.permanent())return null;for(const f of this.candidates('faces',x,y)){const hit=this.sampleFace(f,x,y);if(hit)return hit;}return null;}
 emit(hit,foot=false){
  if(this.rings.length<PUDDLE_RING_LIMIT)this.rings.push({...hit,age:0,life:foot?.85:1.1,reach:foot?.40:.28});
  for(let i=0;i<(foot?7:2)&&this.particles.length<PUDDLE_PARTICLE_LIMIT;i++){
   const a=this.random()*Math.PI*2,speed=(foot?.35:.20)*( .5+this.random());
   this.particles.push({...hit,age:0,life:foot?.72:.65,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,vz:foot?1.15+this.random()*.35:1.35});
  }
  if(foot)this.footHits++;else this.rainHits++;
 }
 impact(x,y){
  const hit=this.sample(x,y);if(!hit)return false;
  // Reserve a bounded burst even during heavy rain; reuse the existing buffers.
  const count=120,mistCount=20;this.particles.splice(0,Math.max(0,this.particles.length+count+mistCount-PUDDLE_PARTICLE_LIMIT));
  this.rings.splice(0,Math.max(0,this.rings.length+3-PUDDLE_RING_LIMIT));
  for(let i=0;i<3;i++)this.rings.push({...hit,age:0,life:1.35+i*.22,reach:1.35+i*.5,strength:.95-i*.18});
  for(let i=0;i<count;i++){
   const a=i/count*Math.PI*2+this.random()*.2,speed=.65+this.random()*1.6;
   this.particles.push({...hit,age:0,size:1.75,life:1.3+this.random()*.45,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,vz:2.6+this.random()*1.9});
  }
  for(let i=0;i<mistCount;i++){
   const a=this.random()*Math.PI*2,speed=.25+this.random()*.65;
   this.particles.push({...hit,mist:true,size:12+this.random()*10,age:0,life:.8+this.random()*.5,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,vz:.65+this.random()*.7});
  }
  return true;
 }
 begin(now,weather,{hidden=false,snow=false}={}){
  this.wetUnits=0;
  const dt=hidden||this.last===null?0:Math.max(0,Math.min(.1,(now-this.last)/1000));this.last=hidden?null:now;this.elapsed+=dt;
  // Ground snow does not freeze exposed water. Keep unit wakes alive.
  if(snow)this.credit=0;
  this.rings=this.rings.filter(p=>(p.age+=dt)<p.life&&this.sampleFaceForRing(p));
  this.particles=this.particles.filter(p=>(p.age+=dt)<p.life);
  this.credit=Math.min(8,this.credit+dt*(snow?0:puddleRainRate(weather)));
  while(this.credit>=1){this.credit--;if((this.water()<=.002&&!this.permanent())||!this.faces.length)continue;
   // At most eight candidates per impact, independent of map size.
   for(let attempt=0;attempt<8;attempt++){
    const f=this.faces[Math.floor(this.random()*this.faces.length)],xs=f.points.map(p=>p.x),ys=f.points.map(p=>p.y);
    const x=Math.min(...xs)+this.random()*(Math.max(...xs)-Math.min(...xs)),y=Math.min(...ys)+this.random()*(Math.max(...ys)-Math.min(...ys));
    const hit=this.sampleFace(f,x,y);if(hit){this.emit(hit);break;}
   }
  }
  this.faces=[];this.stepFaces=[];
 }
 sampleFaceForRing(p){const local=this.waterAt?.(p.x,p.y,p.unit,p.squash);return (local?local.water:basinWaterDepth(-this.elevation(p.x,p.y,p.unit,p.squash),this.water()))>.002;}
 trackRig(entity){if(entity)this.rigContacts.set(entity,performance.now());}
 plant(entity,x,y){if(!entity?.alive)return;const floor=this.candidates('stepFaces',x,y).find(f=>contains(f.points,x,y)&&this.visible(f));if(floor)this.step(x,y,entity,floor);const hit=this.sample(x,y);if(hit&&this.elapsed-(this.waterSteps.get(entity)??-Infinity)>.25){this.emit(hit,true);this.waterSteps.set(entity,this.elapsed);}}
 walk(movers){this.wetUnits=0;for(const m of movers){if(!m.entity||m.entity.alive===false)continue;const old=this.contacts.get(m.entity),hit=this.sample(m.x,m.y),next={x:m.x,y:m.y,distance:old?.distance||0,side:old?.side||1,idleAt:old?.idleAt??this.elapsed+1.8+this.random()*1.8};this.contacts.set(m.entity,next);if(hit)this.wetUnits++;else next.idleAt=this.elapsed+1.8+this.random()*1.8;if(!old)continue;
   const dx=m.x-old.x,dy=(m.y-old.y)/.568329,metres=Math.hypot(dx,dy)/(128/3);if(metres>2){next.distance=0;continue;}next.distance+=metres;
   if(metres>.002)next.idleAt=this.elapsed+1.8+this.random()*1.8;
   else if(hit&&this.elapsed>=next.idleAt){
    // Two water contacts across the stance, in the unit's world-facing frame.
    // Sample each leg independently so a boot on the bank cannot ripple soil.
    const angle=Number.isFinite(m.heading)?m.heading:-(m.entity.facingHex||0)*Math.PI/3;
    let emitted=false;for(const side of [-1,1]){const offset=.12*hit.unit*side,leg=this.sample(m.x-Math.sin(angle)*offset,m.y+Math.cos(angle)*offset*hit.squash);if(leg&&this.rings.length<PUDDLE_RING_LIMIT){this.rings.push({...leg,age:0,life:1.6,reach:.48,strength:.35});emitted=true;}}
    if(emitted)this.idleHits++;next.idleAt=this.elapsed+2.2+this.random()*2;
   }
   // A tracked rig is not proof that a foot actually planted. Water retains
   // a distance fallback, suppressed briefly only after a real water impact.
   const rig=performance.now()-(this.rigContacts.get(m.entity)??-Infinity)<250;
   if((rig&&!hit)||(hit&&this.elapsed-(this.waterSteps.get(m.entity)??-Infinity)<.25)){next.distance=0;continue;}
   if(next.distance<.45)continue;next.distance%=.45;next.side=-next.side;
   const floor=this.candidates('stepFaces',m.x,m.y).find(f=>contains(f.points,m.x,m.y)&&this.visible(f));if(floor&&(!rig||hit))this.step(m.x,m.y,m.entity,floor);
   if(!hit)continue;
   const length=Math.hypot(dx,dy)||1,offset=.10*hit.unit*next.side;
   this.emit(this.sample(m.x-dy/length*offset,m.y+dx/length*offset*hit.squash)||hit,true);
   this.waterSteps.set(m.entity,this.elapsed);
  }}
 get active(){return !!(this.rings.length||this.particles.length||this.wetUnits);}
 snapshot(){return {rings:this.rings.length,particles:this.particles.length,rainHits:this.rainHits,footHits:this.footHits,idleHits:this.idleHits,wetUnits:this.wetUnits};}
}

