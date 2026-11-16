import assert from 'node:assert/strict';import fs from 'node:fs';
for(const file of ['3d-studio.html','js/3d-studio.mjs','css/3d-studio.css'])assert.equal(fs.existsSync(file),false,'Retired Studio interface must be absent: '+file);
for(const file of ['js/studio-equipment.mjs','js/combat-mob-renderer.mjs','js/mob-workshop.mjs'])assert.ok(fs.existsSync(file),'Shared consumers remain: '+file);
console.log('PASS retired Studio interface removed, shared consumers retained');
