
    const game = document.getElementById("game");
    const basket = document.getElementById("basket");
    const scoreBoard = document.getElementById("scoreBoard");
    const leftBtn = document.getElementById("leftBtn");
    const rightBtn = document.getElementById("rightBtn");
    let score = 0;

    // Basket move function
    function moveBasket(dir) {
      let left = parseInt(window.getComputedStyle(basket).getPropertyValue("left"));
      if (dir === "left" && left > 0) {
        basket.style.left = left - 20 + "px";
      } else if (dir === "right" && left < 320) {
        basket.style.left = left + 20 + "px";
      }
    }

    // Keyboard (Laptop)
    document.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft") moveBasket("left");
      if (e.key === "ArrowRight") moveBasket("right");
    });

    // Buttons (Phone)
    leftBtn.addEventListener("touchstart", () => moveBasket("left"));
    rightBtn.addEventListener("touchstart", () => moveBasket("right"));
    // leftBtn.style.display = "inline-block";
    // rightBtn.style.display = "inline-block";

    // Drop balls
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
          ball.remove();
        }
      }, 20);
    }

    setInterval(createBall, 1500);

