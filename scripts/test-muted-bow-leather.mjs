import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/three.module.min.js';
import {muteBowLeather} from '../js/muted-bow-leather.mjs';
const source=new T.MeshStandardMaterial({color:0xffffff}),mesh=new T.Mesh(new T.BoxGeometry(),source);
muteBowLeather(mesh);assert.notEqual(mesh.material,source);assert(!source.userData.mutedBowLeather);
const material=mesh.material,shader={fragmentShader:'#include <color_fragment>'};material.onBeforeCompile(shader);assert(shader.fragmentShader.includes('leatherRed'));assert(shader.fragmentShader.includes('diffuseColor.rgb=mix'));
muteBowLeather(mesh);assert.equal(mesh.material,material,'Treatment must not accumulate');
mesh.geometry.dispose();source.dispose();material.dispose();console.log('PASS isolated, idempotent muted leather shader');
