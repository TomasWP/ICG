// TODO: Replace cube and obstacle with 3D models

await import('https://unpkg.com/es-module-shims@1.6.3/dist/es-module-shims.js');    

import * as THREE from 'https://unpkg.com/three@0.150.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.150.1/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'https://unpkg.com/three@0.150.1/examples/jsm/objects/Sky.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.physicallyCorrectLights = true; //Iluminação realista
renderer.shadowMap.enabled = true;   
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

class Box extends THREE.Mesh {
    constructor({width,height,depth,color = '#00ff00', velocity = {x: 0, y: 0, z: 0}, position={x: 0, y: 0, z: 0}, zAcceleration = false}) {
        super(
            new THREE.BoxGeometry(width, height, depth), 
            new THREE.MeshStandardMaterial({color})
        );
        this.width = width;
        this.height = height;
        this.depth = depth;

        this.position.set(position.x, position.y, position.z);

        this.right = this.position.x + (this.width / 2);
        this.left = this.position.x - (this.width / 2);
        
        this.bottom = this.position.y - (this.height / 2);
        this.top = this.position.y + (this.height / 2);

        this.front = this.position.z + (this.depth / 2);
        this.back = this.position.z - (this.depth / 2);

        this.velocity = velocity;
        this.gravity = -0.002;

        this.zAcceleration = zAcceleration; //z axis acceleration
    }

    updateSides(){
      this.right = this.position.x + (this.width / 2);
      this.left = this.position.x - (this.width / 2);

      this.front = this.position.z + (this.depth / 2);
      this.back = this.position.z - (this.depth / 2);
    }

    update(ground){
        this.updateSides(); //update sides of the cube

        if(this.zAcceleration) { //z axis acceleration
          this.velocity.z += 0.0003; //speed of the cube
        }

        this.bottom = this.position.y - this.height / 2;
        this.top = this.position.y + this.height / 2;

        this.position.x += this.velocity.x;     //x axis movement
        this.position.z += this.velocity.z;     //z axis movement

        this.applyGravity(ground);                    //speed of gravity
    }

    applyGravity(ground) {                     
        this.velocity.y += this.gravity; //gravity

        const friction = 0.5; //bounce friction

        if(boxColision({box1:this, box2:ground})) {   //monnitor ground collision
            this.velocity.y *= friction; //bounce friction
            this.velocity.y = -this.velocity.y;        
        }else{
            this.position.y += this.velocity.y;
        }
    }
}

function boxColision({box1, box2}) {
  //Collision detection with ground
  const zCollission = box1.front >= box2.back && box1.back <=box2.front; //front collision
  const yCollission = box1.bottom+box1.velocity.y <= box2.top && box1.top >= box2.bottom; //back collision
  const xCollission = box1.right >= box2.left && box1.left <=box2.right; //left and right collision
  
  //console.log('z'+zCollission);
  console.log('y'+yCollission);
  //console.log('x'+xCollission);
  return zCollission && yCollission && xCollission;
}

//Ground
const ground = new Box({width: 10, height: 0.5, depth: 30, color: '#ff8c00', position: {x: 0, y: -2, z: 0}});
ground.receiveShadow = true;
scene.add(ground);

//Cube
const cube = new Box({width: 1, height: 1, depth: 1, velocity: {x: 0, y: -0.01, z: 0}});
cube.castShadow = true;
cube.position.z = -(ground.back + cube.depth / 2)-1; //position cube in front of ground
scene.add(cube);


//Light
const light = new THREE.DirectionalLight(0xffffff, 2.5);
light.position.x = 2;
light.position.y = 4;
light.position.z = 5;
light.castShadow = true;
scene.add(light);

// Configurar o shadow camera da luz direcional
light.shadow.camera.left = -15;
light.shadow.camera.right = 15;
light.shadow.camera.top = 15;
light.shadow.camera.bottom = -15;

// Aumentar a resolução do mapa de sombras para melhorar a qualidade
light.shadow.mapSize.width = 4096;
light.shadow.mapSize.height = 4096;

// Ajustar a distância máxima para calcular sombras
light.shadow.camera.near = 0.1;
light.shadow.camera.far = 100;

//Ambient Light
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

//Sky
const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);
const skyUniforms = sky.material.uniforms;
skyUniforms['turbidity'].value = 1;
skyUniforms['rayleigh'].value = .1;
skyUniforms['mieCoefficient'].value = 0.005;
skyUniforms['mieDirectionalG'].value = .8; 
const sun = new THREE.Vector3();
sun.set(light.position.x, light.position.y, light.position.z);
skyUniforms['sunPosition'].value.copy(sun);

//Camera position
camera.position.z = ground.depth * 0.32 + 10; 
camera.position.x = 0;                      
camera.position.y = ground.height * 6;      
camera.lookAt(ground.position);             

const keys = {
    a: {
        pressed: false
    },
    d: {
        pressed: false
    },
    w: {
        pressed: false
    },
    s: {
        pressed: false
    }
}

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
})

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
})

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

function animate() {
  const animationID = requestAnimationFrame(animate);
  renderer.render(scene, camera);

  //Movement code
  cube.velocity.x = 0;      //Reset velocity
  cube.velocity.z = 0;      
  if (keys.a.pressed) {
    cube.velocity.x -= 0.045;
  } else if (keys.d.pressed) {
    cube.velocity.x = 0.045;
  }
  
  if (keys.w.pressed) {
    cube.velocity.z = -0.045;
  } else if (keys.s.pressed) {
    cube.velocity.z = 0.045;
  }

  // Movimento baseado em orientação para dispositivos móveis
  if (isMobile) {
    if (Math.abs(tiltX) > 3) {  // Sensibilidade para o eixo X (esquerda/direita)
        cube.velocity.x = Math.sign(tiltX) * 0.05;
      } else {
        cube.velocity.x = 0;  
      }
    
      const adjustedTiltY = tiltY - 30; 
    
      if (Math.abs(adjustedTiltY) > 3) {  // Sensibilidade para o eixo Z (frente/trás)
        cube.velocity.z = Math.sign(adjustedTiltY) * 0.08;
      } else {
        cube.velocity.z = 0;  
      }
  }

  cube.update(ground);

  if (cube.bottom < ground.bottom - 5) { 
    alert('Game Over by Fall!'); //game over alert
    window.location.reload(); 
    cancelAnimationFrame(animationID);
  }

  enemies.forEach(enemy => {
    enemy.update(ground)
    if(boxColision({box1: cube, box2: enemy})) { //check collision with enemies
      alert('Game Over by Colision!'); //game over alert
      window.location.reload(); //reload page
      cancelAnimationFrame(animationID); //stop animation
    }
  }); //update enemies

  if(frames % spawnRate === 0) { //spawn enemy every x frames
    if(spawnRate > 20) { //spawn rate decrease
      spawnRate -= 10;
    }
    const enemy = new Box({width: 1, height: 1, depth: 1, position: {x:(Math.random()-0.5)*5, y:0, z:(ground.back + cube.depth / 2)-1}, velocity: {x: 0, y: 0, z: 0.005}, color: 'red', zAcceleration: true});
    enemy.castShadow = true;
    scene.add(enemy);
    enemies.push(enemy);
  }

  frames++;
}
animate();