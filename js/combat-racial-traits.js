// One resistance roll at effect application, before the spell's ordinary save.
function resistRacialSpell(target,spell){
 const result=globalThis.AdventurePartyRaces.rollRacialSpellResistance(target,spell,()=>d(100));
 if(result.chance){
  log(`${target.name}: racial resistance to ${spell.name}: d100 ${result.roll} vs ${result.chance}% — ${result.resisted?'resisted':'spell proceeds'}.`,'system');
  if(result.resisted&&typeof candidateQueueCombatBeat==='function')candidateQueueCombatBeat(target,{category:'direct-result',text:`RESISTS ${spell.name}`,meta:{outcome:'racial-resistance',roll:result.roll,chance:result.chance}});
 }
 return result.resisted;
}
async function finishResistedRacialSpell(target,caster,spell,action){
 setCombatMessage(`${target.name} resists ${spell.name} through racial resistance.`,COMBAT_MESSAGE_MIN_HOLD_MS);
 await waitForCombatActionPause();finishTestSpellCast(caster,spell.name,action);return true;
}
