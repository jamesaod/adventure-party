import assert from 'node:assert/strict';
import {collectWaterContacts} from '../js/combat-water-contacts.mjs';
const movers=[{entity:{alive:false},x:0,y:0},{entity:{alive:true},x:1,y:1}];
const unexpected=()=>{throw Error('Disabled fringe must not sample terrain');};
assert.deepEqual(collectWaterContacts(movers,unexpected,unexpected),[]);
assert.equal(collectWaterContacts(movers),collectWaterContacts([]));
console.log('PASS retired corpse fringe emits no contacts or terrain samples');
