import type { Point } from "../data/types";

export class Input {
  constructor(
    target: HTMLElement,
    onDown: (p: Point) => void,
    onMove: (p: Point) => void,
    onUp: (p: Point) => void
  ) {
    target.addEventListener("pointerdown", e => {
      onDown(this.getPoint(e, target))
    })

    target.addEventListener("pointermove", e => {
      onMove(this.getPoint(e, target))
    })

    target.addEventListener("pointerup", e => {
      onUp(this.getPoint(e, target))
    })
  }

  private getPoint(e: PointerEvent, target: HTMLElement): Point {
    const rect = target.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }
}
