import assert from 'node:assert/strict';
import {corpseWhitening,advanceCorpseSnow,registerCorpseSnow,resetCorpseSnow,meltCorpseSnow} from '../js/combat-corpse-snow.mjs?v=tree-snow-grains1';
for(const [snow,white] of [[0,0],[.25,0],[.5,.25],[.75,.5],[1,.75],[2,.75]])assert.equal(corpseWhitening(snow),white);
resetCorpseSnow(true);const entity={alive:false,x:0,y:0},amount=registerCorpseSnow(entity),ground=new Map([['0,0',{amount:1}]]);
assert.equal(amount.value,0,'Full ground snow must not instantly coat a new corpse');
for(let i=1;i<=4;i++){advanceCorpseSnow(ground,30);assert.equal(amount.value,i);assert.equal(corpseWhitening(amount.value/4),Math.max(0,i/4-.25));}
advanceCorpseSnow(ground,30);assert.equal(amount.value,4);meltCorpseSnow(['0,0'],1);assert.equal(amount.value,0);assert.equal(corpseWhitening(amount.value/4),0);
entity.alive=true;advanceCorpseSnow(ground,30);assert.equal(amount.value,0);resetCorpseSnow(true);
console.log('PASS fresh corpse, four timed layers, independent body whitening, melt and revival cleanup');
