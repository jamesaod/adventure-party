import { applyMobHeight, appearanceRecipeForMob, appearanceCacheKey, MobAppearanceCache } from './mob-appearance.mjs?v=R238C72';

/** Coordinates async appearance generation without allowing stale equip requests to win. */
export class MobAppearanceRuntime {
  constructor({ generateSpriteSet, cacheLimit = 24 } = {}) {
    if (typeof generateSpriteSet !== 'function') throw new Error('generateSpriteSet callback is required.');
    this.generateSpriteSet = generateSpriteSet;
    this.cache = new MobAppearanceCache(cacheLimit);
    this.revisions = new Map();
    this.inFlight = new Map();
  }
  async refresh(unit, context = {}) {
    applyMobHeight(unit);
    const recipe = appearanceRecipeForMob(unit, context);
    const key = appearanceCacheKey(recipe);
    const id = unit.id || unit;
    const revision = (this.revisions.get(id) || 0) + 1;
    this.revisions.set(id, revision);

    const cached = this.cache.get(key);
    if (cached) {
      return { key, recipe, spriteSet: cached, cached: true, inFlight: false,
        applied: this.revisions.get(id) === revision };
    }

    let pending = this.inFlight.get(key);
    const reusedInFlight = !!pending;
    if (!pending) {
      pending = Promise.resolve().then(() => this.generateSpriteSet(recipe));
      this.inFlight.set(key, pending);
    }

    let spriteSet;
    try {
      spriteSet = await pending;
    } finally {
      if (this.inFlight.get(key) === pending) this.inFlight.delete(key);
    }
    this.cache.set(key, spriteSet);
    const applied = this.revisions.get(id) === revision;
    return { key, recipe, spriteSet, cached: false, inFlight: reusedInFlight, applied };
  }
  ensure(unit, context = {}) {
    return this.refresh(unit, context);
  }
  invalidate(unit) {
    const id = unit?.id || unit;
    this.revisions.set(id, (this.revisions.get(id) || 0) + 1);
  }
}