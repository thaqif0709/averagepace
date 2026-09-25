// Current world records (men's and women's) for the four distances
// Averagepace tracks (DISTANCE_LABELS in the backend/frontend). Update
// `digits`/`holder`/`year` here whenever one of these falls - there's no
// live data source for this, it's just for the logged-out hero's ticker.
// digits is always 6 characters: HH:MM:SS with no separators, e.g. a 12:35
// 5K becomes "00" + "12" + "35".
//
// distanceLabel naming is deliberately inconsistent, matching how these are
// actually titled: track events (5K/10K) are run and recorded as genuinely
// separate "Men's"/"Women's" competitions, so both get that prefix. Road
// records (half marathon, marathon) aren't split that way for men - "the
// marathon world record" has no official "Men's" title, it's just The
// Record - so those two are unprefixed. The split does exist officially on
// the women's side for road races: "mixed-sex race" vs "women-only race"
// categories, since mixed races let women draft off male pacers and run
// faster. We use the mixed-sex time here (the one usually meant by "the
// women's world record"), which is also why it's the *women's* label doing
// the disambiguating work here, not a men's one.
export const WORLD_RECORDS = [
  { distanceLabel: "Men's 5K", digits: '001235', holder: 'Joshua Cheptegei', year: 2020 },
  { distanceLabel: "Women's 5K", digits: '001358', holder: 'Beatrice Chebet', year: 2025 },
  { distanceLabel: "Men's 10K", digits: '002611', holder: 'Joshua Cheptegei', year: 2020 },
  { distanceLabel: "Women's 10K", digits: '002854', holder: 'Beatrice Chebet', year: 2024 },
  { distanceLabel: 'Half Marathon', digits: '005651', holder: 'Yomif Kejelcha', year: 2026 },
  { distanceLabel: "Women's Half Marathon", digits: '010252', holder: 'Letesenbet Gidey', year: 2021 },
  { distanceLabel: 'Marathon', digits: '015930', holder: 'Sabastian Sawe', year: 2026 },
  { distanceLabel: "Women's Marathon", digits: '020956', holder: "Ruth Chepng'etich", year: 2024 },
]
