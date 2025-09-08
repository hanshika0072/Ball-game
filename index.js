const game = document.getElementById("game");
const basket = document.getElementById("basket");
const storage = document.getElementById("storage");
const scoreBoard = document.getElementById("scoreBoard");
let score = 0;

// 🎯 Drag basket (mouse + touch)
let isDragging = false;

game.addEventListener("mousedown", () => (isDragging = true));
game.addEventListener("mouseup", () => (isDragging = false));
game.addEventListener("mousemove", (e) => {
  if (isDragging) moveBasketTo(e.clientX);
});

game.addEventListener("touchstart", () => (isDragging = true));
game.addEventListener("touchend", () => (isDragging = false));
game.addEventListener("touchmove", (e) => {
  if (isDragging) {
    const touch = e.touches[0];
    moveBasketTo(touch.clientX);
  }
});

function moveBasketTo(x) {
  const gameRect = game.getBoundingClientRect();
  let newLeft = x - gameRect.left - basket.offsetWidth / 2;
  newLeft = Math.max(0, Math.min(newLeft, gameRect.width - basket.offsetWidth));
  basket.style.left = newLeft + "px";
}

// 🎯 Create falling balls
function createBall() {
  const ball = document.createElement("div");
  ball.classList.add("ball");
  ball.style.left = Math.floor(Math.random() * 380) + "px";
  game.appendChild(ball);

  let fall = setInterval(() => {
    let ballTop = parseInt(window.getComputedStyle(ball).getPropertyValue("top"));
    if (ballTop > 580) {
      clearInterval(fall);
      ball.remove();
    } else {
      ball.style.top = ballTop + 5 + "px";
    }

    // Collision check
    let basketRect = basket.getBoundingClientRect();
    let ballRect = ball.getBoundingClientRect();
    if (
      ballRect.bottom >= basketRect.top &&
      ballRect.left >= basketRect.left &&
      ballRect.right <= basketRect.right
    ) {
      score++;
      scoreBoard.innerText = "Score: " + score;

      clearInterval(fall);

      // ✅ Move ball inside dustbin (storage)
      const ballX = ballRect.left - basketRect.left;
      const ballY = storage.offsetHeight - 20 - Math.random() * 10;

      ball.style.position = "absolute";
      ball.style.top = ballY + "px";
      ball.style.left = ballX + "px";

      storage.appendChild(ball); // 👈 ball basket ke andar aa jayegi
    }
  }, 20);
}

setInterval(createBall, 1500);
