// p5.js Player Class

class Player {
  constructor({ x, y, size, dangle }) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.dangle = dangle;
  }

  draw() {
    push(); // Save current drawing state
    translate(this.x, this.y);
    rotate(this.dangle);
    stroke(51);
    strokeWeight(3);
    fill(100);
    rect(this.size, 0, this.size * 1.5, this.size * 0.75); //barrel

    fill(0, 204, 204);
    ellipse(0, 0, this.size * 2, this.size * 2);
    pop(); // Restore original drawing state
  }
}
