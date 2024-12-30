//Diep.io clone with Callum
var x = 0; //coordinates of diep
var y = 0;
var xvel = 0; //velocity of diep
var xvel = 0;
var balls = [];
var dangle = 0; //angle diep is turned
var bx, by;

function setup() {
  createCanvas(600, 600);
  rectMode(CENTER);
}

function draw() {
  background(200); //light gray
  if (keyIsDown(LEFT_ARROW)) {
    xvel = 5;
  }
  if (keyIsDown(RIGHT_ARROW)) {
    xvel = -5;
  }
  x += xvel;
  //text(str(mouseX)+","+str(mouseY),mouseX+10,mouseY+10);
  grid();
  dangle = atan2(mouseY - height / 2, mouseX - width / 2);
  for (var i = 0; i < balls.length; i++) {
    balls[i].update();
  }

  diep(x, y, 20);
}

function grid() {
  for (var i = -2000; i < 2000; i += 20) {
    for (var j = -2000; j < 2000; j += 20) {
      stroke(155);
      line(i + x, 0, i + x, height);
      line(0, j + y, width, j + y);
    }
  }
}

function diep(x, y, size) {
  push(); //move the grid
  translate(width / 2, height / 2);
  rotate(dangle);
  stroke(51); //gray outline
  strokeWeight(3); //thick outline
  fill(100); // gray
  rect(size, 0, size * 1.5, size * 0.75); //barrel
  fill(0, 204, 204);
  ellipse(0, 0, size * 2, size * 2); //body
  pop(); //reset the grid
}

function mouseClicked() {
  balls.push(new Ball());
}

var Ball = function () {
  this.bx = 0;
  this.by = 0;
  this.angle = dangle;
  this.bxvel = 10 * cos(this.angle);
  this.byvel = 10 * sin(this.angle);

  this.update = function () {
    push();
    translate(width / 2, height / 2);
    this.bx += this.bxvel;
    this.by += this.byvel;
    stroke(51); //gray outline
    strokeWeight(3); //thick outline
    fill(255, 0, 0);
    ellipse(this.bx, this.by, 20, 20);
    pop();
  };
};
