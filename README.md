# Adventure Party

**Adventure Party** is a working-title browser-based tactical RPG engine inspired by classic SSI Gold Box presentation and isometric hex combat.

The current Git baseline begins from **R158** of the standalone development build.

## Current focus

- Isometric hex-grid tactical combat
- AD&D 2nd Edition-inspired combat and spell mechanics
- Party and MOB initiative / movement / morale
- Architectural walls, line of sight, doors, and indoor/outdoor combat spaces
- Ranged and spellcaster LOS repositioning
- Spell targeting, area previews, incantations, and visual effects
- Fireball confined-space propagation
- Wall of Fog obstacle interaction and orientation control
- Retro launcher / combat UI

## Run locally

The current playable build is:

```
index.html
```

Open it in a modern desktop browser. During development, a lightweight local web server is preferred when testing browser features that behave differently under `file://`.

For example:

```bash
python -m http.server 8000
```

Then open:

```
http://localhost:8000/
```

## Repository workflow

Git now serves as the primary version history. New development should update `index.html` and use meaningful commits rather than keeping every historical release as a separate HTML file.

Important milestones and behavior changes are summarized in [CHANGELOG.md](CHANGELOG.md).

Project notes live under [docs/](docs/).

## Development baseline

- Initial Git baseline: **R158**
- Runtime: browser / standalone HTML
- Primary combat view: isometric hex grid
- Working rules direction: AD&D 2nd Edition mechanics where explicitly implemented

## Licensing

This repository is currently a development project and does **not** grant a general license to reuse or redistribute its contents. Third-party assets and reference-derived material may have their own licensing requirements and should be reviewed before public distribution.

