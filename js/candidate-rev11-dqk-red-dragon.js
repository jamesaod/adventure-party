/*
  Candidate Rev 11 — Dark Queen of Krynn Red Dragon sprite replacement

  The two repository dragon PNGs are strict 4x nearest-neighbor enlargements
  of the original 48x48 DQK CPIC ready/action sprites.

  Preserve the established seven-hex tactical footprint and bottom alignment.
  The DQK source art is square, so use the old pose height as the square render
  size instead of stretching it into the former non-square asset dimensions.
*/
(function(){
  if(typeof UNIT_POSE_DEFINITIONS!=="undefined" && UNIT_POSE_DEFINITIONS["juvenile-red-dragon"]){
    UNIT_POSE_DEFINITIONS["juvenile-red-dragon"].nativeFacing="right";
  }

  dragonPresentationMetrics=function(mob,poseName=activeUnitPoseName(mob) || "stand"){
    const center=unitFootprintScreenCenter(mob);
    const attack=poseName==="attack";
    const size=Math.max(
      1,
      Number(attack ? mob?.dragonAttackRenderHeight : mob?.dragonStandRenderHeight)
      || (attack ? 107 : 104)
    );
    const lateral=Math.max(0,Number(mob?.dragonAnchorOffsetX)||3);
    const vertical=Math.max(0,Number(mob?.dragonAnchorOffsetY)||41);
    const anchor={
      x:center.x+(mob?.facing==="right" ? lateral : -lateral),
      y:center.y+vertical
    };
    return {
      poseName,
      attack,
      center,
      width:size,
      height:size,
      anchor,
      nativeFacing:"right"
    };
  };

  window.AdventurePartyCandidateRev11={
    candidateRevision:11,
    feature:"DQK Red Dragon ready/action sprites — faithful 4x upscale",
    sourceSize:{width:48,height:48},
    assetSize:{width:192,height:192},
    interpolation:"nearest-neighbor",
    tacticalFootprint:"unchanged hex7",
    nativeFacing:"right"
  };
})();
