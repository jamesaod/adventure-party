import json,struct,numpy as np, math
from pathlib import Path
from scipy.spatial.transform import Rotation as R, Slerp
import argparse
ap=argparse.ArgumentParser(description='Bake yaw-decoupled turning clips from a Carl donor GLB onto an animationless Orc GLB')
ap.add_argument('--source', type=Path, required=True, help='Carl full-17 donor GLB')
ap.add_argument('--target', type=Path, required=True, help='Pristine Orc GLB')
ap.add_argument('--output-dir', type=Path, required=True)
args=ap.parse_args()
DIR=args.output_dir
DIR.mkdir(parents=True, exist_ok=True)
def glb(path):
 b=path.read_bytes();assert b[:4]==b'glTF';jslen=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+jslen]);p=20+jslen;blen=struct.unpack_from('<I',b,p)[0];return doc,bytes(b[p+8:p+8+blen])
def rig(doc):
 nodes=doc['nodes'];parents={ch:i for i,n in enumerate(nodes) for ch in n.get('children',[])};names={n.get('name',''):i for i,n in enumerate(nodes)};loc=[]
 for n in nodes:
  if 'matrix' in n:
   m=np.array(n['matrix']).reshape((4,4),order='F');loc.append((R.from_matrix(m[:3,:3]),m[:3,3]))
  else:loc.append((R.from_quat(n.get('rotation',[0,0,0,1])),np.array(n.get('translation',[0,0,0]),float)))
 def world(pose=None):
  pose=loc if pose is None else pose;cache={}
  def w(i):
   if i not in cache:
    r,p=pose[i];par=parents.get(i)
    if par is not None:
     pr,pp=w(par);r,p=pr*r,pp+pr.apply(p)
    cache[i]=(r,p)
   return cache[i]
  for i in range(len(nodes)):w(i)
  return cache
 return parents,names,loc,world

def accessor(doc,b,idx):
 a=doc['accessors'][idx]; v=doc['bufferViews'][a['bufferView']]; n={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];st=v.get('byteStride',n*4);off=v.get('byteOffset',0)+a.get('byteOffset',0);return np.stack([np.frombuffer(b,dtype='<f4',count=n,offset=off+i*st) for i in range(a['count'])])

def basis(w,n):
 p=lambda x:w[n['mixamorig:'+x]][1]
 x=p('RightShoulder')-p('LeftShoulder');x/=np.linalg.norm(x)
 y=p('Head')-p('Hips');y-=x*np.dot(x,y);y/=np.linalg.norm(y)
 z=np.cross(x,y);z/=np.linalg.norm(z);y=np.cross(z,x)
 return R.from_matrix(np.column_stack((x,y,z)))

cd,cb=glb(args.source);od,ob=glb(args.target)
pc,nc,lc,wc=rig(cd);pt,nt,lt,wt=rig(od);sbind=wc();tbind=wt();C=basis(tbind,nt)*basis(sbind,nc).inv()
priority=['Spine','Spine1','Spine2','Neck','Head','LeftArm','RightArm','LeftForeArm','RightForeArm','LeftHand','RightHand','LeftLeg','RightLeg','LeftFoot','RightFoot','LeftToeBase','RightToeBase','LeftHandMiddle1','RightHandMiddle1']
rolemap={}
for name,ti in nt.items():
 if not name.startswith('mixamorig:') or name not in nc:continue
 si=nc[name];sc={cd['nodes'][ch].get('name'):ch for ch in cd['nodes'][si].get('children',[]) if 'name' in cd['nodes'][ch]};tc={od['nodes'][ch].get('name'):ch for ch in od['nodes'][ti].get('children',[]) if 'name' in od['nodes'][ch]};common=[x for x in sc if x in tc and np.linalg.norm(lc[sc[x]][1])>1e-9 and np.linalg.norm(lt[tc[x]][1])>1e-9]
 common.sort(key=lambda name:priority.index(name[10:]) if name[10:] in priority else 999)
 if common:
  role=common[0];rolemap[name]=(lc[sc[role]][1],lt[tc[role]][1],role)

def evaluate_source(clip,sec):
 pose=list(lc);hip=None
 for ch in clip['channels']:
  sm=clip['samplers'][ch['sampler']];ts=accessor(cd,cb,sm['input'])[:,0];vs=accessor(cd,cb,sm['output']);idx=ch['target']['node'];k=np.searchsorted(ts,sec,side='right')
  if k<=0: val=vs[0]
  elif k>=len(ts):val=vs[-1]
  else:
   j=k-1;alpha=(sec-ts[j])/(ts[k]-ts[j]);val=(1-alpha)*vs[j]+alpha*vs[k]
  if ch['target']['path']=='rotation':pose[idx]=(R.from_quat(val/np.linalg.norm(val)),pose[idx][1])
  if ch['target']['path']=='translation':pose[idx]=(pose[idx][0],val)
 return wc(pose),pose

def target_pose(sw,mode):
 worldQ={}
 # The source pelvis tells us the character's WORLD facing, not its spine-axis
 # direction. Remove this yaw from source bone aim and reapply it once to the
 # entire target skeleton to prevent the limbs and torso facing different ways.
 hip='mixamorig:Hips'; si=nc[hip]
 hip_delta=C*(sw[si][0]*sbind[si][0].inv())*C.inv()
 fwd=hip_delta.apply([0,0,1])
 yaw=math.atan2(fwd[0],fwd[2])
 Y=R.from_euler('y',yaw)
 Yinv=Y.inv()

 torso=['Hips','Spine','Spine1','Spine2','Neck','Head']
 for name,ti in nt.items():
  if not name.startswith('mixamorig:') or name not in nc:continue
  si=nc[name];target_world=tbind[ti][0];src=sw[si][0]
  if mode=='twist-preserving-yaw' and name[10:] in torso:
   delta=C*(src*sbind[si][0].inv())*C.inv();q=delta*target_world
  elif name in rolemap:
   sourceDir,targetDir,child=rolemap[name]
   frm=target_world.apply(targetDir);to=Yinv.apply(C.apply(src.apply(sourceDir)))
   frm/=np.linalg.norm(frm);to/=np.linalg.norm(to)
   cross=np.cross(frm,to);dot=np.clip(np.dot(frm,to),-1,1)
   if dot>0.999999:aim=R.identity()
   elif dot< -0.999999:aim=R.from_rotvec(math.pi*np.array([1.,0.,0.]))
   else:aim=R.from_rotvec(cross/np.linalg.norm(cross)*np.arccos(dot))
   q=Y*aim*target_world
  else:
   # Preserve twist on unmapped terminal bones in the source's yaw-neutral
   # reference frame, then apply target facing once.
   canonSrc=(C.inv()*Yinv*C)*src
   q=Y*target_world*sbind[si][0].inv()*canonSrc
  if mode=='twist-preserving-yaw' and name[10:] in torso:
   pass # torso already carries full source-world motion
  worldQ[ti]=q
 out={}
 for ti,q in worldQ.items():
  par=pt.get(ti)
  parentRot=worldQ.get(par,tbind[par][0] if par is not None else R.identity())
  out[ti]=parentRot.inv()*q
 return out

def write(clip_name,mode):
 clip=next(a for a in cd['animations'] if a['name']==clip_name)
 T=max(accessor(cd,cb,s['input'])[-1,0] for s in clip['samplers']);samples=np.linspace(0,T,max(2,int(np.ceil(T*60))+1),dtype=np.float32)
 out={i:[] for i in [nt[k] for k in nt if k.startswith('mixamorig:') and k in nc]}
 hipvals=[];prevs={}
 for t in samples:
  sw,local=evaluate_source(clip,float(t));tr=target_pose(sw,mode)
  for ti,q in tr.items():
   qq=q.as_quat();old=prevs.get(ti)
   if old is not None and np.dot(qq,old)<0:qq=-qq
   prevs[ti]=qq;out[ti].append(qq)
  hip=local[nc['mixamorig:Hips']][1];sHip0=lc[nc['mixamorig:Hips']][1];tHip=lt[nt['mixamorig:Hips']][1];factor=tHip[1]/sHip0[1]
  hipvals.append([tHip[0],tHip[1]+(hip[1]-sHip0[1])*factor,tHip[2]])
 doc=json.loads(json.dumps(od));b=bytearray(ob);views=doc['bufferViews'];acc=doc['accessors'];smps=[];channels=[]
 def append(values,n):
  while len(b)%4:b.append(0)
  v=np.asarray(values,dtype='<f4').reshape(-1,n);start=len(b);b.extend(v.tobytes());views.append({'buffer':0,'byteOffset':start,'byteLength':len(b)-start});a={'bufferView':len(views)-1,'componentType':5126,'type':{1:'SCALAR',3:'VEC3',4:'VEC4'}[n],'count':len(v)}
  if n==1:a.update({'min':[float(v.min())],'max':[float(v.max())]})
  acc.append(a);return len(acc)-1
 ixT=append(samples,1)
 for ti,quats in out.items():
  ixR=append(quats,4);smps.append({'input':ixT,'output':ixR,'interpolation':'LINEAR'});channels.append({'sampler':len(smps)-1,'target':{'node':ti,'path':'rotation'}})
 ixP=append(hipvals,3);smps.append({'input':ixT,'output':ixP,'interpolation':'LINEAR'});channels.append({'sampler':len(smps)-1,'target':{'node':nt['mixamorig:Hips'],'path':'translation'}})
 doc['buffers'][0]['byteLength']=len(b);doc['animations']=[{'name':mode+'-'+clip_name,'samplers':smps,'channels':channels}]
 j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*(-len(j)%4);b+=b'\0'*(-len(b)%4)
 final=bytearray(struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(b)));final.extend(struct.pack('<II',len(j),0x4e4f534a));final.extend(j);final.extend(struct.pack('<II',len(b),0x004e4942));final.extend(b)
 result=DIR/('diagnostic-'+mode+'-'+clip_name+'.glb');result.write_bytes(final);print(result,'bytes',len(final),'duration',T,'tracks',len(out))
for name in ['Mixamo_sword_and_shield_turn','Mixamo_sword_and_shield_turn_2']:
 for mode in ['yaw-decoupled']:
  write(name,mode)