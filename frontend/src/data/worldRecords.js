// Current men's world records for the four distances Averagepace tracks
// (DISTANCE_LABELS in the backend/frontend). Update `digits`/`holder`/`year`
// here whenever one of these falls - there's no live data source for this,
// it's just for the logged-out hero's ticker.
// digits is always 6 characters: HH:MM:SS with no separators, e.g. a 12:35
// 5K becomes "00" + "12" + "35".
export const WORLD_RECORDS = [
  { distanceLabel: '5K', digits: '001235', holder: 'Joshua Cheptegei', year: 2020 },
  { distanceLabel: '10K', digits: '002611', holder: 'Joshua Cheptegei', year: 2020 },
  { distanceLabel: 'Half Marathon', digits: '005651', holder: 'Yomif Kejelcha', year: 2026 },
  { distanceLabel: 'Marathon', digits: '015930', holder: 'Sabastian Sawe', year: 2026 },
]
