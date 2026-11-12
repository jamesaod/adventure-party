// Race/weapon policy, shared by hostile and friendly AI-controlled archers.
function isElvenBowTactician(unit){return globalThis.AdventurePartyRaces?.raceIdOf(unit)==='elf'&&(/^bow-/.test(unit.missileCatalogId||'')||(unit.inventory||[]).some(i=>/^bow-/.test(i.catalogMissileWeaponId||'')||i.weaponPoseProfileId==='bow'));}
function elvenArcherPositionPlan(unit){
 const targets=rangedAiOpponents(unit).filter(e=>e.alive&&!e.fled&&unitVisibleToObserver(unit,e));if(!targets.length)return null;
 const short=Math.max(1,unit.missileRangeIncrementHexes||7),medium=Math.min(short*2,unit.missileMaxRangeHexes||short*3),melee=targets.filter(e=>!unitHasRangedWeaponInHand(e)&&!e.fleeing&&!['sleep','unconscious','stunned'].some(id=>getUnitEffect(e,id)));
 const budget=Math.max(0,Math.floor((unit.move||0)-(unit.turnMoves||0))),start={x:unit.x,y:unit.y},queue=[{...start,path:[start]}],seen=new Set([key(start.x,start.y)]);
 const score=node=>{const proxy=rangedAiSourceEntity(unit,node);const gap=Math.min(...targets.map(t=>{const d=unitDistance(proxy,t);return Math.max(0,short+1-d,d-medium)+(rangedAiCanAttackFrom(unit,node,t)?0:3);}));const pressure=Math.max(0,...melee.map(e=>short+1-unitDistance(proxy,e)));return gap+pressure*2;};
 const initial=score(start);let best=null,bestScore=initial;
 for(let i=0;i<queue.length&&i<4096;i++){
  const cur=queue[i],value=score(cur);if(value<bestScore){best=cur;bestScore=value;if(value===0)break;}
  if(cur.path.length-1>=budget)continue;
  for(const dir of HEX_DIRS){const next={x:cur.x+dir.x,y:cur.y+dir.y},id=key(next.x,next.y);if(seen.has(id)||!inside(next.x,next.y)||unitTransitionBlocked(unit,cur,next))continue;
   const from=rangedAiSourceEntity(unit,cur),to=rangedAiSourceEntity(unit,next);
   if(leavingHexFreeAttackers(from,next).length||targets.some(e=>unitCanMakeLeavingHexFreeAttack(e,to)))continue;
   if(typeof r220MobHazardCostAt==='function'&&r220MobHazardCostAt(unit,next.x,next.y)>0)continue;
   seen.add(id);queue.push({...next,path:[...cur.path,next]});
  }
 }
 return best?{path:best.path,score:bestScore}:null;
}
async function repositionElvenArcher(unit){
 if(!isElvenBowTactician(unit)||unit.fleeing||getUnitEffect(unit,'taunt'))return false;
 const engaged=rangedAiOpponents(unit).filter(e=>unitCanMakeLeavingHexFreeAttack(e,unit));
 if(engaged.length){
  const target=engaged.find(e=>!unitHasRangedWeaponInHand(unit)&&canMeleeAttackTarget(unit,e));
  if(target)await repositoryMobAttack(unit,target);else if(canMobGuard(unit))enterMobGuard(unit,'holds position to avoid an opportunity attack');
  if(!game.over)endTurn();return true;
 }
 if(!unitHasRangedWeaponInHand(unit)||!(unit.missileAmmoQuantity>0))return false;
 const plan=elvenArcherPositionPlan(unit);if(!plan)return false;
 log(`${unit.name} repositions toward medium bow range.`,'system');
 plan.path=prepareCombatWalkPath(unit,plan.path);
 const priorMoves=unit.turnMoves||0;let index=1;await animateEntitySteps(unit,plan.path.length-1,()=>{const next=plan.path[index++];return next&&!leavingHexFreeAttackers(unit,next).length?next:null;},105);
 unit.turnMoves=priorMoves+Math.max(0,plan.path.findIndex(p=>p.x===unit.x&&p.y===unit.y));
 if(game.over)return true;
 if(!unit.alive||areaEffectActionLostThisTurn(unit)||(unit.turnMoves||0)>(unit.halfMove||0)){endTurn();return true;}
 return false;
}
