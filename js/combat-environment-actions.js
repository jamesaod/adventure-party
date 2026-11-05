/* Local combat-environment experiment: shared object state, not a second combat engine. */
let environmentActionInProgress=false;
const environmentGlassBytes=fetch('assets/audio/sfx/environment/glass-break-selected.wav').then(r=>{if(!r.ok)throw Error('Glass sound unavailable');return r.arrayBuffer();});
environmentGlassBytes.catch(()=>{});
let environmentGlassDecoded=null;
function combatEnvironment(){return game.environmentState||(game.environmentState={brokenWindows:[],wallScorch:{},arrows:[],glassFx:[],sequence:0});}
function environmentSquash(){return combatSceneTerrain?.cellH/combatSceneTerrain?.cellW||HEX_ROW/(HEX_W*Math.sqrt(3)/2);}
function environmentHex(point){const h=explorationEncounterApi.worldHex(point,HEX_W,HEX_ROW);return cubeRound(h.x,h.y);}
function environmentIntersection(a,b,c,d){
 const cross=(u,v)=>u.x*v.y-u.y*v.x,r={x:b.x-a.x,y:b.y-a.y},s={x:d.x-c.x,y:d.y-c.y},den=cross(r,s);if(Math.abs(den)<1e-8)return null;
 const q={x:c.x-a.x,y:c.y-a.y},t=cross(q,s)/den,u=cross(q,r)/den;
 return t>.00001&&t<=1.00001&&u>=-.00001&&u<=1.00001?{x:a.x+t*r.x,y:a.y+t*r.y,t,u}:null;
}
function environmentWindowSpan(window){const t=combatSceneTerrain,span=(window.axis==='x'?t.cellH:t.cellW)*window.width;
 return {a:{x:window.center.x-(window.axis==='x'?0:span/2),y:window.center.y-(window.axis==='x'?span/2:0)},b:{x:window.center.x+(window.axis==='x'?0:span/2),y:window.center.y+(window.axis==='x'?span/2:0)}};}
function environmentRayHit(from,to,mode='projectile'){
 let nearest=null;for(const wall of architecturalWalls||[])for(const segment of wallBlockingSubsegments(wall,mode)){
  const hit=environmentIntersection(from,to,segment.a,segment.b);if(!hit||nearest&&nearest.t<hit.t)continue;
  const window=(combatSceneTerrain?.windows||[]).find(w=>w.wallId===wall.id&&!w.broken&&(()=>{const span=environmentWindowSpan(w);return !!environmentIntersection(from,to,span.a,span.b);})());
  nearest={...hit,wallId:wall.id,windowId:window?.id,kind:window?'window':'wall',height:15};
 }return nearest;
}
// Targetability is separate from sight: intact glass remains transparent.
function environmentWindowAtTarget(target){
 return combatSceneTerrain?.windows?.find(window=>!window.broken&&(()=>{const hex=environmentHex(window.center);return hex.x===target.x&&hex.y===target.y;})());
}
function combatWindowTargetBlocked(source,target){
 if(!source||!target||!combatSceneTerrain?.windows?.length)return false;
 const hit=environmentRayHit(worldPointForHex(source.x,source.y),worldPointForHex(target.x,target.y));
 if(!hit?.windowId)return false;
 // The pane's own hex is a valid environmental target, not a hex beyond it.
 return environmentWindowAtTarget(target)?.id!==hit.windowId;
}
function environmentAimBlocked(){
 const caster=pendingAimAction?spellCasterForAction(pendingAimAction):activePlayerControlledUnit();
 return !!(aimMode&&caster&&combatWindowTargetBlocked(caster,aimCursor));
}
function rejectWindowTarget(source,target){
 if(!combatWindowTargetBlocked(source,target))return false;
 setCombatMessage('Invalid target: an intact window blocks the path. Target the window itself to break it.');return true;
}
function playEnvironmentGlass(){
 if(!audioEnabled)return;queueSfx(()=>{(async()=>{if(!audioCtx||!sfxGain)return;
  if(!environmentGlassDecoded)environmentGlassDecoded=environmentGlassBytes.then(bytes=>audioCtx.decodeAudioData(bytes.slice(0)));
  const buffer=await environmentGlassDecoded,source=audioCtx.createBufferSource(),gain=audioCtx.createGain();source.buffer=buffer;gain.gain.value=.65;source.connect(gain);gain.connect(sfxGain);source.start();
 })().catch(error=>console.warn('Glass sound:',error.message));});
}
function breakCombatWindow(id,{source=null,cause='impact'}={}){
 const window=combatSceneTerrain?.windows?.find(w=>w.id===id);if(!window||window.broken)return false;
 window.broken=true;const state=combatEnvironment();state.brokenWindows.push(id);
 for(const wall of architecturalWalls)if(wall.id===window.wallId){wall.openings=(wall.openings||[]).map(o=>({...o,broken:true}));}
 const context=combatSceneContext;context.map.edges=context.map.edges.map(edge=>edge.id===id?{...edge,broken:true}:edge);
 state.glassFx.push({id,world:{...window.center},started:performance.now(),duration:1100,seed:terrainHash(window.x||0,window.z||0),source});
 rebuildArchitecturalBlockedHexes();playEnvironmentGlass();ensureTransientUnitFxLoop();
 log(`The window shatters (${cause}).`,'system');return true;
}
function environmentEffectsActive(){const bloodActive=settleCombatBlood();if(!game?.environmentState)return bloodActive;const state=combatEnvironment();state.glassFx=state.glassFx.filter(fx=>performance.now()<fx.started+fx.duration);return bloodActive||state.glassFx.length>0;}
function queueCombatEnvironmentActors(actors){
 for(const burst of game?.bloodState?.bursts||[]){const c=screenPointForWorld(burst.origin);actors.push({sortY:c.y+.6,sortX:c.x,fn:()=>drawArrowBloodBurst(burst)});}
 for(const fx of game?.environmentState?.glassFx||[]){const c=screenPointForWorld(fx.world);actors.push({sortY:c.y+.5,sortX:c.x,fn:()=>drawEnvironmentGlass(fx)});}
 for(const arrow of game?.environmentState?.arrows||[])if(arrow.wallId){const wall=architecturalWalls.find(w=>w.id===arrow.wallId);if(!wall)continue;const a=screenPointForWorld(wall.a),b=screenPointForWorld(wall.b);actors.push({sortY:Math.max(a.y,b.y)+.31,sortX:(a.x+b.x)/2,fn:()=>drawEnvironmentArrow(arrow)});}
}
function drawEnvironmentGlass(fx){const age=(performance.now()-fx.started)/fx.duration;if(age<0||age>1)return;
 ctx.save();ctx.globalAlpha=1-age;for(let i=0;i<24;i++){
  const seed=terrainRand(i,fx.seed%99991,409),angle=seed*Math.PI*2,speed=12+terrainRand(i,17,410)*34;
  const world={x:fx.world.x+Math.cos(angle)*speed*age,y:fx.world.y+Math.sin(angle)*speed*age*.55},height=Math.max(0,16+(20+seed*25)*age-60*age*age),p=screenPointForWorld(world,height);
  ctx.fillStyle=i%3?'rgba(168,218,226,.8)':'#edf9fa';ctx.beginPath();ctx.moveTo(p.x-2,p.y);ctx.lineTo(p.x+1,p.y-4);ctx.lineTo(p.x+3,p.y+2);ctx.closePath();ctx.fill();
 }ctx.restore();}
// Clip the wall centreline against an affected hex, not a padded hex radius.
function clipScorchWallToPolygon(wall,polygon){
 const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y;let low=0,high=1;
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],ex=b.x-a.x,ey=b.y-a.y;
  const offset=ex*(wall.a.y-a.y)-ey*(wall.a.x-a.x),rate=ex*dy-ey*dx;
  if(Math.abs(rate)<1e-9){if(offset<-.00001)return null;continue;}
  const t=-offset/rate;if(rate>0)low=Math.max(low,t);else high=Math.min(high,t);
  if(low>=high-.000001)return null;
 }
 return [low,high];
}
function scorchCombatWalls(origin,cells){
 if(!combatSceneTerrain||!cells.length)return;
 const state=combatEnvironment(),source=worldPointForHex(origin.x,origin.y),polygons=cells.map(cell=>architecturalHexCoreVertices(cell.x,cell.y,1));
 for(const wall of architecturalWalls){
  if(wall.doorLeaf)continue;const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,length=Math.hypot(dx,dy);if(!length)continue;
  const side=dx*(source.y-wall.a.y)-dy*(source.x-wall.a.x)>=0?'a':'b',id=wall.id+':'+side,intervals=[];
  for(const polygon of polygons){
   const span=clipScorchWallToPolygon(wall,polygon);if(!span)continue;
   const middle=(span[0]+span[1])/2,point={x:wall.a.x+dx*middle,y:wall.a.y+dy*middle};
   const ray={x:point.x+(source.x-point.x)*.002,y:point.y+(source.y-point.y)*.002},hit=environmentRayHit(source,ray,'volume');
   if(!hit||hit.wallId===wall.id)intervals.push({low:span[0],high:span[1]});
  }
  if(!intervals.length)continue;
  for(const mark of state.wallScorch[id]||[]){const t=(x,y)=>((x-wall.a.x)*dx+(y-wall.a.y)*dy)/(length*length);intervals.push({low:t(mark.x,mark.y),high:t(mark.endX,mark.endY)});}
  intervals.sort((a,b)=>a.low-b.low);const merged=[];
  for(const span of intervals){const last=merged.at(-1);if(last&&span.low<=last.high+.00001)last.high=Math.max(last.high,span.high);else merged.push({...span});}
  // Match the floor mask's .88-hex footprint / .52 transition shoulder.
  // Widen only the inward fade; the clipped blast endpoints stay unchanged.
  state.wallScorch[id]=merged.slice(0,8).map(span=>({x:wall.a.x+dx*span.low,y:wall.a.y+dy*span.low,endX:wall.a.x+dx*span.high,endY:wall.a.y+dy*span.high,radius:HEX_W*.88*.52}));
 }
}
// Merge touched, coplanar spans before shading. A burn fades at its outside
// boundary, never at an editor edge shared by two scorched wall sections.
function combatWallScorch(wall,face){
 if(face.cap||face.side==='end')return [];
 const squash=environmentSquash(),dx=wall.b.x-wall.a.x,dy=(wall.b.y-wall.a.y)/squash,length=Math.hypot(dx,dy)||1,tx=dx/length,ty=dy/length,sign=face.side==='a'?1:-1;
 let indexed=combatWallScorch.wallIndex;if(indexed?.walls!==architecturalWalls)combatWallScorch.wallIndex=indexed={walls:architecturalWalls,byId:new Map(architecturalWalls.map(wall=>[wall.id,wall]))};
 const spans=[];
 for(const [id,marks] of Object.entries(game?.environmentState?.wallScorch||{})){
  const source=indexed.byId.get(id.slice(0,-2));if(!source)continue;
  const sx=source.b.x-source.a.x,sy=(source.b.y-source.a.y)/squash,sl=Math.hypot(sx,sy)||1,ss=id.endsWith(':a')?1:-1;
  if((sx/sl*tx+sy/sl*ty)*ss*sign<.999)continue;
  if(Math.abs((source.a.x-wall.a.x)*ty-(source.a.y-wall.a.y)/squash*tx)>1)continue;
  for(const mark of marks){
   const along=(x,y)=>(x-wall.a.x)*tx+(y-wall.a.y)/squash*ty;
   const a=along(mark.x,mark.y),b=along(mark.endX??mark.x,mark.endY??mark.y);
   spans.push({low:Math.min(a,b),high:Math.max(a,b),radius:mark.radius});
  }
 }
 spans.sort((a,b)=>a.low-b.low);const merged=[];
 for(const span of spans){const last=merged.at(-1);if(last&&span.low<=last.high+.01){last.high=Math.max(last.high,span.high);last.radius=Math.max(last.radius,span.radius);}else merged.push({...span});}
 return merged.filter(span=>span.high>0&&span.low<length).slice(0,8).map(span=>({x:wall.a.x+tx*span.low,y:wall.a.y+ty*span.low*squash,endX:wall.a.x+tx*span.high,endY:wall.a.y+ty*span.high*squash,radius:span.radius}));
}

function resolveFireballEnvironment(origin,baseCells){
 if(!combatSceneTerrain?.windows)return baseCells;
 const cells=baseCells.map(cell=>({...cell,damageScale:1})),keys=new Set(cells.map(cell=>key(cell.x,cell.y))),source=worldPointForHex(origin.x,origin.y);
 scorchCombatWalls(origin,baseCells);
 for(const window of combatSceneTerrain.windows){const span=environmentWindowSpan(window),delta={x:span.b.x-span.a.x,y:span.b.y-span.a.y};
  const midpoint=environmentHex(window.center);if(!baseCells.some(cell=>hexDistance(cell,midpoint)<=1))continue;
  const toPane={x:window.center.x+(source.x-window.center.x)*.002,y:window.center.y+(source.y-window.center.y)*.002};const obstruction=environmentRayHit(source,toPane,'volume');if(obstruction)continue;
  if(!window.broken)breakCombatWindow(window.id,{source,cause:'Fireball'});
  const sign=delta.x*(source.y-window.center.y)-delta.y*(source.x-window.center.x)>=0?-1:1,len=Math.hypot(delta.x,delta.y/environmentSquash())||1;
  for(const offset of [-.25,0,.25]){
   const point={x:window.center.x+delta.x*offset-sign*delta.y/environmentSquash()/len*HEX_W*.65,y:window.center.y+delta.y*offset+sign*delta.x/len*HEX_ROW*.85},hex=environmentHex(point),id=key(hex.x,hex.y);
   if(!inside(hex.x,hex.y)||keys.has(id)||environmentRayHit(window.center,worldPointForHex(hex.x,hex.y),'projectile'))continue;
   keys.add(id);cells.push({...hex,damageScale:.5,windowSpillover:window.id});
  }
 }return cells;
}
function fireballEnvironmentDamageScale(unit,cells){return Math.max(0,...occupiedHexes(unit).map(hex=>Math.max(0,...cells.filter(cell=>cell.x===hex.x&&cell.y===hex.y).map(cell=>cell.damageScale??1))));}
function missileMeleeTarget(attacker,intended){
 if(!intended?.alive)return intended;const melee=allUnits().filter(unit=>unit.alive&&!unit.fled&&unit.id!==attacker.id&&unit.faction!==intended.faction&&(canMeleeReach(unit,intended)||canMeleeReach(intended,unit)));
 if(!melee.length)return intended;const candidates=[intended,...melee],weights=candidates.map(unit=>{const size=String(unit.sizeCategory||unit.size||unit.creatureSize||'M').toLowerCase();return size.startsWith('tiny')||size==='t'?1/3:size.startsWith('small')||size==='s'?.5:size.startsWith('large')||size==='l'?2:size.startsWith('huge')||size==='h'?4:size.startsWith('garg')||size==='g'?6:1;});
 let roll=Math.random()*weights.reduce((a,b)=>a+b,0),selected=intended;for(let i=0;i<candidates.length;i++){roll-=weights[i];if(roll<=0){selected=candidates[i];break;}}
 if(selected!==intended)log(`${attacker.name}'s shot into melee targets ${selected.name} instead of ${intended.name}.`,'system');return selected;
}
function resolveEnvironmentArrow(attacker,target,{empty=false}={}){
 const from=worldPointForHex(attacker.x,attacker.y),aim=worldPointForHex(target.x,target.y);
 const pane=empty&&environmentWindowAtTarget(target);if(pane){const hit=environmentRayHit(from,pane.center);if(hit?.windowId===pane.id){const length=Math.hypot(hit.x-from.x,hit.y-from.y)||1;return {...hit,hex:environmentHex(hit),direction:{x:(hit.x-from.x)/length,y:(hit.y-from.y)/length}};}}
 const dx=aim.x-from.x,dy=(aim.y-from.y)/environmentSquash(),length=Math.hypot(dx,dy)||1;
 // A near attack-roll miss does not prove an armor/shield deflection.
 // Scatter ordinary misses before or beyond the target rather than at its feet.
 const deflected=false,scatter=(Math.random()-.5)*HEX_W*.65;
 const short=!empty&&Math.random()<.5;
 const distance=empty?0:HEX_W*(.5+Math.random()*2);
 const extra=short?-Math.min(distance,length*(.25+Math.random()*.55)):distance;
 const point={x:aim.x+dx/length*extra-dy/length*scatter,y:aim.y+dy/length*extra*environmentSquash()+dx/length*scatter*environmentSquash()};
 const hit=environmentRayHit(from,point),impact=hit||{...point,height:0,kind:'ground'};
 impact.hex=environmentHex(impact);impact.direction={x:dx/length,y:dy/length*environmentSquash()};impact.deflected=deflected;
 // Optional house rule: intersect the resolved scattered ray, stopping at the first wall.
 if(!empty&&!deflected&&attacker.environmentMissileRoll&&document.getElementById('strayArrowTest')?.checked){
  const ray={x:point.x-from.x,y:(point.y-from.y)/environmentSquash()},rayLength=Math.hypot(ray.x,ray.y)||1;
  const beyond=allUnits().filter(unit=>unit.alive&&!unit.fled&&unit.id!==target.id&&unit.id!==attacker.id).map(unit=>{
   const p=worldPointForHex(unit.x,unit.y),r={x:p.x-from.x,y:(p.y-from.y)/environmentSquash()},along=(r.x*ray.x+r.y*ray.y)/rayLength,side=Math.abs(r.x*ray.y-r.y*ray.x)/rayLength;
   return{unit,along,side,t:along/rayLength};
  }).filter(entry=>entry.along>length&&entry.t<Math.min(1,hit?.t??1)&&entry.side<HEX_W*.25).sort((a,b)=>a.t-b.t)[0];
  if(beyond&&!projectilePathBlockedBetweenHexes(attacker,beyond.unit)){
   impact.strayTargetId=beyond.unit.id;impact.strayPenalty=-6;
   Object.assign(impact,worldPointForHex(beyond.unit.x,beyond.unit.y),{height:15,hex:{x:beyond.unit.x,y:beyond.unit.y}});
  }
 }return impact;
}
function environmentArrowScreen(impact){return screenPointForWorld(impact,impact.height||0);}
async function finishEnvironmentArrow(attacker,impact){
 if(!impact)return;if(impact.windowId){breakCombatWindow(impact.windowId,{cause:'arrow'});return;}
 if(impact.strayTargetId){
  const target=getUnitById(impact.strayTargetId);if(!target?.alive)return;
  const range=longbowRangeBand(attacker,target),bonus=(attacker.missileAttackBonus||0)+dexterityAdjustments(attacker.stats?.dex??10).missile+(range.penalty||0)+attackEffectModifier(attacker,target)-6;
  const roll=resolveMissileAttackD20(d(20),attacker.thaco-effectiveArmorClassForAttack(attacker,target,'small-device-missile'),bonus);
  const protectedMiss=r226NormalMissileProtected(target)||r226LineCrossesWindWall(attacker,target);
  await presentSpellTargetResults(attacker,[{unit:target}],()=>{
   if(!roll.hit||protectedMiss||interceptWithMirrorImage(target,attacker)){
    candidateQueueCombatBeat(target,{category:'direct-result',text:'Stray arrow misses',meta:{outcome:'miss'}});return;
   }
   const bow=getMissileCatalogEntry(attacker.missileCatalogId||'bow-long'),damage=Math.max(1,rollDiceExpression(damageExpressionForSize(bow,target)).total+physicalDamageEffectModifier(attacker,'missile'));
   window.AdventurePartyCombatResults?.physicalHit?.(attacker,target,damage);target.hp=Math.max(0,target.hp-damage);candidateWithDamageBeatContext({category:'direct-damage',source:attacker.name},()=>onUnitDamaged(target,damage));
   log('Stray arrow: '+attacker.name+' hits '+target.name+' for '+damage+' (−6 test penalty).','system');
   if(target.hp<=0){target.alive=false;playAgonySound(target);playDeathSound(target);triggerDeathFx(target);if(target.controller==='mob')markEnemyNeutralized(target);}
  });
  checkCombatVictory();checkPartyDefeat();return;
 }

 if(!impact.wallId&&!inside(impact.hex.x,impact.hex.y))return;const state=combatEnvironment();state.arrows.push({...impact,id:++state.sequence});if(state.arrows.length>256)state.arrows.shift();
}
function drawEnvironmentArrow(arrow){
 let point=arrow;
 if(arrow.wallId){
  const wall=architecturalWalls.find(w=>w.id===arrow.wallId);if(!wall)return;
  const squash=environmentSquash(),dx=wall.b.x-wall.a.x,dy=(wall.b.y-wall.a.y)/squash,length=Math.hypot(dx,dy)||1;
  const sign=dx*(-arrow.direction.y)-(wall.b.y-wall.a.y)*(-arrow.direction.x)>=0?1:-1,side=sign>0?'a':'b',normal={x:-dy/length*sign,z:dx/length*sign};
  const faces=explorationWallGroundSolids(wall).flatMap(s=>s.faces).filter(face=>face.side===side);
  if(!faces.some(face=>explorationEncounterApi.wallFaceFacesCamera(face,screenPointForWorld,squash)))return;
  // The containing hex can lie behind the wall: visibility belongs to its impacted face.
  if(typeof explorationWallFragmentVisible==='function'&&!explorationWallFragmentVisible({points:[arrow]},normal,isArchitecturalWallVisibleToFriendlyParty(wall),wall))return;
  const offset=(wall.thickness||3)/2+.35;
  point={...arrow,x:arrow.x+normal.x*offset,y:arrow.y+normal.z*offset*squash};
 }else if(!isHexVisibleToFriendlyParty(arrow.hex.x,arrow.hex.y))return;
 const tip=environmentArrowScreen(point),tail=screenPointForWorld({x:point.x-arrow.direction.x*16,y:point.y-arrow.direction.y*16},(arrow.height||0)+5);
 ctx.save();ctx.globalAlpha=Math.max(.25,Math.min(1,combatSpriteBrightness({...arrow.hex,alive:true})));if(!arrow.wallId&&typeof queueCombatArrowGpuShadow==='function')queueCombatArrowGpuShadow(tail,tip,{tailHeight:(arrow.height||0)+5,tipHeight:arrow.height||0});drawCombatArrowSilhouette(tail,tip,{tailHeight:(arrow.height||0)+5,tipHeight:arrow.height||0,wall:arrow.wallId?architecturalWalls.find(w=>w.id===arrow.wallId):null});ctx.restore();
}
function drawEnvironmentGroundArrows(){settleCombatBlood();drawCombatBloodStains();for(const arrow of game?.environmentState?.arrows||[])if(!arrow.wallId)drawEnvironmentArrow(arrow);}
async function breakNearbyCombatWindow(unit,preferred=null){
 const windows=(combatSceneTerrain?.windows||[]).filter(window=>!window.broken&&hexDistance(unit,environmentHex(window.center))<=1.5);
 const window=preferred?windows.find(window=>window.id===preferred):windows[0];if(!window||!(unit.attacksRemaining>0))return false;
 await prepareUnitAttackWindup(unit);triggerUnitAttackPose(unit);unit.attacksRemaining--;breakInvisibility(unit,'breaking a window');breakCombatWindow(window.id,{cause:unit.name});updateUi();await presentCombatFrame();return true;
}
async function tryMobBreakCombatWindow(mob){
 const target=hostileCombatantsFor(mob).filter(unit=>unit.alive&&!unit.fled).sort((a,b)=>hexDistance(mob,a)-hexDistance(mob,b))[0];if(!target)return false;
 const hit=environmentRayHit(worldPointForHex(mob.x,mob.y),worldPointForHex(target.x,target.y));if(!hit?.windowId)return false;
 if(await breakNearbyCombatWindow(mob,hit.windowId)){if(mob.attacksRemaining>0)await mobTurn(mob);else endTurn();return true;}return false;
}
async function fireAtEnvironmentHex(actor,hex){
 if(environmentActionInProgress||game.over||combatActionPauseRemaining()>0||spellCastInProgress||!actor?.alive||game.active!==actor.id||!actor.rangedWeapon||!unitHasRangedWeaponInHand(actor)||actor.fullMove)return false;
 if(rejectWindowTarget(actor,hex))return false;
 if(actor.missileCatalogId==='sling'){setCombatMessage('This test uses arrows or crossbow bolts.');return false;}
 r226PreparePlayerAttackRate(actor);if(!(actor.shotsRemaining>0)){setCombatMessage('No shots remaining this round.');return false;}
 const range=longbowRangeBand(actor,hex);if(range.penalty===null){setCombatMessage('Out of missile range.');return false;}
 const candidate=unitAtHex(hex.x,hex.y),target=candidate&&isHexVisibleToFriendlyParty(candidate.x,candidate.y)?candidate:null;environmentActionInProgress=true;
 try{if(target&&target.id!==actor.id){const result=await longbowAttack(actor,target);if(result?.blockedByObstacle||result?.outOfRange||result?.outOfAmmo||result?.blockedBySlow)return false;}else{
   const impact=resolveEnvironmentArrow(actor,hex,{empty:true});await focusRangedAttacker(actor);updateFacingForStep(actor,hex.x-actor.x,hex.y-actor.y);await prepareUnitAttackWindup(actor);
   if(!consumeMissileAmmo(actor)){setCombatMessage('Out of ammunition.');return false;}triggerUnitAttackPose(actor);breakInvisibility(actor,'firing a missile');
   await animateArrowProjectile(actor,{...hex,environmentImpact:impact},false);log(`${actor.name} fires at hex ${hex.x},${hex.y}.`,'system');}
  actor.shotsRemaining=Math.max(0,actor.shotsRemaining-1);if(!actor.shotsRemaining){actor.attacksRemaining=0;exitAimMode(false,false);endTurn();}updateUi();draw();return true;
 }finally{environmentActionInProgress=false;}
}
const environmentControls=document.createElement('div');environmentControls.id='combatEnvironmentControls';environmentControls.innerHTML='<button id="breakCombatWindow" class="combat-action" type="button">Break Window</button><label><input id="strayArrowTest" type="checkbox"> Stray arrows (test)</label>';
document.getElementById('combatCompass').append(environmentControls);
environmentControls.querySelector('button').addEventListener('click',async()=>{const actor=activePlayerControlledUnit();if(!actor||environmentActionInProgress||game.over||game.active!==actor.id||combatActionPauseRemaining()>0)return;environmentActionInProgress=true;try{if(!await breakNearbyCombatWindow(actor))setCombatMessage('Stand beside an intact window with an attack remaining.');else if(!actor.attacksRemaining)endTurn();}finally{environmentActionInProgress=false;}});
for(const name of ['keydown','keyup'])environmentControls.addEventListener(name,event=>event.stopPropagation());

// Explicitly called by the shared updateUi after its standard controls are updated.
function updateEnvironmentAimUi(){
 if(!environmentAimBlocked())return;
 ui.unitInfoRows.insertAdjacentHTML('beforeend','<span>Target</span><span class="bad">INVALID — INTACT WINDOW</span>');
 if(pendingAimAction){const button=document.getElementById('castButton');if(button)button.disabled=true;}
}
