export const POSE_FALLBACKS=Object.freeze({weaponProfile:'one-handed-swing',falling:'ready',prone:'ready'});
export function poseWithFallback(profiles,shared,profile,pose){
  const group=['cast','casting-windup'].includes(pose)?'magic':['falling','prone'].includes(pose)?'death-prone':profile;
  const assigned=(group==='magic'||group==='death-prone'?shared?.[group]:profiles?.[group])?.[pose];
  if(assigned)return {sample:assigned,groupId:group,pose,fallback:false};
  const fallbackPose=['ready','windup','attack'].includes(pose)?pose:POSE_FALLBACKS[pose];
  const sample=fallbackPose&&profiles?.['one-handed-swing']?.[fallbackPose];
  return sample?{sample,groupId:'one-handed-swing',pose:fallbackPose,fallback:true}:null;
}
