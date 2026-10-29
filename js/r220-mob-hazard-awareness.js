/*
  R220 — MOB HAZARD AWARENESS
  ===========================
  Reusable tactical hazard intelligence for MOBs.

  Design goals:
  - MOBs reason from perceived/remembered information, not hidden game state.
  - Intelligence affects recognition, memory, and willingness to accept risk.
  - Hazards modify path COST rather than becoming universal hard blockers.
  - Ranged/caster roles value LOS hazards more heavily than melee roles.
  - Personal experience and witnessed consequences teach low-INT creatures.
  - Target pursuit uses current LOS or last-known position; hidden movement is
    not tracked perfectly.
*/

const R220_MOB_HAZARD_REGISTRY=Object.freeze({
  grease:Object.freeze({
    kind:"grease",
    label:"Grease",
    baseRisk:5,
    recognitionInt:5,
    obviousness:0.55,
    consequence:"fall",
    role:Object.freeze({melee:0.95,ranged:1.0,caster:1.05})
  }),
  web:Object.freeze({
    kind:"web",
    label:"Web",
    baseRisk:9,
    recognitionInt:3,
    obviousness:0.90,
    consequence:"restraint",
    role:Object.freeze({melee:1.0,ranged:1.05,caster:1.15})
  }),
  "wall-of-fog":Object.freeze({
    kind:"wall-of-fog",
    label:"Wall of Fog",
    baseRisk:4,
    recognitionInt:5,
    obviousness:1.0,
    consequence:"lost-los",
    role:Object.freeze({melee:0.55,ranged:1.75,caster:2.0})
  }),
  "fog-cloud":Object.freeze({
    kind:"fog-cloud",
    label:"Fog Cloud",
    baseRisk:5,
    recognitionInt:6,
    obviousness:1.0,
    consequence:"lost-los",
    role:Object.freeze({melee:0.60,ranged:1.85,caster:2.10})
  }),
  "stinking-cloud":Object.freeze({
    kind:"stinking-cloud",
    label:"Stinking Cloud",
    baseRisk:12,
    recognitionInt:7,
    obviousness:0.95,
    consequence:"poison-nausea",
    role:Object.freeze({melee:1.05,ranged:1.30,caster:1.45})
  }),
  darkness:Object.freeze({
    kind:"darkness",
    label:"Darkness",
    baseRisk:6,
    recognitionInt:6,
    obviousness:1.0,
    consequence:"lost-los",
    role:Object.freeze({melee:0.70,ranged:1.70,caster:1.90})
  }),
  "flaming-sphere":Object.freeze({
    kind:"flaming-sphere",
    label:"Flaming Sphere",
    baseRisk:11,
    recognitionInt:2,
    obviousness:1.0,
    consequence:"fire",
    role:Object.freeze({melee:1.0,ranged:1.0,caster:1.0})
  })
});

function r220Clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function r220MobIntelligenceScore(unit){
  const stat=Number(unit?.stats?.int);
  if(Number.isFinite(stat)) return r220Clamp(Math.floor(stat),0,25);

  const explicit=Number(unit?.intelligenceScore);
  if(Number.isFinite(explicit)) return r220Clamp(Math.floor(explicit),0,25);

  const label=String(unit?.intelligence || "").trim().toLowerCase();
  const range=label.match(/(\d+)\s*-\s*(\d+)/);
  if(range){
    return r220Clamp(
      Math.round((Number(range[1])+Number(range[2]))/2),
      0,
      25
    );
  }

  const single=label.match(/\b(\d+)\b/);
  if(single){
    return r220Clamp(Number(single[1]),0,25);
  }

  if(label.includes("non")) return 0;
  if(label.includes("animal")) return 1;
  if(label.includes("semi")) return 3;
  if(label.includes("low")) return 6;
  if(label.includes("average")) return 9;
  if(label.includes("very")) return 12;
  if(label.includes("high")) return 14;
  if(label.includes("exceptional")) return 16;
  if(label.includes("genius") && !label.includes("supra")) return 18;
  if(label.includes("supra")) return 20;

  if(isKoboldUnit(unit)) return 9;
  if(unit?.type==="orc" || unit?.species==="orc") return 9;
  if(unit?.type==="juvenile-red-dragon" || unit?.species==="red-dragon"){
    return 16;
  }

  return 8;
}

function r220MobIntelligenceBand(unit){
  const intelligence=r220MobIntelligenceScore(unit);

  if(intelligence<=1) return "instinctive";
  if(intelligence<=4) return "semi";
  if(intelligence<=7) return "low";
  if(intelligence<=10) return "average";
  if(intelligence<=14) return "smart";
  return "exceptional";
}

function r220MobRole(unit){
  if(!unit) return "melee";

  if(
    unit.type==="mage" ||
    Array.isArray(unit.memorizedSpellIds) ||
    unit.spellcaster
  ){
    return "caster";
  }

  if(
    unit.rangedWeapon ||
    Number(unit.missileRateOfFire)>0
  ){
    return "ranged";
  }

  return "melee";
}

function r220MobMemory(unit){
  if(!unit) return null;

  if(!unit.mobAiMemory || typeof unit.mobAiMemory!=="object"){
    unit.mobAiMemory={
      hazards:Object.create(null),
      targets:Object.create(null)
    };
  }

  if(!unit.mobAiMemory.hazards){
    unit.mobAiMemory.hazards=Object.create(null);
  }

  if(!unit.mobAiMemory.targets){
    unit.mobAiMemory.targets=Object.create(null);
  }

  return unit.mobAiMemory;
}

function r220HazardKindForEffect(effect){
  if(!effect) return null;

  if(effect.type==="grease") return "grease";
  if(effect.type==="web") return "web";
  if(effect.type==="darkness") return "darkness";
  if(effect.type==="flaming-sphere") return "flaming-sphere";

  if(effect.type==="fog"){
    if(effect.spellKind==="stinking-cloud") return "stinking-cloud";
    if(effect.spellKind==="fog-cloud") return "fog-cloud";
    return "wall-of-fog";
  }

  return null;
}

function r220HazardDefinition(effect){
  const kind=r220HazardKindForEffect(effect);
  return kind ? R220_MOB_HAZARD_REGISTRY[kind] || null : null;
}

function r220HazardId(effect){
  const kind=r220HazardKindForEffect(effect) || "hazard";
  return String(effect?.id || `${kind}:anonymous`);
}

function r220HazardsAtCell(x,y){
  if(!game) return [];

  const result=[];

  for(const effect of game.areaEffects || []){
    const definition=r220HazardDefinition(effect);
    if(!definition) continue;

    if(
      effect.type==="darkness" &&
      !hasEffectiveDarknessAtHex(x,y)
    ){
      continue;
    }

    if(areaEffectContains(effect,x,y)){
      result.push({effect,definition});
    }
  }

  return result;
}

function r220MobCanPerceiveHazardCell(mob,cell){
  if(
    !mob?.alive ||
    mob.fled ||
    !cell ||
    !inside(cell.x,cell.y)
  ){
    return false;
  }

  if(mob.x===cell.x && mob.y===cell.y){
    return true;
  }

  if(architecturalWallBlocksLOS(mob,cell)){
    return false;
  }

  /*
    Dense obscuration between observer and hazard blocks perception, but the
    destination hazard cell itself is allowed to be seen as the visible cloud/
    darkness boundary.
  */
  if(hasObscuringMagicAtHex(mob.x,mob.y)){
    return false;
  }

  const line=hexLineCells(mob,cell);

  return !line.some((step,index)=>
    index>0 &&
    index<line.length-1 &&
    hasObscuringMagicAtHex(step.x,step.y)
  );
}

function r220MobCanPerceiveHazardEffect(mob,effect){
  return (effect?.cells || []).some(cell=>
    r220MobCanPerceiveHazardCell(mob,cell)
  );
}

function r220HazardKnowledgeEntry(mob,effect,definition){
  const memory=r220MobMemory(mob);
  if(!memory || !effect || !definition) return null;

  const id=r220HazardId(effect);
  let entry=memory.hazards[id];

  if(!entry){
    entry=memory.hazards[id]={
      id,
      kind:definition.kind,
      perceived:false,
      recognized:false,
      experienced:false,
      observedConsequence:false,
      lastSeenRound:null,
      lastExperiencedRound:null,
      lastObservedRound:null,
      perceptionToken:null,
      seenCells:Object.create(null)
    };
  }

  const token=`${game?.round || 0}:${game?.turnIndex || 0}`;

  if(entry.perceptionToken!==token){
    entry.perceptionToken=token;

    let perceivedAny=false;

    for(const cell of effect.cells || []){
      if(!r220MobCanPerceiveHazardCell(mob,cell)) continue;

      perceivedAny=true;
      entry.seenCells[key(cell.x,cell.y)]=true;
    }

    if(perceivedAny){
      entry.perceived=true;
      entry.lastSeenRound=game?.round || 0;

      const intelligence=r220MobIntelligenceScore(mob);

      if(
        intelligence>=definition.recognitionInt ||
        intelligence>=15 ||
        entry.experienced ||
        entry.observedConsequence
      ){
        entry.recognized=true;
      }
    }
  }

  return entry;
}

function r220LearnHazardFromExperience(mob,effect,{failed=false}={}){
  if(mob?.controller!=="mob") return;

  const definition=r220HazardDefinition(effect);
  if(!definition) return;

  const entry=r220HazardKnowledgeEntry(mob,effect,definition);
  if(!entry) return;

  entry.perceived=true;
  entry.experienced=true;
  entry.recognized=true;
  entry.lastExperiencedRound=game?.round || 0;

  for(const cell of occupiedHexes(mob)){
    if(areaEffectContains(effect,cell.x,cell.y)){
      entry.seenCells[key(cell.x,cell.y)]=true;
    }
  }

  if(failed){
    entry.observedConsequence=true;
    entry.lastObservedRound=game?.round || 0;
  }
}

function r220WitnessHazardConsequence(victim,effect,result){
  if(!game || !victim || !effect) return;

  const definition=r220HazardDefinition(effect);
  if(!definition) return;

  for(const mob of game.enemies || []){
    if(
      mob?.controller!=="mob" ||
      !mob.alive ||
      mob.fled ||
      mob.id===victim.id
    ){
      continue;
    }

    if(hexDistance(mob,victim)>8) continue;

    const witnessCell={x:victim.x,y:victim.y};
    if(!r220MobCanPerceiveHazardCell(mob,witnessCell)) continue;

    const entry=r220HazardKnowledgeEntry(mob,effect,definition);
    if(!entry) continue;

    entry.perceived=true;
    entry.lastSeenRound=game.round;
    entry.seenCells[key(victim.x,victim.y)]=true;

    if(result?.failed || result?.haltMovement){
      entry.observedConsequence=true;
      entry.lastObservedRound=game.round;

      if(r220MobIntelligenceScore(mob)>=2){
        entry.recognized=true;
      }
    }
  }
}

function r220HazardAwareness(mob,effect,definition,cell=null){
  const entry=r220HazardKnowledgeEntry(mob,effect,definition);
  if(!entry) return 0;

  /*
    Knowledge of an effect does not reveal its hidden geometry. A cell behind
    a wall/cloud has no path cost until the MOB has actually perceived or
    experienced that part of the effect.
  */
  if(
    cell &&
    !entry.seenCells[key(cell.x,cell.y)]
  ){
    return 0;
  }

  const intelligence=r220MobIntelligenceScore(mob);

  if(entry.experienced){
    return intelligence<=1 ? 0.65 : 1.0;
  }

  if(entry.observedConsequence){
    return intelligence<=1 ? 0.35 : intelligence<=4 ? 0.75 : 0.95;
  }

  if(entry.recognized){
    if(intelligence<=1) return 0.20;
    if(intelligence<=4) return 0.50;
    if(intelligence<=7) return 0.70;
    if(intelligence<=10) return 0.90;
    if(intelligence<=14) return 1.0;
    return 1.10;
  }

  if(entry.perceived){
    const obvious=definition.obviousness || 0;
    if(intelligence<=1) return 0.04*obvious;
    if(intelligence<=4) return 0.12*obvious;
    if(intelligence<=7) return 0.24*obvious;
    return 0.35*obvious;
  }

  return 0;
}

function r220SaveFailureProbability(unit,kind){
  const targetNumber=
    kind==="stinking-cloud"
      ? poisonSaveTargetForUnit(unit)
      : spellSaveTargetForUnit(unit);

  if(!Number.isFinite(targetNumber)) return 0.5;

  return r220Clamp((targetNumber-1)/20,0.05,0.95);
}

function r220HazardVulnerability(mob,definition){
  switch(definition.kind){
    case "grease":
      return 0.55+r220SaveFailureProbability(mob,"grease");

    case "web":{
      const strength=Math.max(1,Number(mob?.stats?.str)||10);
      const escapeFactor=
        strength>=18 ? 0.55 :
        strength>=13 ? 0.85 :
        1.20;

      return (
        0.65+
        r220SaveFailureProbability(mob,"web")
      )*escapeFactor;
    }

    case "stinking-cloud":
      if(isUndeadUnit(mob)){
        /* Still undesirable as an LOS obstruction even when poison-immune. */
        return 0.35;
      }
      return 0.75+1.15*r220SaveFailureProbability(mob,"stinking-cloud");

    case "flaming-sphere":
      return unitImmuneToDamageType(mob,"fire") ? 0.10 : 1.20;

    case "wall-of-fog":
    case "fog-cloud":
    case "darkness":
      return 1.0;

    default:
      return 1.0;
  }
}

function r220MobUrgencyMultiplier(mob){
  if(!mob) return 1;

  if(mob.fleeing || getUnitEffect(mob,"spook")){
    return 0.40;
  }

  if(getUnitEffect(mob,"taunt")){
    return 0.30;
  }

  const hp=Math.max(0,Number(mob.hp)||0);
  const maxHp=Math.max(1,Number(mob.maxHp)||1);

  if(hp/maxHp<=0.30){
    return 1.20;
  }

  return 1;
}

function r220HazardCostForEffect(mob,effect,definition,cell=null){
  const awareness=r220HazardAwareness(
    mob,
    effect,
    definition,
    cell
  );
  if(awareness<=0) return 0;

  const role=r220MobRole(mob);
  const roleMultiplier=definition.role?.[role] || 1;
  const vulnerability=r220HazardVulnerability(mob,definition);
  const urgency=r220MobUrgencyMultiplier(mob);

  return (
    definition.baseRisk*
    awareness*
    roleMultiplier*
    vulnerability*
    urgency
  );
}

function r220MobHazardCostAt(mob,x,y){
  if(mob?.controller!=="mob") return 0;

  return r220HazardsAtCell(x,y)
    .reduce(
      (total,{effect,definition})=>
        total+r220HazardCostForEffect(
          mob,
          effect,
          definition,
          {x,y}
        ),
      0
    );
}

function r220RefreshCurrentCellHazardExperience(mob){
  if(mob?.controller!=="mob" || !mob.alive || mob.fled) return;

  const visitedEffects=new Set();

  for(const cell of occupiedHexes(mob)){
    for(const {effect,definition} of r220HazardsAtCell(cell.x,cell.y)){
      const id=r220HazardId(effect);
      if(visitedEffects.has(id)) continue;
      visitedEffects.add(id);

      if(
        definition.kind==="wall-of-fog" ||
        definition.kind==="fog-cloud" ||
        definition.kind==="darkness"
      ){
        r220LearnHazardFromExperience(mob,effect,{failed:false});
      }
    }
  }
}


/*
  Give the current test MOBs explicit intelligence scores. Future monsters can
  supply stats.int, intelligenceScore, or a standard AD&D intelligence label.
*/
const r220BaseMakeKobold=makeKobold;
makeKobold=function(index,position){
  const unit=r220BaseMakeKobold(index,position);
  unit.intelligenceScore=9;
  unit.intelligence=unit.intelligence || "Average (8-10)";
  return unit;
};

const r220BaseMakeKoboldBodyguard=makeKoboldBodyguard;
makeKoboldBodyguard=function(index,position){
  const unit=r220BaseMakeKoboldBodyguard(index,position);
  unit.intelligenceScore=9;
  unit.intelligence=unit.intelligence || "Average (8-10)";
  return unit;
};

const r220BaseMakeKoboldSlinger=makeKoboldSlinger;
makeKoboldSlinger=function(index,position){
  const unit=r220BaseMakeKoboldSlinger(index,position);
  unit.intelligenceScore=9;
  unit.intelligence=unit.intelligence || "Average (8-10)";
  return unit;
};

const r220BaseMakeOrc=makeOrc;
makeOrc=function(index,position,...options){
  const unit=r220BaseMakeOrc(index,position,...options);
  unit.intelligenceScore=9;
  unit.intelligence=unit.intelligence || "Average (8-10)";
  return unit;
};

const r220BaseMakeLargeMobTest=makeLargeMobTest;
makeLargeMobTest=function(position){
  const unit=r220BaseMakeLargeMobTest(position);
  unit.intelligenceScore=16;
  return unit;
};


/* ============================================================
   TARGET KNOWLEDGE / LAST-KNOWN POSITION
   ============================================================ */

function r220MobCanSeeUnit(mob,target){
  if(
    !mob?.alive ||
    mob.fled ||
    !target?.alive ||
    target.fled ||
    mob.faction===target.faction
  ){
    return false;
  }

  if(!unitVisibleToObserver(mob,target)){
    return false;
  }

  return !lineOfSightBlocked(mob,target);
}

function r220TargetMemoryLifetime(mob){
  const intelligence=r220MobIntelligenceScore(mob);

  if(intelligence<=1) return 0;
  if(intelligence<=4) return 1;
  if(intelligence<=7) return 2;
  if(intelligence<=10) return 3;
  if(intelligence<=14) return 4;
  return 6;
}

function r220RememberVisibleTarget(mob,target){
  const memory=r220MobMemory(mob);
  if(!memory || !target) return null;

  const record=memory.targets[target.id] || {
    targetId:target.id,
    x:target.x,
    y:target.y,
    lastSeenRound:game?.round || 0,
    lastSeenTurn:game?.turnIndex || 0,
    confidence:1
  };

  record.x=target.x;
  record.y=target.y;
  record.lastSeenRound=game?.round || 0;
  record.lastSeenTurn=game?.turnIndex || 0;
  record.confidence=1;
  memory.targets[target.id]=record;

  return record;
}

function r220TargetMemoryRecord(mob,target){
  if(!mob || !target) return null;

  const memory=r220MobMemory(mob);
  if(!memory) return null;

  if(r220MobCanSeeUnit(mob,target)){
    return r220RememberVisibleTarget(mob,target);
  }

  const record=memory.targets[target.id];
  if(!record) return null;

  const lifetime=r220TargetMemoryLifetime(mob);
  if(lifetime<=0) return null;

  const age=Math.max(
    0,
    (game?.round || 0)-Number(record.lastSeenRound || 0)
  );

  if(age>lifetime){
    delete memory.targets[target.id];
    return null;
  }

  record.confidence=r220Clamp(
    1-(age/(lifetime+1)),
    0.10,
    1
  );

  return record;
}

function r220RefreshTargetMemory(mob){
  if(mob?.controller!=="mob") return;

  for(const target of activeCombatants()){
    if(target.id===mob.id || target.faction===mob.faction) continue;

    if(r220MobCanSeeUnit(mob,target)){
      r220RememberVisibleTarget(mob,target);
    }else{
      r220TargetMemoryRecord(mob,target);
    }
  }
}

function r220KnownTargetEntries(mob){
  if(mob?.controller!=="mob") return [];

  r220RefreshTargetMemory(mob);

  const entries=[];

  for(const target of activeCombatants()){
    if(target.id===mob.id || target.faction===mob.faction) continue;

    if(r220MobCanSeeUnit(mob,target)){
      entries.push({
        target,
        x:target.x,
        y:target.y,
        visible:true,
        confidence:1
      });
      continue;
    }

    const record=r220TargetMemoryRecord(mob,target);
    if(!record) continue;

    entries.push({
      target,
      x:record.x,
      y:record.y,
      visible:false,
      confidence:record.confidence
    });
  }

  return entries;
}

function r220PursuitPointForTarget(mob,target){
  if(mob?.controller!=="mob" || !target) return target;

  if(r220MobCanSeeUnit(mob,target)){
    r220RememberVisibleTarget(mob,target);
    return {x:target.x,y:target.y,visible:true};
  }

  const record=r220TargetMemoryRecord(mob,target);
  if(!record) return null;

  return {
    x:record.x,
    y:record.y,
    visible:false,
    confidence:record.confidence
  };
}


/* ============================================================
   WEIGHTED PATH SEARCH
   ============================================================ */

function r220MobStepCost(mob,next){
  const footprint=occupiedHexesAt(mob,next.x,next.y);
  let hazardCost=0;

  /*
    Large creatures evaluate the complete destination footprint. Use the
    strongest occupied-cell hazard cost rather than multiplying risk merely
    because a seven-hex creature covers more map cells.
  */
  for(const cell of footprint){
    hazardCost=Math.max(
      hazardCost,
      r220MobHazardCostAt(mob,cell.x,cell.y)
    );
  }

  return 1+hazardCost;
}

function r220ReconstructPath(came,start,end){
  const path=[];
  let cur={x:end.x,y:end.y};

  while(cur){
    path.push({x:cur.x,y:cur.y});

    if(cur.x===start.x && cur.y===start.y){
      break;
    }

    cur=came.get(key(cur.x,cur.y)) || null;
  }

  path.reverse();
  return path;
}

function r220WeightedPathSearch(
  mob,
  start,
  {
    goalTest,
    maxSteps=Infinity,
    heuristic=null
  }={}
){
  if(!mob || typeof goalTest!=="function") return null;

  const startKey=key(start.x,start.y);
  const frontier=[{
    x:start.x,
    y:start.y,
    steps:0,
    cost:0,
    priority:0
  }];
  const bestCost=new Map([[startKey,0]]);
  const bestSteps=new Map([[startKey,0]]);
  const came=new Map();
  let guard=0;

  while(frontier.length && guard<6000){
    guard++;

    frontier.sort((a,b)=>
      a.priority-b.priority ||
      a.cost-b.cost ||
      a.steps-b.steps
    );

    const cur=frontier.shift();
    const curKey=key(cur.x,cur.y);

    if(cur.cost>(bestCost.get(curKey) ?? Infinity)+1e-9){
      continue;
    }

    if(goalTest(cur)){
      return {
        path:r220ReconstructPath(came,start,cur),
        node:cur,
        cost:cur.cost
      };
    }

    if(cur.steps>=maxSteps) continue;

    for(const dir of HEX_DIRS){
      const next={x:cur.x+dir.x,y:cur.y+dir.y};
      if(!inside(next.x,next.y)) continue;
      if(unitTransitionBlocked(mob,cur,next)) continue;

      const nextSteps=cur.steps+1;
      const nextCost=cur.cost+r220MobStepCost(mob,next);
      const nk=key(next.x,next.y);
      const knownCost=bestCost.get(nk);
      const knownSteps=bestSteps.get(nk);

      if(
        knownCost!==undefined &&
        (
          nextCost>knownCost+1e-9 ||
          (
            Math.abs(nextCost-knownCost)<=1e-9 &&
            knownSteps!==undefined &&
            nextSteps>=knownSteps
          )
        )
      ){
        continue;
      }

      bestCost.set(nk,nextCost);
      bestSteps.set(nk,nextSteps);
      came.set(nk,{x:cur.x,y:cur.y});

      const h=
        typeof heuristic==="function"
          ? Math.max(0,Number(heuristic(next))||0)
          : 0;

      frontier.push({
        x:next.x,
        y:next.y,
        steps:nextSteps,
        cost:nextCost,
        priority:nextCost+h*0.01
      });
    }
  }

  return null;
}

function r220WeightedPathToAdjacent(mob,target,point){
  const start={x:mob.x,y:mob.y};
  const goalPoint=point || {x:target.x,y:target.y};
  const targetVisible=!!target && r220MobCanSeeUnit(mob,target);

  const goalTest=(node)=>{
    if(targetVisible){
      const proxy={...mob,x:node.x,y:node.y};
      return canMeleeReach(proxy,target);
    }

    return (
      hexDistance(node,goalPoint)===1 &&
      !architecturalWallBlocksStep(node,goalPoint)
    );
  };

  const found=r220WeightedPathSearch(
    mob,
    start,
    {
      goalTest,
      heuristic:(node)=>Math.max(0,hexDistance(node,goalPoint)-1)
    }
  );

  return found?.path || [{x:mob.x,y:mob.y}];
}

function r220WeightedClosestReachable(mob,target,maxSteps){
  const point=r220PursuitPointForTarget(mob,target);
  if(!point){
    return [{x:mob.x,y:mob.y}];
  }

  const start={x:mob.x,y:mob.y};
  const frontier=[{
    x:start.x,
    y:start.y,
    steps:0,
    cost:0
  }];
  const came=new Map();
  const bestCost=new Map([[key(start.x,start.y),0]]);
  const bestSteps=new Map([[key(start.x,start.y),0]]);
  let best=frontier[0];
  let bestScore=Infinity;
  let guard=0;

  const distanceFor=(node)=>{
    if(point.visible){
      return approachDistanceAt(mob,node.x,node.y,target);
    }

    return Math.max(0,hexDistance(node,point)-1);
  };

  const scoreFor=(node)=>
    distanceFor(node)*12+
    node.cost;

  bestScore=scoreFor(best);

  while(frontier.length && guard<5000){
    guard++;

    frontier.sort((a,b)=>
      a.cost-b.cost ||
      a.steps-b.steps
    );

    const cur=frontier.shift();
    const ck=key(cur.x,cur.y);

    if(cur.cost>(bestCost.get(ck) ?? Infinity)+1e-9){
      continue;
    }

    const score=scoreFor(cur);

    if(
      score<bestScore-1e-9 ||
      (
        Math.abs(score-bestScore)<=1e-9 &&
        cur.steps<best.steps
      )
    ){
      best=cur;
      bestScore=score;
    }

    if(cur.steps>=maxSteps) continue;

    for(const dir of HEX_DIRS){
      const next={x:cur.x+dir.x,y:cur.y+dir.y};
      if(!inside(next.x,next.y)) continue;
      if(unitTransitionBlocked(mob,cur,next)) continue;

      const nextSteps=cur.steps+1;
      const nextCost=cur.cost+r220MobStepCost(mob,next);
      const nk=key(next.x,next.y);
      const known=bestCost.get(nk);
      const knownSteps=bestSteps.get(nk);

      if(
        known!==undefined &&
        (
          nextCost>known+1e-9 ||
          (
            Math.abs(nextCost-known)<=1e-9 &&
            knownSteps!==undefined &&
            nextSteps>=knownSteps
          )
        )
      ){
        continue;
      }

      bestCost.set(nk,nextCost);
      bestSteps.set(nk,nextSteps);
      came.set(nk,{x:cur.x,y:cur.y});
      frontier.push({
        x:next.x,
        y:next.y,
        steps:nextSteps,
        cost:nextCost
      });
    }
  }

  return r220ReconstructPath(came,start,best);
}


function r220ObserveVisibleTargetsForAllMobs(){
  if(!game) return;

  for(const mob of game.enemies || []){
    if(mob?.controller!=="mob" || !mob.alive || mob.fled) continue;
    r220RefreshTargetMemory(mob);
  }
}

/*
  Preserve last-known positions immediately before an obscuring area appears,
  then let intelligent MOBs perceive/recognize the new hazard after it exists.
*/
const r220BaseAddAreaEffect=addAreaEffect;
addAreaEffect=function(effect){
  const definition=r220HazardDefinition(effect);

  if(definition){
    r220ObserveVisibleTargetsForAllMobs();
  }

  const added=r220BaseAddAreaEffect(effect);

  if(added && definition){
    for(const mob of game?.enemies || []){
      if(mob?.controller!=="mob" || !mob.alive || mob.fled) continue;

      const entry=r220HazardKnowledgeEntry(
        mob,
        added,
        definition
      );

      /*
        A MOB that created the effect knows what it cast and where it placed
        it; this is authored knowledge rather than hidden-map omniscience.
      */
      if(
        entry &&
        added.sourceUnitId===mob.id
      ){
        entry.perceived=true;
        entry.recognized=true;
        entry.lastSeenRound=game?.round || 0;

        for(const cell of added.cells || []){
          entry.seenCells[key(cell.x,cell.y)]=true;
        }
      }
    }
  }

  return added;
};

/*
  Player movement is an information event: MOBs remember the pre-move location
  and update to the new location only if it remains visible afterward.
*/
const r220BaseTryPlayerMove=tryPlayerMove;
tryPlayerMove=async function(dx,dy){
  r220ObserveVisibleTargetsForAllMobs();
  const result=await r220BaseTryPlayerMove(dx,dy);
  r220ObserveVisibleTargetsForAllMobs();
  return result;
};


/* ============================================================
   INTEGRATION WITH EXISTING MOB AI
   ============================================================ */

const r220BasePathToAdjacent=pathToAdjacent;
pathToAdjacent=function(start,target,mover){
  if(mover?.controller!=="mob"){
    return r220BasePathToAdjacent(start,target,mover);
  }

  const point=r220PursuitPointForTarget(mover,target);
  if(!point){
    return [{x:start.x,y:start.y}];
  }

  return r220WeightedPathToAdjacent(mover,target,point);
};

const r220BasePathToClosestReachable=pathToClosestReachable;
pathToClosestReachable=function(start,target,mover,maxSteps){
  if(mover?.controller!=="mob"){
    return r220BasePathToClosestReachable(
      start,
      target,
      mover,
      maxSteps
    );
  }

  return r220WeightedClosestReachable(
    mover,
    target,
    Math.max(0,Number(maxSteps)||0)
  );
};

const r220BaseCanMeleeAttackTarget=canMeleeAttackTarget;
canMeleeAttackTarget=function(attacker,target){
  if(
    attacker?.controller==="mob" &&
    target &&
    target.faction!==attacker.faction &&
    !r220MobCanSeeUnit(attacker,target)
  ){
    /*
      Blind attacks into an occupied-but-unseen hex can be added later as a
      separate combat rule. For now MOBs cannot use hidden exact coordinates.
    */
    return false;
  }

  return r220BaseCanMeleeAttackTarget(attacker,target);
};

selectMobPartyTarget=function(mob){
  r220RefreshCurrentCellHazardExperience(mob);

  const known=r220KnownTargetEntries(mob)
    .sort((a,b)=>
      Number(b.visible)-Number(a.visible) ||
      b.confidence-a.confidence ||
      hexDistance(mob,a)-hexDistance(mob,b) ||
      a.target.id.localeCompare(b.target.id)
    );

  if(!known.length){
    return {
      target:null,
      path:null,
      reachable:false,
      nearest:null,
      memoryPursuit:false
    };
  }

  const nearest=known[0].target;

  for(const entry of known){
    const path=r220WeightedPathToAdjacent(
      mob,
      entry.target,
      entry
    );

    if(path?.length>1 || canMeleeAttackTarget(mob,entry.target)){
      return {
        target:entry.target,
        path,
        reachable:true,
        nearest,
        memoryPursuit:!entry.visible,
        knownPoint:{x:entry.x,y:entry.y}
      };
    }
  }

  return {
    target:nearest,
    path:null,
    reachable:false,
    nearest,
    memoryPursuit:!known[0].visible,
    knownPoint:{x:known[0].x,y:known[0].y}
  };
};

function r220KnownObservationPoints(entry){
  const center={x:entry.x,y:entry.y};

  if(entry.visible){
    return [center];
  }

  const points=[center];

  for(const dir of HEX_DIRS){
    const cell={x:center.x+dir.x,y:center.y+dir.y};

    if(
      inside(cell.x,cell.y) &&
      r220HazardsAtCell(cell.x,cell.y).length===0
    ){
      points.push(cell);
    }
  }

  return points;
}

function r220RangedLaneToKnownPoint(unit,source,entry){
  const sourceEntity=rangedAiSourceEntity(unit,source);

  for(const point of r220KnownObservationPoints(entry)){
    const distance=unitDistanceAt(
      unit,
      source.x,
      source.y,
      point
    );

    if(unit.type==="kobold-slinger" && distance<=1){
      continue;
    }

    const maxRange=
      Number(unit.slingLongRange) ||
      Number(unit.missileMaxRangeHexes) ||
      12;

    if(distance>maxRange) continue;

    if(
      projectilePathBlockedBetweenHexes(
        sourceEntity,
        point
      )
    ){
      continue;
    }

    return point;
  }

  return null;
}

const r220BasePathToNearestRangedFiringHex=
  pathToNearestRangedFiringHex;

pathToNearestRangedFiringHex=function(unit,{avoidThreatened=true}={}){
  if(unit?.controller!=="mob"){
    return r220BasePathToNearestRangedFiringHex(
      unit,
      {avoidThreatened}
    );
  }

  if(
    !unit.alive ||
    unit.fled ||
    !unit.rangedWeapon
  ){
    return null;
  }

  const known=r220KnownTargetEntries(unit);
  if(!known.length) return null;

  const start={x:unit.x,y:unit.y};

  const found=r220WeightedPathSearch(
    unit,
    start,
    {
      goalTest:(node)=>{
        if(
          avoidThreatened &&
          rangedAiPositionThreatened(unit,node)
        ){
          return false;
        }

        return known.some(entry=>
          !!r220RangedLaneToKnownPoint(
            unit,
            node,
            entry
          )
        );
      },
      heuristic:(node)=>
        Math.min(
          ...known.map(entry=>
            hexDistance(node,{x:entry.x,y:entry.y})
          )
        )
    }
  );

  if(!found) return null;

  const matched=known.find(entry=>
    !!r220RangedLaneToKnownPoint(
      unit,
      found.node,
      entry
    )
  ) || known[0];

  return {
    path:found.path,
    target:matched.target,
    firingHex:{x:found.node.x,y:found.node.y},
    distance:hexDistance(
      found.node,
      {x:matched.x,y:matched.y}
    ),
    memoryWatch:!matched.visible
  };
};

const r220BaseRangedRetreatStep=rangedRetreatStep;
rangedRetreatStep=function(unit,threat){
  if(unit?.controller!=="mob"){
    return r220BaseRangedRetreatStep(unit,threat);
  }

  const options=HEX_DIRS
    .map(dir=>({x:unit.x+dir.x,y:unit.y+dir.y}))
    .filter(pos=>
      inside(pos.x,pos.y) &&
      !unitTransitionBlocked(unit,unit,pos)
    )
    .map(pos=>({
      ...pos,
      distance:threat
        ? unitDistanceAt(unit,pos.x,pos.y,threat)
        : 0,
      hazardCost:r220MobHazardCostAt(unit,pos.x,pos.y)
    }))
    .sort((a,b)=>
      b.distance-a.distance ||
      a.hazardCost-b.hazardCost ||
      a.x-b.x ||
      a.y-b.y
    );

  return options[0] || null;
};

const r220BaseFleeStep=fleeStep;
fleeStep=function(unit,threat){
  if(unit?.controller!=="mob"){
    return r220BaseFleeStep(unit,threat);
  }

  if(isMapEdgeHex(unit.x,unit.y)){
    const escapeOptions=HEX_DIRS
      .map(dir=>({
        x:unit.x+dir.x,
        y:unit.y+dir.y,
        escape:true
      }))
      .filter(pos=>!inside(pos.x,pos.y))
      .map(pos=>({
        ...pos,
        distance:threat ? hexDistance(pos,threat) : 0
      }))
      .sort((a,b)=>
        b.distance-a.distance ||
        a.x-b.x ||
        a.y-b.y
      );

    if(escapeOptions.length){
      return escapeOptions[0];
    }
  }

  const options=HEX_DIRS
    .map(dir=>({x:unit.x+dir.x,y:unit.y+dir.y}))
    .filter(pos=>
      inside(pos.x,pos.y) &&
      !unitTransitionBlocked(unit,unit,pos)
    )
    .map(pos=>({
      ...pos,
      distance:threat
        ? unitDistanceAt(unit,pos.x,pos.y,threat)
        : 0,
      hazardCost:r220MobHazardCostAt(unit,pos.x,pos.y)
    }))
    .sort((a,b)=>
      (
        b.distance*10-b.hazardCost
      )-(
        a.distance*10-a.hazardCost
      ) ||
      a.x-b.x ||
      a.y-b.y
    );

  return options[0] || null;
};


/* A dragon only plans breath attacks from targets it can currently perceive. */
bestDragonBreathPlan=function(dragon){
  if(!dragonBreathReady(dragon)) return null;

  const party=livingPartyMembers()
    .filter(unit=>r220MobCanSeeUnit(dragon,unit));

  if(!party.length) return null;

  const partyIds=new Set(party.map(unit=>unit.id));
  const plans=[];

  for(const target of party){
    const cells=dragonBreathCells(dragon,target);
    const affected=livingUnitsInAreaCells(cells)
      .filter(unit=>unit.id!==dragon.id);

    const partyVictims=affected.filter(unit=>
      partyIds.has(unit.id)
    );

    if(!partyVictims.length) continue;

    const collateral=affected.filter(unit=>
      unit.controller==="mob" &&
      unit.id!==dragon.id &&
      !partyIds.has(unit.id)
    ).length;

    plans.push({
      target,
      cells,
      affected,
      partyVictims,
      collateral,
      score:
        partyVictims.length*1000-
        collateral*500-
        unitDistance(dragon,target)
    });
  }

  plans.sort((a,b)=>
    b.score-a.score ||
    b.partyVictims.length-a.partyVictims.length ||
    unitDistance(dragon,a.target)-
      unitDistance(dragon,b.target)
  );

  return plans[0] || null;
};


/* ============================================================
   EXPERIENCE / OBSERVATIONAL LEARNING
   ============================================================ */

const r220BaseResolvePersistentAreaSave=resolvePersistentAreaSave;
resolvePersistentAreaSave=async function(
  unit,
  effect,
  options={}
){
  const result=await r220BaseResolvePersistentAreaSave(
    unit,
    effect,
    options
  );

  if(unit?.controller==="mob"){
    r220LearnHazardFromExperience(
      unit,
      effect,
      {failed:!!result?.failed}
    );
  }

  r220WitnessHazardConsequence(
    unit,
    effect,
    result
  );

  return result;
};


/* Public debug/introspection hook for later hazard additions. */
window.AdventurePartyMobHazards={
  registry:R220_MOB_HAZARD_REGISTRY,
  intelligenceScore:r220MobIntelligenceScore,
  intelligenceBand:r220MobIntelligenceBand,
  role:r220MobRole,
  hazardsAtCell:r220HazardsAtCell,
  hazardCostAt:r220MobHazardCostAt,
  knownTargets:r220KnownTargetEntries,
  memory:r220MobMemory
};
