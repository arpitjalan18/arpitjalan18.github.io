const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  time: document.getElementById('time'),
  kills: document.getElementById('kills'),
  overlay: document.getElementById('overlay'),
  overlayTitle: document.getElementById('overlayTitle'),
  overlayBody: document.getElementById('overlayBody'),
  overlayHint: document.getElementById('overlayHint'),
  start: document.getElementById('start'),
  startOverlay: document.getElementById('startOverlay')
};

const keys = new Set();
const mouse = {
  x: canvas.width * 0.5,
  y: canvas.height * 0.5,
  down: false
};

const state = {
  active: false,
  timeSurvived: 0,
  startTime: 0,
  lastTime: 0,
  kills: 0,
  stage: 0,
  bullets: [],
  particles: [],
  bloodStains: [],
  snow: [],
  wind: [],
  drifts: [],
  respawnTimer: 0,
  shake: 0
};

let player = createPlayer();
let enemy = null;

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createPlayer() {
  return {
    x: canvas.width * 0.5,
    y: canvas.height * 0.65,
    radius: 14,
    speed: 230,
    shootCooldown: 0,
    facing: { x: 1, y: 0 }
  };
}

function spawnEnemy() {
  state.stage += 1;
  const side = Math.floor(Math.random() * 4);
  const margin = 30;
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = randRange(margin, canvas.width - margin);
    y = -margin;
  } else if (side === 1) {
    x = canvas.width + margin;
    y = randRange(margin, canvas.height - margin);
  } else if (side === 2) {
    x = randRange(margin, canvas.width - margin);
    y = canvas.height + margin;
  } else {
    x = -margin;
    y = randRange(margin, canvas.height - margin);
  }

  enemy = {
    x,
    y,
    radius: 18,
    speed: 70 + state.stage * 12,
    driftStrength: 35 + state.stage * 7,
    evasionStrength: 25 + state.stage * 6,
    evasionSpeed: 2 + state.stage * 0.15,
    erraticTimer: 0,
    drift: { x: 0, y: 0 },
    wobble: Math.random() * Math.PI * 2
  };
}

function spawnBlood(x, y, intensity = 1) {
  const stains = Math.max(1, Math.round((6 + Math.random() * 5) * intensity));
  for (let i = 0; i < stains; i += 1) {
    state.bloodStains.push({
      x: x + randRange(-30, 30),
      y: y + randRange(-30, 30),
      radius: randRange(10, 26) * (0.7 + intensity * 0.3),
      alpha: randRange(0.28, 0.6)
    });
  }

  const sprayCount = Math.max(1, Math.round((45 + Math.random() * 20) * intensity));
  for (let i = 0; i < sprayCount; i += 1) {
    const angle = randRange(0, Math.PI * 2);
    const speed = randRange(120, 420) * (0.8 + intensity * 0.3);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randRange(0.4, 1.1),
      size: randRange(2, 6) * (0.8 + intensity * 0.25),
      color: Math.random() > 0.6 ? '#ff2d35' : '#8b0e18'
    });
  }

  state.particles.push({
    x,
    y,
    vx: 0,
    vy: 0,
    life: 0.5,
    size: randRange(30, 45) * (0.8 + intensity * 0.4),
    color: 'rgba(255,45,53,0.4)'
  });

  state.shake = Math.min(12, state.shake + 6);
}

function initEnvironment() {
  state.snow.length = 0;
  state.wind.length = 0;
  state.drifts.length = 0;

  for (let i = 0; i < 140; i += 1) {
    state.snow.push({
      x: randRange(0, canvas.width),
      y: randRange(0, canvas.height),
      radius: randRange(0.8, 2.4),
      speed: randRange(20, 60),
      drift: randRange(10, 35)
    });
  }

  for (let i = 0; i < 26; i += 1) {
    state.wind.push({
      x: randRange(-canvas.width, canvas.width),
      y: randRange(0, canvas.height),
      length: randRange(60, 140),
      speed: randRange(120, 200),
      alpha: randRange(0.12, 0.25)
    });
  }

  for (let i = 0; i < 9; i += 1) {
    state.drifts.push({
      x: randRange(80, canvas.width - 80),
      y: randRange(120, canvas.height - 60),
      rx: randRange(70, 160),
      ry: randRange(30, 70),
      rot: randRange(-0.3, 0.3)
    });
  }
}

function resetGame() {
  player = createPlayer();
  enemy = null;
  state.bullets.length = 0;
  state.particles.length = 0;
  state.bloodStains.length = 0;
  state.timeSurvived = 0;
  state.kills = 0;
  state.stage = 0;
  state.respawnTimer = 0;
  state.shake = 0;
  ui.kills.textContent = '0';
  ui.time.textContent = state.timeSurvived.toFixed(1);
  spawnEnemy();
}

function startGame() {
  resetGame();
  state.active = true;
  state.startTime = performance.now();
  ui.overlay.classList.add('hidden');
  ui.overlayTitle.textContent = 'Blizzard Countdown';
  ui.overlayBody.textContent = 'Move with WASD or arrow keys. Aim with your mouse. Click to shoot.';
  ui.overlayHint.textContent = 'Every Santa gets faster and more evasive. Survive as long as possible.';
}

function endGame() {
  state.active = false;
  mouse.down = false;
  ui.overlayTitle.textContent = 'Storm Ends';
  ui.overlayBody.textContent = `You survived ${state.timeSurvived.toFixed(1)}s and felled ${state.kills} Santa${state.kills === 1 ? '' : 's'}.`;
  ui.overlayHint.textContent = 'Hit Start to try for a new high score.';
  ui.overlay.classList.remove('hidden');
}

function updatePlayer(dt) {
  let moveX = 0;
  let moveY = 0;

  if (keys.has('w') || keys.has('ArrowUp')) moveY -= 1;
  if (keys.has('s') || keys.has('ArrowDown')) moveY += 1;
  if (keys.has('a') || keys.has('ArrowLeft')) moveX -= 1;
  if (keys.has('d') || keys.has('ArrowRight')) moveX += 1;

  const length = Math.hypot(moveX, moveY) || 1;
  const speed = player.speed;
  player.x += (moveX / length) * speed * dt;
  player.y += (moveY / length) * speed * dt;

  player.x = clamp(player.x, 24, canvas.width - 24);
  player.y = clamp(player.y, 24, canvas.height - 24);

  const aimX = mouse.x - player.x;
  const aimY = mouse.y - player.y;
  const aimLen = Math.hypot(aimX, aimY) || 1;
  player.facing.x = aimX / aimLen;
  player.facing.y = aimY / aimLen;

  if (player.shootCooldown > 0) {
    player.shootCooldown -= dt;
  }

  if (mouse.down && player.shootCooldown <= 0) {
    fireBullet();
    player.shootCooldown = 0.16;
  }
}

function fireBullet() {
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  const speed = 520;
  state.bullets.push({
    x: player.x + Math.cos(angle) * player.radius,
    y: player.y + Math.sin(angle) * player.radius,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1.2
  });
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (
      bullet.life <= 0 ||
      bullet.x < -40 ||
      bullet.x > canvas.width + 40 ||
      bullet.y < -40 ||
      bullet.y > canvas.height + 40
    ) {
      state.bullets.splice(i, 1);
    }
  }
}

function updateEnemy(dt) {
  if (!enemy) return;

  const toPlayerX = player.x - enemy.x;
  const toPlayerY = player.y - enemy.y;
  const dist = Math.hypot(toPlayerX, toPlayerY) || 1;
  const dirX = toPlayerX / dist;
  const dirY = toPlayerY / dist;

  enemy.erraticTimer -= dt;
  if (enemy.erraticTimer <= 0) {
    const angle = randRange(0, Math.PI * 2);
    const strength = enemy.driftStrength * randRange(0.4, 1.1);
    enemy.drift.x = Math.cos(angle) * strength;
    enemy.drift.y = Math.sin(angle) * strength;
    enemy.erraticTimer = randRange(0.3, 1.1);
  }

  enemy.wobble += dt * enemy.evasionSpeed;
  const perpX = -dirY;
  const perpY = dirX;
  const evasion = Math.sin(enemy.wobble) * enemy.evasionStrength;

  let dodgeX = 0;
  let dodgeY = 0;
  for (let i = 0; i < state.bullets.length; i += 1) {
    const bullet = state.bullets[i];
    const dx = enemy.x - bullet.x;
    const dy = enemy.y - bullet.y;
    const d = Math.hypot(dx, dy);
    if (d > 0 && d < 140) {
      const push = (140 - d) * 2.2;
      dodgeX += (dx / d) * push;
      dodgeY += (dy / d) * push;
    }
  }

  let velocityX = dirX * enemy.speed + perpX * evasion + enemy.drift.x + dodgeX;
  let velocityY = dirY * enemy.speed + perpY * evasion + enemy.drift.y + dodgeY;
  const maxSpeed = enemy.speed * 1.6;
  const velocityMag = Math.hypot(velocityX, velocityY) || 1;
  if (velocityMag > maxSpeed) {
    velocityX = (velocityX / velocityMag) * maxSpeed;
    velocityY = (velocityY / velocityMag) * maxSpeed;
  }

  const nextX = enemy.x + velocityX * dt;
  const nextY = enemy.y + velocityY * dt;
  const margin = 24;

  if (nextX < margin || nextX > canvas.width - margin) {
    enemy.drift.x *= -0.7;
  }
  if (nextY < margin || nextY > canvas.height - margin) {
    enemy.drift.y *= -0.7;
  }

  enemy.x = clamp(nextX, margin, canvas.width - margin);
  enemy.y = clamp(nextY, margin, canvas.height - margin);
}

function checkCollisions() {
  if (!enemy) return;

  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    const dx = bullet.x - enemy.x;
    const dy = bullet.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist < enemy.radius) {
      state.bullets.splice(i, 1);
      state.kills += 1;
      ui.kills.textContent = String(state.kills);
      spawnBlood(enemy.x, enemy.y, 1);
      enemy = null;
      state.respawnTimer = 0.55;
      break;
    }
  }
}

function checkPlayerCaught() {
  if (!enemy || !state.active) return;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  if (dist < enemy.radius + player.radius - 2) {
    spawnBlood(player.x, player.y, 2);
    enemy = null;
    endGame();
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const particle = state.particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.92;
    particle.vy *= 0.92;
    particle.life -= dt;

    if (particle.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
}

function updateSnow(dt) {
  for (let i = 0; i < state.snow.length; i += 1) {
    const flake = state.snow[i];
    flake.x += flake.drift * dt;
    flake.y += flake.speed * dt;

    if (flake.x > canvas.width + 20) {
      flake.x = -20;
    }
    if (flake.y > canvas.height + 20) {
      flake.y = -20;
    }
  }

  for (let i = 0; i < state.wind.length; i += 1) {
    const streak = state.wind[i];
    streak.x += streak.speed * dt;
    streak.y += Math.sin(streak.x * 0.005) * 0.2;
    if (streak.x - streak.length > canvas.width + 200) {
      streak.x = -canvas.width - randRange(0, 200);
      streak.y = randRange(0, canvas.height);
    }
  }
}

function updateSurvival(now) {
  const elapsed = (now - state.startTime) / 1000;
  state.timeSurvived = Math.max(0, elapsed);
  ui.time.textContent = state.timeSurvived.toFixed(1);
}

function drawLandscape() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#f4fbff');
  gradient.addColorStop(0.45, '#d6ecff');
  gradient.addColorStop(1, '#b1d0eb');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  for (let i = 0; i < state.drifts.length; i += 1) {
    const drift = state.drifts[i];
    ctx.save();
    ctx.translate(drift.x, drift.y);
    ctx.rotate(drift.rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, drift.rx, drift.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(180, 210, 235, 0.22)';
  for (let i = 0; i < 110; i += 1) {
    const x = (i * 67) % canvas.width;
    const y = (i * 97) % canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBloodStains() {
  for (let i = 0; i < state.bloodStains.length; i += 1) {
    const stain = state.bloodStains[i];
    ctx.fillStyle = `rgba(120, 10, 20, ${stain.alpha})`;
    ctx.beginPath();
    ctx.arc(stain.x, stain.y, stain.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = '#1f5b3a';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius + 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f2d4b4';
  ctx.beginPath();
  ctx.arc(0, -4, player.radius - 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#c12b2f';
  ctx.beginPath();
  ctx.moveTo(-6, -12);
  ctx.lineTo(0, -28);
  ctx.lineTo(6, -12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f9f3f2';
  ctx.beginPath();
  ctx.arc(0, -28, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#141414';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawEnemy() {
  if (!enemy) return;

  ctx.save();
  ctx.translate(enemy.x, enemy.y);

  ctx.fillStyle = '#d12f2f';
  ctx.beginPath();
  ctx.arc(0, 2, enemy.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, -6, enemy.radius - 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f2d4b4';
  ctx.beginPath();
  ctx.arc(0, -10, enemy.radius - 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#111111';
  ctx.fillRect(-enemy.radius + 2, 2, enemy.radius * 2 - 4, 5);
  ctx.fillStyle = '#f7c54a';
  ctx.fillRect(-6, 2, 12, 5);

  ctx.fillStyle = '#f9f3f2';
  ctx.beginPath();
  ctx.arc(0, enemy.radius - 4, enemy.radius - 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(-4, -10, 2, 0, Math.PI * 2);
  ctx.arc(4, -10, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBullets() {
  ctx.fillStyle = '#ffe5b0';
  for (let i = 0; i < state.bullets.length; i += 1) {
    const bullet = state.bullets[i];
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (let i = 0; i < state.particles.length; i += 1) {
    const particle = state.particles[i];
    const alpha = Math.max(particle.life, 0);
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawSnowAndWind() {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  for (let i = 0; i < state.wind.length; i += 1) {
    const streak = state.wind[i];
    ctx.globalAlpha = streak.alpha;
    ctx.beginPath();
    ctx.moveTo(streak.x, streak.y);
    ctx.lineTo(streak.x + streak.length, streak.y + 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let i = 0; i < state.snow.length; i += 1) {
    const flake = state.snow[i];
    ctx.beginPath();
    ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCrosshair() {
  if (!state.active) return;
  ctx.save();
  ctx.translate(mouse.x, mouse.y);
  ctx.strokeStyle = 'rgba(16, 24, 34, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(-2, 0);
  ctx.moveTo(2, 0);
  ctx.lineTo(8, 0);
  ctx.moveTo(0, -8);
  ctx.lineTo(0, -2);
  ctx.moveTo(0, 2);
  ctx.lineTo(0, 8);
  ctx.stroke();
  ctx.restore();
}

function render() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate(randRange(-state.shake, state.shake), randRange(-state.shake, state.shake));
    state.shake = Math.max(0, state.shake - 0.6);
  }

  drawLandscape();
  drawBloodStains();
  drawEnemy();
  drawPlayer();
  drawBullets();
  drawParticles();
  drawSnowAndWind();
  drawCrosshair();
  ctx.restore();
}

function loop(now) {
  const delta = Math.min(0.033, (now - state.lastTime) / 1000 || 0);
  state.lastTime = now;

  updateSnow(delta);

  if (state.active) {
    updateSurvival(now);
    updatePlayer(delta);
    updateBullets(delta);
    updateEnemy(delta);
    checkCollisions();
    checkPlayerCaught();
    updateParticles(delta);

    if (!enemy) {
      state.respawnTimer -= delta;
      if (state.respawnTimer <= 0) {
        spawnEnemy();
      }
    }
  }

  render();
  requestAnimationFrame(loop);
}

function handleKey(event, isDown) {
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
    event.preventDefault();
    if (isDown) {
      keys.add(key);
    } else {
      keys.delete(key);
    }
  }
}

function updateMousePosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouse.x = (event.clientX - rect.left) * scaleX;
  mouse.y = (event.clientY - rect.top) * scaleY;
}

window.addEventListener('keydown', (event) => handleKey(event, true));
window.addEventListener('keyup', (event) => handleKey(event, false));

canvas.addEventListener('mousemove', updateMousePosition);
canvas.addEventListener('mousedown', (event) => {
  updateMousePosition(event);
  mouse.down = true;
});
canvas.addEventListener('mouseup', () => {
  mouse.down = false;
});
canvas.addEventListener('mouseleave', () => {
  mouse.down = false;
});

ui.start.addEventListener('click', startGame);
ui.startOverlay.addEventListener('click', startGame);

initEnvironment();
requestAnimationFrame(loop);
