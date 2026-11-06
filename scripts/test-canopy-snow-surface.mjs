import assert from 'node:assert/strict';
import {canopySnowSurface} from '../js/combat-canopy-snow-surface.mjs';
const grid=(levels)=>Array.from({length:9},(_,i)=>levels.map(y=>({x:Math.floor(i/3),y,z:i%3})));
const one=canopySnowSurface(grid([0]),3,1);assert.equal(one.faces.length,8);assert.equal(one.edges.length,8);
const layers=canopySnowSurface(grid([0,10]),3,1);assert.equal(layers.faces.length,16);assert.ok(layers.faces.every(f=>new Set(f.map(i=>layers.vertices[i].y)).size===1),'never bridge separate tiers');
const gap=grid([0]);gap[4]=[];const hole=canopySnowSurface(gap,3,1);assert.ok(hole.faces.length<8,'retain canopy holes');
console.log('PASS connected canopy shelves, tier separation, boundary edges and holes');
