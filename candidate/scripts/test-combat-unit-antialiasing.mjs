import assert from 'node:assert/strict';
import {configureUnitAntialiasing,setUnitAntialiasing,unitAntialiasing} from '../js/combat-unit-antialiasing.mjs';
configureUnitAntialiasing([4],[4]);assert.equal(unitAntialiasing().samples,0);
setUnitAntialiasing(2);assert.equal(unitAntialiasing().samples,0,'Do not silently upgrade to a more expensive sample count');
configureUnitAntialiasing([8,4,2],[4,2]);setUnitAntialiasing(8);assert.equal(unitAntialiasing().samples,4);
setUnitAntialiasing(0);assert.equal(unitAntialiasing().samples,0);
setUnitAntialiasing(4);configureUnitAntialiasing([],[]);assert.equal(unitAntialiasing().samples,0);
console.log('PASS model AA hardware fallback and explicit off');
