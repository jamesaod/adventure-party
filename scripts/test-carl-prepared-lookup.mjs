import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {preparedVisualKey} from '../js/prepared-visual-key.mjs';
const index=JSON.parse(readFileSync('assets/prepared-combat/carl-visual-index.json')).entries;
for(const [key,file] of Object.entries(index)){
 const p=JSON.parse(gunzipSync(readFileSync(`assets/prepared-combat/${file}.json.gz`)));
 assert.equal(preparedVisualKey(p.recipe),key);
 const r=structuredClone(p.recipe);r.animation.spriteFamilySignature='inventory-only-change';
 assert.equal(preparedVisualKey(r),key);
 r.mob.heightInches+=1;assert.notEqual(preparedVisualKey(r),key);
}
const source=readFileSync('js/combat-pose-recipe.mjs','utf8');
assert(source.indexOf("if (!fromCombat) return fallbackRecipe('Using published combat assets.');")<source.indexOf('workspace = await loadStudioWorkspace'));
console.log(`PASS ${Object.keys(index).length} Carl visual mappings, inventory-independent lookup, height separation and normal-combat draft isolation`);
