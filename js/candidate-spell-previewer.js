/*
  Candidate Rev 4 — Spell Effects Previewer
  ==========================================
  Dedicated development harness for production spell presentation.

  Design rules:
  - reuses the real battlefield canvas and renderer;
  - reuses production spell VFX/SFX functions rather than cloning effects;
  - builds disposable caster/target units outside the live combat flow;
  - measures actual event timing and loops deterministically;
  - exposes five representative production profiles first:
      Magic Missile, Fireball, Sleep, Wall of Fog, Lightning Bolt.
*/

const SPELL_PREVIEW_REVISION=4;
const SPELL_PREVIEW_LOOP_GAP_MS=1000;

const spellPreviewUi={
  screen:document.getElementById("spellPreviewScreen"),
  arena:document.getElementById("spellPreviewArena"),
  placeholder:document.getElementById("spellPreviewArenaPlaceholder"),
  library:document.getElementById("spellPreviewLibrary"),
  coverage:document.getElementById("spellPreviewCoverage"),
  spellName:document.getElementById("spellPreviewSpellName"),
  spellMeta:document.getElementById("spellPreviewSpellMeta"),
  casterLevel:document.getElementById("spellPreviewCasterLevel"),
  targetCount:document.getElementById("spellPreviewTargetCount"),
  outcome:document.getElementById("spellPreviewOutcome"),
  mode:document.getElementById("spellPreviewMode"),
  loop:document.getElementById("spellPreviewLoop"),
  play:document.getElementById("spellPreviewPlayButton"),
  stop:document.getElementById("spellPreviewStopButton"),
  restart:document.getElementById("spellPreviewRestartButton"),
  status:document.getElementById("spellPreviewStatus"),
  elapsed:document.getElementById("spellPreviewElapsed"),
  runState:document.getElementById("spellPreviewRunState"),
  timelineTrack:document.getElementById("spellPreviewTimelineTrack"),
  timelineMarkers:document.getElementById("spellPreviewTimelineMarkers"),
  timelinePlayhead:document.getElementById("spellPreviewTimelinePlayhead"),
  eventLog:document.getElementById("spellPreviewEventLog"),
  returnButton:document.getElementById("spellPreviewReturnButton")
};

const spellPreviewCanvasHome={
  parent:canvas.parentElement,
  nextSibling:canvas.nextSibling
};

const spellPreviewBaseFitBattleCanvas=
  fitBattleCanvas;

let spellPreviewActive=false;
let spellPreviewRenderFrame=null;
let spellPreviewRunToken=0;
let spellPreviewRunning=false;
let spellPreviewRunStartedAt=0;
let spellPreviewTimelineDurationMs=4000;
let spellPreviewTimelineEvents=[];
let spellPreviewSelectedId="magic-missile";
let spellPreviewTreeCoverageBackup=null;
let spellPreviewCaster=null;
let spellPreviewFriendlyDummy=null;
let spellPreviewHostiles=[];


/* ============================================================
   PROFILES
   ============================================================ */

const SPELL_PREVIEW_PROFILES=Object.freeze({
  "magic-missile":{
    spellId:"magic-missile",
    nominalMs:3900,
    label:"Projectile / repeated impact / damage",
    run:spellPreviewRunMagicMissile
  },

  "fireball":{
    spellId:"fireball",
    nominalMs:4300,
    label:"Projectile / AoE explosion / simultaneous damage",
    run:spellPreviewRunFireball
  },

  "sleep":{
    spellId:"sleep",
    nominalMs:4700,
    label:"Multi-target status / application / persistent VFX",
    run:spellPreviewRunSleep
  },

  "wall-of-fog":{
    spellId:"wall-of-fog",
    nominalMs:5600,
    label:"Persistent animated area / depth sorting",
    run:spellPreviewRunWallOfFog
  },

  "lightning-bolt":{
    spellId:"lightning-bolt",
    nominalMs:3900,
    label:"Directional ray / collision / damage",
    run:spellPreviewRunLightningBolt
  }
});


/* ============================================================
   SCREEN + CANVAS ROUTING
   ============================================================ */

fitBattleCanvas=function(){
  if(
    currentScreen==="spell-preview" &&
    spellPreviewUi.arena
  ){
    const rect=
      spellPreviewUi.arena.getBoundingClientRect();

    const padding=16;
    const availW=
      Math.max(
        1,
        rect.width-padding
      );

    const availH=
      Math.max(
        1,
        rect.height-padding
      );

    let cssW=availW;
    let cssH=cssW/CANVAS_ASPECT;

    if(cssH>availH){
      cssH=availH;
      cssW=cssH*CANVAS_ASPECT;
    }

    canvas.style.width=
      Math.floor(cssW)+"px";

    canvas.style.height=
      Math.floor(cssH)+"px";

    return;
  }

  return spellPreviewBaseFitBattleCanvas();
};


function spellPreviewMoveCanvasIntoArena(){
  if(
    !spellPreviewUi.arena ||
    canvas.parentElement===
      spellPreviewUi.arena
  ){
    return;
  }

  spellPreviewUi.arena.appendChild(
    canvas
  );

  if(spellPreviewUi.placeholder){
    spellPreviewUi.placeholder.hidden=true;
  }
}


function spellPreviewRestoreCanvasHome(){
  if(
    !spellPreviewCanvasHome.parent ||
    canvas.parentElement===
      spellPreviewCanvasHome.parent
  ){
    return;
  }

  spellPreviewCanvasHome.parent.insertBefore(
    canvas,
    spellPreviewCanvasHome.nextSibling
  );

  if(spellPreviewUi.placeholder){
    spellPreviewUi.placeholder.hidden=false;
  }

  spellPreviewBaseFitBattleCanvas();
}


/* ============================================================
   SANDBOX UNITS + RESET
   ============================================================ */

function spellPreviewUnitBase({
  id,
  name,
  type,
  faction,
  controller,
  x,
  y
}){
  return {
    id,
    name,
    type,
    species:type,
    creatureType:"humanoid",
    faction,
    controller,
    sizeCategory:"medium",
    footprintId:"single",
    alignment:"neutral",
    level:6,
    stats:{
      str:10,
      dex:10,
      con:10,
      int:16,
      wis:10,
      cha:10
    },
    hp:120,
    maxHp:120,
    ac:8,
    thaco:18,
    move:12,
    halfMove:6,
    x,
    y,
    alive:true,
    fled:false,
    buffs:[],
    debuffs:[],
    guard:false,
    guardRound:0,
    guardBaselineAdjacentIds:[],
    facing:"right",
    facingHex:0,
    poseName:"stand",
    poseUntil:0
  };
}


function spellPreviewMakeObserver(){
  return {
    ...spellPreviewUnitBase({
      id:"spell-preview-observer",
      name:"Preview Observer",
      type:"fighter",
      faction:"player",
      controller:"player",
      x:-18,
      y:-9
    }),
    hp:1,
    maxHp:1
  };
}


function spellPreviewMakeCaster(level){
  return {
    ...spellPreviewUnitBase({
      id:"spell-preview-caster",
      name:"Preview Caster",
      type:"mage",
      faction:"player",
      controller:"npc",
      x:-4,
      y:0
    }),
    className:"Mage",
    classGroup:"Wizard",
    level,
    thaco:mageThaco(
      Math.max(1,level)
    )
  };
}


function spellPreviewMakeFriendlyDummy(){
  return {
    ...spellPreviewUnitBase({
      id:"spell-preview-friendly",
      name:"Friendly Dummy",
      type:"ranger",
      faction:"player",
      controller:"npc",
      x:2,
      y:1
    }),
    hp:120,
    maxHp:120
  };
}


function spellPreviewMakeHostile(
  index,
  position
){
  const unit=
    makeKobold(
      index,
      position
    );

  unit.id=
    "spell-preview-target-"+
    String(index+1);

  unit.name=
    "Target "+
    String.fromCharCode(
      65+index
    );

  unit.hp=120;
  unit.maxHp=120;
  unit.faction="enemy";
  unit.controller="mob";
  unit.morale=20;
  unit.xpValue=0;
  unit.xpCounted=false;
  unit.fleeing=false;
  unit.fled=false;
  unit.alive=true;
  unit.buffs=[];
  unit.debuffs=[];

  return unit;
}


function spellPreviewClearTransientPresentation(){
  projectileFx=null;
  areaDamageFx=null;
  fireballExplosionFx=null;
  dragonBreathFx=null;
  colorSprayFx=null;
  magicEffectFx=[];
  castingGlowFx=[];
  fireDamageFx=[];
  deathFx=null;
  activityDetectedFx=null;

  if(
    typeof r226LightningFx!=="undefined"
  ){
    r226LightningFx=null;
  }

  if(
    typeof r226GustFx!=="undefined"
  ){
    r226GustFx=null;
  }

  window.AdventurePartyFloatingCombatText
    ?.clear?.();

  window.AdventurePartyCombatBeats
    ?.clear?.();

  if(combatMessageClearTimer){
    clearTimeout(
      combatMessageClearTimer
    );
    combatMessageClearTimer=null;
  }

  if(combatMessageFlashTimer){
    clearInterval(
      combatMessageFlashTimer
    );
    combatMessageFlashTimer=null;
  }

  combatMessageSequence++;
  combatMessageText="";
  combatMessageTone="normal";
  combatMessageHoldUntil=0;
}


function spellPreviewResetArena(){
  const level=
    clamp(
      Number(
        spellPreviewUi.casterLevel?.value
      ) || 6,
      1,
      20
    );

  const targetCount=
    [1,3,5].includes(
      Number(
        spellPreviewUi.targetCount?.value
      )
    )
      ? Number(
          spellPreviewUi.targetCount.value
        )
      : 5;

  configureArchitecturalWalls(
    "grass"
  );

  spellPreviewClearTransientPresentation();

  const observer=
    spellPreviewMakeObserver();

  spellPreviewCaster=
    spellPreviewMakeCaster(
      level
    );

  spellPreviewFriendlyDummy=
    spellPreviewMakeFriendlyDummy();

  const positions=[
    {x:0,y:0},
    {x:2,y:0},
    {x:2,y:-1},
    {x:3,y:0},
    {x:1,y:-1}
  ];

  spellPreviewHostiles=
    positions
      .slice(0,targetCount)
      .map(
        (position,index)=>
          spellPreviewMakeHostile(
            index,
            position
          )
      );

  game={
    round:1,
    over:false,
    condition:"grass",
    player:observer,
    allies:[
      spellPreviewCaster,
      spellPreviewFriendlyDummy
    ],
    enemies:
      spellPreviewHostiles,
    order:[],
    turnIndex:0,
    active:
      spellPreviewCaster.id,
    xpAwarded:false,
    xpPool:0,
    areaEffects:[],
    enemyGroupMorale:null,
    r230Castings:{},
    r230InitiativeByUnit:{}
  };

  lastPlayerVisibilityObserverId=null;

  camera.x=0;
  camera.y=0;

  aimMode=false;
  pendingAimAction=null;
  spellCastInProgress=false;
  combatOpeningSpeechDone=true;
  combatAwaitingStart=false;

  hoverHex=null;

  if(
    ui.resultOverlay
  ){
    ui.resultOverlay.classList.remove(
      "show"
    );
  }

  if(
    ui.turnBanner
  ){
    ui.turnBanner.textContent=
      "SPELL PREVIEW SANDBOX";
  }

  draw();
  spellPreviewDrawDevelopmentLabels();
  spellPreviewUpdateSpellMeta();
  spellPreviewSetStatus(
    "Arena reset. Production renderer, VFX and SFX are ready."
  );
}


/* ============================================================
   DEVELOPMENT OVERLAY
   ============================================================ */

function spellPreviewDrawDevelopmentLabels(){
  if(
    currentScreen!=="spell-preview" ||
    !game
  ){
    return;
  }

  const labels=[
    {
      unit:spellPreviewCaster,
      text:"CASTER",
      dy:49
    },
    {
      unit:spellPreviewFriendlyDummy,
      text:"FRIENDLY",
      dy:45
    },
    ...spellPreviewHostiles.map(
      unit=>({
        unit,
        text:unit.name.toUpperCase(),
        dy:42
      })
    )
  ];

  for(const entry of labels){
    if(
      !entry.unit?.alive ||
      entry.unit.fled
    ){
      continue;
    }

    const point=
      unitFootprintScreenCenter(
        entry.unit
      );

    drawWhiteBattlefieldText(
      entry.text,
      point.x,
      Math.round(
        point.y-entry.dy
      ),
      {
        fontSize:10
      }
    );
  }
}


/* ============================================================
   LIBRARY + DETAILS
   ============================================================ */

function spellPreviewImplementedSpells(){
  return Object.values(
    SPELL_CATALOG
  )
    .filter(
      spell=>
        spell?.combatImplemented
    )
    .sort(
      (a,b)=>
        Number(a.level)-Number(b.level) ||
        String(a.name).localeCompare(
          String(b.name)
        )
    );
}


function spellPreviewRenderLibrary(){
  if(!spellPreviewUi.library){
    return;
  }

  const spells=
    spellPreviewImplementedSpells();

  spellPreviewUi.library.innerHTML="";

  for(const spell of spells){
    const profile=
      SPELL_PREVIEW_PROFILES[
        spell.id
      ];

    const button=
      document.createElement(
        "button"
      );

    button.type="button";
    button.className=
      "spell-preview-spell-button"+
      (
        profile
          ? ""
          : " pending"
      );

    button.dataset.spellId=
      spell.id;

    button.disabled=
      !profile ||
      spellPreviewRunning;

    button.innerHTML=
      "<span>"+
        "L"+
        spell.level+
        " — "+
        spell.name+
      "</span>"+
      '<span class="spell-preview-ready-tag">'+
        (
          profile
            ? "READY"
            : "PENDING"
        )+
      "</span>";

    if(
      spell.id===
      spellPreviewSelectedId
    ){
      button.classList.add(
        "active"
      );
    }

    if(profile){
      button.addEventListener(
        "click",
        ()=>{
          if(spellPreviewRunning){
            return;
          }

          spellPreviewSelectedId=
            spell.id;

          spellPreviewRenderLibrary();
          spellPreviewResetTimeline();
          spellPreviewResetArena();
        }
      );
    }

    spellPreviewUi.library.appendChild(
      button
    );
  }

  const ready=
    Object.keys(
      SPELL_PREVIEW_PROFILES
    ).length;

  if(spellPreviewUi.coverage){
    spellPreviewUi.coverage.textContent=
      ready+
      " preview-ready / "+
      spells.length+
      " implemented combat spells. "+
      "Rev 4 establishes the harness; additional profiles can be added without duplicating spell mechanics.";
  }
}


function spellPreviewUpdateSpellMeta(){
  const spell=
    getSpellEntry(
      spellPreviewSelectedId
    );

  const profile=
    SPELL_PREVIEW_PROFILES[
      spellPreviewSelectedId
    ];

  if(!spell){
    return;
  }

  if(spellPreviewUi.spellName){
    spellPreviewUi.spellName.textContent=
      spell.name;
  }

  if(spellPreviewUi.spellMeta){
    spellPreviewUi.spellMeta.innerHTML=
      "<span>Level</span><span>"+
        spell.level+
      "</span>"+
      "<span>Casting</span><span>"+
        String(
          spell.castingTime ??
          "—"
        )+
      "</span>"+
      "<span>Area</span><span>"+
        String(
          spell.areaOfEffect ||
          "—"
        )+
      "</span>"+
      "<span>Mode</span><span>"+
        (
          profile?.label ||
          "Profile pending"
        )+
      "</span>";
  }
}


/* ============================================================
   TIMELINE
   ============================================================ */

function spellPreviewResetTimeline(){
  spellPreviewRunStartedAt=0;
  spellPreviewTimelineEvents=[];

  const profile=
    SPELL_PREVIEW_PROFILES[
      spellPreviewSelectedId
    ];

  spellPreviewTimelineDurationMs=
    profile?.nominalMs ||
    4000;

  if(spellPreviewUi.timelineMarkers){
    spellPreviewUi.timelineMarkers.innerHTML="";
  }

  if(spellPreviewUi.eventLog){
    spellPreviewUi.eventLog.innerHTML="";
  }

  if(spellPreviewUi.timelinePlayhead){
    spellPreviewUi.timelinePlayhead.style.left="0%";
  }

  if(spellPreviewUi.elapsed){
    spellPreviewUi.elapsed.textContent=
      "0.000 s / "+
      (
        spellPreviewTimelineDurationMs/
        1000
      ).toFixed(3)+
      " s";
  }
}


function spellPreviewRenderTimelineEvents(){
  if(
    !spellPreviewUi.eventLog ||
    !spellPreviewUi.timelineMarkers
  ){
    return;
  }

  spellPreviewUi.eventLog.innerHTML=
    spellPreviewTimelineEvents
      .map(
        event=>
          '<div class="spell-preview-event-row">'+
            '<span class="time">'+
              (
                event.elapsedMs/
                1000
              ).toFixed(3)+
              "s"+
            "</span>"+
            '<span class="label">'+
              spellPreviewEscapeHtml(
                event.label
              )+
            "</span>"+
          "</div>"
      )
      .join("");

  spellPreviewUi.timelineMarkers.innerHTML=
    spellPreviewTimelineEvents
      .map(event=>{
        const left=
          Math.max(
            0,
            Math.min(
              100,
              (
                event.elapsedMs/
                Math.max(
                  1,
                  spellPreviewTimelineDurationMs
                )
              )*100
            )
          );

        return (
          '<span class="spell-preview-timeline-marker" '+
          'style="left:'+
          left.toFixed(2)+
          '%" title="'+
          spellPreviewEscapeHtml(
            event.label
          )+
          '"></span>'
        );
      })
      .join("");

  spellPreviewUi.eventLog.scrollTop=
    spellPreviewUi.eventLog.scrollHeight;
}


function spellPreviewMark(label){
  if(!spellPreviewRunStartedAt){
    return;
  }

  const elapsedMs=
    Math.max(
      0,
      performance.now()-
      spellPreviewRunStartedAt
    );

  spellPreviewTimelineEvents.push({
    label,
    elapsedMs
  });

  if(
    elapsedMs>
    spellPreviewTimelineDurationMs
  ){
    spellPreviewTimelineDurationMs=
      Math.ceil(
        (elapsedMs+500)/500
      )*500;
  }

  spellPreviewRenderTimelineEvents();
}


function spellPreviewUpdateTimelineClock(){
  if(
    !spellPreviewRunStartedAt ||
    !spellPreviewUi.elapsed ||
    !spellPreviewUi.timelinePlayhead
  ){
    return;
  }

  const elapsed=
    Math.max(
      0,
      performance.now()-
      spellPreviewRunStartedAt
    );

  const bounded=
    Math.min(
      spellPreviewTimelineDurationMs,
      elapsed
    );

  spellPreviewUi.elapsed.textContent=
    (
      elapsed/1000
    ).toFixed(3)+
    " s / "+
    (
      spellPreviewTimelineDurationMs/
      1000
    ).toFixed(3)+
    " s";

  spellPreviewUi.timelinePlayhead.style.left=
    (
      bounded/
      Math.max(
        1,
        spellPreviewTimelineDurationMs
      )*
      100
    ).toFixed(2)+
    "%";
}


function spellPreviewEscapeHtml(value){
  return String(
    value ?? ""
  )
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}


/* ============================================================
   RUN CONTROL
   ============================================================ */

function spellPreviewPresentationFlags(){
  const mode=
    spellPreviewUi.mode?.value ||
    "full";

  return {
    mode,
    visuals:
      mode!=="sfx",
    sounds:
      mode!=="vfx"
  };
}


function spellPreviewSetStatus(text){
  if(spellPreviewUi.status){
    spellPreviewUi.status.textContent=
      text;
  }
}


function spellPreviewSetRunState(
  label,
  running=false
){
  if(spellPreviewUi.runState){
    spellPreviewUi.runState.textContent=
      label;

    spellPreviewUi.runState
      .classList.toggle(
        "running",
        running
      );
  }
}


function spellPreviewUpdateControls(){
  if(spellPreviewUi.play){
    spellPreviewUi.play.disabled=
      spellPreviewRunning;
  }

  if(spellPreviewUi.stop){
    spellPreviewUi.stop.disabled=
      !spellPreviewRunning;
  }

  if(spellPreviewUi.restart){
    spellPreviewUi.restart.disabled=
      spellPreviewRunning;
  }

  for(
    const button of
    spellPreviewUi.library
      ?.querySelectorAll(
        ".spell-preview-spell-button"
      ) ||
    []
  ){
    const ready=
      !!SPELL_PREVIEW_PROFILES[
        button.dataset.spellId
      ];

    button.disabled=
      spellPreviewRunning ||
      !ready;
  }
}


function spellPreviewTokenActive(token){
  return !!(
    spellPreviewActive &&
    currentScreen==="spell-preview" &&
    token===spellPreviewRunToken
  );
}


async function spellPreviewWait(
  ms,
  token
){
  const end=
    performance.now()+
    Math.max(
      0,
      Number(ms)||0
    );

  while(
    performance.now()<end
  ){
    if(
      !spellPreviewTokenActive(
        token
      )
    ){
      return false;
    }

    await sleep(
      Math.min(
        50,
        Math.max(
          1,
          end-performance.now()
        )
      )
    );
  }

  return spellPreviewTokenActive(
    token
  );
}


function spellPreviewStop({
  status="Stopped."
}={}){
  spellPreviewRunToken++;
  spellPreviewRunning=false;

  window.AdventurePartyCombatBeats
    ?.clear?.();

  window.AdventurePartyFloatingCombatText
    ?.clear?.();

  spellPreviewSetRunState(
    "STOPPED",
    false
  );

  spellPreviewSetStatus(
    status
  );

  spellPreviewUpdateControls();
}


async function spellPreviewCastCue(
  spell,
  token
){
  const flags=
    spellPreviewPresentationFlags();

  spellPreviewMark(
    "Casting begins"
  );

  if(flags.visuals){
    r236QueueFloatingCombatText(
      spellPreviewCaster,
      "Begins Casting.",
      "casting",
      {
        durationMs:1000,
        risePx:0
      }
    );

    speakSpellIncantation(
      spellPreviewCaster,
      spell,
      900
    );
  }

  if(flags.sounds){
    window.AdventurePartyCastingSound
      ?.play?.();
  }

  await spellPreviewWait(
    1000,
    token
  );

  spellPreviewMark(
    "Casting cue complete"
  );
}


async function spellPreviewStartRun(){
  if(
    spellPreviewRunning ||
    !spellPreviewActive
  ){
    return;
  }

  const profile=
    SPELL_PREVIEW_PROFILES[
      spellPreviewSelectedId
    ];

  if(!profile){
    spellPreviewSetStatus(
      "This spell has not received a Previewer profile yet."
    );
    return;
  }

  spellPreviewRunning=true;
  const token=
    ++spellPreviewRunToken;

  spellPreviewUpdateControls();

  do{
    if(
      !spellPreviewTokenActive(
        token
      )
    ){
      break;
    }

    spellPreviewResetArena();
    spellPreviewResetTimeline();

    spellPreviewTimelineDurationMs=
      profile.nominalMs;

    spellPreviewRunStartedAt=
      performance.now();

    spellPreviewSetRunState(
      "RUNNING",
      true
    );

    spellPreviewSetStatus(
      "Running "+
      getSpellEntry(
        profile.spellId
      )?.name+
      " through production presentation functions."
    );

    spellPreviewMark(
      "Preview reset"
    );

    try{
      await profile.run(
        token
      );
    }catch(error){
      console.error(
        "Spell Previewer run failed:",
        error
      );

      spellPreviewMark(
        "ERROR: "+
        (
          error?.message ||
          String(error)
        )
      );

      spellPreviewSetStatus(
        "Preview error: "+
        (
          error?.message ||
          String(error)
        )
      );

      spellPreviewSetRunState(
        "ERROR",
        false
      );

      break;
    }

    if(
      !spellPreviewTokenActive(
        token
      )
    ){
      break;
    }

    spellPreviewMark(
      "Sequence complete"
    );

    spellPreviewSetRunState(
      spellPreviewUi.loop?.checked
        ? "LOOP GAP"
        : "COMPLETE",
      !!spellPreviewUi.loop?.checked
    );

    if(
      !spellPreviewUi.loop?.checked
    ){
      break;
    }

    spellPreviewSetStatus(
      "Loop reset in 1 second."
    );

    if(
      !await spellPreviewWait(
        SPELL_PREVIEW_LOOP_GAP_MS,
        token
      )
    ){
      break;
    }
  }while(
    spellPreviewTokenActive(
      token
    ) &&
    spellPreviewUi.loop?.checked
  );

  if(token===spellPreviewRunToken){
    spellPreviewRunning=false;
    spellPreviewSetRunState(
      "READY",
      false
    );
    spellPreviewSetStatus(
      "Preview complete."
    );
    spellPreviewUpdateControls();
  }
}


/* ============================================================
   PROFILE HELPERS
   ============================================================ */

function spellPreviewPrimaryTarget(){
  return spellPreviewHostiles[0] || null;
}


function spellPreviewDamageValue(
  fullDamage
){
  const outcome=
    spellPreviewUi.outcome?.value ||
    "demo";

  if(outcome==="save-success"){
    return Math.max(
      1,
      Math.floor(
        fullDamage/2
      )
    );
  }

  return fullDamage;
}


function spellPreviewApplyDamage(
  units,
  amount,
  {
    damageType=null
  }={}
){
  const flags=
    spellPreviewPresentationFlags();

  if(!flags.visuals){
    return;
  }

  for(const unit of units){
    if(
      !unit?.alive ||
      unit.fled
    ){
      continue;
    }

    const actual=
      Math.min(
        Math.max(
          0,
          Number(amount)||0
        ),
        Math.max(
          0,
          unit.hp-1
        )
      );

    if(actual<=0){
      continue;
    }

    unit.hp=
      Math.max(
        1,
        unit.hp-actual
      );

    onUnitDamaged(
      unit,
      actual
    );

    if(damageType){
      registerElementalDamageFx(
        unit,
        damageType,
        actual
      );
    }
  }

  draw();
}


/* ============================================================
   MAGIC MISSILE
   ============================================================ */

async function spellPreviewRunMagicMissile(
  token
){
  const spell=
    getSpellEntry(
      "magic-missile"
    );

  const target=
    spellPreviewPrimaryTarget();

  if(!spell || !target){
    return;
  }

  await spellPreviewCastCue(
    spell,
    token
  );

  if(!spellPreviewTokenActive(token)){
    return;
  }

  const flags=
    spellPreviewPresentationFlags();

  const level=
    clamp(
      Number(
        spellPreviewUi.casterLevel?.value
      ) || 6,
      1,
      20
    );

  const count=
    magicMissileCountForCasterLevel(
      level
    );

  for(
    let index=0;
    index<count;
    index++
  ){
    spellPreviewMark(
      "Missile "+
      (index+1)+
      " launch"
    );

    if(flags.visuals){
      await animateMagicMissile(
        spellPreviewCaster,
        target,
        index,
        count
      );
    }else{
      await spellPreviewWait(
        190,
        token
      );
    }

    if(!spellPreviewTokenActive(token)){
      return;
    }

    if(flags.sounds){
      playMagicMissileHitSound(
        index
      );
    }

    spellPreviewMark(
      "Missile "+
      (index+1)+
      " impact"
    );

    if(
      !await spellPreviewWait(
        90,
        token
      )
    ){
      return;
    }
  }

  const damage=
    count*3;

  spellPreviewMark(
    "Damage beat: "+
    damage
  );

  spellPreviewApplyDamage(
    [target],
    damage,
    {
      damageType:"magic"
    }
  );

  await spellPreviewWait(
    1100,
    token
  );
}


/* ============================================================
   FIREBALL
   ============================================================ */

async function spellPreviewRunFireball(
  token
){
  const spell=
    getSpellEntry(
      "fireball"
    );

  if(!spell){
    return;
  }

  await spellPreviewCastCue(
    spell,
    token
  );

  if(!spellPreviewTokenActive(token)){
    return;
  }

  const flags=
    spellPreviewPresentationFlags();

  const targetHex={
    x:2,
    y:0
  };

  const blastCells=
    fireballBlastCells(
      targetHex
    );

  spellPreviewMark(
    "Fireball projectile launch"
  );

  if(flags.visuals){
    await animateFireballProjectile(
      spellPreviewCaster,
      targetHex
    );
  }else{
    await spellPreviewWait(
      280,
      token
    );
  }

  if(!spellPreviewTokenActive(token)){
    return;
  }

  spellPreviewMark(
    "Fireball impact"
  );

  if(flags.sounds){
    playFireballExplosionSound();
  }

  if(flags.visuals){
    await animateFireballExplosion(
      targetHex,
      fireballRadiusHexes(),
      blastCells
    );
  }else{
    await spellPreviewWait(
      820,
      token
    );
  }

  if(!spellPreviewTokenActive(token)){
    return;
  }

  const affected=
    livingUnitsInAreaCells(
      blastCells
    ).filter(
      unit=>
        unit.id!==
        spellPreviewCaster.id
    );

  const level=
    clamp(
      Number(
        spellPreviewUi.casterLevel?.value
      ) || 6,
      1,
      20
    );

  const fullDamage=
    Math.min(
      10,
      level
    )*3;

  const damage=
    spellPreviewDamageValue(
      fullDamage
    );

  spellPreviewMark(
    "AoE damage: "+
    damage+
    (
      spellPreviewUi.outcome?.value===
      "save-success"
        ? " (forced save)"
        : ""
    )
  );

  spellPreviewApplyDamage(
    affected,
    damage,
    {
      damageType:"fire"
    }
  );

  await spellPreviewWait(
    1150,
    token
  );
}


/* ============================================================
   SLEEP
   ============================================================ */

async function spellPreviewRunSleep(
  token
){
  const spell=
    getSpellEntry(
      "sleep"
    );

  if(!spell){
    return;
  }

  await spellPreviewCastCue(
    spell,
    token
  );

  if(!spellPreviewTokenActive(token)){
    return;
  }

  const flags=
    spellPreviewPresentationFlags();

  const targetHex={
    x:2,
    y:0
  };

  const cells=
    hexesWithinRadius(
      targetHex,
      1
    );

  const targets=
    livingUnitsInAreaCells(
      cells
    )
      .filter(
        unit=>
          unit.id!==
          spellPreviewCaster.id
      )
      .slice(
        0,
        Math.max(
          1,
          Number(
            spellPreviewUi.targetCount?.value
          ) || 1
        )
      );

  spellPreviewMark(
    "Sleep application: "+
    targets.length+
    " target"+
    (
      targets.length===1
        ? ""
        : "s"
    )
  );

  if(flags.visuals){
    for(const unit of targets){
      addUnitEffect(
        unit,
        {
          id:"sleep",
          name:"Magical Sleep",
          kind:"debuff",
          expiresRound:99,
          detail:"Preview: persistent magical sleep",
          data:{
            sourceUnitId:
              spellPreviewCaster.id
          }
        }
      );
    }

    await animateMagicEffectOnUnits(
      targets,
      "sleep",
      {
        playSound:
          flags.sounds
      }
    );
  }else{
    if(flags.sounds){
      targets.forEach(
        (unit,index)=>
          playMagicEffectSound(
            "sleep",
            index
          )
      );
    }

    await spellPreviewWait(
      700,
      token
    );
  }

  if(!spellPreviewTokenActive(token)){
    return;
  }

  spellPreviewMark(
    "Persistent Sleep VFX observation"
  );

  await spellPreviewWait(
    1900,
    token
  );
}


/* ============================================================
   WALL OF FOG
   ============================================================ */

async function spellPreviewRunWallOfFog(
  token
){
  const spell=
    getSpellEntry(
      "wall-of-fog"
    );

  if(!spell){
    return;
  }

  await spellPreviewCastCue(
    spell,
    token
  );

  if(!spellPreviewTokenActive(token)){
    return;
  }

  const flags=
    spellPreviewPresentationFlags();

  const targetHex={
    x:1,
    y:0
  };

  const level=
    clamp(
      Number(
        spellPreviewUi.casterLevel?.value
      ) || 6,
      1,
      20
    );

  const cells=
    createWallOfFogCells(
      spellPreviewCaster,
      targetHex,
      level,
      0
    );

  spellPreviewMark(
    "Wall of Fog forms: "+
    cells.length+
    " hexes"
  );

  if(flags.visuals){
    addAreaEffect({
      id:"spell-preview-wall-of-fog",
      type:"fog",
      name:"Wall of Fog",
      cells,
      visualHeightPx:HEX_W,
      expiresRound:99,
      sourceUnitId:
        spellPreviewCaster.id
    });
  }

  draw();

  spellPreviewMark(
    "Persistent fog observation"
  );

  await spellPreviewWait(
    3300,
    token
  );
}


/* ============================================================
   LIGHTNING BOLT
   ============================================================ */

async function spellPreviewRunLightningBolt(
  token
){
  const spell=
    getSpellEntry(
      "lightning-bolt"
    );

  if(!spell){
    return;
  }

  await spellPreviewCastCue(
    spell,
    token
  );

  if(!spellPreviewTokenActive(token)){
    return;
  }

  const flags=
    spellPreviewPresentationFlags();

  const targetHex={
    x:6,
    y:0
  };

  const trace=
    r232TraceLightningBolt(
      spellPreviewCaster,
      targetHex
    );

  spellPreviewMark(
    "Lightning discharge: "+
    trace.segments.length+
    " segment"+
    (
      trace.segments.length===1
        ? ""
        : "s"
    )
  );

  if(flags.sounds){
    playMagicEffectSound(
      "lightning"
    );
  }

  if(flags.visuals){
    r226LightningFx={
      r232Trace:true,
      segments:
        trace.segments,
      collisions:
        trace.collisions,
      started:
        performance.now(),
      duration:650
    };
  }

  await spellPreviewWait(
    650,
    token
  );

  if(
    typeof r226LightningFx!=="undefined"
  ){
    r226LightningFx=null;
  }

  if(!spellPreviewTokenActive(token)){
    return;
  }

  let struck=
    r232UnitOccurrencesAlongTrace(
      trace,
      spellPreviewCaster
    )
      .map(
        occurrence=>
          occurrence.unit
      )
      .filter(
        (
          unit,
          index,
          array
        )=>
          array.findIndex(
            candidate=>
              candidate.id===
              unit.id
          )===index
      );

  if(!struck.length){
    struck=[
      spellPreviewPrimaryTarget()
    ].filter(Boolean);
  }

  const level=
    clamp(
      Number(
        spellPreviewUi.casterLevel?.value
      ) || 6,
      1,
      20
    );

  const damage=
    spellPreviewDamageValue(
      Math.min(
        10,
        level
      )*3
    );

  spellPreviewMark(
    "Lightning damage: "+
    damage+
    " to "+
    struck.length+
    " target"+
    (
      struck.length===1
        ? ""
        : "s"
    )
  );

  spellPreviewApplyDamage(
    struck,
    damage,
    {
      damageType:"lightning"
    }
  );

  await spellPreviewWait(
    1150,
    token
  );
}


/* ============================================================
   CONTINUOUS RENDER LOOP
   ============================================================ */

function spellPreviewRenderTick(){
  spellPreviewRenderFrame=null;

  if(
    !spellPreviewActive ||
    currentScreen!=="spell-preview"
  ){
    return;
  }

  if(game){
    draw();
    spellPreviewDrawDevelopmentLabels();
  }

  spellPreviewUpdateTimelineClock();

  spellPreviewRenderFrame=
    requestAnimationFrame(
      spellPreviewRenderTick
    );
}


function spellPreviewEnsureRenderLoop(){
  if(
    spellPreviewRenderFrame!==null
  ){
    return;
  }

  spellPreviewRenderFrame=
    requestAnimationFrame(
      spellPreviewRenderTick
    );
}


/* ============================================================
   OPEN / CLOSE
   ============================================================ */

async function showSpellPreviewer(){
  spellPreviewActive=true;
  spellPreviewRunToken++;
  spellPreviewRunning=false;

  currentScreen="spell-preview";

  stopTitleMusic();
  stopWeatherAudio();

  launcherScreen.classList.remove("active");
  combatConditionsScreen?.classList.remove("active");
  xpLootScreen?.classList.remove("active");
  combatScreen.classList.remove("active");
  pixelScreen.classList.remove("active");
  spellbookScreen.classList.remove("active");
  classbookScreen.classList.remove("active");
  spellPreviewUi.screen?.classList.add("active");

  if(
    spellPreviewTreeCoverageBackup===null
  ){
    spellPreviewTreeCoverageBackup=
      GRASS_OUTDOORS_TILESET
        .treeCoverageRatio;
  }

  /*
    Keep the lab visually clean and make Lightning Bolt reproducible.
    The production terrain renderer is unchanged; only tree population is
    temporarily disabled while this development screen is active.
  */
  GRASS_OUTDOORS_TILESET.treeCoverageRatio=0;

  spellPreviewMoveCanvasIntoArena();
  fitBattleCanvas();

  spellPreviewRenderLibrary();
  spellPreviewResetTimeline();
  spellPreviewResetArena();
  spellPreviewUpdateControls();
  spellPreviewEnsureRenderLoop();

  updateAudioIndicators();

  await unlockAudio();

  /*
    A development previewer should demonstrate itself immediately.
    The Loop checkbox is on by default, so Magic Missile starts as soon as the
    launcher transition finishes.
  */
  setTimeout(()=>{
    if(
      spellPreviewActive &&
      currentScreen==="spell-preview" &&
      !spellPreviewRunning
    ){
      spellPreviewStartRun();
    }
  },180);
}


function hideSpellPreviewer(){
  spellPreviewStop({
    status:"Leaving Spell Previewer."
  });

  spellPreviewActive=false;

  if(spellPreviewRenderFrame!==null){
    cancelAnimationFrame(
      spellPreviewRenderFrame
    );
    spellPreviewRenderFrame=null;
  }

  spellPreviewClearTransientPresentation();

  if(
    spellPreviewTreeCoverageBackup!==null
  ){
    GRASS_OUTDOORS_TILESET.treeCoverageRatio=
      spellPreviewTreeCoverageBackup;

    spellPreviewTreeCoverageBackup=null;
  }

  spellPreviewRestoreCanvasHome();

  game=null;
  currentScreen="launcher";

  spellPreviewUi.screen?.classList.remove("active");
  showLauncher();
}


window.showSpellPreviewer=
  showSpellPreviewer;

window.AdventurePartySpellPreviewer={
  channel:"candidate",
  candidateRevision:
    SPELL_PREVIEW_REVISION,
  profileIds:
    Object.keys(
      SPELL_PREVIEW_PROFILES
    ),
  show:
    showSpellPreviewer,
  hide:
    hideSpellPreviewer,
  play:
    spellPreviewStartRun,
  stop:
    spellPreviewStop,
  reset:
    spellPreviewResetArena
};


/* ============================================================
   UI EVENTS
   ============================================================ */

spellPreviewUi.play
  ?.addEventListener(
    "click",
    spellPreviewStartRun
  );

spellPreviewUi.stop
  ?.addEventListener(
    "click",
    ()=>
      spellPreviewStop()
  );

spellPreviewUi.restart
  ?.addEventListener(
    "click",
    ()=>{
      if(spellPreviewRunning){
        return;
      }

      spellPreviewResetTimeline();
      spellPreviewResetArena();
    }
  );

spellPreviewUi.returnButton
  ?.addEventListener(
    "click",
    hideSpellPreviewer
  );

for(
  const input of [
    spellPreviewUi.casterLevel,
    spellPreviewUi.targetCount,
    spellPreviewUi.outcome,
    spellPreviewUi.mode
  ]
){
  input?.addEventListener(
    "change",
    ()=>{
      if(spellPreviewRunning){
        return;
      }

      spellPreviewResetTimeline();
      spellPreviewResetArena();
    }
  );
}

document.addEventListener(
  "keydown",
  event=>{
    if(
      currentScreen!=="spell-preview"
    ){
      return;
    }

    if(event.key==="Escape"){
      event.preventDefault();
      hideSpellPreviewer();
      return;
    }

    if(
      event.code==="Space" ||
      event.key===" "
    ){
      event.preventDefault();

      if(spellPreviewRunning){
        spellPreviewStop();
      }else{
        spellPreviewStartRun();
      }
    }
  }
);

spellPreviewRenderLibrary();
spellPreviewUpdateSpellMeta();
spellPreviewResetTimeline();
