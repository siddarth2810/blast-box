addEventListener("click", (event) => {
  if (!currentPlayerId || !frontEndPlayers[currentPlayerId]) {
    console.log("Player not initialized yet");
    return;
  }

  // Check if cooldown period has passed
  const now = Date.now();
  if (now - lastShotTime < PROJECTILE_COOLDOWN) {
    // Too soon to shoot again, ignore this click
    return;
  }
  lastShotTime = now;

  const playerPosition = {
    x: frontEndPlayers[currentPlayerId].x,
    y: frontEndPlayers[currentPlayerId].y,
  };

  const angle = Math.atan2(
    event.clientY - playerPosition.y,
    event.clientX - playerPosition.x,
  );

  ws.send(
    JSON.stringify({
      type: "shoot",
      x: playerPosition.x,
      y: playerPosition.y,
      angle,
    }),
  );
});
