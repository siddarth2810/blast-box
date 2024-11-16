const uws = require('./uWebSockets.js-20.49.0/uws');
const { v4: uuidv4 } = require('uuid')
const path = require('path');
const fs = require('fs');
const PORT = 8080;
const app = uws.App();

const players = {
}

app.ws("/*", {
	open: (ws) => {
		ws.id = uuidv4().toString().substring(0, 11);
		console.log("a client is connected");
		ws.send(JSON.stringify({
			type: "welcome",
			message: "welcome to the server"
		}));
		players[ws.id] = {
			x: Math.floor(Math.random() * 400 + 100),
			y: Math.floor(Math.random() * 400 + 100)
		}

		//first select channel using subscribe
		ws.subscribe("updatePlayers");
		//then publish
		app.publish("updatePlayers", JSON.stringify({
			type: "updatePlayers",
			backendPlayers: players
		}));
	},
	message: (ws, message) => {
		const decoder = new TextDecoder("utf-8");
		const decodedMessage = decoder.decode(message);
		try {
			const data = JSON.parse(decodedMessage);
			console.log("Message from client:", data);

			//publish this when there is any change in clinet like position
			//app.publish("updatePlayers", JSON.stringify({
			//	type: "updatePlayers",
			//		players: players
			//	}));
		} catch (error) {
			console.error("Error processing message:", error);
		}
	},
	close: (ws) => {
		console.log("client is disconnected");
		delete players[ws.id];
		//broadcast after closing
		app.publish('updatePlayers', JSON.stringify({
			backendPlayers: players,
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
