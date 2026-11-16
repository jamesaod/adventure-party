// Published geometry is reconstructed without regenerating poses or simplifying meshes.
export async function expandPreparedChunks(pack,loadChunk){
  if(!pack.sharedSceneVersion)return pack;
  if(pack.sharedSceneVersion!==1)throw Error('Unsupported prepared scene version.');
  const pending=new Map();
  for(const field of ['geometries','images']){
    pack.scene[field]=await Promise.all((pack.scene[field]||[]).map(async ref=>{
      if(!/^[a-f0-9]{64}$/.test(ref.chunk)||typeof ref.uuid!=='string')throw Error('Invalid prepared scene chunk.');
      if(!pending.has(ref.chunk))pending.set(ref.chunk,loadChunk(ref.chunk));
      return {...await pending.get(ref.chunk),uuid:ref.uuid};
    }));
  }
  delete pack.sharedSceneVersion;
  return pack;
}
