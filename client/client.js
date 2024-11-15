const url = "ws://localhost:8080";
const ws = new WebSocket(url); // Directly using WebSocket for browser compatibility

// Event: Connection established
ws.onopen = () => {
  console.log("Connected to the server");
  ws.send("Hello, server!");
};

// Event: Message received from the server
ws.onmessage = (event) => {
  console.log("Received message:", event.data);

  // Change the background color of the page to black
  document.body.style.backgroundColor = "black";
};

// Event: Connection closed
ws.onclose = (event) => {
  console.log("Connection closed:", event.code, event.reason);
};

// Event: Error encountered
ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};
