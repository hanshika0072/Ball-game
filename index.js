(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { alpha: true });

  // HUD elements
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const howBtn = document.getElementById('howBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');

  // DPR-friendly sizing
  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function initCanvasSize() {
    const wrap = canvas.parentElement;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    fitCanvas();
  }
  window.addEventListener('resize', initCanvasSize);
  initCanvasSize();

  // Game state
  let game = { running: false, paused: false, score: 0, lives: 3, level: 1 };

  // Paddle
  const paddle = {
    wRatio: 0.18,
    width: 180,
    height: 14,
    x: 0,
    y: 0,
    speed: 10,
    dragging: false
  };

  // Ball
  const ball = { r: 10, x: 0, y: 0, vx: 0, vy: 0, speed: 6, stuck: true };

  // Bricks + particles
  let bricks = [];
  let particles = [];

  const rand = (a, b) => Math.random() * (b - a) + a;

  // Build bricks
  function buildBricks(level) {
    bricks = [];
    const cols = Math.min(10, 5 + level);
    const rows = Math.min(6, 3 + Math.floor(level / 2));
    const padding = 8;
    const totalPadX = (cols + 1) * padding;
    const totalPadY = (rows + 1) * padding;
    const containerW = canvas.clientWidth || canvas.width;
    const containerH = canvas.clientHeight || canvas.height;
    const brickW = Math.max(36, (containerW - totalPadX) / cols);
    const brickH = Math.max(18, Math.min(28, (containerH * 0.35 - totalPadY) / rows));

    const offsetTop = 60;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = padding + c * (brickW + padding);
        const y = offsetTop + padding + r * (brickH + padding);
        const hue = 200 - r * 12 - level * 4;
        const color = `hsl(${hue}deg ${60 - r * 6}% ${60 - r * 6}%)`;
        const hp = 1 + Math.floor(level / 3) * ((r + c) % 2);
        bricks.push({ x, y, w: brickW, h: brickH, color, hp });
      }
    }
  }

  // Reset ball/paddle
  function resetBallAndPaddle(sticky = true) {
    const cw = canvas.clientWidth || canvas.width;
    const ch = canvas.clientHeight || canvas.height;
    paddle.width = cw * paddle.wRatio;
    paddle.x = (cw - paddle.width) / 2;
    paddle.y = ch - 60;
    paddle.height = Math.max(12, Math.min(20, paddle.height));
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - ball.r - 6;
    ball.vx = 0;
    ball.vy = 0;
    ball.stuck = sticky;
    ball.speed = 6 + (game.level - 1) * 0.6;
  }

  // Launch ball
  function launchBall() {
    if (!ball.stuck) return;
    ball.stuck = false;
    const angle = rand(-Math.PI * 0.45, -Math.PI * 0.55);
    ball.vx = ball.speed * Math.cos(angle);
    ball.vy = ball.speed * Math.sin(angle);
  }

  // Physics
  function updatePhysics(dt) {
    if (game.paused || !game.running) return;
    const cw = canvas.clientWidth || canvas.width;
    const ch = canvas.clientHeight || canvas.height;

    if (!ball.stuck) {
      ball.x += ball.vx;
      ball.y += ball.vy;
    } else {
      ball.x = paddle.x + paddle.width / 2;
      ball.y = paddle.y - ball.r - 6;
    }

    // Walls
    if (ball.x - ball.r <= 0 || ball.x + ball.r >= cw) {
      ball.vx *= -1;
    }
    if (ball.y - ball.r <= 0) ball.vy *= -1;

    // Miss
    if (ball.y - ball.r > ch) {
      game.lives--;
      updateHUD();
      if (game.lives <= 0) {
        game.running = false;
        showOverlay("Game Over", `Score: ${game.score}`, "Restart", () => startNewGame());
      } else resetBallAndPaddle(true);
      return;
    }

    // Paddle collision
    if (circleRectCollide(ball, paddle)) {
      const hitPos = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
      const bounceAngle = hitPos * (Math.PI / 2.2) - Math.PI / 2;
      const speed = Math.hypot(ball.vx, ball.vy);
      ball.vx = speed * Math.cos(bounceAngle);
      ball.vy = speed * Math.sin(bounceAngle);
      if (ball.vy > 0) ball.vy *= -1;
    }

    // Bricks
    for (let i = bricks.length - 1; i >= 0; i--) {
      const b = bricks[i];
      if (circleRectCollide(ball, b)) {
        ball.vy *= -1;
        b.hp--;
        if (b.hp <= 0) {
          bricks.splice(i, 1);
          game.score += 10;
        } else game.score += 5;
        updateHUD();
      }
    }

    if (bricks.length === 0 && game.running) {
      game.level++;
      updateHUD();
      setTimeout(() => {
        buildBricks(game.level);
        resetBallAndPaddle(true);
      }, 600);
    }
  }

  // Collision check
  function circleRectCollide(circle, rect) {
    const cx = circle.x, cy = circle.y;
    const rx = rect.x, ry = rect.y;
    const rw = rect.w || rect.width, rh = rect.h || rect.height;
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy <= circle.r * circle.r;
  }

  // Render
  function render() {
    const cw = canvas.clientWidth || canvas.width;
    const ch = canvas.clientHeight || canvas.height;
    ctx.fillStyle = "#020814";
    ctx.fillRect(0, 0, cw, ch);

    bricks.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    });

    ctx.fillStyle = "#60a5fa";
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // HUD
  function updateHUD() {
    scoreEl.textContent = `Score: ${game.score}`;
    livesEl.textContent = `Lives: ${game.lives}`;
    levelEl.textContent = `Level: ${game.level}`;
  }

  // Launch handler
  function handleLaunch() {
    if (!game.running) {
      overlay.style.display = 'none';
      startGame();
      return;
    }
    if (ball.stuck) launchBall();
  }

  // Input (keyboard)
  const keys = { left: false, right: false };
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === ' ' || e.key === 'Spacebar') launchBall();
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
  });

  // Mouse
  let lastPointerX = 0;
  canvas.addEventListener('mousedown', e => {
    lastPointerX = e.clientX - canvas.getBoundingClientRect().left;
    paddle.dragging = true;
  });
  window.addEventListener('mousemove', e => {
    if (!paddle.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dx = x - lastPointerX;
    lastPointerX = x;
    paddle.x += dx;
  });
  window.addEventListener('mouseup', () => paddle.dragging = false);

  // Touch (tap vs drag)
  let touchStartX = 0, touchMoved = false;
  canvas.addEventListener('touchstart', e => {
    touchMoved = false;
    touchStartX = e.touches[0].clientX;
    lastPointerX = touchStartX - canvas.getBoundingClientRect().left;
    paddle.dragging = true;
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    const dx = Math.abs(e.touches[0].clientX - touchStartX);
    if (dx > 10) touchMoved = true;
    if (!paddle.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const moveDx = x - lastPointerX;
    lastPointerX = x;
    paddle.x += moveDx;
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    paddle.dragging = false;
    if (!touchMoved) handleLaunch(); // treat as tap
  }, { passive: false });

  // Overlay buttons
  startBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
    startGame();
  });
  howBtn.addEventListener('click', () => {
    showOverlay("How to Play",
      "Drag the paddle with your finger or mouse, or use ← → keys. Tap (or press space) to launch the ball.");
  });
  pauseBtn.addEventListener('click', () => {
    if (!game.running) return;
    game.paused = !game.paused;
    pauseBtn.textContent = game.paused ? 'Resume' : 'Pause';
  });
  restartBtn.addEventListener('click', startNewGame);

  function showOverlay(title, subtitle, btnText = 'Continue', btnAction = null) {
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="title">${title}</div>
      <div class="sub">${subtitle}</div>
      <div style="display:flex;gap:10px">
        <button id="overlayOk">${btnText}</button>
        <button id="overlayCancel" class="secondary">Close</button>
      </div>
    `;
    document.getElementById('overlayOk').addEventListener('click', () => {
      overlay.style.display = 'none';
      if (btnAction) btnAction();
    });
    document.getElementById('overlayCancel').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
  }

  // Game control
  function startGame() {
    game.running = true;
    game.paused = false;
    updateHUD();
    buildBricks(game.level);
    resetBallAndPaddle(true);
  }
  function startNewGame() {
    game.score = 0;
    game.lives = 3;
    game.level = 1;
    updateHUD();
    buildBricks(game.level);
    resetBallAndPaddle(true);
    overlay.style.display = 'none';
    game.running = true;
    game.paused = false;
  }

  // Loop
  let lastTime = 0;
  function loop(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min(32, ts - lastTime);
    lastTime = ts;

    if (keys.left) paddle.x -= paddle.speed;
    if (keys.right) paddle.x += paddle.speed;

    updatePhysics(dt);
    render();
    requestAnimationFrame(loop);
  }

  // Init
  function adjustAndStart() {
    initCanvasSize();
    buildBricks(game.level);
    resetBallAndPaddle(true);
    requestAnimationFrame(loop);
  }
  adjustAndStart();

  Object.defineProperty(canvas, 'clientWidth', {
    get() { return parseFloat(getComputedStyle(canvas).width); }
  });
  Object.defineProperty(canvas, 'clientHeight', {
    get() { return parseFloat(getComputedStyle(canvas).height); }
  });
})();
