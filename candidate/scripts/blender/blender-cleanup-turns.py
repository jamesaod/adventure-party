import bpy, json, math, numpy as np, collections, hashlib, os
from pathlib import Path
import argparse
ap=argparse.ArgumentParser(description='Selective Orc weight correction and Blender GLB export; QA candidate only')
ap.add_argument('--input', type=Path, required=True)
ap.add_argument('--output-glb', type=Path, required=True)
ap.add_argument('--output-blend', type=Path, required=True)
ap.add_argument('--report', type=Path, required=True)
args=ap.parse_args(__import__('sys').argv[__import__('sys').argv.index('--')+1:] if '--' in __import__('sys').argv else [])
P=args.output_glb.parent
P.mkdir(parents=True,exist_ok=True)
args.output_blend.parent.mkdir(parents=True,exist_ok=True)
args.report.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(args.input))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
mesh=max((o for o in bpy.data.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
actions=list(bpy.data.actions)
print('BLENDER imported',arm.name,len(arm.data.bones),'bones; mesh',mesh.name,len(mesh.data.vertices),'vertices, actions',[(a.name,a.frame_range[:]) for a in actions],flush=True)
assert len(actions)==2, 'Expected both corrected turn animations'

def metrics():
 ed=np.array([e.vertices[:] for e in mesh.data.edges],dtype=int)
 positions=np.array([v.co[:] for v in mesh.data.vertices]);lens=np.linalg.norm(positions[ed[:,0]]-positions[ed[:,1]],axis=1)
 mask=lens>0.00001;ed=ed[mask];lens=lens[mask]
 result=[]
 for action in actions:
  arm.animation_data_create();arm.animation_data.action=action
  for progress in (0,.25,.5,.75,1):
   frame=float(action.frame_range[0]+progress*(action.frame_range[1]-action.frame_range[0]))
   bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));dg=bpy.context.evaluated_depsgraph_get();ev=mesh.evaluated_get(dg);evalmesh=ev.to_mesh();coords=np.array([v.co[:] for v in evalmesh.vertices]);ev.to_mesh_clear()
   ratio=np.linalg.norm(coords[ed[:,0]]-coords[ed[:,1]],axis=1)/lens
   result.append({'clip':action.name,'fraction':progress,'p99':float(np.quantile(ratio,0.99)),'p999':float(np.quantile(ratio,0.999)),'edges_gt_2x':int(np.sum(ratio>2)),'edges_gt_1p5x':int(np.sum(ratio>1.5)),'worst':float(ratio.max())})
 return result

before=metrics()
lookup={g.index:g.name for g in mesh.vertex_groups}
def family(name):
 if any(t in name for t in ('UpLeg','Toe','Foot')) or ('Leg' in name and not ('Arm' in name)):return 'leg'
 if any(t in name for t in ('Shoulder','ForeArm','Hand')) or ('Arm' in name):return 'arm'
 return 'torso'
repaired=[]
for vertex in mesh.data.vertices:
 weights={gi.group:gi.weight for gi in vertex.groups}
 sumArm=sum(w for idx,w in weights.items() if family(lookup[idx])=='arm')
 sumLeg=sum(w for idx,w in weights.items() if family(lookup[idx])=='leg')
 if not(sumArm>0.05 and sumLeg>0.05):continue
 # Minimal intervention: the limb with weaker influence is anatomically
 # inconsistent here; retain the dominant influence and any torso binding.
 drop='leg' if sumArm>sumLeg else 'arm'
 discarded=[idx for idx,w in weights.items() if family(lookup[idx])==drop]
 kept={idx:w for idx,w in weights.items() if idx not in discarded}
 total=sum(kept.values())
 if total<0.1:continue
 for idx in discarded:mesh.vertex_groups[idx].remove([vertex.index])
 for idx,w in kept.items():mesh.vertex_groups[idx].add([vertex.index],w/total,'REPLACE')
 repaired.append({'vertex':vertex.index,'removed':drop,'arm_before':round(sumArm,4),'leg_before':round(sumLeg,4)})
mesh.data.update()
after=metrics()
print('WEIGHT_REPAIRS',len(repaired),'removed leg',sum(r['removed']=='leg' for r in repaired),'removed arm',sum(r['removed']=='arm' for r in repaired),flush=True)
for b,a in zip(before,after):
 print('QA',b['clip'],b['fraction'],'p99',round(b['p99'],3),'->',round(a['p99'],3),'edges>2',b['edges_gt_2x'],'->',a['edges_gt_2x'],flush=True)
args.report.write_text(json.dumps({'source':'New+Orc(1).glb','derived':'orc-turn-corrected-blender-qa.glb','version':bpy.app.version_string,'method':'yaw-neutral limb aiming plus coherent pelvis/torso rotation; targeted cross-limb weight cleanup','repaired_vertices':len(repaired),'fixes':repaired,'before':before,'after':after},indent=2))
# Preserve a native authoring workspace with changes and all test animation actions.
bpy.context.scene.frame_set(int(actions[0].frame_range[0]));arm.animation_data.action=actions[0]
bpy.ops.wm.save_as_mainfile(filepath=str(args.output_blend))
# Export a separate QA GLB; pristine original remains untouched.
path=args.output_glb
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_animations=True,export_nla_strips=False,export_frame_range=False)
print('EXPORTED',path,os.path.getsize(path),'sha256',hashlib.sha256(path.read_bytes()).hexdigest(),flush=True)