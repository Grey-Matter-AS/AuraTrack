# D-19: The cluster rule counts seizures inside one window

**Decided:** 2026-11-06, by you ("let's agree to fix the logical inconsistencies in the code right now"). A correction of how the settled rule was computed; the rule itself (3 seizures in 8 minutes, both settings) is unchanged.

## Decision
A seizure is part of a cluster when **one window of the set length (default 8 minutes) holds it and at least the set number of seizures (default 3)**, counted by start time, edges included. The count shown ("3 seizures within 8 min") is the largest such window that holds this seizure.

| Starts (min) | Before | Now |
|---|---|---|
| 0, 4, 8 | cluster (3) | cluster (3) |
| 0, 7, 14 | 7 flagged as a cluster of 3 (14 min from first to last) | no cluster |
| 0, 8, 16 | 8 flagged as a cluster of 3 | no cluster |
| 0, 5, 7, 14 | 0, 5, 7, 14 flagged | 0, 5, 7 flagged; 14 is not |

## Where
`rules/emergency.ts` `clusterCounts` (used by the Home badge, the detail screen, History, every report and the cluster warning at Start). The 6.1 import comparison still compares 6.1's own rule on both sides (it checks that the start times came across) and notes v7's count beside it.

## Why
6.1 counted seizures up to the window length *before and after* each seizure, so a 16-minute span could read as "3 in 8 minutes". That overstates clusters on the badge, in reports and in the warning at Start.
