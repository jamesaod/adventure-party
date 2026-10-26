"""Blender --background --factory-startup --python scripts/optimize-equipment-batch.py -- SOURCE_ROOT TEXTURE_ROOT OUTPUT_ROOT [--reference]
OUTPUT_ROOT receives the manifest's repository-relative asset paths.
"""
import bpy,hashlib,json,sys,struct
from pathlib import Path
from mathutils import Vector,Matrix
from io_scene_fbx import import_fbx
root=Path(__file__).resolve().parents[1]
args=sys.argv[sys.argv.index('--')+1:];source,textures,output=[Path(p).resolve() for p in args[:3]];reference='--reference' in args[3:]
for item in json.loads((root/'data/equipment-imports-144.json').read_text(encoding='utf-8'))['items']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    src=source/item['sourceKey']/item['sourceFile'];assert hashlib.sha256(src.read_bytes()).hexdigest()==item['sourceSha256']
    for name,checksum in item.get("sourceDependencies",{}).items():
        assert hashlib.sha256((src.parent/name).read_bytes()).hexdigest()==checksum
    credits=None
    if src.suffix.lower()=='.gltf':
        credits=json.loads(src.read_text(encoding='utf-8'))['asset'].get('extras');bpy.ops.import_scene.gltf(filepath=str(src))
    else:
        # Blender 5.1's FBX presentation-light importer references a removed
        # Cycles cast_shadow property. These lights are excluded from equipment.
        original_light_reader=import_fbx.blen_read_light
        try:
            import_fbx.blen_read_light=lambda *a,**kw:bpy.data.lights.new('Excluded presentation light','POINT')
            bpy.ops.import_scene.fbx(filepath=str(src),use_image_search=False)
        finally:import_fbx.blen_read_light=original_light_reader
    bpy.context.view_layer.update()
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(meshes)==1,item['id']
    mesh=meshes[0];world=mesh.matrix_world.copy();mesh.parent=None;mesh.matrix_world=world
    bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);bpy.context.view_layer.objects.active=mesh
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    mesh.data.calc_loop_triangles();before=len(mesh.data.loop_triangles);assert before==item['sourceTriangles']
    # Proper object transforms keep custom split normals in the same frame.
    rotation={'X':Matrix(((0,1,0),(0,0,1),(1,0,0))), 'Y':Matrix(((1,0,0),(0,0,-1),(0,1,0))), 'Z':Matrix.Identity(3)}[item['sourceAxis']]
    if item['direction']<0:rotation=Matrix(((1,0,0),(0,-1,0),(0,0,-1)))@rotation
    points=[rotation@v.co for v in mesh.data.vertices];minimum=min(p.z for p in points);length=max(p.z for p in points)-minimum
    center=Vector(((max(p.x for p in points)+min(p.x for p in points))/2,(max(p.y for p in points)+min(p.y for p in points))/2,minimum))
    mesh.rotation_mode='XYZ'
    mesh.rotation_euler=rotation.to_euler();mesh.scale=(1/length,)*3;mesh.location=-center/length
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    if not reference and item['ratio']<1:
        decimate=mesh.modifiers.new('Preserve staff silhouette and UVs','DECIMATE');decimate.ratio=item['ratio'];decimate.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=decimate.name)
    mesh.data.calc_loop_triangles();after=len(mesh.data.loop_triangles)
    if not reference:assert after<10000
    mesh.name=item['name'];material=bpy.data.materials.new(item['name']+' PBR');material.use_nodes=True
    nodes,links=material.node_tree.nodes,material.node_tree.links;shader=nodes.get('Principled BSDF')
    def tex(filename,color=False):
        image=bpy.data.images.load(str(textures/item['id']/filename),check_existing=False);image.colorspace_settings.name='sRGB' if color else 'Non-Color';image.pack()
        node=nodes.new('ShaderNodeTexImage');node.image=image;return node.outputs['Color']
    links.new(tex('albedo.png',True),shader.inputs['Base Color'])
    normal=nodes.new('ShaderNodeNormalMap');links.new(tex('normal.png'),normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs['Normal'])
    channels=nodes.new('ShaderNodeSeparateColor');channels.mode='RGB';links.new(tex('metallic-roughness.png'),channels.inputs['Color']);links.new(channels.outputs['Green'],shader.inputs['Roughness']);links.new(channels.outputs['Blue'],shader.inputs['Metallic'])
    mesh.data.materials.clear();mesh.data.materials.append(material)
    path=output/item['file'];path.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_image_format='AUTO',export_texcoords=True)
    if credits:
        data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+size]);binary=data[28+size:]
        gltf['asset']['extras']={**credits,'modifications':'512px PBR textures; normalized orientation and scale; geometry triangle count preserved.'}
        block=json.dumps(gltf,separators=(',',':')).encode();block+=b' '*((-len(block))%4)
        path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(block)+len(binary))+struct.pack('<II',len(block),0x4e4f534a)+block+struct.pack('<II',len(binary),0x004e4942)+binary)
    data=path.read_bytes();meta=dict(id=item['id'],sourceArchive=item['archive'],sourceArchiveSha256=item['archiveSha256'],sourceArchiveBytes=item['archiveBytes'],sourceFile=item['sourceFile'],sourceSha256=item['sourceSha256'],sourceDependencies=item.get('sourceDependencies',{}),sourceTriangles=before,triangles=after,decimateRatio=1 if reference else item['ratio'],bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),textureResolution='source' if reference else 512,primaryAxis=[0,1,0],credits=credits,textureReference=json.loads((textures/item['id']/'texture-reference.json').read_text(encoding='utf-8')))
    path.with_suffix('.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8',newline='\n');print('BATCH_OPTIMIZED',item['id'],before,after,len(data),meta['sha256'],flush=True)
