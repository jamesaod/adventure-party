import fs from "node:fs";
import zlib from "node:zlib";

function fail(message) {
  console.error(`VALIDATION FAILED: ${message}`);
  process.exitCode = 1;
}

function requireFile(path) {
  if (!fs.existsSync(path)) fail(`Missing required file: ${path}`);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePng(path) {
  const data = fs.readFileSync(path);
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);

  if (data.length < 20 || !data.subarray(0,8).equals(signature)) {
    fail(`${path} is not a valid PNG stream.`);
    return;
  }

  let offset = 8;
  let sawIHDR = false;
  let sawIEND = false;
  const idatParts = [];

  while (offset < data.length) {
    if (offset + 12 > data.length) {
      fail(`${path} has a truncated PNG chunk header.`);
      return;
    }

    const length = data.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > data.length) {
      fail(`${path} has a truncated PNG chunk.`);
      return;
    }

    const typeBuffer = data.subarray(offset + 4, offset + 8);
    const type = typeBuffer.toString("ascii");
    const chunkData = data.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = data.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(Buffer.concat([typeBuffer, chunkData]));

    if (actualCrc !== expectedCrc) {
      fail(`${path} has a bad CRC in PNG chunk ${type}.`);
      return;
    }

    if (type === "IHDR") {
      if (sawIHDR || length !== 13) {
        fail(`${path} has an invalid IHDR chunk.`);
        return;
      }
      sawIHDR = true;
    } else if (type === "IDAT") {
      idatParts.push(chunkData);
    } else if (type === "IEND") {
      sawIEND = true;
      break;
    }

    offset = chunkEnd;
  }

  if (!sawIHDR || !sawIEND || idatParts.length === 0) {
    fail(`${path} is missing required PNG chunks.`);
    return;
  }

  try {
    zlib.inflateSync(Buffer.concat(idatParts));
  } catch (error) {
    fail(`${path} has an invalid compressed image stream: ${error.message}`);
  }
}

function collectPngs(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      results.push(...collectPngs(path));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
      results.push(path);
    }
  }
  return results;
}

const requiredFiles = [
  "index.html",
  "css/adventure-party.css",
  "js/adventure-party.js",
  "data/sprite-asset-registry.json",
  "assets/terrain/grass-outdoors-tiles.png",
  "assets/terrain/grass-outdoors-trees.png",
];

for (const path of requiredFiles) requireFile(path);

for (const pngPath of collectPngs("assets")) {
  validatePng(pngPath);
}

const index = fs.readFileSync("index.html", "utf8");
for (const ref of ["css/adventure-party.css", "js/adventure-party.js"]) {
  if (!index.includes(ref)) fail(`index.html does not reference ${ref}`);
}

const placeholderSpellSfxPath =
  "js/candidate-rev38-placeholder-spell-sfx-grease-vfx.js";

requireFile(placeholderSpellSfxPath);

if (!index.includes(placeholderSpellSfxPath)) {
  fail("index.html does not load the Candidate Rev 38 placeholder spell SFX / Grease VFX module.");
}

if (fs.existsSync(placeholderSpellSfxPath)) {
  const placeholderSpellSfx =
    fs.readFileSync(placeholderSpellSfxPath, "utf8");

  for (const requiredToken of [
    "r38PlayLaughterSound",
    "r38PlayTauntSound",
    "r38PlayScareSound",
    "r38PlayFogCloudSound",
    "r38PlayWallOfFogSound",
    "r38PlayGreaseSound",
    "r38PlayStinkingCloudFartSound",
    "r38DrawGreaseVfx"
  ]) {
    if (!placeholderSpellSfx.includes(requiredToken)) {
      fail(`Candidate Rev 38 placeholder spell module is missing ${requiredToken}.`);
    }
  }
}

/*
  Spell Previewer parity guard
  ----------------------------
  Fireball is intentionally a single-source production spell. The Previewer
  must invoke the battlefield resolver instead of maintaining a second Fireball
  sequence. This check turns future architectural drift into a CI failure.
*/
const spellPreviewerPath = "js/candidate-spell-previewer.js";
const fireballProductionPath = "js/r233-multi-result-damage.js";
const magicMissileProductionPath = "js/candidate-rev36-magic-missile-volley.js";

if (fs.existsSync(spellPreviewerPath)) {
  const previewer = fs.readFileSync(spellPreviewerPath, "utf8");

  if (/run\s*:\s*spellPreviewRunFireball/.test(previewer)) {
    fail("Fireball must not use a bespoke Spell Previewer runner; use the production resolver.");
  }

  if (/async\s+function\s+spellPreviewRunFireball\s*\(/.test(previewer)) {
    fail("Duplicate spellPreviewRunFireball implementation detected.");
  }

  if (!/\"fireball\"\s*:\s*\{\s*groundHex\s*:\s*\{\s*x\s*:\s*2\s*,\s*y\s*:\s*0\s*\}/s.test(previewer)) {
    fail("Spell Previewer must define Fireball only as a production-scene target at hex 2,0.");
  }

  if (/run\s*:\s*spellPreviewRunMagicMissile/.test(previewer)) {
    fail("Magic Missile must not use a bespoke Spell Previewer runner; use the production volley resolver.");
  }

  if (/async\s+function\s+spellPreviewRunMagicMissile\s*\(/.test(previewer)) {
    fail("Duplicate spellPreviewRunMagicMissile implementation detected.");
  }

  if (!previewer.includes("action.magicMissileTargetIds")) {
    fail("Spell Previewer must feed target assignments into the production Magic Missile volley.");
  }
}

if (fs.existsSync(fireballProductionPath)) {
  const production = fs.readFileSync(fireballProductionPath, "utf8");
  const fireballStart = production.indexOf("castFireballFromScroll=async function");
  const fireballSource = fireballStart >= 0
    ? production.slice(fireballStart)
    : "";

  if (!fireballSource) {
    fail("Production Fireball resolver is missing.");
  } else {
    if (fireballSource.includes("r233BaseRollSpellSave(")) {
      fail("Production Fireball must use the live rollSpellSave hook for Previewer parity.");
    }

    if (!fireballSource.includes("rollSpellSave(")) {
      fail("Production Fireball is not using the shared rollSpellSave hook.");
    }

    if (!fireballSource.includes("suppressFocus:true")) {
      fail("Production Fireball saves must suppress per-target camera focus.");
    }
  }
}

requireFile(magicMissileProductionPath);

if (fs.existsSync(magicMissileProductionPath)) {
  const production = fs.readFileSync(magicMissileProductionPath, "utf8");

  if (!production.includes("castMagicMissileFromScroll=")) {
    fail("Production Magic Missile volley resolver is missing.");
  }

  if (!production.includes("magicMissileTargetIds")) {
    fail("Production Magic Missile must support explicit per-missile target assignments.");
  }

  if (!production.includes("r36AnimateVolley")) {
    fail("Production Magic Missile must use the shared simultaneous volley animation.");
  }

  if (!production.includes("candidate-rev36-magic-missile-volley")) {
    fail("Magic Missile production module identity is missing.");
  }

  if (!index.includes("js/candidate-rev36-magic-missile-volley.js")) {
    fail("index.html does not load the Candidate Rev 36 Magic Missile production module.");
  }
}

const cssVersion=index.match(/css\/adventure-party\.css\?v=(R\d+)/)?.[1] || null;
const jsVersion=index.match(/js\/adventure-party\.js\?v=(R\d+)/)?.[1] || null;
if (!cssVersion || !jsVersion) fail("Versioned CSS/JS asset URLs are required.");
if (cssVersion !== jsVersion) fail(`CSS/JS asset versions differ: ${cssVersion} vs ${jsVersion}`);

const fighterAssetVersion = fs.readFileSync("js/adventure-party.js","utf8").match(/assets\/sprites\/fighter\.png\?v=(R\d+)/)?.[1] || null;
if (!fighterAssetVersion) fail("Versioned fighter sprite URL is required.");

if (index.includes("Single-File Engine") || index.includes("Build R121")) {
  fail("Launcher contains obsolete single-file/R121 build metadata.");
}

const buildMatch = index.match(
  /<script id="buildMetadata" type="application\/json">\s*([\s\S]*?)\s*<\/script>/
);

if (!buildMatch) {
  fail("index.html is missing embedded buildMetadata JSON.");
} else {
  try {
    const build = JSON.parse(buildMatch[1]);

    if (build.architecture !== "Multi-File Engine") {
      fail(`Unexpected build architecture: ${build.architecture}`);
    }

    if (!/^R\d+$/.test(build.release || "")) {
      fail(`Invalid build release: ${build.release}`);
    }

    if (!build.builtAt || !Number.isFinite(Date.parse(build.builtAt))) {
      fail(`Invalid build timestamp: ${build.builtAt}`);
    }

    const headRef = process.env.GITHUB_HEAD_REF || "";
    const branchRelease = headRef.match(/^r(\d+)(?:-|$)/i);

    if (branchRelease) {
      const expectedRelease = "R" + branchRelease[1];
      if (build.release !== expectedRelease) {
        fail(
          `Build metadata release ${build.release} does not match PR branch ${headRef} (${expectedRelease}).`
        );
      }
      if (cssVersion !== expectedRelease || jsVersion !== expectedRelease) {
        fail(`Asset cache-buster versions must match ${expectedRelease}; got CSS ${cssVersion} / JS ${jsVersion}.`);
      }
      /*
        Static sprite cache-busters track the asset revision, not every engine
        release. The fighter image has not changed in R216, so requiring its
        query token to equal the branch release creates false CI failures.
        Presence of a versioned fighter URL is still enforced above.
      */
    }
  } catch (error) {
    fail(`Embedded buildMetadata JSON is invalid: ${error.message}`);
  }
}

let registry;
try {
  registry = JSON.parse(fs.readFileSync("data/sprite-asset-registry.json", "utf8"));
} catch (error) {
  fail(`Sprite registry JSON is invalid: ${error.message}`);
}

if (!registry || typeof registry !== "object" || !registry.assets || typeof registry.assets !== "object") {
  fail("Sprite registry must contain an assets object.");
} else {
  for (const [name, spec] of Object.entries(registry.assets)) {
    requireFile(`assets/sprites/${name}.png`);

    for (const section of ["source", "workspace", "render", "anchor"]) {
      if (!spec?.[section] || typeof spec[section] !== "object") {
        fail(`Sprite ${name} is missing ${section} metadata.`);
      }
    }

    for (const section of ["source", "workspace", "render"]) {
      for (const dimension of ["width", "height"]) {
        const value = spec?.[section]?.[dimension];
        if (!Number.isFinite(value) || value <= 0) {
          fail(`Sprite ${name} has invalid ${section}.${dimension}: ${value}`);
        }
      }
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Adventure Party repository validation passed.");
