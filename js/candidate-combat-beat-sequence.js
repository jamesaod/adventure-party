/*
  Candidate Rev 2 — ordered combat presentation beats
  ====================================================
  One resolved action may now present several consequences in a readable series.

  Beat order per affected unit:
    1. direct / primary damage
    2. secondary / rider damage
    3. buffs
    4. debuffs
    5. physical / follow-on conditions

  Mechanics still resolve in the combat engine immediately unless the source
  explicitly separates its components, but turn progression is held until all
  queued presentation beats finish. The Flaming Sword +5 melee path now also
  separates its primary weapon damage and fire rider mechanically before the
  final death/victory check.
*/

const CANDIDATE_COMBAT_BEAT_MS=1000;

const CANDIDATE_COMBAT_BEAT_PRIORITY=Object.freeze({
  "direct-damage":10,
  "secondary-damage":20,
  "buff":30,
  "debuff":40,
  "condition":50
});

let candidateCombatBeatSequence=0;
let candidateCombatBeatHoldUntil=0;
let candidateDamageBeatContext=null;
const candidateCombatBeatGroups=new Map();
let candidateCombatBeatFlushQueued=false;


/* ============================================================
   CORE QUEUE
   ============================================================ */

function candidateCombatBeatPresentationEnabled(){
  return !!(
    game &&
    currentScreen==="combat" &&
    !game.over &&
    !combatAwaitingStart
  );
}


function candidateCombatBeatKey(unit){
  return String(unit?.id || "anonymous");
}


function candidateCombatBeatRemaining(){
  return Math.max(
    0,
    Math.ceil(
      candidateCombatBeatHoldUntil-
      performance.now()
    )
  );
}


function candidateCombatBeatGroupFor(unit){
  const key=candidateCombatBeatKey(unit);

  if(!candidateCombatBeatGroups.has(key)){
    candidateCombatBeatGroups.set(key,{
      key,
      nextAvailableAt:0,
      pending:[]
    });
  }

  return candidateCombatBeatGroups.get(key);
}


function candidateCombatBeatPriority(category){
  return (
    CANDIDATE_COMBAT_BEAT_PRIORITY[category] ??
    CANDIDATE_COMBAT_BEAT_PRIORITY.condition
  );
}


function candidateScheduleCombatBeatFlush(){
  if(candidateCombatBeatFlushQueued){
    return;
  }

  candidateCombatBeatFlushQueued=true;

  queueMicrotask(()=>{
    candidateCombatBeatFlushQueued=false;
    candidateFlushCombatBeats();
  });
}


function candidateQueueCombatBeat(
  unit,
  {
    category="condition",
    text="",
    kind="condition",
    durationMs=CANDIDATE_COMBAT_BEAT_MS,
    risePx=R236_FLOAT_RISE_PX,
    show=null,
    sound=null,
    meta={}
  }={}
){
  if(
    !candidateCombatBeatPresentationEnabled() ||
    !unit ||
    !text
  ){
    return null;
  }

  const group=
    candidateCombatBeatGroupFor(unit);

  const beat={
    id:++candidateCombatBeatSequence,
    unit,
    unitId:unit.id || null,
    category,
    priority:
      candidateCombatBeatPriority(category),
    text:String(text),
    kind,
    durationMs:
      Math.max(
        1,
        Number(durationMs) ||
        CANDIDATE_COMBAT_BEAT_MS
      ),
    risePx:
      Number.isFinite(risePx)
        ? Number(risePx)
        : R236_FLOAT_RISE_PX,
    show,
    sound,
    meta:{...meta}
  };

  group.pending.push(beat);
  candidateScheduleCombatBeatFlush();

  return beat;
}


function candidateRunCombatBeat(beat){
  if(
    !beat ||
    !candidateCombatBeatPresentationEnabled()
  ){
    return;
  }

  const unit=
    beat.unitId
      ? getUnitById(beat.unitId)
      : beat.unit;

  if(!unit){
    return;
  }

  if(typeof beat.show==="function"){
    beat.show(unit,beat);
  }else{
    r236QueueFloatingCombatText(
      unit,
      beat.text,
      beat.kind,
      {
        durationMs:beat.durationMs,
        risePx:beat.risePx
      }
    );

    if(typeof beat.sound==="function"){
      beat.sound(unit,beat);
    }
  }
}


function candidateFlushCombatBeats(){
  const now=performance.now();

  for(const group of candidateCombatBeatGroups.values()){
    if(!group.pending.length){
      continue;
    }

    /*
      Calls made in one synchronous combat-resolution stack are sorted by
      semantic priority, not by incidental function-call order. This is what
      lets casting interruption be queued by the damage hook first but still
      appear AFTER both direct and rider damage.
    */
    group.pending.sort((a,b)=>
      a.priority-b.priority ||
      a.id-b.id
    );

    let startsAt=
      Math.max(
        now,
        Number(group.nextAvailableAt)||0
      );

    const pending=
      group.pending.splice(
        0,
        group.pending.length
      );

    for(const beat of pending){
      const delay=
        Math.max(
          0,
          startsAt-now
        );

      setTimeout(
        ()=>candidateRunCombatBeat(beat),
        delay
      );

      startsAt+=beat.durationMs;
    }

    group.nextAvailableAt=startsAt;
    candidateCombatBeatHoldUntil=
      Math.max(
        candidateCombatBeatHoldUntil,
        startsAt
      );
  }
}


/* ============================================================
   HOLD TURN PROGRESSION UNTIL THE VISIBLE SERIES FINISHES
   ============================================================ */

const candidateBaseCombatActionPauseRemaining=
  combatActionPauseRemaining;

combatActionPauseRemaining=function(){
  return Math.max(
    candidateBaseCombatActionPauseRemaining(),
    candidateCombatBeatRemaining()
  );
};


/* ============================================================
   DAMAGE CLASSIFICATION
   ============================================================ */

function candidateWithDamageBeatContext(
  context,
  callback
){
  const previous=
    candidateDamageBeatContext;

  candidateDamageBeatContext={
    ...(context || {})
  };

  try{
    return callback();
  }finally{
    candidateDamageBeatContext=
      previous;
  }
}


const candidateBaseShowDamageText=
  r236ShowDamageText;

r236ShowDamageText=function(unit,damage){
  const amount=
    Math.max(
      0,
      Math.round(Number(damage)||0)
    );

  if(amount<=0){
    return null;
  }

  const context=
    candidateDamageBeatContext || {};

  const category=
    context.category ||
    "direct-damage";

  const damageType=
    String(
      context.damageType ||
      ""
    ).trim();

  const secondary=
    category==="secondary-damage";

  const text=
    secondary && damageType
      ? `-${amount} ${damageType}`
      : `-${amount} dmg`;

  return candidateQueueCombatBeat(
    unit,
    {
      category,
      text,
      kind:
        secondary
          ? "secondary-damage"
          : "damage",
      durationMs:
        CANDIDATE_COMBAT_BEAT_MS,
      risePx:
        R236_FLOAT_RISE_PX,
      meta:{
        amount,
        damageType:
          damageType || null
      }
    }
  );
};


/* ============================================================
   BUFF / DEBUFF APPLICATION BEATS
   ============================================================ */

const candidateBaseAddUnitEffect=
  addUnitEffect;

addUnitEffect=function(
  unit,
  effectSpec
){
  const effect=
    candidateBaseAddUnitEffect(
      unit,
      effectSpec
    );

  if(
    effect &&
    candidateCombatBeatPresentationEnabled()
  ){
    const category=
      effect.kind==="debuff"
        ? "debuff"
        : "buff";

    candidateQueueCombatBeat(
      unit,
      {
        category,
        text:String(
          effect.name ||
          effect.id ||
          (
            category==="buff"
              ? "Buff"
              : "Debuff"
          )
        ),
        kind:category,
        durationMs:
          CANDIDATE_COMBAT_BEAT_MS,
        risePx:
          R236_FLOAT_RISE_PX,
        meta:{
          effectId:effect.id || null
        }
      }
    );
  }

  return effect;
};


/* ============================================================
   STYLE EXTENSIONS
   ============================================================ */

const candidateBeatBaseFloatingTextStyle=
  r236FloatingTextStyle;

r236FloatingTextStyle=function(kind,alpha){
  switch(kind){
    case "secondary-damage":
      return {
        fontSize:13,
        fill:
          "rgba(255,176,90,"+
          alpha+
          ")",
        stroke:
          "rgba(26,8,2,"+
          Math.min(1,alpha*0.98)+
          ")"
      };

    case "buff":
      return {
        fontSize:13,
        fill:
          "rgba(150,245,170,"+
          alpha+
          ")",
        stroke:
          "rgba(3,18,6,"+
          Math.min(1,alpha*0.98)+
          ")"
      };

    case "debuff":
      return {
        fontSize:13,
        fill:
          "rgba(255,172,182,"+
          alpha+
          ")",
        stroke:
          "rgba(24,3,6,"+
          Math.min(1,alpha*0.98)+
          ")"
      };

    case "condition":
      return {
        fontSize:13,
        fill:
          "rgba(255,255,255,"+
          alpha+
          ")",
        stroke:
          "rgba(8,8,10,"+
          Math.min(1,alpha)+
          ")"
      };

    default:
      return candidateBeatBaseFloatingTextStyle(
        kind,
        alpha
      );
  }
};


/* ============================================================
   FOLLOW-ON CONDITION API
   ============================================================ */

function candidateQueuePhysicalConditionBeat(
  unit,
  text,
  options={}
){
  return candidateQueueCombatBeat(
    unit,
    {
      category:"condition",
      text,
      kind:options.kind || "condition",
      durationMs:
        options.durationMs ||
        CANDIDATE_COMBAT_BEAT_MS,
      risePx:
        Number.isFinite(options.risePx)
          ? options.risePx
          : R236_FLOAT_RISE_PX,
      sound:options.sound || null,
      meta:{
        condition:
          options.condition || null
      }
    }
  );
}


/* ============================================================
   PUBLIC DIAGNOSTICS / FUTURE EFFECT INTEGRATION
   ============================================================ */

window.AdventurePartyCombatBeats={
  channel:"candidate",
  candidateRevision:2,
  beatMs:CANDIDATE_COMBAT_BEAT_MS,
  order:[
    "direct-damage",
    "secondary-damage",
    "buff",
    "debuff",
    "condition"
  ],
  queue:candidateQueueCombatBeat,
  damageContext:
    candidateWithDamageBeatContext,
  condition:
    candidateQueuePhysicalConditionBeat,
  remainingMs:
    candidateCombatBeatRemaining,
  state:()=>({
    remainingMs:
      candidateCombatBeatRemaining(),
    groups:
      [...candidateCombatBeatGroups.values()]
        .map(group=>({
          key:group.key,
          pending:
            group.pending.map(beat=>({
              id:beat.id,
              category:beat.category,
              text:beat.text
            })),
          nextAvailableAt:
            group.nextAvailableAt
        }))
  })
};
