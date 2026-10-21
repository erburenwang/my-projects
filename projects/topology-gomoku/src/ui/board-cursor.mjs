export function clampCursor(cursor, width, height) {
  return {
    x: Math.max(0, Math.min(width - 1, cursor.x)),
    y: Math.max(0, Math.min(height - 1, cursor.y)),
  };
}
