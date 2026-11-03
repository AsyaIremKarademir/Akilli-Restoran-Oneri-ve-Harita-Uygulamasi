/** Kategori sırası, tercih ekranındaki gösterim sırasıdır. */
export const CUISINE_CATEGORIES = [
  "homestyle",
  "kebab",
  "pizza",
  "burger",
  "chicken",
  "cafe",
  "dessert",
  "breakfast",
  "grill",
  "seafood",
  "asian",
  "italian",
  "sandwich",
  "vegetarian",
  "world",
];

export const CATEGORY_EMOJI = {
  homestyle: "🍲",
  kebab: "🥙",
  pizza: "🍕",
  burger: "🍔",
  chicken: "🍗",
  cafe: "☕",
  dessert: "🍰",
  breakfast: "🍳",
  grill: "🥩",
  seafood: "🐟",
  asian: "🍜",
  italian: "🍝",
  sandwich: "🥪",
  vegetarian: "🥗",
  world: "🌍",
  other: "🍽️",
};

/** OSM `cuisine` değeri → uygulama kategorisi eşlemesi. */
const CUISINE_MAP = {
  // Ev yemekleri / lokanta
  turkish: "homestyle",
  regional: "homestyle",
  homestyle: "homestyle",
  home_cooking: "homestyle",
  local: "homestyle",
  soup: "homestyle",
  lokanta: "homestyle",
  mantı: "homestyle",
  manti: "homestyle",
  // Kebap / döner
  kebab: "kebab",
  doner: "kebab",
  döner: "kebab",
  pide: "kebab",
  lahmacun: "kebab",
  meatball: "kebab",
  kofte: "kebab",
  köfte: "kebab",
  cig_kofte: "kebab",
  shawarma: "kebab",
  arab: "kebab",
  lebanese: "kebab",
  // Pizza
  pizza: "pizza",
  // Burger
  burger: "burger",
  american: "burger",
  hot_dog: "burger",
  // Tavuk
  chicken: "chicken",
  fried_chicken: "chicken",
  wings: "chicken",
  // Kafe
  coffee_shop: "cafe",
  coffee: "cafe",
  tea: "cafe",
  bubble_tea: "cafe",
  // Tatlı
  ice_cream: "dessert",
  dessert: "dessert",
  cake: "dessert",
  pastry: "dessert",
  baklava: "dessert",
  donut: "dessert",
  waffle: "dessert",
  crepe: "dessert",
  chocolate: "dessert",
  frozen_yogurt: "dessert",
  // Kahvaltı
  breakfast: "breakfast",
  brunch: "breakfast",
  bagel: "breakfast",
  simit: "breakfast",
  // Izgara / et
  steak_house: "grill",
  grill: "grill",
  barbecue: "grill",
  bbq: "grill",
  meat: "grill",
  ocakbasi: "grill",
  // Deniz ürünleri
  seafood: "seafood",
  fish: "seafood",
  fish_and_chips: "seafood",
  // Uzak doğu
  asian: "asian",
  chinese: "asian",
  japanese: "asian",
  sushi: "asian",
  ramen: "asian",
  noodle: "asian",
  thai: "asian",
  korean: "asian",
  vietnamese: "asian",
  indian: "asian",
  // İtalyan
  italian: "italian",
  pasta: "italian",
  // Sandviç
  sandwich: "sandwich",
  toast: "sandwich",
  tost: "sandwich",
  kumpir: "sandwich",
  wrap: "sandwich",
  // Vejetaryen
  vegetarian: "vegetarian",
  vegan: "vegetarian",
  salad: "vegetarian",
  // Dünya mutfağı
  mexican: "world",
  french: "world",
  greek: "world",
  georgian: "world",
  international: "world",
  mediterranean: "world",
  spanish: "world",
  russian: "world",
  balkan: "world",
  azerbaijani: "world",
  german: "world",
};

/** "pizza;italian, burger" → ["pizza","italian","burger"] */
export function parseCuisineTag(tag) {
  if (!tag) return [];
  return tag
    .split(/[;,]/)
    .map((c) => c.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);
}

/**
 * Ham OSM mutfak değerlerini ve mekan türünü kullanıcı kategorilerine indirger.
 * Kafeler her zaman "cafe" kategorisini alır; tanınmayan veya hiç mutfak etiketi olmayan
 * mekanlar "other"a düşer, böylece yanlış bir kategoriyle eşleşip öne çıkmazlar.
 */
export function categorize(cuisines, type) {
  const result = new Set();
  for (const c of cuisines) {
    const cat = CUISINE_MAP[c];
    if (cat) result.add(cat);
  }
  if (type === "cafe") result.add("cafe");
  if (result.size === 0) result.add("other");
  return [...result];
}
