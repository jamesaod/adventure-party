/* ============================================================
   CANCEL BEHAVIOR
   ============================================================ */

const r227BaseExitAimMode=exitAimMode;
exitAimMode=function(redraw=true,cancelPending=true){
  const canceled=(
    cancelPending &&
    pendingAimAction?.meteorVolley
  )
    ? {...pendingAimAction}
    : null;

  const result=r227BaseExitAimMode(redraw,cancelPending);

  if(canceled){
    const caster=spellCasterForAction(canceled);
    spellCastInProgress=false;

    queueMicrotask(()=>{
      if(canceled.fromInitialCast){
        if(
          !game?.over &&
          caster?.alive &&
          game.active===caster.id
        ){
          setCombatMessage(
            "Minute Meteor target selection canceled; no meteors were spent and the stored pool remains."
          );
          finishTestSpellCast(
            caster,
            "Melf's Minute Meteors",
            canceled.originAction || null
          );
        }
      }else{
        setCombatMessage(
          "Minute Meteor target selection canceled; no meteors were spent."
        );
        updateUi();
        draw();
      }
    });
  }

  return result;
};


/* ============================================================
   SELECTION + SIMULTANEOUS VOLLEY PRESENTATION
   ============================================================ */

function r227DrawMeteorSelectionMarkers(){
  const action=pendingAimAction;
  if(!action?.meteorVolley || !Array.isArray(action.meteorTargetIds)) return;

  const counts=new Map();
  for(const id of action.meteorTargetIds){
    counts.set(id,(counts.get(id)||0)+1);
  }

  for(const [id,count] of counts.entries()){
    const unit=getUnitById(id);
    if(!unit?.alive || !shouldRenderUnitUnderPartyVisibility(unit)) continue;
    const c=hexCenter(unit.x,unit.y);
    ctx.save();
    ctx.font='700 12px "EB Garamond", Georgia, serif';
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.lineWidth=3;
    ctx.strokeStyle="rgba(16,8,4,0.92)";
    ctx.fillStyle="rgba(255,196,82,0.98)";
    const label=count>1 ? `×${count}` : "●";
    ctx.strokeText(label,c.x,c.y-52);
    ctx.fillText(label,c.x,c.y-52);
    ctx.restore();
  }
}

const r227BaseDrawPersistentCharmStatusFx=drawPersistentCharmStatusFx;
drawPersistentCharmStatusFx=function(){
  r227BaseDrawPersistentCharmStatusFx();
  r227DrawMeteorSelectionMarkers();
};

const r227BaseDrawProjectileFx=drawProjectileFx;
drawProjectileFx=function(){
  r227BaseDrawProjectileFx();
  r227DrawMeteorVolleyFx();
};


/* ============================================================
   DIAGNOSTICS
   ============================================================ */

if(window.AdventurePartyLevel3Spells){
  window.AdventurePartyLevel3Spells.release="R227";
  window.AdventurePartyLevel3Spells.minuteMeteorState=()=>{
    const caster=activePlayerControlledUnit() || game?.player;
    const effect=r227MinuteMeteorEffect(caster);
    return {
      casterId:caster?.id || null,
      remaining:r227MinuteMeteorRemaining(effect),
      volleySize:r227MinuteMeteorVolleySize(effect),
      targeting:!!pendingAimAction?.meteorVolley,
      selectedTargetIds:[...(pendingAimAction?.meteorTargetIds || [])],
      autoFireDisabled:!!(caster && r227PlayerDirectsMeteors(caster))
    };
  };
}
