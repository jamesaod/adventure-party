import bpy,json
from pathlib import Path
root=Path.cwd()
for rel,target in [('assets/models/weapons/battle-axes/battle-axe.glb',1800),('assets/models/weapons/swords/medieval-sword.glb',900)]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(root/rel))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 before=sum(len(o.data.polygons) for o in meshes)
 for o in meshes:
  bpy.context.view_layer.objects.active=o
  o.data.calc_loop_triangles();n=len(o.data.loop_triangles)
  mod=o.modifiers.new('Combat LOD','DECIMATE');mod.ratio=target/max(1,before);mod.use_collapse_triangulate=True
  bpy.ops.object.modifier_apply(modifier=mod.name)
 out=root/rel.replace('.glb','-combat.glb')
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=False)
 after=0
 for o in meshes:o.data.calc_loop_triangles();after+=len(o.data.loop_triangles)
 print('OPTIMIZED',rel,before,after,flush=True)
