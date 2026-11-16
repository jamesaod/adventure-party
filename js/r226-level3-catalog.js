/*
  R226 — AD&D 2ND EDITION LEVEL 3 WIZARD SPELLS
  ============================================================
  Adds the tactical/combat-ready third-level wizard spells selected for
  Adventure Party, while leaving Fireball's established implementation intact.

  R226 deliberately layers on top of the existing spell/status/LOS framework:
  - no rewrite of the large core engine
  - spell records are appended to SPELL_CATALOG
  - cast dispatch, saves, movement, missiles, initiative and persistent VFX are
    extended through narrow wrappers
  - all successfully committed casts continue to use R225's universal POR-style
    spell-casting sound through commitSpellCast()
*/

const R226_LEVEL3_SPELLS=Object.freeze({
  "blink":{
    id:"blink", name:"Blink", spellGroup:"Wizard", level:3,
    school:"Alteration", incantation:"Saltus Aetheris!",
    components:["V","S"], duration:"1 round/level", castingTime:1,
    savingThrow:"None", areaOfEffect:"Caster", range:{type:"self"},
    combatImplemented:true, targetMode:"self",
    damageSummary:"Caster randomly blinks 10 feet each round, avoiding solid obstacles.",
    description:"The caster repeatedly shifts 10 feet in a random direction. Adventure Party resolves the blink at the start of each affected turn and rerolls blocked destinations.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:190}
  },

  "dispel-magic":{
    id:"dispel-magic", name:"Dispel Magic", spellGroup:"Wizard", level:3,
    school:"Abjuration", incantation:"Magiam Dissolve!",
    components:["V","S"], duration:"Instantaneous", castingTime:3,
    savingThrow:"None", areaOfEffect:"30-foot cube",
    range:{fixedYards:120}, combatImplemented:true, targetMode:"ground",
    damageSummary:"Attempts to end magical unit and area effects in a 30-foot volume.",
    description:"Dispels the caster's own magic automatically; other magic uses the AD&D 2e level-adjusted dispel check.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:191}
  },

  "flame-arrow":{
    id:"flame-arrow", name:"Flame Arrow", spellGroup:"Wizard", level:3,
    school:"Conjuration/Summoning", incantation:"Sagitta Flammea!",
    components:["V","S","M"], materialComponent:"A drop of oil and a small piece of flint",
    duration:"1 round", castingTime:3, savingThrow:"Special",
    areaOfEffect:"Special", range:{baseYards:30,yardsPerCasterLevel:10},
    combatImplemented:true, targetMode:"hostile-creature",
    damageSummary:"One fiery bolt per 5 caster levels; each hit deals 1d6 piercing + 4d6 fire (save halves fire).",
    description:"Adventure Party uses the spell's fiery-bolt mode. Each bolt makes its own missile attack roll; all available bolts are discharged in the casting round.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:191}
  },

  "gust-of-wind":{
    id:"gust-of-wind", name:"Gust of Wind", spellGroup:"Wizard", level:3,
    school:"Alteration", incantation:"Ventus Impelle!",
    components:["V","S","M"], materialComponent:"A legume seed",
    duration:"1 round", castingTime:3, savingThrow:"None",
    areaOfEffect:"10 feet × 10 yards/level", range:{type:"self"},
    combatImplemented:true, targetMode:"direction",
    damageSummary:"Powerful line of wind disperses vapors and impedes creatures moving against it.",
    description:"A strong linear gust clears fog/cloud cells it crosses and briefly impedes creatures caught in the lane.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:192}
  },

  "haste":{
    id:"haste", name:"Haste", spellGroup:"Wizard", level:3,
    school:"Alteration", incantation:"Tempus Accelera!",
    components:["V","S","M"], materialComponent:"A shaving of licorice root",
    duration:"3 rounds + 1 round/level", castingTime:3, savingThrow:"None",
    areaOfEffect:"40-foot cube; 1 creature/level",
    range:{fixedYards:60}, combatImplemented:true, targetMode:"ground",
    damageSummary:"Friendly creatures move and attack at double rate and gain a −2 initiative adjustment.",
    description:"Haste doubles normal movement and attack rate, improves initiative by 2, and negates Slow. Adventure Party does not currently model character aging.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:192}
  },

  "hold-person":{
    id:"hold-person", name:"Hold Person", spellGroup:"Wizard", level:3,
    school:"Enchantment/Charm", incantation:"Corpus Immobile!",
    components:["V","S","M"], materialComponent:"A small straight piece of iron",
    duration:"2 rounds/level", castingTime:3, savingThrow:"Neg.",
    areaOfEffect:"1–4 persons in a 20-foot cube",
    range:{fixedYards:120}, combatImplemented:true, targetMode:"ground",
    damageSummary:"Holds up to four humanoids; fewer targets suffer worse saves (one target: −3).",
    description:"Eligible humanoids are selected nearest the aimed center. Four or three targets save normally, two save at −1, and one saves at −3.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:193}
  },

  "hold-undead":{
    id:"hold-undead", name:"Hold Undead", spellGroup:"Wizard", level:3,
    school:"Necromancy", incantation:"Mortui Sistite!",
    components:["V","S","M"], materialComponent:"A pinch of sulfur and powdered garlic",
    duration:"1d4 rounds + 1 round/level", castingTime:5, savingThrow:"Neg.",
    areaOfEffect:"1d3 undead", range:{fixedYards:60},
    combatImplemented:true, targetMode:"ground",
    damageSummary:"Holds up to three undead whose combined Hit Dice do not exceed caster level.",
    description:"Mindless undead are held automatically; intelligent undead receive a saving throw. Total affected Hit Dice cannot exceed caster level.",
    source:{book:"AD&D 2nd Edition Wizard spell corpus",printedPage:193}
  },

  "infravision":{
    id:"infravision", name:"Infravision", spellGroup:"Wizard", level:3,
    school:"Alteration", incantation:"Visus Nocturnus!",
    components:["V","S","M"], materialComponent:"A pinch of dried carrot or an agate",
    duration:"2 hours + 1 hour/level", castingTime:"1 round", savingThrow:"None",
    areaOfEffect:"Creature touched", range:{type:"touch"},
    combatImplemented:true, targetMode:"touch-creature",
    damageSummary:"Grants 60-foot infravision in normal darkness; does not defeat magical Darkness or invisibility.",
    description:"The recipient gains 60-foot infravision. This is recorded as a long-duration perception buff and does not pierce magical obscuration.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:193}
  },

  "invisibility-10-radius":{
    id:"invisibility-10-radius", name:"Invisibility, 10' Radius", spellGroup:"Wizard", level:3,
    school:"Illusion/Phantasm", incantation:"Velum Invisibile!",
    components:["V","S","M"], materialComponent:"An eyelash encased in gum arabic",
    duration:"Special", castingTime:3, savingThrow:"None",
    areaOfEffect:"10-foot radius around creature touched", range:{type:"touch"},
    combatImplemented:true, targetMode:"touch-creature",
    damageSummary:"Initial creatures within 10 feet become invisible; leaving the radius ends the shared effect.",
    description:"Only creatures inside the radius when cast receive the effect. Leaving the radius removes it; creatures entering later do not gain it. If the central recipient attacks, the shared veil ends for all recipients.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:193}
  },

  "lightning-bolt":{
    id:"lightning-bolt", name:"Lightning Bolt", spellGroup:"Wizard", level:3,
    school:"Evocation", incantation:"Fulmen Feri!",
    components:["V","S","M"], materialComponent:"A bit of fur and an amber, crystal, or glass rod",
    duration:"Instantaneous", castingTime:3, savingThrow:"1/2",
    areaOfEffect:"5-foot × 80-foot bolt", range:{baseYards:40,yardsPerCasterLevel:10},
    combatImplemented:true, friendlyFire:true, targetMode:"direction",
    damageSummary:"1d6/level lightning damage (max 10d6), save for half; rebounds from solid barriers.",
    description:"Adventure Party uses the narrow 80-foot version. If an unyielding barrier prevents the bolt from reaching full length, the remaining length rebounds along the line.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:193}
  },

  "melfs-minute-meteors":{
    id:"melfs-minute-meteors", name:"Melf's Minute Meteors", spellGroup:"Wizard", level:3,
    school:"Evocation/Alteration", incantation:"Meteora Minuta!",
    components:["V","S","M"], materialComponent:"Nitre, sulphur, pine tar, and a reusable engraved gold tube",
    duration:"Special", castingTime:3, savingThrow:"None",
    areaOfEffect:"1 target/meteor", range:{baseYards:70,yardsPerCasterLevel:10},
    combatImplemented:true, targetMode:"hostile-creature",
    damageSummary:"Creates one 1d4 meteor/level; five may be discharged per round with +2 to hit and no range penalty.",
    description:"The initial casting discharges up to five meteors at the selected target. Remaining meteors continue in five-per-round mode on later turns, choosing the nearest visible hostile.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:194}
  },

  "protection-from-evil-10-radius":{
    id:"protection-from-evil-10-radius", name:"Protection From Evil, 10' Radius", spellGroup:"Wizard", level:3,
    school:"Abjuration", incantation:"Circulus Contra Malum!",
    components:["V","S","M"], materialComponent:"Powdered silver traced in a 20-foot-diameter circle",
    duration:"2 rounds/level", castingTime:3, savingThrow:"None",
    areaOfEffect:"10-foot radius around creature touched", range:{type:"touch"},
    combatImplemented:true, targetMode:"touch-creature",
    damageSummary:"Mobile aura: evil attackers suffer −2 to hit; protected creatures gain +2 saves against them.",
    description:"The protective globe moves with the touched creature and extends the established Protection From Evil combat modifiers to friendly creatures within one tactical hex.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:195}
  },

  "protection-from-normal-missiles":{
    id:"protection-from-normal-missiles", name:"Protection From Normal Missiles", spellGroup:"Wizard", level:3,
    school:"Abjuration", incantation:"Tela Repelle!",
    components:["V","S","M"], materialComponent:"A piece of tortoise or turtle shell",
    duration:"1 turn/level", castingTime:3, savingThrow:"None",
    areaOfEffect:"Creature touched", range:{type:"touch"},
    combatImplemented:true, targetMode:"touch-creature",
    damageSummary:"Ordinary arrows, bolts, sling missiles, javelins, spears, and similar normal missiles cannot harm the recipient.",
    description:"Current Adventure Party missile weapons—ordinary longbow arrows and sling ammunition—are completely negated while this ward lasts.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:195}
  },

  "slow":{
    id:"slow", name:"Slow", spellGroup:"Wizard", level:3,
    school:"Alteration", incantation:"Tempus Retarda!",
    components:["V","S","M"], materialComponent:"A drop of molasses",
    duration:"3 rounds + 1 round/level", castingTime:3, savingThrow:"Neg. (−4)",
    areaOfEffect:"40-foot cube; 1 creature/level",
    range:{baseYards:90,yardsPerCasterLevel:10}, combatImplemented:true, targetMode:"ground",
    damageSummary:"Hostiles save at −4; failed save halves movement/attack rate and imposes −4 attacks and +4 AC penalty.",
    description:"Slow affects up to one hostile creature per caster level in the aimed volume. A failed save removes Haste and applies the classic combat penalties.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:196}
  },

  "vampiric-touch":{
    id:"vampiric-touch", name:"Vampiric Touch", spellGroup:"Wizard", level:3,
    school:"Necromancy", incantation:"Vita Exhauri!",
    components:["V","S"], duration:"One touch", castingTime:3, savingThrow:"None",
    areaOfEffect:"Caster", range:{type:"self"},
    combatImplemented:true, targetMode:"adjacent-hostile",
    damageSummary:"Melee touch deals 1d6 per 2 caster levels (max 6d6) and transfers that many hit points to caster; undead unaffected.",
    description:"Adventure Party resolves the spell as its own adjacent melee touch attack. Hit points gained above normal maximum are tracked as temporary vampiric vitality.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:196}
  },

  "wind-wall":{
    id:"wind-wall", name:"Wind Wall", spellGroup:"Wizard", level:3,
    school:"Alteration", incantation:"Murus Venti!",
    components:["V","S","M"], materialComponent:"A tiny fan and a feather of exotic origin",
    duration:"1 round/level", castingTime:3, savingThrow:"None",
    areaOfEffect:"10-foot width × 5-foot height/level", range:{baseYards:0,yardsPerCasterLevel:10},
    combatImplemented:true, targetMode:"ground",
    damageSummary:"Persistent wind barrier deflects arrows, hinders light missiles, and blocks/disperses gases crossing it.",
    description:"The wall is placed perpendicular to the caster-to-target line. Ordinary arrows cannot cross; sling shots suffer the AD&D penalties; overlapping fog/cloud cells are dispersed.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:197}
  }
});

Object.assign(SPELL_CATALOG,R226_LEVEL3_SPELLS);

