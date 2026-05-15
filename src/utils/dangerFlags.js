// Thresholds
const LONG_DURATION_S  = 300;   // 5 minutes
const CLUSTER_WINDOW_MS = 8 * 60 * 1000; // 8 minutes
const CLUSTER_MIN      = 3;     // 3+ events = cluster

/**
 * Returns an array of flag strings for a single event, given the full list.
 *   'long_duration' — total recorded duration > 5 minutes
 *   'cluster'       — 3+ events within 8 min window, none with confirmed recovery
 */
export function computeDangerFlags(event, allEvents = []) {
  const flags = [];

  if ((event.duration || 0) > LONG_DURATION_S) {
    flags.push('long_duration');
  }

  // Cluster: count events (including this one) within ±8 min with no confirmed recovery
  const nearby = allEvents.filter(e =>
    Math.abs((e.startTime || 0) - (event.startTime || 0)) <= CLUSTER_WINDOW_MS &&
    !e.laps?.recovery
  );
  if (nearby.length >= CLUSTER_MIN) {
    flags.push('cluster');
  }

  return flags;
}

/**
 * Build a dangerFlags map (id → flags[]) for an entire list in one pass.
 * Use this in list views instead of calling computeDangerFlags per event.
 */
export function buildDangerMap(allEvents) {
  const map = {};
  for (const event of allEvents) {
    map[event.id] = computeDangerFlags(event, allEvents);
  }
  return map;
}
