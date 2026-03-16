import { useEffect, useMemo, useRef, useState } from 'react'
import { Application, Assets, Graphics, Sprite, Text, TextStyle } from 'pixi.js'

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

const getExtraFloorAssets = (floorId) => (floorId === 'level-1' ? LEVEL_ONE_EXTRA_ASSETS : [])

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

function FloorPixelMap({ floor, activeRooms, completedRooms }) {
  const mountRef = useRef(null)
  const appRef = useRef(null)

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

  const extraAssets = useMemo(() => getExtraFloorAssets(floor.id), [floor.id])
  const textures = useTextureCache(floor.rooms, extraAssets)

  useEffect(() => {
    let cancelled = false
    const mountEl = mountRef.current

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
      mountEl.innerHTML = ''
      mountEl.appendChild(view)
      app.stage.removeChildren()

      const staticContainer = app.stage
      if (floor.id === 'level-1') {
        drawLevelOneScene(
          staticContainer,
          layout,
          roomRects,
          floor,
          textures,
          new Set(activeRooms),
          new Set(completedRooms),
        )
      } else {
        drawStandardScene(
          staticContainer,
          layout,
          roomRects,
          floor,
          textures,
          new Set(activeRooms),
          new Set(completedRooms),
        )
      }

      const npcs = createNpcs(floor.rooms, roomRects)
      const npcLayer = new Graphics()
      app.stage.addChild(npcLayer)

      const activeSet = new Set(activeRooms)
      const doneSet = new Set(completedRooms)

      const randomTarget = (rect) => ({
        x: rect.x + 10 + Math.random() * Math.max(8, rect.w - 22),
        y: rect.y + 70 + Math.random() * Math.max(8, rect.h - 84),
      })

      app.ticker.maxFPS = 30
      app.ticker.add(() => {
        npcLayer.clear()

        npcs.forEach((npc) => {
          const rect = roomRects[npc.roomId]
          if (!rect) {
            return
          }

          const active = activeSet.has(npc.roomId)
          const done = doneSet.has(npc.roomId)

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

          npcLayer.beginFill(0x1c232d)
          npcLayer.drawRect(px - 2, py + 8, 6, 1)
          npcLayer.endFill()

          npcLayer.beginFill(0xefc7a0)
          npcLayer.drawRect(px, py, 2, 2)
          npcLayer.endFill()

          npcLayer.beginFill(active ? 0x90d3ff : 0x7f99bd)
          npcLayer.drawRect(px - 1, py + 2, 4, 4)
          npcLayer.endFill()

          npcLayer.beginFill(0x4b5e7a)
          npcLayer.drawRect(px - 1, py + 6, 1, 2)
          npcLayer.drawRect(px + 2, py + 6, 1, 2)
          npcLayer.endFill()

          if (active && Math.floor(app.ticker.lastTime / 200) % 2 === 0) {
            npcLayer.beginFill(0xf9fcff)
            npcLayer.drawRect(px - 3, py - 9, 10, 6)
            npcLayer.endFill()

            npcLayer.beginFill(0x2f4766)
            npcLayer.drawRect(px - 1, py - 7, 1, 1)
            npcLayer.drawRect(px + 1, py - 7, 1, 1)
            npcLayer.drawRect(px + 3, py - 7, 1, 1)
            npcLayer.endFill()
          }
        })
      })

      appRef.current = app
    }

    run()

    return () => {
      cancelled = true
      if (appRef.current) {
        appRef.current.destroy(true)
        appRef.current = null
      }
      if (mountEl) mountEl.innerHTML = ''
    }
  }, [completedRooms, floor, layout, roomRects, textures, activeRooms])

  return (
    <div className="pixel-map-shell">
      <div ref={mountRef} aria-label={`Pixel simulation map for ${floor.title}`} />
    </div>
  )
}

export default FloorPixelMap
