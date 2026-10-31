// Authored scene units are metres; tactical cells and compact display heights
// are projection choices, never dimensions embedded in artwork or item data.
export const SCENE_STYLE=Object.freeze({
  cellMetres:3,wallMetres:3.5,eyeMetres:1.65,tacticalWallPixels:35,tacticalWallThickness:3,tacticalHexesPerCell:2,
  materials:Object.freeze({wallRows:6,sourceWallRows:6,floorSlabs:8,sourceFloorSlabs:4,wallWidthScale:.5,maxTilePixels:512}),
  ambient:Object.freeze({sky:0xc6b69b,ground:0x69635a,intensity:1.2}),
  lantern:Object.freeze({color:0xffdca1,intensity:12,range:18,decay:1.4,height:1.9,offsetZ:.2,shadowPixels:512,shadowNear:.05}),
  torch:Object.freeze({color:0xffa64d,intensity:8,range:10,decay:1.5,height:2.35,wallOffset:1.25,shadowPixels:256,shadowNear:.05}),
  door:Object.freeze({tacticalArtworkWidth:2,width:2.5,height:3.08,depth:.14,frameWidth:.24,frameDepth:.36,lintelHeight:.4,hingeX:-1.25}),
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
export function torchPlacement(map,point){
  const direction=[[0,-1],[1,0],[0,1],[-1,0]].find(([dx,dz])=>map.grid[point.z+dz]?.[point.x+dx]==='#')||[0,0];
  return {x:point.x*SCENE_STYLE.cellMetres+direction[0]*SCENE_STYLE.torch.wallOffset,
    z:point.z*SCENE_STYLE.cellMetres+direction[1]*SCENE_STYLE.torch.wallOffset,y:SCENE_STYLE.torch.height};
}
export function sceneLights(map,party){
  return [...(map.torches||[]).map(t=>({...SCENE_STYLE.torch,...torchPlacement(map,t),kind:'torch'})),
    {...SCENE_STYLE.lantern,x:party.x-Math.sin((party.facing||0)*Math.PI/2)*SCENE_STYLE.lantern.offsetZ,z:party.z+Math.cos((party.facing||0)*Math.PI/2)*SCENE_STYLE.lantern.offsetZ,y:SCENE_STYLE.lantern.height,kind:'lantern'}];
}
export const colorChannels=hex=>[(hex>>16)&255,(hex>>8)&255,hex&255];
const linear=c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
// Canvas adapter for the shared hemisphere + Lambert point-light definitions.
// Values remain linear until exposure is converted to display multipliers.
export function surfaceLight(point,normal,lights,visible=()=>true){
  const {ambient}=SCENE_STYLE,sky=colorChannels(ambient.sky).map(linear),ground=colorChannels(ambient.ground).map(linear),hemi=(normal.y+1)/2;
  const result=sky.map((v,i)=>(v*hemi+ground[i]*(1-hemi))*ambient.intensity/Math.PI);
  for(const light of lights){
    const dx=light.x-point.x,dy=light.y-point.y,dz=light.z-point.z,d=Math.hypot(dx,dy,dz);
    if(d>=light.range||!visible(light,point))continue;
    const alignment=Math.max(0,(dx*normal.x+dy*normal.y+dz*normal.z)/Math.max(.01,d));if(!alignment)continue;
    const cutoff=Math.max(0,1-(d/light.range)**4)**2;
    const strength=light.intensity*alignment*cutoff/(Math.PI*Math.max(.01,d**light.decay));
    const color=colorChannels(light.color).map(linear);for(let i=0;i<3;i++)result[i]+=color[i]*strength;
  }
  return result;
}
export function displayExposure(light){
  const factor=light.map(v=>Math.max(.01,v)**(1/2.2));
  return {multiply:factor.map(v=>Math.round(255*Math.min(1,v))),boost:factor.map(v=>Math.round(255*(v>1?1-1/v:0)))};
}
export function sceneLightVisible(map,openDoors,light,point){
  const size=SCENE_STYLE.cellMetres,dx=point.x-light.x,dz=point.z-light.z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(size/4)));
  for(let i=1;i<steps;i++){
    const x=Math.floor((light.x+dx*i/steps)/size+.5),z=Math.floor((light.z+dz*i/steps)/size+.5),cell=map.grid[z]?.[x];
    if(cell==='#'||cell==='D'&&!openDoors.has(`${x},${z}`))return false;
  }
  return true;
}
