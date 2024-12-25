const uws = require("./uWebSockets.js-20.49.0/uws");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

// Object to hold player data
const backEndPlayers = {};
const inputHistory = {};

const PORT = 8000;
const app = uws.App();

// Ticker function to emit player updates
setInterval(() => {
  app.publish(
    "updatePlayers",
    JSON.stringify({
      type: "updatePlayers",
      backEndPlayers: backEndPlayers,
    }),
  );
}, 15);

app.ws("/*", {
  open: (ws) => {
    ws.id = uuidv4().substring(0, 11);
    console.log("Client connected:", ws.id);

    backEndPlayers[ws.id] = {
      x: Math.floor(Math.random() * 400 + 100),
      y: Math.floor(Math.random() * 400 + 100),
      color: `hsl(${360 * Math.random()}, 100%, 44%)`,
      id: ws.id,
      seqNumber: 0,
    };

    //init input history
    inputHistory[ws.id] = [];

    ws.subscribe("updatePlayers");

    ws.send(
      JSON.stringify({
        type: "welcome",
        message: "Welcome to the server",
        id: ws.id,
      }),
    );
  },

  message: (ws, message, isBinary) => {
    try {
      const decoder = new TextDecoder("utf-8");
      const decodedMessage = decoder.decode(message);
      const data = JSON.parse(decodedMessage);

      if (data.type === "position") {
        const player = backEndPlayers[ws.id];
        if (!player) return;
        player.seqNumber = data.seqNumber;

        if (data.x > 50 || data.y > 50) {
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            // Movement might be too large, ignore or clamp
            dx = clamp(dx);
            dy = clamp(dy);
            return;
          }
        }
        player.x += data.dx;
        player.y += data.dy;

        //send update to client
        ws.send(
          JSON.stringify({
            id: ws.id,
            type: "updatePosition",
            backEndPlayer: backEndPlayers[ws.id],
            dx: player.dx,
            dy: player.dy,
          }),
        );

        //publish
        app.publish(
          "updatePlayers",
          JSON.stringify({
            type: "updatePlayers",
            backEndPlayers: backEndPlayers,
          }),
        );
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  },

  close: (ws) => {
    console.log("Client disconnected:", ws.id);
    delete backEndPlayers[ws.id];

    app.publish(
      "updatePlayers",
      JSON.stringify({
        type: "updatePlayers",
        backEndPlayers: backEndPlayers,
      }),
    );
  },
});

// Function to get content type
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
        res.end("file not found");
      } else {
        const contentType = getContentType(filePath);
        res.writeHeader("Content-Type", contentType);
        res.end(data);
      }
    });
  });
});

app.listen(PORT, (token) => {
  if (token) {
    console.log(`Sockets server started at ${PORT}`);
  } else {
    console.error("Error in starting server");
  }
});
