// Current world records (men's and women's) for the four distances
// Averagepace tracks (DISTANCE_LABELS in the backend/frontend). Update
// `digits`/`holder`/`year` here whenever one of these falls - there's no
// live data source for this, it's just for the logged-out hero's ticker.
// digits is always 6 characters: HH:MM:SS with no separators, e.g. a 12:35
// 5K becomes "00" + "12" + "35".
// For the two road distances (half marathon, marathon), women's records
// split into "mixed-sex race" and "women-only race" categories - mixed
// races let women draft off male pacers, so that time is faster. We use
// the mixed-sex time here since that's the one usually meant by "the
// women's world record" (parallel to the men's record, which has no such
// split). Track distances (5K/10K) have no such split either way.
export const WORLD_RECORDS = [
  { distanceLabel: "Men's 5K", digits: '001235', holder: 'Joshua Cheptegei', year: 2020 },
  { distanceLabel: "Women's 5K", digits: '001358', holder: 'Beatrice Chebet', year: 2025 },
  { distanceLabel: "Men's 10K", digits: '002611', holder: 'Joshua Cheptegei', year: 2020 },
  { distanceLabel: "Women's 10K", digits: '002854', holder: 'Beatrice Chebet', year: 2024 },
  { distanceLabel: "Men's Half Marathon", digits: '005651', holder: 'Yomif Kejelcha', year: 2026 },
  { distanceLabel: "Women's Half Marathon", digits: '010252', holder: 'Letesenbet Gidey', year: 2021 },
  { distanceLabel: "Men's Marathon", digits: '015930', holder: 'Sabastian Sawe', year: 2026 },
  { distanceLabel: "Women's Marathon", digits: '020956', holder: "Ruth Chepng'etich", year: 2024 },
]
