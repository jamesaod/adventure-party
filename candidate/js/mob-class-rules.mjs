import {monsterBaseline} from './monster-baselines.mjs?v=R238C203';
// Class rules and catalog declarations extracted from the existing engine.
// scripts/test-mob-class-rules.mjs verifies parity with their engine definitions.
import {PRIEST_SPELLS} from './priest-spells.mjs?v=R238C190';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const TACTICAL_FEET_PER_HEX=10;

export const FIGHTER_CLASS={
  name:"Fighter",
  group:"Warrior",
  minimumStrength:9,
  primeRequisite:"Strength",
  primeRequisiteXpBonusThreshold:16,

  hitDie:10,
  hitDiceThroughLevel:9,
  hpPerLevelAfterHitDice:3,

  armor:"Any armor",
  shields:"Any shield",
  weapons:"Any weapon",

  initialWeaponProficiencies:4,
  weaponProficiencyRate:3,
  weaponNonproficiencyPenalty:-2,

  initialNonweaponProficiencies:3,
  nonweaponProficiencyRate:3,

  canWeaponSpecialize:true,

  canSweep:true,
  sweepTargetRule:"less than 1 Hit Die (1-1 or lower)",
  sweepAttackRule:"attacks equal warrior level",
  sweepRequiredAttackType:"S",
  sweepWeaponRule:"requires an equipped weapon capable of a Slashing (S) attack",

  followerLevel:9,
  followerRequirement:"Establish a stronghold",

  baseMovement:12
};

export const MAGE_CLASS={
  id:"mage",
  name:"Mage",
  group:"Wizard",
  minimumIntelligence:9,
  primeRequisite:"Intelligence",
  primeRequisiteXpBonusThreshold:16,
  racesAllowed:["Human","Elf","Half-elf"],
  alignments:"Any",

  hitDie:4,
  hitDiceThroughLevel:10,
  hpPerLevelAfterHitDice:1,

  armor:"None",
  shields:"None",
  weapons:["Dagger","Staff","Dart","Knife","Sling"],

  initialWeaponProficiencies:1,
  weaponProficiencyRate:6,
  weaponNonproficiencyPenalty:-5,
  initialNonweaponProficiencies:4,
  nonweaponProficiencyRate:3,

  studyMinutesPerSpellLevel:10,
  scrollPotionCreationLevel:9,
  specialization:null,
  canResearchSpells:true,
  strongholdSpecialFollowers:false,
  advancedMagicItemCreation:"Requires appropriate spells / campaign research rules",

  magicalItemUse:[
    "Potions","Rings","Wands","Rods","Scrolls","Staves",
    "Most miscellaneous magical items",
    "Magical versions of class-allowed weapons"
  ]
};

export const CLERIC_CLASS={
  id:"cleric",
  name:"Cleric",
  group:"Priest",
  minimumWisdom:9,
  primeRequisite:"Wisdom",
  primeRequisiteXpBonusThreshold:16,
  racesAllowed:["All"],
  alignments:"Any alignment acceptable to the deity/mythos",

  hitDie:8,
  hitDiceThroughLevel:9,
  hpPerLevelAfterHitDice:2,

  armor:"Any armor",
  shields:"Any shield",
  weapons:"Blunt / bludgeoning weapons only for the standard Cleric",

  initialWeaponProficiencies:2,
  weaponProficiencyRate:4,
  weaponNonproficiencyPenalty:-3,
  initialNonweaponProficiencies:4,
  nonweaponProficiencyRate:3,

  spellLevels:7,
  majorSpheres:[
    "All","Astral","Charm","Combat","Creation","Divination",
    "Guardian","Healing","Necromantic","Protection","Summoning","Sun"
  ],
  minorSpheres:["Elemental"],
  excludedSpheres:["Animal","Plant","Weather"],

  canTurnUndead:true,
  turningAttemptsPerEncounter:1,
  turningAffectedDice:"2d6",
  evilPriestPower:"Command undead instead of turning them",
  followerLevel:8,
  followerRequirement:"Establish a place of worship of significant size",
  strongholdApprovalLevel:9,
  baseMovement:12
};

export const THIEF_CLASS={
  name:"Thief",
  group:"Rogue",
  minimumDexterity:9,
  primeRequisite:"Dexterity",
  primeRequisiteXpBonusThreshold:16,
  racesAllowed:"All",
  alignments:"Any except lawful good",

  hitDie:6,
  hitDiceThroughLevel:10,
  hpPerLevelAfterHitDice:2,

  armor:"Leather, studded leather, padded leather, or elven chain",
  shields:"No shield listed for Thief class use",
  weapons:[
    "Club","Dagger","Dart","Hand Crossbow","Knife","Lasso",
    "Short Bow","Sling","Broad Sword","Long Sword","Short Sword","Staff"
  ],

  initialWeaponProficiencies:2,
  weaponProficiencyRate:4,
  weaponNonproficiencyPenalty:-3,
  initialNonweaponProficiencies:3,
  nonweaponProficiencyRate:4,

  initialDiscretionarySkillPoints:60,
  initialMaxPerSkill:30,
  levelSkillPoints:30,
  levelMaxPerSkill:15,
  skillCap:95,

  thievingSkillBaseScores:{
    "Pick Pockets":15,
    "Open Locks":10,
    "Find/Remove Traps":5,
    "Move Silently":10,
    "Hide in Shadows":5,
    "Detect Noise":15,
    "Climb Walls":60,
    "Read Languages":0
  },

  backstabAttackBonus:4,
  backstabRequirement:"Behind the victim and victim unaware of the intended attack",
  backstabLimits:"First qualifying attack only; generally humanoid target with a definable back and reachable significant target area",

  readScrollsLevel:10,
  readScrollMisreadChance:25
};

export const FIGHTER_LEVELS=[
  {level:1, xp:0,       thaco:20, hd:"1d10",      attacks:"1/round",    wp:4,  nwp:3, gain:"Warrior/Fighter foundation; weapon specialization is available to a single-class fighter."},
  {level:2, xp:2000,    thaco:19, hd:"2d10",      attacks:"1/round",    wp:4,  nwp:3, gain:"THAC0 improves by 1; gain another d10 Hit Die."},
  {level:3, xp:4000,    thaco:18, hd:"3d10",      attacks:"1/round",    wp:4,  nwp:3, gain:"+1 weapon proficiency slot; +1 nonweapon proficiency slot; warrior saves improve."},
  {level:4, xp:8000,    thaco:17, hd:"4d10",      attacks:"1/round",    wp:5,  nwp:4, gain:"THAC0 improves by 1; gain another d10 Hit Die."},
  {level:5, xp:16000,   thaco:16, hd:"5d10",      attacks:"1/round",    wp:5,  nwp:4, gain:"Warrior saving throws improve."},
  {level:6, xp:32000,   thaco:15, hd:"6d10",      attacks:"1/round",    wp:5,  nwp:4, gain:"+1 weapon proficiency slot; +1 nonweapon proficiency slot."},
  {level:7, xp:64000,   thaco:14, hd:"7d10",      attacks:"3/2 rounds", wp:6,  nwp:5, gain:"Base melee attack rate improves to 3 attacks every 2 rounds; warrior saves improve."},
  {level:8, xp:125000,  thaco:13, hd:"8d10",      attacks:"3/2 rounds", wp:6,  nwp:5, gain:"THAC0 improves by 1; gain another d10 Hit Die."},
  {level:9, xp:250000,  thaco:12, hd:"9d10",      attacks:"3/2 rounds", wp:6,  nwp:5, gain:"+1 WP/NWP; warrior saves improve; becomes a Lord and may attract followers after establishing a stronghold."},
  {level:10,xp:500000,  thaco:11, hd:"9d10 + 3",  attacks:"3/2 rounds", wp:7,  nwp:6, gain:"No more Hit Dice; add a fixed +3 HP per fighter level from this point onward."},
  {level:11,xp:750000,  thaco:10, hd:"9d10 + 6",  attacks:"3/2 rounds", wp:7,  nwp:6, gain:"Warrior saving throws improve."},
  {level:12,xp:1000000, thaco:9,  hd:"9d10 + 9",  attacks:"3/2 rounds", wp:7,  nwp:6, gain:"+1 weapon proficiency slot; +1 nonweapon proficiency slot."},
  {level:13,xp:1250000, thaco:8,  hd:"9d10 + 12", attacks:"2/round",    wp:8,  nwp:7, gain:"Base melee attack rate improves to 2 attacks every round; warrior saves improve."},
  {level:14,xp:1500000, thaco:7,  hd:"9d10 + 15", attacks:"2/round",    wp:8,  nwp:7, gain:"THAC0 improves by 1; +3 HP."},
  {level:15,xp:1750000, thaco:6,  hd:"9d10 + 18", attacks:"2/round",    wp:8,  nwp:7, gain:"+1 WP/NWP; warrior saving throws improve."},
  {level:16,xp:2000000, thaco:5,  hd:"9d10 + 21", attacks:"2/round",    wp:9,  nwp:8, gain:"THAC0 improves by 1; +3 HP."},
  {level:17,xp:2250000, thaco:4,  hd:"9d10 + 24", attacks:"2/round",    wp:9,  nwp:8, gain:"Final core warrior saving-throw band begins; +3 HP."},
  {level:18,xp:2500000, thaco:3,  hd:"9d10 + 27", attacks:"2/round",    wp:9, nwp:8, gain:"+1 weapon proficiency slot; +1 nonweapon proficiency slot."},
  {level:19,xp:2750000, thaco:2,  hd:"9d10 + 30", attacks:"2/round",    wp:10, nwp:9, gain:"THAC0 improves by 1; +3 HP."},
  {level:20,xp:3000000, thaco:1,  hd:"9d10 + 33", attacks:"2/round",    wp:10, nwp:9, gain:"THAC0 reaches 1; +3 HP."}
];

export const MAGE_SPELL_SLOT_ROWS=[
  [1,0,0,0,0,0,0,0,0],
  [2,0,0,0,0,0,0,0,0],
  [2,1,0,0,0,0,0,0,0],
  [3,2,0,0,0,0,0,0,0],
  [4,2,1,0,0,0,0,0,0],
  [4,2,2,0,0,0,0,0,0],
  [4,3,2,1,0,0,0,0,0],
  [4,3,3,2,0,0,0,0,0],
  [4,3,3,2,1,0,0,0,0],
  [4,4,3,2,2,0,0,0,0],
  [4,4,4,3,3,0,0,0,0],
  [4,4,4,4,4,1,0,0,0],
  [5,5,5,4,4,2,0,0,0],
  [5,5,5,4,4,2,1,0,0],
  [5,5,5,5,5,2,1,0,0],
  [5,5,5,5,5,3,2,1,0],
  [5,5,5,5,5,3,3,2,0],
  [5,5,5,5,5,3,3,2,1],
  [5,5,5,5,5,3,3,3,1],
  [5,5,5,5,5,4,3,3,2]
];

export const CLERIC_SPELL_SLOT_ROWS=[
  [1,0,0,0,0,0,0],
  [2,0,0,0,0,0,0],
  [2,1,0,0,0,0,0],
  [3,2,0,0,0,0,0],
  [3,3,1,0,0,0,0],
  [3,3,2,0,0,0,0],
  [3,3,2,1,0,0,0],
  [3,3,3,2,0,0,0],
  [4,4,3,2,1,0,0],
  [4,4,3,3,2,0,0],
  [5,4,4,3,2,1,0],
  [6,5,5,3,2,2,0],
  [6,6,6,4,2,2,0],
  [6,6,6,5,3,2,1],
  [6,6,6,6,4,2,1],
  [7,7,7,6,4,3,1],
  [7,7,7,7,5,3,2],
  [8,8,8,8,6,4,2],
  [9,9,8,8,6,4,2],
  [9,9,9,8,7,5,2]
];

export const MAGE_SAVING_THROW_BANDS=[
  {min:1,max:5,death:14,wand:11,poly:13,breath:15,spell:12},
  {min:6,max:10,death:13,wand:9,poly:11,breath:13,spell:10},
  {min:11,max:15,death:11,wand:7,poly:9,breath:11,spell:8},
  {min:16,max:20,death:10,wand:5,poly:7,breath:9,spell:6},
  {min:21,max:Infinity,death:8,wand:3,poly:5,breath:7,spell:4}
];

export const PRIEST_SAVING_THROW_BANDS=[
  {min:1,max:3,death:10,wand:14,poly:13,breath:16,spell:15},
  {min:4,max:6,death:9,wand:13,poly:12,breath:15,spell:14},
  {min:7,max:9,death:7,wand:11,poly:10,breath:13,spell:12},
  {min:10,max:12,death:6,wand:10,poly:9,breath:12,spell:11},
  {min:13,max:15,death:5,wand:9,poly:8,breath:11,spell:10},
  {min:16,max:18,death:4,wand:8,poly:7,breath:10,spell:9},
  {min:19,max:Infinity,death:2,wand:6,poly:5,breath:8,spell:7}
];

export const ROGUE_SAVING_THROW_BANDS=[
  {min:1,max:4,death:13,wand:14,poly:12,breath:16,spell:15},
  {min:5,max:8,death:12,wand:12,poly:11,breath:15,spell:13},
  {min:9,max:12,death:11,wand:10,poly:10,breath:14,spell:11},
  {min:13,max:16,death:10,wand:8,poly:9,breath:13,spell:9},
  {min:17,max:20,death:9,wand:6,poly:8,breath:12,spell:7},
  {min:21,max:Infinity,death:8,wand:4,poly:7,breath:11,spell:5}
];

export const WARRIOR_SAVING_THROW_BANDS=[
  {min:1,max:2,death:14,wand:16,poly:15,breath:17,spell:17},
  {min:3,max:4,death:13,wand:15,poly:14,breath:16,spell:16},
  {min:5,max:6,death:11,wand:13,poly:12,breath:13,spell:14},
  {min:7,max:8,death:10,wand:12,poly:11,breath:12,spell:13},
  {min:9,max:10,death:8,wand:10,poly:9,breath:9,spell:11},
  {min:11,max:12,death:7,wand:9,poly:8,breath:8,spell:10},
  {min:13,max:14,death:5,wand:7,poly:6,breath:5,spell:8},
  {min:15,max:16,death:4,wand:6,poly:5,breath:4,spell:7},
  {min:17,max:Infinity,death:3,wand:5,poly:4,breath:4,spell:6}
];

export const MAGE_INTELLIGENCE_TABLE={
  1:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  2:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  3:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  4:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  5:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  6:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  7:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  8:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  9:{maxSpellLevel:4,chanceToLearn:35,maxSpellsPerLevel:6,spellImmunity:null},
  10:{maxSpellLevel:5,chanceToLearn:40,maxSpellsPerLevel:7,spellImmunity:null},
  11:{maxSpellLevel:5,chanceToLearn:45,maxSpellsPerLevel:7,spellImmunity:null},
  12:{maxSpellLevel:6,chanceToLearn:50,maxSpellsPerLevel:7,spellImmunity:null},
  13:{maxSpellLevel:6,chanceToLearn:55,maxSpellsPerLevel:9,spellImmunity:null},
  14:{maxSpellLevel:7,chanceToLearn:60,maxSpellsPerLevel:9,spellImmunity:null},
  15:{maxSpellLevel:7,chanceToLearn:65,maxSpellsPerLevel:11,spellImmunity:null},
  16:{maxSpellLevel:8,chanceToLearn:70,maxSpellsPerLevel:11,spellImmunity:null},
  17:{maxSpellLevel:8,chanceToLearn:75,maxSpellsPerLevel:14,spellImmunity:null},
  18:{maxSpellLevel:9,chanceToLearn:85,maxSpellsPerLevel:18,spellImmunity:null},
  19:{maxSpellLevel:9,chanceToLearn:95,maxSpellsPerLevel:Infinity,spellImmunity:"1st-level illusions"},
  20:{maxSpellLevel:9,chanceToLearn:96,maxSpellsPerLevel:Infinity,spellImmunity:"2nd-level illusions"},
  21:{maxSpellLevel:9,chanceToLearn:97,maxSpellsPerLevel:Infinity,spellImmunity:"3rd-level illusions"},
  22:{maxSpellLevel:9,chanceToLearn:98,maxSpellsPerLevel:Infinity,spellImmunity:"4th-level illusions"},
  23:{maxSpellLevel:9,chanceToLearn:99,maxSpellsPerLevel:Infinity,spellImmunity:"5th-level illusions"},
  24:{maxSpellLevel:9,chanceToLearn:100,maxSpellsPerLevel:Infinity,spellImmunity:"6th-level illusions"},
  25:{maxSpellLevel:9,chanceToLearn:100,maxSpellsPerLevel:Infinity,spellImmunity:"7th-level illusions"}
};

export const SPELL_CATALOG={
  ...PRIEST_SPELLS,
  "armor":{
    id:"armor",
    name:"Armor",
    spellGroup:"Wizard",
    level:1,
    school:"Conjuration",
    incantation:"Armatura!",
    components:["V","S","M"],
    materialComponent:"A piece of finely cured leather blessed by a priest",
    duration:"Special",
    castingTime:"1 round",
    savingThrow:"None",
    areaOfEffect:"1 creature",
    range:{type:"touch"},
    combatImplemented:true,
    targetMode:"touch-creature",
    damageSummary:"Defensive spell; grants AC 6 base if it improves the target.",
    description:"Creates a magical field of force equivalent to AC 6. It remains until dispelled or until the wearer sustains more than 8 + caster level points of cumulative damage.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:131,pdfPage:132}
  },

  "burning-hands":{
    id:"burning-hands",
    name:"Burning Hands",
    spellGroup:"Wizard",
    level:1,
    school:"Alteration",
    incantation:"Manus Ardentes!",
    components:["V","S"],
    duration:"Instantaneous",
    castingTime:1,
    savingThrow:"1/2",
    areaOfEffect:"Caster; 5-foot-long, 120° fan",
    range:{type:"self"},
    combatImplemented:true,
    friendlyFire:true,
    targetMode:"direction",
    damageSummary:"1d3 + 2/caster level fire damage; maximum +20; save for half.",
    description:"A fan of searing flame projects from the caster's hands. The 10-foot hex map abstracts the 5-foot fan to the adjacent forward arc.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:131,pdfPage:132}
  },

  "charm-person":{
    id:"charm-person",
    name:"Charm Person",
    spellGroup:"Wizard",
    level:1,
    school:"Enchantment/Charm",
    incantation:"Hominem Fascina!",
    components:["V","S"],
    duration:"One battle",
    castingTime:1,
    savingThrow:"Neg.",
    areaOfEffect:"1 living humanoid, Medium-sized or smaller",
    range:{fixedHexes:12},
    combatImplemented:true,
    targetMode:"hostile-creature",
    damageSummary:"Failed save: target changes sides for the battle and remains AI-controlled.",
    description:"Adventure Party follows SSI Pool of Radiance's tactical Charm Person behavior: a failed save makes one eligible humanoid fight for the caster's side for the current battle. The charmed creature remains AI-controlled and does not join the party after combat.",
    source:{book:"AD&D 2nd Edition Player's Handbook / SSI Pool of Radiance combat adaptation",printedPage:132,pdfPage:133}
  },

  "chill-touch":{
    id:"chill-touch",
    name:"Chill Touch",
    spellGroup:"Wizard",
    level:1,
    school:"Necromancy",
    incantation:"Tactus Frigidus!",
    components:["V","S"],
    duration:"3 rounds + 1 round/level",
    castingTime:1,
    savingThrow:"Neg.",
    areaOfEffect:"Caster",
    range:{type:"self"},
    combatImplemented:true,
    targetMode:"self",
    damageSummary:"Successful melee touch: 1d4 damage and Strength loss on failed save; special undead fear effect.",
    description:"The caster's hand glows with necromantic energy. Successful melee hits can inflict 1d4 damage and reduce Strength when the victim fails a save.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:132,pdfPage:133}
  },

  "color-spray":{
    id:"color-spray",
    name:"Color Spray",
    spellGroup:"Wizard",
    level:1,
    school:"Alteration",
    incantation:"Coloris Aspersio!",
    components:["V","S","M"],
    materialComponent:"A pinch each of red, yellow, and blue powder or sand",
    duration:"Instantaneous",
    castingTime:1,
    savingThrow:"Special",
    areaOfEffect:"5' × 20' × 20' wedge",
    range:{type:"self"},
    combatImplemented:true,
    targetMode:"direction",
    damageSummary:"No HP damage; affects 1d6 creatures with unconscious/blind/stunned results by HD.",
    description:"A fan-shaped spray affects up to 1d6 creatures nearest the caster. Results depend on target Hit Dice/level relative to caster level.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:132,pdfPage:133}
  },

  "enlarge":{
    id:"enlarge",
    name:"Enlarge",
    spellGroup:"Wizard",
    level:1,
    school:"Alteration",
    incantation:"Auge!",
    components:["V","S","M"],
    materialComponent:"A pinch of powdered iron",
    duration:"5 rounds/level",
    castingTime:1,
    savingThrow:"Neg.",
    areaOfEffect:"1 creature or object",
    range:{baseYards:0,yardsPerCasterLevel:5},
    combatImplemented:true,
    targetMode:"creature",
    damageSummary:"Creature grows 10%/caster level; HP, AC, and attacks unchanged; weapon damage scales with size.",
    description:"Increases size and weight by up to 10% per caster level. Creature hit points, Armor Class, and attack rolls do not change, but damage rolls increase proportionally.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:133,pdfPage:134}
  },

  "grease":{
    id:"grease",
    name:"Grease",
    spellGroup:"Wizard",
    level:1,
    school:"Conjuration",
    incantation:"Oleum Lubricum!",
    components:["V","S","M"],
    materialComponent:"A bit of pork rind or butter",
    duration:"3 rounds + 1 round/level",
    castingTime:1,
    savingThrow:"Special",
    areaOfEffect:"10' × 10' square",
    range:{fixedYards:10},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"No damage; creates a slippery hex that can knock creatures prone.",
    description:"Covers a surface with slippery grease. Creatures entering or caught in the area must save vs. spell or fall.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:135,pdfPage:136}
  },

  "light":{
    id:"light",
    name:"Light",
    spellGroup:"Wizard",
    level:1,
    school:"Alteration",
    incantation:"Lux!",
    components:["V","M"],
    materialComponent:"A firefly or a piece of phosphorescent moss",
    duration:"1 turn/level",
    castingTime:1,
    savingThrow:"Special",
    areaOfEffect:"20-foot-radius globe",
    range:{fixedYards:60},
    combatImplemented:true,
    targetMode:"creature",
    damageSummary:"Creates a 20-foot illumination radius; hostile creature can be blinded; −4 attacks/saves and AC worsened by 4.",
    description:"Creates torchlike light with a 20-foot illumination radius. When centered on a creature's visual organs, a failed save blinds it, penalizing attacks and saves by 4 and worsening AC by 4. The light source illuminates nearby battlefield terrain for the spell's duration.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:136,pdfPage:137}
  },

  "magic-missile":{
    id:"magic-missile",
    name:"Magic Missile",
    spellGroup:"Wizard",
    level:1,
    school:"Evocation",
    incantation:"Magicus Telum!",
    components:["V","S"],
    duration:"Instantaneous",
    castingTime:1,
    savingThrow:"None",
    areaOfEffect:"1 or more creatures in a 10-foot cube",
    range:{baseYards:60,yardsPerCasterLevel:10},
    missileDamage:"1d4+1",
    maxMissiles:5,
    combatImplemented:true,
    targetMode:"hostile-creature",
    damageSummary:"Each missile 1d4+1; up to 5 missiles may be assigned among one or more visible targets and strike simultaneously.",
    description:"Creates magical energy missiles that automatically strike. Each missile can be assigned to the same or a different visible target; the full volley launches and resolves simultaneously.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:136,pdfPage:137}
  },

  "protection-from-evil":{
    id:"protection-from-evil",
    name:"Protection From Evil",
    spellGroup:"Wizard",
    level:1,
    school:"Abjuration",
    incantation:"Praesidium Contra Malum!",
    components:["V","S","M"],
    materialComponent:"Powdered silver for the protective circle",
    duration:"2 rounds/level",
    castingTime:1,
    savingThrow:"None",
    areaOfEffect:"Creature touched",
    range:{type:"touch"},
    combatImplemented:true,
    targetMode:"touch-creature",
    damageSummary:"Buff: evil attackers suffer −2 to attack; target gains +2 saves against their attacks.",
    description:"Creates a protective barrier. The combat engine implements the attack-roll and saving-throw modifiers against evil creatures.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:137,pdfPage:138}
  },

  "shield":{
    id:"shield",
    name:"Shield",
    spellGroup:"Wizard",
    level:1,
    school:"Evocation",
    incantation:"Scutum!",
    components:["V","S"],
    duration:"5 rounds/level",
    castingTime:1,
    savingThrow:"None",
    areaOfEffect:"Special",
    range:{type:"self"},
    combatImplemented:true,
    targetMode:"self",
    damageSummary:"Front-facing defense: negates Magic Missile; AC 3 vs arrows/bolts/bullets, AC 4 vs other attacks.",
    description:"Creates an invisible frontal barrier. It totally negates Magic Missile, improves frontal Armor Class by attack type, and grants +1 to applicable frontal saving throws.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:137,pdfPage:138}
  },

  "shocking-grasp":{
    id:"shocking-grasp",
    name:"Shocking Grasp",
    spellGroup:"Wizard",
    level:1,
    school:"Alteration",
    incantation:"Tactus Fulminis!",
    components:["V","S"],
    duration:"Special",
    castingTime:1,
    savingThrow:"None",
    areaOfEffect:"Creature touched",
    range:{type:"touch"},
    combatImplemented:true,
    targetMode:"adjacent-hostile",
    damageSummary:"Touch attack; 1d8 + caster level electrical damage.",
    description:"Charges the caster's hand with electricity. The combat implementation resolves a normal raw-d20 physical touch attack and discharges on a hit.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:137,pdfPage:138}
  },

  "sleep":{
    id:"sleep",
    name:"Sleep",
    spellGroup:"Wizard",
    level:1,
    school:"Enchantment/Charm",
    incantation:"Somnus!",
    components:["V","S","M"],
    materialComponent:"Fine sand, rose petals, or a live cricket",
    duration:"5 rounds/level",
    castingTime:1,
    savingThrow:"None",
    areaOfEffect:"Special — 7-hex cluster (center + six adjacent hexes)",
    range:{fixedYards:30},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"Affects 2d4 Hit Dice, lowest-HD creatures first; 4+3 HD or higher are immune.",
    description:"Places eligible creatures into magical sleep. Adventure Party uses a fixed symmetric 7-hex cluster: the aimed center hex plus its six adjacent hexes.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:138,pdfPage:139}
  },

  "spook":{
    id:"spook",
    name:"Spook",
    spellGroup:"Wizard",
    level:1,
    school:"Illusion/Phantasm",
    incantation:"Pavor!",
    components:["V","S"],
    duration:"Special",
    castingTime:1,
    savingThrow:"Neg.",
    areaOfEffect:"1 creature within 30 feet",
    range:{fixedFeet:30},
    combatImplemented:true,
    targetMode:"hostile-creature",
    damageSummary:"Failed save forces target to flee; initial save penalty −1 per 2 caster levels, max −6.",
    description:"Plays upon natural fears. A failed save forces the target to flee; later rounds grant unpenalized saves.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:138,pdfPage:139}
  },

  "taunt":{
    id:"taunt",
    name:"Taunt",
    spellGroup:"Wizard",
    level:1,
    school:"Enchantment",
    incantation:"Provoca!",
    components:["V","S","M"],
    materialComponent:"A slug",
    duration:"1 round",
    castingTime:1,
    savingThrow:"Neg.",
    areaOfEffect:"30-foot radius",
    range:{fixedYards:60},
    combatImplemented:true,
    targetMode:"hostile-creature",
    damageSummary:"Failed targets rush the caster and seek melee rather than missile/spell attacks.",
    description:"Provokes creatures of one selected type into furious melee against the caster. The engine applies it to the aimed creature's type within a 3-hex radius.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:138,pdfPage:139}
  },

  "wall-of-fog":{
    id:"wall-of-fog",
    name:"Wall of Fog",
    spellGroup:"Wizard",
    level:1,
    school:"Evocation",
    incantation:"Murus Nebula!",
    components:["V","S","M"],
    materialComponent:"A pinch of split dried peas",
    duration:"2d4 rounds + 1 round/level",
    castingTime:1,
    savingThrow:"None",
    areaOfEffect:"20' cube + 10' cube/level",
    range:{fixedYards:30},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"No damage; creates a fog wall that blocks battlefield line of sight.",
    description:"Creates billowing mist that obscures sight beyond two feet. Adventure Party renders the spell as a wall: it extends along its normal geometry but terminates at solid walls, blocked architectural transitions, and the tactical map edge rather than flood-filling around obstacles. Its rendered cloud is 50% transparent for battlefield readability.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:139,pdfPage:140}
  },


  /* ============================================================
     R209 — AD&D 2E WIZARD LEVEL 2 COMBAT SPELL EXPANSION
     Knock and Wizard Lock are intentionally deferred until functional doors.
     ============================================================ */

  "blindness":{
    id:"blindness",
    name:"Blindness",
    spellGroup:"Wizard",
    level:2,
    school:"Illusion/Phantasm",
    components:["V"],
    duration:"Special",
    castingTime:2,
    savingThrow:"Neg.",
    areaOfEffect:"1 creature",
    range:{baseYards:30,yardsPerCasterLevel:10},
    combatImplemented:true,
    targetMode:"hostile-creature",
    damageSummary:"Permanent blindness until removed; −4 attacks and AC worsened by 4.",
    description:"Blinds one creature on a failed saving throw. Unlike the Light spell's eye-blinding effect, this spell does not impose a saving-throw penalty.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:181,pdfPage:182}
  },

  "blur":{
    id:"blur",
    name:"Blur",
    spellGroup:"Wizard",
    level:2,
    school:"Illusion/Phantasm",
    components:["V","S"],
    duration:"3 rounds + 1 round/level",
    castingTime:2,
    savingThrow:"None",
    areaOfEffect:"Caster",
    range:{type:"self"},
    combatImplemented:true,
    targetMode:"self",
    damageSummary:"First attack by each attacker suffers −4 to hit; later attacks −2; +1 vs direct spell saves.",
    description:"The caster's outline shifts and wavers. Each attacker suffers a larger penalty on its first attack against the blurred caster and a smaller penalty thereafter.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:181,pdfPage:182}
  },

  "continual-light":{
    id:"continual-light",
    name:"Continual Light",
    spellGroup:"Wizard",
    level:2,
    school:"Alteration",
    components:["V","S"],
    duration:"Permanent",
    castingTime:2,
    savingThrow:"Special",
    areaOfEffect:"60-foot radius",
    range:{fixedYards:60},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"Permanent magical illumination; can blind a creature when centered on its eyes.",
    description:"Creates a permanent 60-foot-radius magical light. A creature occupying the aimed hex can be illuminated or blinded; otherwise the light is anchored to the aimed battlefield hex.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:181,pdfPage:182}
  },

  "darkness-15-radius":{
    id:"darkness-15-radius",
    name:"Darkness, 15' Radius",
    spellGroup:"Wizard",
    level:2,
    school:"Alteration",
    components:["V","S","M"],
    duration:"1 turn + 1 round/level",
    castingTime:2,
    savingThrow:"None",
    areaOfEffect:"15-foot radius",
    range:{baseYards:0,yardsPerCasterLevel:10},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"Creates impenetrable magical darkness; overlapping magical Light can negate it.",
    description:"Creates a compact battlefield zone of magical darkness. The tactical implementation blocks sight, projectiles, and illumination through the affected hexes unless magical Light overlaps the darkness.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:181,pdfPage:182}
  },

  "deafness":{
    id:"deafness",
    name:"Deafness",
    spellGroup:"Wizard",
    level:2,
    school:"Illusion/Phantasm",
    components:["V","S","M"],
    duration:"Special",
    castingTime:2,
    savingThrow:"Neg.",
    areaOfEffect:"1 creature",
    range:{fixedYards:60},
    combatImplemented:true,
    targetMode:"hostile-creature",
    damageSummary:"Failed save deafens the target; verbal spells have a 20% chance to miscast.",
    description:"Deafens a creature on a failed saving throw. A deafened spellcaster has a 20% chance to spoil any spell requiring a verbal component.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:181,pdfPage:182}
  },

  "detect-invisibility":{
    id:"detect-invisibility",
    name:"Detect Invisibility",
    spellGroup:"Wizard",
    level:2,
    school:"Divination",
    components:["V","S","M"],
    duration:"5 rounds/level",
    castingTime:2,
    savingThrow:"None",
    areaOfEffect:"10-foot-wide path",
    range:{type:"self"},
    combatImplemented:true,
    targetMode:"self",
    damageSummary:"Reveals invisible creatures within 10 yards/level when line of sight is otherwise clear.",
    description:"Allows the caster to perceive invisible creatures within the spell's detection range. Glitterdust also reveals invisible creatures independently of this spell.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:182,pdfPage:183}
  },

  "flaming-sphere":{
    id:"flaming-sphere",
    name:"Flaming Sphere",
    spellGroup:"Wizard",
    level:2,
    school:"Evocation",
    components:["V","S","M"],
    duration:"1 round/level",
    castingTime:2,
    savingThrow:"Neg.",
    areaOfEffect:"3-foot-radius sphere",
    range:{fixedYards:10},
    combatImplemented:true,
    targetMode:"ground",
    friendlyFire:true,
    damageSummary:"2d4 fire on contact; 1d4 heat to adjacent creatures; save negates each exposure.",
    description:"Creates a rolling sphere of fire. In the tactical engine it automatically follows the nearest visible hostile at the start of its caster's turn, moving up to three hexes while respecting walls.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:182,pdfPage:183}
  },

  "fog-cloud":{
    id:"fog-cloud",
    name:"Fog Cloud",
    spellGroup:"Wizard",
    level:2,
    school:"Alteration",
    components:["V","S"],
    duration:"4 rounds + 1 round/level",
    castingTime:2,
    savingThrow:"None",
    areaOfEffect:"20-foot cube/level",
    range:{fixedYards:10},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"Stationary opaque fog blocks tactical line of sight and projectiles.",
    description:"Creates a stationary bank of dense mist. The combat abstraction uses a seven-hex cloud cluster and the existing volumetric fog/LOS system.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:183,pdfPage:184}
  },

  "glitterdust":{
    id:"glitterdust",
    name:"Glitterdust",
    spellGroup:"Wizard",
    level:2,
    school:"Conjuration/Summoning",
    components:["V","S","M"],
    duration:"1d4 rounds + 1 round/level",
    castingTime:2,
    savingThrow:"Special",
    areaOfEffect:"20-foot cube",
    range:{baseYards:0,yardsPerCasterLevel:10},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"Reveals invisible creatures; failed save blinds for 1d4+1 rounds.",
    description:"Coats creatures in sparkling dust, revealing invisibility for the dust's duration. Each affected creature saves separately against temporary blindness.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:183,pdfPage:184}
  },

  "hypnotic-pattern":{
    id:"hypnotic-pattern",
    name:"Hypnotic Pattern",
    spellGroup:"Wizard",
    level:2,
    school:"Illusion/Phantasm",
    components:["S","M"],
    duration:"Special",
    castingTime:2,
    savingThrow:"Neg.",
    areaOfEffect:"30-foot cube",
    range:{fixedYards:30},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"Fascinates up to 24 HD of creatures; damage immediately breaks the fascination.",
    description:"Creates a mesmerizing pattern. The combat implementation holds affected creatures through the caster's initial concentration window and two follow-up rounds; damage immediately frees a victim.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:183,pdfPage:184}
  },

  "invisibility":{
    id:"invisibility",
    name:"Invisibility",
    spellGroup:"Wizard",
    level:2,
    school:"Illusion/Phantasm",
    components:["V","S","M"],
    duration:"Special",
    castingTime:2,
    savingThrow:"None",
    areaOfEffect:"Creature touched",
    range:{type:"touch"},
    combatImplemented:true,
    targetMode:"touch-creature",
    damageSummary:"Target cannot normally be seen or targeted; attacking or casting an offensive spell ends the effect.",
    description:"Makes one touched creature invisible. Detect Invisibility and Glitterdust defeat the concealment; hostile action breaks the spell.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:184,pdfPage:185}
  },

  "melfs-acid-arrow":{
    id:"melfs-acid-arrow",
    name:"Melf's Acid Arrow",
    spellGroup:"Wizard",
    level:2,
    school:"Conjuration/Summoning",
    components:["V","S","M"],
    duration:"Special",
    castingTime:2,
    savingThrow:"None",
    areaOfEffect:"1 creature",
    range:{fixedYards:180},
    combatImplemented:true,
    targetMode:"hostile-creature",
    damageSummary:"Ranged attack for 2d4 acid; every three caster levels adds one later round of 2d4 acid damage.",
    description:"Launches a magical acid arrow using the attack chance of a fighter of the caster's level. The initial hit deals 2d4 acid with no splash damage; at 3rd-5th level it burns for one later round, at 6th-8th for two later rounds, and so on.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:144,pdfPage:145}
  },

  "mirror-image":{
    id:"mirror-image",
    name:"Mirror Image",
    spellGroup:"Wizard",
    level:2,
    school:"Illusion/Phantasm",
    components:["V","S"],
    duration:"3 rounds/level",
    castingTime:2,
    savingThrow:"None",
    areaOfEffect:"6-foot radius",
    range:{type:"self"},
    combatImplemented:true,
    targetMode:"self",
    damageSummary:"Creates 1d4 + 1 image per 3 caster levels, maximum 8; struck images vanish.",
    description:"Creates moving duplicates around the caster. Successful physical or magical projectile attacks can destroy an image instead of harming the caster.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:186,pdfPage:187}
  },

  "pyrotechnics":{
    id:"pyrotechnics",
    name:"Pyrotechnics",
    spellGroup:"Wizard",
    level:2,
    school:"Alteration",
    components:["V","S","M"],
    duration:"Special",
    castingTime:2,
    savingThrow:"Special",
    areaOfEffect:"Special",
    range:{fixedYards:120},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"Transforms a fire source into blinding fireworks; current combat mode extinguishes the source.",
    description:"Requires a persistent fire source. The current combat implementation uses the fireworks form: the source is extinguished and exposed creatures that fail saves are blinded. The smoke-form choice is reserved for the future environmental-action selector.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:186,pdfPage:187}
  },

  "ray-of-enfeeblement":{
    id:"ray-of-enfeeblement",
    name:"Ray of Enfeeblement",
    spellGroup:"Wizard",
    level:2,
    school:"Enchantment/Charm",
    components:["V","S"],
    duration:"1 round/level",
    castingTime:2,
    savingThrow:"Neg.",
    areaOfEffect:"1 creature",
    range:{baseYards:10,yardsPerCasterLevel:5},
    combatImplemented:true,
    targetMode:"hostile-creature",
    damageSummary:"Failed save: −2 attack rolls and −1 weapon damage for the duration.",
    description:"Weakens the target's physical combat ability. The tactical engine applies the AD&D combat penalties directly to attack and weapon-damage resolution.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:187,pdfPage:188}
  },

  "scare":{
    id:"scare",
    name:"Scare",
    spellGroup:"Wizard",
    level:2,
    school:"Enchantment/Charm",
    components:["V","S","M"],
    duration:"1d4 rounds + 1 round/level",
    castingTime:2,
    savingThrow:"Special",
    areaOfEffect:"15-foot radius",
    range:{baseYards:30,yardsPerCasterLevel:10},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"Creatures under 6 HD flee in fear; undead and extraplanar creatures are immune.",
    description:"Creates an area of supernatural fear. Eligible creatures flee for the duration; elves, half-elves, and priests receive the saving throw provided by the spell.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:187,pdfPage:188}
  },

  "spectral-hand":{
    id:"spectral-hand",
    name:"Spectral Hand",
    spellGroup:"Wizard",
    level:2,
    school:"Necromancy",
    components:["V","S"],
    duration:"2 rounds/level",
    castingTime:2,
    savingThrow:"None",
    areaOfEffect:"1 spectral hand",
    range:{type:"self"},
    combatImplemented:true,
    targetMode:"self",
    damageSummary:"Delivers eligible touch attacks at range with +2 to hit.",
    description:"Creates a floating hand that can deliver touch attacks at 30 yards + 5 yards/level. The current combat integration extends Shocking Grasp through the hand and reserves 1d4 of the caster's hit points until the spell ends.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:188,pdfPage:189}
  },

  "stinking-cloud":{
    id:"stinking-cloud",
    name:"Stinking Cloud",
    spellGroup:"Wizard",
    level:2,
    school:"Evocation",
    components:["V","S","M"],
    duration:"1 round/level",
    castingTime:2,
    savingThrow:"Special",
    areaOfEffect:"20-foot cube",
    range:{fixedYards:30},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"Dense cloud blocks sight; failed poison save causes disabling nausea, with a new poison save each affected round.",
    description:"Creates a nauseating green cloud using the volumetric fog system. Creatures exposed at the start of their turn save against poison; failure prevents action. A nauseated creature rolls a fresh poison save at the start of each later turn, recovering immediately on a success even after leaving the cloud.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:188,pdfPage:189}
  },

  "strength":{
    id:"strength",
    name:"Strength",
    spellGroup:"Wizard",
    level:2,
    school:"Alteration",
    components:["V","S","M"],
    duration:"1 hour/level",
    castingTime:2,
    savingThrow:"None",
    areaOfEffect:"Creature touched",
    range:{type:"touch"},
    combatImplemented:true,
    targetMode:"touch-creature",
    damageSummary:"Raises Strength: Warriors +1d8, Priests/Rogues +1d6, Wizards +1d4, capped at 18 in the tactical model.",
    description:"Temporarily increases Strength according to class group. Attack and melee-damage bonuses update from the effective Strength score while the spell lasts.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:188,pdfPage:189}
  },

  "tashas-hideous-laughter":{
    id:"tashas-hideous-laughter",
    name:"Tasha's Uncontrollable Hideous Laughter",
    spellGroup:"Wizard",
    level:2,
    school:"Enchantment/Charm",
    components:["V","S","M"],
    duration:"1 round/level",
    castingTime:2,
    savingThrow:"Neg.",
    areaOfEffect:"1 creature/3 levels in a 30-foot cube",
    range:{fixedYards:60},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"Failed targets collapse laughing, lose two actions, then suffer −2 attack and damage for the remaining duration.",
    description:"Overwhelms intelligent creatures with helpless laughter. Intelligence modifies the saving throw; creatures of Intelligence 4 or less are immune.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:189,pdfPage:190}
  },

  "web":{
    id:"web",
    name:"Web",
    spellGroup:"Wizard",
    level:2,
    school:"Evocation",
    components:["V","S","M"],
    duration:"1 round/level (maximum 6 rounds)",
    durationRoundsPerCasterLevel:1,
    maxDurationRounds:6,
    castingTime:2,
    savingThrow:"Special",
    areaOfEffect:"Up to eight 10-foot cubes",
    range:{baseYards:0,yardsPerCasterLevel:5},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"Creates restraining webs for 1 round/caster level (maximum 6); save at −2 on exposure, then Strength controls escape rate.",
    description:"Fills a seven-hex tactical cluster with sticky webs for 1 round per caster level, to a maximum of 6 rounds. Creatures failing their initial save are restrained and must spend later actions forcing their way free according to effective Strength. Fire destroys affected webbing.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:189,pdfPage:190}
  },

  "fireball":{
    id:"fireball",
    name:"Fireball",
    spellGroup:"Wizard",
    level:3,
    school:"Evocation",
    incantation:"Ignis Sphaera!",
    components:["V","S","M"],
    materialComponent:"A tiny ball of bat guano and sulphur",
    duration:"Instantaneous",
    castingTime:3,
    savingThrow:"1/2",
    areaOfEffect:"20-foot radius",
    radiusFeet:20,
    range:{baseYards:10,yardsPerCasterLevel:10},
    damageDie:"1d6",
    damageDicePerCasterLevel:1,
    maxDamageDice:10,
    combatImplemented:true,
    volumetric:true,
    volumeModel:"architectural-flood-fill",
    friendlyFire:true,
    targetMode:"ground",
    damageSummary:"1d6/caster level fire damage, maximum 10d6; save for half.",
    description:"An explosive burst of flame. A successful saving throw vs. spell reduces damage by half. In enclosed spaces the blast volume is redirected by walls and spills through available openings instead of passing through solid architecture.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:149,pdfPage:150}
  }
}

export function mageThaco(level){
  const lvl=clamp(Math.floor(Number(level)||1),1,20);
  return 20-Math.floor((lvl-1)/3);
}

export function clericThaco(level){
  const lvl=clamp(Math.floor(Number(level)||1),1,20);
  return Math.max(8,20-(Math.floor((lvl-1)/3)*2));
}

export function rogueThaco(level){
  const lvl=clamp(Math.floor(Number(level)||1),1,20);
  return 20-Math.floor((lvl-1)/2);
}

export function conHpAdjustment(score){
  if(score<=3) return -2;
  if(score<=6) return -1;
  if(score<=14) return 0;
  if(score===15) return 1;
  if(score===16) return 2;
  if(score===17) return 3;
  return 4;
}

export function nonWarriorConHpAdjustment(score){
  return Math.min(2,conHpAdjustment(score));
}

export function clericWisdomBonusSlots(wisdom){
  // PHB Table 5 bonus priest spells: bonuses are per spell level, not per
  // character level. Apply only when a priest can cast that spell level.
  const wis=Number(wisdom)||0;
  const bonus=[0,0,0,0,0,0,0];
  if(wis>=13) bonus[0]++;
  if(wis>=14) bonus[0]++;
  if(wis>=15) bonus[1]++;
  if(wis>=16) bonus[1]++;
  if(wis>=17) bonus[2]++;
  if(wis>=18) bonus[3]++;
  if(wis>=19){bonus[2]++;bonus[3]++;} // future exceptional Wisdom
  return bonus;
}

export function savingThrowsFromBands(level,bands){
  const lvl=Math.max(1,Math.floor(Number(level)||1));
  const row=bands.find(row=>lvl>=row.min && lvl<=row.max) || bands[bands.length-1];
  return {death:row.death,wand:row.wand,poly:row.poly,breath:row.breath,spell:row.spell};
}

export const CLASS_RULES={fighter:FIGHTER_CLASS,ranger:FIGHTER_CLASS,mage:MAGE_CLASS,cleric:CLERIC_CLASS,thief:THIEF_CLASS};
export function classProgression(classId,level,abilities={}){
 const c=CLASS_RULES[classId];if(!c)return null;
 if(!Number.isInteger(level)||level<1||level>20)throw Error('Class level must be 1–20.');
 const warrior=['fighter','ranger'].includes(classId),dice=Math.min(level,c.hitDiceThroughLevel),flat=Math.max(0,level-c.hitDiceThroughLevel)*c.hpPerLevelAfterHitDice;
 const con=(warrior?conHpAdjustment:nonWarriorConHpAdjustment)(abilities.con??10);
 const thaco=warrior?FIGHTER_LEVELS[level-1].thaco:classId==='mage'?mageThaco(level):classId==='cleric'?clericThaco(level):rogueThaco(level);
 const bands=warrior?WARRIOR_SAVING_THROW_BANDS:classId==='mage'?MAGE_SAVING_THROW_BANDS:classId==='cleric'?PRIEST_SAVING_THROW_BANDS:ROGUE_SAVING_THROW_BANDS;
 let slots=classId==='mage'?[...MAGE_SPELL_SLOT_ROWS[level-1]]:classId==='cleric'?[...CLERIC_SPELL_SLOT_ROWS[level-1]]:[];
 if(classId==='mage'){const max=MAGE_INTELLIGENCE_TABLE[abilities.int??10]?.maxSpellLevel||0;slots=slots.map((n,i)=>i<max?n:0);}
 if(classId==='cleric'){const wis=abilities.wis??10,bonus=clericWisdomBonusSlots(wis);slots=slots.map((n,i)=>i===5&&wis<17||i===6&&wis<18?0:n?n+bonus[i]:0);}
 return {classId,level,dice,die:c.hitDie,flat,con,hitDice:`${dice}d${c.hitDie}${flat?'+'+flat:''}`,thaco,saves:savingThrowsFromBands(level,bands),attacksPerRound:warrior?(level>=13?2:level>=7?1.5:1):1,spellSlots:slots};
}
export const MOB_SPELLS=Object.values(SPELL_CATALOG).filter(s=>s.combatImplemented&&['Wizard','Priest'].includes(s.spellGroup));
export function spellEligible(spell,classId){return !!spell&&spell.combatImplemented&&(classId==='mage'?spell.spellGroup==='Wizard':classId==='cleric'&&spell.spellGroup==='Priest'&&spell.spheres?.some(s=>CLERIC_CLASS.majorSpheres.includes(s)||spell.level<=3&&CLERIC_CLASS.minorSpheres.includes(s)));}
export function normalizeSpellPreparation(value={}){
 const result={};for(const classId of ['mage','cleric']){const plan=value[classId]||{mode:'prepared',choices:[]};if(!['prepared','pool'].includes(plan.mode)||!Array.isArray(plan.choices)||plan.choices.length>100)throw Error('Invalid spell preparation plan.');const seen=new Set();result[classId]={mode:plan.mode,choices:plan.choices.map(row=>{if(!spellEligible(SPELL_CATALOG[row.spellId],classId)||seen.has(row.spellId)||!Number.isInteger(row.count)||row.count<1||row.count>100)throw Error('Choose distinct supported spells and counts from 1–100.');seen.add(row.spellId);return {spellId:row.spellId,count:row.count};})};}return result;
}
export function prepareMobSpells(classId,level,abilities,plans={},rng=Math.random){
 if(!['mage','cleric'].includes(classId))return {spellSlots:[],knownSpellIds:[],memorizedSpellIds:[],memorizedPriestSpellIds:[]};
 const plan=normalizeSpellPreparation(plans)[classId],slots=classProgression(classId,level,abilities).spellSlots,prepared=[];
 if(plan.mode==='prepared'){const used=slots.map(()=>0);for(const row of plan.choices){const i=SPELL_CATALOG[row.spellId].level-1;used[i]=(used[i]||0)+row.count;if(used[i]>(slots[i]||0))throw Error(`${classId} level ${level}: too many level ${i+1} prepared spells.`);prepared.push(...Array(row.count).fill(row.spellId));}}
 else slots.forEach((count,i)=>{const choices=plan.choices.filter(row=>SPELL_CATALOG[row.spellId].level===i+1),total=choices.reduce((n,r)=>n+r.count,0);if(!total)return;for(let n=0;n<count;n++){let roll=rng()*total;const choice=choices.find(r=>(roll-=r.count)<0);prepared.push(choice.spellId);}});
 return {spellSlots:slots,knownSpellIds:classId==='mage'?plan.choices.filter(r=>slots[SPELL_CATALOG[r.spellId].level-1]>0).map(r=>r.spellId):[],memorizedSpellIds:classId==='mage'?prepared:[],memorizedPriestSpellIds:classId==='cleric'?prepared:[]};
}
export function generateMobRules(definition,sample,rng=Math.random){
 const authored=definition.character.rules,baseline=!sample.classId||sample.classId==='none'?monsterBaseline(authored,definition.mob.species):null;
 const rules=baseline?{...authored,...baseline,hpMode:'rolled'}:authored,abilities=definition.character.abilities,progression=classProgression(sample.classId,sample.level,abilities),derived=rules.classRules==='class'?progression:null;
 const roll=(count,die,bonus=0)=>Array.from({length:count},()=>Math.max(1,1+Math.floor(rng()*die)+bonus)).reduce((a,b)=>a+b,0);
 const match=/^(\d+)d(\d+)([+-]\d+)?$/.exec(rules.hitDice);
 const rolledHp=derived&&!rules.overrideHp?roll(derived.dice,derived.die,derived.con)+derived.flat:rules.hpMode==='fixed'?rules.maxHp:Math.max(1,roll(+match[1],+match[2])+Number(match[3]||0));
 const hp=Math.max(authored.minimumHp??1,rolledHp);
 const spells=prepareMobSpells(sample.classId,sample.level,abilities,definition.mob.spellPreparation,rng);
 return {...(baseline?{ac:baseline.ac,authoredBaseAc:baseline.ac,unarmoredAc:baseline.ac,move:baseline.move,authoredMove:baseline.move,morale:baseline.morale,moraleLabel:String(baseline.morale),xpValue:baseline.xpValue,monsterBaselineId:baseline.id}:{}),hp,maxHp:hp,hitDiceLabel:derived&&!rules.overrideHp?derived.hitDice:rules.hitDice,hitDiceValue:baseline?.hitDiceValue??(derived?derived.dice:+match[1]),thaco:derived&&!rules.overrideThaco?derived.thaco:rules.thaco,attacksPerRound:derived&&!rules.overrideAttacks?derived.attacksPerRound:rules.attacksPerRound,saves:progression?.saves||(baseline?savingThrowsFromBands(Math.max(1,Math.ceil(baseline.hitDiceValue)),WARRIOR_SAVING_THROW_BANDS):{}),stats:{...abilities},...spells};
}
