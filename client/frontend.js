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
let seqNumber = 0;

const INTERPOLATION_DELAY = 100; // 100ms interpolation delay
let lastServerUpdate = Date.now();
let previousPositions = {};

function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CENTER);
}

function draw() {
  background(200);
  const now = Date.now();
  const serverTimeDelta = now - lastServerUpdate;

  for (const id in frontEndPlayers) {
    const frontEndPlayer = frontEndPlayers[id];

    // Don't interpolate current player
    if (id === currentPlayerId) {
      frontEndPlayer.draw();
      updateRotationAngle(id, frontEndPlayer);
      continue;
    }

    // Interpolate other players
    if (frontEndPlayer.targetX !== undefined) {
      const alpha = Math.min(serverTimeDelta / INTERPOLATION_DELAY, 1);

      frontEndPlayer.x = lerp(
        previousPositions[id].x,
        frontEndPlayer.targetX,
        alpha,
      );
      frontEndPlayer.y = lerp(
        previousPositions[id].y,
        frontEndPlayer.targetY,
        alpha,
      );
      frontEndPlayer.dangle = lerp(
        previousPositions[id].dangle,
        frontEndPlayer.targetAngle,
        alpha,
      );
    }

    frontEndPlayer.draw();
  }

  // Draw projectiles
  for (const id in frontEndProjectiles) {
    const frontEndProjectile = frontEndProjectiles[id];
    frontEndProjectile.update();
  }
}

// Helper function for linear interpolation
function lerp(start, end, t) {
  return start * (1 - t) + end * t;
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
        currentPlayerId = data.id;
        document
          .querySelector("#usernameForm")
          .addEventListener("submit", (event) => {
            event.preventDefault();
            const username = document.querySelector("#usernameInput").value;
            document.querySelector("#usernameForm").style.display = "none";
            ws.send(
              JSON.stringify({
                type: "initGame",
                username: username,
                devicePixelRatio,
              }),
            );
          });
        console.log("Server says this:", data.message);
        break;

      case "updatePosition":
        const { id, backEndPlayer } = data;
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
        const backEndProjectiles = data.backEndProjectiles || {};
        // Update or create projectiles
        for (const id in backEndProjectiles) {
          const backEndProjectile = backEndProjectiles[id];
          if (!frontEndProjectiles[id]) {
            frontEndProjectiles[id] = new Projectile({
              x: backEndProjectile.x,
              y: backEndProjectile.y,
              angle: Math.atan2(
                backEndProjectile.velocity.y,
                backEndProjectile.velocity.x,
              ),
              velocity: backEndProjectile.velocity,
            });
          } else {
            // Update position directly from server
            frontEndProjectiles[id].x = backEndProjectile.x;
            frontEndProjectiles[id].y = backEndProjectile.y;
          }
        }
        // Remove missing projectiles
        for (const id in frontEndProjectiles) {
          if (!backEndProjectiles[id]) {
            delete frontEndProjectiles[id];
          }
        }
        break;

      case "updatePlayers":
        const backEndPlayers = data.backEndPlayers || {};
        lastServerUpdate = data.timestamp;

        // Update or add players
        for (const id in backEndPlayers) {
          const backEndPlayer = backEndPlayers[id];
          const frontEndPlayer = frontEndPlayers[id];

          if (frontEndPlayer) {
            previousPositions[id] = {
              x: frontEndPlayer.x,
              y: frontEndPlayer.y,
              dangle: frontEndPlayer.dangle,
            };

            //update score
            document.querySelector(`div[data-id="${id}"]`).innerHTML =
              `${backEndPlayer.username}: ${backEndPlayer.score}`;
            document
              .querySelector(`div[data-id="${id}"]`)
              .setAttribute("data-score", backEndPlayer.score);

            // Only do immediate position update for the current player
            if (id === currentPlayerId) {
              frontEndPlayer.x = backEndPlayer.x;
              frontEndPlayer.y = backEndPlayer.y;
              frontEndPlayer.dangle = backEndPlayer.dangle;
            } else {
              // For other players, store target position for interpolation
              frontEndPlayer.targetX = backEndPlayer.x;
              frontEndPlayer.targetY = backEndPlayer.y;
              frontEndPlayer.targetAngle = backEndPlayer.dangle;
            }
          } else {
            // Add new players
            frontEndPlayers[id] = new Player({
              x: backEndPlayer.x,
              y: backEndPlayer.y,
              username: backEndPlayer.username,
              dangle: backEndPlayer.dangle,
              size: 20,
            });

            document.querySelector("#playerLabels").innerHTML +=
              `<div data-id="${id}" data-score="${backEndPlayer.score}">${backEndPlayer.username}: ${backEndPlayer.score}</div>`;
          }
        }
        //loop and delete the front end players to update the site
        for (const id in frontEndPlayers) {
          if (!backEndPlayers[id]) {
            const divToDelete = document.querySelector(`div[data-id="${id}"]`);
            divToDelete.parentNode.removeChild(divToDelete);
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
