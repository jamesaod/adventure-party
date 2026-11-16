// Presentation identity and surface rules; no allegiance or combat-rule changes.
function selectedCombatVoice(unit){
 if(!unit)return null;
 const identity=[unit.type,unit.spriteSetId,unit.species,unit.race,unit.modelId,unit.name].filter(v=>typeof v==='string').join(' ').toLowerCase();
 if(/(^|[^a-z])(elf|elves)([^a-z]|$)/.test(identity))return 'female';
 if(/(^|[^a-z])carl([^a-z]|$)/.test(identity)||(unit.type==='fighter'&&(!unit.spriteSetId||unit.spriteSetId==='fighter')))return 'male';
 return null;
}
function chooseCombatAudioClip(pool,last,random=Math.random){if(!pool?.length)return null;if(pool.length===1)return pool[0];const previous=pool.indexOf(last);let index=Math.min((previous<0?pool.length:pool.length-1)-1,Math.floor(random()*(previous<0?pool.length:pool.length-1)));if(previous>=0&&index>=previous)index++;return pool[index];}
function combatFootstepSurface({kind='grass',wear=0,wetness=0,water=0,indoor=false,snow=false}={}){
 if(indoor||snow||!['grass','dirt'].includes(kind))return null;
 if(water>.002)return 'water';
 if(kind==='dirt'||wear>=.5)return wetness>=.6?'mud':'dirt';
 return 'grass';
}
