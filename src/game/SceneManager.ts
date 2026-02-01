import type { Scene } from "./Scene"
import type { Point } from "../data/types";

export class SceneManager {
  private current: Scene | null = null

  async set(scene: Scene) {
    if (this.current?.onExit) {
      this.current.onExit()
    }

    this.current = scene

    if (this.current.onEnter) {
      await this.current.onEnter()
    }
  }

  get currentScene(): Scene | null {
    return this.current
  }

  update(dt: number) {
    this.current?.update(dt)
  }

  render() {
    this.current?.render()
  }

  onPointerDown(p: Point) {
    this.current?.onPointerDown?.(p)
  }

  onPointerMove(p: Point) {
    this.current?.onPointerMove?.(p)
  }

  onPointerUp(p: Point) {
    this.current?.onPointerUp?.(p)
  }
}
