import bpy,os,glob,json,hashlib
from mathutils import Vector
root=os.path.dirname(os.path.abspath(__file__));records=[]
for i in range(1,6):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 fbx=glob.glob(root+'/source/'+str(i)+'/**/*.fbx',recursive=True)[0];bpy.ops.import_scene.fbx(filepath=fbx)
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];pts=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box];lo=Vector([min(p[j] for p in pts) for j in range(3)]);hi=Vector([max(p[j] for p in pts) for j in range(3)]);extent=max(hi-lo);center=Vector(((hi.x+lo.x)/2,(hi.y+lo.y)/2,lo.z))
 for o in meshes:
  mat=bpy.data.materials.new('Mossy stone');mat.use_nodes=True;nodes=mat.node_tree.nodes;bs=nodes.get('Principled BSDF');bs.inputs['Metallic'].default_value=0
  for suffix,socket in [('', 'Base Color'),('_roughness','Roughness'),('_normal','Normal')]:
   path=fbx[:-4]+suffix+'.png'
   if not os.path.exists(path):continue
   im=bpy.data.images.load(path,check_existing=False)
   if suffix:im.colorspace_settings.name='Non-Color'
   im.scale(1024,1024);tex=nodes.new('ShaderNodeTexImage');tex.image=im
   if suffix=='_normal':
    n=nodes.new('ShaderNodeNormalMap');mat.node_tree.links.new(tex.outputs['Color'],n.inputs['Color']);mat.node_tree.links.new(n.outputs['Normal'],bs.inputs[socket])
   else:mat.node_tree.links.new(tex.outputs['Color'],bs.inputs[socket])
  o.data.materials.clear();o.data.materials.append(mat)
  for v in o.data.vertices:v.co=(o.matrix_world@v.co-center)/extent
  o.matrix_world.identity()
 out=root+'/out/mossy-boulder-'+str(i)+'.glb';bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_animations=False)
 records.append({'id':'mossy-boulder-'+str(i),'file':'assets/models/terrain/boulders/mossy-boulder-'+str(i)+'.glb','triangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),'dimensionsMetres':[(hi.x-lo.x)/extent,(hi.z-lo.z)/extent,(hi.y-lo.y)/extent],'source':os.path.basename(fbx),'textureSize':1024,'bytes':os.path.getsize(out),'sha256':hashlib.sha256(open(out,'rb').read()).hexdigest()})
 for im in list(bpy.data.images):
  if im.name!='Render Result':bpy.data.images.remove(im)
json.dump(records,open(root+'/out/manifest.json','w'),indent=2)
print('BOULDERS',json.dumps(records))
