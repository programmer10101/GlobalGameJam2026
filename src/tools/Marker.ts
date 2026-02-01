import type { Point } from "../data/types"

export class Marker {
  color: string
  radius: number

  constructor({
    color = "yellow",
    radius = 16,
  }: Partial<Marker> = {}) {
    this.color = color
    this.radius = radius
  }

  draw(ctx: CanvasRenderingContext2D, p: Point) {
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, this.radius, 0, Math.PI * 2)
    ctx.fill()
  }
}
