class Projectile {
  constructor({ x, y, angle, velocity }) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    // Default velocity if none is provided
    this.velocity = velocity || {
      x: 10 * Math.cos(this.angle),
      y: 10 * Math.sin(this.angle),
    };
  }

  update() {
    // Move in the direction of velocity
    this.x += this.velocity.x;
    this.y += this.velocity.y;
    this.draw();
  }

  draw() {
    push();
    stroke(51); // Gray outline
    strokeWeight(3); // Thick outline
    fill(255, 0, 0);
    ellipse(this.x, this.y, 20, 20);
    pop();
  }
}
