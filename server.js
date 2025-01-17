const uws = require("./uWebSockets.js-20.49.0/uws");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

const PORT = 8000;
const app = uws.App();

const backEndPlayers = {};
const backEndProjectiles = {};
let projectileId = 0;
let projectileRadius = 5;
const RADIUS = 10;

app.ws("/*", {
  open: (ws) => {
    ws.id = uuidv4().substring(0, 11);
    console.log("Client connected:", ws.id);

    // Create a new player
    backEndPlayers[ws.id] = {
      x: Math.floor(Math.random() * 400 + 100),
      y: Math.floor(Math.random() * 400 + 100),
      color: `hsl(${360 * Math.random()}, 100%, 44%)`,
      id: ws.id,
      seqNumber: 0,
      dangle: 0,
      //canvas: {width: null, height: null}
    };

    // make everyone subscribe to players and projectiles
    ws.subscribe("updatePlayers");
    ws.subscribe("updateProjectiles");

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

      if (!backEndPlayers[ws.id]) return;

      switch (data.type) {
        case "initCanvas": {
          const { windowWidth, windowHeight, devicePixelRatio } = data;
          backEndPlayers[ws.id].canvas = { windowWidth, windowHeight };

          backEndPlayers[ws.id].radius = RADIUS;
          if (devicePixelRatio > 1) {
            backEndPlayers[ws.id].radius = 2 * RADIUS;
          }

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

        case "position": {
          const player = backEndPlayers[ws.id];
          player.seqNumber = data.seqNumber;

          // Basic checks (optional - clamp dx/dy if needed)
          // Example:
          // if (Math.abs(data.dx) > 15) data.dx = 15 * Math.sign(data.dx);
          // if (Math.abs(data.dy) > 15) data.dy = 15 * Math.sign(data.dy);

          player.x += data.dx;
          player.y += data.dy;

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

        case "shoot": {
          projectileId++;
          const { x, y, angle } = data;
          const velocity = {
            x: Math.cos(angle) * 5,
            y: Math.sin(angle) * 5,
          };

          backEndProjectiles[projectileId] = {
            x,
            y,
            velocity,
            playerId: ws.id,
          };

          // Notify this client about projectiles and then broadcast
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
    }),
  );
}

// Broadcast updates
setInterval(() => {
  // Update projectile positions, remove if out-of-bounds
  for (const id in backEndProjectiles) {
    const projectile = backEndProjectiles[id];
    projectile.x += projectile.velocity.x;
    projectile.y += projectile.velocity.y;
    const canvasWidth = 1920; // default width if player disconnected
    const canvasHeight = 1080; // default height if player disconnected

    // Check if projectile is out of bounds
    if (
      projectile.x < 0 ||
      projectile.x > canvasWidth ||
      projectile.y < 0 ||
      projectile.y > canvasHeight
    ) {
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
        // Delete the projectile
        delete backEndProjectiles[id];
        delete backEndPlayers[playerId];
        break;
      }
      console.log(distance);
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
}, 15);

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

// Helper function to determine content type
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
    console.log(`Sockets server started at port ${PORT}`);
  } else {
    console.error("Error starting server");
  }
});
