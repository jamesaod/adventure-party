// Rule/clock tests omit camera and audio side effects explicitly. Production
// behavior is exercised by ranged-camera-framing and bow-audio regressions.
export function combatPresentationTestServices(overrides={}){
 return {frameRangedAction:async()=>{},playBowReleaseSound:()=>null,playBowImpactSound(){},stopBowSounds(){},...overrides};
}
