addEventListener("click", (event) => {
  const playerPosition = {
    x: frontEndPlayers[currentPlayerId].x,
    y: frontEndPlayers[currentPlayerId].y,
  };
  const canvas = document.querySelector("canvas");
  const angle = Math.atan2(
    event.clientY * window.devicePixelRatio - playerPosition.x,
    event.clientX * window.devicePixelRatio - playerPosition.y,
  );

  const velocity = {
    x: Math.cos(angle) * 5,
    y: Math.sin(angle) * 5,
  };

  frontEndProjectiles.push(
    new Projectile({
      x: playerPosition.x,
      y: playerPosition.y,
      radius: 5,
      color: "white",
      velocity,
    }),
  );
  console.log(frontEndProjectiles);
});
