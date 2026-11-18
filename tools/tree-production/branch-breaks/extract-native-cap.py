import json,collections
from pathlib import Path
import numpy as np
d=Path(__file__).parent;g=json.loads((d/'native-cap.json').read_text());p=np.array(g['positions']);tri=np.array(g['triangles']);p,remap=np.unique(np.round(p,4),axis=0,return_inverse=True);tri=remap[tri];adj=collections.defaultdict(set)
for t in tri:
 for a in t:adj[int(a)].update(map(int,t))
groups=[];seen=set()
for i in adj:
 if i in seen:continue
 todo=[i];ids=[]
 while todo:
  a=todo.pop()
  if a in seen:continue
  seen.add(a);ids.append(a);todo.extend(adj[a]-seen)
 ts=tri[np.isin(tri[:,0],ids)];pts=p[ids];groups.append((np.linalg.norm(pts-pts.mean(0),axis=1).max(),ids,ts))
radius,ids,ts=max(groups,key=lambda x:x[0]);edges=collections.Counter(tuple(sorted((int(a),int(b)))) for t in ts for a,b in zip(t,np.roll(t,-1)));rim=sorted(set(a for e,n in edges.items() if n==1 for a in e));center=p[rim].mean(0);_,_,basis=np.linalg.svd(p[rim]-center);normal=basis[-1];normal*=np.sign(np.sum(np.cross(p[ts[:,1]]-p[ts[:,0]],p[ts[:,2]]-p[ts[:,0]]),axis=0)@normal) or 1;u=basis[0];v=np.cross(normal,u);local=np.array([[(p[i]-center)@u,(p[i]-center)@normal,(p[i]-center)@v] for i in ids]);radius=np.linalg.norm(local[:,[0,2]],axis=1).max();local/=radius;remap={x:i for i,x in enumerate(ids)}
result={'source':'SpeedTree 10.2 WhiteOak_BrokenBranches.spm / Cap 2; four rings, noise displacement 0.85','positions':local.round(7).tolist(),'triangles':[[remap[int(a)] for a in t] for t in ts],'rim':[remap[i] for i in rim]}
(d/'speedtree-branch-cap.json').write_text(json.dumps(result));print('Native components',len(groups),'selected',len(ids),'vertices',len(ts),'triangles','rim',len(rim),'relief',local[:,1].min(),local[:,1].max())

