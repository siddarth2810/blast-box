const uws = require('./uWebSockets.js-20.49.0/uws');
const path = require('path');
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
	const urlPath = req.getUrl();
	const filePath = path.join(__dirname, 'client', urlPath === '/' ? 'index.html' : urlPath);
	require('fs').readFile(filePath, (err, data) => {
		if (err) {
			res.writeStatus("404 Not Found").end("404 - File Not Found");
		} else {
			res._end(data);
		}
	});
});

app.listen(PORT, (token) => {
	if (token) {
		console.log(`sockets server started at ${PORT}`);
	} else {
		console.error('error in starting server');
	}
});
