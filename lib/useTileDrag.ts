import { useState, useRef, useMemo } from 'react'

/**
 * Long-press-to-drag reordering for a horizontal tile row.
 *
 * Usage:
 *   const drag = useTileDrag(orderedIds, setHandOrder)
 *   <div ref={drag.containerRef} onPointerMove={drag.onMove} onPointerUp={drag.onUp} onPointerCancel={drag.onCancel}>
 *     {tiles.map(tile =>
 *       <div key={tile.id} data-drag-id={tile.id} onPointerDown={e => drag.onTileDown(e, tile.id)}
 *            style={drag.tileStyle(tile.id)}>
 *         <TileComponent ... onClick={() => drag.dragging ? undefined : yourClickHandler()} />
 *       </div>
 *     )}
 *   </div>
 *
 * drag.displayIds  — ordered IDs to render (live-updates during drag)
 * drag.dragging    — true while a drag is active (suppress tile clicks)
 */

export function useTileDrag(
  orderedIds: string[],
  setOrderedIds: (fn: (prev: string[]) => string[]) => void
) {
  const containerRef = useRef<HTMLDivElement>(null)

  const dragRef = useRef<{
    id: string
    insertBefore: string | null
    started: boolean
    startX: number
    startY: number
    pointerId: number
  } | null>(null)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressClick = useRef(false)

  const [dragId, setDragId] = useState<string | null>(null)
  const [insertBefore, setInsertBefore] = useState<string | null | undefined>(undefined)

  const displayIds = useMemo(() => {
    if (!dragId || insertBefore === undefined) return orderedIds
    const without = orderedIds.filter(id => id !== dragId)
    if (insertBefore === null) return [...without, dragId]
    const idx = without.indexOf(insertBefore)
    if (idx === -1) return [...without, dragId]
    return [...without.slice(0, idx), dragId, ...without.slice(idx)]
  }, [orderedIds, dragId, insertBefore])

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function onTileDown(e: React.PointerEvent, tileId: string) {
    clearLongPress()
    const currentIdx = orderedIds.indexOf(tileId)
    const currentInsertBefore = currentIdx < orderedIds.length - 1 ? orderedIds[currentIdx + 1] : null
    dragRef.current = {
      id: tileId,
      insertBefore: currentInsertBefore,
      started: false,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
    }

    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      if (!dragRef.current) return
      dragRef.current.started = true
      suppressClick.current = true
      setDragId(tileId)
      setInsertBefore(undefined)
      navigator.vibrate?.(40)
      // Capture pointer on container so moves aren't lost to scroll
      containerRef.current?.setPointerCapture(dragRef.current.pointerId)
    }, 300)
  }

  function onMove(e: React.PointerEvent) {
    if (!dragRef.current) return

    // Cancel long press if finger moved significantly vertically (scroll intent)
    // Allow generous horizontal movement — user may shift finger while pressing
    if (!dragRef.current.started && longPressTimer.current) {
      const dy = Math.abs(e.clientY - dragRef.current.startY)
      const dx = Math.abs(e.clientX - dragRef.current.startX)
      if (dy > 14 || dx > 50) {
        clearLongPress()
        dragRef.current = null
        return
      }
    }

    if (!dragRef.current.started) return
    e.preventDefault()

    const container = containerRef.current
    if (!container) return
    const x = e.clientX

    const els = Array.from(container.querySelectorAll<HTMLElement>('[data-drag-id]'))
    let newInsertBefore: string | null = null
    for (const el of els) {
      const elId = el.dataset.dragId!
      if (elId === dragRef.current.id) continue
      const rect = el.getBoundingClientRect()
      if (x < rect.left + rect.width / 2) {
        newInsertBefore = elId
        break
      }
    }

    if (dragRef.current.insertBefore !== newInsertBefore) {
      dragRef.current.insertBefore = newInsertBefore
      setInsertBefore(newInsertBefore)
    }
  }

  function commitDrag() {
    clearLongPress()
    if (!dragRef.current) return
    const { id, insertBefore: ib, started, pointerId } = dragRef.current
    dragRef.current = null

    if (started) {
      containerRef.current?.releasePointerCapture(pointerId)
      setOrderedIds(prev => {
        const without = prev.filter(x => x !== id)
        if (ib === null) return [...without, id]
        const idx = without.indexOf(ib)
        if (idx === -1) return [...without, id]
        return [...without.slice(0, idx), id, ...without.slice(idx)]
      })
    }

    setDragId(null)
    setInsertBefore(undefined)
  }

  function onUp(_e: React.PointerEvent) {
    commitDrag()
  }

  function onCancel() {
    // Commit current position rather than reverting — prevents accidental snap-back
    commitDrag()
    suppressClick.current = false
  }

  function tileStyle(tileId: string): React.CSSProperties {
    const isLifted = dragId === tileId
    return {
      flexShrink: 0,
      position: 'relative',
      zIndex: isLifted ? 20 : 1,
      transform: isLifted ? 'translateY(-14px) scale(1.1)' : 'translateY(0) scale(1)',
      transition: isLifted ? 'none' : 'transform 0.12s ease',
      filter: isLifted ? 'drop-shadow(0 8px 10px rgba(0,0,0,0.7))' : undefined,
    }
  }

  function consumeClick(): boolean {
    if (suppressClick.current) {
      suppressClick.current = false
      return true
    }
    return false
  }

  return {
    containerRef,
    displayIds,
    dragging: dragId !== null,
    onTileDown,
    onMove,
    onUp,
    onCancel,
    tileStyle,
    consumeClick,
  }
}
