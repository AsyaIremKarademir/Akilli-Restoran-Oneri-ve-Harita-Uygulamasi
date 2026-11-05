export const MAX_CHAT_PLACES = 60;
export const MAX_CHAT_MESSAGES = 16;
export const MAX_MESSAGE_LENGTH = 800;

const KEYWORDS = [
  [/pizza/i, "pizza"],
  [/burger|hamburger/i, "burger"],
  [/kebap|kebab|döner|doner|lahmacun|pide|köfte|kofte/i, "kebab"],
  [/ev yeme|lokanta|esnaf|home ?cook|homestyle|çorba|soup/i, "homestyle"],
  [/kahve|coffee|kafe|cafe|çay|tea/i, "cafe"],
  [/tatlı|tatli|dessert|dondurma|ice cream|pasta|cake|baklava/i, "dessert"],
  [/kahvaltı|kahvalti|breakfast|brunch/i, "breakfast"],
  [/balık|balik|fish|seafood|deniz/i, "seafood"],
  [/sushi|çin|chinese|japon|japanese|asya|asian|uzak ?doğu|noodle|ramen/i, "asian"],
  [/italyan|italian|makarna|pasta/i, "italian"],
  [/tavuk|chicken|kanat|wings/i, "chicken"],
  [/et|steak|ızgara|izgara|grill|mangal|barbecue/i, "grill"],
  [/tost|sandviç|sandvic|sandwich|kumpir|wrap/i, "sandwich"],
  [/vegan|vejetaryen|vegetarian|salata|salad/i, "vegetarian"],
];

/** Genel "yemek yemek istiyorum" niyeti; belirli bir mutfak belirtmese bile kafe/tatlıcı istemediğini gösterir. */
const MEAL =
  /yemek|yemeği|yemegi|yiyecek|yiyelim|yiyeyim|yiyebil|yesem|yesek|acıktım|aciktim|acıktık|aciktik|açım|aç|karnım|karnim|doyurucu|doyay|öğle|ogle|akşam|aksam|restoran|lunch|dinner|meal|food|hungry|eat|restaurant/i;

/** Tek başına öğün sayılmayan kategoriler. */
const NON_MEAL_CATEGORIES = ["cafe", "dessert"];

/** Mekanda kafe/tatlı dışında yemek sunduğunu gösteren bir kategori var mı? */
export function servesMeals(place) {
  return place.categories.some((c) => !NON_MEAL_CATEGORIES.includes(c));
}

function matchesWords(re, text) {
  const normalized = ` ${text.toLocaleLowerCase("tr")} `;
  const source = re.source.split("|").map((w) => (w.length <= 3 ? `[\\s,.!?]${w}[\\s,.!?]` : w));
  return new RegExp(source.join("|"), "i").test(normalized);
}

/**
 * Kullanıcı yemek mi istiyor? "Yemek", "acıktım" gibi genel ifadeler ya da yalnızca yemek mutfakları
 * (pizza, kebap...) geçiyorsa evet; kahve/tatlı istendiyse hayır.
 */
export function wantsMeal(text, cats = detectCategories(text)) {
  if (cats.some((c) => NON_MEAL_CATEGORIES.includes(c))) return false;
  return cats.length > 0 || matchesWords(MEAL, text);
}

/** Mesaj yemek/kahve konusunda açık bir şey söylüyor mu? ("başka?", "daha yakın olsun" söylemez.) */
function hasFoodSignal(text, cats = detectCategories(text)) {
  return cats.length > 0 || matchesWords(MEAL, text);
}

/**
 * Sohbetin tamamına bakarak yemek niyetini bulur. Son mesaj konu belirtmiyorsa ("başka var mı?",
 * "daha ucuz olsun") bir önceki kullanıcı mesajındaki niyet geçerli kalır; böylece takip sorularında
 * kafeler geri gelmez. `userTexts` eskiden yeniye sıralıdır.
 */
export function conversationWantsMeal(userTexts) {
  for (const text of [...userTexts].reverse().slice(0, 4)) {
    const cats = detectCategories(text);
    if (hasFoodSignal(text, cats)) return wantsMeal(text, cats);
  }
  return false;
}

const CHEAP =/ucuz|ekonomik|uygun fiyat|hesaplı|hesapli|bütçe|butce|cheap|budget|affordable|inexpensive/i;
const PRICEY = /lüks|luks|şık|sik|özel gün|ozel gun|romantik|fancy|luxury|upscale|romantic|special/i;
const NEAR = /yakın|yakin|yürüme|yurume|hemen|near|close|walking|nearby/i;

export function detectCategories(text) {
  const found = new Set();
  for (const [re, cat] of KEYWORDS) {
    if (matchesWords(re, text)) found.add(cat);
  }
  return [...found];
}

export function ruleBasedReply(req) {
  const tr = req.locale === "tr";
  const last = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const cats = detectCategories(last);
  const cheap = CHEAP.test(last);
  const pricey = PRICEY.test(last);
  const near = NEAR.test(last);

  let pool = req.places;
  // Yemek istendiğinde (mutfak bulunamasa bile) sadece kahve/tatlı sunan mekanları önerme.
  const userTexts = req.messages.filter((m) => m.role === "user").map((m) => m.content);
  if (conversationWantsMeal(userTexts)) pool = pool.filter(servesMeals);
  const matched = cats.length ? pool.filter((p) => p.categories.some((c) => cats.includes(c))) : [];
  const cuisineMatched = matched.length > 0;
  if (cuisineMatched) pool = matched;
  if (cheap) pool = pool.filter((p) => p.priceLevel <= 2);
  if (pricey) pool = pool.filter((p) => p.priceLevel >= 3);

  const specialization = (p) => (cuisineMatched ? Math.min(p.categories.length, 3) : 0);
  const sorted = [...pool].sort(
    (a, b) => specialization(a) - specialization(b) || (near ? a.distance - b.distance : b.score - a.score),
  );
  const picks = sorted.slice(0, 3);

  if (picks.length === 0) {
    return {
      reply: tr
        ? "Bu isteğe uyan bir mekan bulamadım. Mesafeyi artırmayı ya da farklı bir mutfak denemeyi önerebilirim."
        : "I couldn't find a place matching that. Try increasing the distance or a different cuisine.",
      placeIds: [],
      mode: "rules",
    };
  }

  const bits = [];
  if (cuisineMatched) bits.push(tr ? "istediğin mutfağa" : "the cuisine you asked for");
  if (cheap) bits.push(tr ? "uygun fiyata" : "a lower price");
  if (pricey) bits.push(tr ? "özel bir deneyime" : "a special experience");
  if (near) bits.push(tr ? "yakınlığa" : "proximity");
  const why = bits.length
    ? tr
      ? `${bits.join(", ")} göre`
      : `based on ${bits.join(", ")}`
    : tr
      ? "tercihlerine göre"
      : "based on your preferences";

  const lines = picks.map((p) => {
    const d = p.distance < 1000 ? `${Math.round(p.distance)} m` : `${(p.distance / 1000).toFixed(1)} km`;
    return `• ${p.name} — ${d}, ${"₺".repeat(p.priceLevel)}`;
  });

  return {
    reply: tr
      ? `${why.charAt(0).toLocaleUpperCase("tr") + why.slice(1)} en iyi seçenekler:\n${lines.join("\n")}`
      : `Top picks ${why}:\n${lines.join("\n")}`,
    placeIds: picks.map((p) => p.id),
    mode: "rules",
  };
}

/**
 * @param allScored  Puanlanmış mekanlar (önce kişisel öneriler)
 * @param message    Son kullanıcı mesajı
 * @param previousUserTexts  Önceki kullanıcı mesajları (eskiden yeniye), takip sorularında niyeti korumak için
 * @param fallback   `allScored` içinde yemek yeri yoksa bakılacak tüm yakın mekanlar
 */
export function selectChatCandidates(allScored, message, previousUserTexts = [], fallback = []) {
  const cats = detectCategories(message);
  let scored = allScored;
  // Yakındaki yüksek puanlı kafeler aday listesini doldurmasın: yemek istendiyse onları baştan ele.
  if (conversationWantsMeal([...previousUserTexts, message])) {
    scored = allScored.filter((s) => servesMeals(s.place));
    // Tercihler (ör. sadece kafe türü) yüzünden hiç yemek yeri kalmadıysa tüm yakın mekanlara bak.
    if (scored.length === 0) scored = fallback.filter((s) => servesMeals(s.place));
  }
  const third = MAX_CHAT_PLACES / 3;
  const groups = [
    cats.length ? scored.filter((s) => s.place.categories.some((c) => cats.includes(c))).slice(0, third) : [],
    scored.slice(0, third),
    [...scored].sort((a, b) => a.distance - b.distance).slice(0, third),
  ];
  const unique = new Map(groups.flat().map((s) => [s.place.id, s]));
  return [...unique.values()].slice(0, MAX_CHAT_PLACES).map(({ place, distance, score }) => ({
    id: place.id,
    name: place.name,
    type: place.type,
    categories: place.categories,
    cuisines: place.cuisines,
    distance: Math.round(distance),
    priceLevel: place.priceLevel,
    score,
    vegan: place.vegan,
    vegetarian: place.vegetarian,
    openingHours: place.openingHours,
  }));
}

export function buildSystemPrompt(req) {
  const lang = req.locale === "tr" ? "Türkçe" : "English";
  const places = req.places
    .map(
      (p) =>
        `${p.id} | ${p.name} | ${p.type} | ${[...p.categories, ...p.cuisines].join(",")} | ${Math.round(p.distance)}m | price ${p.priceLevel}/4 | score ${p.score}${p.vegan ? " | vegan" : ""}${p.vegetarian ? " | vegetarian" : ""}${p.openingHours ? ` | hours: ${p.openingHours}` : ""}`,
    )
    .join("\n");
  return `You are "Lezzet Asistanı", a friendly food & venue recommendation assistant inside a map app.
Always answer in ${lang}. Be concise (max ~90 words), warm and practical.

RULES:
- Recommend ONLY places from the CANDIDATES list below. Never invent places, ratings or menus.
- Prefer places with higher "score" (personal match 0-100) unless the user asks otherwise (e.g. nearest, cheapest).
- Prices are 1-4 levels (often estimated); describe them as ekonomik/orta/pahalı (or budget/moderate/pricey).
- If the user wants food or a meal (yemek, acıktım, lunch, dinner, a dish or cuisine), do NOT recommend cafes, coffee shops or dessert shops whose cuisines are only "cafe"/"dessert". Recommend those only when the user asks for coffee, tea, dessert or a cafe.
- Mention distance in meters/km. Recommend 1-3 places and briefly say why each fits.
- If the request is unrelated to food/venues, politely steer back.
- Put the ids of the places you recommend in "placeIds", in the order you mention them.

USER PREFERENCES: cuisines=${req.preferences.cuisines.join(",") || "any"}, maxDistance=${req.preferences.maxDistance}m, priceRange=${req.preferences.priceRange.join("-")}

CANDIDATES (id | name | type | cuisines | distance | price | score | extras):
${places || "(none loaded yet)"}`;
}
