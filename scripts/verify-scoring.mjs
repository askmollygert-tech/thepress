import assert from "node:assert/strict";
import { holeState, netScore, nextHole, playingOrder, stablefordPoints, strokesOnHole } from "../lib/scoring.ts";

assert.equal(strokesOnHole(14, 14), 1);
assert.equal(strokesOnHole(14, 15), 0);
assert.equal(strokesOnHole(20, 2), 2);
assert.equal(strokesOnHole(20, 3), 1);
assert.equal(strokesOnHole(-2, 17), -1);
assert.equal(strokesOnHole(-2, 16), 0);
assert.equal(netScore(5, 18, 1), 4);
assert.equal(stablefordPoints(5, 4, 18, 1), 2);
assert.deepEqual(playingOrder(10), [10,11,12,13,14,15,16,17,18,1,2,3,4,5,6,7,8,9]);
assert.equal(nextHole(18, 10), 1);
assert.equal(nextHole(9, 10), 9);
assert.equal(holeState(1, 2, [1,2,3,4], { 1: { 1:4,2:5,3:4,4:6 } }), "complete");
assert.equal(holeState(1, 2, [1,2,3,4], { 1: { 1:4,2:5 } }), "partial");
assert.equal(holeState(1, 2, [1,2,3,4], {}), "unplayed");
assert.equal(holeState(2, 2, [1,2,3,4], {}), "current");
console.log("The Press scoring checks passed");

