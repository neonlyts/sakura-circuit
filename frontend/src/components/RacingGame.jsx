import React, { useRef, useEffect, useState, useCallback } from "react";

// =====================================================================
// GAME CONSTANTS (unchanged)
// =====================================================================
const CW = 900;
const CH = 560;
const TOTAL_LAPS = 3;
const TW = 72;
const TH = TW / 2;
const SEGS = 16;

const CARS = {
  red:    { color: "#EF4444", name: "Sakura Red",   stat: "Speed",    rating: 9 },
  blue:   { color: "#3B82F6", name: "Tokyo Blue",   stat: "Control",  rating: 8 },
  yellow: { color: "#EAB308", name: "Fuji Yellow",  stat: "Balanced", rating: 7 },
};

// =====================================================================
// 3D PERSPECTIVE CONSTANTS  (medium camera distance)
// =====================================================================
const HORIZON_Y = Math.floor(CH * 0.40); // 224 – horizon line
const PROJ_H    = CH - HORIZON_Y;         // 336 – road visible height
const CAM_BACK  = 42;                     // world-px behind player (medium)
const FOCAL_X   = 380;                    // horizontal perspective
const PROJ_YC   = PROJ_H * CAM_BACK;     // 14112 – vertical projection constant
// Screen-space formulas:
//   screenY = HORIZON_Y + PROJ_YC / fwd
//   screenX = CW/2     + lat * FOCAL_X / fwd
//   roadHalfW          = TH  * FOCAL_X / fwd

const DRAW_SEGS = 92;   // smooth points ahead to render
const TREE_SC   = 0.22; // tree visual scale multiplier

// =====================================================================
// TRACK – Classic circuit
// =====================================================================
const CTRL_PTS = [
  { x: 185, y: 490 }, // 0  START/FINISH
  { x: 350, y: 490 }, // 1  bottom straight
  { x: 515, y: 490 }, // 2  bottom straight
  { x: 658, y: 479 }, // 3  approaching right sweep
  { x: 760, y: 443 }, // 4  right sweep entry
  { x: 820, y: 376 }, // 5  right sweep mid
  { x: 828, y: 295 }, // 6  right back straight
  { x: 818, y: 202 }, // 7  right back straight cont
  { x: 782, y: 129 }, // 8  top-right entry
  { x: 712, y: 88  }, // 9  top straight
  { x: 598, y: 78  }, // 10 top straight
  { x: 478, y: 78  }, // 11 top straight
  { x: 358, y: 78  }, // 12 top straight
  { x: 248, y: 87  }, // 13 hairpin approach
  { x: 168, y: 121 }, // 14 hairpin entry
  { x: 118, y: 184 }, // 15 hairpin apex
  { x: 110, y: 268 }, // 16 hairpin exit
  { x: 124, y: 372 }, // 17 lower-left straight
  { x: 148, y: 452 }, // 18 approaching start
];

// Trees defined track-relative: seg=smooth-point-index, lat=lateral offset (+ = right of travel)
const TREE_DEFS = [
  { seg: 6,   lat: -88, s: 1.2 }, { seg: 18,  lat: -85, s: 1.0 },
  { seg: 30,  lat: -82, s: 0.9 }, { seg: 38,  lat:  88, s: 1.0 },
  { seg: 46,  lat: -82, s: 1.1 }, { seg: 55,  lat: -80, s: 1.1 },
  { seg: 64,  lat:  88, s: 1.0 }, { seg: 74,  lat: -85, s: 0.9 },
  { seg: 84,  lat:  82, s: 1.2 }, { seg: 98,  lat:  82, s: 1.0 },
  { seg: 108, lat: -80, s: 0.9 }, { seg: 118, lat:  86, s: 1.1 },
  { seg: 136, lat: -82, s: 1.0 }, { seg: 152, lat:  88, s: 1.1 },
  { seg: 166, lat: -84, s: 0.9 }, { seg: 180, lat:  82, s: 1.0 },
  { seg: 196, lat: -82, s: 1.1 }, { seg: 208, lat:  92, s: 1.2 },
  { seg: 218, lat: -80, s: 1.0 }, { seg: 234, lat:  82, s: 0.9 },
  { seg: 248, lat: -82, s: 1.0 }, { seg: 264, lat:  86, s: 1.1 },
  { seg: 278, lat: -80, s: 0.9 }, { seg: 292, lat:  82, s: 1.0 },
  { seg: 2,   lat: -84, s: 1.0 },
];

// =====================================================================
// MATH UTILITIES (unchanged)
// =====================================================================
function catmullRomPt(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return {
    x: 0.5 * ((2*p1.x) + (-p0.x + p2.x)*t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x)*t3),
    y: 0.5 * ((2*p1.y) + (-p0.y + p2.y)*t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y)*t3),
  };
}

function buildSmoothTrack(pts) {
  const n = pts.length, result = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i];
    const p2 = pts[(i + 1) % n],     p3 = pts[(i + 2) % n];
    for (let j = 0; j < SEGS; j++) result.push(catmullRomPt(p0, p1, p2, p3, j / SEGS));
  }
  return result; // 19 × 16 = 304 points
}

function normAngle(a) {
  while (a > Math.PI)  a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// =====================================================================
// PRECOMPUTED DATA (module-level, computed once)
// =====================================================================
const SMOOTH = buildSmoothTrack(CTRL_PTS);

// Compute tree world positions from track-relative definitions
const TREES_3D = (() => {
  const N = SMOOTH.length;
  return TREE_DEFS.map(t => {
    const idx  = ((t.seg % N) + N) % N;
    const next = (idx + 1) % N;
    const p = SMOOTH[idx], pn = SMOOTH[next];
    const dir = Math.atan2(pn.y - p.y, pn.x - p.x);
    const px = -Math.sin(dir), py = Math.cos(dir); // perpendicular (right of travel)
    return { x: p.x + px * t.lat, y: p.y + py * t.lat, s: t.s };
  });
})();

// =====================================================================
// CAR FACTORY (unchanged)
// =====================================================================
function makeCar(x, y, angle, colorKey, isPlayer, hint) {
  return {
    x, y, angle, speed: 0,
    maxSpeed:  isPlayer ? 4.8 : 3.95,
    accel:     0.095,
    brakeF:    0.14,
    turn:      isPlayer ? 0.047 : 0.040,
    friction:  0.020,
    color:     CARS[colorKey]?.color || colorKey,
    colorKey,
    isPlayer,
    iAccel: false, iBrake: false, iLeft: false, iRight: false,
    lap: 1, hint, halfway: false, finished: false, finPos: 0, onTrack: true,
  };
}

// =====================================================================
// PHYSICS (unchanged)
// =====================================================================
function physicsStep(car, dt) {
  if (car.finished) { car.speed *= 0.92; return; }
  const cap = car.onTrack ? car.maxSpeed : car.maxSpeed * 0.42;
  if (car.iAccel) car.speed += car.accel * dt;
  if (car.iBrake) car.speed -= car.brakeF * dt;
  car.speed *= Math.pow(1 - car.friction, dt);
  car.speed = Math.max(-cap * 0.3, Math.min(cap, car.speed));
  if (Math.abs(car.speed) > 0.15) {
    const t  = Math.min(1, Math.abs(car.speed) / car.maxSpeed);
    const sa = car.turn * t * Math.sign(car.speed) * dt;
    if (car.iLeft)  car.angle -= sa;
    if (car.iRight) car.angle += sa;
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

// =====================================================================
// AI STEERING (unchanged)
// =====================================================================
function aiSteer(car, smooth) {
  if (car.finished) return;
  const n = smooth.length;
  const tIdx  = (car.hint + 14) % n;
  const target = smooth[tIdx];
  const diff   = normAngle(Math.atan2(target.y - car.y, target.x - car.x) - car.angle);
  car.iLeft  = diff < -0.08;
  car.iRight = diff > 0.08;
  car.iAccel = true;
  car.iBrake = Math.abs(diff) > 0.62;
  if (Math.random() < 0.013) { car.iLeft = Math.random() < 0.5; car.iRight = !car.iLeft; }
}

// =====================================================================
// PROGRESS & LAP DETECTION (unchanged)
// =====================================================================
function trackProgress(car, smooth) {
  const n = smooth.length;
  let best = Infinity, idx = car.hint;
  for (let d = -50; d <= 50; d++) {
    const i  = ((car.hint + d) % n + n) % n;
    const p  = smooth[i];
    const dsq = (car.x - p.x) ** 2 + (car.y - p.y) ** 2;
    if (dsq < best) { best = dsq; idx = i; }
  }
  car.hint    = idx;
  car.onTrack = best < (TH + 14) ** 2;
  const halfIdx   = Math.floor(n * 0.42);
  const finishIdx = Math.floor(n * 0.07);
  if (idx > halfIdx  && !car.halfway) car.halfway = true;
  if (car.halfway && idx < finishIdx) { car.halfway = false; car.lap++; }
}

// =====================================================================
// BOUNDARY CORRECTION (unchanged)
// =====================================================================
function clampToTrack(car, smooth) {
  const p    = smooth[car.hint];
  const dx   = car.x - p.x, dy = car.y - p.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const lim  = TH + 9;
  if (dist > lim) {
    const sc = lim / dist;
    car.x = p.x + dx * sc;
    car.y = p.y + dy * sc;
    car.speed *= 0.72;
  }
}

// =====================================================================
// POSITION HELPER (unchanged)
// =====================================================================
function getRacePos(player, ai1, ai2) {
  const sorted = [player, ai1, ai2].slice().sort((a, b) =>
    b.lap !== a.lap ? b.lap - a.lap : b.hint - a.hint
  );
  return sorted.findIndex(c => c.isPlayer) + 1;
}

// =====================================================================
// 3D PROJECTION HELPER
// Projects a 2D world point into camera space, then to screen.
// Camera faces along (cos_a, sin_a). Returns null if behind camera.
// =====================================================================
function proj(wx, wy, camX, camY, cos_a, sin_a) {
  const dx  = wx - camX, dy = wy - camY;
  const fwd = dx * cos_a + dy * sin_a;   // depth along camera axis
  const lat = -dx * sin_a + dy * cos_a;  // lateral offset (+ = right)
  if (fwd <= 0.5) return null;
  return {
    fwd,
    screenX: CW / 2 + lat * FOCAL_X / fwd,
    screenY: HORIZON_Y + PROJ_YC / fwd,
    hw:      TH * FOCAL_X / fwd,          // road half-width in pixels
    scale:   FOCAL_X / fwd,               // general perspective scale
  };
}

// =====================================================================
// 3D RENDERING – MOUNT FUJI (drawn in sky backdrop, before rolling hills)
// Stratocone shape with irregular snow cap and atmospheric haze
// =====================================================================
function drawFuji3D(ctx, ox) {
  const cx    = ox + 430;          // horizontal centre within panorama tile
  const baseY = HORIZON_Y + 1;     // base at horizon
  const H     = 165;               // total height (px) – towers above rolling hills
  const BHW   = 178;               // half-width at base
  const peakY = baseY - H;         // peak y ≈ HORIZON_Y - 165
  const snowY = peakY + H * 0.38;  // snow-line y (38% down from peak)

  // ─── Main volcanic body ───
  // Quadratic-bezier slopes give the gentle, natural Fuji concavity
  ctx.fillStyle = "#72788C"; // dark blue-grey (atmospheric distance)
  ctx.beginPath();
  ctx.moveTo(cx - BHW, baseY);
  ctx.quadraticCurveTo(cx - BHW * 0.52, baseY - H * 0.57, cx - 14, peakY + 4);
  ctx.quadraticCurveTo(cx, peakY,                          cx + 14, peakY + 4);
  ctx.quadraticCurveTo(cx + BHW * 0.52, baseY - H * 0.57, cx + BHW, baseY);
  ctx.closePath();
  ctx.fill();

  // ─── Atmospheric haze (base fades toward sky colour, gives depth) ───
  const haze = ctx.createLinearGradient(cx, baseY, cx, peakY);
  haze.addColorStop(0,   "rgba(162,216,238,0.28)");
  haze.addColorStop(0.5, "rgba(162,216,238,0.08)");
  haze.addColorStop(1,   "rgba(162,216,238,0)");
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.moveTo(cx - BHW, baseY);
  ctx.quadraticCurveTo(cx - BHW * 0.52, baseY - H * 0.57, cx - 14, peakY + 4);
  ctx.quadraticCurveTo(cx, peakY,                          cx + 14, peakY + 4);
  ctx.quadraticCurveTo(cx + BHW * 0.52, baseY - H * 0.57, cx + BHW, baseY);
  ctx.closePath();
  ctx.fill();

  // ─── Snow cap (near-white, slight blue tint) ───
  // Irregular bottom edge → characteristic Fuji silhouette
  ctx.fillStyle = "#EDECF5";
  ctx.beginPath();
  ctx.moveTo(cx - 14, peakY + 4);
  ctx.quadraticCurveTo(cx, peakY,                  cx + 14, peakY + 4);
  // Right snow edge – lumpy, natural
  ctx.lineTo(cx + BHW * 0.30, snowY - 3);
  ctx.quadraticCurveTo(cx + BHW * 0.20, snowY + 11, cx + BHW * 0.08, snowY + 4);
  ctx.quadraticCurveTo(cx - BHW * 0.03, snowY + 17, cx - BHW * 0.13, snowY + 6);
  ctx.quadraticCurveTo(cx - BHW * 0.23, snowY + 12, cx - BHW * 0.33, snowY - 2);
  ctx.lineTo(cx - 14, peakY + 4);
  ctx.closePath();
  ctx.fill();

  // ─── Snow left-side shadow (gives 3-D depth to the peak) ───
  ctx.fillStyle = "rgba(172,178,218,0.32)";
  ctx.beginPath();
  ctx.moveTo(cx - 14, peakY + 4);
  ctx.quadraticCurveTo(cx - BHW * 0.11, snowY + 10, cx - BHW * 0.33, snowY - 2);
  ctx.lineTo(cx - 14, peakY + 4);
  ctx.closePath();
  ctx.fill();
}

// =====================================================================
// 3D RENDERING – SKY + MOUNTAINS (parallax by camera angle)
// =====================================================================
function drawSky3D(ctx, camAngle) {
  // Sky gradient
  const sg = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 8);
  sg.addColorStop(0,   "#2E88B4");
  sg.addColorStop(0.6, "#6EC8E8");
  sg.addColorStop(1,   "#AAE0F5");
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, CW, HORIZON_Y + 5);

  // Clouds (subtle parallax)
  const cOff = ((-camAngle / (Math.PI * 2)) * CW * 0.5 + CW * 4) % CW;
  ctx.fillStyle = "rgba(255,255,255,0.76)";
  [[70,42,44],[250,33,36],[490,48,50],[685,36,38],[840,40,32]].forEach(([cx, cy, r]) => {
    const ox = ((cx + cOff) % CW + CW) % CW;
    ctx.beginPath(); ctx.arc(ox,    cy,    r,       0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(ox+32, cy+7,  r*0.65,  0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(ox-27, cy+9,  r*0.60,  0, Math.PI*2); ctx.fill();
    // Tile wrap
    if (ox + r > CW) {
      const ox2 = ox - CW;
      ctx.beginPath(); ctx.arc(ox2, cy, r, 0, Math.PI*2); ctx.fill();
    }
  });

  // Mountains (stronger parallax)
  const mOff = ((-camAngle / (Math.PI * 2)) * CW * 1.3 + CW * 4) % CW;
  [-CW, 0, CW].forEach(tile => {
    const ox = mOff + tile;

    // Mount Fuji – drawn FIRST so rolling hills overlap its base,
    // leaving the iconic snow-capped peak visible above everything
    drawFuji3D(ctx, ox);

    // Rolling hills (blue-grey, in front of Fuji)
    const mtns = [
      [ox+0,   HORIZON_Y, ox+125, HORIZON_Y-68, ox+255, HORIZON_Y],
      [ox+295, HORIZON_Y, ox+480, HORIZON_Y-108,ox+665, HORIZON_Y],
      [ox+635, HORIZON_Y, ox+768, HORIZON_Y-72, ox+900, HORIZON_Y],
    ];
    mtns.forEach(([x1,y1,mx,my,x2,y2], mi) => {
      ctx.fillStyle = mi === 1 ? "#88B4C8" : "#7AAABB";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.lineTo(x2, HORIZON_Y + 2);
      ctx.lineTo(x1, HORIZON_Y + 2);
      ctx.fill();
    });
    // Snow caps
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    [[ox+390,HORIZON_Y-88,ox+480,HORIZON_Y-108,ox+568,HORIZON_Y-88],
     [ox+642,HORIZON_Y-58,ox+768,HORIZON_Y-72, ox+894,HORIZON_Y-58]].forEach(([x1,y1,mx,my,x2,y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.closePath();
      ctx.fill();
    });
  });

  // Horizon glow (blends sky into road)
  const hg = ctx.createLinearGradient(0, HORIZON_Y - 4, 0, HORIZON_Y + 12);
  hg.addColorStop(0, "rgba(170,224,245,0.9)");
  hg.addColorStop(1, "rgba(92,184,92,0.0)");
  ctx.fillStyle = hg;
  ctx.fillRect(0, HORIZON_Y - 4, CW, 16);
}

// =====================================================================
// 3D RENDERING – ROAD STRIPS  (painter's algorithm: far → near)
// Each strip = trapezoid between two consecutive projected smooth-pts.
// =====================================================================
function drawRoad3D(ctx, smooth, playerHint, camX, camY, cos_a, sin_a) {
  const N      = smooth.length;
  const OFFSET = 6; // allows i from -OFFSET to DRAW_SEGS+1
  const BUF    = DRAW_SEGS + OFFSET + 2;

  // Build projected-point array
  const pts = new Array(BUF).fill(null);
  for (let i = -OFFSET; i <= DRAW_SEGS + 1; i++) {
    const idx = ((playerHint + i) % N + N) % N;
    const p   = smooth[idx];
    const dx  = p.x - camX, dy = p.y - camY;
    const fwd = dx * cos_a + dy * sin_a;
    const lat = -dx * sin_a + dy * cos_a;
    if (fwd <= 0.5) { pts[i + OFFSET] = null; continue; }
    pts[i + OFFSET] = {
      screenY: HORIZON_Y + PROJ_YC / fwd,
      screenX: CW / 2 + lat * FOCAL_X / fwd,
      hw:      TH * FOCAL_X / fwd,
      fwd,
      absIdx:  idx,
    };
  }

  // Base grass fill (catch-all below horizon)
  ctx.fillStyle = "#5CB85C";
  ctx.fillRect(0, HORIZON_Y, CW, CH - HORIZON_Y);

  // Draw from far (high i) → near (low i)
  for (let i = DRAW_SEGS; i >= -OFFSET + 1; i--) {
    const far  = pts[i + 1 + OFFSET]; // further point (i+1) – smaller screenY
    const near = pts[i + OFFSET];     // closer  point (i)   – larger  screenY
    if (!far || !near) continue;

    const ty = Math.max(HORIZON_Y, Math.min(far.screenY,  CH));
    const by = Math.max(HORIZON_Y, Math.min(near.screenY, CH + 300));
    if (by <= ty + 0.3) continue;

    // Alternating grass colour (visual depth rhythm)
    const alt = Math.floor(Math.abs(i) / 2) % 2;
    ctx.fillStyle = alt ? "#4CAF4C" : "#5CB85C";
    ctx.fillRect(0, ty, CW, by - ty);

    // Start/finish line detection
    const isStart = far.absIdx < 6 || far.absIdx > N - 6;

    // Road trapezoid
    if (isStart) {
      // Alternating black/white checks for start/finish
      const checkAlt = Math.floor(far.absIdx / 2) % 2;
      ctx.fillStyle = checkAlt === 0 ? "#FFFFFF" : "#222222";
    } else {
      ctx.fillStyle = alt ? "#474B55" : "#525660";
    }
    ctx.beginPath();
    ctx.moveTo(far.screenX  - far.hw,  ty);
    ctx.lineTo(far.screenX  + far.hw,  ty);
    ctx.lineTo(near.screenX + near.hw, by);
    ctx.lineTo(near.screenX - near.hw, by);
    ctx.closePath();
    ctx.fill();

    // Kerb strips (red / white alternating every 5 strips)
    const ca  = Math.floor(Math.abs(i) / 5) % 2;
    const cft = Math.max(1.5, far.hw  * 0.11);
    const cfn = Math.max(1.5, near.hw * 0.11);
    ctx.fillStyle = ca ? "#EEEEEE" : "#DD2222";
    // Left kerb
    ctx.beginPath();
    ctx.moveTo(far.screenX  - far.hw,       ty);
    ctx.lineTo(far.screenX  - far.hw + cft, ty);
    ctx.lineTo(near.screenX - near.hw + cfn, by);
    ctx.lineTo(near.screenX - near.hw,      by);
    ctx.fill();
    // Right kerb
    ctx.beginPath();
    ctx.moveTo(far.screenX  + far.hw  - cft, ty);
    ctx.lineTo(far.screenX  + far.hw,        ty);
    ctx.lineTo(near.screenX + near.hw,       by);
    ctx.lineTo(near.screenX + near.hw - cfn, by);
    ctx.fill();

    // Centre dashes (every 6 strips, 4 on / 2 off)
    if (!isStart && (Math.abs(i) % 6) < 4) {
      const df = Math.max(0.5, far.hw  * 0.024);
      const dn = Math.max(0.5, near.hw * 0.024);
      ctx.fillStyle = "rgba(255,255,175,0.58)";
      ctx.beginPath();
      ctx.moveTo(far.screenX  - df, ty);
      ctx.lineTo(far.screenX  + df, ty);
      ctx.lineTo(near.screenX + dn, by);
      ctx.lineTo(near.screenX - dn, by);
      ctx.fill();
    }
  }
}

// =====================================================================
// 3D RENDERING – CHERRY BLOSSOM TREE
// =====================================================================
function drawTree3D(ctx, sx, sy_g, effScale) {
  if (effScale < 0.04) return;
  if (sy_g < HORIZON_Y || sy_g > CH + 50) return;

  const trunkH = Math.min(72, 36 * effScale);
  const trunkW = Math.min(10, 7  * effScale);
  const bloomR = Math.min(40, 22 * effScale);
  if (trunkH < 2) return;

  // Trunk
  ctx.fillStyle = "#8B5E3C";
  ctx.fillRect(sx - trunkW / 2, sy_g - trunkH, trunkW, trunkH);

  // Blossom cloud
  const pinks = ["#FFB7C5", "#FF9EBB", "#FFCDD9", "#FF85A1", "#FFDDE6"];
  const offs  = [[0,-0.82],[-.56,-.32],[.56,-.32],[0,-1.34],[-.40,-1.12],[.40,-1.12],[0,-1.78]];
  offs.forEach(([ox, oy], i) => {
    if (bloomR < 1) return;
    ctx.fillStyle  = pinks[i % pinks.length];
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.arc(sx + ox * bloomR * 1.42, sy_g - trunkH + oy * bloomR, bloomR, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// =====================================================================
// 3D RENDERING – SCENERY (all trees, depth-sorted far-first)
// =====================================================================
function drawScenery3D(ctx, camX, camY, cos_a, sin_a) {
  TREES_3D
    .map(t => {
      const r = proj(t.x, t.y, camX, camY, cos_a, sin_a);
      return r ? { ...r, s: t.s } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.fwd - a.fwd)
    .forEach(t => {
      const effScale = Math.min(1.5, t.scale * TREE_SC * t.s);
      drawTree3D(ctx, t.screenX, t.screenY, effScale);
    });
}

// =====================================================================
// 3D RENDERING – AI CAR (viewed from behind, scales with distance)
// =====================================================================
function drawAICar3D(ctx, sx, sy_g, scale, color) {
  if (scale < 0.07) return;
  const w  = Math.min(90, 33 * scale);
  const h  = Math.min(56, 20 * scale);
  if (w < 4) return;

  const topY  = sy_g - h * 1.42;  // roof top
  const shldY = sy_g - h * 0.88;  // shoulder (top of door panel)
  const beltY = sy_g - h * 0.30;  // beltline
  const wy    = sy_g - h * 0.06;  // wheel centre y
  const wr    = Math.max(2, w * 0.135); // wheel radius
  const wx    = w * 0.42;         // wheel centre |x|

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(sx, sy_g + 2, w * 0.50, w * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lower body (beltline → bumper, slightly darkened)
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.84;
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.48, beltY);
  ctx.lineTo(sx + w * 0.48, beltY);
  ctx.lineTo(sx + w * 0.52, sy_g - 3);
  ctx.lineTo(sx - w * 0.52, sy_g - 3);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.48, beltY);
  ctx.lineTo(sx + w * 0.48, beltY);
  ctx.lineTo(sx + w * 0.52, sy_g - 3);
  ctx.lineTo(sx - w * 0.52, sy_g - 3);
  ctx.closePath();
  ctx.fill();

  // Upper body (shoulder → beltline)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.44, shldY);
  ctx.lineTo(sx + w * 0.44, shldY);
  ctx.lineTo(sx + w * 0.48, beltY);
  ctx.lineTo(sx - w * 0.48, beltY);
  ctx.closePath();
  ctx.fill();

  // Roof (shoulder → roof peak, darker)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.26, topY);
  ctx.lineTo(sx + w * 0.26, topY);
  ctx.lineTo(sx + w * 0.44, shldY);
  ctx.lineTo(sx - w * 0.44, shldY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.26, topY);
  ctx.lineTo(sx + w * 0.26, topY);
  ctx.lineTo(sx + w * 0.44, shldY);
  ctx.lineTo(sx - w * 0.44, shldY);
  ctx.closePath();
  ctx.fill();

  // Rear glass
  ctx.fillStyle = "rgba(130,200,255,0.65)";
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.20, topY + 1);
  ctx.lineTo(sx + w * 0.20, topY + 1);
  ctx.lineTo(sx + w * 0.38, shldY - 1);
  ctx.lineTo(sx - w * 0.38, shldY - 1);
  ctx.closePath();
  ctx.fill();

  // Taillight bar (horizontal – modern sports car look)
  const tlBarH = Math.max(1.5, h * 0.20);
  ctx.fillStyle = "#0A0A0A";
  ctx.fillRect(sx - w * 0.48, shldY + 1, w * 0.96, tlBarH);
  ctx.fillStyle = "rgba(255,25,25,0.18)";
  ctx.fillRect(sx - w * 0.50, shldY - 1, w, tlBarH + 4);

  // Left taillight cluster
  ctx.fillStyle = "#EE1010";
  ctx.fillRect(sx - w * 0.48, shldY + 2, w * 0.26, Math.max(1, tlBarH - 2));
  // Right taillight cluster
  ctx.fillStyle = "#EE1010";
  ctx.fillRect(sx + w * 0.22, shldY + 2, w * 0.26, Math.max(1, tlBarH - 2));

  // Bumper trim
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.fillRect(sx - w * 0.50, sy_g - 6, w, 6);

  // Wheel arches + wheels (only when large enough)
  if (wr >= 3) {
    ctx.fillStyle = "rgba(0,0,0,0.46)";
    ctx.beginPath(); ctx.arc(sx - wx, wy, wr + 4, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + wx, wy, wr + 4, Math.PI, 0); ctx.closePath(); ctx.fill();

    for (const wheelX of [sx - wx, sx + wx]) {
      // Tyre
      ctx.fillStyle = "#171717";
      ctx.beginPath(); ctx.arc(wheelX, wy, wr, 0, Math.PI * 2); ctx.fill();
      if (wr > 5) {
        // Rim
        ctx.fillStyle = "#ABABAB";
        ctx.beginPath(); ctx.arc(wheelX, wy, wr * 0.62, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#777";
        ctx.beginPath(); ctx.arc(wheelX, wy, wr * 0.38, 0, Math.PI * 2); ctx.fill();
        // Spokes
        ctx.strokeStyle = "#BCBCBC"; ctx.lineWidth = Math.max(1, wr * 0.14);
        for (let s = 0; s < 5; s++) {
          const a = (s / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(wheelX + Math.cos(a) * wr * 0.38, wy + Math.sin(a) * wr * 0.38);
          ctx.lineTo(wheelX + Math.cos(a) * wr * 0.60, wy + Math.sin(a) * wr * 0.60);
          ctx.stroke();
        }
        ctx.fillStyle = "#DEDEDE";
        ctx.beginPath(); ctx.arc(wheelX, wy, wr * 0.16, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

// =====================================================================
// 3D RENDERING – AI CARS IN SCENE (depth-sorted)
// =====================================================================
function drawCarsInScene3D(ctx, cars, camX, camY, cos_a, sin_a) {
  cars
    .map(car => {
      const r = proj(car.x, car.y, camX, camY, cos_a, sin_a);
      return r ? { ...r, color: car.color } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.fwd - a.fwd)
    .forEach(c => drawAICar3D(ctx, c.screenX, c.screenY, c.scale, c.color));
}

// =====================================================================
// 3D RENDERING – PLAYER CAR (fixed bottom-centre, leans on steer)
// Redesigned: clear shoulder/beltline, round wheels with spokes, horizontal taillights
// =====================================================================
function drawPlayerCar3D(ctx, carColor, steerLean) {
  const cx = CW / 2;
  const cy = CH - 62; // screen centre of car

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(steerLean * 0.08);

  // ─── geometry ───
  const W2   = 56;   // half-width at beltline
  const ROOF = -52;  // y: roof peak
  const SHLD = -26;  // y: shoulder (door top)
  const BELT =   2;  // y: beltline
  const BUMP =  22;  // y: bumper base
  const WY   =  21;  // y: wheel centre
  const WR   =  18;  // wheel radius
  const WX   =  43;  // wheel centre |x|

  // SHADOW
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, BUMP + 15, W2 * 0.95, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // ─── lower body (beltline → bumper, slightly darker via alpha) ───
  ctx.fillStyle = carColor;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(-W2 - 3, BELT);
  ctx.lineTo( W2 + 3, BELT);
  ctx.lineTo( W2 + 5, BUMP);
  ctx.lineTo(-W2 - 5, BUMP);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // dark overlay
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.beginPath();
  ctx.moveTo(-W2 - 3, BELT);
  ctx.lineTo( W2 + 3, BELT);
  ctx.lineTo( W2 + 5, BUMP);
  ctx.lineTo(-W2 - 5, BUMP);
  ctx.closePath();
  ctx.fill();

  // ─── upper body / door panel (shoulder → beltline) ───
  ctx.fillStyle = carColor;
  ctx.beginPath();
  ctx.moveTo(-W2,     SHLD);
  ctx.lineTo( W2,     SHLD);
  ctx.lineTo( W2 + 3, BELT);
  ctx.lineTo(-W2 - 3, BELT);
  ctx.closePath();
  ctx.fill();

  // ─── roof panel (shoulder → roof peak) ───
  ctx.fillStyle = carColor;
  ctx.beginPath();
  ctx.moveTo(-W2 * 0.50, ROOF);
  ctx.lineTo( W2 * 0.50, ROOF);
  ctx.lineTo( W2,        SHLD);
  ctx.lineTo(-W2,        SHLD);
  ctx.closePath();
  ctx.fill();
  // roof darkening
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.moveTo(-W2 * 0.50, ROOF);
  ctx.lineTo( W2 * 0.50, ROOF);
  ctx.lineTo( W2,        SHLD);
  ctx.lineTo(-W2,        SHLD);
  ctx.closePath();
  ctx.fill();

  // ─── rear glass ───
  ctx.fillStyle = "rgba(120,200,255,0.74)";
  ctx.beginPath();
  ctx.moveTo(-W2 * 0.44, ROOF + 3);
  ctx.lineTo( W2 * 0.44, ROOF + 3);
  ctx.lineTo( W2 * 0.80, SHLD - 1);
  ctx.lineTo(-W2 * 0.80, SHLD - 1);
  ctx.closePath();
  ctx.fill();
  // glass reflection
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.moveTo(-W2 * 0.30, ROOF + 5);
  ctx.lineTo(-W2 * 0.02, ROOF + 5);
  ctx.lineTo( W2 * 0.08, SHLD - 2);
  ctx.lineTo(-W2 * 0.52, SHLD - 2);
  ctx.closePath();
  ctx.fill();

  // ─── shoulder crease highlight ───
  ctx.strokeStyle = "rgba(255,255,255,0.20)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-W2, SHLD);
  ctx.lineTo( W2, SHLD);
  ctx.stroke();

  // ─── horizontal taillight bar (full-width, modern sports car) ───
  // Dark bar backing
  ctx.fillStyle = "#0A0A0A";
  ctx.fillRect(-W2 - 4, SHLD + 2, (W2 + 4) * 2, 13);
  // Glow backdrop
  ctx.fillStyle = "rgba(255,25,25,0.20)";
  ctx.fillRect(-W2 - 5, SHLD - 2, (W2 + 5) * 2, 21);

  // Left taillight cluster
  ctx.fillStyle = "rgba(210,10,10,0.90)";
  ctx.fillRect(-W2 - 4, SHLD + 3, W2 * 0.54, 10);
  ctx.fillStyle = "#FF1111";
  ctx.fillRect(-W2 - 3, SHLD + 4, W2 * 0.44, 7);
  ctx.fillStyle = "rgba(255,180,180,0.55)";
  ctx.fillRect(-W2 - 2, SHLD + 5, W2 * 0.22, 4);

  // Right taillight cluster (mirror)
  ctx.fillStyle = "rgba(210,10,10,0.90)";
  ctx.fillRect( W2 * 0.50, SHLD + 3, W2 * 0.58, 10);
  ctx.fillStyle = "#FF1111";
  ctx.fillRect( W2 * 0.59, SHLD + 4, W2 * 0.44, 7);
  ctx.fillStyle = "rgba(255,180,180,0.55)";
  ctx.fillRect( W2 * 0.80, SHLD + 5, W2 * 0.22, 4);

  // ─── bumper & lower trim ───
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.fillRect(-W2 - 4, BUMP - 5, (W2 + 4) * 2, 8);

  // ─── exhaust pipes ───
  ctx.fillStyle = "#888";
  ctx.fillRect(-24, BUMP - 3, 14, 7);
  ctx.fillStyle = "#444";
  ctx.fillRect(-23, BUMP - 2, 12, 5);
  ctx.fillStyle = "#888";
  ctx.fillRect(10, BUMP - 3, 14, 7);
  ctx.fillStyle = "#444";
  ctx.fillRect(11, BUMP - 2, 12, 5);

  // ─── wheel arches (dark semicircles cut from body) ───
  ctx.fillStyle = "rgba(0,0,0,0.52)";
  ctx.beginPath(); ctx.arc(-WX, WY, WR + 7, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc( WX, WY, WR + 7, Math.PI, 0); ctx.closePath(); ctx.fill();

  // ─── wheels (full round circles with rim + spokes) ───
  for (const wx of [-WX, WX]) {
    // Tyre
    ctx.fillStyle = "#141414";
    ctx.beginPath(); ctx.arc(wx, WY, WR, 0, Math.PI * 2); ctx.fill();

    // Outer rim band
    ctx.fillStyle = "#C8C8C8";
    ctx.beginPath(); ctx.arc(wx, WY, WR * 0.66, 0, Math.PI * 2); ctx.fill();

    // Inner rim (dark)
    ctx.fillStyle = "#888";
    ctx.beginPath(); ctx.arc(wx, WY, WR * 0.44, 0, Math.PI * 2); ctx.fill();

    // 5-spoke spokes
    ctx.strokeStyle = "#C2C2C2";
    ctx.lineWidth = 2.5;
    for (let s = 0; s < 5; s++) {
      const a = (s / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(a) * WR * 0.44, WY + Math.sin(a) * WR * 0.44);
      ctx.lineTo(wx + Math.cos(a) * WR * 0.64, WY + Math.sin(a) * WR * 0.64);
      ctx.stroke();
    }

    // Centre hub
    ctx.fillStyle = "#E0E0E0";
    ctx.beginPath(); ctx.arc(wx, WY, WR * 0.18, 0, Math.PI * 2); ctx.fill();

    // Tyre sidewall glint
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(wx, WY, WR - 2, Math.PI * 0.25, Math.PI * 0.80);
    ctx.stroke();
  }

  ctx.restore();
}

// =====================================================================
// MAIN 3D RENDER FUNCTION
// =====================================================================
function render3D(canvas, gs, steerLean) {
  const ctx  = canvas.getContext("2d");
  const car  = gs.player;
  const cosA = Math.cos(car.angle);
  const sinA = Math.sin(car.angle);
  const camX = car.x - cosA * CAM_BACK;
  const camY = car.y - sinA * CAM_BACK;

  ctx.clearRect(0, 0, CW, CH);

  // 1. Sky + mountains (fills 0 → HORIZON_Y)
  drawSky3D(ctx, car.angle);

  // 2. Road (fills HORIZON_Y → CH with grass + asphalt strips)
  drawRoad3D(ctx, gs.smooth, car.hint, camX, camY, cosA, sinA);

  // 3. Cherry-blossom trees (on grass, depth-sorted)
  drawScenery3D(ctx, camX, camY, cosA, sinA);

  // 4. AI cars (on road, depth-sorted)
  if (gs.ai1 && gs.ai2) {
    drawCarsInScene3D(ctx, [gs.ai1, gs.ai2], camX, camY, cosA, sinA);
  }

  // 5. Player car (always at bottom-centre, on top of everything)
  drawPlayerCar3D(ctx, car.color, steerLean);
}

// Static initial render (no cars, used before race starts)
function renderStaticTrack3D(canvas) {
  const startAngle = Math.atan2(
    SMOOTH[1].y - SMOOTH[0].y,
    SMOOTH[1].x - SMOOTH[0].x
  );
  const cosA = Math.cos(startAngle);
  const sinA = Math.sin(startAngle);
  const camX = SMOOTH[4].x - cosA * CAM_BACK;
  const camY = SMOOTH[4].y - sinA * CAM_BACK;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CW, CH);
  drawSky3D(ctx, startAngle);
  drawRoad3D(ctx, SMOOTH, 4, camX, camY, cosA, sinA);
  drawScenery3D(ctx, camX, camY, cosA, sinA);
}

// =====================================================================
// ENGINE SOUND (Web Audio API)
// Creates oscillator-based engine rumble that rises in pitch with speed.
// Must be called on a user-interaction to satisfy browser autoplay policy.
// =====================================================================
function initEngineSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();

    // Master gain (volume follows car speed)
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Low-pass filter — softens the raw sawtooth into a warm engine rumble
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 700;
    lpf.Q.value = 0.6;
    lpf.connect(master);

    // Oscillator 1: fundamental (main engine body)
    const osc1 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc1.frequency.value = 65;
    osc1.connect(lpf);
    osc1.start();

    // Oscillator 2: 2nd harmonic (adds character / richness)
    const g2 = ctx.createGain();
    g2.gain.value = 0.32;
    g2.connect(lpf);
    const osc2 = ctx.createOscillator();
    osc2.type = "sawtooth";
    osc2.frequency.value = 130;
    osc2.connect(g2);
    osc2.start();

    return { ctx, master, osc1, osc2 };
  } catch (_) {
    return null; // silently fail if audio not available
  }
}

function updateEngineSound(audio, speed) {
  if (!audio) return;
  const { ctx, master, osc1, osc2 } = audio;
  const t    = ctx.currentTime;
  const freq = 65 + Math.abs(speed) * 30; // 65 Hz idle → ~215 Hz at max speed
  const vol  = Math.min(0.18, Math.abs(speed) * 0.04);
  osc1.frequency.setTargetAtTime(freq,     t, 0.06);
  osc2.frequency.setTargetAtTime(freq * 2, t, 0.06);
  master.gain.setTargetAtTime(vol, t, 0.10);
}

function stopEngineSound(audio) {
  if (!audio) return;
  try {
    audio.master.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.4);
    setTimeout(() => { try { audio.ctx.close(); } catch (_) {} }, 1500);
  } catch (_) {}
}

// =====================================================================
// TIME FORMATTER
// =====================================================================
function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

// =====================================================================
// RACING GAME COMPONENT
// =====================================================================
export default function RacingGame() {
  const [phase, setPhase]             = useState("car-select");
  const [selectedCar, setSelectedCar] = useState("red");
  const [cdNum, setCdNum]             = useState(3);
  const [hud, setHud]                 = useState({ spd: 0, lap: 1, time: 0, pos: 1 });
  const [result, setResult]           = useState(null);

  const canvasRef     = useRef(null);
  const gsRef         = useRef(null);
  const keysRef       = useRef(new Set());
  const rafRef        = useRef(null);
  const lastTRef      = useRef(null);
  const startTRef     = useRef(null);
  const steerLeanRef  = useRef(0);
  const audioRef      = useRef(null); // Web Audio engine sound

  // Keyboard handlers
  useEffect(() => {
    const onDown = (e) => {
      keysRef.current.add(e.code);
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
    };
    const onUp = (e) => keysRef.current.delete(e.code);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup",   onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup",   onUp);
    };
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // Render static track on mount
  useEffect(() => {
    if (canvasRef.current) renderStaticTrack3D(canvasRef.current);
  }, []);

  // Re-render when countdown phase starts
  useEffect(() => {
    if (phase === "countdown" && canvasRef.current && gsRef.current) {
      render3D(canvasRef.current, gsRef.current, 0);
    }
  }, [phase]);

  const initGameState = useCallback((car) => {
    const aiCols   = Object.keys(CARS).filter(c => c !== car);
    const startAng = Math.atan2(SMOOTH[1].y - SMOOTH[0].y, SMOOTH[1].x - SMOOTH[0].x);
    // Starting positions: all cars must be PAST smooth[0]=(185,490) to avoid
    // their nearest smooth index landing in the >127 "halfway" zone (smooth[295]≈(157,474)).
    // If a car starts behind smooth[0] it maps to index ~295, sets halfway=true on frame-1,
    // and gets a free lap when it crosses the start – that's the P2 bug.
    gsRef.current = {
      smooth:        SMOOTH,
      player:        makeCar(252, 474, startAng, car,       true,  7),
      ai1:           makeCar(220, 504, startAng, aiCols[0], false, 4),
      ai2:           makeCar(200, 474, startAng, aiCols[1], false, 2),
      finishedCount: 0,
    };
    steerLeanRef.current = 0;
  }, []);

  const gameLoop = useCallback((ts) => {
    const gs = gsRef.current;
    if (!gs) return;

    const dt = lastTRef.current
      ? Math.min((ts - lastTRef.current) / 16.67, 3)
      : 1;
    lastTRef.current = ts;

    // Player input
    const keys = keysRef.current, p = gs.player;
    p.iAccel = keys.has("ArrowUp")    || keys.has("KeyW");
    p.iBrake = keys.has("ArrowDown")  || keys.has("KeyS");
    p.iLeft  = keys.has("ArrowLeft")  || keys.has("KeyA");
    p.iRight = keys.has("ArrowRight") || keys.has("KeyD");

    // Visual steering lean (lerp toward ±1)
    const targetLean = (p.iLeft ? -1 : 0) + (p.iRight ? 1 : 0);
    steerLeanRef.current += (targetLean - steerLeanRef.current) * 0.09;

    // AI
    aiSteer(gs.ai1, gs.smooth);
    aiSteer(gs.ai2, gs.smooth);

    // Physics
    physicsStep(p, dt);
    physicsStep(gs.ai1, dt);
    physicsStep(gs.ai2, dt);

    // Progress & laps
    trackProgress(p,      gs.smooth);
    trackProgress(gs.ai1, gs.smooth);
    trackProgress(gs.ai2, gs.smooth);

    // Boundary
    clampToTrack(p,      gs.smooth);
    clampToTrack(gs.ai1, gs.smooth);
    clampToTrack(gs.ai2, gs.smooth);

    // Finish detection
    [p, gs.ai1, gs.ai2].forEach(car => {
      if (!car.finished && car.lap > TOTAL_LAPS) {
        car.finished = true;
        gs.finishedCount++;
        car.finPos = gs.finishedCount;
      }
    });

    // Render (3D perspective)
    if (canvasRef.current) render3D(canvasRef.current, gs, steerLeanRef.current);

    // Engine sound update
    updateEngineSound(audioRef.current, p.speed);

    // HUD
    const elapsed = startTRef.current ? (ts - startTRef.current) / 1000 : 0;
    const pos     = getRacePos(p, gs.ai1, gs.ai2);
    setHud({ spd: Math.round(Math.abs(p.speed) * 55), lap: Math.min(p.lap, TOTAL_LAPS), time: elapsed, pos });

    // End: player finished
    if (p.finished) {
      stopEngineSound(audioRef.current);
      audioRef.current = null;
      setResult(p.finPos === 1 ? "win" : "lose");
      setPhase("finished");
      return;
    }
    // End: both AIs done before player
    if (gs.ai1.finished && gs.ai2.finished && !p.finished) {
      p.finPos = 3;
      stopEngineSound(audioRef.current);
      audioRef.current = null;
      setResult("lose");
      setPhase("finished");
      return;
    }

    rafRef.current = requestAnimationFrame(gameLoop);
  }, []); // eslint-disable-line

  const startCountdown = useCallback(() => {
    initGameState(selectedCar);
    // Init engine sound on user interaction (satisfies browser autoplay policy)
    if (!audioRef.current) audioRef.current = initEngineSound();
    setPhase("countdown");
    let c = 3;
    setCdNum(c);
    const timer = setInterval(() => {
      c--;
      if (c > 0) {
        setCdNum(c);
      } else {
        setCdNum(0);
        clearInterval(timer);
        setTimeout(() => {
          setPhase("racing");
          startTRef.current = performance.now();
          lastTRef.current  = null;
          rafRef.current    = requestAnimationFrame(gameLoop);
        }, 750);
      }
    }, 1000);
  }, [selectedCar, initGameState, gameLoop]);

  const handleRestart = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    lastTRef.current = null;
    steerLeanRef.current = 0;
    stopEngineSound(audioRef.current);
    audioRef.current = null;
    setResult(null);
    setHud({ spd: 0, lap: 1, time: 0, pos: 1 });
    setPhase("car-select");
    setTimeout(() => {
      if (canvasRef.current) renderStaticTrack3D(canvasRef.current);
    }, 50);
  }, []);

  const isWin = result === "win";

  return (
    <div className="game-canvas-container">
      <div
        className="relative rounded-3xl overflow-hidden shadow-2xl"
        style={{ width: CW, height: CH, flexShrink: 0 }}
        data-testid="game-container"
      >
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={{ display: "block", touchAction: "none" }}
        />

        {/* ── CAR SELECTION OVERLAY ── */}
        {phase === "car-select" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: "rgba(8,18,36,0.72)", backdropFilter: "blur(6px)" }}
            data-testid="car-select-screen"
          >
            <h2
              className="text-3xl font-black text-white mb-1 tracking-tight"
              style={{ fontFamily: "Unbounded, sans-serif" }}
            >
              SELECT YOUR CAR
            </h2>
            <p className="text-white/60 text-sm mb-8">Choose your racing machine</p>

            <div className="flex gap-5 mb-10 flex-wrap justify-center px-4">
              {Object.entries(CARS).map(([key, car]) => {
                const sel = selectedCar === key;
                return (
                  <button
                    key={key}
                    data-testid={`car-select-${key}`}
                    onClick={() => setSelectedCar(key)}
                    className="flex flex-col items-center p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer focus:outline-none"
                    style={{
                      minWidth: 148,
                      borderColor:    sel ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)",
                      background:     sel ? `${car.color}28` : "rgba(255,255,255,0.06)",
                      backdropFilter: "blur(12px)",
                      transform:  sel ? "scale(1.08)" : "scale(1)",
                      boxShadow:  sel ? `0 0 28px ${car.color}66` : "none",
                    }}
                  >
                    <div
                      className="mb-3 flex items-center justify-center rounded-xl"
                      style={{ width: 80, height: 48, background: `${car.color}22`, border: `2px solid ${car.color}66` }}
                    >
                      <div style={{ position: "relative", width: 44, height: 22 }}>
                        <div style={{ position: "absolute", inset: 0, borderRadius: 5, background: car.color }} />
                        <div style={{ position: "absolute", top: 3, left: 8, right: 8, height: 10, borderRadius: 3, background: "rgba(180,220,255,0.7)" }} />
                        <div style={{ position: "absolute", top: 2, right: 2, width: 4, height: 4, borderRadius: "50%", background: "#FFFF88" }} />
                        <div style={{ position: "absolute", bottom: 2, right: 2, width: 4, height: 4, borderRadius: "50%", background: "#FFFF88" }} />
                        <div style={{ position: "absolute", top: 2, left: 2, width: 4, height: 4, borderRadius: "50%", background: "#FF2222" }} />
                        <div style={{ position: "absolute", bottom: 2, left: 2, width: 4, height: 4, borderRadius: "50%", background: "#FF2222" }} />
                      </div>
                    </div>
                    <div className="text-white font-bold text-sm">{car.name}</div>
                    <div className="text-white/50 text-xs mt-0.5">{car.stat}</div>
                    <div className="mt-2.5 w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
                      <div style={{ width: `${car.rating * 10}%`, height: "100%", background: car.color, borderRadius: 999 }} />
                    </div>
                    {sel && (
                      <div className="mt-2 text-xs font-bold tracking-widest" style={{ color: car.color }}>
                        SELECTED
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              data-testid="start-race-btn"
              onClick={startCountdown}
              className="px-12 py-4 rounded-2xl text-white font-black text-xl uppercase tracking-widest transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-95"
              style={{
                fontFamily: "Unbounded, sans-serif",
                background: "linear-gradient(135deg, #4DA8DA, #3B82F6)",
                boxShadow: "0 8px 30px rgba(77,168,218,0.55)",
              }}
            >
              START RACE
            </button>
          </div>
        )}

        {/* ── COUNTDOWN OVERLAY ── */}
        {phase === "countdown" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{ background: "rgba(0,0,0,0.30)" }}
          >
            <div
              key={cdNum}
              className="countdown-num"
              data-testid="countdown-display"
              style={{
                fontFamily: "Unbounded, sans-serif",
                fontSize:   cdNum === 0 ? "7rem" : "9rem",
                fontWeight: 900,
                color:      cdNum === 0 ? "#75D481" : "#FFFFFF",
                textShadow: cdNum === 0
                  ? "0 0 50px #75D481, 0 0 100px #75D481"
                  : "0 4px 20px rgba(0,0,0,0.85)",
                lineHeight: 1,
              }}
            >
              {cdNum === 0 ? "GO!" : cdNum}
            </div>
            <p className="text-white/55 text-sm mt-4" style={{ fontFamily: "Outfit, sans-serif" }}>
              {cdNum > 0 ? "Get ready…" : "Full speed ahead!"}
            </p>
          </div>
        )}

        {/* ── HUD ── */}
        {phase === "racing" && (
          <div className="absolute top-3 left-3 right-3 flex justify-between items-center pointer-events-none gap-2">
            <div
              className="flex items-center gap-1.5 px-4 py-2 rounded-full"
              style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)" }}
            >
              <span className="text-white/55 text-xs font-semibold uppercase tracking-wider">Speed</span>
              <span data-testid="hud-speed" className="text-xl font-black text-white tabular-nums" style={{ fontFamily: "Unbounded, sans-serif" }}>
                {hud.spd}
              </span>
              <span className="text-white/55 text-xs">km/h</span>
            </div>

            <div
              className="flex items-center gap-1.5 px-4 py-2 rounded-full"
              style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)" }}
            >
              <span className="text-white/55 text-xs font-semibold uppercase tracking-wider">Lap</span>
              <span data-testid="hud-lap" className="text-xl font-black text-white tabular-nums" style={{ fontFamily: "Unbounded, sans-serif" }}>
                {hud.lap}/{TOTAL_LAPS}
              </span>
            </div>

            <div
              className="flex items-center gap-1.5 px-4 py-2 rounded-full"
              style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)" }}
            >
              <span className="text-white/55 text-xs font-semibold uppercase tracking-wider">Time</span>
              <span data-testid="hud-time" className="text-xl font-black text-white tabular-nums" style={{ fontFamily: "Unbounded, sans-serif" }}>
                {fmtTime(hud.time)}
              </span>
            </div>

            <div
              className="flex items-center gap-1 px-4 py-2 rounded-full transition-all"
              style={{
                background:     hud.pos === 1 ? "rgba(117,212,129,0.75)" : "rgba(0,0,0,0.62)",
                backdropFilter: "blur(8px)",
                border:         "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <span data-testid="hud-pos" className="text-xl font-black text-white" style={{ fontFamily: "Unbounded, sans-serif" }}>
                P{hud.pos}
              </span>
            </div>
          </div>
        )}

        {/* ── TOUCH CONTROLS (phone + tablet, works with mouse on desktop) ── */}
        {phase === "racing" && (
          <div
            className="absolute bottom-0 left-0 right-0 flex justify-between items-end px-3 pb-3"
            style={{ pointerEvents: "none", touchAction: "none", userSelect: "none" }}
          >
            {/* Left cluster: Steer Left | Brake */}
            <div className="flex gap-2.5" style={{ pointerEvents: "auto" }}>
              {[
                { code: "ArrowLeft",  label: "◀", hint: "Left",  big: false, color: "rgba(77,168,218,0.55)",  border: "rgba(77,168,218,0.8)"  },
                { code: "ArrowDown",  label: "▼", hint: "Brake", big: false, color: "rgba(0,0,0,0.45)",       border: "rgba(255,255,255,0.22)" },
              ].map(({ code, label, hint, color, border }) => (
                <button
                  key={code}
                  data-testid={`touch-${hint.toLowerCase()}`}
                  onTouchStart={(e) => { e.preventDefault(); keysRef.current.add(code); }}
                  onTouchEnd={(e)   => { e.preventDefault(); keysRef.current.delete(code); }}
                  onTouchCancel={(e)=> { e.preventDefault(); keysRef.current.delete(code); }}
                  onMouseDown={() => keysRef.current.add(code)}
                  onMouseUp={()    => keysRef.current.delete(code)}
                  onMouseLeave={()  => keysRef.current.delete(code)}
                  style={{
                    width: 66, height: 66, borderRadius: 16,
                    background: color, border: `1.5px solid ${border}`,
                    backdropFilter: "blur(8px)", display: "flex",
                    flexDirection: "column", alignItems: "center", justifyContent: "center",
                    color: "#FFF", fontSize: 22, fontWeight: 700,
                    cursor: "pointer", touchAction: "none",
                    WebkitUserSelect: "none", userSelect: "none",
                  }}
                >
                  <span style={{ lineHeight: 1 }}>{label}</span>
                  <span style={{ fontSize: 9, opacity: 0.7, marginTop: 3, fontFamily: "Outfit,sans-serif", letterSpacing: "0.05em" }}>{hint}</span>
                </button>
              ))}
            </div>

            {/* Right cluster: Gas | Steer Right */}
            <div className="flex gap-2.5" style={{ pointerEvents: "auto" }}>
              {[
                { code: "ArrowUp",    label: "▲", hint: "Gas",   big: true,  color: "rgba(117,212,129,0.60)", border: "rgba(117,212,129,0.9)" },
                { code: "ArrowRight", label: "▶", hint: "Right", big: false, color: "rgba(77,168,218,0.55)",  border: "rgba(77,168,218,0.8)"  },
              ].map(({ code, label, hint, big, color, border }) => (
                <button
                  key={code}
                  data-testid={`touch-${hint.toLowerCase()}`}
                  onTouchStart={(e) => { e.preventDefault(); keysRef.current.add(code); }}
                  onTouchEnd={(e)   => { e.preventDefault(); keysRef.current.delete(code); }}
                  onTouchCancel={(e)=> { e.preventDefault(); keysRef.current.delete(code); }}
                  onMouseDown={() => keysRef.current.add(code)}
                  onMouseUp={()    => keysRef.current.delete(code)}
                  onMouseLeave={()  => keysRef.current.delete(code)}
                  style={{
                    width: big ? 82 : 66, height: big ? 82 : 66,
                    borderRadius: big ? 20 : 16,
                    background: color, border: `1.5px solid ${border}`,
                    backdropFilter: "blur(8px)", display: "flex",
                    flexDirection: "column", alignItems: "center", justifyContent: "center",
                    color: "#FFF", fontSize: big ? 26 : 22, fontWeight: 700,
                    cursor: "pointer", touchAction: "none",
                    WebkitUserSelect: "none", userSelect: "none",
                    boxShadow: big ? `0 4px 20px ${border}` : "none",
                  }}
                >
                  <span style={{ lineHeight: 1 }}>{label}</span>
                  <span style={{ fontSize: 9, opacity: 0.7, marginTop: 3, fontFamily: "Outfit,sans-serif", letterSpacing: "0.05em" }}>{hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Controls hint (keyboard, top-right corner) */}
        {phase === "racing" && (
          <div
            className="absolute top-14 right-3 pointer-events-none text-xs text-white/30"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            WASD / Arrows
          </div>
        )}

        {/* ── END SCREEN ── */}
        {phase === "finished" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(10px)" }}
            data-testid="end-screen"
          >
            <div
              data-testid="race-result"
              className={isWin ? "result-win" : "result-lose"}
              style={{
                fontFamily: "Unbounded, sans-serif",
                fontSize:   "5.5rem",
                fontWeight: 900,
                color:      isWin ? "#75D481" : "#FF5252",
                lineHeight: 1,
                marginBottom: "0.5rem",
              }}
            >
              {isWin ? "YOU WIN!" : "YOU LOSE!"}
            </div>

            <div className="text-white/65 text-base mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>
              Final Time:{" "}
              <span data-testid="final-time" className="text-white font-bold">
                {fmtTime(hud.time)}
              </span>
            </div>
            <div className="text-white/65 text-base mb-10" style={{ fontFamily: "Outfit, sans-serif" }}>
              Finished:{" "}
              <span className="text-white font-bold">
                Position {gsRef.current?.player?.finPos || (isWin ? 1 : 3)}
              </span>
            </div>

            <button
              data-testid="play-again-btn"
              onClick={handleRestart}
              className="px-10 py-4 rounded-2xl text-white font-black text-base uppercase tracking-widest transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-95"
              style={{
                fontFamily: "Unbounded, sans-serif",
                background: isWin
                  ? "linear-gradient(135deg, #75D481, #4CAF50)"
                  : "linear-gradient(135deg, #4DA8DA, #3B82F6)",
                boxShadow: isWin
                  ? "0 8px 30px rgba(117,212,129,0.5)"
                  : "0 8px 30px rgba(77,168,218,0.5)",
              }}
            >
              PLAY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
