import type { MaskRect, PlayerStroke } from "../data/types"

/**
 * Returns 0–100 redaction score
 */
export function calculateScore(maskRects: MaskRect[], strokes: PlayerStroke[]): number {
  let hits = 0
  let misses = 0
  const samplesPerRect = 20

  for (const rect of maskRects) {
    for (let i = 0; i < samplesPerRect; i++) {
      const px = rect.x + Math.random() * rect.width
      const py = rect.y + Math.random() * rect.height

      const covered = strokes.some(s => {
        const dx = px - s.x
        const dy = py - s.y
        return Math.sqrt(dx*dx + dy*dy) <= s.radius
      })

      if (covered) hits++
    }
  }

  for (const s of strokes) {
    const insideAny = maskRects.some(r =>
      s.x >= r.x && s.x <= r.x + r.width &&
      s.y >= r.y && s.y <= r.y + r.height
    )
    if (!insideAny) misses++
  }

  const rawScore = hits - misses
  const maxPossible = maskRects.length * samplesPerRect
  return Math.max(0, Math.round((rawScore / maxPossible) * 100))
}
