# Adventure Party — R167 Release Notes

## Summary
R167 migrates the frozen R166 standalone build into a normal multi-file web project for reliable incremental GitHub development. Gameplay behavior is intentionally unchanged.

## Architecture Migration
- Preserved R166 as a frozen standalone recovery snapshot.
- Extracted the inline stylesheet to `css/adventure-party.css`.
- Extracted the inline JavaScript to `js/adventure-party.js`.
- Extracted 11 sprite PNGs to `assets/sprites/`.
- Extracted the two large terrain sheets to `assets/terrain/`.
- Moved the canonical sprite specification to `data/sprite-asset-registry.json`.
- Replaced embedded Base64 image constants with ordinary repository-relative asset paths.
- `index.html` is now a small launcher/document shell rather than a multi-megabyte monolith.

## Purpose
Future changes can now update only the files that actually changed. Sprite edits no longer require rewriting the entire HTML file, and JavaScript/CSS changes can be committed independently.

## Compatibility
- Browser runtime remains plain HTML/CSS/JavaScript.
- Existing GitHub Pages hosting model remains compatible.
- No build system or package manager is required.

## Recovery
The exact pre-migration R166 standalone build is preserved separately as `Adventure_Party_R166_FROZEN.zip`.
