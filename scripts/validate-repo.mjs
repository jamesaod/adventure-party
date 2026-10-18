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
      if (fighterAssetVersion !== expectedRelease) {
        fail(`Fighter sprite cache-buster must match ${expectedRelease}; got ${fighterAssetVersion}.`);
      }
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
