/* Tactical estimates only: no rolls, spending, effect application or animation.
 * One entry per combat-enabled Wizard spell in the Workshop catalog.
 * Add a purpose + evaluator here when admitting another wizard spell. */
const WIZARD_SPELL_TACTICS=Object.freeze({
 'armor':{role:'defensive',purpose:'Improve weak armor',buff:'armor-spell'},
 'burning-hands':{role:'offensive',purpose:'Burn a close enemy fan',shape:'fan1',damage:l=>2+Math.min(20,2*l),save:true},
 'charm-person':{role:'controller',purpose:'Turn an eligible humanoid',control:'charm-person',value:65},
 'chill-touch':{role:'support',purpose:'Prepare for imminent melee',buff:'chill-touch'},
 'color-spray':{role:'controller',purpose:'Disable a close enemy fan',shape:'fan2',control:'color-spray',cap:3.5,value:42},
 'enlarge':{role:'support',purpose:'Strengthen an engaged weapon user',buff:'enlarge'},
 'grease':{role:'controller',purpose:'Trip an active enemy',shape:'cell',control:'prone',persistent:'grease',value:24},
 'light':{role:'controller',purpose:'Blind an enemy or illuminate an ally',control:'blind',value:30,light:true},
 'magic-missile':{role:'offensive',purpose:'Reliable finishing damage',damage:l=>3.5*Math.min(5,1+Math.floor((l-1)/2))},
 'protection-from-evil':{role:'defensive',purpose:'Protect an ally facing evil',buff:'protection-from-evil'},
 'shield':{role:'defensive',purpose:'Protect the caster under threat',buff:'shield'},
 'shocking-grasp':{role:'offensive',purpose:'Deliver electrical touch damage',damage:l=>4.5+l,attack:true},
 'sleep':{role:'controller',purpose:'Disable low-HD active enemies',shape:'radius1',control:'sleep',hd:5,value:39},
 'spook':{role:'controller',purpose:'Drive a living threat away',control:'spook',value:40},
 'taunt':{role:'controller',purpose:'Draw ranged foes toward a protected caster',shape:'taunt',control:'taunt',value:25},
 'wall-of-fog':{role:'controller',purpose:'Screen allies from ranged threats',shape:'wall',screen:true,persistent:'fog'},
 'blindness':{role:'controller',purpose:'Impair an active enemy',control:'blind',value:36},
 'blur':{role:'defensive',purpose:'Reduce incoming attacks',buff:'blur'},
 'continual-light':{role:'controller',purpose:'Blind an enemy or provide lasting light',control:'blind',value:30,light:true},
 'darkness-15-radius':{role:'controller',purpose:'Deny enemy firing lanes',shape:'radius1',screen:true,persistent:'darkness'},
 'deafness':{role:'controller',purpose:'Disrupt verbal spellcasting',control:'deafness',value:26},
 'detect-invisibility':{role:'support',purpose:'Investigate a recently lost nearby foe',buff:'detect-invisibility'},
 'flaming-sphere':{role:'offensive',purpose:'Burn an occupied position and its neighbors',shape:'radius1',damage:()=>5,save:true,persistent:'flaming-sphere'},
 'fog-cloud':{role:'controller',purpose:'Screen allies from enemy missiles',shape:'radius1',screen:true,persistent:'fog'},
 'glitterdust':{role:'controller',purpose:'Blind a group and reveal concealment',shape:'radius1',control:'blind',value:32},
 'hypnotic-pattern':{role:'controller',purpose:'Fascinate a group within the HD budget',shape:'radius1',control:'hypnotic-pattern',hd:24,value:40},
 'invisibility':{role:'defensive',purpose:'Protect a wounded or exposed ally',buff:'invisibility'},
 'melfs-acid-arrow':{role:'offensive',purpose:'Apply ongoing damage to a durable foe',damage:l=>5*(1+Math.min(2,Math.floor(l/3))),attack:true,effect:'acid-arrow'},
 'mirror-image':{role:'defensive',purpose:'Protect the caster with decoys',buff:'mirror-image'},
 'pyrotechnics':{role:'controller',purpose:'Use an existing sphere to blind enemies',shape:'fireworks',control:'blind',value:30,fireSource:true},
 'ray-of-enfeeblement':{role:'controller',purpose:'Weaken an active weapon threat',control:'ray-enfeeblement',value:34},
 'scare':{role:'controller',purpose:'Scatter eligible low-HD enemies',shape:'radius1',control:'scare',value:36},
 'spectral-hand':{role:'support',purpose:'Prepare safe delivery of a remaining touch spell',buff:'spectral-hand'},
 'stinking-cloud':{role:'controller',purpose:'Disable an enemy group with nausea',shape:'radius1',control:'nauseated',persistent:'stinking-cloud',value:35},
 'strength':{role:'support',purpose:'Increase an engaged ally’s weapon strength',buff:'strength-spell'},
 'tashas-hideous-laughter':{role:'controller',purpose:'Disable intelligent enemies',shape:'radius1',control:'hideous-laughter',cap:l=>Math.max(1,Math.floor(l/3)),value:42},
 'web':{role:'controller',purpose:'Restrain advancing enemies',shape:'radius1',control:'webbed',persistent:'web',value:36},
 'fireball':{role:'offensive',purpose:'Damage a safely isolated enemy group',shape:'fireball',damage:l=>3.5*Math.min(10,l),save:true}
});
function wizardDisabled(u){return casterHelpless(u)||['unconscious','stunned','hypnotic-pattern','nauseated','hideous-laughter'].some(id=>getUnitEffect(u,id));}
function wizardRanged(u){return !!(u.rangedWeapon||u.r230CastingToken||['mage','cleric'].includes(u.classId));}
function wizardThreat(u){return 1+(u.r230CastingToken?.length?0.4:0)+Math.min(0.4,Math.max(0,(u.attacksPerRound||1)-1)*.15);}
function wizardAreaCells(tactic,source,target,level){
 switch(tactic.shape){
  case 'fan1':return directionalWedgeCells(source,target,1,Math.PI/3);
  case 'fan2':return directionalWedgeCells(source,target,2,Math.PI/3);
  case 'radius1':return hexesWithinRadius(target,1);
  case 'taunt':return hexesWithinRadius(target,3);
  case 'cell':return [{x:target.x,y:target.y}];
  case 'wall':return createWallOfFogCells(source,target,level).filter(p=>inside(p.x,p.y));
  case 'fireball':return fireballBlastCells(target);
  case 'fireworks':return hexesWithinRadius(target,12);
  default:return [];
 }
}
function wizardControlEligible(id,tactic,target){
 if(wizardDisabled(target)||getUnitEffect(target,tactic.control))return false;
 if(['spook','scare','taunt'].includes(id)&&(target.fleeing||getUnitEffect(target,'spook')||getUnitEffect(target,'scare')))return false;
 if(id==='sleep')return !isUndeadUnit(target)&&spellHitDiceValue(target)<4.375;
 if(id==='charm-person')return isCharmPersonEligible(target);
 if(id==='spook'||id==='taunt')return !isUndeadUnit(target);
 if(id==='scare')return spellHitDiceValue(target)<6&&!isUndeadUnit(target)&&!target.isExtraplanar&&!target.extraplanar;
 if(id==='tashas-hideous-laughter')return (Number(target.stats?.int)||3)>4;
 if(id==='deafness')return !!target.r230CastingToken||['mage','cleric'].includes(target.classId);
 if(id==='ray-of-enfeeblement')return !['mage'].includes(target.classId)||target.weapon&&target.weapon!=='Unarmed';
 return true;
}
function wizardBuffScore(id,unit,source,target,context){
 const p=target===unit?source:target,enemies=context.enemies.filter(e=>!wizardDisabled(e));
 const nearby=enemies.filter(e=>hexDistance(p,e)<=4),engaged=enemies.some(e=>hexDistance(p,e)<=2),wounded=target.hp/target.maxHp<.5;
 switch(id){
  case 'armor':{const ac=6+(target.stats?.dex!==undefined?dexterityAdjustments(target.stats.dex).defensive:0);return target.ac>ac&&nearby.length?24+(target.ac-ac)*4:0;}
  case 'strength':return (target.stats?.str||10)<18&&engaged&&!['mage'].includes(target.classId)?32+Math.min(6,18-(target.stats?.str||10))*2:0;
  case 'enlarge':return engaged&&(target.weapon&&target.weapon!=='Unarmed'||target.treeHauler)?36:0;
  case 'chill-touch':return engaged?30:0;
  case 'spectral-hand':return unit.hp>4&&(unit.memorizedSpellIds||[]).some(s=>['shocking-grasp','vampiric-touch'].includes(s))&&enemies.some(e=>hexDistance(source,e)>1&&hexDistance(source,e)<=6)?33:0;
  case 'detect-invisibility':return Object.values(unit.mobAiMemory?.targets||{}).some(r=>!context.enemies.some(e=>e.id===r.targetId)&&(game.round-r.lastSeenRound)<=2&&hexDistance(source,r)<=Math.max(1,levelForWizard(unit,id))&&!lineOfSightBlocked(source,r))?34:0;
  case 'invisibility':return nearby.length&&(wounded||target.rangedWeapon||target.classId==='mage')?38+(wounded?12:0):0;
  case 'protection-from-evil':return nearby.some(e=>String(e.alignment||e.workshopDefinition?.creature?.identity?.alignment||'').includes('evil'))?34:0;
  default:return nearby.length?24+Math.min(3,nearby.length)*7+(wounded?12:0):0;
 }
}
function levelForWizard(unit,id){return unit.workshopSpellCasterLevels?.[id]||unit.level||1;}
function wizardScreenScore(cells,source,context){
 const keys=new Set(cells.map(p=>key(p.x,p.y))),crosses=(a,b)=>hexLineCells(a,b).some(p=>keys.has(key(p.x,p.y)));
 let score=0;for(const enemy of context.enemies){if(wizardDisabled(enemy)||!wizardRanged(enemy))continue;for(const ally of context.allies){const p=ally.id===source.id?source:ally;if(hexDistance(p,enemy)>1&&crosses(p,enemy))score+=ally.hp/ally.maxHp<.5?24:13;}}
 for(const ally of context.allies)if(wizardRanged(ally))for(const enemy of context.enemies)if(crosses(ally.id===source.id?source:ally,enemy))score-=12;
 return score;
}
function wizardSpellChoices(unit,source,context){
 const policy=unit.workshopBehavior||{},spend={conserve:18,balanced:7,aggressive:0}[policy.spellSpending||'balanced'];
 const proxy={...unit,x:source.x,y:source.y},danger=context.enemies.filter(e=>!wizardDisabled(e)&&unitCanMakeLeavingHexFreeAttack(e,proxy)).length;
 const choices=[],candidateCache=context.wizardCandidates??=new Map(),areaCache=context.wizardAreas??=new Map();
 for(const id of new Set(unit.memorizedSpellIds||[])){
  const tactic=WIZARD_SPELL_TACTICS[id],spell=getSpellEntry(id),level=levelForWizard(unit,id);
  if(!tactic||!spell?.combatImplemented){context.rejections.add(id+': no wizard tactical evaluator');continue;}
  const range=spell.targetMode==='direction'?Infinity:spell.targetMode==='self'?0:spellRangeHexes(spell,level);
  let candidates=candidateCache.get(id);
  if(!candidates){candidates=tactic.buff?(spell.targetMode==='self'?[unit]:context.allies):tactic.light?[...context.enemies,...context.allies]:context.enemies;
  if(tactic.fireSource)candidates=flamingSphereEffects().flatMap(e=>e.cells||[]).filter(p=>isHexVisibleFromObserver(unit,p.x,p.y)&&!lineOfSightBlocked(source,p));
  else if(tactic.shape&&!['fan1','fan2','taunt'].includes(tactic.shape)){
   const points=new Map();for(const e of context.enemies){for(const p of hexesWithinRadius(e,1))points.set(key(p.x,p.y),{...p,id:'aim:'+key(p.x,p.y)});}candidates=[...points.values()].slice(0,96);
  }
  candidateCache.set(id,candidates);}
  for(const target of candidates){
   const targetPoint=target===unit?source:target;
   if(hexDistance(source,targetPoint)>range||lineOfSightBlocked(source,targetPoint))continue;
   const effect=tactic.buff||tactic.effect;
   if(effect&&getUnitEffect(target,effect)){context.rejections.add(id+': effect already active');continue;}
   let score=0,reason=tactic.purpose,friendCount=0;
   if(tactic.buff)score=wizardBuffScore(id,unit,source,target,context);
   else if(tactic.light&&target.faction===unit.faction){
    if(!getUnitEffect(target,id)&&typeof illuminationAtHex==='function'&&illuminationAtHex(targetPoint.x,targetPoint.y)<.35)score=30;
    reason='illuminate an ally in darkness';
   }else if(tactic.shape){
    const cacheable=!['fan1','fan2','wall'].includes(tactic.shape),areaKey=id+':'+target.x+','+target.y;
    let area=cacheable?areaCache.get(areaKey):null;
    if(!area){const cells=wizardAreaCells(tactic,proxy,target,level);area={cells,affected:livingUnitsInAreaCells(cells).filter(u=>u!==unit)};if(cacheable)areaCache.set(areaKey,area);}
    const cells=area.cells;let affected=area.affected.slice();
    const footprint=typeof occupiedHexesAt==='function'?occupiedHexesAt(unit,source.x,source.y):[source];
    if(cells.some(p=>footprint.some(q=>p.x===q.x&&p.y===q.y)))affected.push(unit);
    if(['scare','pyrotechnics','tashas-hideous-laughter','color-spray','taunt'].includes(id))affected=affected.filter(u=>u!==unit);
    if(id==='pyrotechnics')affected=affected.filter(u=>!lineOfSightBlocked(target,u));
    if(id==='taunt')affected=affected.filter(u=>u.faction!==unit.faction&&(u.type||u.name)===(target.type||target.name));
    friendCount=affected.filter(u=>u.faction===unit.faction).length;
    if(!tactic.screen&&friendCount&&policy.spellFriendlyFire!=='permitted'){context.rejections.add(id+': allies in area');continue;}
    if(tactic.screen)score=wizardScreenScore(cells,proxy,context);
    else{
     let victims=affected.filter(u=>context.enemies.includes(u));
     if(id==='sleep')victims=victims.filter(u=>!isUndeadUnit(u)&&spellHitDiceValue(u)<4.375);
     if(id==='tashas-hideous-laughter')victims=victims.filter(u=>(Number(u.stats?.int)||3)>4);
     if(id==='taunt'&&(unit.hp/unit.maxHp<.6||!context.allies.some(a=>a!==unit&&hexDistance(source,a)<=2))){context.rejections.add(id+': unsafe to lure enemies');continue;}
     if(id==='taunt')victims=victims.filter(wizardRanged);
     if(tactic.hd){let hd=0;victims=victims.slice().sort((a,b)=>spellHitDiceValue(a)-spellHitDiceValue(b)).filter(u=>{const n=spellHitDiceValue(u);if(hd+n>tactic.hd)return false;hd+=n;return true;});}
     else victims.sort((a,b)=>hexDistance(id==='color-spray'?source:target,a)-hexDistance(id==='color-spray'?source:target,b));
     const cap=typeof tactic.cap==='function'?tactic.cap(level):tactic.cap||Infinity;
     for(let i=0;i<victims.length&&i<Math.ceil(cap);i++){const u=victims[i],weight=Math.min(1,cap-i);if(tactic.control&&!wizardControlEligible(id,tactic,u))continue;if(tactic.damage){const damage=id==='flaming-sphere'&&hexDistance(target,u)>0?2.5:tactic.damage(level);score+=weight*wizardDamageScore(damage,u,tactic,true);}else score+=weight*tactic.value*wizardThreat(u)*(id==='sleep'?1:.7);}
    }
    if(tactic.persistent){const existing=(game.areaEffects||[]).filter(e=>(e.expiresRound==null||e.expiresRound>game.round)&&(e.spellKind||e.type)===tactic.persistent);const repeated=cells.filter(p=>existing.some(e=>(e.cells||[]).some(q=>p.x===q.x&&p.y===q.y))).length;score*=cells.length?1-repeated/cells.length:0;}
    if(!tactic.screen)score-=friendCount*55;
   }else if(tactic.damage){if(id==='magic-missile'&&getUnitEffect(target,'shield')){context.rejections.add(id+': visible Shield protection');continue;}score=wizardDamageScore(tactic.damage(level),target,tactic,false);}
   else if(tactic.control&&wizardControlEligible(id,tactic,target))score=tactic.value*.7*wizardThreat(target);
   if(score<=0){context.rejections.add(id+': no useful effect');continue;}
   if(policy.spellRole===tactic.role||(policy.spellRole==='support'&&tactic.role==='defensive'))score*=1.2;
   const emergencyDefense=tactic.role==='defensive'&&target===unit&&unit.hp/unit.maxHp<.35;
   // When retreat is blocked, casting protection must compete with weak melee.
   const castingRisk={cautious:12,balanced:6,reckless:0}[policy.spellRisk||'cautious'];
   score-=spend+danger*castingRisk*(emergencyDefense?.25:1);
   if(emergencyDefense)reason+=' (urgent self-protection)';
   if(score>0)choices.push({action:{type:'memorized-spell',spellId:id,casterLevel:level,sourceUnitId:unit.id,spellCommitted:false},target,score,reason});
  }
 }
 return choices.sort((a,b)=>b.score-a.score||a.action.spellId.localeCompare(b.action.spellId)||String(a.target.id).localeCompare(String(b.target.id)));
}
function wizardDamageScore(damage,target,tactic,area){
 const expected=damage*(tactic.save ? .8 : tactic.attack ? .65 : 1);
 let score=Math.min(target.hp||expected,expected)*(area?3:4)+(target.hp<=expected?20:0);
 if(wizardDisabled(target))score*=.3;
 return score;
}
