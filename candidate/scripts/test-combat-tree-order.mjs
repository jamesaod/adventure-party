import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/combat-render-frame.js',import.meta.url),'utf8');
const start=source.indexOf('  actors.sort('),end=source.indexOf(');',start)+2;
for(const error of [-1e-10,0,1e-10]){
 const actors=[{sortY:100+error,sortX:10},{sortY:100,sortX:20},{sortY:99.9,sortX:30}];
 vm.runInNewContext(source.slice(start,end),{actors});
 assert.deepEqual(actors.map(a=>a.sortX),[30,10,20]);
}
console.log('PASS stable same-row tree ordering across camera projection rounding');
