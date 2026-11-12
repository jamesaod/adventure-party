/*
  Candidate Rev 2 — ordered combat presentation beats
  ====================================================
  One resolved action may now present several consequences in a readable series.

  Beat order in the shared result channel:
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
  "direct-result":10,
  "secondary-damage":20,
  "buff":30,
  "debuff":40,
  "condition":50,
  "death":60
});

let candidateCombatBeatSequence=0;
let candidateCombatBeatGeneration=0;
let candidateCombatBeatHoldUntil=0;
let candidateDamageBeatContext=null;
const candidateCombatBeatGroups=new Map();
let candidateCombatBeatFlushQueued=false;
const candidateCombatBeatTimers=new Set();
const candidateCombatBeatReady=[];
let candidateCombatBeatActive=false;
let candidateCombatBeatBatch=null;
function candidateWithSimultaneousCombatBeats(resolve){
 const previous=candidateCombatBeatBatch;
 candidateCombatBeatBatch=previous||{id:"simultaneous-"+(++candidateCombatBeatSequence)};
 try{return resolve();}finally{candidateCombatBeatBatch=previous;}
}


/* ============================================================
   CORE QUEUE
   ============================================================ */

function candidateCombatBeatPresentationEnabled(){
  return !!(
    game &&
    (currentScreen==="combat" || currentScreen==="spell-preview") &&
    !combatAwaitingStart
  );
}


function candidateCombatBeatKey(unit){
  return String(unit?.id || "anonymous");
}


function candidateCombatBeatRemaining(){
  return Math.max(
    candidateCombatBeatActive ? 1 : 0,
    Math.ceil(
      candidateCombatBeatHoldUntil-
      performance.now()
    )
  );
}


function candidateCombatBeatGroupFor(unit){
  const key=candidateCombatBeatKey(unit);
  const existing=
    candidateCombatBeatGroups.get(key);

  /*
    Unit ids are reused between battles. Never let a previous encounter's
    presentation timeline delay or leak into a newly created game object.
  */
  if(
    !existing ||
    existing.gameRef!==game
  ){
    candidateCombatBeatGroups.set(key,{
      key,
      gameRef:game,
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
    gameRef:game,
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
    meta:{...meta,...(candidateCombatBeatBatch?{simultaneousBatch:candidateCombatBeatBatch.id,actionId:candidateCombatBeatBatch.id}:{})}
  };

  group.pending.push(beat);
  candidateScheduleCombatBeatFlush();

  return beat;
}


function candidateRunCombatBeat(beat){
  if(
    !beat ||
    beat.gameRef!==game ||
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


function candidateStartNextCombatBeat(){
  const beat=candidateCombatBeatReady.shift();
  if(!beat){candidateCombatBeatActive=false;candidateCombatBeatHoldUntil=0;return;}
  candidateCombatBeatHoldUntil=performance.now()+(candidateCombatBeatReady.length+1)*CANDIDATE_COMBAT_BEAT_MS;
  const generation=candidateCombatBeatGeneration;
  try{
    for(const member of beat.simultaneousBeats||[beat]){
      try{candidateRunCombatBeat(member);}catch(error){console.error("Combat batch member failed",error);}
    }
  }catch(error){
    // Results are presentation of already-resolved mechanics. A failed sound,
    // death effect or render must not leave initiative waiting forever.
    console.error('Combat result presentation failed',{
      category:beat.category,unitId:beat.unitId,round:beat.gameRef?.round
    },error);
  }
  // A presentation callback may leave combat or clear the queue itself.
  if(generation!==candidateCombatBeatGeneration)return;
  // Chain from the actual presentation, so a slow/hidden tab cannot collapse
  // several overdue results into one unreadable frame after a stall.
  const timer=setTimeout(()=>{candidateCombatBeatTimers.delete(timer);candidateStartNextCombatBeat();},CANDIDATE_COMBAT_BEAT_MS);
  candidateCombatBeatTimers.add(timer);
}
function candidateFlushCombatBeats(){
  const now=performance.now(),pending=[];
  for(const group of candidateCombatBeatGroups.values()){
    if(group.gameRef!==game){group.pending.length=0;continue;}
    pending.push(...group.pending.splice(0));
  }
  // Keep every consequence of an attack together when several resolve in
  // the same microtask (multi-attack or reactions). Sort within each action.
  const first=new Map();
  for(const beat of pending){const key=beat.meta?.actionId??null;if(!first.has(key))first.set(key,beat.id);}
  pending.sort((a,b)=>first.get(a.meta?.actionId??null)-first.get(b.meta?.actionId??null)||a.priority-b.priority||a.id-b.id);
  const batches=new Map(),ready=[];
  for(const beat of pending){
    const key=beat.meta?.simultaneousBatch;
    if(!key){ready.push(beat);continue;}
    let batch=batches.get(key);
    if(!batch){batch={...beat,simultaneousBeats:[]};batches.set(key,batch);ready.push(batch);}
    batch.simultaneousBeats.push(beat);
  }
  candidateCombatBeatReady.push(...ready);
  if(!pending.length)return;
  let startsAt=Math.max(now,candidateCombatBeatHoldUntil);
  for(const beat of ready){startsAt+=CANDIDATE_COMBAT_BEAT_MS;for(const member of beat.simultaneousBeats||[beat])candidateCombatBeatGroupFor(member.unit).nextAvailableAt=startsAt;}
  candidateCombatBeatHoldUntil=startsAt;
  if(!candidateCombatBeatActive){candidateCombatBeatActive=true;candidateStartNextCombatBeat();}
}


/* ============================================================
   HOLD TURN PROGRESSION UNTIL THE VISIBLE SERIES FINISHES
   ============================================================ */

const candidateBaseCombatActionPauseRemaining=AdventurePartyCombatServices.current('combatActionPauseRemaining');

AdventurePartyCombatServices.register('combatActionPauseRemaining','candidate-combat-beat-sequence.js:249:combatActionPauseRemaining',function(){
  return Math.max(
    candidateBaseCombatActionPauseRemaining(),
    candidateCombatBeatRemaining()
  );
});


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


const candidateBaseShowDamageText=AdventurePartyCombatServices.current('r236ShowDamageText');

AdventurePartyCombatServices.register('r236ShowDamageText','candidate-combat-beat-sequence.js:284:r236ShowDamageText',function(unit,damage){
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
});


/* ============================================================
   BUFF / DEBUFF APPLICATION BEATS
   ============================================================ */

const candidateBaseAddUnitEffect=AdventurePartyCombatServices.current('addUnitEffect');

AdventurePartyCombatServices.register('addUnitEffect','candidate-combat-beat-sequence.js:346:addUnitEffect',function(
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

    const acidArrow=
      effect.id==="acid-arrow";

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
        /*
          Candidate Rev 34:
          "Splashed with Acid" is a persistent debuff for ordering/rules, but
          its presentation is deliberately acid-green rather than generic
          debuff pink.
        */
        kind:
          acidArrow
            ? "damage-acid"
            : category,
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
});


/* ============================================================
   STYLE EXTENSIONS
   ============================================================ */

const candidateBeatBaseFloatingTextStyle=AdventurePartyCombatServices.current('r236FloatingTextStyle');

AdventurePartyCombatServices.register('r236FloatingTextStyle','candidate-combat-beat-sequence.js:413:r236FloatingTextStyle',function(kind,alpha){
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
});


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
  candidateRevision:251,
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
  clear:()=>{
      candidateCombatBeatGeneration++;
    for(const timer of candidateCombatBeatTimers){
      clearTimeout(timer);
    }
    candidateCombatBeatTimers.clear();
    candidateCombatBeatGroups.clear();
    candidateCombatBeatReady.length=0;
    candidateCombatBeatActive=false;
    candidateCombatBeatHoldUntil=0;
    candidateCombatBeatFlushQueued=false;
    return true;
  },
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
