import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readCombatFixture as readFileSync} from './combat-test-source.mjs';
const engine=readFileSync('js/adventure-party.js','utf8'),addon=readFileSync('js/combat-environment-actions.js','utf8');
const names=new Set();for(const match of engine.matchAll(/^(?:async )?function (\w+)\(/gm)){assert(!names.has(match[1]),`Duplicate engine function: ${match[1]}`);names.add(match[1]);}
for(const name of ['drawAimAreaPreview','drawAimFriendlyFireWarning']){
 const start=engine.indexOf('function '+name+'('),end=engine.indexOf('\nfunction ',start+1),context={environmentAimBlocked:()=>true};
 vm.runInNewContext(engine.slice(start,end)+`;${name}();`,context);
 assert(!addon.includes(name+'=function'),'Environment must not replace '+name);
}
assert(!addon.includes('updateUi=function'),'Environment must not replace updateUi');
const start=engine.indexOf('function updateUi('),end=engine.indexOf('\nfunction ',start+1);assert.match(engine.slice(start,end),/updateEnvironmentAimUi\(\)/);
console.log('PASS unique engine declarations and explicit environment UI/preview integration');
