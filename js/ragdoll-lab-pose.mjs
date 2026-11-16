export const snapshot=nodes=>nodes.map(n=>({p:n.position.clone(),q:n.quaternion.clone()}));
export function applyPose(nodes,pose){for(let i=0;i<nodes.length;i++){if(nodes[i].userData.ragdollDetached)continue;nodes[i].position.copy(pose[i].p);nodes[i].quaternion.copy(pose[i].q);}}
export function blendPose(nodes,a,b,t){for(let i=0;i<nodes.length;i++){if(nodes[i].userData.ragdollDetached)continue;nodes[i].position.lerpVectors(a[i].p,b[i].p,t);nodes[i].quaternion.slerpQuaternions(a[i].q,b[i].q,t);}}
