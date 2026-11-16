import * as THREE from '../assets/vendor/three/three.module.min.js';
export function ambientContactShare(ambient,sun,local=0){
 ambient=Math.max(0,ambient);return ambient/Math.max(.0001,ambient+Math.max(0,sun)+Math.max(0,local));
}
// Reprofile the retained shared shelter field after its normal configuration.
// Every existing CPU/GPU snow consumer keeps the SAME texture and revision.
// Original exposure .24 is approximately 40% of canopy radius.
export function featherTrunkShelter(data){
 for(let i=0;i<data.length;i++){const t=Math.max(0,Math.min(1,(data[i]/255-.24)/.76));data[i]=Math.round(255*t*t*(3-2*t));}
}
export function contactUniforms(){return {
 ambientContact:{value:false},contactReceiver:{value:null},contactBounds:{value:new THREE.Vector4()},contactScale:{value:new THREE.Vector2(1,1)},contactSolar:{value:new THREE.Vector2()},contactFillCount:{value:0},contactFillPosition:{value:new Float32Array(128)},contactFillRange:{value:new Float32Array(32)}
};}
export function updateContactUniforms(u,state,scale,texture){
 const {receiver,lighting}=state||{};u.ambientContact.value=!!receiver;
 if(!receiver)return;
 u.contactReceiver.value=texture(receiver.image);u.contactBounds.value.fromArray(receiver.bounds);
 u.contactScale.value.set(scale[0],scale[2]);u.contactSolar.value.set(lighting?.solar?.daylight||0,lighting?.solar?.sky??1);
 const sources=lighting?.sources||[];u.contactFillCount.value=Math.min(32,sources.length);
 for(let i=0;i<u.contactFillCount.value;i++){const l=sources[i];u.contactFillPosition.value.set([...l.vector.slice(0,3),l.power],i*4);u.contactFillRange.value[i]=l.range;}
}
export const CONTACT_GLSL=`
uniform bool ambientContact;uniform sampler2D contactReceiver;uniform vec4 contactBounds;
uniform vec2 contactScale,contactSolar;uniform int contactFillCount;
uniform vec4 contactFillPosition[32];uniform float contactFillRange[32];
float firAmbientShare(vec2 world){
 vec2 point=world/contactScale,uv=(point-contactBounds.xy)/contactBounds.zw;
 if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 0.;
 vec4 receiver=texture2D(contactReceiver,vec2(uv.x,1.-uv.y));if(receiver.a<.5)return 0.;
 float outdoor=step(.5,receiver.r),ambient=receiver.g*20.*mix(1.,contactSolar.y,outdoor);
 float total=ambient+12.*contactSolar.x*outdoor;
 for(int i=0;i<32;i++){if(i>=contactFillCount)break;float falloff=max(0.,1.-length(point-contactFillPosition[i].xz)/max(.01,contactFillRange[i]));total+=contactFillPosition[i].w*falloff*falloff;}
 return ambient/max(.0001,total);
}`;
