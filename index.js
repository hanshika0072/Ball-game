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

  // initial canvas fill to keep aspect when resizing container
  function initCanvasSize() {
    const wrap = canvas.parentElement;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    fitCanvas();
  }
  window.addEventListener('resize', () => {
    initCanvasSize();
  });

  initCanvasSize();

  // Game state
  let game = {
    running: false,
    paused: false,
    score: 0,
    lives: 3,
    level: 1
  };

  // Paddle
  const paddle = {
    wRatio: 0.18, // as fraction of width
    width: 180,
    height: 14,
    x: 0,
    y: 0,
    speed: 10,
    dragging: false
  };

  // Ball
  const ball = {
    r: 10,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 6,
    stuck: true // stuck on paddle until launch
  };

  // Bricks
  let bricks = [];

  // Particles for explosion effects
  let particles = [];

  // Utility: random
  const rand = (a,b) => Math.random()*(b-a)+a;

  // Build bricks configuration for given level
  function buildBricks(level) {
    bricks = [];
    const cols = Math.min(10, 5 + level); // increase with level
    const rows = Math.min(6, 3 + Math.floor(level/2));
    const padding = 8;
    const totalPadX = (cols + 1) * padding;
    const totalPadY = (rows + 1) * padding;
    const containerW = canvas.clientWidth || canvas.width;
    const containerH = canvas.clientHeight || canvas.height;
    const brickW = Math.max(36, (containerW - totalPadX) / cols);
    const brickH = Math.max(18, Math.min(28, (containerH * 0.35 - totalPadY) / rows));

    const offsetTop = 60;
    for (let r=0; r<rows; r++){
      for (let c=0; c<cols; c++){
        const x = padding + c*(brickW + padding);
        const y = offsetTop + padding + r*(brickH + padding);
        // color gradient per row
        const hue = 200 - r*12 - level*4;
        const color = `hsl(${hue}deg ${60 - r*6}% ${60 - r*6}%)`;
        const hp = 1 + Math.floor(level/3) * ((r+c)%2); // some bricks stronger in later levels
        bricks.push({x, y, w: brickW, h: brickH, color, hp});
      }
    }
  }

  // Reset game or next life
  function resetBallAndPaddle(sticky=true) {
    const cw = canvas.clientWidth || canvas.width;
    const ch = canvas.clientHeight || canvas.height;
    paddle.width = cw * paddle.wRatio;
    paddle.x = (cw - paddle.width) / 2;
    paddle.y = ch - 60;
    paddle.height = Math.max(12, Math.min(20, paddle.height));
    ball.r = Math.max(8, Math.min(14, ball.r));
    ball.x = paddle.x + paddle.width/2;
    ball.y = paddle.y - ball.r - 6;
    ball.vx = 0;
    ball.vy = 0;
    ball.stuck = sticky;
    ball.speed = 6 + (game.level-1)*0.6;
  }

  // Launch ball from paddle
  function launchBall() {
    if (!ball.stuck) return;
    ball.stuck = false;
    const angle = rand(-Math.PI*0.45, -Math.PI*0.55); // upwards
    ball.vx = ball.speed * Math.cos(angle);
    ball.vy = ball.speed * Math.sin(angle);
  }

  // Handle collisions and physics
  function updatePhysics(dt) {
    if (game.paused || !game.running) return;

    const cw = canvas.clientWidth || canvas.width;
    const ch = canvas.clientHeight || canvas.height;

    // Move ball
    if (!ball.stuck) {
      ball.x += ball.vx;
      ball.y += ball.vy;
    } else {
      // follow paddle
      ball.x = paddle.x + paddle.width/2;
      ball.y = paddle.y - ball.r - 6;
    }

    // Wall collisions
    if (ball.x - ball.r <= 0) {
      ball.x = ball.r;
      ball.vx *= -1;
      spawnParticles(ball.x, ball.y, 6);
    } else if (ball.x + ball.r >= cw) {
      ball.x = cw - ball.r;
      ball.vx *= -1;
      spawnParticles(ball.x, ball.y, 6);
    }
    if (ball.y - ball.r <= 0) {
      ball.y = ball.r;
      ball.vy *= -1;
      spawnParticles(ball.x, ball.y, 8);
    }

    // Bottom (miss)
    if (ball.y - ball.r > ch) {
      game.lives--;
      updateHUD();
      if (game.lives <= 0) {
        // game over
        game.running = false;
        showOverlay("Game Over", `Score: ${game.score}`, "Restart", () => startNewGame());
      } else {
        resetBallAndPaddle(true);
      }
      return;
    }

    // Paddle collision (AABB vs circle)
    if (circleRectCollide(ball, paddle)) {
      // reflect based on where it hit the paddle
      const hitPos = (ball.x - (paddle.x + paddle.width/2)) / (paddle.width/2); // -1 .. 1
      const bounceAngle = hitPos * (Math.PI/2.2) - Math.PI/2;
      const speed = Math.hypot(ball.vx, ball.vy);
      ball.vx = speed * Math.cos(bounceAngle);
      ball.vy = speed * Math.sin(bounceAngle);
      // nudge upward
      if (ball.vy > 0) ball.vy *= -1;
      spawnParticles(ball.x, ball.y, 12, true);
    }

    // Brick collisions
    for (let i = bricks.length - 1; i >= 0; i--) {
      const b = bricks[i];
      if (circleRectCollide(ball, b)) {
        // determine collision side roughly by previous position
        // simple approach: reverse vy if hit from top/bottom, else reverse vx
        const prevX = ball.x - ball.vx;
        const prevY = ball.y - ball.vy;
        let collidedHoriz = prevX < b.x || prevX > b.x + b.w;
        if (prevY < b.y || prevY > b.y + b.h) {
          // probably vertical hit
          ball.vy *= -1;
        } else {
          ball.vx *= -1;
        }
        b.hp = (b.hp || 1) - 1;
        spawnParticles(ball.x, ball.y, 12, false, b.color);
        if (b.hp <= 0) {
          bricks.splice(i, 1);
          game.score += 10;
        } else {
          game.score += 5;
        }
        updateHUD();
      }
    }

    // Level cleared?
    if (bricks.length === 0 && game.running) {
      game.level++;
      updateHUD();
      // small delay then next level
      setTimeout(() => {
        buildBricks(game.level);
        resetBallAndPaddle(true);
      }, 600);
    }

    // Update particles
    for (let i = particles.length-1; i>=0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // gravity
      p.life -= 1;
      p.alpha *= 0.98;
      if (p.life <= 0 || p.alpha < 0.03) particles.splice(i,1);
    }
  }

  // Simple circle vs rect collision checker
  function circleRectCollide(circle, rect) {
    const cx = circle.x;
    const cy = circle.y;
    const rx = rect.x;
    const ry = rect.y;
    const rw = rect.w || rect.width || rect.w || rect.w;
    const rh = rect.h || rect.height || rect.h || rect.h;
    // Find nearest point
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx;
    const dy = cy - ny;
    return (dx*dx + dy*dy) <= (circle.r * circle.r);
  }

  // Particles
  function spawnParticles(x,y,count, pale=false, color=null){
    for (let i=0;i<count;i++){
      const angle = Math.random()*Math.PI*2;
      const speed = Math.random()*3 + (pale?1:2);
      particles.push({
        x, y,
        vx: Math.cos(angle)*speed,
        vy: Math.sin(angle)*speed - 1,
        life: 20 + Math.floor(Math.random()*20),
        alpha: 0.9,
        size: Math.random()*3 + 1,
        color: color || (pale ? 'rgba(160,220,255,0.9)' : `hsl(${rand(180,220)}deg 80% 60%)`)
      });
    }
  }

  // Draw everything
  function render() {
    const cw = canvas.clientWidth || canvas.width;
    const ch = canvas.clientHeight || canvas.height;
    // clear w/ gradient
    const g = ctx.createLinearGradient(0,0,0,ch);
    g.addColorStop(0, 'rgba(12,20,34,0.7)');
    g.addColorStop(1, 'rgba(2,8,18,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,cw,ch);

    // subtle glow / background circles
    const grd = ctx.createRadialGradient(cw*0.85, ch*0.15, 10, cw*0.85, ch*0.15, Math.max(cw,ch));
    grd.addColorStop(0, 'rgba(96,165,250,0.06)');
    grd.addColorStop(1, 'rgba(96,165,250,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,cw,ch);

    // draw bricks
    bricks.forEach(b => {
      // nice rounded rect with shadow
      roundRect(ctx, b.x, b.y, b.w, b.h, 6, b.color);
      // inner highlight
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(b.x + 6, b.y + 4, Math.max(0, b.w - 12), Math.max(0, b.h/2 - 4));
    });

    // draw paddle
    // gradient
    const pg = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.width, paddle.y);
    pg.addColorStop(0, 'rgba(125,211,252,0.18)');
    pg.addColorStop(1, 'rgba(96,165,250,0.12)');
    ctx.fillStyle = pg;
    roundRect(ctx, paddle.x, paddle.y, paddle.width, paddle.height, 10, pg);
    // paddle glow
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    roundRectStroke(ctx, paddle.x, paddle.y, paddle.width, paddle.height, 10);

    // ball (glossy)
    const bg = ctx.createRadialGradient(ball.x - 4, ball.y - 6, 2, ball.x, ball.y, ball.r*1.8);
    bg.addColorStop(0, 'rgba(255,255,255,0.95)');
    bg.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    bg.addColorStop(1, 'rgba(96,165,250,0.12)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
    ctx.fill();
    // subtle ring
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r+1, 0, Math.PI*2);
    ctx.stroke();

    // particles
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // small HUD in-canvas
    ctx.font = '12px Inter, system-ui, Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillText('Ball Breaker', 14, ch - 14);
  }

  // Rounded rect helpers
  function roundRect(ctx, x, y, w, h, r, fillStyle) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  function roundRectStroke(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.stroke();
  }

  // Input handlers
  let lastPointerX = 0;
  function pointerDown(e) {
    e.preventDefault();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - canvas.getBoundingClientRect().left;
    lastPointerX = x;
    paddle.dragging = true;
  }
  function pointerMove(e) {
    if (!paddle.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const dx = x - lastPointerX;
    lastPointerX = x;
    paddle.x += dx;
    clampPaddle();
    if (ball.stuck) {
      ball.x = paddle.x + paddle.width/2;
    }
  }
  function pointerUp(e) {
    paddle.dragging = false;
  }

  function clampPaddle() {
    const cw = canvas.clientWidth || canvas.width;
    if (paddle.x < 6) paddle.x = 6;
    if (paddle.x + paddle.width > cw - 6) paddle.x = cw - 6 - paddle.width;
  }

  // Keyboard
  const keys = { left:false, right:false };
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === ' ' || e.key === 'Spacebar') { // launch
      launchBall();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
  });

  // Buttons
  startBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
    startGame();
  });
  howBtn.addEventListener('click', () => {
    showOverlay("How to Play",
      "Drag the paddle with your finger or mouse, or use ← → keys. Tap (or press space) to launch the ball. Break all bricks to advance.");
  });
  pauseBtn.addEventListener('click', () => {
    if (!game.running) return;
    game.paused = !game.paused;
    pauseBtn.textContent = game.paused ? 'Resume' : 'Pause';
  });
  restartBtn.addEventListener('click', () => {
    startNewGame();
  });

  // Show overlay with optional button action
  function showOverlay(title, subtitle, btnText='Continue', btnAction=null) {
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

  // Main loop
  let lastTime = 0;
  function loop(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min(32, ts - lastTime);
    lastTime = ts;

    // Keyboard paddle movement
    if (keys.left) {
      paddle.x -= paddle.speed;
      clampPaddle();
      if (ball.stuck) ball.x = paddle.x + paddle.width/2;
    }
    if (keys.right) {
      paddle.x += paddle.speed;
      clampPaddle();
      if (ball.stuck) ball.x = paddle.x + paddle.width/2;
    }

    updatePhysics(dt);
    render();

    requestAnimationFrame(loop);
  }

  // Start game & levels
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

  function updateHUD() {
    scoreEl.textContent = `Score: ${game.score}`;
    livesEl.textContent = `Lives: ${game.lives}`;
    levelEl.textContent = `Level: ${game.level}`;
  }

  // Touch/mouse listeners on canvas
  canvas.addEventListener('touchstart', pointerDown, {passive:false});
  canvas.addEventListener('touchmove', pointerMove, {passive:false});
  canvas.addEventListener('touchend', pointerUp, {passive:false});
  canvas.addEventListener('mousedown', pointerDown);
  window.addEventListener('mousemove', pointerMove);
  window.addEventListener('mouseup', pointerUp);

  // Tapping canvas also launches ball if stuck
  canvas.addEventListener('click', (e) => {
    if (!game.running) {
      overlay.style.display = 'none';
      startGame();
      return;
    }
    if (ball.stuck) launchBall();
  });

  // Keep canvas sizing right on start
  function adjustAndStart() {
    initCanvasSize();
    buildBricks(game.level);
    resetBallAndPaddle(true);
    requestAnimationFrame(loop);
  }

  // Kick off
  adjustAndStart();

  // helper: ensure canvas clientWidth/clientHeight available cross-browser
  Object.defineProperty(canvas, 'clientWidth', {
    get() { return parseFloat(getComputedStyle(canvas).width); }
  });
  Object.defineProperty(canvas, 'clientHeight', {
    get() { return parseFloat(getComputedStyle(canvas).height); }
  });

})();