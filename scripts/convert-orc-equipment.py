import bpy,sys,json,zipfile,hashlib
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]); scratch=root/'work/orc-equipment'
report={}
for kind,archive in [('orc-quiver',root/'assets/source-equipment/orc-quiver/source.zip'),('orc-shield',root/'assets/source-equipment/orc-shield/source.zip')]:
 out=scratch/kind;out.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(archive) as z:
  for member in z.infolist():
   target=(out/member.filename).resolve()
   if not target.is_relative_to(out.resolve()):raise ValueError('Unsafe archive path')
  for member in z.infolist():
   if not member.is_dir():(out/Path(member.filename).name).write_bytes(z.read(member))
 bpy.ops.wm.read_factory_settings(use_empty=True)
 fbx=next(out.rglob('*.fbx'));bpy.ops.import_scene.fbx(filepath=str(fbx))
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
 points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
 lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
 print('SOURCE_BOUNDS',kind,list(lo),list(hi),flush=True)
 # Blender Z up -> glTF Y up. Keep source orientation and normalize height.
 center=(lo+hi)/2;center.z=lo.z; height=hi.z-lo.z
 for o in objects:
  transform=o.matrix_world.copy()
  for v in o.data.vertices:v.co=(transform@v.co-center)/height
  o.matrix_world.identity()
 mat=bpy.data.materials.new(kind);mat.use_nodes=True;n=mat.node_tree.nodes;l=mat.node_tree.links;p=n.get('Principled BSDF')
 base=fbx.with_suffix('.png')
 for suffix,socket in [('', 'Base Color'),('_roughness','Roughness'),('_metallic','Metallic'),('_normal','Normal')]:
  path=fbx.with_name(fbx.stem+suffix+'.png');im=bpy.data.images.load(str(path),check_existing=False)
  im.colorspace_settings.name='sRGB' if not suffix else 'Non-Color'
  im.scale(1024,1024);im.filepath_raw=str(out/(suffix.strip('_') or 'basecolor'))+'.png';im.file_format='PNG';im.save()
  # Reload saved pixels to avoid exporter color conversion surprises.
  im=bpy.data.images.load(im.filepath_raw,check_existing=False);im.colorspace_settings.name='sRGB' if not suffix else 'Non-Color'
  tex=n.new('ShaderNodeTexImage');tex.image=im
  if suffix=='_normal':
   normal=n.new('ShaderNodeNormalMap');l.new(tex.outputs['Color'],normal.inputs['Color']);l.new(normal.outputs['Normal'],p.inputs[socket])
  else:l.new(tex.outputs['Color'],p.inputs[socket])
 triangles=0
 for o in objects:
  o.data.materials.clear();o.data.materials.append(mat);o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
 dest=root/('assets/models/equipment/orc-quiver/orc-quiver.glb' if kind=='orc-quiver' else 'assets/models/shields/shield-orc.glb');dest.parent.mkdir(parents=True,exist_ok=True)
 bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',export_yup=True,export_animations=False)
 points=[v.co for o in objects for v in o.data.vertices]
 mn=[min(p[i] for p in points) for i in range(3)];mx=[max(p[i] for p in points) for i in range(3)]
 report[kind]={'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'triangles':triangles,'textureResolution':1024,'bounds':{'min':[mn[0],mn[2],-mx[1]],'max':[mx[0],mx[2],-mn[1]]},'originalFilename':archive.name,'originalBytes':archive.stat().st_size,'originalSha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
(root/'work/orc-equipment/report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)

