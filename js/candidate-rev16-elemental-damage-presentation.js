/*
  Candidate Rev 16 — Elemental damage presentation + casting-audio cleanup
  -------------------------------------------------------------------------
  Presentation-only combat changes:
  - remove the universal initial casting SFX from every spell;
  - enlarge damage floating text by exactly 25% (13 px -> 16.25 px);
  - elemental damage text:
      lightning/electricity: rapid white <-> light-blue flicker
      acid: green
      fire: orange
      cold: light blue + trailing cold particles

  Damage calculation, saves, immunities, elemental mechanics, and spell-specific
  impact/effect sounds remain unchanged.
*/
(()=>{
  "use strict";

  const R16_DAMAGE_FONT_SIZE=16.25;

  function r16DamageKindForType(damageType){
    switch(
      String(damageType || "")
        .trim()
        .toLowerCase()
    ){
      case "lightning":
      case "electricity":
      case "electrical":
        return "damage-lightning";

      case "acid":
        return "damage-acid";

      case "fire":
        return "damage-fire";

      case "cold":
      case "frost":
      case "ice":
        return "damage-cold";

      default:
        return "damage";
    }
  }


  /* ============================================================
     REMOVE THE UNIVERSAL INITIAL CASTING SOUND
     ============================================================ */

  playPor07CastingSound=function(){
    return false;
  };

  if(window.AdventurePartyCastingSound){
    window.AdventurePartyCastingSound.play=()=>{
      false;
    };
    window.AdventurePartyCastingSound.disabledBy="Candidate Rev 16";
  }


  /* ============================================================
     DAMAGE-TYPE CONTEXT FOR SHARED SPELL-DAMAGE PATH
     ============================================================ */

  const r16BaseApplySpellDamage=
    applySpellDamage;

  applySpellDamage=function(
    source,
    target,
    damage,
    sourceName,
    damageType="magic"
  ){
    if(
      typeof candidateWithDamageBeatContext===
      "function"
    ){
      return candidateWithDamageBeatContext(
        {
          category:"direct-damage",
          damageType:
            String(damageType || "magic"),
          source:
            sourceName ||
            source?.name ||
            "spell"
        },
        ()=>
          r16BaseApplySpellDamage(
            source,
            target,
            damage,
            sourceName,
            damageType
          )
      );
    }

    return r16BaseApplySpellDamage(
      source,
      target,
      damage,
      sourceName,
      damageType
    );
  };


  /* ============================================================
     ELEMENT-AWARE FLOATING DAMAGE BEATS
     ============================================================ */

  r236ShowDamageText=function(
    unit,
    damage
  ){
    const amount=
      Math.max(
        0,
        Math.round(
          Number(damage)||0
        )
      );

    if(amount<=0){
      return null;
    }

    const context=
      (
        typeof candidateDamageBeatContext!=="undefined" &&
        candidateDamageBeatContext
      )
        ? candidateDamageBeatContext
        : {};

    const category=
      context.category ||
      "direct-damage";

    const damageType=
      String(
        context.damageType ||
        ""
      )
        .trim()
        .toLowerCase();

    const secondary=
      category==="secondary-damage";

    const kind=
      damageType
        ? r16DamageKindForType(
            damageType
          )
        : (
            secondary
              ? "secondary-damage"
              : "damage"
          );

    const text=
      secondary && damageType
        ? "-"+amount+" "+damageType
        : "-"+amount+" dmg";

    if(
      typeof candidateQueueCombatBeat===
      "function"
    ){
      return candidateQueueCombatBeat(
        unit,
        {
          category,
          text,
          kind,
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
    }

    return r236QueueFloatingCombatText(
      unit,
      text,
      kind
    );
  };


  /*
    Some older elemental paths manually subtract HP, call onUnitDamaged(), and
    only then call registerElementalDamageFx(). The combat-beat queue does not
    flush until a microtask, so at this point their just-created damage beat is
    still pending and can safely inherit the known elemental type.
  */
  const r16BaseRegisterElementalDamageFx=
    registerElementalDamageFx;

  registerElementalDamageFx=function(
    unit,
    damageType,
    damage
  ){
    const type=
      String(damageType || "")
        .trim()
        .toLowerCase();

    const amount=
      Math.max(
        0,
        Math.round(
          Number(damage)||0
        )
      );

    if(
      unit &&
      type &&
      amount>0 &&
      typeof candidateCombatBeatGroups!=="undefined"
    ){
      const group=
        candidateCombatBeatGroups.get(
          String(
            unit.id ||
            "anonymous"
          )
        );

      if(group?.pending?.length){
        for(
          let index=
            group.pending.length-1;
          index>=0;
          index--
        ){
          const beat=
            group.pending[index];

          if(
            (
              beat.category==="direct-damage" ||
              beat.category==="secondary-damage"
            ) &&
            Number(
              beat.meta?.amount
            )===amount
          ){
            beat.meta={
              ...(beat.meta || {}),
              damageType:type
            };

            beat.kind=
              r16DamageKindForType(
                type
              );

            break;
          }
        }
      }
    }

    return r16BaseRegisterElementalDamageFx(
      unit,
      damageType,
      damage
    );
  };


  /* ============================================================
     ELEMENTAL DAMAGE-TEXT STYLES
     ============================================================ */

  const r16BaseFloatingTextStyle=
    r236FloatingTextStyle;

  r236FloatingTextStyle=function(
    kind,
    alpha
  ){
    const outlineAlpha=
      Math.min(
        1,
        alpha*0.98
      );

    switch(kind){
      case "damage":
        return {
          fontSize:
            R16_DAMAGE_FONT_SIZE,
          fill:
            "rgba(255,74,82,"+
            alpha+
            ")",
          stroke:
            "rgba(20,2,4,"+
            outlineAlpha+
            ")"
        };

      case "secondary-damage":
        return {
          fontSize:
            R16_DAMAGE_FONT_SIZE,
          fill:
            "rgba(255,176,90,"+
            alpha+
            ")",
          stroke:
            "rgba(26,8,2,"+
            outlineAlpha+
            ")"
        };

      case "damage-lightning":{
        /*
          Roughly 22 flickers / second. The text alternates rather than fades
          between colours so the eye reads an unstable electrical discharge.
        */
        const whitePhase=
          (
            Math.floor(
              performance.now()/45
            )%2
          )===0;

        return {
          fontSize:
            R16_DAMAGE_FONT_SIZE,
          fill:
            whitePhase
              ? "rgba(255,255,255,"+
                alpha+
                ")"
              : "rgba(171,224,255,"+
                alpha+
                ")",
          stroke:
            "rgba(10,28,58,"+
            outlineAlpha+
            ")"
        };
      }

      case "damage-acid":
        return {
          fontSize:
            R16_DAMAGE_FONT_SIZE,
          fill:
            "rgba(111,236,105,"+
            alpha+
            ")",
          stroke:
            "rgba(8,35,7,"+
            outlineAlpha+
            ")"
        };

      case "damage-fire":
        return {
          fontSize:
            R16_DAMAGE_FONT_SIZE,
          fill:
            "rgba(255,151,55,"+
            alpha+
            ")",
          stroke:
            "rgba(48,14,2,"+
            outlineAlpha+
            ")"
        };

      case "damage-cold":
        return {
          fontSize:
            R16_DAMAGE_FONT_SIZE,
          fill:
            "rgba(174,226,255,"+
            alpha+
            ")",
          stroke:
            "rgba(7,29,52,"+
            outlineAlpha+
            ")"
        };

      default:
        return r16BaseFloatingTextStyle(
          kind,
          alpha
        );
    }
  };


  /* ============================================================
     COLD-DAMAGE PARTICLE TRAIL
     ============================================================ */

  function r16Hash01(value){
    let x=
      Math.imul(
        value|0,
        0x45d9f3b
      );

    x=
      Math.imul(
        x^(x>>>16),
        0x45d9f3b
      );

    x=x^(x>>>16);

    return (
      (x>>>0)/
      4294967295
    );
  }


  function r16DrawColdDamageParticles(){
    if(
      !game ||
      typeof r236FloatingCombatText===
        "undefined" ||
      !r236FloatingCombatText.length
    ){
      return;
    }

    const now=
      performance.now();

    for(
      const entry of
      r236FloatingCombatText
    ){
      if(
        entry.kind!=="damage-cold"
      ){
        continue;
      }

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
          ? getUnitById(
              entry.unitId
            )
          : null;

      if(
        unit &&
        !r236FloatingTextUnitVisible(
          unit
        )
      ){
        continue;
      }

      const t=
        clamp01(
          elapsed/
          Math.max(
            1,
            entry.duration
          )
        );

      const eased=
        1-
        Math.pow(
          1-t,
          1.45
        );

      const anchor=
        r236FloatingTextAnchor(
          entry
        );

      const currentY=
        anchor.y-
        entry.risePx*
        eased;

      ctx.save();
      ctx.globalCompositeOperation=
        "lighter";

      const particleCount=9;

      for(
        let index=0;
        index<particleCount;
        index++
      ){
        const seed=
          (
            Number(entry.id||1)*
            97+
            index*131
          )|0;

        const trailT=
          (index+1)/
          (particleCount+1);

        const spread=
          (
            r16Hash01(seed)*
            2-1
          )*
          (
            7+
            trailT*10
          );

        const wobble=
          Math.sin(
            now*0.011+
            index*2.37+
            r16Hash01(
              seed+17
            )*Math.PI*2
          )*
          2.4;

        const x=
          anchor.x+
          spread+
          wobble;

        /*
          Particles lag behind the rising number, leaving a short icy tail
          toward its original position.
        */
        const y=
          currentY+
          (
            anchor.y-
            currentY+
            13
          )*
          trailT+
          Math.sin(
            now*0.007+
            index
          )*
          1.8;

        const particleAlpha=
          Math.max(
            0,
            (1-t)*
            (
              0.72-
              trailT*0.32
            )
          );

        const size=
          index%3===0
            ? 2
            : 1;

        ctx.fillStyle=
          "rgba(190,235,255,"+
          particleAlpha+
          ")";

        ctx.fillRect(
          Math.round(x),
          Math.round(y),
          size,
          size
        );

        if(index%3===0){
          ctx.strokeStyle=
            "rgba(232,249,255,"+
            Math.min(
              1,
              particleAlpha*0.9
            )+
            ")";

          ctx.lineWidth=1;

          ctx.beginPath();
          ctx.moveTo(
            Math.round(x)-2,
            Math.round(y)
          );
          ctx.lineTo(
            Math.round(x)+3,
            Math.round(y)
          );
          ctx.moveTo(
            Math.round(x),
            Math.round(y)-2
          );
          ctx.lineTo(
            Math.round(x),
            Math.round(y)+3
          );
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }


  const r16BaseDrawUnitBarks=
    drawUnitBarks;

  drawUnitBarks=function(){
    r16BaseDrawUnitBarks();
    r16DrawColdDamageParticles();
  };


  window.AdventurePartyElementalDamagePresentation={
    release:"Candidate Rev 16",
    damageFontScale:1.25,
    damageFontSize:R16_DAMAGE_FONT_SIZE,
    universalCastingSound:false,
    lightningText:"white/light-blue flicker",
    acidText:"green",
    fireText:"orange",
    coldText:"light blue + particle trail"
  };
})();
