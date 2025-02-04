const uws = require("./uWebSockets.js-20.49.0/uws");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

const PORT = 8000;
const app = uws.App();

// Game state
const backEndPlayers = {};
const backEndProjectiles = {};
let projectileId = 0;

// Constants
const TICK_RATE = 60;
const TICK_INTERVAL = 1000 / TICK_RATE;
const PLAYER_RADIUS = 10;
const PROJECTILE_RADIUS = 5;
const MAX_PLAYER_SPEED = 300; // units per second
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

// Utility functions
function validateMovement(dx, dy, deltaTime) {
  const maxDelta = MAX_PLAYER_SPEED * deltaTime;
  const magnitude = Math.sqrt(dx * dx + dy * dy);

  if (magnitude > maxDelta) {
    const scale = maxDelta / magnitude;
    return {
      dx: dx * scale,
      dy: dy * scale,
    };
  }

  return { dx, dy };
}

function isColliding(x1, y1, r1, x2, y2, r2) {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  return distance < r1 + r2;
}

// WebSocket handlers
app.ws("/*", {
  open: (ws) => {
    ws.id = uuidv4().substring(0, 11);
    console.log("Client connected:", ws.id);

    ws.send(
      JSON.stringify({
        type: "welcome",
        message: "Welcome to the server",
        id: ws.id,
      }),
    );
  },

  message: (ws, message) => {
    try {
      const decoder = new TextDecoder("utf-8");
      const decodedMessage = decoder.decode(message);
      const data = JSON.parse(decodedMessage);

      switch (data.type) {
        case "initGame": {
          const { username, devicePixelRatio } = data;

          backEndPlayers[ws.id] = {
            x: Math.floor(Math.random() * (CANVAS_WIDTH - 200) + 100),
            y: Math.floor(Math.random() * (CANVAS_HEIGHT - 200) + 100),
            color: `hsl(${360 * Math.random()}, 100%, 44%)`,
            score: 0,
            id: ws.id,
            seqNumber: 0,
            username: username,
            dangle: 0,
            radius: devicePixelRatio > 1 ? 2 * PLAYER_RADIUS : PLAYER_RADIUS,
            lastProcessedInput: 0,
          };

          ws.subscribe("updatePlayers");
          ws.subscribe("updateProjectiles");

          broadcastPlayers();
          break;
        }

        case "position": {
          const player = backEndPlayers[ws.id];
          if (!player) return;

          const now = Date.now();
          const deltaTime = (now - (player.lastUpdateTime || now)) / 1000;
          player.lastUpdateTime = now;

          // Validate and adjust movement
          const { dx, dy } = validateMovement(data.dx, data.dy, deltaTime);

          // Update player position
          player.x = Math.max(
            player.radius,
            Math.min(CANVAS_WIDTH - player.radius, player.x + dx),
          );
          player.y = Math.max(
            player.radius,
            Math.min(CANVAS_HEIGHT - player.radius, player.y + dy),
          );

          // Update sequence number
          player.seqNumber = data.seqNumber;

          // Send immediate position update to the moving player
          ws.send(
            JSON.stringify({
              type: "updatePosition",
              id: ws.id,
              backEndPlayer: {
                x: player.x,
                y: player.y,
                seqNumber: player.seqNumber,
              },
            }),
          );

          break;
        }

        case "angle": {
          const player = backEndPlayers[ws.id];
          if (!player) return;

          player.dangle = data.dangle;
          break;
        }

        case "shoot": {
          const player = backEndPlayers[ws.id];
          if (!player) return;

          projectileId++;
          const velocity = {
            x: Math.cos(data.angle) * 2.7,
            y: Math.sin(data.angle) * 2.7,
          };

          backEndProjectiles[projectileId] = {
            x: data.x,
            y: data.y,
            velocity,
            playerId: ws.id,
            createdAt: Date.now(),
          };

          // Notify shooter about their projectile
          ws.send(
            JSON.stringify({
              type: "updateProjectiles",
              backEndProjectiles,
            }),
          );

          // Broadcast projectile to all players
          app.publish(
            "updateProjectiles",
            JSON.stringify({
              type: "updateProjectiles",
              backEndProjectiles,
            }),
          );
          break;
        }
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  },

  close: (ws) => {
    console.log("Client disconnected:", ws.id);
    delete backEndPlayers[ws.id];
    broadcastPlayers();
  },
});

function broadcastPlayers() {
  app.publish(
    "updatePlayers",
    JSON.stringify({
      type: "updatePlayers",
      backEndPlayers,
    }),
  );
}

// Game loop
setInterval(() => {
  // Update projectiles
  for (const id in backEndProjectiles) {
    const projectile = backEndProjectiles[id];

    // Update position
    projectile.x += projectile.velocity.x;
    projectile.y += projectile.velocity.y;

    // Remove if out of bounds
    if (
      projectile.x < 0 ||
      projectile.x > CANVAS_WIDTH ||
      projectile.y < 0 ||
      projectile.y > CANVAS_HEIGHT ||
      Date.now() - projectile.createdAt > 5000 // Remove after 5 seconds
    ) {
      delete backEndProjectiles[id];
      continue;
    }

    // Check collisions with players
    for (const playerId in backEndPlayers) {
      const player = backEndPlayers[playerId];

      if (
        projectile.playerId !== playerId && // Can't hit self
        isColliding(
          projectile.x,
          projectile.y,
          PROJECTILE_RADIUS,
          player.x,
          player.y,
          player.radius,
        )
      ) {
        // Update shooter's score if they're still in game
        if (backEndPlayers[projectile.playerId]) {
          backEndPlayers[projectile.playerId].score++;
        }

        // Remove hit player and projectile
        delete backEndProjectiles[id];
        delete backEndPlayers[playerId];

        broadcastPlayers();
        break;
      }
    }
  }

  // Broadcast updates
  app.publish(
    "updateProjectiles",
    JSON.stringify({
      type: "updateProjectiles",
      backEndProjectiles,
    }),
  );

  broadcastPlayers();
}, TICK_INTERVAL);

// Static file serving
app.get("/*", (res, req) => {
  const urlPath = req.getUrl();
  const filePath = path.join(
    __dirname,
    "client",
    urlPath === "/" ? "index.html" : urlPath,
  );

  res.onAborted(() => {
    console.log("Request was aborted by the client.");
  });

  fs.readFile(filePath, "utf-8", (err, data) => {
    res.cork(() => {
      if (err || !data) {
        res.end("File not found");
      } else {
        const contentType = getContentType(filePath);
        res.writeHeader("Content-Type", contentType);
        res.end(data);
      }
    });
  });
});

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
  };
  return types[ext] || "text/plain";
}

app.listen(PORT, "0.0.0.0", (token) => {
  if (token) {
    console.log(`Game server started at port ${PORT}`);
  } else {
    console.error("Error starting server");
  }
});
