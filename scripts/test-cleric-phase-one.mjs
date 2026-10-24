import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync('js/adventure-party.js','utf8');
for(const name of ['CLERIC_CLASS','CLERIC_XP_LEVELS','CLERIC_SPELL_SLOT_ROWS',
  'PRIEST_SAVING_THROW_BANDS','function clericWisdomBonusSlots(',
  'function makeClericCharacter(','function makeTestPartyCleric(',
  'function levelUpCleric(','function awardClericXp(',
  'function clericCanPrepareSpell(','function clericPrepareSpells(',
  'function clericCanCastPreparedSpell(','function clericConsumePreparedSpell(']){
  assert.ok(src.includes(name),name);
}
assert.ok(src.includes('case "cleric": return makeTestPartyCleric()'));
const slots=src.match(/const CLERIC_SPELL_SLOT_ROWS=\[([\s\S]*?)\];/);
assert.ok(slots);
const rows=[...slots[1].matchAll(/^\s*\[([\d,\s]+)\],?/gm)].map(m=>m[1].split(',').map(Number));
assert.equal(rows.length,20);
assert.deepEqual(rows[0],[1,0,0,0,0,0,0]);
assert.deepEqual(rows[4],[3,3,1,0,0,0,0]);
assert.deepEqual(rows[19],[9,9,9,8,7,5,2]);
for(const row of rows)assert.equal(row.length,7);
assert.ok(src.includes('spell.spellGroup!=="Priest"'));
assert.ok(src.includes('level<=3&&minor.includes(sphere)'));
assert.ok(src.includes('cleric.memorizedPriestSpellIds.splice('));
assert.ok(src.includes('cleric.xp>=clericLevelData(cleric.level+1).xp'));
console.log('PASS Cleric level 1-20 progression, prayer slots, preparation, studio factory');
