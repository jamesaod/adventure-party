/* Production CPU visibility transport; point-light shading belongs to WebGL.
 * A bounded atlas carries silhouettes, never precomputed color/falloff. */
let explorationGpuLighting=null;
function prepareExplorationGpuLighting(){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 explorationGpuLighting=null;
 if(!combatGpu?.setLighting||!explorationTerrain||new URLSearchParams(location.search).get('combatLighting')==='cpu')return;
 const api=explorationEncounterApi,t=explorationTerrain,cell=api.SCENE_STYLE.cellMetres,origin=explorationEncounter.origin;
 const toWorld=p=>({x:(p.x/cell-origin.x)*t.cellW,y:(p.z/cell-origin.z)*t.cellH});
 const axial=p=>({x:p.x/HEX_W-p.y/(2*HEX_ROW),y:p.y/HEX_ROW});
 const lights=explorationVisualLights().map(light=>{
  const world=toWorld(light),torch=light.kind==='torch'?t.torches?.find(v=>v.lightPosition&&Math.hypot(v.lightPosition.x-light.x,v.lightPosition.z-light.z)<.01):null;
  return {...light,intensity:light.intensity*(torch?explorationTorchAnimation(torch).intensity:1),observer:axial(world),bounds:[world.x-light.range/cell*t.cellW,world.y-light.range/cell*t.cellH,2*light.range/cell*t.cellW,2*light.range/cell*t.cellH]};
 });
 for(const source of explorationRenderLights())if(source.sourceKind!=='torch'){
  const world=worldPointForHex(source.x,source.y),r=Math.max(1,source.radiusHexes||1);
  const radiusX=r*HEX_W,radiusY=radiusX*t.cellH/t.cellW;
  const offset=source.visualOffsetMetres||{},dx=(offset.x||0)/cell*t.cellW,dy=(offset.z||0)/cell*t.cellH;
  lights.push({...source,x:source.x+dx/HEX_W-dy/(2*HEX_ROW),y:source.y+dy/HEX_ROW,kind:'spell',height:(source.heightMetres||(source.sourceKind==='tree-fire'?2.5:2.2))+(offset.y||0),range:r,observer:source,bounds:[world.x-radiusX,world.y-radiusY,2*radiusX,2*radiusY]});
 }
 // Never discard spells on large maps. The complete reference route is used
 // for that frame when the guaranteed WebGL 2 uniform budget is exceeded.
 if(lights.length>32)return;
 const size=256,cache=prepareExplorationGpuLighting.cache||(prepareExplorationGpuLighting.cache={mask:document.createElement('canvas'),keys:[],revision:0});
 if(cache.mask.width!==size*8){cache.mask.width=size*8;cache.mask.height=size*4;}
 const target=cache.mask.getContext('2d');
 const darkness=(game.areaEffects||[]).filter(e=>e.type==='darkness');
 for(let i=0;i<lights.length;i++){
  const l=lights[i],b=l.bounds;
  const key=JSON.stringify([l.kind,b,l.observer.x,l.observer.y,explorationEncounter.openDoors,(game.condition==='wall'||darkness.length)?[camera,battlefieldZoom,battlefieldRotation]:null,darkness]);
  const walls=typeof architecturalWalls==='undefined'?null:architecturalWalls;
  if(cache.terrain===t&&cache.walls===walls&&cache.keys[i]===key)continue;
  cache.keys[i]=key;cache.revision++;globalThis.adventurePartyCombatPerformance?.count('lightingMaskRebuilds');
  const x=i%8*size,y=Math.floor(i/8)*size;
  target.save();target.setTransform(1,0,0,1,0,0);target.clearRect(x,y,size,size);target.beginPath();target.rect(x,y,size,size);target.clip();
  target.translate(x,y);target.scale(size/b[2],size/b[3]);target.translate(-b[0],-b[1]);
  target.fillStyle='#fff';
  const polygon=game.condition==='wall'?wallTestVisibilityPolygonWorld(l.observer,'light'):null;
  if(polygon?.length){target.beginPath();target.moveTo(polygon[0].x,polygon[0].y);for(const p of polygon.slice(1))target.lineTo(p.x,p.y);target.closePath();target.fill();}
  else if(game.condition!=='wall')target.fillRect(...b);
  // Preserve magical darkness suppression of additive spell illumination.
  if(l.kind==='spell'&&darkness.length){target.globalCompositeOperation='destination-out';for(const tile of visibleHexes())if(hasObscuringMagicAtHex(tile.x,tile.y)){
   const c=worldPointForHex(tile.x,tile.y),h=HEX_ROW*4/3,p=[[0,-h/2],[HEX_W/2,-h/4],[HEX_W/2,h/4],[0,h/2],[-HEX_W/2,h/4],[-HEX_W/2,-h/4]].map(([x,y])=>({x:c.x+x,y:c.y+y}));target.beginPath();target.moveTo(p[0].x,p[0].y);for(const q of p.slice(1))target.lineTo(q.x,q.y);target.closePath();target.fill();
  }}
  target.restore();
 }
 cache.terrain=t;cache.walls=typeof architecturalWalls==='undefined'?null:architecturalWalls;cache.keys.length=lights.length;
 explorationGpuLighting={lights,mask:cache.mask,maskRevision:cache.revision,world:[cell/t.cellW,cell/t.cellH,origin.x*cell,origin.z*cell]};
 combatGpu.setLighting(explorationGpuLighting);
}
function explorationGpuPoint(p){
 const s=explorationGpuLighting.world;
 return [p.x*s[0]+s[2],(p.elevation||0)/35*explorationEncounterApi.SCENE_STYLE.wallMetres,p.y*s[1]+s[3]];
}
// Sprite bodies stay upright billboards; sample their standing hex, leaving
// health bars, casting silhouettes, contact shadows and text independent.
function drawExplorationGpuSprite(source,entity,x,y,width,height){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 const explorationEncounter=typeof combatSceneContext==='undefined'?globalThis.explorationEncounter:combatSceneContext||globalThis.explorationEncounter;
 if(!explorationGpuLighting||!entity)return false;
 const world=worldPointForHex(entity.x,entity.y);if(!entity.alive&&entity.deathWorldOffset){const offset=corpsePresentationOffset(entity);world.x+=offset.x;world.y+=offset.y;}const point=explorationGpuPoint(world),exposure=explorationSurfaceExposure({x:point[0],y:0,z:point[2]},{x:0,y:1,z:0},[],new Set(explorationEncounter.openDoors));
 const transform=ctx.getTransform(),sx=BATTLEFIELD_LOGICAL_WIDTH/canvas.width,sy=BATTLEFIELD_LOGICAL_HEIGHT/canvas.height;
 const points=[[x,y],[x+width,y],[x+width,y+height],[x,y+height]].map(([a,b])=>({x:(transform.a*a+transform.c*b+transform.e)*sx,y:(transform.b*a+transform.d*b+transform.f)*sy}));
 combatGpu.surface([{points,uv:[[0,1],[1,1],[1,0],[0,0]],lightWorld:points.map(()=>[world.x,world.y]),lightPoints:points.map(()=>point),visibility:explorationVisibilityAtHex(entity,[]),multiply:exposure.multiply.map(v=>v/255),boost:exposure.boost.map(v=>v/255)}],source,{dynamicLighting:true,spriteLighting:true,saturation:!entity.alive&&Number.isFinite(entity.deathPresentationStartedAt)?.5:1,screenSpace:true,opacity:ctx.globalAlpha});
 return true;
}
