"""Blender background --python this.py -- SOURCE TEXTURES OUTPUT [preview directory]."""
import bpy,json,sys,re,hashlib,math
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
from io_scene_fbx import import_fbx
root=Path(__file__).resolve().parents[1];args=sys.argv[sys.argv.index('--')+1:];source,textures,out=map(lambda p:Path(p).resolve(),args[:3]);preview=Path(args[3]).resolve() if len(args)>3 else None
for item in json.loads((root/'data/equipment-imports-196.json').read_text(encoding='utf8'))['items']:
 bpy.ops.wm.read_factory_settings(use_empty=True);src=source/item['sourceKey']/item['sourceFile'];assert hashlib.sha256(src.read_bytes()).hexdigest()==item['sourceSha256']
 if item['id']=='mace':
  # This source is a single static ASCII FBX mesh. Preserve polygon-corner UV indices.
  s=src.read_text(encoding='utf8')
  def arr(k,cast=float):return [cast(v) for v in re.search(r'\b'+k+r':\s*\*\d+\s*\{\s*a:\s*([^}]+)',s).group(1).replace('\n','').split(',') if v.strip()]
  v=arr('Vertices');indices=arr('PolygonVertexIndex',int);faces=[];face=[]
  for i in indices:
   face.append(i if i>=0 else -i-1)
   if i<0:faces.append(face);face=[]
  mesh=bpy.data.meshes.new('Mace');mesh.from_pydata(list(zip(v[::3],v[1::3],v[2::3])),[],faces);o=bpy.data.objects.new('Mace',mesh);bpy.context.collection.objects.link(o)
  uv=arr('UV');ui=arr('UVIndex',int);layer=mesh.uv_layers.new(name='UVMap');assert len(ui)==len(mesh.loops)
  for loop,idx in zip(layer.data,ui):loop.uv=(uv[2*idx],uv[2*idx+1])
 elif src.suffix=='.fbx':
  old=import_fbx.blen_read_light
  try:
   import_fbx.blen_read_light=lambda *a,**kw:bpy.data.lights.new('excluded','POINT');bpy.ops.import_scene.fbx(filepath=str(src),use_image_search=False)
  finally:import_fbx.blen_read_light=old
 else:bpy.ops.import_scene.gltf(filepath=str(src))
 bpy.context.view_layer.update();meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and not(item['id']=='horse-head-staff' and any(m and m.name=='musta' for m in o.data.materials))]
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:
  world=o.matrix_world.copy();o.parent=None;o.matrix_world=world;o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 # The flail handle defines the shaft axis, not its hanging chain/head silhouette.
 axisMesh=next((o for o in meshes if o.name=='pCylinder2'),None) if item['id']=='flail' else None
 points=np.array([tuple(v.co) for o in ([axisMesh] if axisMesh else meshes) for v in o.data.vertices]);center=points.mean(axis=0);_,vec=np.linalg.eigh(np.cov((points-center).T));axis=vec[:,-1]
 if axis[np.argmax(abs(axis))]<0:axis=-axis
 axis*=item['direction'];rot=Vector(axis).rotation_difference(Vector((0,0,1))).to_matrix()
 bpy.ops.object.join();mesh=bpy.context.object
 # Join scan chunks before reduction; preserve the UV layer while welding coincident geometry.
 if item['id']=='horse-head-staff':
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=0.000001);bpy.ops.object.mode_set(mode='OBJECT')
 ps=[rot@v.co for v in mesh.data.vertices];lo=min(v.z for v in ps);length=max(v.z for v in ps)-lo
 # Center on the shaft, rather than the asymmetrical head/chain bounding box.
 shaftCenter=rot@Vector(center);offset=Vector((shaftCenter.x,shaftCenter.y,lo))
 mesh.rotation_mode='XYZ';mesh.rotation_euler=rot.to_euler();mesh.scale=(1/length,)*3;mesh.location=-offset/length;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 mesh.data.calc_loop_triangles();before=len(mesh.data.loop_triangles)
 if before>=5000:
  mod=mesh.modifiers.new('Under 5000 triangles','DECIMATE');mod.ratio=4800/before;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 mesh.data.calc_loop_triangles();after=len(mesh.data.loop_triangles);assert after<5000,(item['id'],after)
 mat=bpy.data.materials.new(item['name']);mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links;shader=nodes.get('Principled BSDF')
 def tex(name,color=False):
  image=bpy.data.images.load(str(textures/item['id']/name),check_existing=False);image.colorspace_settings.name='sRGB' if color else 'Non-Color';image.pack();node=nodes.new('ShaderNodeTexImage');node.image=image;return node.outputs['Color']
 links.new(tex('albedo.png',True),shader.inputs['Base Color']);shader.inputs['Metallic'].default_value=.25
 if (textures/item['id']/'normal.png').exists():
  normal=nodes.new('ShaderNodeNormalMap');links.new(tex('normal.png'),normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs['Normal'])
 channels=nodes.new('ShaderNodeSeparateColor');links.new(tex('metallic-roughness.png'),channels.inputs['Color']);links.new(channels.outputs['Green'],shader.inputs['Roughness'])
 # Scaled metallic map retains variation without black unlit metals in game lighting.
 mult=nodes.new('ShaderNodeMath');mult.operation='MULTIPLY';mult.inputs[1].default_value=.25;links.new(channels.outputs['Blue'],mult.inputs[0]);links.new(mult.outputs[0],shader.inputs['Metallic'])
 mesh.data.materials.clear();mesh.data.materials.append(mat)
 for p in mesh.data.polygons:p.material_index=0
 mesh.name=item['name'];path=out/item['file'];path.parent.mkdir(parents=True,exist_ok=True)
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_image_format='AUTO')
 data=path.read_bytes();meta=dict(id=item['id'],sourceTriangles=before,triangles=after,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),textureResolution=256,sourceAxis=list(map(float,axis)),primaryAxis=[0,1,0],sourceArchive=item['archive'],sourceArchiveSha256=item['archiveSha256'],sourceSha256=item['sourceSha256'],textureReference=json.loads((textures/item['id']/'reference.json').read_text()))
 path.with_suffix('.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf8');print('RESULT',item['id'],before,after,len(data),flush=True)
 if preview:
  preview.mkdir(parents=True,exist_ok=True)
  for o in list(bpy.context.scene.objects):
   if o!=mesh:bpy.data.objects.remove(o,do_unlink=True)
  scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8;scene.render.resolution_x=240;scene.render.resolution_y=360;scene.render.resolution_percentage=100;scene.world=bpy.data.worlds.new('World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.25,.25,1)
  camData=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',camData);scene.collection.objects.link(cam);cam.location=(1.2,-3,.65);cam.rotation_euler=(Vector((0,0,.5))-cam.location).to_track_quat('-Z','Y').to_euler();camData.type='ORTHO';camData.ortho_scale=1.35;scene.camera=cam
  ld=bpy.data.lights.new('Key','AREA');light=bpy.data.objects.new('Key',ld);scene.collection.objects.link(light);light.location=(2,-3,4);ld.energy=300;ld.size=4
  scene.view_settings.view_transform='Standard';scene.render.filepath=str(preview/(item['id']+'.png'));bpy.ops.render.render(write_still=True)
