import assert from 'node:assert/strict';
import {createCombatPerformance} from '../js/combat-performance.mjs';
let t=0;const p=createCombatPerformance({enabled:true,now:()=>t});
p.begin();t=2;p.measure('outer',()=>{t=3;p.measure('inner',()=>{t=6;});t=9;});t=12;p.end();
assert.equal(p.snapshot().cpuMs.unattributed,5);
p.begin();assert.throws(()=>p.measure('throws',()=>{t+=2;throw Error('expected');}));t+=3;p.end();
assert.equal(p.snapshot().cpuMs.unattributed,3);
assert.equal(p.snapshot().cpuMs.throws,2);
console.log('PASS nested timing coverage, exception cleanup and frame reset');
