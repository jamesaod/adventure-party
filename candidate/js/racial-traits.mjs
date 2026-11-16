// Stable race IDs identify related MOB types independently of model or allegiance.
const profile=(id,label,morale=10)=>Object.freeze({id,label,morale});
export const RACE_PROFILES=Object.freeze([
 profile('unspecified','Other / unspecified'),profile('human','Human'),profile('elf','Elf',13),
 profile('half-elf','Half-elf'),profile('dwarf','Dwarf'),profile('gnome','Gnome'),profile('halfling','Halfling'),
 profile('orc','Orc'),profile('goblin','Goblin'),profile('hobgoblin','Hobgoblin'),profile('kobold','Kobold'),
 profile('gnoll','Gnoll'),profile('ogre','Ogre'),profile('troll','Troll')
]);
export const GENDERS=Object.freeze([['unspecified','Unspecified'],['male','Male'],['female','Female'],['nonbinary','Non-binary']]);
const aliases={'elves':'elf','wood-elf':'elf','high-elf':'elf','grey-elf':'elf','gray-elf':'elf','dark-elf':'elf','half-elves':'half-elf','halfelf':'half-elf','dwarves':'dwarf','humans':'human','orcs':'orc','goblins':'goblin','kobolds':'kobold'};
export function canonicalRace(value){const id=String(value||'').trim().toLowerCase().replace(/[ _]+/g,'-'),key=aliases[id]||id;return RACE_PROFILES.some(r=>r.id===key)?key:'unspecified';}
export function raceIdOf(unit){return canonicalRace(unit?.raceId??unit?.race??unit?.species??unit?.stats?.species);}
export function raceProfile(id){return RACE_PROFILES.find(r=>r.id===id)||RACE_PROFILES[0];}
export function ensureRaceIdentity(draft){
 if(!Object.hasOwn(draft,'raceId'))draft.raceId=canonicalRace(draft.stats?.species);
 if(!RACE_PROFILES.some(r=>r.id===draft.raceId))throw Error('Unknown race: '+draft.raceId);
 if(draft.gender==null)draft.gender='unspecified';
 if(!GENDERS.some(([id])=>id===draft.gender))throw Error('Choose a valid gender.');
 const base=raceProfile(draft.raceId).morale;
 // Old drafts used 10 as the unconfigured default. Preserve other authored values.
 if(!Object.hasOwn(draft,'moraleOverride'))draft.moraleOverride=draft.stats?.morale===10||draft.stats?.morale===base?null:draft.stats?.morale??null;
 if(draft.moraleOverride!==null&&(!Number.isInteger(draft.moraleOverride)||draft.moraleOverride<2||draft.moraleOverride>20))throw Error('Morale override must be an integer from 2 to 20.');
 if(draft.stats)draft.stats.morale=draft.moraleOverride??base;
 return draft;
}
export function racialWeaponBonuses(unit,kind){
 const id=kind==='missile'?unit?.missileCatalogId:kind==='melee'?unit?.weaponCatalogId:null;
 const family=kind==='missile'&&/^bow-(?:short|long|composite-short|composite-long)$/.test(id||'')?'bow':kind==='melee'&&/^sword-/.test(id||'')?'sword':null;
 const active=raceIdOf(unit)==='elf'&&!!family;
 return {hit:active?1:0,damage:active?1:0,family,raceId:raceIdOf(unit)};
}
export function racialSpellTags(spell){
 if(Array.isArray(spell?.racialEffectTags))return spell.racialEffectTags;
 if(spell?.id==='sleep')return ['sleep'];
 if(spell?.id==='hypnotic-pattern')return ['charm'];
 const school=String(spell?.school||'').toLowerCase();
 return school.includes('charm')||school==='enchantment'||spell?.spheres?.includes('Charm')?['charm']:[];
}
export function rollRacialSpellResistance(unit,spell,rollPercent=()=>1+Math.floor(Math.random()*100)){
 const chance=raceIdOf(unit)==='elf'&&racialSpellTags(spell).some(t=>t==='sleep'||t==='charm')?90:0;
 if(!chance)return {chance:0,roll:null,resisted:false};
 const roll=rollPercent();if(!Number.isInteger(roll)||roll<1||roll>100)throw Error('Resistance roll must be 1–100.');
 return {chance,roll,resisted:roll<=chance};
}
globalThis.AdventurePartyRaces=Object.freeze({racialWeaponBonuses,rollRacialSpellResistance,raceIdOf,raceProfile});
