import {CAPTURE_GROUP_CATALOG,capturePosesForGroup} from './action-capture-groups.mjs?v=R238C196';
import {ACTION_POSE_LABELS} from './action-profile-catalog.mjs?v=R238C196';
export function poseChecklist(library,captures={}){
  const assignments={...library.profiles,...library.sharedActionGroups};
  const ids=new Set(['one-handed-swing','death-prone']);
  for(const [id,poses] of Object.entries(assignments))if(id!=='spell-casting'&&Object.values(poses).some(Boolean))ids.add(id);
  for(const [id,poses] of Object.entries(captures))if(id!=='spell-casting'&&Object.keys(poses).length)ids.add(id);
  return [...ids].flatMap(id=>capturePosesForGroup(id).map(pose=>{
    const sample=assignments[id]?.[pose],capture=captures[id]?.[pose];
    const matches=sample&&capture&&sample.sourceId===capture.clipSourceId&&Math.abs(sample.timeSeconds-capture.time)<.0001;
    const state=capture?(capture.stale||!matches?'outdated':'captured'):'missing';
    return {groupId:id,pose,label:`${CAPTURE_GROUP_CATALOG.get(id).label} — ${ACTION_POSE_LABELS[pose]}`,state,assigned:!!sample};
  }));
}
