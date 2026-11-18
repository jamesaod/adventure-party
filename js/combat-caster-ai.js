/* Shared tactical caster policy. Decisions run on turns, never render frames.
 * Spell execution, preparation consumption and saves remain in existing owners. */
const CASTER_SPELL_TACTICS=Object.freeze({
 'magic-missile':{role:'offensive',damage:level=>3.5*Math.min(5,1+Math.floor((level-1)/2))},
 'sleep':{role:'controller',area:'sleep',effect:'sleep'},
 'fireball':{role:'offensive',area:'fireball',damage:level=>3.5*Math.min(10,level)},
 'shocking-grasp':{role:'offensive',damage:level=>4.5+level},
 'shield':{role:'defensive',effect:'shield'},
 'armor':{role:'defensive',effect:'armor'},
 'mirror-image':{role:'defensive',effect:'mirror-image'},
 'protection-from-evil':{role:'defensive',effect:'protection-from-evil'},
 'priest-cure-light-wounds':{role:'support',healing:4.5},
 'priest-cure-serious-wounds':{role:'support',healing:11},
 'priest-cure-critical-wounds':{role:'support',healing:16.5}
});
function casterHelpless(unit){return ['sleep','held-person','held-undead'].some(id=>getUnitEffect(unit,id));}
function casterDecisionContext(unit){
 const visible=allUnits().filter(u=>u.alive&&!u.fled&&(u===unit||unitVisibleToObserver(unit,u)));
 return {enemies:visible.filter(u=>u.faction!==unit.faction),allies:visible.filter(u=>u.faction===unit.faction),rejections:new Set()};
}
function casterWeaponScore(unit,context){
 return context.enemies.some(e=>canMeleeAttackTarget(unit,e)&&casterHelpless(e))?65:
  context.enemies.some(e=>canMeleeAttackTarget(unit,e))?24:0;
}
function casterSpellChoices(unit,source,context){
 if(unit.classId==='mage')return wizardSpellChoices(unit,source,context);
 const ids=unit.classId==='cleric'?unit.memorizedPriestSpellIds:unit.memorizedSpellIds;
 const policy=unit.workshopBehavior||{},spending={conserve:18,balanced:7,aggressive:0}[policy.spellSpending||'balanced'];
 const danger=context.enemies.filter(e=>!casterHelpless(e)&&unitCanMakeLeavingHexFreeAttack(e,{...unit,x:source.x,y:source.y})).length;
 const choices=[];
 for(const id of new Set(ids||[])){
  const spell=getSpellEntry(id),tactic=CASTER_SPELL_TACTICS[id];
  if(!spell?.combatImplemented||!tactic){context.rejections.add(id+': no tactical evaluator');continue;}
  const level=unit.workshopSpellCasterLevels?.[id]||unit.level||1;
  const range=spell.targetMode==='self'?0:spellRangeHexes(spell,level);
  const candidates=tactic.role==='support'?context.allies:tactic.role==='defensive'?(spell.targetMode==='self'?[unit]:context.allies):context.enemies;
  for(const target of candidates){
   const targetPoint=target===unit?source:target;
   if(hexDistance(source,targetPoint)>range||lineOfSightBlocked(source,targetPoint))continue;
   let score=0,reason='';
   if(tactic.area){
    const cells=tactic.area==='sleep'?hexesWithinRadius(target,1):fireballBlastCells(target);
    const affected=livingUnitsInAreaCells(cells).filter(u=>u!==unit);
    // Include the caster at the proposed position, not its old position.
    if(cells.some(c=>c.x===source.x&&c.y===source.y))affected.push(unit);
    const friends=affected.filter(u=>u.faction===unit.faction);
    if(friends.length&&policy.spellFriendlyFire!=='permitted'){context.rejections.add(id+': allies in area');continue;}
    const victims=affected.filter(u=>context.enemies.includes(u));
    if(tactic.area==='sleep'){
     const eligible=victims.filter(u=>!casterHelpless(u)&&spellHitDiceValue(u)<4.375).sort((a,b)=>spellHitDiceValue(a)-spellHitDiceValue(b));
     let hd=0,count=0;for(const u of eligible){hd+=Math.max(.5,spellHitDiceValue(u));if(hd>5)break;count++;}
     score=count*39;reason='disable '+count+' active enemies';
    }else{score=victims.reduce((n,u)=>n+Math.min(u.hp||10,tactic.damage(level))*3+(u.hp<=tactic.damage(level)?18:0),0);reason='area damage to '+victims.length+' enemies';}
    score-=friends.length*55;
   }else if(tactic.healing){
    const missing=Math.max(0,(target.maxHp||0)-(target.hp||0));
    score=Math.min(missing,tactic.healing)*5+(missing>0&&target.hp/target.maxHp<=.35?45:0);reason='heal injured ally';
   }else if(tactic.role==='defensive'){
    if(getUnitEffect(target,tactic.effect)){context.rejections.add(id+': effect already active');continue;}
    const threats=context.enemies.filter(e=>!casterHelpless(e)&&hexDistance(targetPoint,e)<=4).length;
    score=threats?24+Math.min(3,threats)*7+(target.hp/target.maxHp<.5?12:0):0;reason='protect threatened ally';
   }else{
    const damage=tactic.damage(level);score=Math.min(target.hp||damage,damage)*4+(target.hp<=damage?22:0);
    if(casterHelpless(target))score*=.3;reason='damage visible enemy';
   }
   if(score<=0){context.rejections.add(id+': no useful effect');continue;}
   if(policy.spellRole===tactic.role||(policy.spellRole==='support'&&tactic.role==='defensive'))score*=1.2;
   score-=spending+danger*({cautious:12,balanced:6,reckless:0}[policy.spellRisk||'cautious']);
   if(score>0)choices.push({action:{type:unit.classId==='cleric'?'priest-spell':'memorized-spell',spellId:id,casterLevel:level,sourceUnitId:unit.id,spellCommitted:false},target,score,reason});
  }
 }
 return choices.sort((a,b)=>b.score-a.score||a.action.spellId.localeCompare(b.action.spellId)||String(a.target.id).localeCompare(String(b.target.id)));
}
function explainCasterDecision(unit,decision,context){
 const previous=unit.lastSpellAiDecision,same=previous?.round===game.round&&previous.decision===decision;
 unit.lastSpellAiDecision={round:game.round,decision,rejected:[...new Set([...(same?previous.rejected:[]),...context.rejections])].slice(0,8)};
 if(unit.workshopBehavior?.spellExplain&&!same)log(unit.name+': '+decision+([...context.rejections].length?' ('+[...context.rejections].slice(0,3).join('; ')+')':''),'system');
}
