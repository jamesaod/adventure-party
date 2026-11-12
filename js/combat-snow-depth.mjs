// Physical snow depth shared by terrain, corpses and foot contacts.
export const SNOW_LAYER_METRES=6*.0254;
export const SNOW_MAX_METRES=SNOW_LAYER_METRES*6;
export function snowDepthMetres(coats){
 const blend=x=>{const t=Math.max(0,Math.min(1,(x-.015)/(.34-.015)));return t*t*(3-2*t);};
 return SNOW_LAYER_METRES*(blend(coats[0])+blend(coats[1])+Math.max(0,Math.min(1,coats[2]))+3*Math.max(0,Math.min(1,coats[3]||0)));
}
export const SNOW_DEPTH_GLSL=`
#ifndef COMBAT_SNOW_DEPTH
#define COMBAT_SNOW_DEPTH
// Green stores the outside rim of the combined cut silhouette. Never raise
// an occupied cut, and never create a bank where there is no ground snow.
float snowDeformedHeight(float base,vec2 cutRim){return max(0.,base-cutRim.r*${SNOW_MAX_METRES})+min(base,cutRim.g*${SNOW_MAX_METRES})*.16*(1.-cutRim.r);}
float snowPhysicalDepth(vec3 coats){return ${SNOW_LAYER_METRES}*(smoothstep(.015,.34,coats.r)+smoothstep(.015,.34,coats.g)+clamp(coats.b,0.,1.));}
float snowPhysicalDepth(vec4 coats){return snowPhysicalDepth(coats.rgb)+coats.a*0.4572;}
// A one-texel bevel prevents hard melt masks from becoming needle-like walls.
// Filter physical heights, never the coat coverage thresholds.
float snowSampleDepth(sampler2D coats,vec2 uv){
 vec2 d=1./vec2(textureSize(coats,0));
 return snowPhysicalDepth(texture2D(coats,uv))*.5+
 (snowPhysicalDepth(texture2D(coats,uv+vec2(d.x,0.)))+snowPhysicalDepth(texture2D(coats,uv-vec2(d.x,0.)))+
 snowPhysicalDepth(texture2D(coats,uv+vec2(0.,d.y)))+snowPhysicalDepth(texture2D(coats,uv-vec2(0.,d.y))))*.125;
}
#endif
`;
