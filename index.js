
    const game = document.getElementById("game");
    const basket = document.getElementById("basket");
    const scoreBoard = document.getElementById("scoreBoard");
    let score = 0;

    // Move basket
    document.addEventListener("keydown", e => {
      let left = parseInt(window.getComputedStyle(basket).getPropertyValue("left"));
      if (e.key === "ArrowLeft" && left > 0) {
        basket.style.left = left - 20 + "px";
      } else if (e.key === "ArrowRight" && left < 320) {
        basket.style.left = left + 20 + "px";
      }
    });

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

        // Check collision
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