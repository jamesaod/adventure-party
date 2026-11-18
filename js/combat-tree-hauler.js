// One deliberate objective: acquire a tree before engaging combatants.
function configureTreeHauler(unit){
 if(!unit)return;
 Object.assign(unit,{treeHauler:{stage:'seek',tree:null},fleeing:false});
 for(const item of unit.inventory||[])if(['weapon','backup-weapon','shield'].includes(item.slot))item.equipped=false;
 syncFighterEquipment(unit);
}
function treeHaulerCurrent(unit,session){return game===session&&!game.over&&unit.alive&&!unit.fled&&game.active===unit.id;}
function treeHaulerPushDirection(unit,tree){return HEX_DIRS.findIndex(d=>tree.x-unit.x===d.x&&tree.y-unit.y===d.y);}
async function playTreeHaulerAction(unit,name,session,onContact=null){
 const seconds=(unit.treeActionDurations||globalThis.adventurePartyTreeHaulerDurations)?.[name];if(!seconds)throw Error('Treebreaker animation is not ready: '+name);
 const objective=unit.treeHauler,duration=combatEffectDuration(seconds*1000),started=performance.now();unit.treeInteraction={name,started,duration,seconds};let contacted=false;
 try{while(treeHaulerCurrent(unit,session)&&unit.treeHauler===objective){
  const t=Math.min(1,(performance.now()-started)/duration);
  if(onContact&&!contacted&&t>=.55){contacted=true;onContact();}
  await presentCombatFrame();if(t>=1)return true;
  await new Promise(resolve=>requestCombatAnimationTick(resolve));
 }return false;}finally{delete unit.treeInteraction;draw();}
}
function treeHaulerPickupGoal(unit,state){
 const log=state.obstacleCapsules?.find(c=>c.piece==='continuous-oak-trunk');if(!log)return null;
 const center={x:(log.a.x+log.b.x)/2,y:(log.a.y+log.b.y)/2};
 return proxy=>{const p=oakWorldPoint(proxy);return Math.hypot(p.x-center.x,p.y-center.y)<=log.radius+HEX_W*.95*Math.max(1,Math.min(2,(unit.heightInches||72)/72));};
}
async function treeHaulerTurn(unit){
 if(!unit.treeHauler||unit.treeHauler.stage==='armed')return false;
 const session=game,ai=unit.treeHauler;unit.fleeing=false;
 try{
  if(ai.tree&&(!(game.testTrees||[]).includes(ai.tree)||treeFallFor(ai.tree)?.logTaken)){ai.tree=null;ai.stage='seek';}
  if(ai.stage==='seek'){
   const trees=(game.testTrees||[]).filter(t=>!treeFallFor(t));
   const result=searchRotatingFootprintPath(unit,unit,{goal:proxy=>trees.find(tree=>hexDistance(proxy,tree)===1&&prepareOakFallNavigation(tree,{direction:treeHaulerPushDirection(proxy,tree),ignoreUnit:unit}))});
   if(!result.value){setUnitActionBanner(unit,'Waiting for a clear tree');return true;}
   ai.tree=result.value;setUnitActionBanner(unit,'Seeking a tree');
   await animateMobAlongPath(unit,result.path,unit.move);
   if(!treeHaulerCurrent(unit,session)||unit.treeHauler!==ai||hexDistance(unit,ai.tree)!==1)return true;
   const direction=treeHaulerPushDirection(unit,ai.tree),navigation=prepareOakFallNavigation(ai.tree,{direction,ignoreUnit:unit});if(!navigation)return true;
   faceEntityToward(unit,ai.tree);setUnitActionBanner(unit,'Pushing tree');
   if(!await playTreeHaulerAction(unit,'Push_Enter',session))return true;
   if(!fellGodTree(ai.tree,'torn',{direction,ignoreUnit:unit}))return true;
   ai.stage='pickup';await playTreeHaulerAction(unit,'Push_Exit',session);
   // Keep this action/camera until the six-second fall finishes, plus one second.
   const fall=treeFallFor(ai.tree);
   if(treeHaulerCurrent(unit,session)&&unit.treeHauler===ai&&fall){
    centerCameraOn(ai.tree);
    while(treeHaulerCurrent(unit,session)&&unit.treeHauler===ai&&performance.now()<fall.startedAt+7000){
     await presentCombatFrame();
     await new Promise(resolve=>requestCombatAnimationTick(resolve));
    }
   }
   return true;
  }
  const state=treeFallFor(ai.tree);if(!state){ai.stage='seek';ai.tree=null;return true;}
  if(!oakDebrisSettled(state)){setUnitActionBanner(unit,'Waiting for tree to settle');return true;}
  const goal=treeHaulerPickupGoal(unit,state);if(!goal){ai.stage='seek';ai.tree=null;return true;}
  const result=searchRotatingFootprintPath(unit,unit,{goal});if(!result.value){setUnitActionBanner(unit,'Waiting for a path to the log');return true;}
  setUnitActionBanner(unit,'Approaching fallen log');await animateMobAlongPath(unit,result.path,unit.move);
  if(!treeHaulerCurrent(unit,session)||unit.treeHauler!==ai||!goal(unit))return true;
  const capsule=state.obstacleCapsules.find(c=>c.piece==='continuous-oak-trunk'),center={x:(capsule.a.x+capsule.b.x)/2,y:(capsule.a.y+capsule.b.y)/2};
  const hex=environmentHex({x:center.x,y:center.y*.568329});faceEntityToward(unit,hex);setUnitActionBanner(unit,'Picking up tree');
  const {treeTrunkClubItem,treeClubForIndividual}=await import('./tree-trunk-club.mjs');
  const club=treeClubForIndividual(ai.tree);
  await playTreeHaulerAction(unit,'PickUp_Kneeling',session,()=>{
   if(state.logTaken)return;
   unit.carriedTreeLog={clubId:club.id,sourceTree:ai.tree,lengthMetres:club.tree.lengthMetres};
   state.logTaken=true;state.obstacleCapsules=state.obstacleCapsules.filter(c=>c.piece!=='continuous-oak-trunk');state.blockedHexes=oakBlockedCells(state.obstacleCapsules);state.reservationCapsules=state.obstacleCapsules;state.reservedHexes=state.blockedHexes;
   for(const item of unit.inventory||[])if(['weapon','backup-weapon','shield'].includes(item.slot))item.equipped=false;
   unit.inventory.push(treeTrunkClubItem(club.id));
   syncFighterEquipment(unit);ai.stage='armed';game.treeFallRevision=(game.treeFallRevision||0)+1;combatReachableMovement.cache=null;combatFirTrees.clearDirectShadows(ai.tree.tileIndex);
   log(unit.name+' lifts the fallen trunk and wields it as a club.','system');
  });if(ai.stage==='armed'&&treeHaulerCurrent(unit,session))setUnitActionBanner(unit,'Tree as Club ready — attacks next turn');return true;
 }catch(error){console.error(error);log('Tree hauler: '+error.message,'system');return true;}
 finally{if(treeHaulerCurrent(unit,session))endTurn();}
}
