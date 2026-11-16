import assert from 'node:assert/strict';
import {DEFAULTS,validateSettings,exportPreset,importPreset} from '../js/terrain-lab-preset.mjs';
assert.deepEqual(importPreset(JSON.parse(JSON.stringify(exportPreset(DEFAULTS)))),DEFAULTS);
for(const bad of [{brightness:NaN},{hour:24},{grass:'true'},{outlineColor:'red'},{antialiasing:3},{tufts:1.5},{unknown:1}])assert.throws(()=>validateSettings(bad));
assert.throws(()=>importPreset({format:'adventure-party-terrain-look',version:2,settings:DEFAULTS}));
const partial=validateSettings({brightness:.5,grass:false});assert.equal(partial.brightness,.5);assert.equal(partial.grass,false);assert.equal(DEFAULTS.brightness,1.05);
console.log('Terrain lab preset validation and round-trip passed');
