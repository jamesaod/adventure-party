#!/usr/bin/env python3
"""Non-destructive 17-clip FBX -> two Tripo GLB offline bake.

Preserves all source GLB scene/mesh/material/skin/bind data and original BIN
prefix. Uses Mixamo X Bot's rest rig and source/target anatomical world frames.
Each clip is sampled at 60fps, full original duration, with in-place root XZ
motion, preserving vertical motion and rotations. Produces per-source provenance.
"""
from pathlib import Path
import sys, json, math, struct, hashlib, argparse, re
import numpy as np
from scipy.spatial.transform import Rotation as R
from tripo_mixamo_bake_core import (read_glb, gltf_skeleton, fbx_skeleton, get_accessor, quat_angle)

# All input paths are command-line arguments; no repo-local binary is mutated.

def slug(s):
    return re.sub(r'[^a-z0-9]+','_',s.lower()).strip('_')

def rig_basis(pose,name_to_index):
    left=np.array(pose[name_to_index('LeftShoulder')][1],float)
    right=np.array(pose[name_to_index('RightShoulder')][1],float)
    hips=np.array(pose[name_to_index('Hips')][1],float)
    head=np.array(pose[name_to_index('Head')][1],float)
    x=(right-left);x/=np.linalg.norm(x)
    y=(head-hips);y-=x*np.dot(y,x);y/=np.linalg.norm(y)
    z=np.cross(x,y);z/=np.linalg.norm(z)
    y=np.cross(z,x)
    return R.from_matrix(np.column_stack((x,y,z)))

def bake(target_path,reference_path,motions,output_path,report_path,fps=60):
    doc, original_bin, raw=read_glb(target_path)
    if doc.get('animations'):raise ValueError('Require pristine animationless target')
    target_world,parents,names=gltf_skeleton(doc)
    target_names={name.removeprefix('mixamorig:'):idx for name,idx in names.items() if name and name.startswith('mixamorig:')}
    reference,_,reference_pose=fbx_skeleton(reference_path)
    source_bind=reference_pose()
    allnames=set(source_bind)
    target_to_source=set(target_names)&allnames
    if len(target_to_source)<60:raise RuntimeError('Not enough Mixamo joint matches')
    expected_skin=set(doc['skins'][0]['joints']);skinned_nodes={target_names[name] for name in target_to_source}
    if not expected_skin.issuperset(skinned_nodes):raise RuntimeError('Target rig differs from skin joints')
    mapped_order=[(name,target_names[name]) for name in sorted(target_to_source)]
    B=rig_basis(source_bind,lambda n:n)
    Tb=rig_basis(target_world,lambda n:target_names[n])
    C=Tb*B.inv()
    correction_deg=float(np.degrees(C.magnitude()))
    scale=float(target_world[target_names['Hips']][1][1]/source_bind['Hips'][1][1])
    raw_motion_data=[]
    report={'method':'mixamo-xbot-world-delta-target-bind-bake-v2','source_glb':str(target_path.name),
            'input_glb_sha256':hashlib.sha256(raw).hexdigest(),
            'reference_fbx_sha256':hashlib.sha256(reference_path.read_bytes()).hexdigest(),
            'fps':fps, 'height_scale':scale, 'basis_correction_degrees':correction_deg,
            'source_animation_count':len(doc.get('animations',[])), 'clips':[],
            'in_place_policy':'Remove hips horizontal XZ delta; retain source yaw rotation and hips Y delta.',
            'visual_qa':'PENDING: automated rig/GLB preservation does not establish visually correct limb geometry'}
    # Validation evaluates the whole FBX donor's model rest, not just take names.
    for motion in motions:
        records,curves,evaluate=fbx_skeleton(motion)
        bind=evaluate(None)
        mapped=set(target_names)&set(bind)&allnames
        if mapped!=target_to_source:raise RuntimeError('Incompatible donor skeleton '+motion.name)
        discrepancy=max(quat_angle(bind[name][0],source_bind[name][0]) for name in mapped)
        if discrepancy>2:raise RuntimeError(f'FBX reference bind differs by {discrepancy:.2f}°: {motion.name}')
        if not curves:raise RuntimeError('FBX motion has no curves '+motion.name)
        clock=np.concatenate([axis[0] for c in curves.values() for axis in c.values()]);start=float(clock.min());end=float(clock.max())
        if not (0<end-start<30):raise RuntimeError('Unexpected FBX duration '+motion.name)
        duration=end-start
        times=np.linspace(0,duration,max(2,math.ceil(duration*fps)+1),dtype=np.float32)
        rot_tracks={name:[] for name,_ in mapped_order};hip_positions=[]
        hipbind=np.asarray(doc['nodes'][target_names['Hips']].get('translation',[0,0,0]),float)
        max_delta=0
        for t in times:
            world=evaluate(start+float(t))
            dest={}
            for name,node in mapped_order:
                delta=world[name][0]*source_bind[name][0].inv()
                dest[node]=(C*delta*C.inv())*target_world[node][0]
            for name,node in mapped_order:
                parent=parents.get(node)
                parent_q=dest[parent] if parent in dest else (target_world[parent][0] if parent in target_world else R.identity())
                q=(parent_q.inv()*dest[node]).as_quat().astype(np.float32)
                if rot_tracks[name] and np.dot(q,rot_tracks[name][-1])<0:q=-q
                rot_tracks[name].append(q)
            hip_delta= C.apply(world['Hips'][1]-source_bind['Hips'][1])*scale
            hip_delta[0]=0;hip_delta[2]=0  # stationary sprite
            hip=hipbind+hip_delta
            hip_positions.append(hip.astype(np.float32))
            max_delta=max(max_delta,float(np.linalg.norm(hip_delta)))
        label='Mixamo_'+slug(motion.stem)
        raw_motion_data.append((label,times,rot_tracks,np.asarray(hip_positions,np.float32)))
        report['clips'].append({'name':label,'source_fbx':motion.name,'sha256':hashlib.sha256(motion.read_bytes()).hexdigest(),
                   'duration':float(times[-1]),'frame_count':len(times),'rotation_tracks':len(mapped_order),
                   'max_hips_translation':max_delta,'reference_bind_max_degrees':discrepancy})
        print(f'Baked {label}: {len(times)} frames, duration {duration:.2f}s',flush=True)
    views=doc.setdefault('bufferViews',[]);accessors=doc.setdefault('accessors',[])
    resultbin=bytearray(original_bin)
    def append_array(values,components):
        while len(resultbin)%4:resultbin.append(0)
        arr=np.asarray(values,dtype='<f4');off=len(resultbin);b=arr.tobytes();resultbin.extend(b)
        views.append({'buffer':0,'byteOffset':off,'byteLength':len(b)})
        a={'bufferView':len(views)-1,'componentType':5126,'count':len(arr),'type':{1:'SCALAR',3:'VEC3',4:'VEC4'}[components]}
        if components==1:a.update({'min':[float(arr.min())],'max':[float(arr.max())]})
        accessors.append(a);return len(accessors)-1
    for label,times,quats,hip_positions in raw_motion_data:
        ti=append_array(times,1);samplers=[];channels=[]
        for name,node in mapped_order:
            qi=append_array(quats[name],4)
            channels.append({'sampler':len(samplers),'target':{'node':node,'path':'rotation'}})
            samplers.append({'input':ti,'output':qi,'interpolation':'LINEAR'})
        channels.append({'sampler':len(samplers),'target':{'node':target_names['Hips'],'path':'translation'}})
        samplers.append({'input':ti,'output':append_array(hip_positions,3),'interpolation':'LINEAR'})
        doc.setdefault('animations',[]).append({'name':label,'samplers':samplers,'channels':channels})
    if resultbin[:len(original_bin)]!=original_bin:raise RuntimeError('Original BIN prefix changed')
    doc['buffers'][0]['byteLength']=len(resultbin)
    j=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode();j+=b' '*(-len(j)%4)
    while len(resultbin)%4:resultbin.append(0)
    result=bytearray(struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(resultbin)))
    result.extend(struct.pack('<II',len(j),0x4e4f534a));result.extend(j)
    result.extend(struct.pack('<II',len(resultbin),0x004e4942));result.extend(resultbin)
    output_path.parent.mkdir(parents=True,exist_ok=True);output_path.write_bytes(result)
    report['output_glb_sha256']=hashlib.sha256(result).hexdigest()
    report['output_size_bytes']=len(result)
    report['count']=len(doc['animations']);report['mapped_joint_count']=len(mapped_order)
    report['all_source_nodes_and_skins_preserved']=True
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    return report

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--target',required=True);parser.add_argument('--reference',required=True);parser.add_argument('--motion-dir',required=True);parser.add_argument('--out',required=True);parser.add_argument('--report',required=True);parser.add_argument('--fps',type=int,default=60)
    a=parser.parse_args()
    motions=sorted(path for path in Path(a.motion_dir).glob('*.fbx') if path.name!='X Bot.fbx')
    assert len(motions)==17,len(motions)
    report=bake(Path(a.target),Path(a.reference),motions,Path(a.out),Path(a.report),fps=a.fps)
    print('DONE',len(report['clips']),'clips',report['output_size_bytes'],'bytes',report['output_glb_sha256'])
if __name__=='__main__':main()