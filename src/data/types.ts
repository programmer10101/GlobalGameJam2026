export type Rect = {
  x: number
  y: number
  width: number
  height: number
}

export type Point = {
  x: number
  y: number
}

// Represents a rectangle that should be redacted, normalized 0..1 relative to the document image
export type MaskRect = {
  x: number     // left
  y: number     // top
  width: number
  height: number
}

// Represents a redaction round
export type RedactionMask = {
  prompt: string          // "Remove all traces of Luke"
  imageSrc: string        // path to PNG document
  targetRects: MaskRect[] // list of areas to redact
}

export type PlayerStroke = {
  x: number
  y: number
  radius: number
}