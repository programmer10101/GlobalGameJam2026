import type { Point } from "../data/types";

export interface Scene {
  onEnter?(): void | Promise<void>
  onExit?(): void

  update(dt: number): void
  render(): void
  onResize?(): void

  onPointerDown?(p: Point): void
  onPointerMove?(p: Point): void
  onPointerUp?(p: Point): void

  onKeyDown?: (e: KeyboardEvent) => void
}

