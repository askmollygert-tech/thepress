export type HoleState = "unplayed" | "partial" | "complete" | "current";

export function strokesOnHole(playingHandicap: number, strokeIndex: number) {
  if (playingHandicap >= 0) {
    return Math.floor(playingHandicap / 18) + (strokeIndex <= playingHandicap % 18 ? 1 : 0);
  }
  const plus = Math.abs(playingHandicap);
  const strokes = Math.floor(plus / 18) + (strokeIndex > 18 - (plus % 18) ? 1 : 0);
  return strokes === 0 ? 0 : -strokes;
}

export function netScore(grossScore: number, playingHandicap: number, strokeIndex: number) {
  return grossScore - strokesOnHole(playingHandicap, strokeIndex);
}

export function stablefordPoints(grossScore: number, par: number, playingHandicap: number, strokeIndex: number) {
  return Math.max(0, 2 + par - netScore(grossScore, playingHandicap, strokeIndex));
}

export function holeState(
  holeNumber: number,
  currentHole: number,
  playerIds: number[],
  scores: Record<number, Record<number, number>>,
): HoleState {
  if (holeNumber === currentHole) return "current";
  const count = playerIds.filter((id) => Number.isInteger(scores[holeNumber]?.[id]) && scores[holeNumber][id] > 0).length;
  if (count === 0) return "unplayed";
  return count === playerIds.length ? "complete" : "partial";
}

export function playingOrder(startingHole: number, totalHoles = 18) {
  const start = Math.min(Math.max(startingHole, 1), totalHoles);
  return [...Array(totalHoles)].map((_, index) => ((start - 1 + index) % totalHoles) + 1);
}

export function nextHole(currentHole: number, startingHole: number, totalHoles = 18) {
  const order = playingOrder(startingHole, totalHoles);
  const index = order.indexOf(currentHole);
  return order[Math.min(index + 1, order.length - 1)];
}

export function matchPosition(
  completedHoles: number[],
  players: Array<{ id: number; handicap: number; team: "A" | "B" }>,
  scores: Record<number, Record<number, number>>,
  holes: Array<{ number: number; stroke: number }>,
) {
  let teamA = 0;
  let teamB = 0;
  for (const number of completedHoles) {
    const hole = holes.find((item) => item.number === number);
    const row = scores[number];
    if (!hole || !row || players.some((player) => !row[player.id])) continue;
    const best = (team: "A" | "B") => Math.min(...players.filter((player) => player.team === team).map((player) => netScore(row[player.id], player.handicap, hole.stroke)));
    if (best("A") < best("B")) teamA += 1;
    if (best("B") < best("A")) teamB += 1;
  }
  return { teamA, teamB, difference: teamA - teamB };
}
