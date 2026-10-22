import { applyMobHeight, appearanceRecipeForMob, appearanceCacheKey, MobAppearanceCache } from './mob-appearance.mjs?v=R238C65';

/** Coordinates async appearance generation without allowing stale equip requests to win. */
export class MobAppearanceRuntime {
  constructor({ generateSpriteSet, cacheLimit = 24 } = {}) {
    if (typeof generateSpriteSet !== 'function') throw new Error('generateSpriteSet callback is required.');
    this.generateSpriteSet = generateSpriteSet;
    this.cache = new MobAppearanceCache(cacheLimit);
    this.revisions = new Map();
  }
  async refresh(unit, context = {}) {
    applyMobHeight(unit);
    const recipe = appearanceRecipeForMob(unit, context);
    const key = appearanceCacheKey(recipe);
    const cached = this.cache.get(key);
    if (cached) return { key, recipe, spriteSet: cached, cached: true, applied: true };
    const id = unit.id || unit;
    const revision = (this.revisions.get(id) || 0) + 1;
    this.revisions.set(id, revision);
    const spriteSet = await this.generateSpriteSet(recipe);
    this.cache.set(key, spriteSet);
    const applied = this.revisions.get(id) === revision;
    return { key, recipe, spriteSet, cached: false, applied };
  }
  invalidate(unit) {
    const id = unit?.id || unit;
    this.revisions.set(id, (this.revisions.get(id) || 0) + 1);
  }
}