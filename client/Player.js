// p5.js Player Class

class Player {
  constructor({ x, y, size }) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.dangle = 0;
  }

  draw() {
    push(); // Save current drawing state
    translate(this.x, this.y); // Move to player's position
    rotate(this.dangle); // Rotate the player

    // Draw body
    stroke(51);
    strokeWeight(3);
    fill(100);
    rect(
      -this.size * 0.75,
      -this.size * 0.375,
      this.size * 1.5,
      this.size * 0.75,
    );

    fill(0, 204, 204);
    ellipse(0, 0, this.size * 2, this.size * 2);
    pop(); // Restore original drawing state
  }
}
