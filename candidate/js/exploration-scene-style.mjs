import {isOutdoor,OUTDOOR_AMBIENT} from './exploration-environment.mjs?v=R238C238';
import {edgeLineBlocked,effectiveEdges,edgeKey,edgeAtSide} from './exploration-edges.mjs?v=R238C232';
// Authored scene units are metres; tactical cells and compact display heights
// are projection choices, never dimensions embedded in artwork or item data.
export const SCENE_STYLE=Object.freeze({
  cellMetres:3,wallMetres:3.5,wallDepthMetres:.18,eyeMetres:1.65,tacticalWallPixels:35,tacticalWallThickness:3,tacticalHexesPerCell:2,
  materials:Object.freeze({wallRows:6,sourceWallRows:6,floorSlabs:8,sourceFloorSlabs:4,wallWidthScale:.5,maxTilePixels:512}),
  ambient:Object.freeze({sky:0xc6b69b,ground:0x69635a,intensity:1.2}),
  lantern:Object.freeze({color:0xffdca1,intensity:12,range:18,decay:1.4,height:1.9,offsetZ:.2,shadowPixels:512,shadowNear:.05}),
  torch:Object.freeze({color:0xffa64d,intensity:8,range:10,decay:1.5,height:2.35,wallOffset:1.25,plateWidth:.22,plateHeight:.48,plateDepth:.06,stemHeight:.65,stemBottom:1.575,cupRadius:.16,shadowPixels:256,shadowNear:.05}),
  door:Object.freeze({tacticalArtworkWidth:2,width:2.5,height:3.08,depth:.09,frameWidth:.24,frameDepth:.36,lintelHeight:.4,hingeX:-1.25}),
  window:Object.freeze({width:1.2,height:1.4,sill:1})
});
export function materialMetrics(terrain,height=SCENE_STYLE.tacticalWallPixels){
  const m=SCENE_STYLE.materials,floorRepeat=m.sourceFloorSlabs/m.floorSlabs;
  return {floorWidth:terrain.cellW*floorRepeat,floorHeight:terrain.cellH*floorRepeat,
    wallWidth:terrain.cellW*m.wallWidthScale,wallHeight:height*m.sourceWallRows/m.wallRows};
}
export function projectSceneObject(kind,terrain,override={}){
  const object={...SCENE_STYLE[kind],...override};
  if(!Number.isFinite(object.width)||!Number.isFinite(object.height)||object.width<=0||object.height<=0)throw Error('Scene objects require authored width and height.');
  const height=object.height/SCENE_STYLE.wallMetres*SCENE_STYLE.tacticalWallPixels;
  return {width:object.width/SCENE_STYLE.cellMetres*terrain.cellW,
    depth:(object.depth||0)/SCENE_STYLE.cellMetres*terrain.cellH,height,
    sill:(object.sill||0)/SCENE_STYLE.wallMetres*SCENE_STYLE.tacticalWallPixels,
    artwork:{width:height*object.width/object.height,height}};
}
export function torchSeed(point){return point.x*19+point.z*31;}
export function torchAnimation(now,seed=0,reduced=false){
 if(reduced)return {intensity:1,height:1,width:1,swayX:0,swayZ:0};
 const t=now/1000,phase=seed*.73;
 return {intensity:1+.1*Math.sin(t*8.3+phase)+.05*Math.sin(t*17.1+phase*1.7),height:1+.12*Math.sin(t*11.7+phase),width:1+.08*Math.sin(t*9.1+phase),swayX:.035*Math.sin(t*6.1+phase),swayZ:.025*Math.sin(t*7.7+phase)};
}
export function torchPlacement(map,point){
 const edges=map.version===2?new Set(effectiveEdges(map).filter(e=>e.kind==='wall').map(edgeKey)):null;
 const direction=[[0,-1,'n'],[1,0,'e'],[0,1,'s'],[-1,0,'w']].find(([dx,dz,side])=>edges?edges.has(edgeKey(edgeAtSide(point.x,point.z,side))):map.grid[point.z+dz]?.[point.x+dx]==='#')||[0,0];
 const [dx,dz]=direction,cell=SCENE_STYLE.cellMetres;
 return {x:point.x*cell+dx*SCENE_STYLE.torch.wallOffset,z:point.z*cell+dz*SCENE_STYLE.torch.wallOffset,y:SCENE_STYLE.torch.height,
  wallX:point.x*cell+dx*cell/2,wallZ:point.z*cell+dz*cell/2,plateX:point.x*cell+dx*(cell/2-SCENE_STYLE.wallDepthMetres/2-SCENE_STYLE.torch.plateDepth/2-.005),plateZ:point.z*cell+dz*(cell/2-SCENE_STYLE.wallDepthMetres/2-SCENE_STYLE.torch.plateDepth/2-.005),dx,dz,attached:!!(dx||dz),seed:torchSeed(point)};
}

export function sceneLights(map,party){
  return [...(map.torches||[]).map(t=>({...SCENE_STYLE.torch,...torchPlacement(map,t),kind:'torch'})),
    {...SCENE_STYLE.lantern,x:party.x-Math.sin((party.facing||0)*Math.PI/2)*SCENE_STYLE.lantern.offsetZ,z:party.z+Math.cos((party.facing||0)*Math.PI/2)*SCENE_STYLE.lantern.offsetZ,y:SCENE_STYLE.lantern.height,kind:'lantern'}];
}
export const colorChannels=hex=>[(hex>>16)&255,(hex>>8)&255,hex&255];
const linear=c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
const ambientSky=colorChannels(SCENE_STYLE.ambient.sky).map(linear),ambientGround=colorChannels(SCENE_STYLE.ambient.ground).map(linear),linearColors=new Map();
function linearColor(hex){let value=linearColors.get(hex);if(!value){value=colorChannels(hex).map(linear);if(linearColors.size>=128)linearColors.clear();linearColors.set(hex,value);}return value;}
// Canvas adapter for the shared hemisphere + Lambert point-light definitions.
// Values remain linear until exposure is converted to display multipliers.
export function ambientForCell(map,x,z){return isOutdoor(map,x,z)?OUTDOOR_AMBIENT:SCENE_STYLE.ambient;}
export function surfaceLight(point,normal,lights,visible=()=>true,ambient=SCENE_STYLE.ambient){
  const sky=ambient===SCENE_STYLE.ambient?ambientSky:linearColor(ambient.sky),ground=ambient===SCENE_STYLE.ambient?ambientGround:linearColor(ambient.ground),hemi=(normal.y+1)/2;
  const result=sky.map((v,i)=>(v*hemi+ground[i]*(1-hemi))*ambient.intensity/Math.PI);
  for(const light of lights){
    const dx=light.x-point.x,dy=light.y-point.y,dz=light.z-point.z,d=Math.hypot(dx,dy,dz);
    if(d>=light.range)continue;
    const alignment=Math.max(0,(dx*normal.x+dy*normal.y+dz*normal.z)/Math.max(.01,d));if(!alignment||!visible(light,point))continue;
    const cutoff=Math.max(0,1-(d/light.range)**4)**2;
    const strength=light.intensity*alignment*cutoff/(Math.PI*Math.max(.01,d**light.decay));
    const color=linearColor(light.color);for(let i=0;i<3;i++)result[i]+=color[i]*strength;
  }
  return result;
}
export function displayExposure(light){
  const factor=light.map(v=>Math.max(.01,v)**(1/2.2));
  return {multiply:factor.map(v=>Math.round(255*Math.min(1,v))),boost:factor.map(v=>Math.round(255*(v>1?1-1/v:0)))};
}
export function sceneLightVisible(map,openDoors,light,point){
  if(map.version===2&&edgeLineBlocked(map,openDoors,{x:light.x/SCENE_STYLE.cellMetres,z:light.z/SCENE_STYLE.cellMetres},{x:point.x/SCENE_STYLE.cellMetres,z:point.z/SCENE_STYLE.cellMetres},'light'))return false;
  const size=SCENE_STYLE.cellMetres,dx=point.x-light.x,dz=point.z-light.z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(size/4)));
  for(let i=1;i<steps;i++){
    const x=Math.floor((light.x+dx*i/steps)/size+.5),z=Math.floor((light.z+dz*i/steps)/size+.5),cell=map.grid[z]?.[x];
    if(cell==='#'||cell==='D'&&!openDoors.has(`${x},${z}`))return false;
  }
  return true;
}
