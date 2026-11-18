import assert from 'node:assert/strict';
import fs from 'node:fs';
const urls=[];
for(const file of fs.readdirSync(new URL('../js/',import.meta.url)).filter(f=>/\.(mjs|js)$/.test(f))){const text=fs.readFileSync(new URL('../js/'+file,import.meta.url),'utf8');for(const m of text.matchAll(/['"](\.\/combat-corpse-snow\.mjs(?:\?[^'"]*)?)['"]/g))urls.push(m[1]);}
assert.equal(urls.length,3);
assert.equal(new Set(urls).size,1,'Corpse snow consumers must share one state instance');
assert.match(urls[0],/\?v=natural-ac1$/,'Refresh cached module after water API addition');
const snow=await import(new URL('../js/'+urls[0].slice(2),import.meta.url));
assert.equal(typeof snow.setCorpseSnowWater,'function');
const amount=snow.registerCorpseSnow({alive:false,x:4,y:5});snow.setCorpseSnowWater(amount,1);snow.advanceCorpseSnow(new Map([['4,5',{}]]),30);assert.equal(amount.value,0);snow.setCorpseSnowWater(amount,0);snow.advanceCorpseSnow(new Map([['4,5',{}]]),30);assert(amount.value>0);snow.resetCorpseSnow(true);
console.log('PASS versioned shared corpse-snow imports, water API and accumulation recovery');
