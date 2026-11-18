// Shared underwater receiver remapping for tree masks and projected unit masks.
// Existing terrain renders basin depth at 10 screen-world pixels per metre.
export const STREAM_SHADOW_GLSL=`
uniform bool bedShadowEnabled;uniform sampler2D bedShadowMap;uniform vec4 bedShadowBounds,bedShadowLight;
uniform mat3 bedShadowInverse,bedShadowView;uniform vec2 bedShadowScale;
vec2 bedChannel(vec2 world){vec2 uv=(world/vec2(42.666666667,24.248704)-bedShadowBounds.xy)/bedShadowBounds.zw;if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return vec2(0.);return texture2D(bedShadowMap,uv).rg;}
vec3 bedShadowReceiver(vec2 base){
 if(!bedShadowEnabled)return vec3(base,1.);
 vec2 channel=bedChannel(base);if(channel.y<=.001)return vec3(base,1.);
 vec2 bed=base;
 // Fixed small inverse-projection solve; no per-frame CPU terrain sampling.
 for(int i=0;i<3;i++){bed=base+(bedShadowInverse*vec3(0.,-channel.x*10.,0.)).xy;channel=bedChannel(bed);}
 float wet=smoothstep(.001,.015,channel.y);if(wet<=0.)return vec3(base,1.);
 vec2 physical=bed/bedShadowScale;vec2 slope;
 if(bedShadowLight.w<.5){slope=bedShadowLight.xz/max(.001,bedShadowLight.y);slope*=min(1.,6./max(.001,length(slope)));}
 else slope=(bedShadowLight.xz-physical)/max(.05,bedShadowLight.y+channel.x);
 vec2 planePoint=bed+slope*channel.x*bedShadowScale;
 return vec3(mix(base,planePoint,wet),mix(1.,exp(-2.6*channel.y),wet));
}
vec2 bedShadowUv(vec2 base,vec2 uv,vec2 shifted){
 vec2 dx=dFdx(base),dy=dFdy(base),delta=shifted-base;float det=dx.x*dy.y-dx.y*dy.x;
 if(abs(det)<.000001)return uv;
 return uv+dFdx(uv)*(delta.x*dy.y-delta.y*dy.x)/det+dFdy(uv)*(dx.x*delta.y-dx.y*delta.x)/det;
}
`;
export function streamShadowUniforms(THREE){return {bedShadowEnabled:{value:false},bedShadowMap:{value:null},bedShadowBounds:{value:new THREE.Vector4()},bedShadowLight:{value:new THREE.Vector4()},bedShadowInverse:{value:new THREE.Matrix3()},bedShadowView:{value:new THREE.Matrix3()},bedShadowScale:{value:new THREE.Vector2(128/3,128/3*.568329)}};}
export function updateStreamShadowUniforms(u,field,view,light,scale=[128/3,1,128/3*.568329]){u.bedShadowEnabled.value=!!field?.enabled;if(!field?.enabled)return;u.bedShadowMap.value=field.map;u.bedShadowBounds.value.fromArray(field.bounds);u.bedShadowLight.value.fromArray(light);u.bedShadowScale.value.set(scale[0],scale[2]);const [a,b,c,d,x,y]=view.matrix;u.bedShadowView.value.set(a,c,x,b,d,y,0,0,1);u.bedShadowInverse.value.copy(u.bedShadowView.value).invert();}
