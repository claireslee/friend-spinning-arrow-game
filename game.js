'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const WHEEL_RADIUS   = 80;
const ARROW_LENGTH   = 60;
const ARROW_SPEED    = 12;
const COLLISION_ANGLE = 0.18; // radians — min gap between stuck arrows

// Face crop data — manually verified against preview crops
const FACE_DATA = [
  { file: 'img1.jpg', cx: 391, cy: 251, r: 260, imgW: 600,  imgH: 800 },
  { file: 'img2.jpg', cx: 200, cy:  55, r:  80, imgW: 800,  imgH: 625 },
  { file: 'img3.jpg', cx: 458, cy: 233, r: 116, imgW: 800,  imgH: 600 },
  { file: 'img4.jpg', cx: 567, cy: 177, r:  64, imgW: 800,  imgH: 533 },
];

// 25 levels: arrowsToFire, wheel rotationSpeed (rad/frame), preplaced arrows, time limit (s)
const LEVELS = [
  { arrowsToFire:  5, speed: 0.018, preplaced:  0, time: 30 },
  { arrowsToFire:  6, speed: 0.020, preplaced:  0, time: 29 },
  { arrowsToFire:  6, speed: 0.023, preplaced:  1, time: 29 },
  { arrowsToFire:  7, speed: 0.025, preplaced:  1, time: 28 },
  { arrowsToFire:  7, speed: 0.028, preplaced:  2, time: 28 },
  { arrowsToFire:  8, speed: 0.030, preplaced:  2, time: 27 },
  { arrowsToFire:  8, speed: 0.033, preplaced:  2, time: 26 },
  { arrowsToFire:  9, speed: 0.035, preplaced:  3, time: 26 },
  { arrowsToFire:  9, speed: 0.038, preplaced:  3, time: 25 },
  { arrowsToFire: 10, speed: 0.040, preplaced:  3, time: 24 },
  { arrowsToFire: 10, speed: 0.043, preplaced:  4, time: 24 },
  { arrowsToFire: 11, speed: 0.045, preplaced:  4, time: 23 },
  { arrowsToFire: 11, speed: 0.048, preplaced:  4, time: 23 },
  { arrowsToFire: 12, speed: 0.050, preplaced:  5, time: 22 },
  { arrowsToFire: 12, speed: 0.053, preplaced:  5, time: 21 },
  { arrowsToFire: 13, speed: 0.056, preplaced:  5, time: 21 },
  { arrowsToFire: 13, speed: 0.060, preplaced:  6, time: 20 },
  { arrowsToFire: 14, speed: 0.063, preplaced:  6, time: 19 },
  { arrowsToFire: 14, speed: 0.067, preplaced:  6, time: 19 },
  { arrowsToFire: 15, speed: 0.070, preplaced:  7, time: 18 },
  { arrowsToFire: 15, speed: 0.074, preplaced:  7, time: 18 },
  { arrowsToFire: 16, speed: 0.078, preplaced:  8, time: 17 },
  { arrowsToFire: 16, speed: 0.082, preplaced:  8, time: 16 },
  { arrowsToFire: 17, speed: 0.086, preplaced:  9, time: 16 },
  { arrowsToFire: 18, speed: 0.090, preplaced: 10, time: 15 },
];

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const canvas    = document.getElementById('gameCanvas');
const ctx       = canvas.getContext('2d');
const lsScreen  = document.getElementById('level-select');
const gameWrap  = document.getElementById('game-wrapper');
const overlay   = document.getElementById('overlay');

// ─── State ────────────────────────────────────────────────────────────────────

let screen         = 'levelselect'; // 'levelselect' | 'playing'
let currentLevel   = 0;
let wheelAngle     = 0;
let stuckArrows    = [];
let flyingArrow    = null;
let arrowsFired    = 0;
// 'idle' | 'flying' | 'dead' | 'timeout' | 'won' | 'showing-overlay'
let gamePhase      = 'idle';
let timeRemaining  = 0;
let levelStartTime = 0;
let deathPending   = false;
let lastLevelBeaten = parseInt(localStorage.getItem('lastLevelBeaten')) || 0;
let cx = 0, cy = 0;

// Preload face images
const faceImages = FACE_DATA.map(fd => {
  const img = new Image();
  img.src = fd.file;
  return img;
});

// ─── Resize ───────────────────────────────────────────────────────────────────

function resize() {
  const size = Math.min(window.innerWidth, window.innerHeight - 90);
  canvas.width  = size;
  canvas.height = size;
  cx = size / 2;
  cy = size / 2;
}

window.addEventListener('resize', resize);

// ─── Screen management ────────────────────────────────────────────────────────

function showLevelSelect() {
  screen = 'levelselect';
  lsScreen.classList.remove('hidden');
  gameWrap.classList.add('hidden');
  hideOverlay();
  buildLevelSelect();
}

function showGame() {
  screen = 'playing';
  lsScreen.classList.add('hidden');
  gameWrap.classList.remove('hidden');
}

// ─── Level select ─────────────────────────────────────────────────────────────

function getLevelStatus(idx) {
  if (lastLevelBeaten >= idx + 1) return 'beaten';    // already cleared
  if (lastLevelBeaten >= idx)     return 'available'; // unlocked, not yet beaten
  return 'locked';
}

function buildLevelSelect() {
  const bestEl = document.getElementById('ls-best');
  bestEl.textContent = lastLevelBeaten > 0
    ? `Best cleared: Level ${lastLevelBeaten}`
    : 'No levels cleared yet — start from Level 1!';

  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';

  for (let i = 0; i < LEVELS.length; i++) {
    const status = getLevelStatus(i);
    const btn = document.createElement('button');
    btn.className = `level-btn level-${status}`;

    const numEl  = document.createElement('span');
    numEl.className = 'lnum';
    numEl.textContent = i + 1;

    const iconEl = document.createElement('span');
    iconEl.className = 'licon';
    if (status === 'beaten')      iconEl.textContent = '✓';
    else if (status === 'locked') iconEl.textContent = '🔒';

    btn.appendChild(numEl);
    btn.appendChild(iconEl);

    if (status !== 'locked') {
      btn.addEventListener('click', () => { showGame(); startLevel(i); });
    } else {
      btn.disabled = true;
    }

    grid.appendChild(btn);
  }
}

// ─── Level setup ──────────────────────────────────────────────────────────────

function startLevel(idx) {
  currentLevel   = idx;
  const def      = LEVELS[idx];
  wheelAngle     = 0;
  stuckArrows    = [];
  flyingArrow    = null;
  arrowsFired    = 0;
  gamePhase      = 'idle';
  deathPending   = false;
  timeRemaining  = def.time;
  levelStartTime = performance.now();

  for (let i = 0; i < def.preplaced; i++) {
    stuckArrows.push({ angle: (i / def.preplaced) * Math.PI * 2 });
  }

  updateUI();
  hideOverlay();
}

function updateUI() {
  const def = LEVELS[currentLevel];
  document.getElementById('level-num').textContent   = currentLevel + 1;
  document.getElementById('arrows-left').textContent = def.arrowsToFire - arrowsFired;
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

function showOverlay(title, sub, btn1Text, btn1Fn, btn2Text, btn2Fn) {
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-sub').textContent   = sub;

  const btn1 = document.getElementById('overlay-btn');
  btn1.textContent = btn1Text;
  btn1.onclick     = btn1Fn;

  const btn2 = document.getElementById('overlay-btn2');
  if (btn2Text) {
    btn2.textContent = btn2Text;
    btn2.onclick     = btn2Fn;
    btn2.classList.remove('hidden');
  } else {
    btn2.classList.add('hidden');
  }

  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

// ─── Game logic ───────────────────────────────────────────────────────────────

function fireArrow() {
  if (screen !== 'playing' || gamePhase !== 'idle') return;
  flyingArrow = { x: cx, y: canvas.height - 20, vy: -ARROW_SPEED };
  gamePhase = 'flying';
}

function checkCollision(angle) {
  for (const s of stuckArrows) {
    let diff = Math.abs(angle - s.angle) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < COLLISION_ANGLE) return true;
  }
  return false;
}

function arrowHitsWheel() {
  const impactAngle = ((Math.PI / 2 - wheelAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

  if (checkCollision(impactAngle)) {
    gamePhase = 'dead';
    return;
  }

  stuckArrows.push({ angle: impactAngle });
  arrowsFired++;
  flyingArrow = null;

  if (arrowsFired >= LEVELS[currentLevel].arrowsToFire) {
    gamePhase = 'won';
    setTimeout(onLevelWon, 400);
  } else {
    gamePhase = 'idle';
  }
  updateUI();
}

function onLevelWon() {
  const beaten = currentLevel + 1;
  if (beaten > lastLevelBeaten) {
    lastLevelBeaten = beaten;
    localStorage.setItem('lastLevelBeaten', lastLevelBeaten);
  }

  if (currentLevel + 1 >= LEVELS.length) {
    showOverlay('You Win!', 'All 25 levels complete!',
      'Play Again', () => startLevel(0),
      null, null
    );
  } else {
    showOverlay(
      'Level Clear!', `Level ${currentLevel + 1} done`,
      'Next Level', () => startLevel(currentLevel + 1),
      'Retry Level', () => startLevel(currentLevel)
    );
  }
  gamePhase = 'showing-overlay';
}

function onDeath(reason) {
  const title = reason === 'timeout' ? "Time's Up!" : 'Hit!';
  showOverlay(
    title, `Level ${currentLevel + 1}`,
    'Retry', () => startLevel(currentLevel),
    null, null
  );
  gamePhase = 'showing-overlay';
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

function drawBackground() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawFaceInWheel() {
  const idx = currentLevel % 4;
  const img = faceImages[idx];
  const fd  = FACE_DATA[idx];
  if (!img.complete || img.naturalWidth === 0) return;

  const innerR = WHEEL_RADIUS - 5;
  const r      = fd.r;

  // Clamp source rect to image bounds
  const srcX  = Math.max(0, fd.cx - r);
  const srcY  = Math.max(0, fd.cy - r);
  const srcX2 = Math.min(fd.cx + r, fd.imgW);
  const srcY2 = Math.min(fd.cy + r, fd.imgH);
  const srcW  = srcX2 - srcX;
  const srcH  = srcY2 - srcY;
  if (srcW <= 0 || srcH <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.clip();

  const d = innerR * 2;
  ctx.drawImage(img, srcX, srcY, srcW, srcH, cx - innerR, cy - innerR, d, d);
  ctx.restore();
}

function drawTimerRing() {
  const def      = LEVELS[currentLevel];
  const fraction = Math.max(0, timeRemaining / def.time);
  const color    = fraction > 0.5 ? '#50fa7b' : fraction > 0.25 ? '#f5a623' : '#e94560';

  ctx.save();

  // Track
  ctx.beginPath();
  ctx.arc(cx, cy, WHEEL_RADIUS + 14, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth   = 7;
  ctx.stroke();

  // Depleting arc (clockwise from top)
  ctx.beginPath();
  ctx.arc(cx, cy, WHEEL_RADIUS + 14,
    -Math.PI / 2,
    -Math.PI / 2 + fraction * Math.PI * 2
  );
  ctx.strokeStyle = color;
  ctx.lineWidth   = 7;
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Countdown number above wheel
  ctx.fillStyle    = color;
  ctx.font         = 'bold 22px Arial';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(Math.ceil(timeRemaining), cx, cy - WHEEL_RADIUS - 28);

  ctx.restore();
}

function drawWheel() {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, WHEEL_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = '#e94560';
  ctx.lineWidth   = 4;
  ctx.stroke();
  ctx.restore();
}

function drawStuckArrows() {
  for (const s of stuckArrows) {
    const a    = s.angle + wheelAngle;
    const tipX = cx + Math.cos(a) * WHEEL_RADIUS;
    const tipY = cy + Math.sin(a) * WHEEL_RADIUS;
    drawArrow(cx + Math.cos(a) * (WHEEL_RADIUS + ARROW_LENGTH),
              cy + Math.sin(a) * (WHEEL_RADIUS + ARROW_LENGTH),
              tipX, tipY, '#f5a623');
  }
}

function drawFlyingArrow() {
  if (!flyingArrow) return;
  drawArrow(flyingArrow.x, flyingArrow.y + ARROW_LENGTH,
            flyingArrow.x, flyingArrow.y, '#50fa7b');
}

function drawLaunchArrow() {
  if (gamePhase !== 'idle') return;
  drawArrow(cx, canvas.height - 20 + ARROW_LENGTH,
            cx, canvas.height - 20, '#50fa7b');
}

function drawArrow(tailX, tailY, tipX, tipY, color) {
  const dx  = tipX - tailX;
  const dy  = tipY - tailY;
  const ang = Math.atan2(dy, dx);
  const hl  = 12;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 3;
  ctx.lineCap     = 'round';

  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - hl * Math.cos(ang - Math.PI / 6),
             tipY - hl * Math.sin(ang - Math.PI / 6));
  ctx.lineTo(tipX - hl * Math.cos(ang + Math.PI / 6),
             tipY - hl * Math.sin(ang + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ─── Main loop ────────────────────────────────────────────────────────────────

function update(now) {
  if (gamePhase === 'showing-overlay' || gamePhase === 'won') return;

  wheelAngle += LEVELS[currentLevel].speed;

  if (gamePhase === 'idle' || gamePhase === 'flying') {
    timeRemaining = Math.max(0, LEVELS[currentLevel].time - (now - levelStartTime) / 1000);
    if (timeRemaining <= 0) { gamePhase = 'timeout'; return; }
  }

  if (flyingArrow) {
    flyingArrow.y += flyingArrow.vy;
    if (Math.hypot(flyingArrow.x - cx, flyingArrow.y - cy) <= WHEEL_RADIUS + 2) {
      arrowHitsWheel();
    } else if (flyingArrow.y < cy - WHEEL_RADIUS - 20) {
      flyingArrow = null;
      gamePhase   = 'idle';
    }
  }
}

function loop(now) {
  if (screen === 'playing') {
    update(now);
    drawBackground();
    drawTimerRing();
    drawFaceInWheel();
    drawWheel();
    drawStuckArrows();
    drawFlyingArrow();
    drawLaunchArrow();

    if ((gamePhase === 'dead' || gamePhase === 'timeout') && !deathPending) {
      deathPending = true;
      const reason = gamePhase;
      gamePhase = 'showing-overlay';
      setTimeout(() => { onDeath(reason); deathPending = false; }, 200);
    }
  }
  requestAnimationFrame(loop);
}

// ─── Input ────────────────────────────────────────────────────────────────────

canvas.addEventListener('click', fireArrow);
canvas.addEventListener('touchstart', e => { e.preventDefault(); fireArrow(); }, { passive: false });
document.getElementById('menu-btn').addEventListener('click', showLevelSelect);
document.getElementById('overlay-menu-btn').addEventListener('click', showLevelSelect);

// ─── Boot ─────────────────────────────────────────────────────────────────────

resize();
showLevelSelect();
requestAnimationFrame(loop);
