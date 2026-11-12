import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {applyModelUpAxis,MODEL_UP_AXES} from '../js/workshop-model-axis.mjs';
import {newDraft,validateDraft} from '../js/mob-workshop-core.mjs';
for(const axis of MODEL_UP_AXES){
 const g=new THREE.Group(),v=new THREE.Vector3();v[axis.slice(-1).toLowerCase()]=axis.startsWith('-')?-1:1;
 applyModelUpAxis(THREE,g,axis);v.applyQuaternion(g.quaternion);assert.ok(v.distanceTo(new THREE.Vector3(0,1,0))<1e-8);
 const d=newDraft();d.modelUpAxis=axis;assert.equal(validateDraft(JSON.parse(JSON.stringify(d))).modelUpAxis,axis);
 applyModelUpAxis(THREE,g,'Y');assert.ok(g.quaternion.angleTo(new THREE.Quaternion())<1e-8);
}
assert.throws(()=>validateDraft({...newDraft(),modelUpAxis:'bad'}),/up axis/);
console.log('PASS all six up axes, non-cumulative correction and saved draft validation');
