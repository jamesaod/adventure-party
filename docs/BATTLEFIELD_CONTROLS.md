# Battlefield text controls — Candidate Rev 154

While the Combat System Test is open:

- **+** or **=** increases battlefield text size by 10 percentage points.
- **-** reduces text size by 10 percentage points.
- Keypad **+** / **-** work as well. Range: 80%–160%, default 100%.
- The header displays the current percentage and shortcut reminder. The browser remembers the size separately for candidate and stable. If storage is unavailable, controls still work for the current session.

These keys adjust battlefield canvas labels/speech/status text and the combat interface (banner, unit information, log, commands and combat overlays). They work before the first turn and while aiming, without taking a turn or changing combat rules. Text panels scroll when necessary; the action bar scrolls horizontally so larger text does not make controls unreachable.

Typing in input/select/textarea/contenteditable controls is ignored. Ctrl/Command/Alt combinations, composition events and already-handled events are left alone, preserving browser zoom. Map zoom remains on **[** and **]** and is independent of text size. No Quick Command or Escape behavior changed in this revision.

Implementation uses the existing combat key handler, a CSS scale scoped to `#combatScreen`, and a shared canvas font formatter. Pixel Editor scale-test labels and other screens keep their existing font sizes. New battlefield text should use `battlefieldTextFont(basePixels)` on the canvas or `calc(<base-size> * var(--combat-font-scale, 1))` in CSS.

Validation: `node scripts/test-battlefield-font.mjs` exercises both keyboards, upper/lower bounds, before-turn/aiming operation, CSS/canvas scale parity, storage reload/failure, and editable/modifier guards. Run repository validation, then browser QA at 80%, 100%, 130% and 160%; check panel/action-bar scrolling and unchanged turn state. Reload and re-enter combat to confirm persistence.
