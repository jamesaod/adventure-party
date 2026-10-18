import fs from "node:fs";

function fail(message) {
  console.error(`VALIDATION FAILED: ${message}`);
  process.exitCode = 1;
}

function requireFile(path) {
  if (!fs.existsSync(path)) fail(`Missing required file: ${path}`);
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

const index = fs.readFileSync("index.html", "utf8");
for (const ref of ["css/adventure-party.css", "js/adventure-party.js"]) {
  if (!index.includes(ref)) fail(`index.html does not reference ${ref}`);
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
