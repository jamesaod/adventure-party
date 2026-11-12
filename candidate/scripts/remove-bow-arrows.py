"""Extract the bow losslessly from this source GLB; preserve binary buffers exactly."""
import argparse,copy,hashlib,json,struct
from pathlib import Path

def extract(source,output,keep_scene=False):
 payload=source.read_bytes();assert hashlib.sha256(payload).hexdigest()=='5869d8baf20cf1860b0418cd403a5d7d18346eb6a00f898f0122e60e37abefac', 'Unexpected source bow GLB';size=struct.unpack_from('<I',payload,12)[0]
 gltf=json.loads(payload[20:20+size]);binary=payload[28+size:]
 assert gltf['nodes'][1]['name']=='recurve bow' and gltf['nodes'][1]['mesh']==0
 assert [gltf['nodes'][i]['name'] for i in [3,5]]==['Circle.002','Circle.001']
 keep_nodes=[0,1,2,4] if keep_scene else [1]
 result=copy.deepcopy(gltf)
 def remap(key,ids):
  ids=sorted(set(ids));mapping={old:new for new,old in enumerate(ids)}
  result[key]=[copy.deepcopy(gltf[key][i]) for i in ids]
  return mapping
 node_map=remap('nodes',keep_nodes)
 result['scenes']=[{'name':'Bow without arrows','nodes':list(range(len(keep_nodes)))}];result['scene']=0
 mesh_map=remap('meshes',[n['mesh'] for n in result['nodes'] if 'mesh' in n])
 for node in result['nodes']:
  if 'mesh' in node:node['mesh']=mesh_map[node['mesh']]
 primitives=[p for m in result['meshes'] for p in m['primitives']]
 material_map=remap('materials',[p['material'] for p in primitives])
 for p in primitives:p['material']=material_map[p['material']]
 def texture_slots(material):
  pbr=material.get('pbrMetallicRoughness',{})
  for name in ['baseColorTexture','metallicRoughnessTexture']:
   if name in pbr:yield pbr[name]
  for name in ['normalTexture','occlusionTexture','emissiveTexture']:
   if name in material:yield material[name]
 slots=[t for m in result['materials'] for t in texture_slots(m)]
 texture_map=remap('textures',[t['index'] for t in slots])
 for t in slots:t['index']=texture_map[t['index']]
 image_map=remap('images',[t['source'] for t in result['textures']])
 for t in result['textures']:t['source']=image_map[t['source']]
 accessor_ids=[]
 for p in primitives:
  accessor_ids.extend(p['attributes'].values());accessor_ids.append(p['indices'])
  for target in p.get('targets',[]):accessor_ids.extend(target.values())
 result['animations']=copy.deepcopy(gltf.get('animations',[])) if keep_scene else []
 for animation in result['animations']:
  for channel in animation['channels']:channel['target']['node']=node_map[channel['target']['node']]
  for sampler in animation['samplers']:accessor_ids.extend([sampler['input'],sampler['output']])
 if not result['animations']:del result['animations']
 accessor_map=remap('accessors',accessor_ids)
 for p in primitives:
  p['attributes']={k:accessor_map[v] for k,v in p['attributes'].items()};p['indices']=accessor_map[p['indices']]
  for target in p.get('targets',[]):
   for k in target:target[k]=accessor_map[target[k]]
 for animation in result.get('animations',[]):
  for sampler in animation['samplers']:
   for k in ['input','output']:sampler[k]=accessor_map[sampler[k]]
 view_ids=[a['bufferView'] for a in result['accessors']]+[i['bufferView'] for i in result['images']]
 view_map=remap('bufferViews',view_ids)
 for a in result['accessors']:a['bufferView']=view_map[a['bufferView']]
 for i in result['images']:i['bufferView']=view_map[i['bufferView']]
 new_binary=bytearray()
 for old,new in view_map.items():
  original=gltf['bufferViews'][old];view=result['bufferViews'][new]
  start=original.get('byteOffset',0);data=binary[start:start+original['byteLength']]
  new_binary.extend(b'\0'*((-len(new_binary))%4));view['byteOffset']=len(new_binary);view['buffer']=0
  new_binary.extend(data)
 new_binary.extend(b'\0'*((-len(new_binary))%4))
 result['buffers']=[{'byteLength':len(new_binary)}]
 # Assert byte-identical bow geometry, UVs, morph deltas and embedded textures.
 for old,new in view_map.items():
  a=gltf['bufferViews'][old];b=result['bufferViews'][new]
  assert binary[a.get('byteOffset',0):a.get('byteOffset',0)+a['byteLength']]==new_binary[b['byteOffset']:b['byteOffset']+b['byteLength']]
 encoded=json.dumps(result,separators=(',',':'),ensure_ascii=False).encode();encoded+=b' '*((-len(encoded))%4)
 out=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(new_binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(new_binary),0x004e4942)+new_binary
 output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(out)
 print(json.dumps({'output':str(output),'bytes':len(out),'sha256':hashlib.sha256(out).hexdigest(),'meshes':len(result['meshes']),'images':len(result['images']),'bowTriangles':sum(result['accessors'][p['indices']]['count']//3 for p in result['meshes'][0]['primitives']),'morphs':result['meshes'][0].get('extras'),'preservedBinaryViews':len(view_map)}))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);parser.add_argument('output',type=Path);parser.add_argument('--keep-scene',action='store_true');a=parser.parse_args();extract(a.source,a.output,a.keep_scene)
