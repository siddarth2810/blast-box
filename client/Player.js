// p5.js Player Class

class Player {
  constructor({ x, y, size, dangle }) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.size = size;
    this.dangle = dangle;
    this.targetAngle = dangle;
  }

  draw() {
    push(); // Save current drawing state
    translate(this.x, this.y);
    rotate(this.dangle);
    stroke(51);
    strokeWeight(3);
    fill(100);
    rect(this.size, 0, this.size * 2.6, this.size * 2.3); //barrel

    fill(0, 204, 204);
    ellipse(0, 0, this.size * 2.6, this.size * 2.6);
    pop(); // Restore original drawing state
  }
}
