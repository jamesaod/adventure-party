/* Loaded after the ordinary engine. Encounters reuse its units, turns and walls. */
const explorationFloorImage=new Image(),explorationWallImage=new Image(),explorationDoorImage=new Image(),explorationGrassImage=new Image(),explorationDirtImage=new Image(),explorationFringeImage=new Image(),explorationWoodWallImage=new Image();
// Offline-derived, repeating normal data for the original grass material.
const explorationGrassNormalImage=new Image();
explorationGrassNormalImage.combatRepeat=true;
explorationGrassNormalImage.src='assets/textures/exploration/grass-short-v1-normal.png';
explorationGrassNormalImage.decode().then(()=>{
  explorationGrassImage.roadNormal=explorationGrassNormalImage;
  window.dispatchEvent(new Event('adventure-party:grass-change'));
}).catch(error=>console.warn('Default grass normal map unavailable',error));
const explorationCityWallImages={'red-brick':new Image(),'beige-stone':new Image()},explorationCityWoodFloorImage=new Image();
const explorationCityFloorImages={wood:explorationCityWoodFloorImage,'gray-stone':new Image(),'gray-flagstone':new Image()};
function explorationWallImageFor(material){return explorationCityWallImages[material]||(material==='wood'?explorationWoodWallImage:explorationWallImage);}
let explorationGroundBank=null,explorationRoadBank=null;
const explorationMaterialTiles=new WeakMap();
// Filter to each material's displayed footprint, including anisotropic wall
// reduction, instead of keeping a grainy large source or a blurred fixed mip.
function explorationMaterialTile(image,targetWidth=512,targetHeight=512){
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
  if(!image.complete||!image.naturalWidth)return null;
  const max=explorationEncounterApi.SCENE_STYLE.materials.maxTilePixels;
  targetWidth=Math.min(max,Math.max(16,Math.ceil(targetWidth)));targetHeight=Math.min(max,Math.max(16,Math.ceil(targetHeight)));
  let cache=explorationMaterialTiles.get(image);if(!cache){cache=new Map();explorationMaterialTiles.set(image,cache);}
  const key=`${targetWidth}:${targetHeight}`;if(cache.has(key))return cache.get(key);
  let tile=image,width=image.naturalWidth,height=image.naturalHeight;
  while(width>targetWidth||height>targetHeight){
    const next=document.createElement('canvas');next.width=Math.max(targetWidth,Math.ceil(width/2));next.height=Math.max(targetHeight,Math.ceil(height/2));
    const target=next.getContext('2d');target.imageSmoothingEnabled=true;target.imageSmoothingQuality='high';target.drawImage(tile,0,0,next.width,next.height);
    tile=next;width=next.width;height=next.height;
  }
  if(cache.size>=16)cache.delete(cache.keys().next().value);cache.set(key,tile);return tile;
}
function explorationMaterialDensity(){return (typeof battlefieldZoom==='number'?battlefieldZoom:1)*(typeof BATTLEFIELD_RENDER_DENSITY==='number'?BATTLEFIELD_RENDER_DENSITY:1);}
// GPU surfaces retain authored world geometry. Tactical masks, grid and VFX
// remain ordered Canvas overlays, rather than becoming a single screenshot.
function drawExplorationBlackoutFloor(){
 const t=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 if(!t?.blackoutSpaces?.length)return;
 if(typeof combatGpu!=='undefined'&&combatGpu){let black=drawExplorationBlackoutFloor.tile;if(!black){black=drawExplorationBlackoutFloor.tile=document.createElement('canvas');black.width=black.height=1;const c=black.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,1,1);}combatGpu.surface(t.blackoutSpaces.map(s=>({points:s.polygon,uv:s.polygon.map(()=>[0,0])})),black,{dynamicLighting:false});}
 else{ctx.save();ctx.fillStyle='#000';for(const s of t.blackoutSpaces){const p=s.polygon.map(p=>screenPointForWorld(p));ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(const q of p.slice(1))ctx.lineTo(q.x,q.y);ctx.closePath();ctx.fill();}ctx.restore();}
}
function drawExplorationGpuFloor(tiles){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi,groups=new Map(),curbs=new Map(),t=explorationTerrain,map=explorationEncounter.map;
 combatGpu.snowScene?.(map,[(-explorationEncounter.origin.x-.5)*t.cellW,(-explorationEncounter.origin.z-.5)*t.cellH,map.width*t.cellW,map.height*t.cellH]);
 if(drawExplorationGpuFloor.snowTerrain!==t){
  const index=api.floorFragmentIndex(t.spaces,HEX_W,HEX_ROW),ground=[];
  for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++)if(inside(x,y))for(const f of index({x,y})){
   const p=worldPointForHex(f.point.x,f.point.y);if(!isIndoorWorldPoint(p))ground.push({snowEligible:1,snowHex:x+','+y,points:f.polygon});
  }
  drawExplorationGpuFloor.snowTerrain=t;drawExplorationGpuFloor.snowGround=ground;
 }
 combatGpu.snowGround?.(drawExplorationGpuFloor.snowGround);
 combatGpu.firLitter?.(game?.firBlockedHexes||t,[...(game?.firBlockedHexes||[])].map(id=>{const [x,y]=id.split(',').map(Number),decoration=game.firDecorations?.get(id),modelRadius=typeof combatFirTrees!=='undefined'?combatFirTrees?.canopyRadius?.(decoration?.tileIndex):0;return {...worldPointForHex(x,y),radius:modelRadius?modelRadius*(activeCombatTerrainTileSet().treeDrawHeight||240)/210:HEX_W*.85};}),[(-explorationEncounter.origin.x-.5)*t.cellW,(-explorationEncounter.origin.z-.5)*t.cellH,map.width*t.cellW,map.height*t.cellH],HEX_W*.85,HEX_ROW/(HEX_W*Math.sqrt(3)/2));
 const heat=[];
 // Persistent spell heat follows the live footprint; expiry removes it automatically.
 for(const sphere of flamingSphereEffects())heat.push({keys:(sphere.cells||[]).map(c=>c.x+","+c.y),rate:1.5});
 for(const fire of Object.values(game?.firFireStates||{}))if(fire.state==='burning'){
  const keys=[];for(let x=fire.x-2;x<=fire.x+2;x++)for(let y=fire.y-2;y<=fire.y+2;y++)if(hexDistance(fire,{x,y})<=1)keys.push(x+','+y);
  heat.push({keys,rate:1.5});
 }
 if(typeof r226LightningFx!=='undefined'&&r226LightningFx?.points)heat.push({keys:r226LightningFx.points.map(p=>p.x+','+p.y),rate:12});
 combatGpu.snowHeat?.(heat);
 for(const fragment of explorationFloorFragments(tiles)){
  const world=worldPointForHex(fragment.point.x,fragment.point.y),surface=api.surfaceAt(map,{x:explorationEncounter.origin.x+world.x/t.cellW,z:explorationEncounter.origin.z+world.y/t.cellH}),cell=surface.cell,kind=explorationEncounter.synthetic?(isIndoorWorldPoint(worldPointForHex(fragment.point.x,fragment.point.y))?'stone':'grass'):surface.ground;
  const image=(kind==='road'||kind==='road2'||kind==='sidewalk')?(explorationRoadBank||(explorationRoadBank=api.createRoadTileBank({base:explorationGroundBank}))).get(map,cell.x,cell.z):explorationCityFloorImages[kind]?explorationCityFloorImages[kind]:kind==='grass'?(window.adventurePartyGrass?.image||explorationGrassImage):kind==='dirt'?explorationGroundBank.get(api.grassNeighborMask(map,cell.x,cell.z)):explorationFloorImage;
  if((kind==='road'||kind==='road2'||kind==='sidewalk'))explorationRoadBank.normal(map,cell.x,cell.z);
  const m=explorationCityFloorImages[kind]?{floorWidth:t.cellW*2,floorHeight:t.cellH*2}:kind==='stone'?api.materialMetrics(t):api.grassMaterialMetrics(t);
  if(!groups.has(image))groups.set(image,[]);
  if(kind==='sidewalk'){
   const polygon=fragment.polygon,center=polygon.reduce((c,p)=>({x:c.x+p.x/polygon.length,y:c.y+p.y/polygon.length}),{x:0,y:0}),rise=.15/3*t.cellW;
   for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    const length=Math.hypot(b.x-a.x,b.y-a.y);if(length<.001)continue;
    let nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;if(nx*(mx-center.x)+ny*(my-center.y)<0){nx=-nx;ny=-ny;}
    const next=api.surfaceAt(map,{x:explorationEncounter.origin.x+(mx+nx*.02)/t.cellW,z:explorationEncounter.origin.z+(my+ny*.02)/t.cellH});
    if(next.ground==='sidewalk')continue;
    if(!curbs.has(image))curbs.set(image,[]);
    curbs.get(image).push({points:[a,b,{...b,elevation:rise},{...a,elevation:rise}],uv:[[0,0],[length/t.cellW,0],[length/t.cellW,.05],[0,.05]],tint:[.65,.60,.53],lightNormal:[nx,0,ny],visibility:explorationGpuLighting?explorationVisibilityAtHex(fragment.point,[],fragment.hex):1});
   }
  }
  groups.get(image).push({grass:kind==='grass',grassUnit:t.cellW/3,grassSquash:t.cellH/t.cellW,snowHex:`${fragment.hex.x},${fragment.hex.y}`,snowEligible:isIndoorWorldPoint(world)?0:1,points:kind==='sidewalk'?fragment.polygon.map(p=>({...p,elevation:.15/3*t.cellW})):fragment.polygon,visibility:explorationGpuLighting?explorationVisibilityAtHex(fragment.point,[],fragment.hex):1,uv:fragment.polygon.map(p=>(kind==='road'||kind==='road2'||kind==='sidewalk')?[(p.x/t.cellW+explorationEncounter.origin.x-cell.x+.5),1-(p.y/t.cellH+explorationEncounter.origin.z-cell.z+.5)]:explorationCityFloorImages[kind]?[(p.x/t.cellW+explorationEncounter.origin.x+.5)/2,(.5-p.y/t.cellH-explorationEncounter.origin.z)/2]:[(p.x+t.cellW/2)/m.floorWidth,1-(p.y+t.cellH/2)/m.floorHeight])});
 }
 const lightMap=drawExplorationIlluminationLayer(true),dynamicLighting=!!explorationGpuLighting;
 const groundScorch=dynamicLighting&&typeof drawTerrainScorch==='function'?drawTerrainScorch(true):null;
 for(const [image,group] of curbs){for(const face of group)face.lightPoints=dynamicLighting?face.points.map(explorationGpuPoint):null;combatGpu.surface(group,image,{lightMap,dynamicLighting,category:'Walls / curbs'});}
 for(const [image,group] of groups){
  for(const face of group)face.lightPoints=dynamicLighting?face.points.map(explorationGpuPoint):null;
  combatGpu.surface(group,image,{category:'Floor',grassMaterial:group.some(face=>face.grass),lightMap,dynamicLighting,groundScorch,needleLitter:true,normalMap:image.roadNormal||null});
 }
}

function explorationFaceRenderable(face){
 const t=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 if(!t?.isRenderablePoint)return true;
 if(face.cap||face.side==='end')return face.points.every(p=>t.isRenderablePoint(p));
 const p=face.points.reduce((s,p)=>({x:s.x+p.x/face.points.length,y:s.y+p.y/face.points.length}),{x:0,y:0});
 return t.isRenderablePoint({x:p.x+face.normal.x*.001*t.cellW,y:p.y+face.normal.z*.001*t.cellH});
}
function explorationWallFragmentVisible(fragment,normal,fallback,wall=null){
 if(typeof friendlyVisibilityObservers!=='function'||typeof observerVisibilityContext!=='function'||typeof pointInSimplePolygon!=='function')return fallback;
 const t=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const frame=typeof combatLightingFrame==='number'?combatLightingFrame:null;
 let cached=explorationWallFragmentVisible.cache;
 if(frame===null||cached?.frame!==frame||cached.terrain!==t){cached={frame,terrain:t,contexts:friendlyVisibilityObservers().map(o=>observerVisibilityContext(o)).filter(c=>c?.polygon?.length)};explorationWallFragmentVisible.cache=cached;}
 const p=fragment.points.reduce((s,v)=>({x:s.x+v.x/fragment.points.length,y:s.y+v.y/fragment.points.length}),{x:0,y:0}),api=typeof explorationEncounterApi==='undefined'?{}:explorationEncounterApi;
 return cached.contexts.some(context=>{
  if(wall&&context.origin&&api.wallSurfaceProbe){
   const eye=context.origin;if(normal.x*(eye.x-p.x)/t.cellW+normal.z*(eye.y-p.y)/t.cellH< -1e-8)return false;
   const neighbours=api.wallSurfaceNeighbours?api.wallSurfaceNeighbours(wall,t.walls||[wall]):[];
   return pointInSimplePolygon(api.wallSurfaceProbe(p,eye,wall,neighbours),context.polygon);
  }
  return pointInSimplePolygon({x:p.x+normal.x*.025*t.cellW/3,y:p.y+normal.z*.025*t.cellH/3},context.polygon);
 });
}
function drawExplorationGpuSolids(solids,wall,visible,cacheOwner=wall){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi,view=battlefieldViewportBounds();
 const faces=solids.flatMap(s=>s.faces).filter(face=>!api.wallFaceFacesCamera||api.wallFaceFacesCamera(face,screenPointForWorld,explorationTerrain.cellH/explorationTerrain.cellW)).map(face=>({...face,blackout:!explorationFaceRenderable(face)}));
 const all=faces.flatMap(f=>f.points.map(p=>screenPointForWorld(p,p.elevation)));
 if(!all.length||Math.max(...all.map(p=>p.x))<view.left||Math.min(...all.map(p=>p.x))>view.right||Math.max(...all.map(p=>p.y))<view.top||Math.min(...all.map(p=>p.y))>view.bottom)return;
 const dynamicLighting=typeof explorationGpuLighting!=='undefined'&&!!explorationGpuLighting;
 const lights=dynamicLighting?[]:explorationVisualLights(),opened=new Set(explorationEncounter.openDoors),sources=dynamicLighting?[]:explorationRenderLights(),t=explorationTerrain,cell=api.SCENE_STYLE.cellMetres;
 const key=JSON.stringify([lights,explorationEncounter.openDoors,(typeof explorationVisualDaylight==='function'?explorationVisualDaylight():explorationDaylight())?.revision||0,solids.map(s=>[s.a,s.b,s.depth,s.height,s.bottom,s.faces[0]?.material]),wall?.edgeMaterial,wall?.faceMaterials,typeof explorationWallGroundShadows==='function'?explorationWallGroundShadows()?.revision||0:0]);
 const cache=drawExplorationGpuSolids.cache||(drawExplorationGpuSolids.cache=new WeakMap());
 let cached=cache.get(cacheOwner);if(cached?.key!==key){cached={key,faces:new Map()};cache.set(cacheOwner,cached);}
 const white=drawExplorationGpuSolids.white||(drawExplorationGpuSolids.white=document.createElement('canvas'));
 if(!drawExplorationGpuSolids.whiteReady){white.width=white.height=1;const c=white.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,1,1);drawExplorationGpuSolids.whiteReady=true;}
 faces.sort((a,b)=>Math.max(...a.points.map(p=>screenPointForWorld(p).y))-Math.max(...b.points.map(p=>screenPointForWorld(p).y))||Number(a.cap)-Number(b.cap));
 const batches=[];
 for(const face of faces){
  if(face.blackout){batches.push({image:white,blackout:true,surfaces:[{points:face.points,uv:face.points.map(()=>[0,0]),multiply:[0,0,0],boost:[0,0,0]}]});continue;}
  const scorch=typeof combatWallScorch==='function'?combatWallScorch(wall,face):[],scorchKey=JSON.stringify(scorch);
  const a=face.points[0],b=face.points[1],dx=b.x-a.x,dy=(b.y-a.y)/(t.cellH/t.cellW),span=Math.hypot(dx,dy),low=Math.min(...face.points.map(p=>p.elevation)),high=Math.max(...face.points.map(p=>p.elevation));
  const doorTop=face.cap&&face.material==='door',wood=face.material==='door'||api.wallFaceMaterial(wall,face.side)==='wood',repeat=face.material==='door'?span:api.materialMetrics(t).wallWidth*(api.wallFaceMaterial(wall,face.side)==='beige-stone'?2:1);
  const faceKey=JSON.stringify(face.points);let fragments=cached.faces.get(faceKey);
  if(!fragments){fragments=api.faceLightFragments(face,HEX_W,HEX_ROW).map(fragment=>{
   const n=fragment.points.length,mid=fragment.points.reduce((p,q)=>({x:p.x+q.x/n,y:p.y+q.y/n,h:p.h+q.elevation/n}),{x:0,y:0,h:0});
   const exposure=explorationSurfaceExposure({x:(explorationEncounter.origin.x+mid.x/t.cellW)*cell,y:mid.h/35*api.SCENE_STYLE.wallMetres,z:(explorationEncounter.origin.z+mid.y/t.cellH)*cell},face.normal,lights,opened,true);
   return {...fragment,exposure};});cached.faces.set(faceKey,fragments);}
  const surfaces=fragments.map(fragment=>{
   const exposure=fragment.exposure,hex=fragment.point,fragmentVisible=typeof explorationWallFragmentVisible==='function'?explorationWallFragmentVisible(fragment,face.normal,visible,wall):visible,visibility=fragmentVisible?explorationVisibilityAtHex(hex,sources,fragment.hex):.1;
   let flicker=0;if(fragmentVisible&&!dynamicLighting)for(const torch of t.torches||[]){const distance=hexDistance(torch,hex);if(distance<=torch.radiusHexes&&illuminationContributionFromSource(torch,hex.x,hex.y)>0)flicker+=(explorationTorchAnimation(torch).intensity-1)*(1-distance/(torch.radiusHexes+.45));}
   flicker=Math.max(-.15,Math.min(.15,flicker));
   const radiance=fragmentVisible&&!dynamicLighting?explorationSpellRadianceAtHex(hex,sources):[0,0,0],cap=wood?[117,79,42]:[110,104,91];
   return {points:fragment.points,lightPoints:dynamicLighting?fragment.points.map(explorationGpuPoint):null,lightNormal:[face.normal.x,face.normal.y,face.normal.z],visibility:dynamicLighting?visibility:1,tint:dynamicLighting&&face.cap&&!doorTop?cap.map(v=>v/255):[1,1,1],uv:fragment.points.map(p=>doorTop?api.doorCapUv(face,p):face.cap?[0,0]:[((p.x-a.x)*dx+(p.y-a.y)/(t.cellH/t.cellW)*dy)/Math.max(.0001,span)/repeat+(wall?.textureOffset||0)/repeat,(p.elevation-low)/Math.max(.0001,high-low)*(api.wallFaceMaterial(wall,face.side)==='beige-stone'?.5:1)]),
    multiply:exposure.multiply.map((v,i)=>v/255*(dynamicLighting?1:visibility)*(flicker<0?1+flicker*.6:1)*(!dynamicLighting&&face.cap&&!doorTop?cap[i]/255:1)),boost:exposure.boost.map(v=>v/255),
    add:radiance.map((v,i)=>v+[255,172,70][i]/255*Math.max(0,flicker)*.2*visibility)};
  });
  const image=face.cap&&!doorTop?white:face.material==='door'?explorationDoorImage:explorationWallImageFor(api.wallFaceMaterial(wall,face.side)),last=batches.at(-1);
  if(last?.image===image&&!last.blackout&&last.scorchKey===scorchKey)last.surfaces.push(...surfaces);else batches.push({image,surfaces,scorch,scorchKey});
 }
 for(const batch of batches)combatGpu.surface(batch.surfaces,batch.image,{category:'Walls / curbs',dynamicLighting:dynamicLighting&&!batch.blackout,scorch:batch.scorch,scorchSquash:t.cellH/t.cellW});
}
// Material helpers extend the shared architectural renderer; gameplay uses its
// existing walls, movement, LOS, lights and depth ordering.
function explorationFloorPatternForView(outdoor=false){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
  const image=outdoor?(window.adventurePartyGrass?.image||explorationGrassImage):explorationFloorImage;
  if(!image.complete||!image.naturalWidth)return null;
  const m=outdoor?explorationEncounterApi.grassMaterialMetrics(explorationTerrain):explorationEncounterApi.materialMetrics(explorationTerrain),density=explorationMaterialDensity();
  const tile=explorationMaterialTile(image,m.floorWidth*density,m.floorHeight*density),pattern=ctx.createPattern(tile,'repeat');if(!pattern)return null;
  const origin=screenPointForWorld({x:-explorationTerrain.cellW/2,y:-explorationTerrain.cellH/2}),u=battlefieldProjectVector({x:m.floorWidth,y:0}),v=battlefieldProjectVector({x:0,y:m.floorHeight});
  pattern.setTransform(new DOMMatrix([u.x/tile.width,u.y/tile.width,v.x/tile.height,v.y/tile.height,origin.x,origin.y]));return pattern;
}
function explorationWallPattern(target,wall,height){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
  const image=explorationWallImageFor(explorationEncounterApi.wallFaceMaterial(wall));
  if(!image.complete||!image.naturalWidth)return null;
  const m=explorationEncounterApi.materialMetrics(explorationTerrain,height),density=explorationMaterialDensity();
  const tile=explorationMaterialTile(image,m.wallWidth*density,m.wallHeight*density),pattern=target.createPattern(tile,'repeat');if(!pattern)return null;
  const origin=screenPointForWorld(wall.a),worldOrigin=screenPointForWorld({x:0,y:0});
  pattern.setTransform(new DOMMatrix([m.wallWidth/tile.width,0,0,m.wallHeight/tile.height,worldOrigin.x,origin.y-m.wallHeight]));return pattern;
}
// One affine lighting strip per broad face keeps per-hex brightness without
// repeatedly clipping/restoring the texture along internal hex boundaries.
function drawExplorationFaceBands(target,face,fragments,colors,mode){
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi;if(face.cap||!api.wallLightBandRuns)return false;
 const neutral=mode==='multiply'?255:0;if(colors.every(c=>c.every(v=>v===neutral)))return true;
 const span=Math.hypot(face.screen[2].x-face.screen[3].x,face.screen[2].y-face.screen[3].y);
 const width=Math.min(2048,Math.max(1,Math.ceil(span*explorationMaterialDensity())));
 const strip=drawExplorationFaceBands.strip||(drawExplorationFaceBands.strip=document.createElement('canvas'));if(strip.width!==width)strip.width=width;if(strip.height!==1)strip.height=1;
 const paint=strip.getContext('2d');paint.globalCompositeOperation='source-over';
 for(const run of api.wallLightBandRuns(face,fragments,width)){paint.fillStyle=`rgb(${colors[run.index].map(v=>Math.round(Math.max(0,Math.min(255,v)))).join(',')})`;paint.fillRect(run.start,0,run.end-run.start,1);}
 const a=face.screen[3],b=face.screen[2],c=face.screen[0];target.save();target.globalCompositeOperation=mode;target.imageSmoothingEnabled=false;
 target.transform((b.x-a.x)/width,(b.y-a.y)/width,c.x-a.x,c.y-a.y,a.x,a.y);target.drawImage(strip,0,0);target.restore();return true;
}
// Project each solid face independently: ground rotates, vertical edges stay vertical.
function drawExplorationSolids(solids,wall,visible=true,cacheOwner=wall){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 if(typeof combatGpu!=="undefined"&&combatGpu)return drawExplorationGpuSolids(solids,wall,visible,cacheOwner);
 const api=explorationEncounterApi,faces=solids.flatMap(s=>s.faces).filter(face=>!api.wallFaceFacesCamera||api.wallFaceFacesCamera(face,screenPointForWorld,explorationTerrain.cellH/explorationTerrain.cellW)).map(face=>({...face,blackout:!explorationFaceRenderable(face),screen:face.points.map(p=>screenPointForWorld(p,p.elevation))}));
 const all=faces.flatMap(f=>f.screen);if(!all.length)return;
 const left=Math.floor(Math.min(...all.map(p=>p.x)))-2,top=Math.floor(Math.min(...all.map(p=>p.y)))-2,width=Math.ceil(Math.max(...all.map(p=>p.x))-left)+2,height=Math.ceil(Math.max(...all.map(p=>p.y))-top)+2,v=battlefieldViewportBounds();
 if(left+width<v.left||left>v.right||top+height<v.top||top>v.bottom)return;
 const lights=explorationVisualLights(),opened=new Set(explorationEncounter.openDoors),cell=api.SCENE_STYLE.cellMetres,squash=explorationTerrain.cellH/explorationTerrain.cellW;
 const cache=drawExplorationSolids.cache||(drawExplorationSolids.cache=new WeakMap()),key=JSON.stringify([typeof battlefieldRotation==='number'?battlefieldRotation:0,explorationMaterialDensity(),lights,(typeof explorationVisualDaylight==='function'?explorationVisualDaylight():explorationDaylight())?.revision||0,explorationEncounter.openDoors,explorationFloorImage.naturalWidth,explorationWallImage.naturalWidth,explorationDoorImage.naturalWidth]);
 const anchor=screenPointForWorld(solids[0].a),prior=cache.get(cacheOwner);
 if(prior?.key===key){presentExplorationSolids(prior,prior.left+anchor.x-prior.anchor.x,prior.top+anchor.y-prior.anchor.y,visible);return;}
 const layer=document.createElement('canvas');layer.width=width;layer.height=height;const target=layer.getContext('2d');target.translate(-left,-top);target.imageSmoothingEnabled=true;target.imageSmoothingQuality='high';
 // The nearer vertical face covers the far face; top caps finish each solid.
 faces.sort((a,b)=>Math.max(...a.points.map(p=>screenPointForWorld(p).y))-Math.max(...b.points.map(p=>screenPointForWorld(p).y))||Number(a.cap)-Number(b.cap));
 for(const face of faces){
  const points=face.screen;target.save();target.beginPath();target.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))target.lineTo(p.x,p.y);target.closePath();target.clip();
  if(face.blackout){target.fillStyle='#000';target.fillRect(left,top,width,height);target.restore();continue;}
  const image=face.material==='door'?explorationDoorImage:explorationWallImageFor(api.wallFaceMaterial(wall,face.side));
  const span=Math.hypot(face.points[1].x-face.points[0].x,(face.points[1].y-face.points[0].y)/squash),h=Math.abs(face.points[3].elevation-face.points[0].elevation);
  if(!face.cap&&span>.001&&h>.001){
   const density=explorationMaterialDensity(),metrics=api.materialMetrics(explorationTerrain),repeat=face.material==='door'?span:metrics.wallWidth*(api.wallFaceMaterial(wall,face.side)==='beige-stone'?2:1);
   const tile=explorationMaterialTile(image,repeat*density,h*density),pattern=tile&&target.createPattern(tile,'repeat');
   if(pattern){const a=points[3],b=points[2];pattern.setTransform(new DOMMatrix([(b.x-a.x)/span*repeat/tile.width,(b.y-a.y)/span*repeat/tile.width,0,h/tile.height*(api.wallFaceMaterial(wall,face.side)==='beige-stone'?2:1),a.x,a.y]));target.fillStyle=pattern;}else target.fillStyle=face.material==='door'?'#855025':'#8a775d';
  }else target.fillStyle=face.material==='door'?'#b3844b':'#6e685b';
  target.fillRect(left,top,width,height);
  const lighting=(api.faceLightFragments?api.faceLightFragments(face,HEX_W,HEX_ROW):[face]).map(fragment=>{
   const n=fragment.points.length,mid=fragment.points.reduce((p,q)=>({x:p.x+q.x/n,y:p.y+q.y/n,h:p.h+q.elevation/n}),{x:0,y:0,h:0});
   const point={x:(explorationEncounter.origin.x+mid.x/explorationTerrain.cellW)*cell,y:mid.h/35*api.SCENE_STYLE.wallMetres,z:(explorationEncounter.origin.z+mid.y/explorationTerrain.cellH)*cell};
   return {...fragment,exposure:explorationSurfaceExposure(point,face.normal,lights,opened)};
  });
  if(!face.cap&&api.wallLightBandRuns){
   drawExplorationFaceBands(target,face,lighting,lighting.map(f=>f.exposure.multiply),'multiply');
   drawExplorationFaceBands(target,face,lighting,lighting.map(f=>f.exposure.boost),'color-dodge');
  }else for(const fragment of lighting){
   target.save();const polygon=fragment.points.map(p=>screenPointForWorld(p,p.elevation));target.beginPath();target.moveTo(polygon[0].x,polygon[0].y);for(const p of polygon.slice(1))target.lineTo(p.x,p.y);target.closePath();target.clip();
   for(const [mode,color] of [['multiply',fragment.exposure.multiply],['color-dodge',fragment.exposure.boost]]){target.globalCompositeOperation=mode;target.fillStyle=`rgb(${color.join(',')})`;target.fillRect(left,top,width,height);}target.restore();
  }
  target.restore();target.beginPath();target.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))target.lineTo(p.x,p.y);target.closePath();// Shared wall edges have no decorative highlight stroke.
 }
 const fragments=faces.flatMap((face,faceIndex)=>api.faceLightFragments?api.faceLightFragments(face,HEX_W,HEX_ROW).map(f=>({...f,faceIndex,screen:f.points.map(p=>screenPointForWorld(p,p.elevation))})):[face]);
 let blackoutMask=null;if(faces.some(f=>f.blackout)){blackoutMask=document.createElement('canvas');blackoutMask.width=width;blackoutMask.height=height;const m=blackoutMask.getContext('2d');m.translate(-left,-top);m.fillStyle='#000';for(const face of faces){m.globalCompositeOperation=face.blackout?'source-over':'destination-out';const p=face.screen;m.beginPath();m.moveTo(p[0].x,p[0].y);for(const q of p.slice(1))m.lineTo(q.x,q.y);m.closePath();m.fill();}}
 const entry={key,layer,left,top,anchor,faces,fragments,blackoutMask};cache.set(cacheOwner,entry);
 presentExplorationSolids(entry,left,top,visible);
}
function explorationTorchAnimation(torch,now=null){
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi;if(!api?.torchAnimation)return {intensity:1,height:1,width:1,swayX:0,swayZ:0};
 const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 return api.torchAnimation(now??(typeof performance!=='undefined'?performance.now():0),torch.seed||0,reduced);
}
function explorationRenderLights(){
 const frame=typeof combatLightingFrame==='number'?combatLightingFrame:null;
 if(frame!==null&&explorationRenderLights.frame===frame)return explorationRenderLights.sources;
 const sources=(typeof illuminationSources==='function'?illuminationSources():[]).concat(typeof combatSpellEffectLights==='function'?combatSpellEffectLights():[]).map(source=>source.visualScale===undefined&&!source.visualPosition?source:{...source,...(source.visualPosition||{}),intensity:source.intensity*(source.visualScale??1)});
 explorationRenderLights.frame=frame;explorationRenderLights.sources=sources;return sources;
}
function explorationFloorFragments(tiles){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi;
 if(!api?.floorFragmentIndex||!explorationTerrain?.spaces)return tiles.map(tile=>({point:tile,hex:tile,screen:hexScreenVertices(tile.x,tile.y)}));
 if(explorationFloorFragments.terrain!==explorationTerrain){explorationFloorFragments.terrain=explorationTerrain;explorationFloorFragments.index=api.floorFragmentIndex(explorationTerrain.spaces,HEX_W,HEX_ROW);}
 if(explorationFloorFragments.tiles===tiles)return explorationFloorFragments.projected;
 explorationFloorFragments.tiles=tiles;return explorationFloorFragments.projected=tiles.flatMap(tile=>explorationFloorFragments.index(tile).map(f=>({...f,screen:f.polygon.map(p=>screenPointForWorld(p))})));
}
function explorationFriendlyDistance(point){
 const observers=typeof friendlyVisibilityObservers==='function'?friendlyVisibilityObservers():[game?.player].filter(u=>u?.alive&&!u.fled);
 return observers.length?Math.min(...observers.map(u=>hexDistance(u,point))):0;
}
function explorationAuthoredSurface(hex){
 const t=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain,c=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter,p=worldPointForHex(hex.x,hex.y);
 return explorationEncounterApi.surfaceAt(c.map,{x:c.origin.x+p.x/t.cellW,z:c.origin.z+p.y/t.cellH});
}
function explorationVisibilityAtHex(point,sources=null,distancePoint=point){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi;if(!api?.tileDistanceVisibility)return 1;
 const distance=explorationFriendlyDistance(distancePoint);if(distance<api.DISTANCE_VISIBILITY.startHex)return 1;
 const p=explorationTerrain.cellAt(point.x,point.y),ambient=explorationEncounter.synthetic?combatRenderAmbientAtHex(point):explorationAuthoredSurface(point).ambient;if(ambient>=100)return 1;
 let light=typeof explorationDaylightAtHex==='function'?explorationDaylightAtHex(point):0;for(const source of sources||explorationRenderLights())light+=illuminationContributionFromSource(source,point.x,point.y)*(source.sourceKind==='torch'?explorationTorchAnimation(source).intensity:1);
 return api.tileDistanceVisibility(distance,ambient,light);
}
function presentExplorationSolids(entry,x,y,visible){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 let layer=entry.layer;
 if(visible){
  const sources=explorationRenderLights(),torches=explorationTerrain.torches||[];
  const shades=(entry.fragments||entry.faces).map(face=>{
   const n=face.points.length,p=face.points.reduce((a,b)=>({x:a.x+b.x/n,y:a.y+b.y/n}),{x:0,y:0}),hex=face.point||{x:p.x/HEX_W-p.y/(2*HEX_ROW),y:p.y/HEX_ROW};
   const visibility=explorationVisibilityAtHex(hex,sources,face.hex||hex);let flicker=0;
   for(const torch of torches){const distance=hexDistance(torch,hex);if(distance<=torch.radiusHexes&&illuminationContributionFromSource(torch,hex.x,hex.y)>0)flicker+=(explorationTorchAnimation(torch).intensity-1)*(1-distance/(torch.radiusHexes+.45));}
   const radiance=typeof explorationSpellRadianceAtHex==='function'?explorationSpellRadianceAtHex(hex,sources):[0,0,0];
   return {face,visibility,radiance,flicker:Math.max(-.15,Math.min(.15,flicker))};
  });
  if(shades.some(s=>s.visibility<1||Math.abs(s.flicker)>.001||s.radiance.some(v=>v>0))){
   layer=entry.present||(entry.present=document.createElement('canvas'));layer.width=entry.layer.width;layer.height=entry.layer.height;const t=layer.getContext('2d');t.drawImage(entry.layer,0,0);t.translate(-entry.left,-entry.top);
   if(explorationEncounterApi.wallLightBandRuns){
    for(const [faceIndex,face] of entry.faces.entries()){
     if(face.cap)continue;
     const group=shades.filter(s=>s.face.faceIndex===faceIndex);if(!group.length)continue;
     t.save();const p=face.screen;t.beginPath();t.moveTo(p[0].x,p[0].y);for(const q of p.slice(1))t.lineTo(q.x,q.y);t.closePath();t.clip();
     t.globalCompositeOperation='source-over';t.drawImage(entry.layer,entry.left,entry.top);
     const fragments=group.map(s=>s.face),multiply=group.map(s=>Array(3).fill(255*s.visibility*(s.flicker<0?1+s.flicker*.6:1))),add=group.map(s=>s.radiance.map((v,i)=>255*v+([255,172,70][i])*Math.max(0,s.flicker)*.2*s.visibility));
     drawExplorationFaceBands(t,face,fragments,multiply,'multiply');drawExplorationFaceBands(t,face,fragments,add,'lighter');t.restore();
    }
   }
   for(const shade of shades){
    if(explorationEncounterApi.wallLightBandRuns&&!shade.face.cap&&shade.face.faceIndex!==undefined)continue;
    t.save();const p=shade.face.screen;t.beginPath();t.moveTo(p[0].x,p[0].y);for(const q of p.slice(1))t.lineTo(q.x,q.y);t.closePath();t.clip();
    // Restore the cached surface under each face: overlapping front/back/cap
    // polygons must not multiply distance darkness more than once.
    t.globalCompositeOperation='source-over';t.drawImage(entry.layer,entry.left,entry.top);
    const darkness=1-shade.visibility;if(darkness>0){t.fillStyle=`rgba(0,0,0,${darkness})`;t.fillRect(entry.left,entry.top,layer.width,layer.height);}
    if(shade.flicker<0){t.fillStyle=`rgba(0,0,0,${-shade.flicker*.6})`;t.fillRect(entry.left,entry.top,layer.width,layer.height);}else if(shade.flicker>0){t.globalCompositeOperation='lighter';t.fillStyle=`rgba(255,172,70,${shade.flicker*.2*shade.visibility})`;t.fillRect(entry.left,entry.top,layer.width,layer.height);}
    if(shade.radiance.some(v=>v>0)){t.globalCompositeOperation='lighter';t.fillStyle=`rgb(${shade.radiance.map(v=>Math.round(Math.min(1,v)*255)).join(',')})`;t.fillRect(entry.left,entry.top,layer.width,layer.height);}
    t.restore();
   }
  }
 }
 if(!visible){
  // Darkness is a color treatment, not transparency: otherwise the floor
  // grid behind a solid rear wall is visible through the masonry.
  if(!entry.hidden){
   const hidden=entry.hidden=document.createElement('canvas');hidden.width=entry.layer.width;hidden.height=entry.layer.height;
   const t=hidden.getContext('2d');t.drawImage(entry.layer,0,0);t.globalCompositeOperation='source-atop';t.fillStyle='rgba(0,0,0,.9)';t.fillRect(0,0,hidden.width,hidden.height);
  }layer=entry.hidden;
 }
 ctx.save();ctx.globalAlpha=1;ctx.drawImage(layer,x,y);if(entry.blackoutMask)ctx.drawImage(entry.blackoutMask,x,y);ctx.restore();
}
function explorationSpellRadianceAtHex(point,sources=null){
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi;if(!api?.spellSurfaceRadiance)return [0,0,0];
 return api.spellSurfaceRadiance(point,sources||explorationRenderLights(),(source,p)=>illuminationContributionFromSource(source,p.x,p.y));
}
// Clip each emitter continuously. A floor sliver remains lit even if its hex
// center is behind a wall; closed doors/windows use the production light mode.
function clipExplorationEmitter(source){
 if(game?.condition!=='wall'||typeof wallTestVisibilityPolygonWorld!=='function')return;
 const polygon=wallTestVisibilityPolygonWorld(source,'light');
 if(polygon?.length&&tracePolygonOnContext(ctx,polygon.map(p=>screenPointForWorld(p))))ctx.clip();
}
function explorationUnblockedContribution(source,point){
 const distance=hexDistance(source,point),radius=Math.max(1,source.radiusHexes||1);
 if(distance>radius||typeof hasObscuringMagicAtHex==='function'&&hasObscuringMagicAtHex(point.x,point.y))return 0;
 return Math.max(0,source.intensity||0)*(1-Math.min(1,distance/(radius+.45))**2);
}
function drawExplorationSpellLighting(tiles){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 if(typeof explorationGpuLighting!=='undefined'&&explorationGpuLighting)return;
 if(!explorationTerrain||!explorationEncounterApi?.spellSurfaceRadiance)return;
 const sources=explorationRenderLights().filter(s=>s.sourceKind!=='torch');if(!sources.length)return;
 const fragments=explorationFloorFragments(tiles);
 ctx.save();ctx.globalCompositeOperation='lighter';
 for(const source of sources){
  ctx.save();clipExplorationEmitter(source);
  for(const fragment of fragments){
   // All floor fragments owned by a hex share one fire/spell-light value.
   const rgb=explorationEncounterApi.spellSurfaceRadiance(fragment.hex||fragment.point,[source],(s,p)=>explorationUnblockedContribution(s,p));if(!rgb.some(v=>v>0))continue;
   if(tracePolygonOnContext(ctx,fragment.screen)){ctx.fillStyle=`rgb(${rgb.map(v=>Math.round(Math.min(1,v)*255)).join(',')})`;ctx.fill();}
  }ctx.restore();
 }ctx.restore();
}
function hasAnimatedExplorationTorches(){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 return !!(explorationTerrain&&(explorationTerrain.torches?.length||(game?.areaEffects||[]).some(e=>e.type==='flaming-sphere')))&&!(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function explorationWallGroundSolids(wall){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 if(wall.doorLeaf)return []; // The wooden solid owns the closed-door leaf artwork.
 const api=explorationEncounterApi,squash=explorationTerrain.cellH/explorationTerrain.cellW,depth=wall.thickness||3,height=wall.height||35,solids=[];
 const make=(a,b,h=height,bottom=0)=>solids.push(api.joinedWallPrism?api.joinedWallPrism(wall,explorationTerrain.walls||[wall],a,b,depth,h,bottom,squash):api.solidPrism(a,b,depth,h,bottom,squash));
 const openings=wall.openings||[],length=Math.hypot(wall.b.x-wall.a.x,wall.b.y-wall.a.y),at=t=>({x:wall.a.x+(wall.b.x-wall.a.x)*t,y:wall.a.y+(wall.b.y-wall.a.y)*t});
 for(const part of wallBlockingSubsegments(wall,'los'))make(part.a,part.b);
 for(const opening of openings){
  if(opening.type!=='window'&&opening.type!=='doorway')continue;
  const center=wallOpeningCenterT(wall,opening),span=opening.type==='window'?(opening.glassWidthWorld||opening.widthWorld||1):(opening.widthWorld||1),lo=Math.max(0,center-span/length/2),hi=Math.min(1,center+span/length/2);
  if(opening.type==='window'){
   const sill=opening.visualSill||10,head=sill+(opening.visualHeight||14);
   make(at(lo),at(hi),sill);make(at(lo),at(hi),height,head);
  }else make(at(lo),at(hi),height,explorationEncounterApi.SCENE_STYLE.door.height/explorationEncounterApi.SCENE_STYLE.wallMetres*height);
 }

 return solids;
}
function drawExplorationWallPrism(wall){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const solids=explorationWallGroundSolids(wall);if(!solids.length)return;

 drawExplorationSolids(solids,wall,isArchitecturalWallVisibleToFriendlyParty(wall));
 for(const torch of explorationTerrain.torches||[])if(torch.mountWallId===wall.id&&isHexVisibleToFriendlyParty((torch.visibilityHex||torch).x,(torch.visibilityHex||torch).y)){
  const mount=screenPointForWorld(torch.world),plate=screenPointForWorld(torch.wallPlaneWorld||torch.plateWorld);if(mount.y>=plate.y-.01)drawExplorationTorch(torch);
 }
}
function drawExplorationCombatDoor(door){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi,solid=api.combatDoorSolids(door,explorationTerrain,api.SCENE_STYLE),wall=explorationDoorWall(door);
 drawExplorationSolids([solid.leaf,solid.lintel],wall,isArchitecturalWallVisibleToFriendlyParty(wall),door);
}

function explorationDoorWall(door){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const {center:c,axis}=door,t=explorationTerrain;
 return {id:door.wallId||`door-${door.x}-${door.z}`,edgeMaterial:door.material,faceMaterials:door.faceMaterials,a:axis==='x'?{x:c.x,y:c.y-t.cellH/2}:{x:c.x-t.cellW/2,y:c.y},b:axis==='x'?{x:c.x,y:c.y+t.cellH/2}:{x:c.x+t.cellW/2,y:c.y}};
}
function drawExplorationEdgeWindow(window){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const style=explorationEncounterApi.SCENE_STYLE,height=style.window.height/style.wallMetres*35,sill=style.window.sill/style.wallMetres*35,span=(window.axis==='x'?explorationTerrain.cellH:explorationTerrain.cellW)*window.width;
 const a={x:window.center.x-(window.axis==='x'?0:span/2),y:window.center.y-(window.axis==='x'?span/2:0)},b={x:window.center.x+(window.axis==='x'?0:span/2),y:window.center.y+(window.axis==='x'?span/2:0)};
 const p=[screenPointForWorld(a,sill),screenPointForWorld(b,sill),screenPointForWorld(b,sill+height),screenPointForWorld(a,sill+height)];
 ctx.save();ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(const point of p.slice(1))ctx.lineTo(point.x,point.y);ctx.closePath();ctx.fillStyle='rgba(105,141,146,.28)';if(!window.broken)ctx.fill();ctx.strokeStyle='#493b2a';ctx.lineWidth=1.5;ctx.stroke();
 const low=screenPointForWorld(window.center,sill),high=screenPointForWorld(window.center,sill+height);ctx.beginPath();ctx.moveTo(low.x,low.y);ctx.lineTo(high.x,high.y);ctx.stroke();ctx.restore();
}
function queueExplorationDoors(actors){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 for(const space of explorationTerrain.blackoutSpaces||[]){
  const points=space.polygon.map(p=>({...p,elevation:35}));
  const screen=points.map(p=>screenPointForWorld(p));
  const depth=screen.reduce((near,p)=>p.y>near.y?p:near);
  actors.push({gpuScenery:true,sortY:depth.y+.24,sortX:depth.x,fn:()=>{
   if(typeof combatGpu!=='undefined'&&combatGpu){
    const black=drawExplorationBlackoutFloor.tile;
    combatGpu.surface([{points,uv:points.map(()=>[0,0])}],black,{dynamicLighting:false});
   }else{
    ctx.save();ctx.fillStyle='#000';
    if(tracePolygonOnContext(ctx,points.map(p=>screenPointForWorld(p,p.elevation))))ctx.fill();
    ctx.restore();
   }
  }});
 }
 for(const window of explorationTerrain.windows||[])if(isArchitecturalWallVisibleToFriendlyParty(explorationDoorWall(window))){const c=screenPointForWorld(window.center);actors.push({sortY:c.y+.3,sortX:c.x,fn:()=>drawExplorationEdgeWindow(window)});}

 for(const door of explorationTerrain.doors||[]){
  const p=explorationEncounterApi.combatDoorSolids(door,explorationTerrain,explorationEncounterApi.SCENE_STYLE),a=screenPointForWorld(p.hinge),b=screenPointForWorld(p.end);
  actors.push({outlineSolids:[p.leaf,p.lintel],gpuScenery:true,sortY:Math.max(a.y,b.y)+.3,sortX:(a.x+b.x)/2,fn:()=>drawExplorationCombatDoor(door)});
 }
}
function clipExplorationFloor(){
  const spaces=typeof combatSceneTerrain!=='undefined'&&combatSceneTerrain?combatSceneTerrain.spaces:architecturalSpaces;
  const origin=screenPointForWorld({x:0,y:0}),x=screenPointForWorld({x:1,y:0}),y=screenPointForWorld({x:0,y:1});
  const key=[origin.x,origin.y,x.x,x.y,y.x,y.y].join(',');
  let cache=clipExplorationFloor.cache;
  if(!cache||cache.spaces!==spaces||cache.length!==spaces.length||cache.key!==key){
    const path=new Path2D();
    for(const space of spaces){const points=space.polygon.map(p=>screenPointForWorld(p));if(!points.length)continue;path.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)path.lineTo(points[i].x,points[i].y);path.closePath();}
    cache=clipExplorationFloor.cache={spaces,length:spaces.length,key,path};
  }
  ctx.clip(cache.path);
}
function drawExplorationDarknessVolumes(){
  if(typeof r222DrawDarknessVolume!=='function')return;
  for(const effect of game.areaEffects||[])if(effect?.type==='darkness')r222DrawDarknessVolume(effect);
}
function drawExplorationVisibilityMask(){
  const architectural=typeof game==='undefined'||game?.condition==='wall';
  if(!architectural&&!hasActiveObscuringLosVolume())return;
  const observers=friendlyVisibilityObservers().map(observer=>({observer,context:observerVisibilityContext(observer)})).filter(e=>e.context||!architectural);
  const mask=drawExplorationVisibilityMask.canvas||(drawExplorationVisibilityMask.canvas=document.createElement('canvas'));
  const v=battlefieldViewportBounds(),left=Math.floor(v.left)-2,top=Math.floor(v.top)-2,width=Math.ceil(v.right-left)+2,height=Math.ceil(v.bottom-top)+2;
  if(mask.width!==width||mask.height!==height){mask.width=width;mask.height=height;}
  const target=mask.getContext('2d');target.clearRect(0,0,mask.width,mask.height);target.globalCompositeOperation='source-over';target.fillStyle='rgba(8,8,12,0.90)';target.fillRect(0,0,mask.width,mask.height);
  target.save();target.translate(-left,-top);target.globalCompositeOperation='destination-out';target.fillStyle='#000';
  if(!architectural)target.fillRect(left,top,width,height);
  else for(const entry of observers)if(tracePolygonOnContext(target,entry.context.polygon.map(point=>screenPointForWorld(point))))target.fill();
  // Obscuring spell volumes retain their tactical visibility behavior.
  if(hasActiveObscuringLosVolume()){
    target.globalCompositeOperation='source-over';target.fillStyle='#08080c';
    for(const tile of visibleHexes())if(observers.every(e=>obscuringVolumeBlocksLineBetweenHexes(e.observer,tile))&&tracePolygonOnContext(target,hexScreenVertices(tile.x,tile.y)))target.fill();
  }
  target.restore();target.globalCompositeOperation='source-over';ctx.drawImage(mask,left,top);
}
// A separate floor-only distance layer. Architecture/creature concealment stays in LOS.
function drawDistanceVisibilityLayer(tiles){
 if(typeof explorationGpuLighting!=='undefined'&&explorationGpuLighting)return;
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 if(!explorationTerrain||!explorationEncounterApi?.tileDistanceVisibility)return;
 const api=explorationEncounterApi,sources=explorationRenderLights();
 ctx.save();
 // Preserve the separate unseen-room presentation: fade only within party LOS.
 if(game.condition==='wall'){
  ctx.beginPath();for(const observer of friendlyVisibilityObservers()){
   const polygon=observerVisibilityContext(observer)?.polygon;if(!polygon?.length)continue;
   const points=polygon.map(p=>screenPointForWorld(p));ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();
  }ctx.clip();
 }
 for(const fragment of explorationFloorFragments(tiles)){
  const tile=fragment.point,distance=explorationFriendlyDistance(fragment.hex);if(distance<api.DISTANCE_VISIBILITY.startHex)continue;
  const p=explorationTerrain.cellAt(tile.x,tile.y),ambient=explorationEncounter.synthetic?combatRenderAmbientAtHex(tile):explorationAuthoredSurface(tile).ambient;if(ambient>=100)continue;
  const visibility=explorationVisibilityAtHex(tile,sources,fragment.hex);if(visibility>=1)continue;
  if(tracePolygonOnContext(ctx,fragment.screen)){ctx.fillStyle=`rgba(0,0,0,${1-visibility})`;ctx.fill();}
 }
 ctx.restore();
}
// The perspective renderer and this canvas adapter read one authored lighting
// profile, including the party lantern, exact torch mounts and metre falloff.
function explorationVisualLights(){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
  const api=explorationEncounterApi,cell=api.SCENE_STYLE.cellMetres,lanternUnit=(game.session?.controlledActorId&&getUnitById(game.session.controlledActorId))||game.player,p=worldPointForHex(lanternUnit.x,lanternUnit.y),origin=explorationEncounter.origin;
  const party={x:(origin.x+p.x/explorationTerrain.cellW)*cell,z:(origin.z+p.y/explorationTerrain.cellH)*cell,facing:explorationEncounter.position?.facing||0};
  const lights=api.sceneLights(explorationEncounter.map,party).map((light,index)=>{
   if(light.kind!=='torch')return light;
   const torch=explorationTerrain.torches?.find(t=>t.sourceIndex===index);
   const position=torch?.lightPosition||api.combatTorchLightPlacement?.(light,explorationTerrain,api.SCENE_STYLE).point;
   return position?{...light,...position}:light;
  });

  return lights.filter(light=>light.kind!=='lantern');
}
function explorationUnitSpriteBrightness(unit){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi;if(!explorationTerrain||!api?.spriteSurfaceBrightness)return 1;
 const world=worldPointForHex(unit.x,unit.y),cell=api.SCENE_STYLE.cellMetres;
 const point={x:(explorationEncounter.origin.x+world.x/explorationTerrain.cellW)*cell,y:0,z:(explorationEncounter.origin.z+world.y/explorationTerrain.cellH)*cell};
 const exposure=explorationSurfaceExposure(point,{x:0,y:1,z:0},explorationVisualLights(),new Set(explorationEncounter.openDoors));
 const sources=explorationRenderLights();
 return api.spriteSurfaceBrightness(exposure,explorationVisibilityAtHex(unit,sources),explorationSpellRadianceAtHex(unit,sources));
}
function explorationDaylight(){
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi;if(!api?.buildDaylightField||!explorationEncounter?.map||explorationEncounter.synthetic)return null;
 const map=explorationEncounter.map,doors=explorationEncounter.openDoors,old=explorationDaylight.cache;
 if(old&&old.map===map&&old.environment===map.environment&&old.ambient===map.ambientLight&&old.edges===map.edges&&old.quarters===map.quarterWalls&&old.grid===map.grid&&old.doors===doors)return old;
 const field=api.buildDaylightField(map,new Set(doors));
 return explorationDaylight.cache={map,environment:map.environment,ambient:map.ambientLight,edges:map.edges,quarters:map.quarterWalls,grid:map.grid,doors,field,revision:(old?.revision||0)+1};
}
// Presentation-only solar field. Tactical illumination keeps the original
// daylight field, so this experimental clock does not alter targeting rules.
function explorationVisualDaylight(){
 const source=explorationDaylight(),solar=globalThis.adventurePartySolar?.state?.();if(!solar||(!solar.lightingKey&&solar.hour===12))return source;if(!source)return {field:null,revision:'solar:'+(solar.lightingKey??solar.hour)};
 const old=explorationVisualDaylight.cache;if(old?.source===source&&old.hour===(solar.lightingKey??solar.hour))return old;
 const encounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 return explorationVisualDaylight.cache={source,hour:solar.lightingKey??solar.hour,field:explorationEncounterApi.buildDaylightField(encounter.map,new Set(encounter.openDoors),solar),revision:source.revision+':solar:'+(solar.lightingKey??solar.hour)};
}
function explorationDaylightVisible(light,point){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi;
 if(typeof architecturalWallBlocksWorldLine==='function'){
  const toWorld=v=>({x:(v.x/api.SCENE_STYLE.cellMetres-explorationEncounter.origin.x)*explorationTerrain.cellW,y:(v.z/api.SCENE_STYLE.cellMetres-explorationEncounter.origin.z)*explorationTerrain.cellH});
  return !architecturalWallBlocksWorldLine(toWorld(light),toWorld(point),'light');
 }
 return api.sceneLightVisible(explorationEncounter.map,new Set(explorationEncounter.openDoors),light,point);
}
function explorationAmbientIlluminationAtHex(x,y){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi,p=explorationTerrain.cellAt(x,y),map=explorationEncounter.map,surface=explorationAuthoredSurface({x,y}),amount=surface.ambient/100;
 const base=surface.environment==='outdoor'?Math.max(.02,amount):ILLUMINATION_RULES.indoorAmbient+(1-ILLUMINATION_RULES.indoorAmbient)*amount;
 return Math.min(1,base+explorationDaylightAtHex({x,y}));
}
function explorationDaylightAtHex(hex){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const field=explorationDaylight()?.field;if(!field)return 0;
 const p=worldPointForHex(hex.x,hex.y),cell=explorationEncounterApi.SCENE_STYLE.cellMetres;
 return field.sample({x:(explorationEncounter.origin.x+p.x/explorationTerrain.cellW)*cell,y:0,z:(explorationEncounter.origin.z+p.y/explorationTerrain.cellH)*cell},{x:0,y:1,z:0},explorationDaylightVisible).relief;
}
function explorationWallGroundShadows(){
 const terrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const encounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi,solar=globalThis.adventurePartySolar?.state?.(),enabled=globalThis.adventurePartySolar?.wallShadows?.()!==false;
 if(!terrain||!encounter||!solar||!api?.cachedWallGroundShadows||!enabled)return null;
 const frame=typeof combatLightingFrame==='number'?combatLightingFrame:null,old=explorationWallGroundShadows.frameCache;
 if(frame!==null&&old?.frame===frame&&old.terrain===terrain&&old.solar===solar)return old.field;
 const geometryKey=JSON.stringify([encounter.openDoors,(terrain.doors||[]).map(d=>[d.id,d.open])]);
 const field=api.cachedWallGroundShadows(terrain,api.SCENE_STYLE,solar,{geometryKey,solids:()=>{
  const solids=(terrain.walls||[]).flatMap(explorationWallGroundSolids);
  for(const door of terrain.doors||[]){const parts=api.combatDoorSolids(door,terrain,api.SCENE_STYLE);solids.push(parts.leaf,parts.lintel);}return solids;
 }});
 explorationWallGroundShadows.frameCache={frame,terrain,solar,field};
 if(typeof canvas!=='undefined'&&canvas.dataset&&explorationWallGroundShadows.last!==field){canvas.dataset.wallSunShadowStats=JSON.stringify(field.stats);explorationWallGroundShadows.last=field;}
 return field;
}
function explorationSurfaceExposure(point,normal,lights,opened,sunShadow=true){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 const api=explorationEncounterApi,field=(typeof explorationVisualDaylight==='function'?explorationVisualDaylight():explorationDaylight())?.field,cell=api.SCENE_STYLE.cellMetres,surface=api.surfaceAt(explorationEncounter.map,{x:point.x/cell,z:point.z/cell}),x=surface.cell.x,z=surface.cell.z;
 let ambient=explorationEncounter.synthetic?(isIndoorWorldPoint({x:(point.x/cell-explorationEncounter.origin.x)*explorationTerrain.cellW,y:(point.z/cell-explorationEncounter.origin.z)*explorationTerrain.cellH})?api.SCENE_STYLE.ambient:api.ambientForCell({environment:['o']},0,0)):field?field.ambientAt(x,z):api.ambientForCell(explorationEncounter.map,x,z);
 const solar=globalThis.adventurePartySolar?.state?.();
 const outdoor=explorationEncounter.synthetic?!isIndoorWorldPoint({x:(point.x/cell-explorationEncounter.origin.x)*explorationTerrain.cellW,y:(point.z/cell-explorationEncounter.origin.z)*explorationTerrain.cellH}):surface.environment==='outdoor';
 if(solar&&outdoor&&api.solarAmbient){if(!field)ambient=api.solarAmbient(ambient,solar);ambient={...ambient,intensity:ambient.intensity*api.solarFaceGain(normal,solar)};}
 // Only the direct-sun share is removed at the actual surface point. Sky ambient and local
 // light sources are preserved; wall visibility and tactical LOS are untouched.
 if(sunShadow&&solar&&outdoor&&typeof explorationWallGroundShadows==='function'){
  const shadows=explorationWallGroundShadows();
  if(shadows){
   const origin=explorationEncounter.origin,terrain=explorationTerrain;
   const local={x:point.x-origin.x*cell,z:point.z-origin.z*cell};
   let occlusion;
   if(point.y>0){
    const dot=normal.x*solar.direction.x+normal.y*solar.direction.y+normal.z*solar.direction.z;
    // Back-facing walls lose direct sun. Facing walls test from their actual
    // surface, just outside the solid, at the height being shaded.
    occlusion=dot<=1e-8?1:shadows.occlusion({x:local.x+normal.x*.002,z:local.z+normal.z*.002},point.y+.002);
   }else{
    // Sample the cached building silhouette at each light-map texel. Existing
    // linear filtering softens its edge independently of the tactical hex grid.
    occlusion=shadows.occlusion(local);
   }
   if(occlusion)ambient={...ambient,intensity:ambient.intensity*api.wallSunRetention(occlusion,solar)};
  }
 }
 const base=api.surfaceLight(point,normal,lights,explorationDaylightVisible,ambient),day=field?.sample(point,normal,explorationDaylightVisible);
 return api.displayExposure(day?.rgb.some(v=>v>0)?base.map((v,i)=>v+day.rgb[i]):base);
}

function drawExplorationIlluminationLayer(gpuOnly=false){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
  const lights=gpuOnly&&explorationGpuLighting?[]:explorationVisualLights(),opened=new Set(explorationEncounter.openDoors),cell=explorationEncounterApi.SCENE_STYLE.cellMetres;
  const mapBounds=explorationTerrain.bounds;
  let b=mapBounds;
  if(explorationTerrain.edgeBased&&typeof camera!=='undefined'){
    // Bake exposure only around the viewport; distant architecture remains in
    // the rules map without allocating a full-map lighting bitmap.
    const v=battlefieldWorldViewport(),origin=explorationEncounter.origin;
    b={left:Math.max(mapBounds.left,Math.floor(origin.x+v.left/explorationTerrain.cellW)-1),right:Math.min(mapBounds.right,Math.ceil(origin.x+v.right/explorationTerrain.cellW)+1),top:Math.max(mapBounds.top,Math.floor(origin.z+v.top/explorationTerrain.cellH)-1),bottom:Math.min(mapBounds.bottom,Math.ceil(origin.z+v.bottom/explorationTerrain.cellH)+1)};
  }
  const left=(b.left-explorationEncounter.origin.x-.5)*explorationTerrain.cellW,top=(b.top-explorationEncounter.origin.z-.5)*explorationTerrain.cellH;
  const spanWidth=(b.right-b.left+1)*explorationTerrain.cellW,spanHeight=(b.bottom-b.top+1)*explorationTerrain.cellH,origin=screenPointForWorld({x:left,y:top});
  // Illumination varies smoothly; keep a bounded screen-space light map.
  // Material textures and architectural silhouettes retain their full detail.
  const sampleWorld=12/(typeof battlefieldZoom==='number'?battlefieldZoom:1);
  const width=Math.ceil(spanWidth/sampleWorld),height=Math.ceil(spanHeight/sampleWorld);
  const shadowRevision=typeof explorationWallGroundShadows==='function'?explorationWallGroundShadows()?.revision||0:0;
  const cacheKey=JSON.stringify([shadowRevision,lights,left,top,width,height,explorationEncounter.scope,explorationEncounter.openDoors,(typeof explorationVisualDaylight==='function'?explorationVisualDaylight():explorationDaylight())?.revision||0]);
  let cache=drawExplorationIlluminationLayer.cache;
  if(!cache||cache.key!==cacheKey){
    const layers=[document.createElement('canvas'),document.createElement('canvas')];for(const c of layers){c.width=width;c.height=height;}
    const contexts=layers.map(c=>c.getContext('2d')),images=contexts.map(c=>c.createImageData(width,height));
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const point={x:(explorationEncounter.origin.x+(left+(x+.5)*spanWidth/width)/explorationTerrain.cellW)*cell,y:0,
        z:(explorationEncounter.origin.z+(top+(y+.5)*spanHeight/height)/explorationTerrain.cellH)*cell};
      const value=explorationSurfaceExposure(point,{x:0,y:1,z:0},lights,opened,true),index=(y*width+x)*4;
      for(let i=0;i<3;i++){images[0].data[index+i]=value.multiply[i];images[1].data[index+i]=value.boost[i];}images[0].data[index+3]=images[1].data[index+3]=255;
    }
    contexts.forEach((c,i)=>c.putImageData(images[i],0,0));cache={key:cacheKey,layers};drawExplorationIlluminationLayer.cache=cache;
  }
  if(gpuOnly)return {...cache,left,top,spanWidth,spanHeight};
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const u=battlefieldProjectVector({x:spanWidth,y:0}),v=battlefieldProjectVector({x:0,y:spanHeight});
  ctx.transform(u.x/width,u.y/width,v.x/height,v.y/height,origin.x,origin.y);
  ctx.globalCompositeOperation='multiply';ctx.drawImage(cache.layers[0],0,0);
  ctx.globalCompositeOperation='color-dodge';ctx.drawImage(cache.layers[1],0,0);ctx.restore();
}
function shadeExplorationWall(target,wall,height,thickness){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
  const api=explorationEncounterApi,cell=api.SCENE_STYLE.cellMetres,lights=explorationVisualLights(),opened=new Set(explorationEncounter.openDoors);
  // Edge-on faces have no broad surface; keep their existing thin boundary.
  if(Math.abs(wall.b.x-wall.a.x)<Math.abs(wall.b.y-wall.a.y))return;
  const a=screenPointForWorld(wall.a),b=screenPointForWorld(wall.b);
  const key=JSON.stringify([lights,explorationEncounter.openDoors,height,explorationTerrain.cellW,explorationTerrain.cellH,explorationEncounter.origin]);
  const wallCache=shadeExplorationWall.cache||(shadeExplorationWall.cache=new WeakMap());
  let cached=wallCache.get(wall);if(!cached||cached.key!==key){cached={key,rows:[]};wallCache.set(wall,cached);}
  target.save();target.lineWidth=thickness;
  for(let y=0;y<height;y++){
    const gradients=[target.createLinearGradient(a.x,0,b.x,0),target.createLinearGradient(a.x,0,b.x,0)];
    for(const [sample,t] of [0,.5,1].entries()){
      const point={x:(explorationEncounter.origin.x+(wall.a.x+(wall.b.x-wall.a.x)*t)/explorationTerrain.cellW)*cell,
        z:(explorationEncounter.origin.z+(wall.a.y+(wall.b.y-wall.a.y)*t)/explorationTerrain.cellH)*cell+.02,y:y/height*api.SCENE_STYLE.wallMetres};
      const row=cached.rows[y]||(cached.rows[y]=[]);
      const value=row[sample]||(row[sample]=explorationSurfaceExposure(point,{x:0,y:0,z:1},lights,opened));
      gradients[0].addColorStop(t,`rgb(${value.multiply.join(',')})`);gradients[1].addColorStop(t,`rgb(${value.boost.join(',')})`);
    }
    for(const [i,mode] of ['multiply','color-dodge'].entries()){
      target.globalCompositeOperation=mode;target.fillStyle=gradients[i];target.fillRect(Math.min(a.x,b.x)-thickness/2,Math.floor(a.y-y-.5),Math.abs(b.x-a.x)+thickness,1);
    }
  }
  target.restore();
}
function drawExplorationTorchFloorGlow(tiles){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 if(typeof explorationGpuLighting!=='undefined'&&explorationGpuLighting)return;
 if(!explorationTerrain?.torches?.length)return;
 ctx.save();
 for(const torch of explorationTerrain.torches){
  const a=explorationTorchAnimation(torch),c=screenPointForWorld(torch.lightWorld||torch.world),radius=HEX_W*(torch.radiusHexes||3);
  ctx.save();clipExplorationEmitter(torch);ctx.beginPath();let any=false;
  for(const fragment of explorationFloorFragments(tiles))if(hexDistance(torch,fragment.point)<torch.radiusHexes){const p=fragment.screen;ctx.moveTo(p[0].x,p[0].y);for(const q of p.slice(1))ctx.lineTo(q.x,q.y);ctx.closePath();any=true;}
  if(any){ctx.clip();const glow=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,radius);glow.addColorStop(0,`rgba(255,145,42,${.09*a.intensity})`);glow.addColorStop(1,'rgba(255,145,42,0)');ctx.globalCompositeOperation='lighter';ctx.fillStyle=glow;ctx.fillRect(c.x-radius,c.y-radius,radius*2,radius*2);}ctx.restore();
 }ctx.restore();
}
function drawExplorationTorch(torch){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 if(typeof combatGpu!=="undefined"&&combatGpu)combatGpu.prepareOverlay();
 const api=explorationEncounterApi,style=api.SCENE_STYLE,scale=style.tacticalWallPixels/style.wallMetres,a=explorationTorchAnimation(torch),world=torch.world||worldPointForHex(torch.x,torch.y),mount=screenPointForWorld(world),top=screenPointForWorld(world,torch.elevation??style.torch.height*scale);
 ctx.save();
 if(torch.attached){
  const wall=torch.plateWorld,dx=torch.dx||0,dz=torch.dz||0,tangent={x:-dz*style.torch.plateWidth/style.cellMetres*explorationTerrain.cellW/2,y:dx*style.torch.plateWidth/style.cellMetres*explorationTerrain.cellH/2};
  const points=[screenPointForWorld({x:wall.x-tangent.x,y:wall.y-tangent.y},21.4),screenPointForWorld({x:wall.x+tangent.x,y:wall.y+tangent.y},21.4),screenPointForWorld({x:wall.x+tangent.x,y:wall.y+tangent.y},16.6),screenPointForWorld({x:wall.x-tangent.x,y:wall.y-tangent.y},16.6)];
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fillStyle='#312923';ctx.fill();ctx.strokeStyle='#75614b';ctx.lineWidth=1;ctx.stroke();
  const plate=screenPointForWorld(wall,17.5),arm=screenPointForWorld(world,17.5);ctx.strokeStyle='#352e26';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(plate.x,plate.y);ctx.lineTo(arm.x,arm.y);ctx.stroke();
 }else{ctx.strokeStyle='#382b1d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(mount.x,mount.y);ctx.lineTo(mount.x,mount.y-17.5);ctx.stroke();}
 ctx.strokeStyle='#34271b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(mount.x,mount.y-style.torch.stemBottom*scale);ctx.lineTo(mount.x,mount.y-(style.torch.stemBottom+style.torch.stemHeight)*scale);ctx.stroke();
 const cup=screenPointForWorld(world,21.7);ctx.fillStyle='#433628';ctx.beginPath();ctx.ellipse(cup.x,cup.y,style.torch.cupRadius*scale,1.2,0,0,Math.PI*2);ctx.fill();
 const sway=battlefieldProjectVector({x:a.swayX/style.cellMetres*explorationTerrain.cellW,y:a.swayZ/style.cellMetres*explorationTerrain.cellH}),x=top.x+sway.x,y=top.y,base=y+2;
 const glow=ctx.createRadialGradient(x,y,0,x,y,8*a.intensity);glow.addColorStop(0,'rgba(255,171,55,.45)');glow.addColorStop(1,'rgba(255,171,55,0)');ctx.fillStyle=glow;ctx.fillRect(x-10,y-10,20,20);
 ctx.fillStyle='#ff982d';ctx.beginPath();ctx.moveTo(top.x-1.8,base);ctx.quadraticCurveTo(x-3*a.width,y-1,x,y-4.2*a.height);ctx.quadraticCurveTo(x+3*a.width,y-1,top.x+1.8,base);ctx.fill();ctx.fillStyle='#fff0a3';ctx.beginPath();ctx.ellipse(top.x,base-1,.8,1.8*a.height,0,0,Math.PI*2);ctx.fill();ctx.restore();
}

function configureExplorationTerrain(){
 configureCombatMap(explorationEncounter);
}
function configureCombatMap(request){
  explorationTerrain=explorationEncounterApi.terrainForEncounter(request.map,request.origin,new Set(request.openDoors),HEX_W,HEX_ROW);
  if(explorationTerrain.hexBounds){const b=explorationTerrain.hexBounds;MAP_MIN_X=b.minX;MAP_MAX_X=b.maxX;MAP_MIN_Y=b.minY;MAP_MAX_Y=b.maxY;}
  architecturalWalls=explorationTerrain.walls;
  architecturalSpaces=explorationTerrain.spaces;
  rebuildArchitecturalBlockedHexes();
  walls.clear();
  for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++)if(!explorationTerrain.walkableHex(x,y))walls.add(key(x,y));
  const floor=[];for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++)if(!isWall(x,y))floor.push({x,y,world:worldPointForHex(x,y)});
  explorationTerrain.torches=(request.map.torches||[]).flatMap((t,i)=>{
    const {bounds}=explorationTerrain;if(t.x<bounds.left||t.x>bounds.right||t.z<bounds.top||t.z>bounds.bottom)return [];
    if(explorationTerrain.isRenderableHex&&!explorationTerrain.isRenderablePoint(explorationTerrain.project(t.x,t.z)))return [];
    const placement=explorationEncounterApi.torchPlacement(request.map,t),cell=explorationEncounterApi.SCENE_STYLE.cellMetres,world=explorationTerrain.project(placement.x/cell,placement.z/cell),wallPlaneWorld=explorationTerrain.project(placement.wallX/cell,placement.wallZ/cell),plateWorld={x:wallPlaneWorld.x-placement.dx*1.6,y:wallPlaneWorld.y-placement.dz*1.6*explorationTerrain.cellH/explorationTerrain.cellW},sourceWorld=explorationTerrain.project(t.x,t.z),nearest=floor.reduce((best,p)=>!best||Math.hypot(p.world.x-sourceWorld.x,p.world.y-sourceWorld.y)<Math.hypot(best.world.x-sourceWorld.x,best.world.y-sourceWorld.y)?p:best,null);
    if(!nearest||Math.hypot(nearest.world.x-world.x,nearest.world.y-world.y)>HEX_W)return [];
    const mountWall=placement.attached?architecturalWalls.find(w=>{const vx=w.b.x-w.a.x,vy=w.b.y-w.a.y,len=vx*vx+vy*vy,t=len?((wallPlaneWorld.x-w.a.x)*vx+(wallPlaneWorld.y-w.a.y)*vy)/len:-1;return t>=0&&t<=1&&Math.hypot(w.a.x+vx*t-wallPlaneWorld.x,w.a.y+vy*t-wallPlaneWorld.y)<.1;}):null;
    const light=explorationEncounterApi.combatTorchLightPlacement(placement,explorationTerrain,explorationEncounterApi.SCENE_STYLE,mountWall?.thickness||explorationEncounterApi.SCENE_STYLE.tacticalWallThickness,HEX_W,HEX_ROW);
    return [{sourceIndex:i,lightWorld:light.world,lightPosition:light.point,visibilityHex:{x:nearest.x,y:nearest.y},world,wallPlaneWorld,plateWorld,mountWallId:mountWall?.id,attached:placement.attached,dx:placement.dx,dz:placement.dz,seed:placement.seed,elevation:placement.y/explorationEncounterApi.SCENE_STYLE.wallMetres*35,id:'exploration-torch-'+i,sourceKind:'torch',sourceName:'Torch',x:light.hex.x,y:light.hex.y,radiusHexes:3,intensity:1.2,color:[255,166,77]}];
  });
  combatSceneTerrain=explorationTerrain;combatSceneContext=request;
}
function explorationUnits(){
  const request=explorationEncounter,saved=request.previous;
  const player=request.player?structuredClone(request.player):makeFighter();
  player.id='player';player.faction='player';player.controller='player';player.fled=false;
  if(player.hp<=0)throw Error('The exploration test character is defeated. Restart exploration to begin a fresh test.');
  const available=[];
  for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++)if(!isWall(x,y))available.push({x,y});
  const point=explorationTerrain.project(request.position.x,request.position.z);
  const distance=(pos,target)=>{const p=worldPointForHex(pos.x,pos.y);return Math.hypot(p.x-target.x,p.y-target.y);};
  const playerPosition=available.slice().sort((a,b)=>distance(a,point)-distance(b,point)).find(p=>occupiedHexesAt(player,p.x,p.y).every(c=>!isWall(c.x,c.y)));
  if(!playerPosition||distance(playerPosition,point)>HEX_W)throw Error('The party does not fit this terrain conversion. Widen the entrance in the editor.');
  Object.assign(player,playerPosition);
  const occupied=new Set(occupiedHexes(player).map(c=>key(c.x,c.y)));
  // Flood fill uses production wall-transition blocking, not just cell occupancy.
  const reached=new Set([key(player.x,player.y)]),queue=[playerPosition];
  for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]){
    const p={x:queue[i].x+dx,y:queue[i].y+dy},k=key(p.x,p.y);
    if(inside(p.x,p.y)&&!isWall(p.x,p.y)&&!reached.has(k)&&!architecturalWallBlocksStep(queue[i],p)){reached.add(k);queue.push(p);}
  }
  const spawn=explorationTerrain.project(request.event.spawnX,request.event.spawnZ);
  const enemies=saved?.enemies?structuredClone(saved.enemies):Array.from({length:request.event.count},(_,i)=>makeLibraryMob(request.event.mobId,i,{x:0,y:0}));
  enemies.forEach((enemy,i)=>{
    enemy.id=`exploration-enemy-${i}`;
    if(!saved){enemy.faction='enemy';enemy.controller='mob';}
    if(!enemy.alive||enemy.fled)return;
    const scaleRatio=(explorationTerrain.scale||1)/(saved?.terrainScale||1);
    const positions=saved?[{x:Math.round(enemy.x*scaleRatio),y:Math.round(enemy.y*scaleRatio)},...available]:available.slice().sort((a,b)=>distance(a,spawn)-distance(b,spawn));
    const p=positions.find(p=>reached.has(key(p.x,p.y))&&occupiedHexesAt(enemy,p.x,p.y,saved?enemy.facingHex:hexDirectionIndexToward(p,playerPosition)).every(c=>inside(c.x,c.y)&&!isWall(c.x,c.y)&&!occupied.has(key(c.x,c.y))));
    if(!p)throw Error('Not enough connected floor space for the encounter. Reduce its count or widen the room.');
    Object.assign(enemy,p);
    if(!saved){enemy.facingHex=hexDirectionIndexToward(p,playerPosition);enemy.facing=(playerPosition.x-enemy.x)+(playerPosition.y-enemy.y)*.5>=0?'right':'left';}
    occupiedHexes(enemy).forEach(c=>occupied.add(key(c.x,c.y)));
  });
  return {player,allies:[],enemies};
}
function rememberExplorationCombat(outcome){
  const request=explorationEncounter,storage=request.test?sessionStorage:localStorage;
  const progress=explorationEncounterApi.readProgress(storage,request.scope);
  // Combat unit records are plain game data; exclude visual caches/DOM objects.
  const snapshot=unit=>JSON.parse(JSON.stringify(unit,(k,v)=>typeof v==='function'||(typeof Node!=='undefined'&&v instanceof Node)?undefined:v));
  const next=explorationEncounterApi.recordOutcome(progress,request.event.id,outcome,snapshot(game.player),game.enemies.map(snapshot));
  next.encounters[request.event.id].origin=request.origin;
  next.encounters[request.event.id].terrainScale=explorationTerrain.scale;
  if(outcome==='victory')next.encounters[request.event.id].loot=collectLootFromSlainEnemies().items;
  storage.setItem(explorationEncounterApi.progressKey(request.scope),JSON.stringify(next));
}
function returnFromExplorationCombat(outcome){
  if(!explorationEncounter)return false;
  try{rememberExplorationCombat(outcome);}catch(error){setCombatMessage('Could not save encounter result: '+error.message);return true;}
  game.over=true;game.active=null;if(aiTimer)clearTimeout(aiTimer);
  const query=new URLSearchParams(explorationEncounter.returnSearch);
  const safe=new URLSearchParams();for(const name of ['test','map','entrance'])if(query.has(name))safe.set(name,query.get(name));safe.set('resumeEncounter','1');
  location.assign('exploration.html?'+safe);return true;
}
// Keep the launcher inaccessible throughout sprite loading and initialization.
async function startExplorationCombat(){
  if(new URLSearchParams(location.search).get('explorationCombat')!=='1')return;
  const panel=document.createElement('section');panel.id='explorationCombatStartup';panel.setAttribute('role','status');panel.style.cssText='position:fixed;inset:0;z-index:100000;background:#10101b;color:#83e7e8;display:grid;place-content:center;gap:20px;padding:30px;text-align:center';
  const heading=document.createElement('h1');heading.textContent='Preparing encounter';const status=document.createElement('p');status.textContent='Loading combat assets and restoring the map encounter…';
  const back=document.createElement('a');back.textContent='Return to exploration';back.href='exploration.html?resumeEncounter=1&v=R238C217';
  const retry=document.createElement('button');retry.textContent='Retry encounter';retry.hidden=true;retry.onclick=()=>{const url=new URL(location.href);url.searchParams.set('gameReload',String(Date.now()));location.replace(url.href);};
  panel.append(heading,status,back,retry);document.body.append(panel);
  const block=event=>{if(!panel.contains(event.target))event.stopImmediatePropagation();};window.addEventListener('keydown',block,true);
  try{
    await window.adventurePartyGameStartup.ready;
    explorationEncounterApi=await import('./exploration-encounters.mjs?v=R238C277');
    const request=JSON.parse(sessionStorage.getItem(explorationEncounterApi.HANDOFF_KEY)||'null');
    if(request){const query=new URLSearchParams(request.returnSearch),safe=new URLSearchParams();for(const name of ['test','map','entrance'])if(query.has(name))safe.set(name,query.get(name));safe.set('resumeEncounter','1');safe.set('v','R238C217');back.href='exploration.html?'+safe;}
    const {validateMap}=await import('./exploration-core.mjs?v=R238C274');
    if(!request?.map||!request.event)throw Error('No encounter handoff is available. Return to the map and enter the encounter again.');validateMap(request.map);
    const issues=explorationEncounterApi.validateEncounters({...request.map,encounters:[request.event]});if(issues.length)throw Error(issues.join(' '));
    if(!window.adventurePartyRepositoryMobs.canTest(request.event.mobId))throw Error('Encounter MOB is unavailable or has incomplete appearance data.');
    const saved=explorationEncounterApi.readProgress(request.test?sessionStorage:localStorage,request.scope);
    request.previous=saved.encounters[request.event.id]||request.previous;request.player=saved.player||request.player;
    explorationEncounter=request;
    await prepareCombatSession();
    if(explorationEncounterApi.hasDirtGround(request.map)){
      explorationDirtImage.src=explorationEncounterApi.GROUND_TEXTURES.dirt+'?v=R238C258';explorationFringeImage.src=explorationEncounterApi.GROUND_TEXTURES.fringe+'?v=R238C258';await Promise.all([explorationDirtImage.decode(),explorationFringeImage.decode()]);
    }
    explorationGroundBank=explorationEncounterApi.hasDirtGround(request.map)?explorationEncounterApi.createGroundTileBank({grass:explorationGrassImage,dirt:explorationDirtImage,fringe:explorationFringeImage}):null;
    explorationRoadBank=null;
    selectedMobEncounter='custom';combatMobRoster.length=0;
    const retreat=document.createElement('button');retreat.textContent='Retreat to exploration';retreat.addEventListener('click',()=>returnFromExplorationCombat('retreat'));document.getElementById('returnButton').after(retreat);
    ui.restartButton.disabled=true;ui.restartButton.title='Return to exploration to preserve this encounter.';
    const result=await showCombat('wall');
    if(result===false)throw Error('Encounter startup was interrupted. Retry or return to exploration.');
    if(document.getElementById('turnBanner')?.textContent==='COMBAT INITIALIZATION ERROR')throw Error(document.getElementById('combatLog')?.textContent||'Combat initialization failed.');
    panel.remove();window.removeEventListener('keydown',block,true);
  }catch(error){console.error(error);heading.textContent='Encounter could not start';status.textContent=error.message;retry.hidden=false;}
}
void startExplorationCombat();

function explorationDoorOpeningAllowed(unit){
 return !!(explorationTerrain&&controlledUnitCanAct(unit)&&!combatAwaitingStart&&combatOpeningSpeechDone&&!aimMode&&!classReportOpen&&!characterSheetOpen&&!inventoryOpen&&!spellCastOverlayOpen&&!spellCastInProgress&&!sweepInProgress&&!mobGuardReactionInProgress&&!freeStrikeInProgress&&!isCombatActionPauseActive());
}
function explorationReachableDoors(unit){
 return unit&&explorationTerrain?explorationEncounterApi.doorsInReach(explorationTerrain,unit,(a,b)=>architecturalWallBlocksWorldLine(a,b,'movement')):[];
}
function explorationDoorOccupied(door){
 const wall=explorationDoorWall(door),width=door.width??1,c=door.center;
 const leaf={...wall,blocksMovement:true,a:{x:c.x+(wall.a.x-c.x)*width,y:c.y+(wall.a.y-c.y)*width},b:{x:c.x+(wall.b.x-c.x)*width,y:c.y+(wall.b.y-c.y)*width}};
 return [game.player,...(game.allies||[]),...(game.enemies||[])].filter(unit=>unit?.alive&&!unit.fled).some(unit=>occupiedHexes(unit).some(cell=>wallSegmentCutsHexInterior(leaf,cell.x,cell.y)));
}
function tryExplorationToggleDoor(){
 const request=combatSceneContext||explorationEncounter;
 const unit=activePlayerControlledUnit();if(!explorationDoorOpeningAllowed(unit))return;
 const doors=explorationReachableDoors(unit);
 if(doors.length!==1){log(doors.length?'More than one door is in reach. Step closer to the door you want.':'No door is within reach.','system');return;}
 if(unit.turnMoves+1>unit.move){log('Opening or closing a door requires 1 movement point.','system');return;}
 const door=doors[0];if(door.open&&explorationDoorOccupied(door)){log('Cannot close the door: a unit occupies the doorway.','system');return;}
 const id=door.id||`${door.x},${door.z}`,opened=new Set(request.openDoors);if(door.open)opened.delete(id);else opened.add(id);
 const next=[...opened];
 try{if(!request.standalone)sessionStorage.setItem(explorationEncounterApi.HANDOFF_KEY,JSON.stringify({...request,openDoors:next}));}
 catch(error){log('Could not save the door state: '+error.message,'system');return;}
 request.openDoors=next;unit.turnMoves++;
 if(!unit.fullMove&&unit.turnMoves>unit.halfMove){unit.fullMove=true;log('Door interaction passes the attack threshold; Full Move activates.','system');}
 configureCombatMap(request);
 if(typeof r220ObserveVisibleTargetsForAllMobs==='function')r220ObserveVisibleTargetsForAllMobs();
 log(`${unit.name} ${door.open?'closes':'opens'} the door (1 movement point; ${unit.turnMoves}/${unit.fullMove?unit.move:unit.halfMove}).`,'system');
 refreshTurnBanner();updateUi();draw();
}

