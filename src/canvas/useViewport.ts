import { useCallback, useEffect, useState, type RefObject } from 'react'
import type { Point } from './layout'

/** screen = canvas * k + (x, y), in SVG pixels. */
export type View = { x: number; y: number; k: number }

const clampK = (k: number) => Math.min(4, Math.max(0.15, k))

/**
 * Pan/zoom state for the canvas SVG. Wheel zooms around the cursor (non-passive listener so the page
 * does not scroll). Callers pan with `setView` and convert pointer positions with `toCanvas`.
 */
export function useViewport(svgRef: RefObject<SVGSVGElement | null>) {
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })

  const toCanvas = useCallback(
    (clientX: number, clientY: number): Point => {
      const r = svgRef.current?.getBoundingClientRect()
      return { x: (clientX - (r?.left ?? 0) - view.x) / view.k, y: (clientY - (r?.top ?? 0) - view.y) / view.k }
    },
    [svgRef, view],
  )

  /** Zoom by `factor` around a screen point relative to the SVG (center when omitted). */
  const zoomBy = useCallback(
    (factor: number, at?: Point) => {
      const r = svgRef.current?.getBoundingClientRect()
      const c = at ?? { x: (r?.width ?? 0) / 2, y: (r?.height ?? 0) / 2 }
      setView((v) => {
        const k = clampK(v.k * factor)
        return { k, x: c.x - ((c.x - v.x) * k) / v.k, y: c.y - ((c.y - v.y) * k) / v.k }
      })
    },
    [svgRef],
  )

  /** Fit a canvas-space box into the SVG with some padding. */
  const fit = useCallback(
    (b: { minX: number; minY: number; maxX: number; maxY: number } | null) => {
      const r = svgRef.current?.getBoundingClientRect()
      if (!b || !r || r.width === 0) return
      const pad = 40
      const k = clampK(Math.min((r.width - pad * 2) / (b.maxX - b.minX || 1), (r.height - pad * 2) / (b.maxY - b.minY || 1)))
      setView({ k, x: r.width / 2 - ((b.minX + b.maxX) / 2) * k, y: r.height / 2 - ((b.minY + b.maxY) / 2) * k })
    },
    [svgRef],
  )

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = svg.getBoundingClientRect()
      zoomBy(Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [svgRef, zoomBy])

  return { view, setView, toCanvas, zoomBy, fit }
}
