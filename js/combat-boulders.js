// Persistent boulder state and AI/action owner. Uses the existing combat scheduler.
let combatBoulderAssets=null,combatBoulderRules=null;
async function prepareCombatBoulders(){combatBoulderRules??=await import('./combat-boulder-rules.mjs');combatBoulderAssets??=await (await import('./combat-boulder-render.mjs')).createCombatBoulders();}
function initializeCombatBoulders(){
 game.boulders=[];game.boulderRevision=0;combatGpu?.resetBoulderGround?.();
 if(game.session.source!=='combat-test'||game.condition!=='grass')return;
 const sites=[];for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++){
 const p={x,y},w=worldPointForHex(x,y);
 if(!inside(x,y)||isWall(x,y)||isFirBlockedHex(x,y)||allUnits().some(u=>hexDistance(p,u)<2)||isIndoorWorldPoint(w)||combatGpu?.streamSample?.(w.x,w.y)?.depth>.02||combatSceneTerrain?.walkableHex&&!combatSceneTerrain.walkableHex(x,y))continue;
 sites.push(p);
 }
 sites.sort((a,b)=>terrainRand(a.x,a.y,773)-terrainRand(b.x,b.y,773));
 for(const p of sites){if(game.boulders.length>=12)break;if(game.boulders.some(r=>hexDistance(r,p)<3))continue;game.boulders.push({...p,id:'boulder-'+game.boulders.length,variant:game.boulders.length%5,state:'ground',buried:true,spin:0});}
}
function combatBoulderBlocks(x,y){return (game?.boulders||[]).some(r=>r.state==='ground'&&r.x===x&&r.y===y);}
function boulderRevision(){game.boulderRevision=(game.boulderRevision||0)+1;game.treeFallRevision=(game.treeFallRevision||0)+1;combatReachableMovement.cache=null;}
function boulderDent(a,b=a){const p=worldPointForHex(a.x,a.y),q=worldPointForHex(b.x,b.y);combatGpu?.stampBoulderGround?.(p,q,.65*(HEX_W/3.048)/(128/3),.12,a.buried?combatBoulderAssets.profile(a.variant,(HEX_W/3.048)/(128/3)):null);}
function boulderOccupants(cell,source){return allUnits().filter(u=>u!==source&&u.alive&&!u.fled&&occupiedHexes(u).some(p=>p.x===cell.x&&p.y===cell.y));}
function damageByBoulder(source,target,rolled,save){
 const roll=save?d(20):null,saved=save&&roll>=breathSaveTargetForUnit(target),damage=save?combatBoulderRules.boulderSaveDamage(rolled,saved):rolled;
 log(target.name+(save?' saves vs. breath '+roll+' / '+breathSaveTargetForUnit(target)+(saved?' — avoids the boulder.':' — fails.'): ' is hit by the boulder.')+' '+damage+' damage.','system');
 if(!damage)return;window.AdventurePartyCombatResults?.physicalHit?.(source,target,damage);target.hp=Math.max(0,target.hp-damage);onUnitDamaged(target,damage);flashAttack(source,target,true);
 if(target.hp<=0){target.alive=false;playAgonySound(target);playDeathSound(target);triggerDeathFx(target);markEnemyNeutralized(target);}
 updateUi();
}
async function boulderFrames(session,seconds,update){
 const start=performance.now(),duration=combatEffectDuration(seconds*1000);
 while(game===session&&!game.over){const t=Math.min(1,(performance.now()-start)/duration);update(t);await presentCombatFrame();if(t>=1)return true;await new Promise(resolve=>requestCombatAnimationTick(resolve));}return false;
}
async function boulderPickup(unit,rock,session){
 const seconds=unit.treeActionDurations?.PickUp_Kneeling||globalThis.adventurePartyTreeHaulerDurations?.PickUp_Kneeling;
 if(!seconds)throw Error('Boulder pickup animation unavailable');
 faceEntityToward(unit,rock);setUnitActionBanner(unit,'Picking up boulder');let attached=false;
 unit.treeInteraction={name:'PickUp_Kneeling',started:performance.now(),duration:combatEffectDuration(seconds*1000),seconds};
 try{await boulderFrames(session,seconds,t=>{if(t>=.5&&!attached){attached=true;boulderDent(rock);rock.buried=false;rock.state='held';unit.carriedBoulder=rock;boulderRevision();}if(attached)rock.gripBlend=Math.min(1,(t-.5)/.15);});}
 finally{delete unit.treeInteraction;}
}
async function throwCombatBoulder(unit,target,rock,session){
 const range=combatBoulderRules.boulderRange(unitDistance(unit,target));if(range.band==='OUT')return false;
 const raw=d(20),bonus=(unit.missileAttackBonus||0)+dexterityAdjustments(unit.stats?.dex??10).missile+range.penalty+attackEffectModifier(unit,target,'missile');
 const hit=raw===20||(raw!==1&&raw+bonus>=unit.thaco-effectiveArmorClassForAttack(unit,target,'large-missile')),rolled=d(8)+d(8);
 const impact=hit?{x:target.x,y:target.y}:combatBoulderRules.boulderScatter(target,HEX_DIRS,p=>inside(p.x,p.y)&&!isWall(p.x,p.y));
 const origin={x:unit.x,y:unit.y},seconds=unit.treeActionDurations?.Boulder_Throw||globalThis.adventurePartyTreeHaulerDurations?.Boulder_Throw;
 if(!seconds)throw Error('Boulder throw animation unavailable');
 faceEntityToward(unit,impact);breakInvisibility(unit,'throwing a boulder');setUnitActionBanner(unit,'Throwing boulder');
 log(unit.name+' throws: '+range.band+' ('+range.penalty+'), roll '+raw+' '+(hit?'hit':'miss')+'; 2d8 = '+rolled+'.','system');
 unit.treeInteraction={name:'Boulder_Throw',started:performance.now(),duration:combatEffectDuration(seconds*1000),seconds};
 try{
 if(!await boulderFrames(session,seconds*.43,()=>{}))return false;
 delete unit.carriedBoulder;rock.state='flight';rock.from={...origin};rock.to=impact;rock.progress=0;boulderRevision();
 if(!await boulderFrames(session,1.5,t=>{rock.progress=t;}))return false;
 if(game!==session||game.over)return false;
 rock.x=impact.x;rock.y=impact.y;rock.state='rolling';rock.from=impact;rock.to=impact;rock.progress=1;rock.impactAt=performance.now();boulderDent(impact);
 const occupants=boulderOccupants(impact,unit);for(const victim of occupants)damageByBoulder(unit,victim,rolled,!hit||victim!==target);
 let stopped=occupants.length>0||isFirBlockedHex(impact.x,impact.y);let previous=impact;
 if(!stopped)for(const cell of combatBoulderRules.boulderRollCells(origin,impact,HEX_DIRS)){
 if(!inside(cell.x,cell.y)||isWall(cell.x,cell.y)||isFirBlockedHex(cell.x,cell.y)||architecturalWallBlocksWorldLine(worldPointForHex(previous.x,previous.y),worldPointForHex(cell.x,cell.y),'movement'))break;
 rock.from=previous;rock.to=cell;rock.progress=0;const segmentSpin=rock.spin;
 if(!await boulderFrames(session,.7,t=>{rock.progress=t;rock.spin=segmentSpin+t*Math.PI*2;}))return false;
 boulderDent(previous,cell);rock.x=cell.x;rock.y=cell.y;previous=cell;
 const victims=boulderOccupants(cell,unit);for(const victim of victims)damageByBoulder(unit,victim,rolled,true);if(victims.length)break;
 }
 const spin=rock.spin;rock.state='settling';await boulderFrames(session,.7,t=>{rock.spin=spin*(1-t)*(1-t);});
 rock.state='ground';rock.from=null;rock.to=null;rock.progress=0;boulderRevision();return true;
 }finally{delete unit.treeInteraction;delete unit.carriedBoulder;if(game===session&&rock.state!=='ground'){rock.state='ground';rock.from=null;rock.to=null;boulderRevision();}}
}
async function giantBoulderTurn(unit){
 if(!unit.treeHauler||unit.repositoryMobId!=='hill-giant'||unit.carriedTreeLog)return false;
 const session=game,ai=unit.treeHauler;
 if(!unit.carriedBoulder){
 if(ai.stage!=='seek')return false;
 const rocks=(game.boulders||[]).filter(r=>r.state==='ground'&&!r.reservedBy);
 const trees=(game.testTrees||[]).filter(t=>!treeFallFor(t));
 const nearestTree=Math.min(...trees.map(t=>hexDistance(unit,t)));
 rocks.sort((a,b)=>hexDistance(unit,a)-hexDistance(unit,b));
 let rock,path;for(const candidate of rocks){if(hexDistance(unit,candidate)>nearestTree)break;const candidatePath=searchRotatingFootprintPath(unit,unit,{goal:p=>hexDistance(p,candidate)===1});if(candidatePath.value){rock=candidate;path=candidatePath;break;}}if(!rock)return false;
 rock.reservedBy=unit.id;
 try{setUnitActionBanner(unit,'Seeking boulder');await animateMobAlongPath(unit,path.path,unit.move);if(treeHaulerCurrent(unit,session)&&hexDistance(unit,rock)===1)await boulderPickup(unit,rock,session);}
 finally{delete rock.reservedBy;if(treeHaulerCurrent(unit,session))endTurn();}return true;
 }
 try{
 let target=hostileCombatantsFor(unit).filter(t=>unitVisibleToObserver(unit,t)).sort((a,b)=>unitDistance(unit,a)-unitDistance(unit,b))[0];
 if(!target)return true;
 if(unitDistance(unit,target)>10||projectilePathBlocked(unit,target)){
 const path=searchRotatingFootprintPath(unit,unit,{goal:p=>hexDistance(p,target)<=10&&!projectilePathBlocked(p,target)});
 if(path.value)await animateMobAlongPath(unit,path.path,unit.move);
 }
 if(treeHaulerCurrent(unit,session)&&unitDistance(unit,target)<=10&&!projectilePathBlocked(unit,target))await throwCombatBoulder(unit,target,unit.carriedBoulder,session);
 }finally{if(treeHaulerCurrent(unit,session))endTurn();}return true;
}
function updateCombatBoulderCarriers(){for(const u of allUnits()){const r=u.carriedBoulder;if(r&&(!u.alive||u.fled)){delete u.carriedBoulder;r.state='ground';r.x=u.x;r.y=u.y;r.buried=false;boulderRevision();}}}
function queueCombatBoulders(actors){
 for(const r of game.boulders||[]){
 if(r.state==='held')continue;const t=r.progress||0,cell=r.from&&r.to?{x:r.from.x+(r.to.x-r.from.x)*t,y:r.from.y+(r.to.y-r.from.y)*t}:r;
 const h=roundedMovementHex(cell);if(!isHexVisibleToFriendlyParty(h.x,h.y))continue;
 const c=hexCenter(cell.x,cell.y);actors.push({sortY:c.y,sortX:c.x,gpuScenery:true,fn:()=>combatBoulderAssets.draw(combatGpu,r,c,HEX_W/3.048,battlefieldRotation)});
 }
}
