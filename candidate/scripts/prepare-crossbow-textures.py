"""Prepare source crossbow PBR maps without reinterpreting stored color channels.
Usage: python scripts/prepare-crossbow-textures.py EXTRACTED_SOURCE_DIR OUTPUT_DIR
"""
from pathlib import Path
from PIL import Image, ImageStat
import hashlib, json, sys
source, output = map(Path, sys.argv[1:])
output.mkdir(parents=True, exist_ok=True)
records = {}
images = {}
for name in ['albedo', 'normal', 'roughness', 'metallic']:
    path = source / 'textures' / f'crossbow_{name}.png'
    original = Image.open(path).convert('RGB')
    assert original.size == (4096, 4096), (name, original.size)
    resized = original.resize((512, 512), Image.Resampling.LANCZOS)
    before, after = ImageStat.Stat(original).mean, ImageStat.Stat(resized).mean
    assert max(abs(a-b) for a,b in zip(before, after)) < 1, name
    records[name] = dict(sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(), sourceMean=before, resizedMean=after)
    images[name] = resized
images['albedo'].save(output / 'crossbow-albedo.png', optimize=True)
images['normal'].save(output / 'crossbow-normal.png', optimize=True)
# glTF metallic/roughness: roughness in G, metallic in B; no authored AO map.
Image.merge('RGB', (Image.new('L', (512,512), 255), images['roughness'].getchannel('R'), images['metallic'].getchannel('R'))).save(output / 'crossbow-metallic-roughness.png', optimize=True)
(output / 'texture-reference.json').write_text(json.dumps(records, indent=2)+'\n', encoding='utf-8', newline='\n')
print(json.dumps(records, indent=2))
