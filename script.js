// TODO: Full collision detection
// TODO: Enemy spawning
// TODO: End game scenario
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
renderer.physicallyCorrectLights = true; // Para iluminação realista
renderer.shadowMap.enabled = true;   
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

class Box extends THREE.Mesh {
    constructor({width,height,depth,color = '#00ff00', velocity = {x: 0, y: 0, z: 0}, position={x: 0, y: 0, z: 0}}) {
        super(
            new THREE.BoxGeometry(width, height, depth), 
            new THREE.MeshStandardMaterial({color})
        );
        this.width = width;
        this.height = height;
        this.depth = depth;

        this.position.set(position.x, position.y, position.z);

        this.bottom = this.position.y - (this.height / 2);
        this.top = this.position.y + (this.height / 2);

        this.velocity = velocity;
        this.gravity = -0.002;
    }

    update(ground){
        this.bottom = this.position.y - this.height / 2;
        this.top = this.position.y + this.height / 2;

        this.position.x += this.velocity.x;     //x axis movement
        this.position.z += this.velocity.z;     //z axis movement
        this.applyGravity();                    //speed of gravity
    }

    applyGravity() {                     
        this.velocity.y += this.gravity; //gravity

        if(this.bottom + this.velocity.y <= ground.top) {   //monnitor ground collision
            this.velocity.y *= 0.8; //bounce friction
            this.velocity.y = -this.velocity.y;        
        }else{
            this.position.y += this.velocity.y;
        }
    }
}

//Cube
const cube = new Box({width: 1, height: 1, depth: 1, velocity: {x: 0, y: -0.01, z: 0}});
cube.castShadow = true;
scene.add(cube);

//Ground
const ground = new Box({width: 7, height: 0.5, depth: 15, color: '#ff8c00', position: {x: 0, y: -2, z: 0}});
ground.receiveShadow = true;
scene.add(ground);

//Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.x = 3;
light.position.y = 4;
light.position.z = -3;
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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
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
camera.position.z = 10;
camera.position.x = 5;
camera.position.y = 2;
camera.lookAt(cube.position);

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
function animate() {
  requestAnimationFrame(animate);
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

  // Movimento baseado em orientação (só para dispositivos móveis)
  if (isMobile) {
    if (Math.abs(tiltX) > 2) { // Sensibilidade para o eixo X (esquerda/direita)
      cube.velocity.x = Math.sign(tiltX) * 0.045;
    }

    const adjustedTiltY = tiltY - 35; 

    if (Math.abs(adjustedTiltY) > 5) { // Sensibilidade para o eixo Z (frente/trás)
      cube.velocity.z = Math.sign(adjustedTiltY) * 0.045;
    }
  }

  cube.update(ground);
}
animate();