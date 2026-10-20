/*
  Candidate Rev 3 — AoE spell AIM-preview audit
  ==============================================
  Every currently implemented combat spell that both:
    1) enters AIM, and
    2) has a tactical area/line/wedge/wall/aura footprint
  now exposes that footprint before the cast is committed.

  Existing exact previews (Fireball, Lightning Bolt, walls, wedges, etc.) are
  preserved. This layer fills the audit gaps for Level 1–3 spells whose
  resolution already had an area but whose AIM mode previously showed only the
  cursor hex / target.
*/


/* ============================================================
   AUDIT INVENTORY
   ============================================================ */

const CANDIDATE_REV3_AOE_AIM_AUDIT=Object.freeze({
  /* Existing exact previews retained from the base/R226/R232 chain. */
  "burning-hands":{source:"existing",geometry:"1-hex directional fan"},
  "color-spray":{source:"existing",geometry:"2-hex directional wedge"},
  "grease":{source:"existing",geometry:"target hex"},
  "sleep":{source:"existing",geometry:"radius-1 / 7-hex cluster"},
  "taunt":{source:"existing",geometry:"radius-3 around aimed creature"},
  "wall-of-fog":{source:"existing",geometry:"obstacle-truncated rotatable wall"},
  "fireball":{source:"existing",geometry:"exact indoor/outdoor blast volume"},
  "dispel-magic":{source:"existing",geometry:"radius-1 / 7-hex volume"},
  "gust-of-wind":{source:"existing",geometry:"level-scaled straight line"},
  "haste":{source:"existing",geometry:"radius-2 volume"},
  "hold-person":{source:"existing",geometry:"radius-1 volume"},
  "hold-undead":{source:"existing",geometry:"radius-1 volume"},
  "lightning-bolt":{source:"existing",geometry:"exact reflected ray trace"},
  "slow":{source:"existing",geometry:"radius-2 volume"},
  "wind-wall":{source:"existing",geometry:"exact perpendicular wall"},

  /* Candidate Rev 3 gaps filled below. */
  "light":{source:"rev3",geometry:"20-foot illumination footprint"},
  "continual-light":{source:"rev3",geometry:"60-foot illumination footprint"},
  "darkness-15-radius":{source:"rev3",geometry:"radius-1 darkness"},
  "flaming-sphere":{source:"rev3",geometry:"occupied target hex"},
  "fog-cloud":{source:"rev3",geometry:"radius-1 cloud"},
  "glitterdust":{source:"rev3",geometry:"radius-1 volume"},
  "hypnotic-pattern":{source:"rev3",geometry:"radius-1 pattern volume"},
  "pyrotechnics":{source:"rev3",geometry:"implemented radius-12 LOS fireworks area"},
  "scare":{source:"rev3",geometry:"radius-1 fear area"},
  "stinking-cloud":{source:"rev3",geometry:"radius-1 cloud"},
  "tashas-hideous-laughter":{source:"rev3",geometry:"radius-1 target-selection volume"},
  "web":{source:"rev3",geometry:"radius-1 web area"},
  "invisibility-10-radius":{source:"rev3",geometry:"radius-1 aura around touched creature"},
  "protection-from-evil-10-radius":{source:"rev3",geometry:"radius-1 aura around touched creature"}
});


/* ============================================================
   SHARED GEOMETRY HELPERS
   ============================================================ */

function candidateRev3UniqueInsideCells(cells){
  const seen=new Set();
  const result=[];

  for(const cell of cells || []){
    if(
      !cell ||
      !inside(cell.x,cell.y)
    ){
      continue;
    }

    const cellKey=key(cell.x,cell.y);
    if(seen.has(cellKey)){
      continue;
    }

    seen.add(cellKey);
    result.push({
      x:cell.x,
      y:cell.y
    });
  }

  return result;
}


function candidateRev3RadiusCells(
  center,
  radius
){
  if(!center){
    return [];
  }

  return candidateRev3UniqueInsideCells(
    hexesWithinRadius(
      center,
      Math.max(
        0,
        Math.floor(Number(radius)||0)
      )
    )
  );
}


function candidateRev3AuraCellsAtAim(
  targetHex,
  radius
){
  const target=
    unitAtHex(
      targetHex.x,
      targetHex.y
    );

  if(
    target?.alive &&
    !target.fled
  ){
    return candidateRev3UniqueInsideCells(
      occupiedHexes(target)
        .flatMap(cell=>
          hexesWithinRadius(
            cell,
            radius
          )
        )
    );
  }

  return candidateRev3RadiusCells(
    targetHex,
    radius
  );
}


function candidateRev3IlluminationCells(
  center,
  radius
){
  return candidateRev3RadiusCells(
    center,
    radius
  ).filter(cell=>
    game?.condition!=="wall" ||
    !lightBlockedBetweenHexes(
      center,
      cell
    )
  );
}


function candidateRev3LightCells(
  caster,
  targetHex
){
  const radius=
    Math.max(
      1,
      Number(
        ILLUMINATION_RULES?.lightSpellRadiusHexes
      ) || 2
    );

  const centers=[
    {
      x:targetHex.x,
      y:targetHex.y
    }
  ];

  /*
    A hostile that saves against Light leaves the source behind it instead of
    carrying the light. Because the saving throw has not happened during AIM,
    show the union of both possible illumination placements.
  */
  const target=
    unitAtHex(
      targetHex.x,
      targetHex.y
    );

  if(
    target?.alive &&
    caster &&
    target.faction!==caster.faction
  ){
    centers.push(
      lightSpellBehindTargetHex(
        caster,
        target
      )
    );
  }

  return candidateRev3UniqueInsideCells(
    centers.flatMap(center=>
      candidateRev3IlluminationCells(
        center,
        radius
      )
    )
  );
}


function candidateRev3PyrotechnicsCells(
  targetHex
){
  /*
    Match the currently implemented fireworks mode:
      - creatures within 12 tactical hexes
      - line of sight from the chosen fire source required
    The cast still validates that the aimed hex actually contains a Flaming
    Sphere; the footprint is useful while moving the cursor before that click.
  */
  return candidateRev3RadiusCells(
    targetHex,
    12
  ).filter(cell=>
    !lineOfSightBlockedBetweenHexes(
      targetHex,
      cell
    )
  );
}


function candidateRev3Preview(
  spell,
  caster,
  cells,
  {
    tone="control",
    dangerous=false
  }={}
){
  const clean=
    candidateRev3UniqueInsideCells(
      cells
    );

  const friendlies=
    dangerous && caster
      ? livingUnitsInAreaCells(clean)
          .filter(unit=>
            unit.faction===caster.faction
          )
      : [];

  return {
    spell,
    cells:clean,
    tone,
    dangerous,
    friendlyFireCount:
      friendlies.length,
    candidateRevision:3
  };
}


/* ============================================================
   FINAL AIM-PREVIEW WRAPPER
   ============================================================ */

const candidateRev3BaseAimAreaPreviewForAction=
  aimAreaPreviewForAction;

aimAreaPreviewForAction=function(
  action,
  targetHex
){
  /*
    Preserve every preview already implemented earlier in the load chain,
    including the R232 reflected Lightning Bolt trace.
  */
  const existing=
    candidateRev3BaseAimAreaPreviewForAction(
      action,
      targetHex
    );

  if(
    existing?.cells?.length
  ){
    return existing;
  }

  if(
    !action?.spellId ||
    !targetHex
  ){
    return existing || null;
  }

  const spell=
    getSpellEntry(
      action.spellId
    );

  const caster=
    spellCasterForAction(action) ||
    activeUnit() ||
    game?.player;

  if(
    !spell ||
    !caster
  ){
    return existing || null;
  }

  switch(spell.id){
    case "light":
      return candidateRev3Preview(
        spell,
        caster,
        candidateRev3LightCells(
          caster,
          targetHex
        ),
        {tone:"control"}
      );

    case "continual-light":
      return candidateRev3Preview(
        spell,
        caster,
        candidateRev3IlluminationCells(
          targetHex,
          6
        ),
        {tone:"control"}
      );

    case "darkness-15-radius":
      return candidateRev3Preview(
        spell,
        caster,
        candidateRev3RadiusCells(
          targetHex,
          1
        ),
        {tone:"fog"}
      );

    case "flaming-sphere":
      return candidateRev3Preview(
        spell,
        caster,
        [
          {
            x:targetHex.x,
            y:targetHex.y
          }
        ],
        {
          tone:"damage",
          dangerous:true
        }
      );

    case "fog-cloud":
      return candidateRev3Preview(
        spell,
        caster,
        candidateRev3RadiusCells(
          targetHex,
          1
        ),
        {tone:"fog"}
      );

    case "glitterdust":
      return candidateRev3Preview(
        spell,
        caster,
        candidateRev3RadiusCells(
          targetHex,
          1
        ),
        {
          tone:"control",
          dangerous:true
        }
      );

    case "hypnotic-pattern":
      return candidateRev3Preview(
        spell,
        caster,
        candidateRev3RadiusCells(
          targetHex,
          1
        ),
        {
          tone:"control",
          dangerous:true
        }
      );

    case "pyrotechnics":
      return candidateRev3Preview(
        spell,
        caster,
        candidateRev3PyrotechnicsCells(
          targetHex
        ),
        {
          tone:"control",
          dangerous:true
        }
      );

    case "scare":
      return candidateRev3Preview(
        spell,
        caster,
        candidateRev3RadiusCells(
          targetHex,
          1
        ),
        {
          tone:"control",
          dangerous:true
        }
      );

    case "stinking-cloud":
      return candidateRev3Preview(
        spell,
        caster,
        candidateRev3RadiusCells(
          targetHex,
          1
        ),
        {
          tone:"fog",
          dangerous:true
        }
      );

    case "tashas-hideous-laughter":
      return candidateRev3Preview(
        spell,
        caster,
        candidateRev3RadiusCells(
          targetHex,
          1
        ),
        {
          tone:"control",
          dangerous:true
        }
      );

    case "web":
      return candidateRev3Preview(
        spell,
        caster,
        candidateRev3RadiusCells(
          targetHex,
          1
        ),
        {
          tone:"terrain",
          dangerous:true
        }
      );

    case "invisibility-10-radius":
      return candidateRev3Preview(
        spell,
        caster,
        candidateRev3AuraCellsAtAim(
          targetHex,
          1
        ),
        {tone:"control"}
      );

    case "protection-from-evil-10-radius":
      return candidateRev3Preview(
        spell,
        caster,
        candidateRev3AuraCellsAtAim(
          targetHex,
          1
        ),
        {tone:"control"}
      );

    default:
      return existing || null;
  }
};


/* ============================================================
   QA / AUDIT DIAGNOSTICS
   ============================================================ */

window.AdventurePartyAoeAimAudit={
  channel:"candidate",
  candidateRevision:3,
  auditedSpellIds:
    Object.keys(
      CANDIDATE_REV3_AOE_AIM_AUDIT
    ),
  entries:()=>
    Object.entries(
      CANDIDATE_REV3_AOE_AIM_AUDIT
    ).map(
      ([spellId,entry])=>({
        spellId,
        name:
          getSpellEntry(spellId)?.name ||
          spellId,
        targetMode:
          getSpellEntry(spellId)?.targetMode ||
          null,
        areaOfEffect:
          getSpellEntry(spellId)?.areaOfEffect ||
          null,
        ...entry
      })
    ),
  previewAt:(
    spellId,
    x,
    y,
    casterLevel=
      TEST_SPELL_CASTER_LEVEL
  )=>
    aimAreaPreviewForAction(
      {
        spellId,
        casterLevel
      },
      {x,y}
    ),
  excludedFromAim:[
    "self-only effects do not enter AIM",
    "single-target and per-projectile spells are not AoE footprints"
  ]
};
