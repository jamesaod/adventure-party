#!/usr/bin/env python3
"""Offline Blender QA stage for Orc turning clips.

Inputs: a GLB with the two yaw-decoupled turn actions (produced by the
anatomical source-retarget/bake stage). Outputs: a NEW GLB and editable .blend.
Never overwrites the original model. Requires Blender 5.2.2 and numpy.
CAUTION: optional weight cleanup is intentionally conservative and still
requires human visual QA.
"""
import argparse, collections, hashlib, json
from pathlib import Path
import bpy

def run():
    p = argparse.ArgumentParser()
    p.add_argument("--source", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--blend", required=True)
    p.add_argument("--report", required=True)
    p.add_argument("--repair-weights", action="store_true")
    args = p.parse_args(__import__('sys').argv[__import__('sys').argv.index('--')+1:] if '--' in __import__('sys').argv else [])
    source, output, blend, report = map(Path, (args.source,args.output,args.blend,args.report))
    if not source.is_file() or source.resolve() == output.resolve():
        raise ValueError("Source GLB must exist and must not be overwritten")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
    armatures = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if len(armatures)!=1 or len(bpy.data.actions)!=2 or not meshes:
        raise RuntimeError("Expected one armature, two turning actions and meshes")
    mesh=max(meshes,key=lambda o:len(o.data.vertices))
    repaired=[]
    if args.repair_weights:
        group_name={g.index:g.name for g in mesh.vertex_groups}
        def family(name):
            if any(v in name for v in ('UpLeg','Toe','Foot')) or ('Leg' in name and 'Arm' not in name):return 'leg'
            if any(v in name for v in ('Shoulder','ForeArm','Hand')) or 'Arm' in name:return 'arm'
            return 'torso'
        neighbors=[set() for _ in mesh.data.vertices]
        for edge in mesh.data.edges:
            a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
        done=set()
        for first in range(len(neighbors)):
            if first in done:continue
            todo=[first];done.add(first)
            for v in todo:
                for n in neighbors[v]:
                    if n not in done:done.add(n);todo.append(n)
            if len(todo)<2:continue
            totals=collections.Counter()
            for vi in todo:
                for g in mesh.data.vertices[vi].groups:
                    totals[family(group_name[g.group])]+=g.weight
            arm,leg=totals['arm'],totals['leg']
            if not (arm/len(todo)>.035 and leg/len(todo)>.035):continue
            if min(arm,leg)/(arm+leg)>.30:continue
            weak='arm' if arm<leg else 'leg'
            for vi in todo:
                weights={v.group:v.weight for v in mesh.data.vertices[vi].groups}
                drop=[index for index in weights if family(group_name[index])==weak]
                keep={index:value for index,value in weights.items() if index not in drop}
                total=sum(keep.values())
                if not drop or sum(weights[i] for i in drop)<.01 or total<.05:continue
                for index in drop:mesh.vertex_groups[index].remove([vi])
                for index,value in keep.items():mesh.vertex_groups[index].add([vi],value/total,'REPLACE')
                repaired.append(vi)
        mesh.data.update()
    for path in (output,blend,report): path.parent.mkdir(parents=True,exist_ok=True)
    bpy.context.scene.frame_set(1)
    armatures[0].animation_data_create()
    armatures[0].animation_data.action=list(bpy.data.actions)[0]
    bpy.ops.wm.save_as_mainfile(filepath=str(blend.resolve()))
    bpy.ops.export_scene.gltf(filepath=str(output.resolve()),export_format='GLB',
        export_animations=True,export_nla_strips=False,export_frame_range=False)
    info={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
          'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
          'blender':bpy.app.version_string,
          'actions':[a.name for a in bpy.data.actions],
          'corrected_vertices':len(repaired),
          'visual_qa':'PENDING: deformation metrics alone do not establish a correct rig'}
    report.write_text(json.dumps(info,indent=2)+'\n')
    print(json.dumps(info,indent=2))

if __name__=='__main__':run()
