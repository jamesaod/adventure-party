/** Repository FBX uploads use the same pinned loader and humanoid retargeter as device imports. */
export async function loadUploadedFbxAnimations({
  appRoot, targetModel, FBXLoader, THREE, prepareStudioAnimations, retargetHumanoidClip,
  disposeModel, fetchAsset = fetch, onStatus = () => {}
}) {
  const response = await fetchAsset(new URL('data/animation-library-sources.json', appRoot), {cache:'no-cache'});
  if (!response.ok) throw new Error(`Uploaded animation catalog returned ${response.status}.`);
  const catalog = await response.json();
  if (catalog.version !== 1 || !Array.isArray(catalog.animations) || !catalog.animations.length) {
    throw new Error('Invalid uploaded animation catalog.');
  }
  const seen = new Set(), entries = catalog.animations.map(entry => {
    const url = new URL(entry.file, appRoot);
    if (!entry.id || seen.has(entry.id) || typeof entry.label !== 'string' || !entry.label ||
        url.origin !== appRoot.origin || !url.pathname.startsWith(appRoot.pathname + 'assets/animations/') ||
        !/\.fbx$/i.test(url.pathname)) throw new Error('Invalid uploaded animation entry.');
    seen.add(entry.id);
    return {...entry, url};
  });
  const result = [];
  for (const entry of entries) {
    onStatus(`Loading uploaded animation: ${entry.label}…`);
    const response = await fetchAsset(entry.url, {cache:'force-cache'});
    if (!response.ok) throw new Error(`${entry.label} returned ${response.status}.`);
    const source = new FBXLoader().parse(await response.arrayBuffer(), '');
    try {
      const clips = prepareStudioAnimations(source.animations || []);
      if (!clips.length) throw new Error(`${entry.label} contains no usable animation.`);
      for (const [index, clip] of clips.entries()) {
        const label = clips.length === 1 ? entry.label : `${entry.label} ${index + 1}`;
        const retargeted = retargetHumanoidClip(THREE, clip, source, targetModel, label);
        retargeted.userData = {...retargeted.userData,
          studioAnimationId:`uploaded:${entry.id}:${index}`,
          repositoryAnimationSource:entry.file, actionProfiles:[...(entry.actionProfiles || [])]};
        result.push(retargeted);
      }
    } finally { disposeModel(source); }
  }
  return result;
}
