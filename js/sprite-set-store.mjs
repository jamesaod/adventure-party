import { SPRITE_DIRECTIONS, SPRITE_POSES, validateSpriteSetManifest } from './sprite-set-core.mjs?v=R237C46';

// Candidate and stable share an origin, so isolate their drafts by page folder.
const scope = new URL('.', location.href).pathname;
const databaseName = `adventure-party-studio:${scope}`;
const storeName = 'sprite-drafts';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('This browser cannot store a combat-test draft. Export the asset ZIP instead.'));
      return;
    }
    let blocked = false;
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => blocked ? request.result.close() : resolve(request.result);
    request.onerror = () => reject(new Error('The browser could not open the studio draft storage. Export the asset ZIP instead.'));
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Studio draft storage is busy in another tab. Close that tab and retry.'));
    };
  });
}

export async function saveStudioDraft({ manifest, files }) {
  validateSpriteSetManifest(manifest);
  let bytes = 0;
  const storedFiles = {};
  const names = SPRITE_POSES.flatMap(pose => SPRITE_DIRECTIONS.map(facing => manifest.poses[pose].frames[facing]));
  if (files?.[manifest.sheet.file] instanceof Blob) names.push(manifest.sheet.file);
  for (const name of names) {
    const file = files?.[name];
    if (!(file instanceof Blob) || !file.size) throw new Error(`Missing captured PNG: ${name}.`);
    bytes += file.size;
    storedFiles[name] = file;
  }
  if (bytes > 64 * 1024 * 1024) throw new Error('This sprite draft is too large for a quick combat test. Export the asset ZIP instead.');
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).put({ manifest, files: storedFiles, savedAt: Date.now() }, 'current');
      transaction.oncomplete = resolve;
      transaction.onabort = transaction.onerror = () => reject(new Error('The browser could not save the sprite draft. Export the asset ZIP instead.'));
    });
  } finally { db.close(); }
}

export async function loadStudioDraft() {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).get('current');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('The saved studio draft could not be read. Capture it again in 3d studio.'));
    });
  } finally { db.close(); }
}
