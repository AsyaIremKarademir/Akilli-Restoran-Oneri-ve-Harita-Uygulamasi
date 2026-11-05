export const ORIGIN = { lat: 39.9208, lon: 32.8541 };

export const north = (meters) => ({ lat: ORIGIN.lat + meters / 111_195, lon: ORIGIN.lon });

export function makePlace(overrides = {}) {
  const { meters = 300, ...rest } = overrides;
  return {
    id: "node/1",
    name: "Test Mekan",
    type: "restaurant",
    cuisines: [],
    categories: ["other"],
    ...north(meters),
    priceLevel: 2,
    priceEstimated: false,
    ...rest,
  };
}

export const PREFS = {
  cuisines: [],
  maxDistance: 1500,
  priceRange: [1, 3],
  placeTypes: ["restaurant", "fast_food", "cafe"],
  vegetarian: false,
  vegan: false,
  wheelchair: false,
};
