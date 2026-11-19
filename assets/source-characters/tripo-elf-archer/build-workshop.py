"""Package CC5's native retargeted exports; no mesh reduction or bone retargeting."""
import bpy, json, math
from mathutils import Matrix
from pathlib import Path
r=Path(__file__).parent
source=r/'cc5-export'
out=r
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(source/'t.fbx'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
base_objects=set(bpy.data.objects)
# Maya FBX bind-space correction verified visually in the workshop.
# Apply +90 degrees X to the mesh object before animation packaging. Zero and 180 degrees failed visual validation.
for obj in base_objects:
 if obj.type=="MESH":obj.matrix_world=Matrix.Rotation(math.pi/2,4,"X")@obj.matrix_world
bpy.context.view_layer.update()
for o in base_objects:
 o.animation_data_clear()
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
report={'motions':[], 'geometry':[], 'method':'CC5 retargeting; direct same-skeleton animation packaging; no decimation'}
for file in sorted(source.glob('t_*_Motion.fbx')):
 before=set(bpy.data.objects)
 bpy.ops.import_scene.fbx(filepath=str(file))
 added=set(bpy.data.objects)-before
 other=next(o for o in added if o.type=='ARMATURE')
 a=other.animation_data.action
 assert set(rig.data.bones.keys())==set(other.data.bones.keys()),file.name
 error=max(max(abs(v) for row in (rig.data.bones[b.name].matrix_local-b.matrix_local) for v in row) for b in other.data.bones)
 # FBX rounding tolerance: 0.01 source units (0.1 mm at 0.01 armature scale).
 assert error<1e-2,(file.name,error)
 label=file.stem[2:-7]
 frames=list(a.frame_range)
 # Motion-only FBXs store some helper-bone transforms as static node defaults,
 # not animation curves. Copying only the action loses those transforms.
 rig.animation_data_clear();rig.animation_data_create()
 baked=bpy.data.actions.new(label);rig.animation_data.action=baked
 for frame in range(round(frames[0]),round(frames[1])+1):
  bpy.context.scene.frame_set(frame)
  basis={p.name:p.matrix_basis.copy() for p in other.pose.bones}
  for p in rig.pose.bones:
   p.matrix_basis=basis[p.name]
   p.keyframe_insert('location',frame=frame)
   p.keyframe_insert('rotation_quaternion',frame=frame)
   p.keyframe_insert('scale',frame=frame)
 baked.use_fake_user=True
 report['motions'].append({'name':label,'frames':frames,'fps':bpy.context.scene.render.fps,'restMatrixError':error})
 for o in added:bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.actions.remove(a)
meta=json.loads((source/'t.json').read_text())['t']['Object']['t']['Meshes']
for obj in base_objects:
 if obj.type!='MESH':continue
 obj.data.calc_loop_triangles()
 report['geometry'].append({'name':obj.name,'triangles':len(obj.data.loop_triangles)})
 for mat in obj.data.materials:
  if not mat or not mat.use_nodes:continue
  spec=meta.get(obj.name,{}).get('Materials',{}).get(mat.name,{})
  bs=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  if not bs:continue
  textures=spec.get('Textures',{})
  # FBX can attach diffuse alpha to opaque clothing. Respect CC's explicit opacity map instead.
  if 'Opacity' not in textures and not any(s in mat.name.lower() for s in ['lash','occlusion','tear']):
   for link in list(bs.inputs['Alpha'].links):mat.node_tree.links.remove(link)
   bs.inputs['Alpha'].default_value=spec.get('Opacity',1)
  for key,socket in [('Roughness','Roughness'),('Metallic','Metallic')]:
   path=source/textures.get(key,{}).get('Texture Path','__none__')
   if path.is_file():
    image=bpy.data.images.load(str(path),check_existing=True);image.colorspace_settings.name='Non-Color'
    n=mat.node_tree.nodes.new('ShaderNodeTexImage');n.image=image
    mat.node_tree.links.new(n.outputs['Color'],bs.inputs[socket])
rig.animation_data_create()
idle=bpy.data.actions.get('01 Idle')
rig.animation_data.action=idle
if idle and len(idle.slots):rig.animation_data.action_slot=idle.slots[0]
bpy.context.scene.frame_set(1)
report['triangles']=sum(g['triangles'] for g in report['geometry'])
(out/'tripo-export-audit.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(r/'Tripo-Validation.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'Tripo-Elf-CC5.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_morph=False,export_anim_slide_to_zero=True)
print('VALIDATION_REPORT',json.dumps(report))







