# Title menu cleanup — 2026-11-14

The launcher has a Game Mechanics submenu for Spell Book, Class Book, MOB Catalog and Equipment Library. Keyboard navigation, Escape and return links support the submenu. Title music playback has been removed; effects and weather audio remain.

Removed Character Generation and Map Maker World (unimplemented menu placeholders), Pixel Editor and its input/painting/upload UI, and the standalone MOB Creator, 3D Studio and Exploration Map Editor pages/controllers/styles. Shared sprite registration, dimensions and anchors remain in the engine. Shared model, equipment, animation, capture, MOB library and exploration schema/runtime modules remain available to combat, Workshop, catalog and existing map data. Saved browser data and source assets are preserved.

Map Maker Combat is still the pre-existing unconnected menu placeholder. New map-editor features are a separate forthcoming task.

Local cleanup only; no remote publish.

Validation: 109/109 combat/Workshop regressions; headless browser startup/menu/navigation/catalog/combat-setup smoke passed. Shared directional sprite, footprint, equipment and map geometry checks passed. Broad Node workflow checks exposed four pre-existing failures, reproduced against the unmodified game: script-loader URL expectation, font encoding, MOB class catalog parity and exploration-render fixture dependency. Two asset import checks require the real asset directory / symlink privileges rather than the staged asset junction.

Update 2026-11-14: The user requested restoring Exploration Map Editor. Its menu, page, styles, controller, overview and return-from-test link have been restored from the backup; see TITLE_PRESENTATION.md.
