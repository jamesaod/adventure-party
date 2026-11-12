// Shared granular coverage: two subpixel samples smooth snow boundaries without
// extra render targets or geometry. Both surfaces consume the same snow amount.
export const SNOW_COVERAGE_GLSL = `
float accumulationGrain(vec3 p){return fract(sin(dot(floor(p),vec3(12.9898,78.233,37.719)))*43758.5453);}
float accumulationSample(vec3 p,float amount){
 if(amount>=1.)return 1.;
 return smoothstep(0.,.08,amount)*(1.-smoothstep(amount-.15,amount+.15,accumulationGrain(p)));
}
float accumulationCoverage(vec3 p,float amount){
 vec3 offset=(dFdx(p)+dFdy(p))*.25;
 return .5*(accumulationSample(p-offset,amount)+accumulationSample(p+offset,amount));
}`;
