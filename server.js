//server.js
const uws = require("./uWebSockets.js-20.49.0/uws");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

const PORT = 8080;
const TICK_INTERVAL = 1000 / 60;
const app = uws.App();

const backEndPlayers = {};
const backEndProjectiles = {};

let projectileId = 0;
let projectileRadius = 5;
const PLAYER_RADIUS = 10;
const PROJECTILE_SPEED = 6.8;

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
            x: Math.floor(Math.random() * 400 + 100),
            y: Math.floor(Math.random() * 400 + 100),
            color: `hsl(${360 * Math.random()}, 100%, 44%)`,
            score: 0,
            id: ws.id,
            radius: devicePixelRatio > 1 ? 2 * PLAYER_RADIUS : PLAYER_RADIUS,
            seqNumber: 0,
            username: username,
            dangle: 0,
          };

          // make everyone subscribe to players and projectiles
          ws.subscribe("updatePlayers");
          ws.subscribe("updateProjectiles");
          console.log(username);
          broadcastPlayers();
          break;
        }

        case "position": {
          const player = backEndPlayers[ws.id];
          if (!player) return;
          player.seqNumber = data.seqNumber;

          player.x = Math.max(
            player.radius,
            Math.min(data.canvas_width - player.radius, player.x + data.dx),
          );
          player.y = Math.max(
            player.radius,
            Math.min(data.canvas_height - player.radius, player.y + data.dy),
          );

          // Send position to the client that moved
          ws.send(
            JSON.stringify({
              type: "updatePosition",
              id: ws.id,
              backEndPlayer: { ...player },
            }),
          );
          broadcastPlayers();
          break;
        }

        case "angle": {
          const player = backEndPlayers[ws.id];
          if (!player) return;

          // Update server-side angle
          player.dangle = data.dangle;
          broadcastPlayers();
          break;
        }

        case "shoot": {
          const player = backEndPlayers[ws.id];
          if (!player) return;

          const now = Date.now();
          if (player.lastShot && now - player.lastShot < 300) {
            // 300 ms cooldown
            return;
          }
          player.lastShot = now;

          projectileId++;
          const { x, y, angle } = data;
          const velocity = {
            x: Math.cos(angle) * PROJECTILE_SPEED,
            y: Math.sin(angle) * PROJECTILE_SPEED,
          };
          backEndProjectiles[projectileId] = {
            x,
            y,
            velocity,
            playerId: ws.id,
            createdAt: Date.now(),
          };

          // Notify client about projectiles then broadcast
          ws.send(
            JSON.stringify({
              type: "updateProjectiles",
              backEndProjectiles,
            }),
          );

          app.publish(
            "updateProjectiles",
            JSON.stringify({
              type: "updateProjectiles",
              backEndProjectiles: backEndProjectiles,
            }),
          );
          break;
        }

        default:
          console.log("Unknown message type:", data);
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  },

  close: (ws) => {
    console.log("Client disconnected:", ws.id);
    // Remove the player's data
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
      timestamp: Date.now(),
    }),
  );
}

// Broadcast updates
setInterval(() => {
  // Update projectile positions, remove if out-of-bounds
  const now = Date.now();
  for (const id in backEndProjectiles) {
    const projectile = backEndProjectiles[id];
    projectile.x += projectile.velocity.x;
    projectile.y += projectile.velocity.y;

    // Check if projectile is out of bounds
    if (now - projectile.createdAt > 3000) {
      delete backEndProjectiles[id];
      continue;
    }

    for (const playerId in backEndPlayers) {
      const backEndPlayer = backEndPlayers[playerId];

      const distance = Math.hypot(
        projectile.x - backEndPlayer.x,
        projectile.y - backEndPlayer.y,
      );

      if (
        distance < projectileRadius + backEndPlayer.radius &&
        projectile.playerId !== playerId
      ) {
        if (backEndPlayers[backEndProjectiles[id].playerId]) {
          backEndPlayers[backEndProjectiles[id].playerId].score++;
        }
        delete backEndProjectiles[id];
        delete backEndPlayers[playerId];
        broadcastPlayers();
        break;
      }
      //console.log(distance);
    }
  }

  app.publish(
    "updateProjectiles",
    JSON.stringify({
      type: "updateProjectiles",
      backEndProjectiles: backEndProjectiles,
    }),
  );
  broadcastPlayers();
}, TICK_INTERVAL);

// Serve static files
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

  fs.readFile(filePath, (err, data) => {
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

// Helper function to determine content type
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
  };
  return types[ext] || "text/plain";
}

app.listen(PORT, "0.0.0.0", (token) => {
  if (token) {
    console.log(`Sockets server started at port ${PORT}`);
  } else {
    console.error("Error starting server");
  }
});
