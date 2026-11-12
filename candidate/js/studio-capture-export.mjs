import {capturePosesForGroup,captureGroupPath} from './action-capture-groups.mjs?v=R238C196';

// Current manifests retain the runtime contract. Outdated snapshots get their
// own manifest/frame so different historical resolutions are never mixed.
export function planCaptureExport(groups){
  const current=[],recovery=[];
  for(const [id,poses] of Object.entries(groups)){
    const fresh={};
    for(const [pose,capture] of Object.entries(poses)){
      if(!capturePosesForGroup(id).includes(pose))throw Error(`Unknown capture slot: ${id}/${pose}`);
      if(capture.stale)recovery.push({id,pose,capture,path:`recovery/${id}/${pose}`});
      else fresh[pose]=capture;
    }
    if(Object.keys(fresh).length)current.push({id,captures:fresh,path:captureGroupPath(id)});
  }
  return {current,recovery,poseCount:current.reduce((n,g)=>n+Object.keys(g.captures).length,0)+recovery.length};
}
export function recoveryPoseReference({id,pose,path,manifest}){
  const captured=manifest.poses[pose];
  if(!captured)throw Error('Recovery manifest is missing its pose.');
  return {groupId:id,pose,manifest:`${path}/manifest.json`,status:'outdated',
    reason:captured.outdatedReason||'Earlier Studio settings changed; review this saved snapshot.',
    animation:captured.clip,sourceId:captured.clipSourceId,timeSeconds:captured.time,
    render:structuredClone(captured.render||{}),frame:structuredClone(manifest.frame)};
}
