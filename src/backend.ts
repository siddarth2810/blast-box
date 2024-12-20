const uws = require('../uWebSockets.js-20.49.0/uws');
const { v4: uuidv4 } = require('uuid')
const path = require('path');
const fs = require('fs');
const PORT = 8000;
const app = uws.App();

const backEndPlayers = {
}

// Ticker function to emit player updates
setInterval(() => {
	app.publish("updatePlayers", JSON.stringify({
		type: "updatePlayers",
		backEndPlayers: backEndPlayers
	}));
}, 15)

app.ws("/*", {
	open: (ws) => {
		ws.id = uuidv4().toString().substring(0, 11);
		console.log("a client is connected");
		ws.send(JSON.stringify({
			type: "welcome",
			message: "welcome to the server",
			id: ws.id
		}));
		backEndPlayers[ws.id] = {
			x: Math.floor(Math.random() * 400 + 100),
			y: Math.floor(Math.random() * 400 + 100),
			color: `hsl(${360 * Math.random()}, 100%, 44%)`,
			id: ws.id
		}

		//first select channel using subscribe
		ws.subscribe("updatePlayers");
		//then publish
		/*	app.publish("updatePlayers", JSON.stringify({
				type: "updatePlayers",
				backEndPlayers: backEndPlayers
			})); */
	},
	message: (ws, message) => {
		const decoder = new TextDecoder("utf-8");
		const decodedMessage = decoder.decode(message);

		try {
			const data = JSON.parse(decodedMessage);
			console.log("Message from client:", data);
			if (data.type === 'position') {
				const player = backEndPlayers[ws.id];
				if (player) {
					if (data.key == "KeyW" || data.key == "ArrowUp") {
						player.y -= 10;
					}
					if (data.key == "KeyS" || data.key == "ArrowDown") {
						player.y += 10;
					}
					if (data.key == "KeyA" || data.key == "ArrowLeft") {
						player.x -= 10;
					}
					if (data.key == "KeyD" || data.key == "ArrowRight") {
						player.x += 10;
					}
				}
			}
		} catch (error) {
			console.error("Error processing message:", error);
		}
	},
	close: (ws) => {
		console.log("client is disconnected");
		delete backEndPlayers[ws.id];
		//broadcast after closing
		app.publish('updatePlayers', JSON.stringify({
			backEndPlayers: backEndPlayers,
			type: "updatePlayers"
		}));
	},
});


app.get('/*', (res, req) => {
	//For every request (/*), the server always served index.html, ignoring the actual file being requested (e.g., client.js or style.css, so we need urlPath 
	const urlPath = req.getUrl();
	const filePath = path.join(__dirname, 'client', urlPath === '/' ? 'index.html' : urlPath);

	res.onAborted(() => {
		console.log('Request was aborted by the client.');
	});

	//to get content files 
	const getContentType = (filePath) => {
		//ext gets fileextension like .html,.js
		const ext = path.extname(filePath).toLowerCase();
		const types = {
			'.html': 'text/html',
			'.js': 'application/javascript',
			'.css': 'text/css',
			'.json': 'application/json'
		};
		//mapping the object
		return types[ext] || 'text/plain';
	}

	//reading index.html
	fs.readFile(filePath, 'utf-8', (err, data) => {
		res.cork(() => {
			if (err) {
				res.end('file not found');
			} else {
				const contentType = getContentType(filePath);
				res.writeHeader('Content-Type', contentType);
				res.end(data);
			}
		})
	})
});

app.listen(PORT, (token) => {
	if (token) {
		console.log(`sockets server started at ${PORT}`);
	} else {
		console.error('error in starting server');
	}
});
