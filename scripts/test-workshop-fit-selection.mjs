import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/mob-workshop.mjs',import.meta.url),'utf8');
const handler=source.split('\n').find(line=>line.startsWith("for(const slot of ['main','off','shield'])"));
assert(handler,'Equipment selection handler exists');
for(const slot of ['main','off','shield']){
 const elements=Object.fromEntries(['main','off','shield','gripSlot','equipment'].map(id=>[id,{value:id==='gripSlot'?'quiverArrows':'none',checked:true}]));
 const draft={equipment:{main:'none',off:'none',shield:'none',grips:{[slot]:{rotation:[1,2,3]}},fitsByItem:{saved:{rotation:[4,5,6]}}},checks:{equipment:true}};
 let reloaded=0;
 vm.runInNewContext(handler,{$:id=>elements[id],run:f=>f,STUDIO_WEAPONS:[],draft,migrateFits:()=>{},loadEquipment:async()=>{assert.equal(elements.gripSlot.value,slot,'Fit target must change before reload');reloaded++;},status:()=>{}});
 elements[slot].value='test-item';await elements[slot].onchange();
 assert.equal(reloaded,1);assert.equal(draft.equipment[slot],'test-item');assert.equal(draft.checks.equipment,false);assert.deepEqual(draft.equipment.fitsByItem.saved.rotation,[4,5,6]);
}
console.log('PASS changing main/off/shield exits arrow-bundle fitting before reload and preserves saved fits.');
