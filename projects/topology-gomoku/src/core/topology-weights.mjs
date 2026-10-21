export const WINDOW_WEIGHTS = Object.freeze([0, 1, 12, 180, 14_000, 1_000_000_000]);

export function scoreWindowCounts(black, white) {
  if (black && white) return 0;
  if (black) return WINDOW_WEIGHTS[black];
  if (white) return -WINDOW_WEIGHTS[white];
  return 0;
}
