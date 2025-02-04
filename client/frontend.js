const url = "ws://localhost:8000";
const ws = new WebSocket(url);

const scoreEl = document.querySelector("#scoreEl");
const devicePixelRatio = window.devicePixelRatio || 1;

// Game dimensions
const gameWidth = innerWidth * devicePixelRatio;
const gameHeight = innerHeight * devicePixelRatio;

// Game state variables
const frontEndPlayers = {};
const frontEndProjectiles = {};
let currentPlayerId = null;
let angle = 0;
let seqNumber = 0;
let lastUpdateTime = performance.now();

// Input handling
const keys = {
  w: false,
  s: false,
  a: false,
  d: false,
};

// Constants
const INTERPOLATION_FACTOR = 0.2;
const INPUT_BUFFER_SIZE = 8;
let inputBuffer = [];

// Utility functions
function lerp(start, end, t) {
  return start * (1 - t) + end * t;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CENTER);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// Main game loop
function draw() {
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastUpdateTime) / 1000; // Convert to seconds
  lastUpdateTime = currentTime;

  update(deltaTime);
  render();
}

function update(deltaTime) {
  // Update local player position with delta time
  if (currentPlayerId && frontEndPlayers[currentPlayerId]) {
    const player = frontEndPlayers[currentPlayerId];
    const speed = 300 * deltaTime; // Units per second
    let dx = 0;
    let dy = 0;

    if (keys.w) dy -= speed;
    if (keys.s) dy += speed;
    if (keys.a) dx -= speed;
    if (keys.d) dx += speed;

    if (dx !== 0 || dy !== 0) {
      processInput({ dx, dy });
    }
  }

  // Update other players' positions with interpolation
  for (const id in frontEndPlayers) {
    if (id !== currentPlayerId) {
      const player = frontEndPlayers[id];
      if (player.targetX !== undefined) {
        player.x = lerp(player.x, player.targetX, INTERPOLATION_FACTOR);
        player.y = lerp(player.y, player.targetY, INTERPOLATION_FACTOR);
      }
    }
  }

  // Update projectiles
  for (const id in frontEndProjectiles) {
    const frontEndProjectile = frontEndProjectiles[id];
    frontEndProjectile.update();
  }
}

function render() {
  background(200);

  // Draw players
  for (const id in frontEndPlayers) {
    const frontEndPlayer = frontEndPlayers[id];
    frontEndPlayer.draw();
    updateRotationAngle(id, frontEndPlayer);
  }

  // Draw projectiles
  for (const id in frontEndProjectiles) {
    const frontEndProjectile = frontEndProjectiles[id];
    frontEndProjectile.draw();
  }
}

function processInput(input) {
  inputBuffer.push(input);
  if (inputBuffer.length > INPUT_BUFFER_SIZE) {
    inputBuffer.shift();
  }

  // Apply prediction
  const player = frontEndPlayers[currentPlayerId];
  player.x += input.dx;
  player.y += input.dy;

  // Send to server
  seqNumber++;
  ws.send(
    JSON.stringify({
      type: "position",
      dx: input.dx,
      dy: input.dy,
      seqNumber: seqNumber,
      timestamp: Date.now(),
    }),
  );
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

// Input event listeners
window.addEventListener("keydown", (event) => {
  if (!currentPlayerId || !frontEndPlayers[currentPlayerId]) return;

  switch (event.code) {
    case "KeyW":
    case "ArrowUp":
      keys.w = true;
      break;
    case "KeyS":
    case "ArrowDown":
      keys.s = true;
      break;
    case "KeyA":
    case "ArrowLeft":
      keys.a = true;
      break;
    case "KeyD":
    case "ArrowRight":
      keys.d = true;
      break;
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "KeyW":
    case "ArrowUp":
      keys.w = false;
      break;
    case "KeyS":
    case "ArrowDown":
      keys.s = false;
      break;
    case "KeyA":
    case "ArrowLeft":
      keys.a = false;
      break;
    case "KeyD":
    case "ArrowRight":
      keys.d = false;
      break;
  }
});

// WebSocket event handlers
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
        break;

      case "updatePosition":
        const { id, backEndPlayer } = data;
        if (id === currentPlayerId) {
          // Update the authoritative position
          frontEndPlayers[id].x = backEndPlayer.x;
          frontEndPlayers[id].y = backEndPlayer.y;

          // Remove processed inputs
          inputBuffer = inputBuffer.filter(
            (input) => input.seqNumber > backEndPlayer.seqNumber,
          );

          // Reapply remaining inputs
          for (const input of inputBuffer) {
            frontEndPlayers[id].x += input.dx;
            frontEndPlayers[id].y += input.dy;
          }
        }
        break;

      case "updateProjectiles":
        const backEndProjectiles = data.backEndProjectiles || {};

        // Update existing projectiles and add new ones
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

        // Remove defunct projectiles
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
            // Update score
            document.querySelector(`div[data-id="${id}"]`).innerHTML =
              `${backEndPlayer.username}: ${backEndPlayer.score}`;
            document
              .querySelector(`div[data-id="${id}"]`)
              .setAttribute("data-score", backEndPlayer.score);

            if (id === currentPlayerId) {
              frontEndPlayer.dangle = backEndPlayer.dangle;
            } else {
              // Store target positions for interpolation
              frontEndPlayer.targetX = backEndPlayer.x;
              frontEndPlayer.targetY = backEndPlayer.y;
              frontEndPlayer.dangle = backEndPlayer.dangle;
            }
          } else {
            // Add new player
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

        // Remove disconnected players
        for (const id in frontEndPlayers) {
          if (!backEndPlayers[id]) {
            const divToDelete = document.querySelector(`div[data-id="${id}"]`);
            divToDelete.parentNode.removeChild(divToDelete);
            delete frontEndPlayers[id];
          }
        }
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
