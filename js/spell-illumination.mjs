// Display radiance is additive, independent of ambient visibility percentages.
// Range, falloff and architectural occlusion are supplied by the production resolver.
export function spellSurfaceRadiance(point,sources,contribution){
 const rgb=[0,0,0];
 for(const source of sources){
  if(source.sourceKind==='torch')continue;
  const amount=Math.max(0,contribution(source,point))*.18;if(!amount)continue;
  const color=source.color||[255,244,188];for(let i=0;i<3;i++)rgb[i]+=Math.max(0,Math.min(255,color[i]))/255*amount;
 }
 return rgb;
}
