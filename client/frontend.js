//frontend.js
const url = "ws://localhost:8080";
const ws = new WebSocket(url);

const scoreEl = document.querySelector("#scoreEl");
const devicePixelRatio = window.devicePixelRatio || 1;

gameWidth = 1024 * devicePixelRatio;
gameHeight = 576 * devicePixelRatio;

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

let lastShotTime = 0;
const PROJECTILE_COOLDOWN = 400; // in milliseconds

let landscape;
function preload() {
  landscape = loadImage("assets/bg2.png");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CENTER);
  pixelDensity(1);

  // Create an off-screen graphics buffer
  bgPattern = createGraphics(width, height);
  // Tile the image onto the buffer once
  for (let x = 0; x < width; x += landscape.width) {
    for (let y = 0; y < height; y += landscape.height) {
      bgPattern.image(landscape, x, y);
    }
  }
}

function draw() {
  image(bgPattern, 0, 0);
  const now = Date.now();
  const serverTimeDelta = now - lastServerUpdate;

  for (const id in frontEndPlayers) {
    const frontEndPlayer = frontEndPlayers[id];

    if (id === currentPlayerId) {
      // smoothing factor to gradually correct the position.
      const smoothingFactor = 0.1;
      frontEndPlayer.x = lerp(
        frontEndPlayer.x,
        frontEndPlayer.targetX,
        smoothingFactor,
      );
      frontEndPlayer.y = lerp(
        frontEndPlayer.y,
        frontEndPlayer.targetY,
        smoothingFactor,
      );
      frontEndPlayer.dangle = lerp(
        frontEndPlayer.dangle,
        frontEndPlayer.targetAngle,
        smoothingFactor,
      );

      updateRotationAngle(id, frontEndPlayer);
      frontEndPlayer.draw();
      continue;
    }

    // For other players, you already interpolate using previousPositions:
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

  // Draw projectiles (unchanged)
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

  const speed = 20;
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
        canvas_width: windowWidth,
        canvas_height: windowHeight,
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
          //frontEndPlayers[id].x = backEndPlayer.x;
          //frontEndPlayers[id].y = backEndPlayer.y;
          let correctedY = backEndPlayer.y;
          let correctedX = backEndPlayer.x;

          //removes any inputs whose seqNumber is <= the server-acknowledged seqNumber
          pendingInputs = pendingInputs.filter(
            (input) => input.seqNumber > backEndPlayer.seqNumber,
          );

          //loop over unacknowledged inputs and update
          for (const input of pendingInputs) {
            correctedY += input.dy;
            correctedX += input.dx;
          }
          frontEndPlayers[id].targetX = correctedX;
          frontEndPlayers[id].targetY = correctedY;
          frontEndPlayers[id].targetAngle = backEndPlayer.dangle;
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
              frontEndPlayer.targetX = backEndPlayer.x;
              frontEndPlayer.targetY = backEndPlayer.y;
              frontEndPlayer.targetAngle = backEndPlayer.dangle;
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
              targetX: backEndPlayer.x,
              targetY: backEndPlayer.y,
              username: backEndPlayer.username,
              dangle: backEndPlayer.dangle,
              size: 20,
            });
            previousPositions[id] = {
              x: backEndPlayer.x,
              y: backEndPlayer.y,
              dangle: backEndPlayer.dangle,
            };

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
            delete previousPositions[id];
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
