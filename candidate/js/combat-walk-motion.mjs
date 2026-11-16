import {semanticBoneMap} from './humanoid-rig.mjs?v=R238C101';

// Ground the receiving rig, rather than transferring the donor's vertical root
// travel unchanged. The lower foot stays on the same plane; the other may lift.
export function createGroundedWalk(THREE,model,group,clip){
  const bones=semanticBoneMap(model);
  const contacts=['leftFoot','rightFoot','leftToe','rightToe'].map(r=>bones.get(r)).filter(Boolean);
  if(contacts.length<2)throw new Error('Walk test requires mapped foot contacts.');
  group.updateMatrixWorld(true);
  const basePosition=model.position.clone();
  const point=new THREE.Vector3();
  const lowest=()=>Math.min(...contacts.map(b=>b.getWorldPosition(point).y));
  const groundY=lowest();
  const mixer=new THREE.AnimationMixer(model);
  mixer.clipAction(clip).play();
  // Faster test cadence: one left/right cycle per 650 ms hex transition.
  const cycleSeconds=.65;
  return {sample(seconds){
    model.position.copy(basePosition);
    mixer.setTime(((seconds%cycleSeconds)/cycleSeconds)*clip.duration);
    group.updateMatrixWorld(true);
    const delta=groundY-lowest();
    const parent=model.parent;
    const origin=parent.worldToLocal(new THREE.Vector3(0,0,0));
    const offset=parent.worldToLocal(new THREE.Vector3(0,delta,0)).sub(origin);
    model.position.add(offset);
    group.updateMatrixWorld(true);
    return {groundY,lowest:lowest()};
  }};
}
