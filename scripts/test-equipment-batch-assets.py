"""Verify the actual batch GLBs, including color slots and normalized attachment axes."""
from pathlib import Path
import hashlib, io, json, math, struct
from PIL import Image, ImageStat
root=Path(__file__).resolve().parents[1]
# Independent source-image means catch linear/sRGB darkening and swapped PBR slots.
expected={
 'wooden-staff':(7664,956992,[118.986546,68.645033,38.896955],[127.842035,127.072093,248.550040],[255,144.780640,12.877977]),
 'short-sword':(500,751792,[142.488402,136.108681,130.475160],[122.701502,126.011658,245.748488],[255,79.246920,184.487528]),
 'dagger':(960,674868,[124.007340,122.960238,126.297522],[127.481669,127.495756,254.970578],[255,49.313066,153.727697])
}
for item in json.loads((root/'data/equipment-imports-144.json').read_text(encoding='utf-8'))['items']:
 path=root/item['file'];data=path.read_bytes();meta=json.loads(path.with_suffix('.json').read_text(encoding='utf-8'))
 triangles,byte_count,*colors=expected[item['id']]
 assert struct.unpack_from('<III',data)==(0x46546c67,2,len(data))
 assert len(data)==meta['bytes']==byte_count
 assert hashlib.sha256(data).hexdigest()==meta['sha256']
 size=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+size]);binary=data[28+size:]
 assert not gltf.get('skins') and not gltf.get('animations')
 assert len(gltf['meshes'])==len(gltf['materials'])==1
 assert len(gltf['images'])==3 and not any('uri' in entry for entry in gltf['images']+gltf['buffers'])
 assert sum(gltf['accessors'][p['indices']]['count']//3 for mesh in gltf['meshes'] for p in mesh['primitives'])==meta['triangles']==triangles<10000
 assert meta['sourceTriangles']==item['sourceTriangles']
 if item['ratio']==1:assert triangles==item['sourceTriangles']
 else:assert triangles<=item['sourceTriangles']*item['ratio']
 def floats(index):
  accessor=gltf['accessors'][index];view=gltf['bufferViews'][accessor['bufferView']]
  assert accessor['componentType']==5126 and accessor['type']=='VEC3'
  offset=view.get('byteOffset',0)+accessor.get('byteOffset',0);stride=view.get('byteStride',12)
  return [struct.unpack_from('<3f',binary,offset+i*stride) for i in range(accessor['count'])]
 positions=[]
 for primitive in gltf['meshes'][0]['primitives']:
  attributes=primitive['attributes'];assert 'TEXCOORD_0' in attributes
  positions+=floats(attributes['POSITION'])
  assert all(all(math.isfinite(c) for c in n) and abs(sum(c*c for c in n)-1)<1e-3 for n in floats(attributes['NORMAL']))
 assert all(all(math.isfinite(c) for c in p) for p in positions)
 lows=[min(p[i] for p in positions) for i in range(3)];highs=[max(p[i] for p in positions) for i in range(3)]
 # A quaternion-mode import once ignored the Euler rotation: guard actual bytes.
 assert abs(lows[1])<1e-4 and abs(highs[1]-1)<1e-4,(item['id'],lows,highs)
 assert highs[0]-lows[0]<.5 and highs[2]-lows[2]<.5
 assert all(not any(k in n for k in ['matrix','rotation','translation','scale']) for n in gltf['nodes'])
 material=gltf['materials'][0];pbr=material['pbrMetallicRoughness']
 slots=[pbr['baseColorTexture'],material['normalTexture'],pbr['metallicRoughnessTexture']]
 assert len({slot['index'] for slot in slots})==3
 for slot,means in zip(slots,colors):
  image=gltf['images'][gltf['textures'][slot['index']]['source']];view=gltf['bufferViews'][image['bufferView']];start=view.get('byteOffset',0)
  assert image['mimeType']=='image/png' and start+view['byteLength']<=len(binary)
  decoded=Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGB');assert decoded.size==(512,512)
  assert all(abs(a-b)<1 for a,b in zip(ImageStat.Stat(decoded).mean,means)),(item['id'],ImageStat.Stat(decoded).mean,means)
 assert pbr.get('baseColorFactor',[1,1,1,1])==[1,1,1,1]
 assert pbr.get('metallicFactor',1)==(.25 if item['id'] in ['short-sword','dagger'] else 1)
 assert pbr.get('roughnessFactor',1)==1
 if item['id']=='dagger':
  credits=gltf['asset']['extras'];assert 'Mordius' in credits['author'] and 'CC-BY-4.0' in credits['license']
  assert 'modifications' in credits and 'Mordius' in (root/'ATTRIBUTIONS.md').read_text(encoding='utf-8')
  assert (path.parent/'LICENSE-Mordius.txt').is_file()
 print('PASS',item['id'],triangles,'triangles;',byte_count,'bytes; normalized axes, normals, embedded 512px PBR maps and source colors')
