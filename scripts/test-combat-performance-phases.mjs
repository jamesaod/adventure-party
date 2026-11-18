import assert from 'node:assert/strict';
import {createCombatPerformance} from '../js/combat-performance.mjs';
let t=0;const p=createCombatPerformance({enabled:true,now:()=>t});p.begin();const outer=p.start('outer');t=2;const inner=p.start('inner');t=5;inner();t=8;outer();outer();t=10;p.end();assert.equal(p.snapshot().cpuMs.outer,8);assert.equal(p.snapshot().cpuMs.inner,3);assert.equal(p.snapshot().cpuMs.unattributed,2,'Nested scopes count covered time once');
t=16;p.begin();t=20;p.end();t=49;p.begin();t=55;p.end();const s=p.snapshot();assert.equal(s.framePacing.median,16);assert.equal(s.framePacing.max,33);assert.equal(s.slowestFrame.frameSubmission,10);console.log('PASS nested phase accounting, idempotent close, frame pacing and slowest frame capture');
