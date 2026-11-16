import assert from 'node:assert/strict';
import {snowfallParticleRate,SNOW_PARTICLE_LIMIT,SNOW_KICKUP_LIMIT} from '../js/combat-snow-density.mjs';
assert.equal(snowfallParticleRate(0),0);assert.equal(snowfallParticleRate(.2),700);assert.equal(snowfallParticleRate(.5),1750);assert.equal(snowfallParticleRate(1),3500);assert.equal(snowfallParticleRate(1,false),0);assert.equal(snowfallParticleRate(5),3500);assert.equal(snowfallParticleRate(-1),0);assert.equal(SNOW_PARTICLE_LIMIT,4096*5);assert.equal(SNOW_KICKUP_LIMIT,256);
console.log('PASS snowfall slider density, 5x maximum, bounded buffers and hidden-flake exclusion');
