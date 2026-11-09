# Collaborative Whiteboard (Excalidraw Clone)

A complete, production-ready, open collaborative whiteboard web app inspired by [excalidraw.com](https://excalidraw.com). Anyone with a link can draw, sketch, and write on a shared infinite canvas, and every change appears instantly for everyone else in the same room. **There is NO login, signup, or accounts of any kind.**

---

## 🌟 Key Features

1. **Instant Rooms & Link-Based Collaboration**
   - Visiting `/` creates a board with an unguessable 11-character random ID and redirects to `/board/:roomId`.
   - The URL is the only permission needed.
   - Prominent **Share** button copies link to clipboard with animated confetti feedback and toasts.
   - Auto-assigned friendly name (e.g., *"Brave Otter"*) and vibrant color, editable at any time.

2. **Hand-Drawn Aesthetics & Canvas Tools**
   - **Rough.js** hand-drawn sketch look for shapes (rectangles, diamonds, ellipses, lines, arrows).
   - **Perfect-freehand** pressure-sensitive, smooth pen strokes.
   - **Infinite Canvas** with smooth panning (Space + drag, middle mouse, two-finger touch) and zoom (Ctrl + wheel, pinch, reset, zoom-to-fit).
   - **Toolbar Tools**:
     - 🔒 Lock tool selection
     - ✋ Hand (Pan canvas)
     - ↖️ Select / Move / Resize (8 handles) / Rotate
     - ⬜ Rectangle
     - 🔶 Diamond
     - ⭕ Ellipse / Circle
     - ➡️ Arrow (with arrowheads)
     - ➖ Line
     - ✏️ Freehand Pen
     - 🔤 Text tool (click anywhere to type; double-click shapes to add attached labels)
     - 🖼️ Image insert (file upload, drag-and-drop, or Ctrl+V paste)
     - 🧼 Eraser tool (drag across elements or click to remove)
     - ✨ Laser Pointer (glowing, fading trails for live presentations)

3. **Floating Style Panel**
   - Stroke color (palette + custom HEX color picker)
   - Background/fill color (transparent, colors + custom HEX picker)
   - Fill style (`Hachure`, `Cross-hatch`, `Solid`, `None`)
   - Stroke width (Thin, Medium, Bold, Extra-bold)
   - Stroke style (`Solid`, `Dashed`, `Dotted`)
   - Sloppiness / Roughness (`Architect`, `Artist`, `Cartoonist`)
   - Opacity slider (10% to 100%)
   - Font size (`S`, `M`, `L`, `XL`), Font family (`Virgil` hand-drawn, `Inter` sans-serif, `Fira Code` mono), Text alignment (`Left`, `Center`, `Right`)
   - Layer ordering (Bring to Front, Bring Forward, Send Backward, Send to Back)
   - Element Actions: Duplicate (`Ctrl+D`), Delete (`Del`/`Backspace`)

4. **Real-Time Synchronization (WebSocket)**
   - Element mutations broadcast in `<50ms`.
   - Throttled pointer/cursor streaming at ~30 fps.
   - **Conflict-free Syncing**: Last-Write-Wins (LWW) per-element with monotonically increasing version numbers and timestamp/nonce tie-breaking.
   - **Per-User Undo/Redo**: History stack tracks individual user diffs—undoing your actions never undoes other people's concurrent drawings.
   - **Auto-Reconnect**: Exponential backoff reconnects automatically if network drops, buffering offline edits and flushing them seamlessly upon re-establishing connection.
   - **Presence**: Remote user cursors with colored pointers and name badges; other users' selections highlighted in their assigned colors.

5. **Advanced Collaboration & Presentation Features**
   - 👁️ **Follow User Mode**: Click any participant avatar to lock and mirror their viewport in real time.
   - 🔒 **Read-Only Link**: `/view/:roomId` allows spectators to watch live without editing privileges.
   - 🎉 **Emoji Reactions**: Floating emoji burst (`❤️`, `👍`, `🔥`, `🎉`, `🚀`, `😂`, `👀`, `💩`) drifting up from cursor.
   - 💬 **In-Board Text Chat**: Slide-out chat drawer for instant room communication.
   - 💾 **Export Options**: Export high-resolution **PNG** (with transparent/dark background option), **SVG** vector graphic, or **JSON** backup.
   - 📂 **Import JSON**: Open and resume any previously saved board.
   - 🌓 **Dark / Light Mode**: Seamless theme switching with dot grid canvas.

6. **Abuse Prevention & Persistence**
   - Native SQLite storage (`node:sqlite` in WAL mode) with debounced periodic writes (every ~2 seconds).
   - Inactive board auto-cleanup (> 30 days of inactivity).
   - Rate limiting (token-bucket algorithm per connection).
   - Payload caps (1MB max WS message, 2MB max image, 20,000 max elements per board, 50 users per room).
   - HTML entity sanitization on text elements and user names.

---

## 🏗️ Architecture & Conflict Resolution

```
┌────────────────────────────────────────────────────────┐
│                   Browser Client                       │
│  - React 19 + TypeScript + Vite                        │
│  - HTML5 Canvas (RoughJS + Perfect-Freehand)           │
│  - Local Optimistic Updates + Per-User History Stack   │
│  - Offline Mutation Queue                              │
└──────────────────────────┬─────────────────────────────┘
                           │ WebSocket (JSON Protocol)
                           ▼
┌────────────────────────────────────────────────────────┐
│                  WebSocket Server                      │
│  - Node.js + ws + Express                              │
│  - In-Memory Active Room Instances                     │
│  - LWW Per-Element Versioning & Nonce Tie-Breaking     │
│  - Token-Bucket Rate Limiter & Input Sanitization      │
└──────────────────────────┬─────────────────────────────┘
                           │ Debounced Flush (~2s)
                           ▼
┌────────────────────────────────────────────────────────┐
│              Native SQLite Database                    │
│  - WAL Mode, Transactional Upserts                     │
│  - Automatic 30-Day Inactive Room Pruning              │
└────────────────────────────────────────────────────────┘
```

### Conflict Resolution Strategy
Each element carries:
- `version: number`: Incremented each time an element is mutated.
- `versionNonce: number`: High-resolution timestamp / random tie-breaker.
- `updatedBy: string`: User ID of author.
- `isDeleted: boolean`: Tombstone flag for deletions.

When an `element-update` is received by the server or client:
$$\text{Overwrite if } (\text{incoming.version} > \text{existing.version}) \lor (\text{incoming.version} = \text{existing.version} \land \text{incoming.versionNonce} \ge \text{existing.versionNonce})$$

---

## 📁 Monorepo Layout

```
.
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Canvas, Toolbar, StylePanel, Header, etc.
│   │   ├── engine/         # RoughRenderer, Freehand, HitTest, History, SocketClient
│   │   ├── styles/         # CSS design system (Light/Dark themes)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
├── server/                 # Realtime WebSocket + HTTP server
│   ├── src/
│   │   ├── server.ts       # Express app & WebSocket server
│   │   ├── roomManager.ts  # Room lifecycle, broadcasting, presence
│   │   ├── storage.ts      # Native SQLite (node:sqlite) persistence
│   │   ├── rateLimiter.ts  # Token-bucket rate limiter
│   │   └── sanitize.ts     # Input sanitization
│   └── package.json
├── shared/                 # Shared TypeScript models and protocols
│   ├── src/
│   │   ├── types.ts        # CanvasElement, UserPresence, ToolType
│   │   ├── protocol.ts     # WebSocket client & server message schemas
│   │   ├── math.ts         # Bounding boxes, rotation, distance, snapping
│   │   └── constants.ts    # Palettes, default names, limits
│   └── package.json
├── Dockerfile              # Multi-stage Docker production build
├── docker-compose.yml      # Ready-to-run container configuration
├── .env.example
└── README.md
```

---

## 🚀 Setup & Run Instructions

### Prerequisites
- **Node.js**: v20+ (recommended v22+ or v24+, built-in `node:sqlite`)
- **npm**: v9+

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
Starts both the WebSocket backend (port `3001`) and the Vite client (port `5173`) with hot reload:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. It will automatically redirect to a new board like `http://localhost:5173/board/x7K9pLm2Q1a`.

### 3. Production Build & Start
```bash
npm run build
npm start
```
The server will start at `http://localhost:3001` and serve both the WebSocket API and the static React build.

### 4. Run with Docker
```bash
docker compose up --build -d
```
Visit [http://localhost:3001](http://localhost:3001). Data is persisted in the `whiteboard-data` volume.

---

## 🌐 Deployment Guide

### Deploying the Backend (Render / Railway / Fly.io)
1. Push repository to GitHub.
2. Link the repository on **Railway** or **Render**.
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Attach a persistent volume mounted at `/app/data` (optional, for preserving SQLite data across restarts).

### Deploying the Frontend (Vercel / Netlify)
1. Set Root Directory: `client`
2. Set Build Command: `npm run build`
3. Set Output Directory: `dist`
4. Add Environment Variable:
   - `VITE_WS_URL`: `wss://your-backend-service.up.railway.app`

---

## 🧪 Verification & Test Plan

Follow these steps to verify real-time collaboration:

1. **Step 1: Create a Board**
   - Open [http://localhost:5173/](http://localhost:5173/) in Browser Window A (e.g. Chrome).
   - Observe automatic redirect to `/board/<roomId>`.
   - Click the **Share** button in the top right. Verify the toast "Link copied to clipboard!" and confetti appear.

2. **Step 2: Join from a Second Browser**
   - Paste the copied URL into Browser Window B (e.g. Chrome Incognito or Firefox).
   - Observe both users appearing in the participant avatar list in the top right.
   - Change the display name in Browser A (click your name tag) to "Alice", and verify Browser B displays "Alice" in the avatar list and cursor tooltip.

3. **Step 3: Real-Time Drawing & Cursor Sync**
   - Move the mouse cursor in Browser A. Confirm the live cursor with the name tag moves in real time in Browser B.
   - Select the **Rectangle (R)** tool in Browser A and drag a box. Observe the hand-drawn rectangle instantly appearing in Browser B within ~50ms.
   - Select the **Pen (P)** tool and draw a smooth curved line. Observe the stroke rendering simultaneously in Browser B.

4. **Step 4: Simultaneous Edits & LWW Conflict Resolution**
   - In Browser A, select and move the rectangle.
   - In Browser B, select the **Text (T)** tool and write text next to the rectangle.
   - Verify both changes coexist without overwriting each other.

5. **Step 5: Per-User Undo/Redo**
   - In Browser A, press `Ctrl+Z`. Confirm only Browser A's last drawn element is undone, while Browser B's text remains intact.

6. **Step 6: Emoji Reactions & In-Board Chat**
   - In Browser A, click the 😊 smile button in the bottom right and pick 🔥. Confirm the fire reaction floats up on both screens.
   - Open the chat drawer (speech bubble icon) in Browser B, send "Hello!", and verify the unread counter and message appear in Browser A.

7. **Step 7: Follow User Mode**
   - In Browser B, click Browser A's avatar in the top right. A badge "Following Alice" appears.
   - Pan or zoom the canvas in Browser A. Confirm Browser B's viewport automatically pans and zooms to follow Alice.

8. **Step 8: Read-Only Link**
   - Open the Share modal in Browser A and copy the Read-Only link (`/view/<roomId>`).
   - Open this URL in Browser C. Verify the toolbar is hidden, "View Only" badge is displayed, and canvas elements cannot be drawn or edited, while remote cursors and changes still update in real time.

9. **Step 9: Server Restart Persistence**
   - Draw multiple shapes on the canvas.
   - Stop the backend server process (`Ctrl+C`), then restart it (`npm start`).
   - Refresh the browser at `/board/<roomId>`. Confirm all elements and shapes are fully restored from SQLite.

