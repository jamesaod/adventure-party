import json,struct,hashlib,io
from pathlib import Path
from PIL import Image,ImageStat
root=Path(__file__).resolve().parents[1]
for item in json.loads((root/'data/equipment-imports-196.json').read_text(encoding='utf8'))['items']:
 p=root/item['file'];meta=json.loads(p.with_suffix('.json').read_text(encoding='utf8'));raw=p.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);binary=raw[28+n:]
 assert len(raw)==meta['bytes'] and hashlib.sha256(raw).hexdigest()==meta['sha256']
 count=sum(doc['accessors'][prim['indices']]['count']//3 for mesh in doc['meshes'] for prim in mesh['primitives']);assert 0<count<5000 and count==meta['triangles']
 for image in doc['images']:
  v=doc['bufferViews'][image['bufferView']];im=Image.open(io.BytesIO(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]));assert im.size==(256,256)
 for mat in doc['materials']:
  pb=mat['pbrMetallicRoughness'];index=doc['textures'][pb['baseColorTexture']['index']]['source'];v=doc['bufferViews'][doc['images'][index]['bufferView']];im=Image.open(io.BytesIO(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB');means=ImageStat.Stat(im).mean
  assert max(abs(a-b) for a,b in zip(means,meta['textureReference']['albedo']['outputMean']))<1,'Albedo color shifted: '+item['id']
 for mesh in doc['meshes']:
  for prim in mesh['primitives']:assert 'TEXCOORD_0' in prim['attributes'] and 'NORMAL' in prim['attributes']
 print(item['name'],count,'triangles,',len(raw),'bytes, 256px maps, source colors retained')
