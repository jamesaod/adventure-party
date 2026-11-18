import bpy,bmesh,json,hashlib,shutil
from pathlib import Path
from mathutils import Vector
src=Path(__file__).parent
repo=Path('C:/Users/james/Documents/Codex/2026-10-26/continue-development-of-adventure-party-using/work/repo')
scale=43.38933076913966*.18*(240/210)/(64/3.048)
specs=[(5,'WhiteOak','white-oak','White Oak'),(11,'SugarMaple','sugar-maple','Sugar Maple'),(17,'SugarMaple','sugar-maple','Tall Sugar Maple'),(23,'SugarMaple','sugar-maple','Broad Sugar Maple'),(29,'AmericanBeech','american-beech','American Beech'),(35,'SweetBirch','sweet-birch','Sweet Birch')]
records=[]
for index,prefix,family,label in specs:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    name=f'{prefix}_Individual{index:02}_Club'
    folder=src/'individuals'/f'tree-{index:02}'
    folder.mkdir(parents=True,exist_ok=True)
    shutil.copy2(src/(name+'.obj'),folder/(name+'.obj'))
    mtl=(src/(name+'.mtl')).read_text()
    for line in mtl.splitlines():
        if line.startswith(('map_Kd ','map_bump ','bump ')):
            fn=line.split(' ',1)[1].replace(' -bm 1','')
            texture=src/fn
            if fn.startswith('Maple_Bark_1_'):
                texture=repo/'assets'/'terrain'/family/fn
                if not texture.exists(): texture=src.parent/family/fn
            shutil.copy2(texture,folder/fn)
    (folder/(name+'.mtl')).write_text(mtl)
    bpy.ops.wm.obj_import(filepath=str(folder/(name+'.obj')),forward_axis='Y',up_axis='Z')
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for o in objects:
        for v in o.data.vertices:v.co=o.matrix_world@v.co
        o.matrix_world.identity()
    points=[v.co.copy() for o in objects for v in o.data.vertices]
    bottom=1.2 if index==5 else 1.0
    top=max(v.z for v in points)*.85
    cap=bpy.data.materials.new('Exposed trunk end grain');cap.diffuse_color=(.22,.16,.095,1)
    for o in objects:
        o.data.materials.append(cap)
        bm=bmesh.new();bm.from_mesh(o.data)
        for height,normal in [(bottom,(0,0,-1)),(top,(0,0,1))]:
            geom=list(bm.verts)+list(bm.edges)+list(bm.faces)
            bmesh.ops.bisect_plane(bm,geom=geom,dist=1e-6,plane_co=(0,0,height),plane_no=normal,clear_outer=True,clear_inner=False)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5)
        rims=[e for e in bm.edges if e.is_boundary]
        if rims:
            for f in bmesh.ops.holes_fill(bm,edges=rims,sides=0)['faces']:
                f.material_index=len(o.data.materials)-1
        bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    points=[v.co.copy() for o in objects for v in o.data.vertices]
    grip_z=top-(top-bottom)*.10
    band=[v for v in points if abs(v.z-grip_z)<(top-bottom)*.06]
    if not band: band=sorted(points,key=lambda v:abs(v.z-grip_z))[:12]
    grip=Vector(((min(v.x for v in band)+max(v.x for v in band))/2,(min(v.y for v in band)+max(v.y for v in band))/2,grip_z))
    for o in objects:
        for v in o.data.vertices:
            p=(v.co-grip)*scale
            v.co=Vector((p.x,-p.y,-p.z))
        for p in o.data.polygons:p.use_smooth=p.material_index!=len(o.data.materials)-1
    for m in bpy.data.materials:
        if m.use_nodes:
            bs=m.node_tree.nodes.get('Principled BSDF')
            if bs:bs.inputs['Roughness'].default_value=.95
    for im in bpy.data.images:
        if im.filepath.endswith(' -bm 1'):im.filepath=im.filepath[:-6];im.reload()
        if im.size[0]>1024:im.scale(1024,1024)
        if im.source=='FILE':im.pack()
    out=folder/f'tree-{index:02}-club.glb'
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True)
    rec={'id':f'tree-{index:02}-club','tileIndex':index,'name':label+f' Tree {index:02} Club','source':name+'.spm','sourceObjSha256':hashlib.sha256((folder/(name+'.obj')).read_bytes()).hexdigest(),'asset':f'assets/models/weapons/tree-as-club/individuals/tree-{index:02}-club.glb','sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'lengthMetres':(top-bottom)*scale,'sourceToCombatScale':scale,'cutBottomSourceMetres':bottom,'cutTopSourceMetres':top,'secondaryGrip':[0,min(.4,(top-bottom)*scale*.2),0],'triangles':sum(len(o.data.polygons) for o in objects)}
    records.append(rec)
(src/'individual-clubs.json').write_text(json.dumps(records,indent=2))
print(json.dumps(records,indent=2))
