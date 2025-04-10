// TODO: Replace cube and obstacle with 3D models

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Variáveis do score
let score = 0;                            
let scoreInterval;                       
let gameRunning = true;                  


class Box extends THREE.Mesh {
  constructor({width, height, depth, color = '#00ff00', velocity = {x: 0, y: 0, z: 0}, position = {x: 0, y: 0, z: 0}, zAcceleration = false}) {
    super(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color })
    );

    this.width = width;
    this.height = height;
    this.depth = depth;
    this.position.set(position.x, position.y, position.z);

    this.right = this.position.x + width / 2;
    this.left = this.position.x - width / 2;
    this.top = this.position.y + height / 2;
    this.bottom = this.position.y - height / 2;
    this.front = this.position.z + depth / 2;
    this.back = this.position.z - depth / 2;

    this.velocity = velocity;
    this.gravity = -0.002;
    this.zAcceleration = zAcceleration;
  }

  updateSides() {
    this.right = this.position.x + this.width / 2;
    this.left = this.position.x - this.width / 2;
    this.front = this.position.z + this.depth / 2;
    this.back = this.position.z - this.depth / 2;
  }

  update(ground) {
    this.updateSides();

    if (this.zAcceleration) {
      this.velocity.z += 0.0003;
    }

    this.bottom = this.position.y - this.height / 2;
    this.top = this.position.y + this.height / 2;

    this.position.x += this.velocity.x;
    this.position.z += this.velocity.z;

    this.applyGravity(ground);
  }

  applyGravity(ground) {
    this.velocity.y += this.gravity;

    const friction = 0.5;

    if (boxColision({ box1: this, box2: ground })) {
      this.velocity.y *= friction;
      this.velocity.y = -this.velocity.y;
    } else {
      this.position.y += this.velocity.y;
    }
  }
}

function boxColision({ box1, box2 }) {
  const zCollission = box1.front >= box2.back && box1.back <= box2.front;
  const yCollission = box1.bottom + box1.velocity.y <= box2.top && box1.top >= box2.bottom;
  const xCollission = box1.right >= box2.left && box1.left <= box2.right;

  return zCollission && yCollission && xCollission;
}

// Ground
const ground = new Box({ width: 10, height: 0.5, depth: 30, color: '#ff8c00', position: { x: 0, y: -2, z: 0 } });
ground.receiveShadow = true;
scene.add(ground);

// Cube
const cube = new Box({ width: 1, height: 1, depth: 1, velocity: { x: 0, y: -0.01, z: 0 } });
cube.castShadow = true;
cube.position.z = -(ground.back + cube.depth / 2) - 1;
scene.add(cube);

// Luz
const light = new THREE.DirectionalLight(0xffffff, 2.5);
light.position.set(2, 4, 5);
light.castShadow = true;
scene.add(light);

light.shadow.camera.left = -15;
light.shadow.camera.right = 15;
light.shadow.camera.top = 15;
light.shadow.camera.bottom = -15;
light.shadow.mapSize.set(4096, 4096);
light.shadow.camera.near = 0.1;
light.shadow.camera.far = 100;

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);
const skyUniforms = sky.material.uniforms;
skyUniforms['turbidity'].value = 1;
skyUniforms['rayleigh'].value = 0.1;
skyUniforms['mieCoefficient'].value = 0.005;
skyUniforms['mieDirectionalG'].value = 0.8;
skyUniforms['sunPosition'].value.copy(light.position);

// Câmera
camera.position.set(0, ground.height * 6, ground.depth * 0.32 + 10);
camera.lookAt(ground.position);

const keys = {
  a: { pressed: false },
  d: { pressed: false },
  w: { pressed: false },
  s: { pressed: false }
};

window.addEventListener('keydown', (event) => {
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.w.pressed = true;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.a.pressed = true;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.d.pressed = true;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keys.s.pressed = true;
      break;
    case 'Space':
      cube.velocity.y = 0.1;
      break;
  }
});

window.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.w.pressed = false;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.a.pressed = false;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.d.pressed = false;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keys.s.pressed = false;
      break;
  }
});

let tiltX = 0;
let tiltY = 0;
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
if (isMobile) {
  window.addEventListener('deviceorientation', (event) => {
    tiltX = event.gamma;
    tiltY = event.beta;
  });
}

const enemies = [];
let frames = 0;
let spawnRate = 200;

function endGame(message) {
  gameRunning = false;                       // <-- Adicionado
  clearInterval(scoreInterval);             // <-- Adicionado
  alert(`${message}\nFinal Score: ${score}`);  // <-- Adicionado
  window.location.reload();
}

function animate() {

  const helpBtn = document.getElementById('help-button');
  const tooltip = document.getElementById('help-tooltip');

  helpBtn.addEventListener('hover', () => {
    tooltip.style.display = tooltip.style.display === 'block' ? 'none' : 'block';
  });

  const animationID = requestAnimationFrame(animate);
  renderer.render(scene, camera);

  cube.velocity.x = 0;
  cube.velocity.z = 0;
  if (keys.a.pressed) cube.velocity.x -= 0.045;
  if (keys.d.pressed) cube.velocity.x += 0.045;
  if (keys.w.pressed) cube.velocity.z = -0.045;
  if (keys.s.pressed) cube.velocity.z = 0.045;

  if (isMobile) {
    if (Math.abs(tiltX) > 3) cube.velocity.x = Math.sign(tiltX) * 0.05;
    const adjustedTiltY = tiltY - 30;
    if (Math.abs(adjustedTiltY) > 3) cube.velocity.z = Math.sign(adjustedTiltY) * 0.08;

    window.addEventListener('touchstart', () => {
        cube.velocity.y = 0.1;
    });
  }

  cube.update(ground);

  if (cube.bottom < ground.bottom - 5) {
    endGame("Game Over by Fall!");
    cancelAnimationFrame(animationID);
    return;
  }

  enemies.forEach(enemy => {
    enemy.update(ground);
    if (boxColision({ box1: cube, box2: enemy })) {
      endGame("Game Over by Collision!");
      cancelAnimationFrame(animationID);
    }
  });

  if (frames % spawnRate === 0) {
    if (spawnRate > 20) spawnRate -= 10;
    const enemy = new Box({
      width: 1, height: 1, depth: 1,
      position: {
        x: (Math.random() * (ground.right - ground.left)) + ground.left, // Posição aleatória no eixo X
        y: 0,
        z: ground.back + cube.depth / 2 - 1 // Posição na ponta de trás do ground
      },      velocity: { x: 0, y: 0, z: 0.005 },
      color: 'red',
      zAcceleration: true
    });
    enemy.castShadow = true;
    scene.add(enemy);
    enemies.push(enemy);
  }

  frames++;
}

animate();

// Score counting
scoreInterval = setInterval(() => {
  if (gameRunning) {
    score++;
    document.getElementById('score').textContent = `Score: ${score}`;
  }
}, 1000);