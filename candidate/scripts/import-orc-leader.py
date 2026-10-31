"""Blender --background --factory-startup --python scripts/import-orc-leader.py -- SOURCE_DIRECTORY OUTPUT_GLB
Import the supplied FBX with unchanged topology, weights and world-space bind pose.
"""
import bpy,sys,json,hashlib,struct
from pathlib import Path
from io_scene_fbx import import_fbx
source_dir,output=map(lambda s:Path(s).resolve(),sys.argv[sys.argv.index('--')+1:])
source=source_dir/'tripo_convert_0f898e57-ea78-4732-b917-0b13598f8f8a.fbx'
texture=source_dir/'tripo_convert_0f898e57-ea78-4732-b917-0b13598f8f8a.fbm/Color.png'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(source)=='6be98c41dcba5d9a9b7200a0433bbb79eb68a84a346777074c6adc6eb4033057'
assert sha(texture)=='572bcee73f8860208f8232feb531ece12086d22195de34795cb697a031b8ae27'
bpy.ops.wm.read_factory_settings(use_empty=True)
light_reader=import_fbx.blen_read_light
try:
 import_fbx.blen_read_light=lambda *a,**kw:bpy.data.lights.new('Excluded presentation light','POINT')
 bpy.ops.import_scene.fbx(filepath=str(source),use_image_search=False)
finally:import_fbx.blen_read_light=light_reader
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
assert len(meshes)==1 and len(rigs)==1
mesh,rig=meshes[0],rigs[0];mesh.data.calc_loop_triangles()
assert len(rig.data.bones)==65 and len(mesh.data.loop_triangles)==11451
# Normalize FBX centimetre armature scale for the existing metre-based hand mounts.
# Blender applies this to bone rest data while preserving the world-space bind pose.
bpy.context.view_layer.update()
bind_world={b.name:rig.matrix_world@b.matrix_local for b in rig.data.bones}
mesh_world=mesh.matrix_world.copy()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bpy.context.view_layer.update()
assert max(abs(v) for row in (mesh.matrix_world-mesh_world) for v in row)<1e-5
for bone in rig.data.bones:
 before=bind_world[bone.name];after=rig.matrix_world@bone.matrix_local
 assert (before.translation-after.translation).length<1e-5
 assert before.to_quaternion().rotation_difference(after.to_quaternion()).angle<1e-3
# Use the supplied encoded sRGB PNG. No floating-point image save/resampling.
image=bpy.data.images.load(str(texture),check_existing=False);image.colorspace_settings.name='sRGB';image.pack()
material=bpy.data.materials.new('Orc Leader — Source Color');material.use_nodes=True
shader=material.node_tree.nodes.get('Principled BSDF');shader.inputs['Metallic'].default_value=0;shader.inputs['Roughness'].default_value=1
tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
material.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
mesh.data.materials.clear();mesh.data.materials.append(material)
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_image_format='AUTO',export_skins=True,export_all_influences=True)
raw=output.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);binary=raw[28+length:]
assert len(doc['images'])==1
view=doc['bufferViews'][doc['images'][0]['bufferView']];encoded=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
assert encoded==texture.read_bytes(),'The source PNG must remain byte-exact'
metadata={'id':'orc-leader-male-uniformed','sourceArchive':'orc leader+3d+model.zip','sourceArchiveBytes':11515384,'sourceArchiveSha256':'bbe4360c4070fcaeb0462d8db20694c8df047f06394d951aed99677d44c8203c','sourceFile':source.name,'sourceSha256':sha(source),'sourceTextureSha256':sha(texture),'triangles':len(mesh.data.loop_triangles),'sourceVertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'textureSize':list(image.size),'bytes':len(raw),'sha256':sha(output),'importer':'Blender '+bpy.app.version_string,'animationLibrary':'uploaded-fbx','retargetMode':'world-bind-delta','hipTranslation':'scaled-world-y','notes':'Original topology and skin retained; Y-up GLB conversion with armature unit scale normalized for shared hand mounts. Original PNG embedded byte-for-byte. Opaque nonmetallic base-color material; no geometry reduction or recoloring.'}
output.with_suffix('.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8',newline='\n')
print('IMPORTED_MODEL',json.dumps(metadata),flush=True)
