import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {captureHandCalibration,applyHandCalibration} from '../js/mob-workshop-fit-core.mjs';
const base={position:[.01,.02,.03],rotation:[10,20,30],sizePercent:100};
const fitted={position:[.04,.01,.05],rotation:[35,-15,50],sizePercent:100};
const calibration=captureHandCalibration(THREE,base,fitted);
const result=applyHandCalibration(THREE,base,JSON.parse(JSON.stringify(calibration)));
for(let i=0;i<3;i++)assert.ok(Math.abs(result.position[i]-fitted.position[i])<1e-8);
const q=s=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...s.rotation.map(THREE.MathUtils.degToRad),'XYZ'));
assert.ok(q(result).angleTo(q(fitted))<1e-7);
assert.deepEqual(applyHandCalibration(THREE,base,null),base);
assert.equal(result.sizePercent,100);
console.log('Reusable hand fit composition and round-trip passed.');

