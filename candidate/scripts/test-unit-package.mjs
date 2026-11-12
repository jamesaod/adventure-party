import assert from 'node:assert/strict';
import {createUnitPackage,validateUnitPackage,defineModelAttachmentProfile,
  registerUnitDefinition,instantiateUnit,UNIT_SOCKETS} from '../js/unit-package.mjs';
const attachments=defineModelAttachmentProfile({
 modelId:'orc-base',sockets:{'right-hand-grip':{bone:'mixamorigRightHand',
 position:[0.01,0.02,0.03],rotation:[0,90,0],scale:1.1}}
});
assert.ok(UNIT_SOCKETS.includes('shield-forearm'));
assert.deepEqual(attachments.sockets['right-hand-grip'].position,[0.01,0.02,0.03]);
const unit=createUnitPackage({id:'orc-warrior-01',name:'Orc Warrior',modelId:'orc-base',
 character:{classId:'fighter',level:3,rules:{system:'adnd-2e'}},
 actionProfiles:['one-handed-swing','throw'],
 equipment:[{itemId:'battle-axe',slot:'right-hand'}],attachments,
 references:{model:'assets/models/orc-base.glb'},mob:{faction:'orc',morale:11}});
assert.equal(validateUnitPackage(unit),unit);
const catalog=new Map();
registerUnitDefinition(catalog,unit);
assert.throws(()=>registerUnitDefinition(catalog,unit),/Duplicate/);
const a=instantiateUnit(unit,'encounter-7-orc-1',{hp:9});
const b=instantiateUnit(unit,'encounter-7-orc-2',{hp:4});
a.equipment[0].itemId='club';a.state.conditions.push('poisoned');
assert.equal(b.equipment[0].itemId,'battle-axe');
assert.deepEqual(b.state.conditions,[]);
assert.equal(a.definitionId,b.definitionId);
assert.equal(catalog.get(unit.id).equipment[0].itemId,'battle-axe');
assert.throws(()=>defineModelAttachmentProfile({modelId:'orc-base',sockets:{tail:{}}}),/Unknown/);
assert.throws(()=>createUnitPackage({id:'bad id',name:'Bad',modelId:'orc-base'}),/Invalid/);
assert.throws(()=>createUnitPackage({id:'x',name:'X',modelId:'orc-base',actionProfiles:['bow','bow']}),/Duplicate/);
console.log('PASS unit package v1: identities, sockets, references, isolated runtime instances');
