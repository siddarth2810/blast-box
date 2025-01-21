const url = "ws://localhost:8000";
const ws = new WebSocket(url);

const scoreEl = document.querySelector("#scoreEl");
const devicePixelRatio = window.devicePixelRatio || 1;

gameWidth = innerWidth * devicePixelRatio;
gameHeight = innerHeight * devicePixelRatio;

const x = gameWidth / 2;
const y = gameHeight / 2;

const frontEndPlayers = {};
const frontEndProjectiles = {};
let angle;

let currentPlayerId = null;
let pendingInputs = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CENTER);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(200); //light gray
  for (const id in frontEndPlayers) {
    const frontEndPlayer = frontEndPlayers[id];
    frontEndPlayer.draw();
    updateRotationAngle(id, frontEndPlayer);
  }

  for (const id in frontEndProjectiles) {
    const frontEndProjectile = frontEndProjectiles[id];
    frontEndProjectile.update();
  }
}

function updateRotationAngle(id, player) {
  if (id === currentPlayerId) {
    angle = atan2(mouseY - player.y, mouseX - player.x);
    player.dangle = angle;
    ws.send(
      JSON.stringify({
        type: "angle",
        dangle: angle,
      }),
    );
  }
}

window.addEventListener("keydown", (event) => {
  if (!currentPlayerId || !frontEndPlayers[currentPlayerId]) return;

  const speed = 15;
  let seqNumber = 0;
  let dx = 0,
    dy = 0;
  if (event.code === "KeyW" || event.code === "ArrowUp") dy = -speed;
  if (event.code === "KeyS" || event.code === "ArrowDown") dy = speed;
  if (event.code === "KeyA" || event.code === "ArrowLeft") dx = -speed;
  if (event.code === "KeyD" || event.code === "ArrowRight") dx = speed;

  if (dx !== 0 || dy !== 0) {
    seqNumber++;
    pendingInputs.push({ seqNumber, dx, dy });

    // Client-Side Prediction
    const player = frontEndPlayers[currentPlayerId];
    player.x += dx;
    player.y += dy;

    ws.send(
      JSON.stringify({
        type: "position",
        seqNumber: seqNumber,
        dx: dx,
        dy: dy,
      }),
    );
  }
});

ws.addEventListener("message", (event) => {
  try {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case "welcome":
        console.log("Server says this:", data.message);
        // console.log(frontEndPlayers); //gives empty object
        currentPlayerId = data.id;
        ws.send(
          JSON.stringify({
            type: "initCanvas",
            windowWidth,
            windowHeight,
            devicePixelRatio,
          }),
        );
        break;

      case "updatePosition":
        const { id, x, y, backEndPlayer } = data;
        if (id === currentPlayerId) {
          // Update the authoritative position
          frontEndPlayers[id].x = backEndPlayer.x;
          frontEndPlayers[id].y = backEndPlayer.y;

          //removes any inputs whose seqNumber is <= the server-acknowledged seqNumber
          pendingInputs = pendingInputs.filter(
            (input) => input.seqNumber > backEndPlayer.seqNumber,
          );

          //loop over unacknowledged inputs and update
          for (const input of pendingInputs) {
            frontEndPlayers[id].y += input.dy;
            frontEndPlayers[id].x += input.dx;
          }
        }
        break;

      case "updateProjectiles":
        console.log(data);
        const backEndProjectiles = data.backEndProjectiles || {};
        for (const id in backEndProjectiles) {
          const backEndProjectile = backEndProjectiles[id];

          if (!frontEndProjectiles[id]) {
            frontEndProjectiles[id] = new Projectile({
              x: backEndProjectile.x,
              y: backEndProjectile.y,
              angle: angle,
              velocity: backEndProjectile.velocity,
            });
          } else {
            frontEndProjectiles[id].x += backEndProjectiles[id].velocity.x;
            frontEndProjectiles[id].y += backEndProjectiles[id].velocity.y;
          }
        }

        // Then, remove projectiles that no longer exist on the backend
        for (const id in frontEndProjectiles) {
          if (!backEndProjectiles[id]) {
            delete frontEndProjectiles[id];
          }
        }
        break;

      case "updatePlayers":
        const backEndPlayers = data.backEndPlayers || {};
        // Update or add players
        for (const id in backEndPlayers) {
          const backEndPlayer = backEndPlayers[id];
          const frontEndPlayer = frontEndPlayers[id];
          if (frontEndPlayer) {
            gsap.to(frontEndPlayer, {
              x: backEndPlayer.x,
              y: backEndPlayer.y,
              duration: 0.015,
              ease: "linear",
              dangle: backEndPlayer.dangle,
            });
          } else {
            // Add new players
            frontEndPlayers[id] = new Player({
              x: backEndPlayer.x,
              y: backEndPlayer.y,
              dangle: backEndPlayer.dangle,
              size: 20,
            });
          }
        }
        //loop and delete the front end players to update the site
        for (const id in frontEndPlayers) {
          if (!backEndPlayers[id]) {
            delete frontEndPlayers[id];
          }
        }
        //console.log(frontEndPlayers);
        break;

      default:
        console.log("Unknown message type:", data);
    }
  } catch (error) {
    console.error("Error processing message:", error);
  }
});

ws.addEventListener("close", (event) => {
  console.log("Connection closed:", event.code, event.reason);
});
