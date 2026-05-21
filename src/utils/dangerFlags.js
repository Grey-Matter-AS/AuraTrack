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
 * Build a dangerFlags map (id → flags[]) for an entire list efficiently.
 * Uses a sorted array with early termination — O(n·k) where k is the average
 * number of events in any 16-minute window (typically very small).
 */
export function buildDangerMap(allEvents) {
  const map = {};
  if (!allEvents.length) return map;

  const sorted = [...allEvents].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i];
    const flags = [];

    if ((event.duration || 0) > LONG_DURATION_S) flags.push('long_duration');

    const t = event.startTime || 0;
    let clusterCount = event.laps?.recovery ? 0 : 1; // count self if no confirmed recovery
    for (let j = i - 1; j >= 0 && t - (sorted[j].startTime || 0) <= CLUSTER_WINDOW_MS; j--) {
      if (!sorted[j].laps?.recovery) clusterCount++;
    }
    for (let j = i + 1; j < sorted.length && (sorted[j].startTime || 0) - t <= CLUSTER_WINDOW_MS; j++) {
      if (!sorted[j].laps?.recovery) clusterCount++;
    }
    if (clusterCount >= CLUSTER_MIN) flags.push('cluster');

    map[event.id] = flags;
  }
  return map;
}
