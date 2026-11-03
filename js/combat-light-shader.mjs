// WebGL 2 minimum fragment-uniform budget is 224 vec4s. 32 emitters use
// 128, leaving room for projection/material uniforms on integrated GPUs.
export const MAX_COMBAT_LIGHTS=32;
export const combatLightGLSL=`
 uniform int emitterCount;
 uniform vec4 emitterPosition[32], emitterColor[32], emitterShape[32], emitterBounds[32];
 uniform sampler2D emitterMask;
 uniform vec4 lightWorld; // authored metres per tactical x/y, origin metres
 float emitterVisibility(int i,vec2 world,vec3 normal){
  vec4 bounds=emitterBounds[i];
  // Sample just outside the solid face, avoiding self-shadow on its boundary.
  vec2 p=world+normal.xz/ lightWorld.xy*.025;
  vec2 uv=(p-bounds.xy)/bounds.zw;
  if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 0.;
  vec2 tile=vec2(float(i%8),float(i/8));
  vec2 atlasUv=(tile+clamp(uv,vec2(.00196),vec2(.99804)))/vec2(8.,4.);atlasUv.y=1.-atlasUv.y;return step(.5,texture2D(emitterMask,atlasUv).r);
 }
 void combatLight(vec2 world,vec3 point,vec3 normal,inout vec3 linearBase,out vec3 radiance){
  radiance=vec3(0.);
  for(int i=0;i<32;i++){
   if(i>=emitterCount)break;
   vec4 source=emitterPosition[i],shape=emitterShape[i],color=emitterColor[i];
   if(emitterVisibility(i,world,normal)<.5)continue;
   if(source.w<.5){
    vec3 delta=source.xyz-point;float d=length(delta);
    if(d>=shape.x)continue;
    float alignment=max(0.,dot(delta,normal)/max(.01,d));
    float cutoff=pow(max(0.,1.-pow(d/shape.x,4.)),2.);
    linearBase+=color.rgb*color.a*alignment*cutoff/(3.14159265359*max(.01,pow(d,shape.y)));
   }else{
    vec2 axial=vec2(world.x/64.-world.y/63.,world.y/31.5)-source.xy;
    float d=max(max(abs(axial.x),abs(axial.y)),abs(axial.x+axial.y));
    if(d>shape.x)continue;
    radiance+=color.rgb*color.a*.18*(1.-pow(clamp(d/(shape.x+.45),0.,1.),2.));
   }
  }
 }
`;
export function linearLightColor(hex){
 return [16,8,0].map(shift=>{const c=(hex>>shift&255)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
}
export function packCombatLights(lights){
 if(lights.length>MAX_COMBAT_LIGHTS)throw new RangeError('Combat light batch exceeds the compatibility limit');
 const position=new Float32Array(128),color=new Float32Array(128),shape=new Float32Array(128),bounds=new Float32Array(128);
 lights.forEach((l,i)=>{
  const spell=l.kind==='spell';
  position.set(spell?[l.x,l.y,0,1]:[l.x,l.y,l.z,0],i*4);
  color.set([...(spell?l.color.map(v=>v/255):linearLightColor(l.color)),l.intensity],i*4);
  shape.set([l.range,l.decay||1,0,0],i*4);bounds.set(l.bounds,i*4);
 });
 return {position,color,shape,bounds};
}
