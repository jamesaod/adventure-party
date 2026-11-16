// Retired standalone Studio UI assertions removed; shared runtime tests remain.
import assert from 'node:assert/strict';
import {readCombatFixture as readFileSync} from './combat-test-source.mjs';
import {HAIR_PRESETS,METAL_PRESETS,isWarriorRecolorModel,normalizeWarriorRecolor,WARRIOR_RECOLOR_ID}
  from '../js/warrior-recolor.mjs';
assert.equal(WARRIOR_RECOLOR_ID,'woman-warrior-hair-metal-v2');
assert.ok(isWarriorRecolorModel('woman-warrior-mixamo-sword-shield-full-17'));
assert.ok(isWarriorRecolorModel('woman-warrior-tripo-source'));
assert.ok(!isWarriorRecolorModel('new-carl-tripo-source'));
assert.deepEqual(normalizeWarriorRecolor({hair:'auburn',metal:'gold'}),{hair:'auburn',metal:'gold',debug:'off'});
assert.deepEqual(normalizeWarriorRecolor({hair:'unknown',metal:'sword'}),{hair:'default',metal:'default',debug:'off'});
assert.equal(normalizeWarriorRecolor({debug:'hair'}).debug,'hair');
assert.equal(normalizeWarriorRecolor({debug:'metal'}).debug,'metal');
assert.equal(normalizeWarriorRecolor({debug:'unsafe'}).debug,'off');
assert.ok(Object.keys(HAIR_PRESETS).length>=6&&Object.keys(METAL_PRESETS).length>=6);
const catalog=JSON.parse(readFileSync('data/studio-models.json','utf8'));
for(const entry of catalog.models.filter(m=>m.id.startsWith('woman-warrior-'))){
 assert.deepEqual(entry.appearanceCustomization.supportedChannels,['hair','metal']);
 assert.equal(entry.appearanceCustomization.recolorMaskSetId,WARRIOR_RECOLOR_ID);
}

const combat=readFileSync('js/combat-mob-renderer.mjs','utf8');
const recipe=readFileSync('js/combat-pose-recipe.mjs','utf8');
const capture=readFileSync('js/studio-capture.mjs','utf8');







assert.ok(combat.includes('applyWarriorRecolor(THREE,model,recipe.renderSettings?.appearanceRecolor)'));
assert.ok(recipe.includes('appearanceRecolor: structuredClone(settings.appearanceRecolor'));
assert.ok(capture.includes('recolorMaskSetId:'));
console.log('PASS Rev 126: recolor controls, model restriction, capture/export and combat handoff');
