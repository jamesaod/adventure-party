import assert from 'node:assert/strict';
import {createTransientTarget} from '../js/combat-transient-target.mjs';
let disposed=0,resized=0;const pool=createTransientTarget((w,h,s)=>({w,h,s,setSize(w,h){this.w=w;this.h=h;resized++;},dispose(){disposed++;}}));
const a=pool.get(400,300,4);assert.equal(a.w,416);assert.equal(a.h,320);
pool.get(600,450,4);pool.get(500,550,4);const count=pool.stats().allocations;
// Five differently sized falling crowns, repeated through 120 actor depth slices.
for(let frame=0;frame<5;frame++)for(let slice=0;slice<120;slice++)for(const [w,h] of [[400,300],[600,450],[500,550],[450,320],[560,480]])assert.equal(pool.get(w,h,4),a);
assert.equal(pool.stats().allocations,count);assert.equal(disposed,0);assert.equal(resized,2);assert.equal(pool.stats().entries,1);
const b=pool.get(400,300,2);assert.notEqual(a,b);assert.equal(disposed,1);assert.equal(b.s,2);pool.dispose();assert.equal(disposed,2);assert.equal(pool.stats().bytes,0);
console.log('PASS 3000 sequential tree passes reuse one target; growth, MSAA changes and disposal');
