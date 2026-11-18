import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const c=vm.createContext({});vm.runInContext(readFileSync(new URL('../js/combat-audio-rules.js',import.meta.url),'utf8'),c);
assert.equal(c.combatTerrainStepPool('grass',{repositoryMobId:'hill-giant'}),'step-hill-giant');assert.equal(c.combatTerrainStepPool('water',{type:'mob:hill-giant'}),'step-hill-giant');assert.equal(c.combatTerrainStepPool('grass',{type:'orc'}),'step-grass');
for(let n=1;n<=5;n++){const b=readFileSync(new URL('../assets/audio/sfx/hill-giant/step-'+n+'.wav',import.meta.url));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt32LE(24),48000);assert(b.length>10000);}
console.log('PASS Hill Giant-only footstep selection and five valid local samples');
