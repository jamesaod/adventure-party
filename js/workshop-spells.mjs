import {SPELL_CATALOG} from './mob-class-rules.mjs?v=R238C203';
// Explicitly supported first bridge: finite learned preparations. Unsupported
// innate/at-will rules must not silently become ordinary expendable spells.
export function workshopSpellIssues(draft){
 const out=[],seen=new Set(),classId=draft.classes?.[0]?.id;
 for(const row of draft.creature?.spells||[]){const spell=SPELL_CATALOG[row.id],name=spell?.name||row.id;
  if(!spell?.combatImplemented){out.push('Unsupported combat spell: '+name);continue;}
  if(row.kind!=='learned'||row.uses===0)out.push(name+': innate and at-will casting are not connected yet.');
  if((spell.spellGroup==='Wizard'?'mage':spell.spellGroup==='Priest'?'cleric':null)!==classId)out.push(name+': requires the matching primary Mage or Cleric class.');
  if(seen.has(row.id))out.push(name+': use one row with the desired uses per day.');seen.add(row.id);
 }
 return out;
}
export function workshopPreparedSpells(draft){
 const issues=workshopSpellIssues(draft);if(issues.length)throw Error(issues.join('\n'));
 const rows=draft.creature?.spells||[],wizard=[],priest=[],levels={};
 for(const row of rows){const target=SPELL_CATALOG[row.id].spellGroup==='Wizard'?wizard:priest;target.push(...Array(row.uses).fill(row.id));levels[row.id]=row.level;}
 return {knownSpellIds:[...new Set(wizard)],memorizedSpellIds:wizard,memorizedPriestSpellIds:priest,workshopSpellCasterLevels:levels};
}
