"""Generate independent Carl acceptance poses with the recovered Rev 108 FBX evaluator.
Run: python scripts/generate-carl-animation-reference.py
Requires numpy/scipy; never writes character or animation source assets.
"""
from pathlib import Path
import json, hashlib
import numpy as np
from tripo_mixamo_bake_core import read_glb, gltf_skeleton, fbx_skeleton
from bake_mixamo_pack_v2 import rig_basis

root=Path(__file__).resolve().parent.parent
catalog=json.loads((root/'data/animation-library-sources.json').read_text())
target=root/'assets/models/dungeon-crawler-carl/v2/dungeon-crawler-carl-v2.glb'
doc,_,raw=read_glb(target)
target_world,parents,names=gltf_skeleton(doc)
lookup=lambda name:names['mixamorig:'+name]
target_basis=rig_basis(target_world,lookup)
roles=['Hips','Spine','Spine1','Spine2','Neck','Head','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase']
reference={'method':'Rev 58 world delta + Rev 108 anatomical basis + Rev 110 stationary hips policy','targetSha256':hashlib.sha256(raw).hexdigest(),'clips':[]}
for entry in catalog['animations']:
    path=root/entry['file']
    records,curves,evaluate=fbx_skeleton(path)
    bind=evaluate(None)
    basis=target_basis*rig_basis(bind,lambda name:name).inv()
    scale=target_world[lookup('Hips')][1][1]/bind['Hips'][1][1]
    clock=np.concatenate([axis[0] for axes in curves.values() for axis in axes.values()])
    start,end=float(clock.min()),float(clock.max())
    frames=[]
    for fraction in [0,.25,.5,.75,1]:
        # Compare authored keys: FBX Euler interpolation and runtime quaternion
        # interpolation intentionally differ between keys.
        sample=float(clock[np.argmin(np.abs(clock-(start+(end-start)*fraction)))])
        pose=evaluate(sample)
        worlds={name:((basis*(pose[name][0]*bind[name][0].inv())*basis.inv())*target_world[lookup(name)][0]).as_quat().round(8).tolist() for name in roles}
        hip=target_world[lookup('Hips')][1].copy()
        hip[1]+=(basis.apply(pose['Hips'][1]-bind['Hips'][1])*scale)[1]
        frames.append({'fraction':fraction,'timeSeconds':sample-start,'worldQuaternions':worlds,'hipsWorldPosition':hip.round(8).tolist()})
    reference['clips'].append({'id':entry['id'],'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'duration':end-start,'frames':frames})
output=root/'scripts/fixtures/carl-uploaded-animation-reference.json'
output.write_text(json.dumps(reference,indent=2)+'\n',encoding='utf-8',newline='\n')
print('Wrote',len(reference['clips']),'motions,',sum(len(clip['frames']) for clip in reference['clips']),'poses, 22 joints/pose:',output.name)
