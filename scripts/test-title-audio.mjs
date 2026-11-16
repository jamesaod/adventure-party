import assert from 'node:assert/strict';
import fs from 'node:fs';
const engine=fs.readFileSync('js/adventure-party.js','utf8');
assert.doesNotMatch(engine,/startTitleMusic|stopTitleMusic|titleLoop|musicGain|arcane-dust/,'No title music engine or request remains');
assert.match(engine,/function unlockAudio/);
assert.match(engine,/function syncWeatherAudio/);
assert.match(engine,/sfxGain=audioCtx.createGain/);
console.log('PASS silent title music with shared effects and weather audio retained');
