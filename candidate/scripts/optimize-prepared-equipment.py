import bpy,json,gzip
from pathlib import Path
for path in Path('assets/combat-units').glob('*.json.gz'):
 pack=json.loads(gzip.decompress(path.read_bytes()));changed=0
 for g in pack['scene']['geometries']:
  d=g.get('data',{});idx=d.get('index',{}).get('array',[]);n=len(idx)//3
  if n not in (54706,27364):continue
  target=1800 if n==54706 else 900
  a=d['attributes'];pos=a['position']['array'];uv=a['uv']['array']
  mesh=bpy.data.meshes.new('equipment');mesh.from_pydata([pos[i:i+3] for i in range(0,len(pos),3)],[],[idx[i:i+3] for i in range(0,len(idx),3)])
  layer=mesh.uv_layers.new()
  for loop in mesh.loops:layer.data[loop.index].uv=uv[loop.vertex_index*2:loop.vertex_index*2+2]
  obj=bpy.data.objects.new('equipment',mesh);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj
  mod=obj.modifiers.new('LOD','DECIMATE');mod.ratio=target/n;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
  mesh=obj.data;mesh.calc_loop_triangles();p=[];norm=[];tex=[]
  for tri in mesh.loop_triangles:
   for li in tri.loops:
    loop=mesh.loops[li];p.extend(mesh.vertices[loop.vertex_index].co);norm.extend(mesh.corner_normals[li].vector);tex.extend(mesh.uv_layers.active.data[li].uv)
  for name,values in [('position',p),('normal',norm),('uv',tex)]:a[name]['array']=values
  d['index']={'type':'Uint32Array','array':list(range(len(p)//3))};d.pop('boundingSphere',None);d.pop('groups',None)
  bpy.data.objects.remove(obj,do_unlink=True);changed+=1
 if changed:
  pack['equipmentLodVersion']=1
  counts={g['uuid']:len(g.get('data',{}).get('index',{}).get('array',[]))//3 for g in pack['scene']['geometries']}
  def total(o):return counts.get(o.get('geometry'),0)+sum(total(c) for c in o.get('children',[]))
  def collect(o):
   totals[o['uuid']]=total(o)
   for c in o.get('children',[]):collect(c)
  totals={};collect(pack['scene']['object'])
  for frame in pack['frames'].values():frame['triangles']=totals[frame['object']]
  path.write_bytes(gzip.compress(json.dumps(pack,separators=(',',':')).encode(),compresslevel=6))
  print('UPDATED',path.name,changed,flush=True)
