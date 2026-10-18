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

const cssVersion=index.match(/css\/adventure-party\.css\?v=(R\d+)/)?.[1] || null;
const jsVersion=index.match(/js\/adventure-party\.js\?v=(R\d+)/)?.[1] || null;
if (!cssVersion || !jsVersion) fail("Versioned CSS/JS asset URLs are required.");
if (cssVersion !== jsVersion) fail(`CSS/JS asset versions differ: ${cssVersion} vs ${jsVersion}`);

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
