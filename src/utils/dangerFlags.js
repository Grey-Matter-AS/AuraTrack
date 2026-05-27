// Thresholds
const LONG_DURATION_S   = 300;              // 5 minutes
const CLUSTER_WINDOW_MS = 8 * 60 * 1000;   // 8 minutes
const CLUSTER_MIN       = 3;               // 3+ events = cluster

/**
 * Returns { flags: string[], clusterCount: number } for a single event.
 *   flags may include: 'long_duration', 'cluster'
 *   clusterCount is the total events found in the ±8-min window (0 when no cluster)
 */
export function computeDangerFlags(event, allEvents = []) {
  const flags = [];

  if ((event.duration || 0) > LONG_DURATION_S) {
    flags.push('long_duration');
  }

  const nearby = allEvents.filter(e =>
    Math.abs((e.startTime || 0) - (event.startTime || 0)) <= CLUSTER_WINDOW_MS
  );
  const clusterCount = nearby.length;
  if (clusterCount >= CLUSTER_MIN) {
    flags.push('cluster');
  }

  return { flags, clusterCount };
}

/**
 * Build a { id → { flags, clusterCount } } map for an entire list efficiently.
 * Sorted with early-termination sliding window — O(n·k).
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
    let clusterCount = 1;
    for (let j = i - 1; j >= 0 && t - (sorted[j].startTime || 0) <= CLUSTER_WINDOW_MS; j--) {
      clusterCount++;
    }
    for (let j = i + 1; j < sorted.length && (sorted[j].startTime || 0) - t <= CLUSTER_WINDOW_MS; j++) {
      clusterCount++;
    }
    if (clusterCount >= CLUSTER_MIN) flags.push('cluster');

    map[event.id] = { flags, clusterCount };
  }
  return map;
}
