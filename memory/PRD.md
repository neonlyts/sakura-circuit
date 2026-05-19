# Tokyo Circuit - Japan Racing Game PRD

## Problem Statement
Build a top-down 2D racing game set in Japan during daytime, later redesigned to 3rd-person behind-the-car perspective. Classic racing circuit, Tokyo urban streets, cherry blossom trees, mountain scenery.

## Architecture
- **Frontend**: React + HTML5 Canvas (900×560)
- **Backend**: FastAPI (minimal health endpoint)
- **Game Engine**: Custom canvas-based, ~60fps requestAnimationFrame loop

## User Choices
- Both Arrow keys AND WASD simultaneously
- Medium AI difficulty
- Classic racing circuit with curves and straights
- Car selection screen (3 cars)
- Embedded inside landing page with title/instructions
- Medium camera distance (3rd person view)

## Camera System (v2 – 3D Perspective)
- **Projection**: Real-time 3D perspective from behind the car
  - `HORIZON_Y = 224` (40% of 560px)
  - `CAM_BACK = 42` world-px behind player
  - `FOCAL_X = 380`, `PROJ_YC = 14112`
  - `screenY = HORIZON_Y + PROJ_YC / fwd`
  - `screenX = CW/2 + lat * FOCAL_X / fwd`
- **Road rendering**: Trapezoid strips, painter's algorithm (far → near)
- **Steering lean**: Visual body tilt via `steerLeanRef` (lerps ±1)
- **Sky parallax**: Mountains scroll horizontally with camera angle (1.3× speed)

## What's Been Implemented

### v1 (Feb 2026) — Top-down 2D
- Classic catmull-rom circuit, 304 smooth points
- 3 car selection, countdown, physics, AI, 3-lap detection
- Top-down aerial rendering

### v2 (Feb 2026) — 3rd-person Perspective
- Replaced rendering with full 3D perspective projection
- `drawRoad3D`: trapezoid strips, red/white kerbs, center dashes, start/finish line
- `drawSky3D`: sky gradient + clouds + mountain silhouettes with parallax
- `drawTree3D` / `TREES_3D`: 25 track-relative cherry blossom trees
- `drawAICar3D`: AI cars in scene, depth-sorted, scale with distance
- `drawPlayerCar3D`: car from behind with rear window, taillights, wheels, shadow
- Steer lean: visual body tilt when pressing A/D or ←/→
- All game logic (physics, AI, laps) unchanged from v1

## Testing Results (v2)
- Frontend: 92% automated pass rate
- 3D perspective road verified working
- Speed 0→234 km/h on W key
- AI cars visible on road ahead
- All data-testid elements present
- No console errors

## Prioritized Backlog

### P1 (Next)
- Sound effects (engine revving, tire screech on kerbs)
- Ghost car (race your own best lap)
- Best lap time / leaderboard stored in MongoDB

### P2 (Future)
- Mobile touch controls (virtual D-pad)
- Weather effects (rain shimmer on road)
- More track layouts
- Multiplayer (WebSocket)
