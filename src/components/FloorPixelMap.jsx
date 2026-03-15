import { useEffect, useMemo, useRef, useState } from 'react'

const MAP_WIDTH = 640
const MAP_HEIGHT = 384
const LABEL_FONT = '"Press Start 2P", monospace'
const LABEL_PAD_X = 8
const LABEL_WIDTH = 16

const ROOM_THEME = {
  intake: { floor: '#8e7248', wall: '#3e2f20', accent: '#e2be89' },
  structuring: { floor: '#72658f', wall: '#312747', accent: '#cabbea' },
  ops: { floor: '#8a7052', wall: '#3b3021', accent: '#dcc8a7' },
  classification: { floor: '#4e7192', wall: '#22364e', accent: '#aed3f5' },
  validation: { floor: '#4b7580', wall: '#213d44', accent: '#a2e0e8' },
  risk: { floor: '#865050', wall: '#3b2022', accent: '#f0b6b2' },
  evidence: { floor: '#4f7665', wall: '#223830', accent: '#9fd6bf' },
  timeline: { floor: '#567495', wall: '#263a4f', accent: '#abcde9' },
  witness: { floor: '#6d658a', wall: '#2d2542', accent: '#c8bee7' },
  policy: { floor: '#727359', wall: '#353627', accent: '#cfd6aa' },
  advocate: { floor: '#855f5a', wall: '#3e2b28', accent: '#ddb7ac' },
  balanced: { floor: '#576c63', wall: '#273930', accent: '#a8ccb8' },
  deliberation: { floor: '#5d5f90', wall: '#2a2b4b', accent: '#bfbbe8' },
  fairness: { floor: '#5a7493', wall: '#28394d', accent: '#add0ec' },
  verdict: { floor: '#876075', wall: '#3b2631', accent: '#e5b8cd' },
  judge: { floor: '#90734a', wall: '#40301e', accent: '#e9cf9a' },
  audit: { floor: '#58728a', wall: '#27384a', accent: '#a4d4ee' },
}

const loadImage = (url) =>
  new Promise((resolve) => {
    if (!url) {
      resolve(null)
      return
    }
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })

const useSpriteCache = (rooms) => {
  const [cache, setCache] = useState({})
  const urls = useMemo(
    () => [...new Set(rooms.flatMap((room) => Object.values(room.assets || {})).filter(Boolean))],
    [rooms],
  )

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const loaded = await Promise.all(urls.map(async (url) => [url, await loadImage(url)]))
      if (!cancelled) {
        setCache(Object.fromEntries(loaded))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [urls])

  return cache
}

const floorLayout = (template, roomCount) => {
  if (template === 'split_wings') {
    return {
      shell: { x: 20, y: 18, w: 540, h: 346 },
      corridor: { x: 32, y: 172, w: 516, h: 22 },
      core: { x: 246, y: 206, w: 88, h: 46 },
      rooms: [
        { x: 32, y: 34, w: 160, h: 124 },
        { x: 206, y: 34, w: 160, h: 124 },
        { x: 380, y: 34, w: 160, h: 124 },
        { x: 104, y: 212, w: 198, h: 138 },
        { x: 318, y: 212, w: 198, h: 138 },
      ],
    }
  }

  if (template === 'ring_chambers') {
    const fiveRoomLayout = [
      { x: 50, y: 34, w: 152, h: 132 },
      { x: 244, y: 34, w: 152, h: 132 },
      { x: 438, y: 34, w: 102, h: 132 },
      { x: 96, y: 208, w: 198, h: 140 },
      { x: 306, y: 208, w: 198, h: 140 },
    ]
    return {
      shell: { x: 20, y: 18, w: 540, h: 346 },
      corridor: { x: 40, y: 176, w: 500, h: 18 },
      core: { x: 250, y: 186, w: 80, h: 42 },
      rooms:
        roomCount <= 5
          ? fiveRoomLayout
          : [
              { x: 40, y: 34, w: 92, h: 130 },
              { x: 144, y: 34, w: 92, h: 130 },
              { x: 248, y: 34, w: 92, h: 130 },
              { x: 352, y: 34, w: 92, h: 130 },
              { x: 456, y: 34, w: 84, h: 130 },
              { x: 40, y: 204, w: 92, h: 146 },
              { x: 144, y: 204, w: 92, h: 146 },
              { x: 248, y: 204, w: 92, h: 146 },
              { x: 352, y: 204, w: 92, h: 146 },
              { x: 456, y: 204, w: 84, h: 146 },
            ],
    }
  }

  return {
    shell: { x: 20, y: 18, w: 540, h: 346 },
    corridor: { x: 270, y: 32, w: 20, h: 318 },
    core: { x: 44, y: 172, w: 492, h: 20 },
    rooms: [
      { x: 44, y: 32, w: 218, h: 130 },
      { x: 298, y: 32, w: 218, h: 130 },
      { x: 44, y: 202, w: 218, h: 148 },
      { x: 298, y: 202, w: 218, h: 148 },
    ],
  }
}

const trimText = (context, text, maxWidth) => {
  if (context.measureText(text).width <= maxWidth) {
    return text
  }
  let output = text
  while (output.length > 0 && context.measureText(`${output}..`).width > maxWidth) {
    output = output.slice(0, -1)
  }
  return `${output}..`
}

const drawSprite = (context, cache, path, x, y, width, height, fallbackColor) => {
  const image = path ? cache[path] : null
  if (image) {
    context.drawImage(image, x, y, width, height)
    return
  }
  context.fillStyle = fallbackColor
  context.fillRect(x, y, width, height)
}

const drawSpriteContain = (context, cache, path, x, y, width, height, fallbackColor) => {
  const image = path ? cache[path] : null
  if (!image) {
    context.fillStyle = fallbackColor
    context.fillRect(x, y, width, height)
    return
  }
  const scale = Math.min(width / image.width, height / image.height)
  const drawWidth = Math.max(1, Math.floor(image.width * scale))
  const drawHeight = Math.max(1, Math.floor(image.height * scale))
  const offsetX = x + Math.floor((width - drawWidth) / 2)
  const offsetY = y + Math.floor((height - drawHeight) / 2)
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
}

const drawRoomLabel = (context, rect, room) => {
  const labelWidth = Math.max(74, rect.w - LABEL_WIDTH)
  const labelX = rect.x + LABEL_PAD_X
  const labelY = rect.y + 12

  context.fillStyle = 'rgba(8, 13, 22, 0.9)'
  context.fillRect(labelX, labelY, labelWidth, 42)
  context.strokeStyle = 'rgba(171, 195, 227, 0.45)'
  context.lineWidth = 1
  context.strokeRect(labelX, labelY, labelWidth, 42)

  context.font = `700 9px ${LABEL_FONT}`
  context.fillStyle = '#f6e4bf'
  context.fillText(room.code, labelX + 4, labelY + 5)

  context.font = `8px ${LABEL_FONT}`
  context.fillStyle = '#d8e8ff'
  context.fillText(trimText(context, room.roleLabel, labelWidth - 8), labelX + 4, labelY + 17)

  context.fillStyle = '#e6d6a3'
  context.fillText(trimText(context, room.taskLabel, labelWidth - 8), labelX + 4, labelY + 29)
}

const drawInterior = (context, roomRect, room, cache, tick) => {
  const monitorBlink = Math.floor(tick / 24) % 2 === 0
  const deskX = roomRect.x + 10
  const deskY = roomRect.y + roomRect.h - 30
  const deskWidth = roomRect.w - 20

  drawSpriteContain(
    context,
    cache,
    room.assets?.desk,
    deskX,
    deskY,
    deskWidth,
    16,
    '#63482d',
  )

  drawSpriteContain(
    context,
    cache,
    room.assets?.prop,
    roomRect.x + 10,
    roomRect.y + roomRect.h - 74,
    30,
    38,
    '#665445',
  )

  if (room.interiorTheme === 'policy' || room.interiorTheme === 'judge') {
    drawSpriteContain(
      context,
      cache,
      room.assets?.prop,
      roomRect.x + roomRect.w - 44,
      roomRect.y + roomRect.h - 78,
      30,
      38,
      '#6a6437',
    )
    drawSpriteContain(
      context,
      cache,
      room.assets?.monitor,
      roomRect.x + Math.floor(roomRect.w / 2) - 12,
      deskY - 16,
      24,
      14,
      monitorBlink ? '#8feaff' : '#6da7ce',
    )
    return
  }

  if (room.interiorTheme === 'evidence' || room.interiorTheme === 'timeline') {
    drawSpriteContain(
      context,
      cache,
      room.assets?.monitor,
      roomRect.x + 16,
      deskY - 18,
      22,
      14,
      monitorBlink ? '#8feaff' : '#6da7ce',
    )
    drawSpriteContain(
      context,
      cache,
      room.assets?.monitor,
      roomRect.x + roomRect.w - 38,
      deskY - 18,
      22,
      14,
      monitorBlink ? '#8feaff' : '#6da7ce',
    )
    return
  }

  if (room.interiorTheme === 'audit' || room.interiorTheme === 'validation') {
    for (let idx = 0; idx < 3; idx += 1) {
      drawSpriteContain(
        context,
        cache,
        room.assets?.monitor,
        roomRect.x + 10 + idx * 20,
        deskY - 16,
        18,
        14,
        monitorBlink ? '#8feaff' : '#6da7ce',
      )
    }
    return
  }

  if (room.interiorTheme === 'verdict' || room.interiorTheme === 'deliberation') {
    drawSpriteContain(
      context,
      cache,
      room.assets?.prop,
      roomRect.x + Math.floor(roomRect.w / 2) - 10,
      roomRect.y + roomRect.h - 78,
      20,
      38,
      '#d5c27a',
    )
    drawSpriteContain(
      context,
      cache,
      room.assets?.monitor,
      roomRect.x + Math.floor(roomRect.w / 2) - 11,
      deskY - 17,
      22,
      14,
      monitorBlink ? '#8feaff' : '#6da7ce',
    )
    return
  }

  drawSpriteContain(
    context,
    cache,
    room.assets?.monitor,
    roomRect.x + 14,
    deskY - 16,
    18,
    14,
    monitorBlink ? '#8feaff' : '#6da7ce',
  )
}

const createNpcs = (rooms, roomRects) =>
  rooms.flatMap((room) => {
    const rect = roomRects[room.id]
    if (!rect) {
      return []
    }
    return Array.from({ length: room.npcs }, (_, index) => ({
      id: `${room.id}-${index}`,
      roomId: room.id,
      x: rect.x + 12 + ((index * 17 + room.id.length * 9) % Math.max(10, rect.w - 24)),
      y: rect.y + 74 + ((index * 13 + room.name.length * 3) % Math.max(10, rect.h - 86)),
      tx: rect.x + 16,
      ty: rect.y + 78,
      phase: (index + room.name.length) % 10,
    }))
  })

function FloorPixelMap({ floor, activeRooms, completedRooms }) {
  const canvasRef = useRef(null)
  const tickRef = useRef(0)
  const activeRef = useRef(new Set(activeRooms))
  const doneRef = useRef(new Set(completedRooms))
  const spriteCache = useSpriteCache(floor.rooms)

  const layout = useMemo(
    () => floorLayout(floor.layoutTemplate, floor.rooms.length),
    [floor.layoutTemplate, floor.rooms.length],
  )

  const roomRects = useMemo(
    () =>
      Object.fromEntries(
        floor.rooms.map((room, index) => [room.id, layout.rooms[index] || layout.rooms.at(-1)]),
      ),
    [floor.rooms, layout.rooms],
  )

  useEffect(() => {
    activeRef.current = new Set(activeRooms)
    doneRef.current = new Set(completedRooms)
  }, [activeRooms, completedRooms])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) {
      return undefined
    }

    const dpr = Math.max(1, window.devicePixelRatio || 1)
    canvas.width = MAP_WIDTH * dpr
    canvas.height = MAP_HEIGHT * dpr
    context.imageSmoothingEnabled = false
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.textBaseline = 'top'
    context.textAlign = 'left'

    const npcs = createNpcs(floor.rooms, roomRects)
    let frameId

    const randomTarget = (rect) => ({
      x: rect.x + 10 + Math.random() * Math.max(8, rect.w - 22),
      y: rect.y + 70 + Math.random() * Math.max(8, rect.h - 84),
    })

    const draw = () => {
      tickRef.current += 1
      const tick = tickRef.current

      context.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT)

      context.fillStyle = '#121b2c'
      context.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT)

      for (let x = 0; x < MAP_WIDTH; x += 8) {
        for (let y = 0; y < MAP_HEIGHT; y += 8) {
          context.fillStyle = (x + y) % 16 === 0 ? '#182438' : '#1b2940'
          context.fillRect(x, y, 8, 8)
        }
      }

      context.fillStyle = '#25354f'
      context.fillRect(layout.shell.x, layout.shell.y, layout.shell.w, layout.shell.h)
      context.strokeStyle = '#6f89ae'
      context.lineWidth = 2
      context.strokeRect(layout.shell.x, layout.shell.y, layout.shell.w, layout.shell.h)

      context.fillStyle = '#344866'
      context.fillRect(layout.corridor.x, layout.corridor.y, layout.corridor.w, layout.corridor.h)
      context.fillStyle = '#2b405d'
      context.fillRect(layout.core.x, layout.core.y, layout.core.w, layout.core.h)

      floor.rooms.forEach((room) => {
        const rect = roomRects[room.id]
        const active = activeRef.current.has(room.id)
        const done = doneRef.current.has(room.id)
        const theme = ROOM_THEME[room.interiorTheme] || ROOM_THEME.ops

        context.fillStyle = '#0e1624'
        context.fillRect(rect.x + 3, rect.y + 3, rect.w, rect.h)

        context.fillStyle = done ? '#456a57' : theme.floor
        context.fillRect(rect.x, rect.y, rect.w, rect.h)

        drawSprite(
          context,
          spriteCache,
          room.assets?.wall,
          rect.x + 1,
          rect.y + 1,
          rect.w - 2,
          rect.h - 2,
          theme.floor,
        )

        context.fillStyle = done ? 'rgba(69, 106, 87, 0.3)' : 'rgba(29, 43, 64, 0.2)'
        context.fillRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2)

        context.fillStyle = theme.wall
        context.fillRect(rect.x, rect.y, rect.w, 10)
        context.fillRect(rect.x, rect.y, 5, rect.h)

        context.strokeStyle = active ? '#ffd99f' : done ? '#95d9b8' : '#4b6386'
        context.lineWidth = active ? 2 : 1
        context.strokeRect(rect.x, rect.y, rect.w, rect.h)

        drawInterior(context, rect, room, spriteCache, tick)
        drawRoomLabel(context, rect, room)

        context.fillStyle = '#132036'
        context.fillRect(rect.x + Math.floor(rect.w / 2) - 8, rect.y + rect.h - 4, 16, 4)
      })

      npcs.forEach((npc) => {
        const rect = roomRects[npc.roomId]
        if (!rect) {
          return
        }

        const active = activeRef.current.has(npc.roomId)
        const done = doneRef.current.has(npc.roomId)

        if (Math.random() < (active ? 0.03 : done ? 0.015 : 0.006)) {
          const target = randomTarget(rect)
          npc.tx = target.x
          npc.ty = target.y
        }

        const dx = npc.tx - npc.x
        const dy = npc.ty - npc.y
        const distance = Math.hypot(dx, dy)
        if (distance > 0.4) {
          const speed = active ? 0.55 : done ? 0.26 : 0.14
          npc.x += (dx / distance) * speed
          npc.y += (dy / distance) * speed
        }

        npc.phase += active ? 0.28 : 0.12
        const bob = Math.sin(npc.phase) > 0.2 ? 1 : 0
        const px = Math.floor(npc.x)
        const py = Math.floor(npc.y) - bob

        context.fillStyle = '#1c232d'
        context.fillRect(px - 2, py + 8, 6, 1)
        context.fillStyle = '#efc7a0'
        context.fillRect(px, py, 2, 2)
        context.fillStyle = active ? '#90d3ff' : '#7f99bd'
        context.fillRect(px - 1, py + 2, 4, 4)
        context.fillStyle = '#4b5e7a'
        context.fillRect(px - 1, py + 6, 1, 2)
        context.fillRect(px + 2, py + 6, 1, 2)

        if (active && Math.floor(tick / 12) % 2 === 0) {
          context.fillStyle = '#f9fcff'
          context.fillRect(px - 3, py - 9, 10, 6)
          context.fillStyle = '#edf5ff'
          context.fillRect(px - 2, py - 8, 8, 4)
          context.fillStyle = '#2f4766'
          context.fillRect(px - 1, py - 7, 1, 1)
          context.fillRect(px + 1, py - 7, 1, 1)
          context.fillRect(px + 3, py - 7, 1, 1)
        }
      })

      frameId = window.requestAnimationFrame(draw)
    }

    frameId = window.requestAnimationFrame(draw)
    return () => window.cancelAnimationFrame(frameId)
  }, [floor, layout, roomRects, spriteCache])

  return (
    <div className="pixel-map-shell">
      <canvas
        ref={canvasRef}
        className="pixel-floor-map"
        aria-label={`Pixel simulation map for ${floor.title}`}
      />
    </div>
  )
}

export default FloorPixelMap
