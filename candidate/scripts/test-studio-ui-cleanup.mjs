import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync('3d-studio.html','utf8');
const studio=readFileSync('js/3d-studio.mjs','utf8');
for (const id of [
  'studioModelLibrary', 'studioLoadLibraryButton', 'studioLoadButton',
  'studioAnimationFiles','studioLoadAnimationButton','studioClip',
  'studioRightHandWeapon','studioLeftHandShield','studioResetEquipmentButton'
]) assert.ok(html.includes('id="'+id+'"'), 'Required working Studio control missing: '+id);
for(const obsolete of [
  'studioQaPackPanel','studioQaPackFiles','studioQaPackLoadButton',
  'studioQaPackModel','studioQaPackUseButton','studioQaPackStatus',
  'Experimental Rev 107 local FBX','<strong>Rev 114','<strong>Rev 113',
  '<strong>Rev 112','<strong>Rev 111','<strong>Rev 110','<strong>Rev 109'
])assert.ok(!html.includes(obsolete),'Obsolete QA ZIP UI or revision notes must be removed: '+obsolete);
for(const stale of ['QaPack','qaPack','studio-qa-pack.mjs','readHumanoidQaPack']) {
  assert.ok(!studio.includes(stale),'Dead QA pack event/controller code remains: '+stale);
}
assert.ok(studio.includes('function loadModelLibrary()') && studio.includes('function loadRetargetQaClips('),
  'The actual catalog-backed model and animation QA paths are preserved');
assert.ok(studio.includes('function loadAnimationFiles(') && studio.includes('function bindControls()'),
  'Direct animation FBX import and current UI events stay active');
const catalog=JSON.parse(readFileSync('data/studio-models.json','utf8'));
const model=catalog.models.find(entry=>entry.id==='new-orc-retarget-anatomical-full-17-qa');
assert.equal(model.retargetQa.clips.length,17,'All 17 animations remain accessible in Model Library');
console.log('PASS Studio cleanup: no obsolete QA pack controls, model library/animation/equipment intact');
