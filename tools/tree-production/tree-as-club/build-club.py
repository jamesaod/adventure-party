import bpy, bmesh, numpy as np, json, sys
from pathlib import Path
from mathutils import Vector
src=Path(__file__).parent
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.wm.obj_import(filepath=str(src/'WhiteOak_TreeAsClub.obj'),forward_axis='Y',up_axis='Z')
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
points=np.array([tuple(o.matrix_world@v.co) for o in objects for v in o.data.vertices])
center=points.mean(axis=0)
_,vectors=np.linalg.eigh(np.cov((points-center).T))
axis=vectors[:,-1]
t=(points-center)@axis
rad=np.linalg.norm(points-center-np.outer(t,axis),axis=1)
span=t.max()-t.min()
# Positive axis runs from the narrow handle towards the heavy butt.
if rad[t<t.min()+span*.1].mean()>rad[t>t.max()-span*.1].mean(): axis=-axis
q=Vector(axis).rotation_difference(Vector((0,0,1)))
for o in objects:
    for v in o.data.vertices:v.co=q@(o.matrix_world@v.co-Vector(center))
    o.matrix_world.identity()
points=[v.co for o in objects for v in o.data.vertices]
lo=min(v.z for v in points);hi=max(v.z for v in points)
grip_z=lo+(hi-lo)*.10
band=[v for v in points if abs(v.z-grip_z)<(hi-lo)*.04]
grip=Vector(((min(v.x for v in band)+max(v.x for v in band))/2,(min(v.y for v in band)+max(v.y for v in band))/2,grip_z))
for o in objects:
    for v in o.data.vertices:v.co-=grip
    for p in o.data.polygons:p.use_smooth=True
    bm=bmesh.new();bm.from_mesh(o.data)
    rim=[e for e in bm.edges if e.is_boundary and all(v.co.z<lo-grip_z+(hi-lo)*.08 for v in e.verts)]
    if rim:
        cap=bpy.data.materials.new('Exposed handle end grain');cap.diffuse_color=(.22,.16,.095,1)
        o.data.materials.append(cap)
        for face in bmesh.ops.holes_fill(bm,edges=rim,sides=0)['faces']:
            face.material_index=len(o.data.materials)-1;face.smooth=False
        bmesh.ops.triangulate(bm,faces=list(bm.faces))
        bm.to_mesh(o.data)
    bm.free()
for m in bpy.data.materials:
    if m.use_nodes:
        bs=m.node_tree.nodes.get('Principled BSDF')
        if bs:bs.inputs['Roughness'].default_value=.95
for im in bpy.data.images:
    if im.filepath.endswith(' -bm 1'):
        im.filepath=im.filepath[:-6]
        im.reload()
    if im.size[0]>1024:im.scale(1024,1024)
    if im.source=='FILE':im.pack()
bpy.ops.export_scene.gltf(filepath=str(src/'tree-as-club.glb'),export_format='GLB',export_yup=True,export_extras=True)
info={'sourceLengthMetres':hi-lo,'testScale':.75,'testLengthMetres':(hi-lo)*.75,'grip':[0,0,0],'secondaryGrip':[0,.5,0],'triangles':sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)}
(src/'tree-as-club.json').write_text(json.dumps(info,indent=2))
print(json.dumps(info))
