/** Basit, süreli (TTL) ve boyut sınırlı bellek içi önbellek. Sunucu yeniden başlatılınca sıfırlanır. */
export class TtlCache {
  store = new Map();
  ttlMs;
  maxEntries;

  constructor(ttlMs, maxEntries = 200) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value) {
    if (this.store.size >= this.maxEntries) {
      // Map ekleme sırasını korur; ilk anahtar en eski kayıttır.
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}
