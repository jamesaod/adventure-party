"""Blender --background --factory-startup --python scripts/optimize-crossbow.py -- SOURCE_DIR PREPARED_TEXTURE_DIR OUTPUT.glb
The optional fourth argument 'reference' retains original geometry for visual QA.
"""
import bpy, hashlib, json, sys, math
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
source, texture_dir, output = [Path(p).resolve() for p in args[:3]]
reference = len(args)>3 and args[3]=='reference'
fbx=source/'source/crossbow.FBX'
assert hashlib.sha256(fbx.read_bytes()).hexdigest()=='9df0fe0254720f5dfb227f2a8c5f0ca8fec24a0fa966d06368feba086388b4b0', 'Unexpected source crossbow'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(fbx))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert {o.name for o in meshes}=={'Crossbow','rope','Object001','Rope-Metal'}
material=bpy.data.materials.new('Crossbow PBR 512');material.use_nodes=True
nodes,links=material.node_tree.nodes,material.node_tree.links
shader=nodes.get('Principled BSDF')
def texture(filename,color=False):
    image=bpy.data.images.load(str(texture_dir/filename),check_existing=False)
    image.colorspace_settings.name='sRGB' if color else 'Non-Color'
    image.pack()
    node=nodes.new('ShaderNodeTexImage');node.image=image
    return node.outputs['Color']
links.new(texture('crossbow-albedo.png',True),shader.inputs['Base Color'])
normal=nodes.new('ShaderNodeNormalMap');links.new(texture('crossbow-normal.png'),normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs['Normal'])
channels=nodes.new('ShaderNodeSeparateColor');channels.mode='RGB'
links.new(texture('crossbow-metallic-roughness.png'),channels.inputs['Color'])
links.new(channels.outputs['Green'],shader.inputs['Roughness']);links.new(channels.outputs['Blue'],shader.inputs['Metallic'])
# Source +X is forward. Normalize length and export glTF +Z forward, +Y up.
points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
minimum=min(p.x for p in points);length=max(p.x for p in points)-minimum
records=[]
for mesh in meshes:
    bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);bpy.context.view_layer.objects.active=mesh
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # Apply a proper object transform so custom split normals rotate with the mesh.
    mesh.rotation_euler.z=-math.pi/2
    mesh.scale=(1/length,)*3
    mesh.location=(0,minimum/length,0)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    mesh.data.calc_loop_triangles();before=len(mesh.data.loop_triangles)
    ratio={'Crossbow':0.45,'rope':0.25}.get(mesh.name,1)
    if not reference and ratio<1:
        modifier=mesh.modifiers.new('Preserve silhouette and UVs','DECIMATE')
        modifier.ratio=ratio;modifier.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    mesh.data.calc_loop_triangles()
    records.append(dict(name=mesh.name,sourceTriangles=before,triangles=len(mesh.data.loop_triangles),ratio=1 if reference else ratio))
    mesh.data.materials.clear();mesh.data.materials.append(material)
bpy.ops.object.select_all(action='DESELECT')
for mesh in meshes:mesh.select_set(True)
output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_image_format='AUTO',export_texcoords=True)
payload=output.read_bytes()
metadata=dict(sourceFbxSha256=hashlib.sha256(fbx.read_bytes()).hexdigest(),sourceArchiveSha256='82433296c046f554dac864529740f2a18b1f1e567da584a3af55f6779bfe3838',sourceArchiveBytes=48483986,sourceTriangles=sum(r['sourceTriangles'] for r in records),triangles=sum(r['triangles'] for r in records),meshes=records,textureResolution=4096 if reference else 512,bytes=len(payload),sha256=hashlib.sha256(payload).hexdigest(),sourceForwardMinimum=minimum,sourceLength=length,primaryAxis=[0,0,1],textureReference=json.loads((texture_dir/'texture-reference.json').read_text(encoding='utf-8')))
output.with_suffix('.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8',newline='\n')
print('CROSSBOW_OPTIMIZED',json.dumps({k:v for k,v in metadata.items() if k!='textureReference'}))
