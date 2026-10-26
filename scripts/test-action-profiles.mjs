import assert from 'node:assert/strict';
import {ACTION_POSES,DEFAULT_ACTION_PROFILE_IDS,ACTION_PROFILE_CATALOG,
  createActionProfileCatalog,defineActionProfile,resolveActionPose}
  from '../js/action-profile-catalog.mjs';

assert.deepEqual(ACTION_POSES,['ready','windup','attack','falling','prone','casting-windup','cast']);
assert.equal(DEFAULT_ACTION_PROFILE_IDS.length,12);
assert.equal(ACTION_PROFILE_CATALOG.size,12);
for(const id of DEFAULT_ACTION_PROFILE_IDS){
  const p=ACTION_PROFILE_CATALOG.get(id);
  assert.ok(p,id);
  for(const pose of ACTION_POSES){
    assert.equal(resolveActionPose(p,pose).source,'fallback-sprite');
  }
}
const custom=defineActionProfile({
  id:'whip',label:'Whip',category:'melee',
  poses:{windup:{animation:'WhipWindup',timeSeconds:0.2},
    attack:{animation:'WhipStrike',timeSeconds:0.6}}
});
const expanded=createActionProfileCatalog([custom]);
assert.equal(expanded.size,13);
assert.equal(resolveActionPose(custom,'windup').pose.timeSeconds,0.2);
assert.equal(resolveActionPose(custom,'ready').source,'fallback-sprite');
assert.equal(resolveActionPose(custom,'prone',{animation:'Fall',timeSeconds:1}).source,'shared-prone');
assert.throws(()=>createActionProfileCatalog([custom,custom]),/Duplicate/);
assert.throws(()=>defineActionProfile({id:'x',label:'X',poses:{jump:{animation:'J',timeSeconds:0}}}),/Unknown/);
assert.throws(()=>defineActionProfile({id:'x',label:'X',poses:{attack:{animation:'A',timeSeconds:-1}}}),/nonnegative/);
console.log('Action profile catalog: 12 defaults, optional poses, shared prone and extensibility PASS');

// Unit Package regression runs as part of existing action-profile validation.
await import('./test-unit-package.mjs');

const sharedReady={animation:'SwordIdle',timeSeconds:0.2};
const sharedAttack={animation:'SwordSlash',timeSeconds:0.6};
const borrowedCatalog=new Map(ACTION_PROFILE_CATALOG);
borrowedCatalog.set('one-handed-swing',defineActionProfile({id:'one-handed-swing',label:'1H',poses:{ready:sharedReady,attack:sharedAttack}}));
assert.equal(resolveActionPose(borrowedCatalog.get('dual-wield'),'attack',null,borrowedCatalog).source,'profile-fallback');
assert.equal(resolveActionPose(borrowedCatalog.get('dual-wield'),'attack',null,borrowedCatalog).pose.animation,'SwordSlash');
assert.equal(resolveActionPose(borrowedCatalog.get('dual-wield'),'falling',null,borrowedCatalog).source,'fallback-sprite');
borrowedCatalog.set('dual-wield',defineActionProfile({id:'dual-wield',label:'Dual',fallbackId:'one-handed-swing',poses:{attack:{animation:'TwoWeaponSlash',timeSeconds:0.5}}}));
assert.equal(resolveActionPose(borrowedCatalog.get('dual-wield'),'attack',null,borrowedCatalog).pose.animation,'TwoWeaponSlash');

const wizardProfile=ACTION_PROFILE_CATALOG.get('wizard-staff-grip');
assert.equal(wizardProfile.label,'Wizard Staff Grip');assert.equal(wizardProfile.fallbackId,null);
assert.equal(resolveActionPose(wizardProfile,'ready',null,borrowedCatalog).source,'fallback-sprite','Wizard captures cannot silently reuse another weapon grip');
