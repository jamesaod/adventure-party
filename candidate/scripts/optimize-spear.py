"""Blender --background --factory-startup --python scripts/optimize-spear.py -- SOURCE_DIR OUTPUT.glb"""
import bpy, hashlib, json, sys, tempfile
from pathlib import Path
from mathutils import Vector
source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
source, output = source.resolve(), output.resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(source / 'source/Kopie_tip_1_NEW.fbx'))
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mesh.data.calc_loop_triangles()
before = len(mesh.data.loop_triangles)
# Source Z points to the head. Export turns Blender Z-up into glTF +Y.
lo = min(v.co.z for v in mesh.data.vertices)
length = max(v.co.z for v in mesh.data.vertices) - lo
for v in mesh.data.vertices:
    x, y, z = v.co
    v.co = Vector((x / length, -y / length, (z - lo) / length))
# Source is already low-poly: conservatively remove 20%, preserving UVs.
modifier = mesh.modifiers.new('Conservative 20 percent triangle reduction', 'DECIMATE')
modifier.ratio = 0.8
modifier.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=modifier.name)
mesh.data.calc_loop_triangles()
after = len(mesh.data.loop_triangles)
mesh.name = 'Spear'
material = bpy.data.materials.new('Spear PBR 512')
material.use_nodes = True
nodes, links = material.node_tree.nodes, material.node_tree.links
bsdf = nodes.get('Principled BSDF')
texture_dir = source / 'textures'
def texture(filename, color=False):
    image = bpy.data.images.load(str(texture_dir / filename), check_existing=False)
    image.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    image.scale(512, 512)
    if color:
        # Materialize the resized color image before glTF's image-copy fallback.
        # Blender 5.1 exported this floating-point source as linear JPEG values
        # through that fallback. glTF base color requires sRGB-encoded bytes.
        with tempfile.TemporaryDirectory(prefix='spear-color-') as temporary:
            encoded = Path(temporary) / 'spear-basecolor-srgb.jpg'
            image.filepath_raw = str(encoded)
            image.file_format = 'JPEG'
            image.save(quality=90)
            bpy.data.images.remove(image)
            image = bpy.data.images.load(str(encoded), check_existing=False)
            image.colorspace_settings.name = 'sRGB'
            image.pack()
    else:
        image.pack()
    node = nodes.new('ShaderNodeTexImage')
    node.image = image
    return node.outputs['Color']
prefix = 'Kopie_tip_1_NEW_DefaultMaterial_'
links.new(texture(prefix + 'BaseColor.png', True), bsdf.inputs['Base Color'])
links.new(texture(prefix + 'Roughness.png'), bsdf.inputs['Roughness'])
links.new(texture(prefix + 'Metallic.png'), bsdf.inputs['Metallic'])
normal = nodes.new('ShaderNodeNormalMap')
links.new(texture(prefix + 'Normal.png'), normal.inputs['Color'])
links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
group = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
group.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
ao = nodes.new('ShaderNodeGroup')
ao.node_tree = group
links.new(texture('DefaultMaterial_Mixed_AO.png'), ao.inputs['Occlusion'])
mesh.data.materials.clear()
mesh.data.materials.append(material)
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
    export_animations=False, export_yup=True, export_image_format='JPEG', export_jpeg_quality=90, export_texcoords=True)
payload = output.read_bytes()
metadata = dict(sourceFbxSha256=hashlib.sha256((source / 'source/Kopie_tip_1_NEW.fbx').read_bytes()).hexdigest(),
    sourceTriangles=before, triangles=after, textureResolution=512,
    bytes=len(payload), sha256=hashlib.sha256(payload).hexdigest(), decimateRatio=0.8)
output.with_suffix('.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8', newline='\n')
print('SPEAR_OPTIMIZED', json.dumps(metadata))
