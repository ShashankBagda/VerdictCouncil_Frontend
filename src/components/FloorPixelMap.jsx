import { useEffect, useMemo, useRef, useState } from 'react'
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js'

const MAP_WIDTH = 640
const MAP_HEIGHT = 384

const ROOM_THEME = {
  intake: { floor: 0x8e7248, wall: 0x3e2f20 },
  structuring: { floor: 0x72658f, wall: 0x312747 },
  ops: { floor: 0x8a7052, wall: 0x3b3021 },
  classification: { floor: 0x4e7192, wall: 0x22364e },
  validation: { floor: 0x4b7580, wall: 0x213d44 },
  risk: { floor: 0x865050, wall: 0x3b2022 },
  evidence: { floor: 0x4f7665, wall: 0x223830 },
  timeline: { floor: 0x567495, wall: 0x263a4f },
  witness: { floor: 0x6d658a, wall: 0x2d2542 },
  policy: { floor: 0x727359, wall: 0x353627 },
  advocate: { floor: 0x855f5a, wall: 0x3e2b28 },
  balanced: { floor: 0x576c63, wall: 0x273930 },
  deliberation: { floor: 0x5d5f90, wall: 0x2a2b4b },
  fairness: { floor: 0x5a7493, wall: 0x28394d },
  verdict: { floor: 0x876075, wall: 0x3b2631 },
  judge: { floor: 0x90734a, wall: 0x40301e },
  audit: { floor: 0x58728a, wall: 0x27384a },
}

const LEVEL_ONE_EXTRA_ASSETS = [
  '/pixel-assets/l1/Boss-Desk.png',
  '/pixel-assets/l1/Desk-2.png',
  '/pixel-assets/l1/Desk.png',
  '/pixel-assets/l1/Big-Sofa.png',
  '/pixel-assets/l1/Big-Sofa-2.png',
  '/pixel-assets/l1/Tall-Bookshelf.png',
  '/pixel-assets/l1/Big-Filing-Cabinet.png',
  '/pixel-assets/l1/Filing-Cabinet-Tall.png',
  '/pixel-assets/l1/Big-Office-Printer.png',
  '/pixel-assets/l1/Small-Plant.png',
  '/pixel-assets/l1/Wall-Clock.png',
  '/pixel-assets/l1/Wall-Note-2.png',
  '/pixel-assets/l1/Wall-Graph.png',
]

const NPC_SPRITES = [
  '/free-office-pixel-art/worker1.png',
  '/free-office-pixel-art/worker2.png',
  '/free-office-pixel-art/worker4.png',
  '/free-office-pixel-art/Julia-Idle.png',
]

const SUPPORT_DECOR_ASSETS = [
  '/pixel-assets/props/itch_bookshelf.png',
  '/pixel-assets/props/itch_small_drawer.png',
  '/pixel-assets/walls/kenney_dirt_tile.png',
]

const getExtraFloorAssets = (floorId) => (floorId === 'floor-1' ? LEVEL_ONE_EXTRA_ASSETS : [])

const floorLayout = (template, roomCount) => {
  const shell = { x: 20, y: 18, w: 540, h: 346 }

  if (template === 'split_wings') {
    if (roomCount <= 3) {
      return {
        shell,
        corridor: { x: 40, y: 176, w: 500, h: 20 },
        core: { x: 254, y: 162, w: 72, h: 48 },
        rooms: [
          { x: 44, y: 34, w: 154, h: 136 },
          { x: 222, y: 34, w: 154, h: 136 },
          { x: 400, y: 34, w: 130, h: 136 },
          { x: 180, y: 214, w: 202, h: 128 },
        ],
        supportZones: [
          { x: 42, y: 214, w: 124, h: 128 },
          { x: 396, y: 214, w: 134, h: 128 },
        ],
      }
    }

    return {
      shell,
      corridor: { x: 32, y: 172, w: 516, h: 22 },
      core: { x: 246, y: 206, w: 88, h: 46 },
      rooms: [
        { x: 32, y: 34, w: 160, h: 124 },
        { x: 206, y: 34, w: 160, h: 124 },
        { x: 380, y: 34, w: 160, h: 124 },
        { x: 104, y: 212, w: 198, h: 138 },
        { x: 318, y: 212, w: 198, h: 138 },
      ],
      supportZones: [],
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
      shell,
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
      supportZones: [],
    }
  }

  if (roomCount === 2) {
    return {
      shell,
      corridor: { x: 44, y: 196, w: 492, h: 20 },
      core: { x: 264, y: 34, w: 12, h: 308 },
      rooms: [
        { x: 44, y: 34, w: 232, h: 154 },
        { x: 304, y: 34, w: 232, h: 154 },
      ],
      supportZones: [
        { x: 44, y: 224, w: 232, h: 118 },
        { x: 304, y: 224, w: 232, h: 118 },
      ],
    }
  }

  if (roomCount === 3) {
    return {
      shell,
      corridor: { x: 44, y: 184, w: 492, h: 20 },
      core: { x: 264, y: 34, w: 12, h: 308 },
      rooms: [
        { x: 44, y: 34, w: 232, h: 138 },
        { x: 304, y: 34, w: 232, h: 138 },
        { x: 174, y: 216, w: 232, h: 126 },
      ],
      supportZones: [
        { x: 44, y: 216, w: 116, h: 126 },
        { x: 420, y: 216, w: 116, h: 126 },
      ],
    }
  }

  return {
    shell,
    corridor: { x: 270, y: 32, w: 20, h: 318 },
    core: { x: 44, y: 172, w: 492, h: 20 },
    rooms: [
      { x: 44, y: 32, w: 218, h: 130 },
      { x: 298, y: 32, w: 218, h: 130 },
      { x: 44, y: 202, w: 218, h: 148 },
      { x: 298, y: 202, w: 218, h: 148 },
    ],
    supportZones: [],
  }
}

const trimText = (text, maxChars) => {
  if (text.length <= maxChars) {
    return text
  }
  return `${text.slice(0, Math.max(1, maxChars - 2))}..`
}

const createNpcs = (rooms, roomRects) =>
  rooms.flatMap((room) => {
    const rect = roomRects[room.id]
    if (!rect) {
      return []
    }

    const npcCount = Number.isFinite(room.npcs)
      ? Math.max(1, Math.min(3, Math.ceil(room.npcs / 2)))
      : 1
    const roomName = room.label || room.name || room.id

    return Array.from({ length: npcCount }, (_, index) => ({
      id: `${room.id}-${index}`,
      roomId: room.id,
      x: rect.x + 26 + index * 30,
      y: rect.y + rect.h - 30 - ((index + room.id.length) % 2) * 12,
      tx: rect.x + 26 + index * 30,
      ty: rect.y + rect.h - 30 - ((index + room.id.length) % 2) * 12,
      phase: (index + roomName.length) % 10,
      homeX: rect.x + 26 + index * 30,
      homeY: rect.y + rect.h - 30 - ((index + room.id.length) % 2) * 12,
      driftRadius: 8 + ((index + roomName.length) % 3) * 2,
      spriteUrl: NPC_SPRITES[(index + room.id.length) % NPC_SPRITES.length],
      sprite: null,
    }))
  })

const roomCenter = (rect) => ({
  x: rect.x + rect.w / 2,
  y: rect.y + rect.h / 2,
})

const mapPointerToCanvas = (view, clientX, clientY) => {
  const bounds = view.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return null
  return {
    x: ((clientX - bounds.left) / bounds.width) * MAP_WIDTH,
    y: ((clientY - bounds.top) / bounds.height) * MAP_HEIGHT,
  }
}

const useTextureCache = (rooms, extraUrls = []) => {
  const [textures, setTextures] = useState({})

  const urls = useMemo(
    () =>
      [
        ...new Set(
          [...rooms.flatMap((room) => Object.values(room.assets || {})), ...extraUrls].filter(
            Boolean,
          ),
        ),
      ],
    [extraUrls, rooms],
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const entries = await Promise.all(
        urls.map(async (url) => {
          try {
            const texture = await Assets.load(url)
            return [url, texture]
          } catch {
            console.warn(`Failed to load pixel asset: ${url}`)
            return [url, null]
          }
        }),
      )

      if (!cancelled) {
        setTextures(Object.fromEntries(entries))
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [urls])

  return textures
}

const drawRect = (container, x, y, w, h, color, alpha = 1) => {
  const g = new Graphics()
  g.beginFill(color, alpha)
  g.drawRect(x, y, w, h)
  g.endFill()
  container.addChild(g)
}

const drawStrokeRect = (container, x, y, w, h, color, width = 1, alpha = 1) => {
  const g = new Graphics()
  g.lineStyle(width, color, alpha)
  g.drawRect(x, y, w, h)
  container.addChild(g)
}

const drawSpriteRect = (container, texture, x, y, w, h) => {
  if (!texture) {
    return
  }
  const sprite = new Sprite(texture)
  sprite.x = x
  sprite.y = y
  sprite.width = w
  sprite.height = h
  container.addChild(sprite)
}

const drawSpriteScaled = (container, texture, x, y, scale = 2) => {
  if (!texture) {
    return
  }
  const sprite = new Sprite(texture)
  sprite.x = x
  sprite.y = y
  sprite.scale.set(scale, scale)
  container.addChild(sprite)
}

const drawRoomLabel = (container, rect, room) => {
  drawRect(container, rect.x + 8, rect.y + 12, Math.max(74, rect.w - 16), 42, 0x080d16, 0.9)
  drawStrokeRect(container, rect.x + 8, rect.y + 12, Math.max(74, rect.w - 16), 42, 0xabc3e3, 1, 0.5)

  const codeStyle = new TextStyle({
    fill: '#f6e4bf',
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
  })
  const bodyStyle = new TextStyle({
    fill: '#d8e8ff',
    fontFamily: 'monospace',
    fontSize: 8,
  })
  const taskStyle = new TextStyle({
    fill: '#e6d6a3',
    fontFamily: 'monospace',
    fontSize: 8,
  })

  const code = new Text({ text: room.code, style: codeStyle })
  code.x = rect.x + 12
  code.y = rect.y + 17
  container.addChild(code)

  const role = new Text({ text: trimText(room.roleLabel, 26), style: bodyStyle })
  role.x = rect.x + 12
  role.y = rect.y + 29
  container.addChild(role)

  const task = new Text({ text: trimText(room.taskLabel, 28), style: taskStyle })
  task.x = rect.x + 12
  task.y = rect.y + 40
  container.addChild(task)
}

const drawLevelOneScene = (container, layout, roomRects, floor, textures, activeSet, doneSet) => {
  drawRect(container, 0, 0, MAP_WIDTH, MAP_HEIGHT, 0x7c725f)

  for (let x = 0; x < MAP_WIDTH; x += 16) {
    for (let y = 0; y < MAP_HEIGHT; y += 16) {
      const tone = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 0xc7bea9 : 0xbdb29d
      drawRect(container, x, y, 16, 16, tone)
    }
  }

  drawRect(container, layout.shell.x - 4, layout.shell.y - 4, layout.shell.w + 8, layout.shell.h + 8, 0xcfbf9b)
  drawRect(container, layout.shell.x, layout.shell.y, layout.shell.w, layout.shell.h, 0x7d5a3d)
  drawRect(container, layout.shell.x + 4, layout.shell.y + 4, layout.shell.w - 8, layout.shell.h - 8, 0xdccdb0)

  for (let x = layout.corridor.x; x < layout.corridor.x + layout.corridor.w; x += 16) {
    for (let y = layout.corridor.y; y < layout.corridor.y + layout.corridor.h; y += 16) {
      const tone = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 0x9fa0a0 : 0x8f9192
      drawRect(container, x, y, 16, 16, tone)
    }
  }

  for (let x = layout.core.x; x < layout.core.x + layout.core.w; x += 16) {
    for (let y = layout.core.y; y < layout.core.y + layout.core.h; y += 16) {
      const tone = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 0x9fa0a0 : 0x8f9192
      drawRect(container, x, y, 16, 16, tone)
    }
  }

  floor.rooms.forEach((room) => {
    const rect = roomRects[room.id]
    const active = activeSet.has(room.id)
    const done = doneSet.has(room.id)

    for (let x = rect.x + 3; x < rect.x + rect.w - 3; x += 16) {
      for (let y = rect.y + 3; y < rect.y + rect.h - 3; y += 16) {
        const tone = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 0x98683a : 0x905f31
        drawRect(container, x, y, 16, 16, tone)
      }
    }

    drawRect(container, rect.x + 3, rect.y + 3, rect.w - 6, 28, 0xe2d5bd)
    drawRect(container, rect.x + 3, rect.y + 31, rect.w - 6, 5, 0x6f4c33)
    drawRect(container, rect.x + Math.floor(rect.w / 2) - 12, rect.y + rect.h - 5, 24, 5, 0x6b4c30)
    drawStrokeRect(container, rect.x, rect.y, rect.w, rect.h, active ? 0xffd99f : done ? 0x95d9b8 : 0x8f6e4b, active ? 2 : 1)
  })

  const receptionRect = roomRects.reception
  if (receptionRect) {
    drawRect(container, receptionRect.x + 14, receptionRect.y + 50, receptionRect.w - 30, 12, 0x8f653f)
    drawRect(container, receptionRect.x + 14, receptionRect.y + 62, receptionRect.w - 30, 5, 0x704326)
    drawRect(container, receptionRect.x + 22, receptionRect.y + 70, receptionRect.w - 46, 14, 0x9f7c56)
  }

  const furniture = {
    bossDesk: textures['/pixel-assets/l1/Boss-Desk.png'],
    desk2: textures['/pixel-assets/l1/Desk-2.png'],
    desk: textures['/pixel-assets/l1/Desk.png'],
    sofa: textures['/pixel-assets/l1/Big-Sofa.png'],
    sofa2: textures['/pixel-assets/l1/Big-Sofa-2.png'],
    shelf: textures['/pixel-assets/l1/Tall-Bookshelf.png'],
    cabinet: textures['/pixel-assets/l1/Big-Filing-Cabinet.png'],
    filingTall: textures['/pixel-assets/l1/Filing-Cabinet-Tall.png'],
    printer: textures['/pixel-assets/l1/Big-Office-Printer.png'],
    plant: textures['/pixel-assets/l1/Small-Plant.png'],
    clock: textures['/pixel-assets/l1/Wall-Clock.png'],
    wallNote: textures['/pixel-assets/l1/Wall-Note-2.png'],
    graph: textures['/pixel-assets/l1/Wall-Graph.png'],
  }

  drawSpriteScaled(container, furniture.bossDesk, 60, 98, 2)
  drawSpriteScaled(container, furniture.desk2, 122, 98, 2)
  drawSpriteScaled(container, furniture.printer, 170, 96, 2)
  drawSpriteScaled(container, furniture.wallNote, 108, 62, 2)
  drawSpriteScaled(container, furniture.clock, 271, 62, 2)

  drawSpriteScaled(container, furniture.bossDesk, 356, 98, 2)
  drawSpriteScaled(container, furniture.desk, 418, 98, 2)
  drawSpriteScaled(container, furniture.shelf, 484, 82, 2)
  drawSpriteScaled(container, furniture.cabinet, 344, 80, 2)
  drawSpriteScaled(container, furniture.graph, 392, 62, 2)

  drawSpriteScaled(container, furniture.sofa, 76, 268, 2)
  drawSpriteScaled(container, furniture.sofa2, 170, 268, 2)
  drawSpriteScaled(container, furniture.plant, 56, 210, 2)
  drawSpriteScaled(container, furniture.plant, 232, 210, 2)

  drawSpriteScaled(container, furniture.desk2, 344, 290, 2)
  drawSpriteScaled(container, furniture.bossDesk, 418, 290, 2)
  drawSpriteScaled(container, furniture.shelf, 480, 274, 2)
  drawSpriteScaled(container, furniture.filingTall, 338, 268, 2)
  drawSpriteScaled(container, furniture.printer, 516, 288, 2)
  drawSpriteScaled(container, furniture.plant, 522, 182, 2)

  const elevatorX = layout.shell.x + layout.shell.w - 82
  const elevatorY = layout.corridor.y + 148
  drawRect(container, elevatorX, elevatorY, 54, 36, 0x5d6f81)
  drawRect(container, elevatorX + 4, elevatorY + 6, 21, 26, 0xa0b0c0)
  drawRect(container, elevatorX + 29, elevatorY + 6, 21, 26, 0xa0b0c0)
  drawRect(container, elevatorX + 52, elevatorY + 8, 4, 6, 0x334454)
  drawRect(container, elevatorX + 53, elevatorY + 9, 2, 2, 0xce3f3f)

  const entranceX = layout.shell.x + Math.floor(layout.shell.w / 2) - 30
  const entranceY = layout.shell.y + layout.shell.h - 20
  drawRect(container, entranceX, entranceY, 60, 18, 0x5d6f81)
  drawRect(container, entranceX + 5, entranceY + 3, 24, 13, 0x8ea8be)
  drawRect(container, entranceX + 31, entranceY + 3, 24, 13, 0x8ea8be)
  drawRect(container, entranceX + 29, entranceY + 3, 2, 13, 0x2f4357)

  floor.rooms.forEach((room) => {
    const rect = roomRects[room.id]
    drawRoomLabel(container, rect, room)
  })
}

const drawStandardScene = (container, layout, roomRects, floor, textures, activeSet, doneSet) => {
  drawRect(container, 0, 0, MAP_WIDTH, MAP_HEIGHT, 0x121b2c)

  for (let x = 0; x < MAP_WIDTH; x += 8) {
    for (let y = 0; y < MAP_HEIGHT; y += 8) {
      const tone = (x + y) % 16 === 0 ? 0x182438 : 0x1b2940
      drawRect(container, x, y, 8, 8, tone)
    }
  }

  drawRect(container, layout.shell.x, layout.shell.y, layout.shell.w, layout.shell.h, 0x25354f)
  drawStrokeRect(container, layout.shell.x, layout.shell.y, layout.shell.w, layout.shell.h, 0x6f89ae, 2)
  drawRect(container, layout.corridor.x, layout.corridor.y, layout.corridor.w, layout.corridor.h, 0x344866)
  drawRect(container, layout.core.x, layout.core.y, layout.core.w, layout.core.h, 0x2b405d)

  ;(layout.supportZones || []).forEach((zone, index) => {
    const tone = index % 2 === 0 ? 0x2a3e5c : 0x2d4666
    drawRect(container, zone.x, zone.y, zone.w, zone.h, tone)
    drawStrokeRect(container, zone.x, zone.y, zone.w, zone.h, 0x4b6386, 1)
    drawSpriteRect(container, textures['/pixel-assets/walls/kenney_dirt_tile.png'], zone.x + 2, zone.y + 2, zone.w - 4, zone.h - 4)
    drawSpriteRect(container, textures['/pixel-assets/props/itch_bookshelf.png'], zone.x + 10, zone.y + zone.h - 52, 34, 42)
    drawSpriteRect(container, textures['/pixel-assets/props/itch_small_drawer.png'], zone.x + zone.w - 42, zone.y + zone.h - 36, 28, 24)
  })

  floor.rooms.forEach((room) => {
    const rect = roomRects[room.id]
    const active = activeSet.has(room.id)
    const done = doneSet.has(room.id)
    const theme = ROOM_THEME[room.interiorTheme] || ROOM_THEME.ops

    drawRect(container, rect.x + 3, rect.y + 3, rect.w, rect.h, 0x0e1624)
    drawRect(container, rect.x, rect.y, rect.w, rect.h, done ? 0x456a57 : theme.floor)

    drawSpriteRect(container, textures[room.assets?.wall], rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2)

    drawRect(container, rect.x, rect.y, rect.w, 10, theme.wall)
    drawRect(container, rect.x, rect.y, 5, rect.h, theme.wall)
    drawStrokeRect(container, rect.x, rect.y, rect.w, rect.h, active ? 0xffd99f : done ? 0x95d9b8 : 0x4b6386, active ? 2 : 1)

    drawSpriteRect(container, textures[room.assets?.desk], rect.x + 10, rect.y + rect.h - 30, rect.w - 20, 16)
    drawSpriteRect(container, textures[room.assets?.prop], rect.x + 10, rect.y + rect.h - 74, 30, 38)
    drawSpriteRect(container, textures[room.assets?.monitor], rect.x + rect.w - 36, rect.y + rect.h - 44, 24, 14)

    drawRoomLabel(container, rect, room)
    drawRect(container, rect.x + Math.floor(rect.w / 2) - 8, rect.y + rect.h - 4, 16, 4, 0x132036)
  })
}

function FloorPixelMap({
  floor,
  activeRooms,
  completedRooms,
  failedRooms = [],
  selectedRoomId = null,
  onRoomSelect = null,
}) {
  const mountRef = useRef(null)
  const appRef = useRef(null)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => setReduceMotion(media.matches)
    handleChange()

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange)
      return () => media.removeEventListener('change', handleChange)
    }

    media.addListener(handleChange)
    return () => media.removeListener(handleChange)
  }, [])

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

  const extraAssets = useMemo(
    () => [...getExtraFloorAssets(floor.id), ...NPC_SPRITES, ...SUPPORT_DECOR_ASSETS],
    [floor.id],
  )
  const textures = useTextureCache(floor.rooms, extraAssets)

  const activeRoomsRef = useRef(new Set(activeRooms))
  const completedRoomsRef = useRef(new Set(completedRooms))
  const failedRoomsRef = useRef(new Set(failedRooms))
  const selectedRoomRef = useRef(selectedRoomId)

  useEffect(() => {
    activeRoomsRef.current = new Set(activeRooms)
    completedRoomsRef.current = new Set(completedRooms)
    failedRoomsRef.current = new Set(failedRooms)
    selectedRoomRef.current = selectedRoomId
  }, [activeRooms, completedRooms, failedRooms, selectedRoomId])

  useEffect(() => {
    let cancelled = false
    const mountEl = mountRef.current
    let detachPointerHandlers = () => {}

    const run = async () => {
      if (!mountEl) {
        return
      }

      const app = new Application()
      await app.init({
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        backgroundAlpha: 1,
        backgroundColor: 0x101925,
        antialias: false,
        autoDensity: true,
        resolution: Math.max(1, window.devicePixelRatio || 1),
      })

      if (cancelled) {
        app.destroy(true)
        return
      }

      const view = app.canvas
      view.className = 'pixel-floor-map'
      view.title = 'Select a room to inspect agent activity'
      view.style.width = '100%'
      view.style.height = '100%'
      view.style.imageRendering = 'pixelated'
      view.style.touchAction = 'none'
      mountEl.innerHTML = ''
      mountEl.appendChild(view)
      app.stage.removeChildren()

      const activeSet = activeRoomsRef.current
      const doneSet = completedRoomsRef.current

      const staticContainer = app.stage
      if (floor.id === 'floor-1') {
        drawLevelOneScene(
          staticContainer,
          layout,
          roomRects,
          floor,
          textures,
          activeSet,
          doneSet,
        )
      } else {
        drawStandardScene(
          staticContainer,
          layout,
          roomRects,
          floor,
          textures,
          activeSet,
          doneSet,
        )
      }

      const npcs = createNpcs(floor.rooms, roomRects)
      const effectsLayer = new Graphics()
      const npcShadowLayer = new Graphics()
      const npcSpriteLayer = new Container()
      app.stage.addChild(effectsLayer)
      app.stage.addChild(npcShadowLayer)
      app.stage.addChild(npcSpriteLayer)

      npcs.forEach((npc) => {
        const texture = textures[npc.spriteUrl]
        if (!texture) {
          return
        }
        const sprite = new Sprite(texture)
        sprite.anchor.set(0.5, 1)
        sprite.scale.set(1.15, 1.15)
        sprite.alpha = 0.95
        sprite.x = Math.floor(npc.x)
        sprite.y = Math.floor(npc.y + 8)
        npcSpriteLayer.addChild(sprite)
        npc.sprite = sprite
      })

      const elevatorTarget = {
        x: layout.shell.x + layout.shell.w - 56,
        y: layout.shell.y + layout.shell.h / 2,
      }

      const roomLinks = floor.rooms.flatMap((room) => {
        const fromRect = roomRects[room.id]
        if (!fromRect) return []
        const links = Array.isArray(room.linksTo) ? room.linksTo : []
        return links.map((targetId, index) => {
          const targetRect = roomRects[targetId]
          return {
            id: `${room.id}-${targetId}-${index}`,
            fromId: room.id,
            toId: targetId,
            from: roomCenter(fromRect),
            to: targetRect ? roomCenter(targetRect) : elevatorTarget,
            progress: Math.random(),
            speed: 0.006 + Math.random() * 0.008,
          }
        })
      })

      const roomAtPoint = (x, y) =>
        floor.rooms.find((room) => {
          const rect = roomRects[room.id]
          if (!rect) return false
          return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
        })

      const handlePointerMove = (event) => {
        const point = mapPointerToCanvas(view, event.clientX, event.clientY)
        if (!point) return
        const hit = roomAtPoint(point.x, point.y)
        view.style.cursor = hit ? 'pointer' : 'default'
      }

      const handlePointerDown = (event) => {
        if (typeof onRoomSelect !== 'function') return
        const point = mapPointerToCanvas(view, event.clientX, event.clientY)
        if (!point) return
        const hit = roomAtPoint(point.x, point.y)
        if (hit) {
          onRoomSelect(hit.id)
        }
      }

      view.addEventListener('pointermove', handlePointerMove)
      view.addEventListener('pointerdown', handlePointerDown)
      detachPointerHandlers = () => {
        view.removeEventListener('pointermove', handlePointerMove)
        view.removeEventListener('pointerdown', handlePointerDown)
      }

      app.ticker.maxFPS = 30
      app.ticker.maxFPS = reduceMotion ? 14 : 30
      app.ticker.add(() => {
        const pulse = (Math.sin(app.ticker.lastTime / 240) + 1) / 2
        const activeSetLive = activeRoomsRef.current
        const doneSetLive = completedRoomsRef.current
        const failedSetLive = failedRoomsRef.current
        const selectedSet = selectedRoomRef.current ? new Set([selectedRoomRef.current]) : new Set()

        effectsLayer.clear()

        floor.rooms.forEach((room) => {
          const rect = roomRects[room.id]
          if (!rect) return
          const active = activeSetLive.has(room.id)
          const done = doneSetLive.has(room.id)
          const failed = failedSetLive.has(room.id)
          const selected = selectedSet.has(room.id)

          if (active) {
            effectsLayer.beginFill(0x55cfff, 0.1 + pulse * 0.12)
            effectsLayer.drawRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4)
            effectsLayer.endFill()
          }

          if (done) {
            effectsLayer.lineStyle(1, 0x97f5be, 0.55)
            effectsLayer.drawRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2)
          }

          if (failed) {
            effectsLayer.beginFill(0xff6688, 0.09 + pulse * 0.07)
            effectsLayer.drawRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4)
            effectsLayer.endFill()
            effectsLayer.lineStyle(2, 0xff6a84, 0.85)
            effectsLayer.drawRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2)
          }

          if (selected) {
            effectsLayer.lineStyle(2, 0x5ce8ff, 0.95)
            effectsLayer.drawRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4)
          }

          if (!reduceMotion && active && Math.floor(app.ticker.lastTime / 420) % 2 === 0) {
            const c = roomCenter(rect)
            effectsLayer.beginFill(0xf8feff, 0.88)
            effectsLayer.drawRoundedRect(c.x - 20, rect.y - 14, 40, 10, 3)
            effectsLayer.endFill()
            effectsLayer.beginFill(0x2d4b6a, 0.85)
            effectsLayer.drawRect(c.x - 8, rect.y - 10, 2, 2)
            effectsLayer.drawRect(c.x - 2, rect.y - 10, 2, 2)
            effectsLayer.drawRect(c.x + 4, rect.y - 10, 2, 2)
            effectsLayer.endFill()
          }
        })

        roomLinks.forEach((link) => {
          if (reduceMotion) return
          if (!activeSetLive.has(link.fromId)) return
          link.progress += link.speed
          if (link.progress >= 1) link.progress -= 1

          effectsLayer.lineStyle(1, 0x69d6ff, 0.25)
          effectsLayer.moveTo(link.from.x, link.from.y)
          effectsLayer.lineTo(link.to.x, link.to.y)

          const px = link.from.x + (link.to.x - link.from.x) * link.progress
          const py = link.from.y + (link.to.y - link.from.y) * link.progress
          effectsLayer.beginFill(0xd8f8ff, 0.95)
          effectsLayer.drawRect(px - 2, py - 2, 4, 4)
          effectsLayer.endFill()
        })

        npcShadowLayer.clear()

        npcs.forEach((npc) => {
          const rect = roomRects[npc.roomId]
          if (!rect) {
            return
          }

          const active = activeSetLive.has(npc.roomId)
          const done = doneSetLive.has(npc.roomId)
          const failed = failedSetLive.has(npc.roomId)

          const t = app.ticker.lastTime / 560
          const motionScale = active ? 1 : done ? 0.35 : failed ? 0.12 : 0.2
          npc.tx = npc.homeX + Math.sin(t + npc.phase) * npc.driftRadius * motionScale
          npc.ty = npc.homeY + Math.cos(t * 0.8 + npc.phase) * npc.driftRadius * 0.55 * motionScale

          const dx = npc.tx - npc.x
          const dy = npc.ty - npc.y
          const distance = Math.hypot(dx, dy)
          if (distance > 0.4) {
            const speed = reduceMotion
              ? active ? 0.22 : failed ? 0.12 : done ? 0.15 : 0.09
              : active ? 0.42 : failed ? 0.15 : done ? 0.2 : 0.1
            npc.x += (dx / distance) * speed
            npc.y += (dy / distance) * speed
          }

          npc.phase += active ? 0.31 : failed ? 0.16 : 0.12
          const bob = Math.sin(npc.phase) > 0.2 ? 1 : 0
          const px = Math.floor(npc.x)
          const py = Math.floor(npc.y) - bob

          npcShadowLayer.beginFill(0x1c232d, 0.55)
          npcShadowLayer.drawEllipse(px + 1, py + 8, 4, 1.8)
          npcShadowLayer.endFill()

          if (npc.sprite) {
            npc.sprite.x = px + 1
            npc.sprite.y = py + 9
            npc.sprite.alpha = failed ? 0.82 : done ? 0.86 : 0.96
            npc.sprite.tint = failed ? 0xff9ab4 : active ? 0xffffff : 0xc8d8f0
            npc.sprite.scale.set(active ? 1.2 : 1.15, active ? 1.2 : 1.15)
          } else {
            npcShadowLayer.beginFill(0xefc7a0)
            npcShadowLayer.drawRect(px, py, 2, 2)
            npcShadowLayer.endFill()

            npcShadowLayer.beginFill(failed ? 0xff89a4 : active ? 0x90d3ff : 0x7f99bd)
            npcShadowLayer.drawRect(px - 1, py + 2, 4, 4)
            npcShadowLayer.endFill()

            npcShadowLayer.beginFill(0x4b5e7a)
            npcShadowLayer.drawRect(px - 1, py + 6, 1, 2)
            npcShadowLayer.drawRect(px + 2, py + 6, 1, 2)
            npcShadowLayer.endFill()
          }

          if (active && Math.floor(app.ticker.lastTime / 200) % 2 === 0) {
            npcShadowLayer.beginFill(0xf9fcff)
            npcShadowLayer.drawRect(px - 3, py - 9, 10, 6)
            npcShadowLayer.endFill()

            npcShadowLayer.beginFill(0x2f4766)
            npcShadowLayer.drawRect(px - 1, py - 7, 1, 1)
            npcShadowLayer.drawRect(px + 1, py - 7, 1, 1)
            npcShadowLayer.drawRect(px + 3, py - 7, 1, 1)
            npcShadowLayer.endFill()
          }

          if (failed && Math.floor(app.ticker.lastTime / 260) % 2 === 0) {
            npcShadowLayer.beginFill(0xffdbdf)
            npcShadowLayer.drawRect(px - 2, py - 8, 8, 5)
            npcShadowLayer.endFill()

            npcShadowLayer.beginFill(0xa53a56)
            npcShadowLayer.drawRect(px + 1, py - 7, 1, 3)
            npcShadowLayer.endFill()
          }
        })
      })

      appRef.current = app
    }

    run()

    return () => {
      cancelled = true
      detachPointerHandlers()
      if (appRef.current) {
        appRef.current.destroy(true)
        appRef.current = null
      }
      if (mountEl) mountEl.innerHTML = ''
    }
  }, [
    floor,
    layout,
    roomRects,
    textures,
    onRoomSelect,
    reduceMotion,
  ])

  return (
    <div className="pixel-map-shell">
      <div ref={mountRef} aria-label={`Pixel simulation map for ${floor.title}`} />
    </div>
  )
}

export default FloorPixelMap
