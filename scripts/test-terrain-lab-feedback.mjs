import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canopyFeedback} from '../js/terrain-lab-feedback.mjs';
assert.match(canopyFeedback(true,{}),/out of date/);
assert.match(canopyFeedback(true,undefined),/out of date/);
assert.match(canopyFeedback(false,{canopyBlades:9000}),/hidden/);
assert.match(canopyFeedback(true,{canopyBlades:0}),/No canopy grass/);
assert.match(canopyFeedback(true,{canopyBlades:75000}),/75,000 blades loaded/);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const index=read('index.html'),boot=read('js/adventure-party.js'),renderer=read('js/combat-webgl.mjs');
assert.match(index,/adventure-party\.js\?v=R238C456-pan2/);
assert.match(boot,/combat-webgl\.mjs\?v=pan2/);
assert.match(renderer,/combat-ground-cover\.mjs\?v=pan2/);
assert.match(read('terrain-lab.html'),/terrain-lab\.mjs\?v=pan2/);
console.log('PASS grass feedback handles stale renderer, hidden grass, empty patch, actual counts and complete cache version chain');




