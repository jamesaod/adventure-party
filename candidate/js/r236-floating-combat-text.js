/*
  R236 — FLOATING COMBAT INFORMATION
  ===================================
  Lightweight over-unit feedback for important combat state changes.

  - Casting start: "Begins Casting." for 1 second.
  - Damage: red "-N dmg", rises slowly and fades over 1 second.
  - Healing-ready hook: green "+N healing", same motion/fade.

  Rendering is a final foreground pass and respects party visibility so hidden
  enemies are never revealed by floating text alone.
*/

const R236_FLOAT_DURATION_MS=1000;
const R236_FLOAT_RISE_PX=22;

let r236FloatingCombatText=[];
let r236FloatingCombatTextFrame=null;
let r236FloatingCombatTextSequence=0;


/* ============================================================
   CREATION
   ============================================================ */

function r236FloatingTextUnitVisible(unit){
  if(!unit) return false;

  if(game?.condition!=="wall"){
    return true;
  }

  if(isFriendlyCombatUnit(unit)){
    return true;
  }

  return isUnitVisibleToFriendlyParty(unit);
}


function r236ActiveTextCountForUnit(unitId){
  const now=performance.now();

  return r236FloatingCombatText.filter(entry=>
    entry.unitId===unitId &&
    now-entry.started<R236_FLOAT_DURATION_MS
  ).length;
}


function r236QueueFloatingCombatText(
  unit,
  text,
  kind="info",
  {
    durationMs=R236_FLOAT_DURATION_MS,
    risePx=null
  }={}
){
  if(
    !unit ||
    !Number.isFinite(unit.x) ||
    !Number.isFinite(unit.y) ||
    !text
  ){
    return null;
  }

  const now=performance.now();
  const stackSlot=
    Math.min(
      3,
      r236ActiveTextCountForUnit(unit.id)
    );

  const entry={
    id:++r236FloatingCombatTextSequence,
    unitId:unit.id || null,
    anchorX:unit.x,
    anchorY:unit.y,
    text:String(text),
    kind,
    started:now,
    duration:
      Math.max(
        1,
        Number(durationMs) ||
        R236_FLOAT_DURATION_MS
      ),
    risePx:
      Number.isFinite(risePx)
        ? Number(risePx)
        : (
            kind==="damage" ||
            kind==="healing"
              ? R236_FLOAT_RISE_PX
              : 0
          ),
    stackSlot
  };

  r236FloatingCombatText.push(entry);
  r236EnsureFloatingCombatTextLoop();
  draw();

  return entry;
}


function r236ShowDamageText(unit,damage){
  const amount=
    Math.max(
      0,
      Math.round(Number(damage)||0)
    );

  if(amount<=0){
    return null;
  }

  return r236QueueFloatingCombatText(
    unit,
    "-"+amount+" dmg",
    "damage"
  );
}


function r236ShowHealingText(unit,amount){
  const healing=
    Math.max(
      0,
      Math.round(Number(amount)||0)
    );

  if(healing<=0){
    return null;
  }

  return r236QueueFloatingCombatText(
    unit,
    "+"+healing+" healing",
    "healing"
  );
}


function r236ShowBeginsCastingText(unit){
  return r236QueueFloatingCombatText(
    unit,
    "Begins Casting.",
    "casting",
    {
      durationMs:1000,
      risePx:0
    }
  );
}


/* ============================================================
   POSITION + DRAW
   ============================================================ */

function r236FloatingTextAnchor(entry){
  const unit=
    entry.unitId
      ? getUnitById(entry.unitId)
      : null;

  const anchorUnit=
    unit ||
    {
      x:entry.anchorX,
      y:entry.anchorY,
      footprintId:"single"
    };

  const center=
    unit
      ? unitFootprintScreenCenter(unit)
      : hexCenter(
          entry.anchorX,
          entry.anchorY
        );

  const large=
    unit
      ? unitFootprintCellCount(unit)>1
      : false;

  const visualScale=
    unit
      ? Math.max(
          1,
          enlargeVisualScale(unit)
        )
      : 1;

  const normalBaseOffset=
    large
      ? 84
      : (
          isKoboldUnit(unit)
            ? 49
            : 57
        );

  const authoredOffset=
    Number(unit?.hpBarOffsetY);

  const baseOffset=
    Number.isFinite(authoredOffset)
      ? Math.max(
          normalBaseOffset,
          authoredOffset*visualScale+12
        )
      : normalBaseOffset*visualScale;

  return {
    x:center.x,
    y:
      center.y-
      baseOffset-
      entry.stackSlot*13
  };
}


function r236FloatingTextStyle(kind,alpha){
  switch(kind){
    case "damage":
      return {
        fontSize:13,
        fill:
          "rgba(255,74,82,"+
          alpha+
          ")",
        stroke:
          "rgba(20,2,4,"+
          Math.min(1,alpha*0.96)+
          ")"
      };

    case "healing":
      return {
        fontSize:13,
        fill:
          "rgba(112,238,136,"+
          alpha+
          ")",
        stroke:
          "rgba(3,18,6,"+
          Math.min(1,alpha*0.96)+
          ")"
      };

    case "casting":
    default:
      return {
        fontSize:12,
        fill:
          "rgba(255,241,183,"+
          alpha+
          ")",
        stroke:
          "rgba(9,8,4,"+
          Math.min(1,alpha*0.96)+
          ")"
      };
  }
}


function r236DrawFloatingCombatText(){
  if(
    !game ||
    !r236FloatingCombatText.length
  ){
    return;
  }

  const now=performance.now();

  for(const entry of r236FloatingCombatText){
    const elapsed=
      now-entry.started;

    if(
      elapsed<0 ||
      elapsed>=entry.duration
    ){
      continue;
    }

    const unit=
      entry.unitId
        ? getUnitById(entry.unitId)
        : null;

    if(
      unit &&
      !r236FloatingTextUnitVisible(unit)
    ){
      continue;
    }

    const t=
      Math.max(
        0,
        Math.min(
          1,
          elapsed/entry.duration
        )
      );

    let alpha;
    let rise;

    if(entry.kind==="casting"){
      /*
        Casting notice stays steady for most of the second, then fades quickly.
        It does not drift; the damage/healing numbers carry the motion language.
      */
      alpha=
        t<0.72
          ? 1
          : Math.max(
              0,
              (1-t)/0.28
            );

      rise=0;
    }else{
      alpha=
        Math.max(
          0,
          1-t
        );

      /*
        Ease-out motion: immediately readable at the unit, then a slow upward
        drift that settles as it disappears.
      */
      const eased=
        1-Math.pow(1-t,1.45);

      rise=
        entry.risePx*
        eased;
    }

    if(alpha<=0.001){
      continue;
    }

    const anchor=
      r236FloatingTextAnchor(entry);

    const style=
      r236FloatingTextStyle(
        entry.kind,
        alpha
      );

    ctx.save();

    ctx.font=
      '700 '+
      style.fontSize+
      'px "EB Garamond", Georgia, "Times New Roman", serif';

    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.lineJoin="round";

    ctx.lineWidth=3;
    ctx.strokeStyle=style.stroke;
    ctx.fillStyle=style.fill;

    const y=
      Math.round(
        anchor.y-rise
      );

    ctx.strokeText(
      entry.text,
      Math.round(anchor.x),
      y
    );

    ctx.fillText(
      entry.text,
      Math.round(anchor.x),
      y
    );

    ctx.restore();
  }
}


/* ============================================================
   ANIMATION LOOP
   ============================================================ */

function r236PruneFloatingCombatText(now=performance.now()){
  r236FloatingCombatText=
    r236FloatingCombatText.filter(entry=>
      now-entry.started<
      entry.duration
    );

  return r236FloatingCombatText.length;
}


function r236FloatingCombatTextTick(now){
  r236FloatingCombatTextFrame=null;

  if(
    !game ||
    currentScreen!=="combat"
  ){
    r236PruneFloatingCombatText(now);
    return;
  }

  if(!r236PruneFloatingCombatText(now)){
    return;
  }

  draw();

  r236FloatingCombatTextFrame=
    requestAnimationFrame(
      r236FloatingCombatTextTick
    );
}


function r236EnsureFloatingCombatTextLoop(){
  if(
    r236FloatingCombatTextFrame!==null ||
    !game ||
    currentScreen!=="combat" ||
    !r236FloatingCombatText.length
  ){
    return false;
  }

  r236FloatingCombatTextFrame=
    requestAnimationFrame(
      r236FloatingCombatTextTick
    );

  return true;
}


/* ============================================================
   FINAL FOREGROUND RENDER HOOK
   ============================================================ */

const r236BaseDrawUnitBarks=
  drawUnitBarks;

drawUnitBarks=function(){
  r236BaseDrawUnitBarks();
  r236DrawFloatingCombatText();
};


/* ============================================================
   DAMAGE HOOK
   ============================================================ */

const r236BaseOnUnitDamaged=
  onUnitDamaged;

onUnitDamaged=function(unit,damage){
  const result=
    r236BaseOnUnitDamaged(
      unit,
      damage
    );

  if(Number(damage)>0){
    r236ShowDamageText(
      unit,
      damage
    );
  }

  return result;
};


/* ============================================================
   CASTING-START HOOK
   ============================================================ */

const r236BaseScheduleSpellCast=
  r230ScheduleSpellCast;

r230ScheduleSpellCast=function(
  caster,
  spell,
  action,
  context
){
  const record=
    r236BaseScheduleSpellCast(
      caster,
      spell,
      action,
      context
    );

  if(record && caster){
    r236ShowBeginsCastingText(
      caster
    );
  }

  return record;
};


/* ============================================================
   FUTURE HEALING HOOK
   ============================================================ */

/*
  Healing mechanics are intentionally NOT implemented in R236.
  Future healing code can call this canonical presentation hook after it has
  calculated the actual HP restored.
*/
function onUnitHealed(unit,amount){
  if(
    !unit ||
    Number(amount)<=0
  ){
    return false;
  }

  r236ShowHealingText(
    unit,
    amount
  );

  return true;
}


/* ============================================================
   DIAGNOSTICS
   ============================================================ */

window.AdventurePartyFloatingCombatText={
  release:"R236",
  active:()=>r236FloatingCombatText.map(entry=>({
    id:entry.id,
    unitId:entry.unitId,
    text:entry.text,
    kind:entry.kind,
    remainingMs:
      Math.max(
        0,
        entry.duration-
        (
          performance.now()-
          entry.started
        )
      )
  })),
  damage:r236ShowDamageText,
  healing:r236ShowHealingText,
  casting:r236ShowBeginsCastingText,
  clear:()=>{
    r236FloatingCombatText=[];
    return true;
  }
};
