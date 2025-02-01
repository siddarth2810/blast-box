addEventListener("click", (event) => {
  if (!currentPlayerId || !frontEndPlayers[currentPlayerId]) {
    console.log("Player not initialized yet");
    return;
  }

  const playerPosition = {
    x: frontEndPlayers[currentPlayerId].x,
    y: frontEndPlayers[currentPlayerId].y,
  };

  const angle = Math.atan2(
    event.clientY - playerPosition.y,
    event.clientX - playerPosition.x,
  );

  /*
  const velocity = {
    x: Math.cos(angle) * 5,
    y: Math.sin(angle) * 5,
  };
  */

  ws.send(
    JSON.stringify({
      type: "shoot",
      x: playerPosition.x,
      y: playerPosition.y,
      angle,
    }),
  );

  /*
  frontEndProjectiles.push(
    new Projectile({
      x: playerPosition.x,
      y: playerPosition.y,
      angle: angle,
      velocity,
    }),
  );
  */
  console.log(frontEndProjectiles);
});
