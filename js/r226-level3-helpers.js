/* ============================================================
   COMMON R226 HELPERS
   ============================================================ */

const R226_SIZE_RANK=Object.freeze({tiny:0,small:1,medium:2,large:3,huge:4,gargantuan:5});
const R226_DISPELLABLE_UNIT_EFFECTS=new Set([
  "acid-arrow","armor-spell","blind","blur","charm-person","chill-touch",
  "chill-touch-strength-loss","continual-light","deafness","detect-invisibility",
  "enlarge","glitterdust","hideous-laughter","hypnotic-pattern","invisibility",
  "light","mirror-image","nauseated","protection-from-evil","ray-enfeeblement",
  "scare","shield","sleep","spectral-hand","spook","strength-spell","taunt",
  "webbed","blink","haste","slow","held-person","held-undead","infravision",
  "invisibility-10-radius","protection-from-evil-radius",
  "protection-from-normal-missiles","minute-meteors","vampiric-vitality",
  "gust-wind"
]);

let r226LightningFx=null;
let r226GustFx=null;

function r226Clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function r226UnitSizeRank(unit){
  return R226_SIZE_RANK[String(unit?.sizeCategory || "medium").toLowerCase()] ?? 2;
}

function r226IsHumanoidPerson(unit){
  if(!unit?.alive || unit.fled || isUndeadUnit(unit)) return false;
  if(r226UnitSizeRank(unit)>2) return false;

  const type=String(unit.creatureType || unit.race || "").toLowerCase();
  if(!type) return true;
  if(/dragon|giant|beast|animal|construct|elemental|ooze|plant|undead/.test(type)) return false;
  return /human|humanoid|elf|dwarf|gnome|halfling|kobold|orc|goblin|hobgoblin|gnoll/.test(type) || unit.controller!=="mob";
}

function r226CasterLevelForEffect(effect){
  if(Number.isFinite(effect?.data?.casterLevel)) return Math.max(1,Number(effect.data.casterLevel));
  const source=getUnitById(effect?.data?.sourceUnitId || effect?.sourceUnitId);
  if(Number.isFinite(source?.level)) return Math.max(1,Number(source.level));
  return TEST_SPELL_CASTER_LEVEL;
}

function r226BaseMobility(unit){
  if(!unit) return {move:0,halfMove:0};
  if(!unit.__r226BaseMobility){
    unit.__r226BaseMobility={
      move:Math.max(0,Number(unit.move)||0),
      halfMove:Math.max(0,Number(unit.halfMove)||0)
    };
  }
  return unit.__r226BaseMobility;
}

function r226RecomputeMobility(unit){
  if(!unit) return;
  const base=r226BaseMobility(unit);
  let multiplier=1;

  if(getUnitEffect(unit,"haste")) multiplier*=2;
  if(getUnitEffect(unit,"slow")) multiplier*=0.5;

  const gust=getUnitEffect(unit,"gust-wind");
  if(gust){
    const m=Number(gust.data?.moveMultiplier);
    multiplier*=Number.isFinite(m) ? Math.max(0,m) : 0.5;
  }

  unit.move=Math.max(0,Math.floor(base.move*multiplier));
  unit.halfMove=Math.max(0,Math.floor(base.halfMove*multiplier));
}

function r226RecomputeAllMobility(){
  for(const unit of allUnits()) r226RecomputeMobility(unit);
}

function r226DirectionForAim(caster,targetHex){
  const index=hexDirectionIndexToward(caster,targetHex);
  return {index,dir:HEX_DIRS[index]};
}

function r226StraightLineCells(caster,targetHex,maxCells,{rebound=false}={}){
  if(!caster || !targetHex || maxCells<=0) return [];
  let {dir}=r226DirectionForAim(caster,targetHex);
  let previous={x:caster.x,y:caster.y};
  const result=[];
  let didRebound=false;

  for(let step=0;step<maxCells;step++){
    let next={x:previous.x+dir.x,y:previous.y+dir.y};
    let blocked=(
      !inside(next.x,next.y) ||
      isWall(next.x,next.y) ||
      architecturalWallBlocksStep(previous,next)
    );

    if(blocked && rebound){
      dir={x:-dir.x,y:-dir.y};
      didRebound=true;
      next={x:previous.x+dir.x,y:previous.y+dir.y};
      blocked=(
        !inside(next.x,next.y) ||
        isWall(next.x,next.y) ||
        architecturalWallBlocksStep(previous,next)
      );
    }

    if(blocked) break;
    result.push({x:next.x,y:next.y,rebounded:didRebound});
    previous=next;
  }

  return result;
}

function r226UnitOccurrencesAlongCells(cells){
  const result=[];
  let lastUnitId=null;
  for(const cell of cells || []){
    const unit=unitAtHex(cell.x,cell.y);
    if(!unit?.alive || unit.fled){
      lastUnitId=null;
      continue;
    }
    if(unit.id===lastUnitId) continue;
    result.push({unit,cell});
    lastUnitId=unit.id;
  }
  return result;
}

function r226ActiveWindWalls(){
  if(!game) return [];
  if(!Array.isArray(game.r226WindWalls)) game.r226WindWalls=[];
  game.r226WindWalls=game.r226WindWalls.filter(wall=>
    wall && Array.isArray(wall.cells) && wall.cells.length &&
    (!Number.isFinite(wall.expiresRound) || game.round<wall.expiresRound)
  );
  return game.r226WindWalls;
}

function r226WindWallCells(caster,targetHex,level){
  const orientation=wallOfFogAutoOrientationIndex(caster,targetHex);
  const wallDir=HEX_DIRS[(orientation+2)%6];
  const length=Math.max(1,Math.floor(level));
  const half=Math.floor((length-1)/2);
  const cells=[];
  const seen=new Set();

  for(let i=-half;i<=length-half-1;i++){
    const cell={x:targetHex.x+wallDir.x*i,y:targetHex.y+wallDir.y*i};
    if(!inside(cell.x,cell.y) || isWall(cell.x,cell.y)) continue;
    const k=key(cell.x,cell.y);
    if(seen.has(k)) continue;
    seen.add(k);
    cells.push(cell);
  }
  return cells;
}

function r226LineCrossesWindWall(a,b){
  const walls=r226ActiveWindWalls();
  if(!walls.length || !a || !b) return null;
  const line=hexLineCells(a,b).slice(1);
  for(const wall of walls){
    const set=new Set(wall.cells.map(cell=>key(cell.x,cell.y)));
    if(line.some(cell=>set.has(key(cell.x,cell.y)))) return wall;
  }
  return null;
}

function r226DisperseGasCells(cells,reason="wind"){
  if(!game || !Array.isArray(cells) || !cells.length) return 0;
  const keys=new Set(cells.map(cell=>key(cell.x,cell.y)));
  let removed=0;

  for(const effect of game.areaEffects || []){
    const gaseous=(
      effect.type==="fog" ||
      effect.type==="stinking-cloud" ||
      effect.spellKind==="stinking-cloud" ||
      effect.spellKind==="fog-cloud" ||
      effect.name==="Wall of Fog" ||
      effect.name==="Fog Cloud" ||
      effect.name==="Stinking Cloud"
    );
    if(!gaseous) continue;
    const before=(effect.cells || []).length;
    effect.cells=(effect.cells || []).filter(cell=>!keys.has(key(cell.x,cell.y)));
    removed+=before-effect.cells.length;
  }

  game.areaEffects=(game.areaEffects || []).filter(effect=>
    !Array.isArray(effect.cells) || effect.cells.length>0
  );
  cleanupAreaBoundStatuses();
  if(removed) log(`${reason} disperses ${removed} fog/cloud hex${removed===1?"":"es"}.`,"system");
  return removed;
}

function r226ProtectionAuraSourceFor(unit){
  if(!unit?.alive) return null;
  return allUnits().find(source=>
    source?.alive && !source.fled && source.faction===unit.faction &&
    !!getUnitEffect(source,"protection-from-evil-radius") &&
    unitDistance(source,unit)<=1
  ) || null;
}

function r226DispelRoll(caster,effectLevel){
  const casterLevel=Math.max(1,Number(caster?.level)||TEST_SPELL_CASTER_LEVEL);
  const sourceLevel=Math.max(1,Number(effectLevel)||TEST_SPELL_CASTER_LEVEL);
  const threshold=r226Clamp(11+(sourceLevel-casterLevel),2,20);
  const raw=d(20);
  return {
    raw,threshold,
    success:raw===20 || (raw!==1 && raw>=threshold)
  };
}

function r226IsOwnMagic(caster,effect){
  const sourceId=effect?.data?.sourceUnitId || effect?.sourceUnitId;
  return !!(caster?.id && sourceId===caster.id);
}

function r226CanDispelUnitEffect(effect){
  return !!effect && R226_DISPELLABLE_UNIT_EFFECTS.has(effect.id);
}

function r226EffectDescription(effect){
  return effect?.name || effect?.id || effect?.type || "magic";
}

function r226SpellTouchAttack(caster,target,bonus=0){
  const level=Math.max(1,Number(caster?.level)||TEST_SPELL_CASTER_LEVEL);
  const thaco=Math.max(1,21-Math.ceil(level/3));
  const ac=effectiveArmorClassForAttack(caster,target,"melee");
  const targetNumber=thaco-ac;
  const raw=d(20);
  const modifier=bonus+attackEffectModifier(caster,target);
  const resolution=resolveMeleeAttackD20(raw,targetNumber,modifier);
  playNaturalAttackRollSound(raw);
  setLastRoll(
    `${caster.name} spell touch: RAW d20 ${raw}`+
    (resolution.automatic
      ? ` — ${resolution.automatic}`
      : ` ${formatSignedAdjustment(modifier)} = ${resolution.modifiedRoll} vs target ${targetNumber}`)
  );
  return {...resolution,raw,targetNumber,modifier};
}

function r226ClosestVisibleHostile(caster,maxRangeHexes=Infinity){
  return allUnits()
    .filter(unit=>
      unit?.alive && !unit.fled && unit.faction!==caster.faction &&
      unitDistance(caster,unit)<=maxRangeHexes &&
      (typeof r222UnitCurrentlyVisible==="function"
        ? r222UnitCurrentlyVisible(caster,unit)
        : !lineOfSightBlocked(caster,unit))
    )
    .sort((a,b)=>unitDistance(caster,a)-unitDistance(caster,b) || a.hp-b.hp)[0] || null;
}


