import assert from 'node:assert/strict';
import {treeCollision} from '../js/tree-collision.mjs';
import {BROADLEAF_FAMILIES} from '../js/broadleaf-family.mjs?v=sweet-birch1';
for(const f of Object.values(BROADLEAF_FAMILIES))for(let degree=0;degree<360;degree++){const r=treeCollision(f.base,'summer',degree*Math.PI/180);assert.ok(r.capsules.some(c=>c.piece==='continuous-oak-trunk'));for(const c of r.capsules){assert.ok(c.radius>0);for(const k of ['ax','az','bx','bz','radius'])assert.ok(Number.isFinite(c[k]));}}
const angle=4.7472956958882335;assert.doesNotThrow(()=>treeCollision(5,'winter',angle));assert.equal(treeCollision(5,'winter',angle),treeCollision(5,'winter',angle));assert.throws(()=>treeCollision(5,'summer',Infinity));console.log('PASS all 360 tree orientations, reported AI angle, trunk pickup identity and cached results');
