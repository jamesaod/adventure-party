import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('js/combat-fir-trees.mjs','utf8');
const start=source.indexOf('    if(lost||disposed)return null;',source.indexOf('function get(variant'));
const end=source.indexOf('    const angle=viewRotation',start);
assert.ok(start>0&&end>start);
// Exercise production cache lookup/invalidation, replacing only the expensive render.
const get=vm.runInNewContext(`(()=>{const cache=new Map();let stateKey='',lost=false,disposed=false,liveLighting=true;const snowCoverage={},bareBranchSnow={},firDisplaySpace={},snowGroundLight=null;let renders=0;
return (instanceKey,snowAmount,lights=[],solar={hour:12},viewRotation=0,branch=0)=>{const family={base:5},localVariant=7,bareSnowState={update:()=>branch};const variant=0,rotation=0,ambient=100,burnt=false,burning=false,direct=null,fallState=null;
${source.slice(start,end)}
const result={lightKey,render:++renders};cache.set(key,result);return result;
};})()`);
const a=get('a',.2),b=get('b',.8);
assert.equal(get('a',.2),a,'Different snow amounts must not evict neighbouring trees');
assert.equal(get('b',.8),b);
assert.notEqual(get('a',.3),a,'Changed snow must refresh its own tree');
assert.equal(get('b',.8),b);
assert.notEqual(get('b',.8,[{x:1}]),b,'Local lighting must invalidate');
assert.notEqual(get('a',.3,[],{hour:14}),a,'Solar change must invalidate');
console.log('PASS tree snow cache isolation and lighting invalidation');


const bare=get('bare',0,[],{hour:12},0,.5);assert.equal(get('bare',0,[],{hour:12},0,.5),bare);assert.notEqual(get('bare',0,[],{hour:12},0,.6),bare,'Bare-branch snowfall must invalidate only its tree image');
