import bpy,sys,json,hashlib
from pathlib import Path
source_dir,output=map(Path,sys.argv[sys.argv.index('--')+1:])
source=next(source_dir.glob('*.fbx'))
texture=next(source_dir.glob('*.fbm/Color.png'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(source.resolve()),use_image_search=True)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
assert meshes and rigs,'Expected a skinned character'
actions=list(bpy.data.actions)
assert actions,'Expected the supplied Swagger animation'
if len(actions)==1: actions[0].name='Swagger'
image=bpy.data.images.load(str(texture.resolve()),check_existing=True)
image.colorspace_settings.name='sRGB'
image.pack()
for obj in meshes:
 for material in obj.data.materials:
  if not material: continue
  material.use_nodes=True
  shader=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
  shader.inputs['Alpha'].default_value=1
  for link in list(shader.inputs['Alpha'].links):material.node_tree.links.remove(link)
  shader.inputs['Metallic'].default_value=0
  shader.inputs['Roughness'].default_value=1
  tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
  material.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
for obj in bpy.context.scene.objects: obj.select_set(obj.type in ['MESH','ARMATURE'])
output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output.resolve()),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_yup=True,export_skins=True,export_all_influences=False,export_image_format='AUTO')
for m in meshes:m.data.calc_loop_triangles()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
meta={'id':'hill-giant','sourceArchive':'tripo_convert_ef101189-70bc-4ea0-b111-b839ea4b071d.zip','sourceSha256':sha(source),'sourceTextureSha256':sha(texture),'sha256':sha(output),'bytes':output.stat().st_size,'triangles':sum(len(m.data.loop_triangles) for m in meshes),'bones':sum(len(r.data.bones) for r in rigs),'animations':[{'name':a.name,'frames':list(a.frame_range)} for a in actions],'textureSize':list(image.size),'importer':bpy.app.version_string,'notes':'Supplied rig, weights, geometry and animation retained. Y-up embedded GLB; source Color.png with matte nonmetallic material. No gameplay stats or animation slot assignments.'}
output.with_suffix('.json').write_text(json.dumps(meta,indent=2)+'\n')
print('IMPORT_RESULT '+json.dumps(meta))
