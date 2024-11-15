const uws = require('./uWebSockets.js-20.49.0/uws');
const path = require('path');
const fs = require('fs');
const PORT = 8080;
const app = uws.App();

app.ws("/*", {
	open: (ws) => {
		console.log("a client is connected");
		ws.send("welcome to server");
	},
	message: (ws, message) => {
		const decoder = new TextDecoder("utf-8");
		const decodedMessage = decoder.decode(message);
		ws.send(`You sent: ${decodedMessage}`);
	},
	close: (ws) => {
		console.log("client is disconnected");
	},
});

app.get('/*', (res, req) => {
	//For every request (/*), the server always served index.html, ignoring the actual file being requested (e.g., client.js or style.css, so we need urlPath 
	const urlPath = req.getUrl();
	const filePath = path.join(__dirname, 'client', urlPath === '/' ? 'index.html' : urlPath);

	res.onAborted(() => {
		console.log('Request was aborted by the client.');
	});

	fs.readFile(filePath, 'utf-8', (err, data) => {
		res.cork(() => {
			if (err) {
				res.end('file not found');
			} else {
				res.writeHeader('Content-Type', 'text/html');
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
