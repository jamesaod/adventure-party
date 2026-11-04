"""Decode the actual GLB images: presence/dimensions alone miss dark color exports.

Requires Pillow. Optional argument selects a different GLB for reproduction.
"""
import io
import json
import struct
import sys
from pathlib import Path
from PIL import Image, ImageStat

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'assets/models/weapons/spears/spear.glb'
payload = path.read_bytes()
length = struct.unpack_from('<I', payload, 12)[0]
gltf = json.loads(payload[20:20 + length])
binary = payload[28 + length:]
material = gltf['materials'][0]

def decode(slot):
    texture = gltf['textures'][slot['index']]
    image = gltf['images'][texture['source']]
    view = gltf['bufferViews'][image['bufferView']]
    start = view.get('byteOffset', 0)
    result = Image.open(io.BytesIO(binary[start:start + view['byteLength']])).convert('RGB')
    assert result.size == (512, 512)
    return result

# Independent reference: source BaseColor.png (4096px), measured before export.
# Downsampling and JPEG compression may differ slightly, not by a gamma curve.
color = decode(material['pbrMetallicRoughness']['baseColorTexture'])
mean = ImageStat.Stat(color).mean
source_mean = [78.3032, 70.7986, 62.9447]
assert all(abs(actual - expected) < 3 for actual, expected in zip(mean, source_mean)), f'Base color must retain source sRGB brightness: {mean}'
assert all(value > 8 for value in ImageStat.Stat(color).stddev), 'Texture detail must survive export'
assert material['pbrMetallicRoughness'].get('baseColorFactor', [1, 1, 1, 1]) == [1, 1, 1, 1]
# Data maps retain linear channel values; applying the color fix to these is wrong.
normal_mean = ImageStat.Stat(decode(material['normalTexture'])).mean
orm_mean = ImageStat.Stat(decode(material['pbrMetallicRoughness']['metallicRoughnessTexture'])).mean
assert all(abs(a - b) < 3 for a, b in zip(normal_mean, [127.21, 126.66, 252.61]))
assert all(abs(a - b) < 3 for a, b in zip(orm_mean, [253.73, 137.18, 102.95]))
assert material['occlusionTexture']['index'] == material['pbrMetallicRoughness']['metallicRoughnessTexture']['index']
print('PASS spear: 512px sRGB base color retains source brightness; linear normal/ORM maps preserved', mean)
