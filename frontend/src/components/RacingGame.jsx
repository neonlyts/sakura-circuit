import React, { useRef, useEffect, useState, useCallback } from "react";

// =====================================================================
// CONSTANTS
// =====================================================================
const CW = 900;
const CH = 560;
const TOTAL_LAPS = 3;
const TW = 72;        // track width
const TH = TW / 2;   // track half-width
const CAR_W = 14;     // car body width (perpendicular to travel)
const CAR_H = 26;     // car body height (along travel axis)
const SEGS = 16;      // catmull-rom segments per control-point section

// Car definitions
const CARS = {
  red:    { color: "#EF4444", name: "Sakura Red",   stat: "Speed",    rating: 9 },
  blue:   { color: "#3B82F6", name: "Tokyo Blue",   stat: "Control",  rating: 8 },
  yellow: { color: "#EAB308", name: "Fuji Yellow",  stat: "Balanced", rating: 7 },
};

// =====================================================================
// TRACK – Classic circuit: main straight → right sweep → back straight
//         → top straight → left hairpin → return straight
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

// Decorative cherry-blossom tree positions (infield + outside)
const TREES = [
  { x: 440, y: 180, s: 1.2 }, { x: 545, y: 208, s: 0.9 },
  { x: 340, y: 242, s: 1.0 }, { x: 640, y: 228, s: 1.1 },
  { x: 484, y: 294, s: 0.8 }, { x: 392, y: 358, s: 1.0 },
  { x: 590, y: 362, s: 0.9 }, { x: 472, y: 418, s: 0.8 },
  { x: 665, y: 412, s: 0.7 }, { x: 270, y: 310, s: 0.9 },
  // Outside the track
  { x: 46,  y: 192, s: 1.0 }, { x: 48,  y: 312, s: 0.9 },
  { x: 56,  y: 412, s: 1.1 }, { x: 860, y: 212, s: 1.0 },
  { x: 868, y: 342, s: 0.9 }, { x: 848, y: 448, s: 0.8 },
  { x: 156, y: 138, s: 0.8 }, { x: 818, y: 148, s: 0.8 },
];

// =====================================================================
// MATH UTILITIES
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

// Precompute once (outside component)
const SMOOTH = buildSmoothTrack(CTRL_PTS);

// =====================================================================
// CAR FACTORY
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
    // Input flags
    iAccel: false, iBrake: false, iLeft: false, iRight: false,
    // Race state
    lap: 1, hint, halfway: false, finished: false, finPos: 0, onTrack: true,
  };
}

// =====================================================================
// PHYSICS
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
// AI STEERING
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
  // Medium difficulty: small occasional error
  if (Math.random() < 0.013) { car.iLeft = Math.random() < 0.5; car.iRight = !car.iLeft; }
}

// =====================================================================
// PROGRESS & LAP DETECTION
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
  car.hint     = idx;
  car.onTrack  = best < (TH + 14) ** 2;

  const halfIdx   = Math.floor(n * 0.42);
  const finishIdx = Math.floor(n * 0.07);

  if (idx > halfIdx  && !car.halfway) car.halfway = true;
  if (car.halfway && idx < finishIdx) { car.halfway = false; car.lap++; }
}

// =====================================================================
// BOUNDARY CORRECTION
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
// POSITION HELPER
// =====================================================================
function getRacePos(player, ai1, ai2) {
  const sorted = [player, ai1, ai2].slice().sort((a, b) =>
    b.lap !== a.lap ? b.lap - a.lap : b.hint - a.hint
  );
  return sorted.findIndex(c => c.isPlayer) + 1;
}

// =====================================================================
// RENDERING
// =====================================================================
function drawBackground(ctx) {
  // Sky
  const sg = ctx.createLinearGradient(0, 0, 0, 210);
  sg.addColorStop(0, "#52ABCC"); sg.addColorStop(1, "#A8D8EF");
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, CW, 210);

  // Clouds
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  [[80,52,48],[230,38,38],[500,58,52],[685,44,40],[830,54,36]].forEach(([cx,cy,r]) => {
    ctx.beginPath(); ctx.arc(cx,    cy,    r,      0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+33, cy+8,  r*0.68, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx-28, cy+10, r*0.62, 0, Math.PI*2); ctx.fill();
  });

  // Grass
  const gg = ctx.createLinearGradient(0, 200, 0, CH);
  gg.addColorStop(0, "#5CB85C"); gg.addColorStop(1, "#3E9E3E");
  ctx.fillStyle = gg; ctx.fillRect(0, 200, CW, CH - 200);

  // Horizon blend
  const hg = ctx.createLinearGradient(0, 192, 0, 222);
  hg.addColorStop(0, "#A8D8EF"); hg.addColorStop(1, "#5CB85C");
  ctx.fillStyle = hg; ctx.fillRect(0, 192, CW, 30);
}

function drawMountains(ctx) {
  const mts = [
    [0, 178, 118, 38, 246, 178],
    [300, 172, 462, 22, 608, 172],
    [622, 178, 742, 47, 872, 178],
  ];
  mts.forEach(([x1,y1,mx,my,x2,y2], i) => {
    ctx.fillStyle = i === 1 ? "#88B8CA" : "#7AABB8";
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(mx, my, x2, y2);
    ctx.lineTo(x2, 210); ctx.lineTo(x1, 210); ctx.fill();
  });
  // Snow caps
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  [[360,37,462,15,560,37],[638,60,742,40,846,60]].forEach(([x1,y1,mx,my,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(mx,my,x2,y2); ctx.closePath(); ctx.fill();
  });
}

function drawTree(ctx, x, y, s) {
  // Trunk
  ctx.fillStyle = "#8B5E3C";
  ctx.fillRect(x - 3*s, y, 6*s, 18*s);
  // Blossom cloud
  const pinks = ["#FFB7C5","#FF9EBB","#FFCDD9","#FF85A1","#FFD0DC","#FF9EBB"];
  const offsets = [[0,-7],[-11,-3],[11,-3],[-6,-15],[6,-15],[0,-19],[-13,-11],[13,-11]];
  offsets.forEach(([ox,oy], i) => {
    ctx.fillStyle = pinks[i % pinks.length];
    ctx.globalAlpha = 0.86;
    ctx.beginPath(); ctx.arc(x + ox*s, y + oy*s, 10*s, 0, Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function buildPath(ctx, smooth) {
  ctx.beginPath();
  ctx.moveTo(smooth[0].x, smooth[0].y);
  for (let i = 1; i < smooth.length; i++) ctx.lineTo(smooth[i].x, smooth[i].y);
  ctx.lineTo(smooth[0].x, smooth[0].y);
}

function drawTrack(ctx, smooth) {
  ctx.save();
  ctx.lineJoin = "round"; ctx.lineCap = "round";

  // White curb border
  buildPath(ctx, smooth);
  ctx.lineWidth = TW + 16; ctx.strokeStyle = "#E6E2DC"; ctx.stroke();

  // Asphalt
  buildPath(ctx, smooth);
  ctx.lineWidth = TW; ctx.strokeStyle = "#464A54"; ctx.stroke();

  // Dashed center line
  buildPath(ctx, smooth);
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,210,0.44)";
  ctx.setLineDash([16,12]); ctx.stroke(); ctx.setLineDash([]);

  ctx.restore();
}

function drawStartFinish(ctx, smooth) {
  const pt   = smooth[0];
  const pt2  = smooth[4];
  const ang  = Math.atan2(pt2.y - pt.y, pt2.x - pt.x);
  const perp = ang + Math.PI / 2;
  const half = TH - 2;
  const cellH = (TH * 2) / 6;

  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 6; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? "#FFFFFF" : "#111111";
      ctx.save();
      ctx.translate(
        pt.x + Math.cos(perp) * (cellH * c - half) + Math.cos(ang) * (r * 5),
        pt.y + Math.sin(perp) * (cellH * c - half) + Math.sin(ang) * (r * 5)
      );
      ctx.rotate(ang);
      ctx.fillRect(0, 0, 5, cellH + 0.5);
      ctx.restore();
    }
  }
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arc(x + w - r, y + r, r, -Math.PI/2, 0);
  ctx.lineTo(x + w, y + h - r); ctx.arc(x + w - r, y + h - r, r, 0, Math.PI/2);
  ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + h - r, r, Math.PI/2, Math.PI);
  ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, -Math.PI/2);
  ctx.closePath();
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.ellipse(2, 2, CAR_H/2+2, CAR_W/2+1, 0, 0, Math.PI*2); ctx.fill();

  // Body
  ctx.fillStyle = car.color;
  roundedRect(ctx, -CAR_H/2, -CAR_W/2, CAR_H, CAR_W, 4);
  ctx.fill();

  // Roof panel
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.fillRect(-CAR_H/2 + 6, -CAR_W/2 + 3, CAR_H - 12, CAR_W - 6);

  // Windshield (front)
  ctx.fillStyle = "rgba(175,215,255,0.72)";
  ctx.fillRect(CAR_H/2 - 9, -CAR_W/2 + 3, 7, CAR_W - 6);

  // Rear window
  ctx.fillStyle = "rgba(175,215,255,0.52)";
  ctx.fillRect(-CAR_H/2 + 2, -CAR_W/2 + 3, 5, CAR_W - 6);

  // Headlights (front)
  ctx.fillStyle = "#FFFF88";
  ctx.fillRect(CAR_H/2 - 2, -CAR_W/2 + 2, 3, 4);
  ctx.fillRect(CAR_H/2 - 2, CAR_W/2 - 6, 3, 4);

  // Taillights (rear)
  ctx.fillStyle = "#FF2222";
  ctx.fillRect(-CAR_H/2, -CAR_W/2 + 2, 3, 4);
  ctx.fillRect(-CAR_H/2, CAR_W/2 - 6, 3, 4);

  ctx.restore();
}

function renderAll(canvas, gs) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CW, CH);
  drawBackground(ctx);
  drawMountains(ctx);
  TREES.forEach(t => drawTree(ctx, t.x, t.y, t.s));
  drawTrack(ctx, gs.smooth);
  drawStartFinish(ctx, gs.smooth);
  if (gs.player && gs.ai1 && gs.ai2) {
    // Draw cars furthest-back first
    [gs.ai1, gs.ai2, gs.player]
      .slice().sort((a, b) => a.hint - b.hint)
      .forEach(c => drawCar(ctx, c));
  }
}

function renderStaticTrack(canvas) {
  renderAll(canvas, { smooth: SMOOTH });
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
  const [phase, setPhase]         = useState("car-select");
  const [selectedCar, setSelectedCar] = useState("red");
  const [cdNum, setCdNum]         = useState(3);
  const [hud, setHud]             = useState({ spd: 0, lap: 1, time: 0, pos: 1 });
  const [result, setResult]       = useState(null);

  const canvasRef  = useRef(null);
  const gsRef      = useRef(null);
  const keysRef    = useRef(new Set());
  const rafRef     = useRef(null);
  const lastTRef   = useRef(null);
  const startTRef  = useRef(null);
  const phaseRef   = useRef("car-select");

  // Keep phaseRef in sync with phase state
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Keyboard handlers
  useEffect(() => {
    const onDown = (e) => {
      keysRef.current.add(e.code);
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
    };
    const onUp = (e) => keysRef.current.delete(e.code);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // Render static track on mount
  useEffect(() => {
    if (canvasRef.current) renderStaticTrack(canvasRef.current);
  }, []);

  // Re-render when phase goes to countdown (after initGameState)
  useEffect(() => {
    if (phase === "countdown" && canvasRef.current && gsRef.current) {
      renderAll(canvasRef.current, gsRef.current);
    }
  }, [phase]);

  const initGameState = useCallback((car) => {
    const aiCols   = Object.keys(CARS).filter(c => c !== car);
    const startAng = Math.atan2(SMOOTH[1].y - SMOOTH[0].y, SMOOTH[1].x - SMOOTH[0].x);
    gsRef.current = {
      smooth:        SMOOTH,
      player:        makeCar(238, 475, startAng, car,       true,  6),
      ai1:           makeCar(198, 505, startAng, aiCols[0], false, 4),
      ai2:           makeCar(158, 475, startAng, aiCols[1], false, 2),
      finishedCount: 0,
    };
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

    // AI
    aiSteer(gs.ai1, gs.smooth);
    aiSteer(gs.ai2, gs.smooth);

    // Physics
    physicsStep(p, dt);
    physicsStep(gs.ai1, dt);
    physicsStep(gs.ai2, dt);

    // Progress & laps
    trackProgress(p, gs.smooth);
    trackProgress(gs.ai1, gs.smooth);
    trackProgress(gs.ai2, gs.smooth);

    // Boundary
    clampToTrack(p, gs.smooth);
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

    // Render
    if (canvasRef.current) renderAll(canvasRef.current, gs);

    // HUD update
    const elapsed = startTRef.current ? (ts - startTRef.current) / 1000 : 0;
    const pos = getRacePos(p, gs.ai1, gs.ai2);
    setHud({ spd: Math.round(Math.abs(p.speed) * 55), lap: Math.min(p.lap, TOTAL_LAPS), time: elapsed, pos });

    // Race end: player finished
    if (p.finished) {
      setResult(p.finPos === 1 ? "win" : "lose");
      setPhase("finished");
      return;
    }
    // Race end: both AIs done, player hasn't
    if (gs.ai1.finished && gs.ai2.finished && !p.finished) {
      p.finPos = 3;
      setResult("lose");
      setPhase("finished");
      return;
    }

    rafRef.current = requestAnimationFrame(gameLoop);
  }, []); // eslint-disable-line

  const startCountdown = useCallback(() => {
    initGameState(selectedCar);
    setPhase("countdown");

    let c = 3;
    setCdNum(c);
    const timer = setInterval(() => {
      c--;
      if (c > 0) {
        setCdNum(c);
      } else {
        setCdNum(0); // "GO!"
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
    setResult(null);
    setHud({ spd: 0, lap: 1, time: 0, pos: 1 });
    setPhase("car-select");
    setTimeout(() => {
      if (canvasRef.current) renderStaticTrack(canvasRef.current);
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
        <canvas ref={canvasRef} width={CW} height={CH} style={{ display: "block" }} />

        {/* ── CAR SELECTION OVERLAY ── */}
        {phase === "car-select" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: "rgba(10,20,40,0.68)", backdropFilter: "blur(6px)" }}
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
                const selected = selectedCar === key;
                return (
                  <button
                    key={key}
                    data-testid={`car-select-${key}`}
                    onClick={() => setSelectedCar(key)}
                    className="flex flex-col items-center p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer focus:outline-none"
                    style={{
                      minWidth: 148,
                      borderColor:  selected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)",
                      background:   selected ? `${car.color}28` : "rgba(255,255,255,0.06)",
                      backdropFilter: "blur(12px)",
                      transform: selected ? "scale(1.08)" : "scale(1)",
                      boxShadow: selected ? `0 0 28px ${car.color}66` : "none",
                    }}
                  >
                    {/* Car shape illustration */}
                    <div
                      className="mb-3 flex items-center justify-center rounded-xl"
                      style={{ width: 80, height: 48, background: `${car.color}22`, border: `2px solid ${car.color}66` }}
                    >
                      {/* Miniature car icon drawn with divs */}
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

                    {/* Stat bar */}
                    <div className="mt-2.5 w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
                      <div style={{ width: `${car.rating * 10}%`, height: "100%", background: car.color, borderRadius: 999 }} />
                    </div>

                    {selected && (
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
            style={{ background: "rgba(0,0,0,0.35)" }}
          >
            <div
              key={cdNum}
              className="countdown-num"
              data-testid="countdown-display"
              style={{
                fontFamily: "Unbounded, sans-serif",
                fontSize: cdNum === 0 ? "7rem" : "9rem",
                fontWeight: 900,
                color: cdNum === 0 ? "#75D481" : "#FFFFFF",
                textShadow: cdNum === 0
                  ? "0 0 50px #75D481, 0 0 100px #75D481"
                  : "0 4px 20px rgba(0,0,0,0.8)",
                lineHeight: 1,
              }}
            >
              {cdNum === 0 ? "GO!" : cdNum}
            </div>
            <p className="text-white/60 text-sm mt-4" style={{ fontFamily: "Outfit, sans-serif" }}>
              {cdNum > 0 ? "Get ready..." : "Full speed ahead!"}
            </p>
          </div>
        )}

        {/* ── HUD ── */}
        {phase === "racing" && (
          <div className="absolute top-3 left-3 right-3 flex justify-between items-center pointer-events-none gap-2">
            {/* Speed */}
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

            {/* Lap */}
            <div
              className="flex items-center gap-1.5 px-4 py-2 rounded-full"
              style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)" }}
            >
              <span className="text-white/55 text-xs font-semibold uppercase tracking-wider">Lap</span>
              <span data-testid="hud-lap" className="text-xl font-black text-white tabular-nums" style={{ fontFamily: "Unbounded, sans-serif" }}>
                {hud.lap}/{TOTAL_LAPS}
              </span>
            </div>

            {/* Timer */}
            <div
              className="flex items-center gap-1.5 px-4 py-2 rounded-full"
              style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)" }}
            >
              <span className="text-white/55 text-xs font-semibold uppercase tracking-wider">Time</span>
              <span data-testid="hud-time" className="text-xl font-black text-white tabular-nums" style={{ fontFamily: "Unbounded, sans-serif" }}>
                {fmtTime(hud.time)}
              </span>
            </div>

            {/* Position */}
            <div
              className="flex items-center gap-1 px-4 py-2 rounded-full transition-all"
              style={{
                background: hud.pos === 1 ? "rgba(117,212,129,0.75)" : "rgba(0,0,0,0.62)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <span data-testid="hud-pos" className="text-xl font-black text-white" style={{ fontFamily: "Unbounded, sans-serif" }}>
                P{hud.pos}
              </span>
            </div>
          </div>
        )}

        {/* Controls reminder during racing */}
        {phase === "racing" && (
          <div
            className="absolute bottom-3 right-3 pointer-events-none text-xs text-white/40"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            WASD / Arrow Keys to drive
          </div>
        )}

        {/* ── END SCREEN ── */}
        {phase === "finished" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(10px)" }}
            data-testid="end-screen"
          >
            {/* Result */}
            <div
              data-testid="race-result"
              className={isWin ? "result-win" : "result-lose"}
              style={{
                fontFamily: "Unbounded, sans-serif",
                fontSize: "5.5rem",
                fontWeight: 900,
                color: isWin ? "#75D481" : "#FF5252",
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

            <div className="flex gap-4">
              <button
                data-testid="play-again-btn"
                onClick={handleRestart}
                className="px-10 py-4 rounded-2xl text-white font-black text-base uppercase tracking-widest transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-95"
                style={{
                  fontFamily: "Unbounded, sans-serif",
                  background: isWin
                    ? "linear-gradient(135deg, #75D481, #4CAF50)"
                    : "linear-gradient(135deg, #4DA8DA, #3B82F6)",
                  boxShadow: isWin ? "0 8px 30px rgba(117,212,129,0.5)" : "0 8px 30px rgba(77,168,218,0.5)",
                }}
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
