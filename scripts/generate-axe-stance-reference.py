import bpy,json,pathlib,math
from mathutils import Matrix
root=pathlib.Path(__file__).resolve().parent.parent;src=root/'assets/animations/staff/axe-stance-bind-v2.fbx'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(src.resolve()),use_image_search=False)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
convert=Matrix.Rotation(-math.pi/2,4,'X')
roles=['Hips','Spine','Spine1','Spine2','Neck','Head','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase']
name=lambda n:'mixamorig:'+n
# Export source-world neutral and authored poses; this does not use the runtime retargeter.
def record(m):
 q=m.to_quaternion();return {'position':list(m.translation),'quaternion':[q.x,q.y,q.z,q.w]}
bind={n:record(convert@rig.matrix_world@rig.data.bones[name(n)].matrix_local) for n in roles}
frames=[]
for f in [1,47,93,138,184]:
 bpy.context.scene.frame_set(f);bpy.context.view_layer.update()
 frames.append({'timeSeconds':(f-1)/30,'bones':{n:record(convert@rig.matrix_world@rig.pose.bones[name(n)].matrix) for n in roles}})
p=root/'scripts/fixtures/axe-stance-blender-reference.json';p.write_text(json.dumps({'bind':bind,'frames':frames,'fps':30,'duration':6.1},indent=2)+'\n',encoding='utf-8',newline='\n')
print('REFERENCE',p)
