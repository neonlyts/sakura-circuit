# Tokyo Circuit - Japan Racing Game PRD

## Problem Statement
Build a top-down 2D racing game set in Japan during daytime, inspired by Forza Horizon 6. The player controls a car on a looping circuit featuring Tokyo urban streets, cherry blossom trees, and mountain scenery visible in the background.

## Architecture
- **Frontend**: React + HTML5 Canvas (900×560)
- **Backend**: FastAPI (minimal, health endpoint only)
- **Database**: MongoDB (unused - game is frontend-only)
- **Game Engine**: Custom canvas-based, ~60fps requestAnimationFrame loop

## User Choices
- Both Arrow keys AND WASD supported simultaneously
- Medium AI difficulty
- Classic racing circuit with curves and straights
- Car selection screen (3 cars)
- Embedded inside landing page with title/instructions

## Core Requirements
- [x] Top-down 2D racing on Japan-themed track
- [x] Smooth keyboard controls (WASD + Arrow keys)
- [x] 2 AI opponent cars (medium difficulty)
- [x] 3-lap race with lap counter
- [x] Speedometer (km/h)
- [x] Race timer
- [x] Win/Lose end screen
- [x] Car selection screen (Sakura Red, Tokyo Blue, Fuji Yellow)
- [x] Landing page with title and instructions
- [x] Bright, vibrant colour palette (blue sky, pink cherry blossoms, green grass, grey asphalt)

## What's Been Implemented (Feb 2026)

### Landing Page (`LandingPage.jsx`)
- Hero section with sky-to-green gradient, mountain SVG silhouettes, cherry blossom trees
- Large "TOKYO CIRCUIT" title with Unbounded font
- Floating petal animations
- "PLAY NOW" button scrolls to game section
- 3-card "How to Play" section (Controls, Race, Win/Lose info)

### Racing Game (`RacingGame.jsx`)
- **Track**: Classic circuit via Catmull-Rom spline from 19 control points → 304 smooth points
  - Main straight (bottom), right sweeping turn, back straight, top straight, left hairpin, return
- **Scenery**: Sky gradient + clouds, mountain silhouettes with snow caps, 18 cherry blossom trees
- **Car Selection**: 3 glassmorphic cards with mini car illustrations (Sakura Red, Tokyo Blue, Fuji Yellow)
- **Countdown**: 3-2-1-GO! overlay with pulse animation
- **Physics**: Velocity + angle model, friction, off-track speed penalty
- **AI**: Look-ahead waypoint following (14 smooth points ahead), occasional steering error for medium difficulty
- **Lap Detection**: Progress-based half-track flag system
- **Boundary**: Car clamped to track centerline ± half-width
- **HUD**: Speed (km/h), Lap (X/3), Timer (M:SS.S), Position (P1/P2/P3) as floating pills
- **End Screen**: YOU WIN! (green glow) / YOU LOSE! (red glow) with final time
- **PLAY AGAIN**: Returns to car selection

## Testing Results
- Frontend: 100% pass rate
- All data-testid attributes present and functional
- WASD + Arrow key controls verified working
- Car selection, countdown, HUD updates all verified

## Prioritized Backlog

### P0 (Critical - done)
- [x] Game is playable
- [x] All controls work
- [x] Win/Lose detection

### P1 (Nice to have)
- [ ] Sound effects (engine revving, tire screech)
- [ ] Mini-map showing car positions
- [ ] Best lap time tracking / leaderboard
- [ ] Mobile touch controls (virtual D-pad)

### P2 (Future)
- [ ] More track layouts
- [ ] Weather effects (rain, night)
- [ ] Car customization (colors, decals)
- [ ] Multiplayer (WebSocket)
