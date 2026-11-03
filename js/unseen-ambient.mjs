export const UNSEEN_AMBIENT_SCALE=.25;
export const effectiveAmbientSetting=(setting,visible)=>setting*(visible?1:UNSEEN_AMBIENT_SCALE);
export function ambientForVisibility(profile,visible){return visible?profile:{...profile,intensity:effectiveAmbientSetting(profile.intensity,false)};}
