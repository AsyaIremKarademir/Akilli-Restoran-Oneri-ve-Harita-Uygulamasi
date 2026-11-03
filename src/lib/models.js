/**
 * Uygulamanın veri modelleri. Aşağıdaki JSDoc açıklamaları yalnızca belgeleme içindir;
 * editörde otomatik tamamlama sağlar, çalışma zamanına etkisi yoktur.
 */

/** Mekanın OSM'deki temel türleri (amenity etiketi). */
export const PLACE_TYPES = ["restaurant", "fast_food", "cafe"];

/**
 * Normalize edilmiş bir mekan (bkz. lib/overpass.js → normalizeElement).
 *
 * @typedef {Object} Place
 * @property {string} id              "node/123" biçiminde benzersiz OSM kimliği
 * @property {string} name
 * @property {"restaurant" | "fast_food" | "cafe"} type
 * @property {string[]} cuisines      OSM'den gelen ham mutfak değerleri (örn. ["pizza", "italian"])
 * @property {string[]} categories    Kullanıcıya gösterilen kategoriler (bkz. lib/cuisines.js)
 * @property {number} lat
 * @property {number} lon
 * @property {string} [address]
 * @property {string} [openingHours]
 * @property {string} [phone]
 * @property {string} [website]
 * @property {1 | 2 | 3 | 4} priceLevel  1 = ekonomik, 4 = lüks
 * @property {boolean} priceEstimated    OSM'de fiyat nadiren bulunur; true ise fiyat sezgisel olarak tahmin edilmiştir
 * @property {boolean} [vegetarian]
 * @property {boolean} [vegan]
 * @property {boolean} [wheelchair]
 * @property {boolean} [outdoorSeating]
 * @property {boolean} [takeaway]
 * @property {boolean} [delivery]
 */

/**
 * Kullanıcının tercih profili (bkz. store/user.js).
 *
 * @typedef {Object} Preferences
 * @property {string[]} cuisines       Seçilen mutfak kategorileri; boşsa tüm mutfaklar eşit
 * @property {number} maxDistance      metre cinsinden
 * @property {[number, number]} priceRange  [en düşük, en yüksek] fiyat seviyesi (1-4)
 * @property {string[]} placeTypes
 * @property {boolean} vegetarian
 * @property {boolean} vegan
 * @property {boolean} wheelchair
 */

/**
 * Kullanıcının bir mekana verdiği oy. Mekan uzaktayken de listelenebilsin diye mekanın bir kopyası saklanır.
 *
 * @typedef {Object} VoteRecord
 * @property {1 | -1} vote   1 = beğendim, -1 = beğenmedim
 * @property {Place} place
 * @property {number} at     oy zamanı (ms)
 */
