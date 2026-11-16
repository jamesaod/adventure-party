// Visual density only. Ground accumulation and corpse timing are independent.
export const SNOW_PARTICLE_LIMIT=20480;
export const SNOW_KICKUP_LIMIT=256;
export function snowfallParticleRate(intensity,showFlakes=true){return showFlakes?3500*Math.max(0,Math.min(1,Number(intensity)||0)):0;}
