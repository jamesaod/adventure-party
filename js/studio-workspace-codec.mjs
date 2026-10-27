// Raw pixels are immutable after capture. Cache compression by identity so
// editing a grip does not recompress every previously saved pose.
const compressedPixels=new WeakMap();
const pixelKeys=['raw','battlefieldRaw','groundShadowRgba'];
const groupKeys=['actionProfiles','sharedActionGroups','legacySharedCaptures'];
async function compressPixels(pixels){
  if(!compressedPixels.has(pixels)){
    const pending=new Response(new Blob([pixels]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
    compressedPixels.set(pixels,pending);
    pending.catch(()=>compressedPixels.delete(pixels));
  }
  return compressedPixels.get(pixels);
}
async function mapWorkspace(workspace,convert){
  const seen=new WeakMap();
  async function group(poses={}){
    const result={};
    for(const [pose,capture] of Object.entries(poses)){
      if(!seen.has(capture))seen.set(capture,await convert(capture));
      result[pose]=seen.get(capture);
    }
    return result;
  }
  const result={...workspace,captures:await group(workspace.captures)};
  for(const key of groupKeys)if(workspace[key]){
    result[key]={};
    for(const [id,poses] of Object.entries(workspace[key]))result[key][id]=await group(poses);
  }
  return result;
}
export async function encodeStudioWorkspace(workspace){
  const encoded=await mapWorkspace(workspace,async capture=>{
    const result={...capture};
    for(const key of pixelKeys)if(capture[key]!==undefined)result[key]=await compressPixels(capture[key]);
    return result;
  });
  return {...encoded,pixelEncoding:'gzip-v1'};
}
async function decompressPixels(blob,expected){
  if(!(blob instanceof Blob)||!Number.isSafeInteger(expected)||expected<=0||expected>4096*4096*6*4)throw Error('Invalid saved capture pixels.');
  const reader=blob.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const pixels=new Uint8Array(expected);let offset=0;
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      if(offset+value.length>expected)throw Error('Saved capture pixels exceed their frame size.');
      pixels.set(value,offset);offset+=value.length;
    }
    if(offset!==expected)throw Error('Saved capture pixels are incomplete.');
  }finally{await reader.cancel();reader.releaseLock();}
  compressedPixels.set(pixels,Promise.resolve(blob));
  return pixels;
}
export async function decodeStudioWorkspace(workspace){
  if(!workspace||workspace.pixelEncoding===undefined)return workspace;
  if(workspace.pixelEncoding!=='gzip-v1')throw Error('Unsupported saved capture encoding.');
  const decoded=await mapWorkspace(workspace,async capture=>{
    const result={...capture};
    for(const key of pixelKeys)if(capture[key]!==undefined){
      const size=key==='raw'?capture.width*capture.height:capture.battlefieldWidth*capture.battlefieldHeight;
      result[key]=await decompressPixels(capture[key],size*6*4);
    }
    return result;
  });
  delete decoded.pixelEncoding;
  return decoded;
}
