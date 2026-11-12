"""Validate the approved bow geometry and decoded 512px color textures."""
from pathlib import Path
import hashlib,io,json,struct
from PIL import Image,ImageStat

root=Path(__file__).resolve().parents[1]
path=root/'assets/models/weapons/bows/recurve-bow.glb'
meta=json.loads(path.with_suffix('.json').read_text(encoding='utf-8'))
data=path.read_bytes()
assert struct.unpack_from('<III',data)==(0x46546c67,2,len(data))
assert len(data)==meta['afterBytes']==1237464
assert hashlib.sha256(data).hexdigest()==meta['sha256']
size=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+size]);binary=data[28+size:]
assert len(gltf['nodes'])==len(gltf['meshes'])==1
assert gltf['nodes'][0]['name']=='recurve bow'
assert gltf['scenes'][gltf.get('scene',0)]['nodes']==[0]
assert not gltf.get('animations') and not gltf.get('skins')
assert gltf['meshes'][0]['extras']['targetNames']==['Arms bend','String pull']
primitives=gltf['meshes'][0]['primitives']
assert sum(gltf['accessors'][p['indices']]['count']//3 for p in primitives)==3717
assert all(len(p['targets'])==2 and 'TEXCOORD_0' in p['attributes'] for p in primitives)
assert len(gltf['images'])==len(gltf['materials'])==5

def view_bytes(index):
 view=gltf['bufferViews'][index];start=view.get('byteOffset',0)
 assert start%4==0 and start+view['byteLength']<=len(binary)
 return binary[start:start+view['byteLength']]

image_views={image['bufferView'] for image in gltf['images']}
geometry=b''.join(view_bytes(i) for i in range(len(gltf['bufferViews'])) if i not in image_views)
assert hashlib.sha256(geometry).hexdigest()==meta['geometryBuffersSha256'], 'Positions, UVs, normals, indices and morph deltas must remain unchanged'
for index,image in enumerate(gltf['images']):
 assert image['mimeType']=='image/png'
 decoded=Image.open(io.BytesIO(view_bytes(image['bufferView'])));decoded.load()
 assert decoded.size==(512,512) and decoded.mode=='RGBA'
 before=meta['textures'][index]['beforeMeanRGBA'];after=ImageStat.Stat(decoded).mean
 assert all(abs(a-b)<1 for a,b in zip(before,after)),f'Texture {index} lost source brightness: {before} -> {after}'
 assert decoded.getextrema()[3]==(255,255)
 assert gltf['materials'][index]['pbrMetallicRoughness']['baseColorTexture']['index']==index
print('PASS recurve bow: no arrows/backdrop, 3717 triangles, 2 morphs, preserved geometry, 5 embedded 512px PNGs and source brightness')
