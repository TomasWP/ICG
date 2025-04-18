// TODO: Replace cube and obstacle with 3D models

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getDatabase, ref, push, set, get, child } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';
import { onValue } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";


const firebaseConfig = {
  apiKey: "AIzaSyDVggvE4QGrIgoiHxoPYTwpxWfVcdysJag",
  authDomain: "cube-runner-44bd6.firebaseapp.com",
  databaseURL: "https://cube-runner-44bd6-default-rtdb.firebaseio.com",
  projectId: "cube-runner-44bd6",
  storageBucket: "cube-runner-44bd6.firebasestorage.app",
  messagingSenderId: "625315392244",
  appId: "1:625315392244:web:038d9dbfcbfde5854b8ca1",
  measurementId: "G-BQNW7D8FCQ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const scoresRef = ref(db, 'scores');

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

let score = 0;
let scoreInterval;
let gameRunning = true;
let inMainMenu = true; 
let player1Cube; // Variável global para o cubo do jogador 1
let player2Cube; // Variável global para o cubo do jogador 2
let keysPlayer1; // Variável global para as teclas do jogador 1
let keysPlayer2; // Variável global para as teclas do jogador 2

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
    this.canJump = false;
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
      this.velocity.z += 0.0004;
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
      this.canJump = true;
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

const textureLoader = new THREE.TextureLoader();
const roadTexture = textureLoader.load('/assets/rode.jpg'); 

roadTexture.wrapS = THREE.RepeatWrapping;
roadTexture.wrapT = THREE.RepeatWrapping;

const groundMaterial = new THREE.MeshStandardMaterial({ map: roadTexture });


const ground = new Box({ 
  width: 14, 
  height: 0.5, 
  depth: 40, 
  color: '#ffffff', 
  position: { x: 0, y: -2, z: 0 }
});
ground.material = groundMaterial;
ground.receiveShadow = true;
scene.add(ground);

const light = new THREE.DirectionalLight(0xffffff, 2.5);
light.position.set(2, 4, 5);
light.castShadow = true;
scene.add(light);

light.shadow.camera.left = -20;
light.shadow.camera.right = 20;
light.shadow.camera.top = 20;
light.shadow.camera.bottom = -20;
light.shadow.mapSize.set(4096, 4096);
light.shadow.camera.near = -15;
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

camera.position.set(0, ground.height * 6, ground.depth * 0.32 + 10);
camera.lookAt(ground.position);

const keys = {
  a: { pressed: false },
  d: { pressed: false },
  w: { pressed: false },
  s: { pressed: false }
};

window.addEventListener('keydown', (event) => {
  if (inMainMenu) return; // Não faça nada se estiver no menu principal

  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      if (cube) keys.w.pressed = true; // Singleplayer
      break;
    case 'KeyA':
    case 'ArrowLeft':
      if (cube) keys.a.pressed = true; // Singleplayer
      break;
    case 'KeyD':
    case 'ArrowRight':
      if (cube) keys.d.pressed = true; // Singleplayer
      break;
    case 'KeyS':
    case 'ArrowDown':
      if (cube) keys.s.pressed = true; // Singleplayer
      break;
    case 'Space':
      if (cube && cube.canJump) { // Singleplayer
        cube.velocity.y = 0.1;
        cube.canJump = false;
      }
      break;
    case 'p':
      if (player2Cube && player2Cube.canJump) { // Multiplayer (Player 2)
        player2Cube.velocity.y = 0.1;
        player2Cube.canJump = false;
      }
      break;
  }
});

window.addEventListener('keyup', (event) => {
  if (inMainMenu) return; // Não faça nada se estiver no menu principal

  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      if (cube) keys.w.pressed = false; // Singleplayer
      break;
    case 'KeyA':
    case 'ArrowLeft':
      if (cube) keys.a.pressed = false; // Singleplayer
      break;
    case 'KeyD':
    case 'ArrowRight':
      if (cube) keys.d.pressed = false; // Singleplayer
      break;
    case 'KeyS':
    case 'ArrowDown':
      if (cube) keys.s.pressed = false; // Singleplayer
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

  window.addEventListener('touchstart', () => {
    if (cube.canJump) {
      cube.velocity.y = 0.1;
      cube.canJump = false;
    }
  });
}

function endGame(player, message) {
  gameRunning = false; // Certifique-se de que o jogo pare
  clearInterval(scoreInterval);

  const pauseTitle = document.getElementById('pause-title');
  const finalScore = document.getElementById('final-score');
  const resumeButton = document.getElementById('resume-button');
  const restartButton = document.getElementById('restart-button');
  const mainMenuButton = document.getElementById('main-menu-button');

  let isTop10 = false;

  get(scoresRef).then((snapshot) => {
    const allScores = [];
    snapshot.forEach(daySnap => {
      daySnap.forEach(countrySnap => {
        countrySnap.forEach(scoreSnap => {
          const data = scoreSnap.val();
          const scoreValue = Number(data.score); 
          if (!isNaN(scoreValue)) {
            allScores.push(scoreValue);
          }
        });
      });
    });

    const uniqueScores = [...new Set(allScores)];
    uniqueScores.sort((a, b) => b - a);
    const top10 = uniqueScores.slice(0, 10);

    const isTop10 = top10.length < 10 || score >= top10[top10.length - 1];

    saveScore(score, `Game Over! ${player} ${message}`, isTop10);

    // Tocar o som de Top 10 se o jogador entrar no Top 10
    if (isTop10) {
      playTop10Sound();
    }else{
      playGameOver(); // Tocar o som de Game Over se não entrar no Top 10
    }    

    pauseTitle.textContent = `Game Over! ${player} ${message}`; 
    finalScore.textContent = `Score: ${score}${isTop10 ? " (Top 10!)" : ""}`; 
    finalScore.style.display = 'block'; 

    resumeButton.style.display = 'none';
    restartButton.style.display = 'block';

    pauseMenu.style.display = 'flex'; 
    cancelAnimationFrame(animationID); // Interrompe o loop de animação
  }).catch((error) => {
    console.error("Erro ao obter pontuações:", error);
  });
}

function getCountryFromCacheOrAPI(callback) {
  const cachedCountry = localStorage.getItem("userCountry");

  if (cachedCountry) {
    callback(cachedCountry);
  } else {
    fetch('https://api.ipgeolocation.io/ipgeo?apiKey=1c03be3b1d0b41f793ca0587f6a1a71f') // https://ipinfo.io/json?token=325c954ece8013  https://api.ipgeolocation.io/ipgeo?apiKey=1c03be3b1d0b41f793ca0587f6a1a71f (outras opcoes)
    .then(response => response.json())
    .then(data => {
      const country = data.country_name || "Unknown";
      localStorage.setItem("userCountry", country);
      callback(country);
    })
    .catch(error => {
      console.error("Erro ao obter localização:", error);
      callback("Unknown");
    });
}
}

function saveScore(score, message, isTop10) {
  getCountryFromCacheOrAPI((country) => {
    const userAgent = navigator.userAgent.toLowerCase();
    let device = "Desktop";
    if (/mobile|android|iphone|ipad|ipod/.test(userAgent)) {
      device = "Mobile";
    } else if (/tablet/.test(userAgent)) {
      device = "Tablet";
    }

    const now = new Date();
    const options = {
      timeZone: "Europe/Lisbon",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    };
    const timestamp = now.toLocaleString("pt-PT", options)
                          .replace(/[/]/g, '-')
                          .replace(/[:]/g, '-');

    const dateOnly = timestamp.split(',')[0];
    const timeOnly = timestamp.split(',')[1].trim();

    const scoreRef = ref(db, `scores/${dateOnly}/${country}/${timeOnly}`);
    set(scoreRef, {
      timestamp: timestamp,
      device: device,
      score: score,
      message: message,
      isTop10: isTop10
    });
  });
}

let isPaused = false; 
const pauseMenu = document.getElementById('pause-menu');
const resumeButton = document.getElementById('resume-button');

function pauseGame() {
  if (!gameRunning || inMainMenu) return; 

  isPaused = true;
  pauseMenu.style.display = 'flex'; 

  document.getElementById('resume-button').style.display = 'block';
  document.getElementById('restart-button').style.display = 'block'; 
  document.getElementById('main-menu-button').style.display = 'block'; 

  cancelAnimationFrame(animationID); 
}

document.getElementById('restart-button').addEventListener('click', () => {
  // Reiniciar o jogo
  restartGame();
});

document.getElementById('main-menu-button').addEventListener('click', () => {
  window.location.reload(); 
});

function restartGame() {
  // Fechar o menu de pausa
  const pauseMenu = document.getElementById('pause-menu');
  pauseMenu.style.display = 'none';

  // Reiniciar variáveis do jogo
  score = 0;
  frames = 0;
  spawnRate = 250;
  enemySpeed = 0.005; // Redefinir a velocidade dos inimigos
  gameRunning = true;
  isPaused = false;

  // Limpar inimigos existentes
  enemies.forEach(enemy => {
    scene.remove(enemy);
  });
  enemies.length = 0;

  // Verificar se está no modo multiplayer
  if (typeof player1Cube !== 'undefined' && typeof player2Cube !== 'undefined') {
    // Remover o cubo do Player 1
    if (player1Cube) {
      scene.remove(player1Cube);
      player1Cube = null; // Opcional: redefinir a variável para evitar referências futuras
    }

    // Remover o cubo do Player 2
    if (player2Cube) {
      scene.remove(player2Cube);
      player2Cube = null; // Opcional: redefinir a variável para evitar referências futuras
    }
    // Configurar o modo multiplayer
    setupMultiplayer();

  } else if (typeof cube !== 'undefined') {
    // Resetar posição e velocidade do jogador no modo singleplayer
    cube.position.set(0, 0, -(ground.back + 2));
    cube.velocity = { x: 0, y: -0.01, z: 0 }; // Redefinir a velocidade do cubo
    cube.canJump = false;
    animate(); // Reiniciar a animação
  }

  // Redefinir a posição e a orientação da câmera
  camera.position.set(0, ground.height * 6, ground.depth * 0.32 + 10);
  camera.lookAt(ground.position);

  // Atualizar UI
  document.getElementById('score').textContent = `Score: ${score}`;

  // Reiniciar o intervalo de pontuação
  clearInterval(scoreInterval);
  scoreInterval = setInterval(() => {
    if (gameRunning && !isPaused && !inMainMenu) {
      score++;
      document.getElementById('score').textContent = `Score: ${score}`;
    }
  }, 1000);
}


document.addEventListener('visibilitychange', () => {
  if (document.hidden && !inMainMenu) {
    pauseGame(); 
  }
});

resumeButton.addEventListener('click', () => {
  resumeGame(); // Chama a função para retomar o jogo
});

document.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') {
    if (!isPaused) {
      pauseGame(); 
    } else {
      resumeGame();
    }
  }
});


function resumeGame() {
  if (!gameRunning) return; 

  isPaused = false;
  pauseMenu.style.display = 'none';

  // Verificar se está no modo multiplayer ou singleplayer
  if (typeof player1Cube !== 'undefined' && typeof player2Cube !== 'undefined') {
    // Modo multiplayer
    animateMultiplayer();
  } else if (typeof cube !== 'undefined') {
    // Modo singleplayer
    animate();
  }
}

const enemies = [];
let frames = 0;
let spawnRate = 250;
let animationID;
let enemySpeed = 0.005; 

function animate() {
  if (isPaused || !cube) return; // Verifica se o jogo está pausado ou se o cube não foi inicializado

  animationID = requestAnimationFrame(animate);
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
  }

  cube.update(ground);

  if (cube.bottom < ground.top - 5 || cube.top <= ground.top) {
    endGame("You", "fell!");
    cancelAnimationFrame(animationID);
    return;
  }

  enemies.forEach(enemy => {
    enemy.update(ground);
    if (boxColision({ box1: cube, box2: enemy })) {
      endGame("You", "have collided!");
      cancelAnimationFrame(animationID);
    }
  });

  if (frames % spawnRate === 0) {
    if (spawnRate > 25) spawnRate -= 10;
    const enemy = new Box({
      width: 1,
      height: 1,
      depth: 1,
      position: {
        x: (Math.random() * (ground.right - ground.left)) + ground.left,
        y: 0,
        z: ground.back + cube.depth / 2 - 1
      },
      velocity: { x: 0, y: 0, z: enemySpeed },
      color: 'red',
      zAcceleration: true
    });

    enemy.castShadow = true;
    scene.add(enemy);
    enemies.push(enemy);
    enemySpeed += 0.0008;
  }

  frames++;
}

let cube; // Declare o cubo global fora do escopo para uso no singleplayer

function startSinglePlayerGame(){
  // Criar o cubo para o modo singleplayer
  cube = new Box({
    width: 1,
    height: 1,
    depth: 1,
    velocity: { x: 0, y: -0.01, z: 0 },
    position: { x: 0, y: 0, z: -(ground.back + 2) }
  });
  cube.castShadow = true;
  scene.add(cube);

  // Inicializar o jogo
  animate();
}

document.getElementById("singleplayer-button").addEventListener("click", () => {
  // Ocultar o menu inicial
  const startMenu = document.getElementById("start-menu");
  startMenu.style.display = "none";

  // Mostrar o score
  document.getElementById("score").style.display = "block";

  // Atualizar estado
  inMainMenu = false;

  startSinglePlayerGame(); // Iniciar o jogo singleplayer
});

document.getElementById("multiplayer-button").addEventListener("click", () => {
  // Ocultar o menu inicial
  const startMenu = document.getElementById("start-menu");
  startMenu.style.display = "none";

  // Mostrar o score
  document.getElementById("score").style.display = "block";

  // Atualizar estado
  inMainMenu = false;

  // Configurar o modo multiplayer
  setupMultiplayer();
});

document.getElementById("main-menu-button").addEventListener("click", () => {
  // Atualizar estado
  inMainMenu = true;
  gameRunning = false;

  // Esconder o score
  document.getElementById("score").style.display = "none";

  // Limpar o intervalo de pontuação
  clearInterval(scoreInterval);

  // Recarregar a página para reiniciar o estado
  window.location.reload();
});

function setupMultiplayer() {
  // Criar dois cubos para os jogadores
  player1Cube = new Box({
    width: 1,
    height: 1,
    depth: 1,
    color: '#00ff00', // Verde
    velocity: { x: 0, y: -0.01, z: 0 },
    position: { x: -2, y: 0, z: -(ground.back + 2) }
  });
  player1Cube.castShadow = true;
  scene.add(player1Cube);

  player2Cube = new Box({
    width: 1,
    height: 1,
    depth: 1,
    color: '#ffff00', // Amarelo
    velocity: { x: 0, y: -0.01, z: 0 },
    position: { x: 2, y: 0, z: -(ground.back + 2) }
  });
  player2Cube.castShadow = true;
  scene.add(player2Cube);

  keysPlayer1 = {
    a: { pressed: false },
    d: { pressed: false },
    w: { pressed: false },
    s: { pressed: false },
    space: { pressed: false },
  };

  keysPlayer2 = {
    ArrowLeft: { pressed: false },
    ArrowRight: { pressed: false },
    ArrowUp: { pressed: false },
    ArrowDown: { pressed: false },
    p: { pressed: false },
  };

  window.addEventListener("keydown", (event) => {
    if (event.key === "a") keysPlayer1.a.pressed = true;
    if (event.key === "d") keysPlayer1.d.pressed = true;
    if (event.key === "w") keysPlayer1.w.pressed = true;
    if (event.key === "s") keysPlayer1.s.pressed = true;
    if (event.code === "Space" && player1Cube.canJump) {
      player1Cube.velocity.y = 0.1;
      player1Cube.canJump = false;
    }

    if (event.key === "ArrowLeft") keysPlayer2.ArrowLeft.pressed = true;
    if (event.key === "ArrowRight") keysPlayer2.ArrowRight.pressed = true;
    if (event.key === "ArrowUp") keysPlayer2.ArrowUp.pressed = true;
    if (event.key === "ArrowDown") keysPlayer2.ArrowDown.pressed = true;
    if (event.key === "p" && player2Cube.canJump) {
      player2Cube.velocity.y = 0.1;
      player2Cube.canJump = false;
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "a") keysPlayer1.a.pressed = false;
    if (event.key === "d") keysPlayer1.d.pressed = false;
    if (event.key === "w") keysPlayer1.w.pressed = false;
    if (event.key === "s") keysPlayer1.s.pressed = false;

    if (event.key === "ArrowLeft") keysPlayer2.ArrowLeft.pressed = false;
    if (event.key === "ArrowRight") keysPlayer2.ArrowRight.pressed = false;
    if (event.key === "ArrowUp") keysPlayer2.ArrowUp.pressed = false;
    if (event.key === "ArrowDown") keysPlayer2.ArrowDown.pressed = false;
  });

  animateMultiplayer();
}

function animateMultiplayer() {
    if (!gameRunning || isPaused) return; // Verifica se o jogo está rodando

    player1Cube.velocity.x = 0;
    player1Cube.velocity.z = 0;
    if (keysPlayer1.a.pressed) player1Cube.velocity.x -= 0.045;
    if (keysPlayer1.d.pressed) player1Cube.velocity.x += 0.045;
    if (keysPlayer1.w.pressed) player1Cube.velocity.z = -0.045;
    if (keysPlayer1.s.pressed) player1Cube.velocity.z = 0.045;
    player1Cube.update(ground);

    player2Cube.velocity.x = 0;
    player2Cube.velocity.z = 0;
    if (keysPlayer2.ArrowLeft.pressed) player2Cube.velocity.x -= 0.045;
    if (keysPlayer2.ArrowRight.pressed) player2Cube.velocity.x += 0.045;
    if (keysPlayer2.ArrowUp.pressed) player2Cube.velocity.z = -0.045;
    if (keysPlayer2.ArrowDown.pressed) player2Cube.velocity.z = 0.045;
    player2Cube.update(ground);

    // Spawn de inimigos
    if (frames % spawnRate === 0) {
      if (spawnRate > 25) spawnRate -= 10;
      const enemy = new Box({
        width: 1,
        height: 1,
        depth: 1,
        position: {
          x: (Math.random() * (ground.right - ground.left)) + ground.left,
          y: 0,
          z: ground.back + player1Cube.depth / 2 - 1
        },
        velocity: { x: 0, y: 0, z: enemySpeed },
        color: 'red',
        zAcceleration: true
      });

      enemy.castShadow = true;
      scene.add(enemy);
      enemies.push(enemy);
      enemySpeed += 0.0008;
    }

    // Atualizar inimigos
    enemies.forEach((enemy, index) => {
      enemy.update(ground);

      // Verificar colisão com Player 1
      if (boxColision({ box1: player1Cube, box2: enemy })) {
        endGame("Player 1", "has colided!");
        cancelAnimationFrame(animationID);
        return; // Sai da função após o término do jogo
      }

      // Verificar colisão com Player 2
      if (boxColision({ box1: player2Cube, box2: enemy })) {
        endGame("Player 2", "has colided!");
        cancelAnimationFrame(animationID);
        return; // Sai da função após o término do jogo
      }

      if (player1Cube.bottom < ground.top-5 || player1Cube.top <= ground.top) {
        endGame("Player 1", "fell!");
        cancelAnimationFrame(animationID);
        return;
      }

      if (player2Cube.bottom < ground.top-5 || player2Cube.top <= ground.top) {
        endGame("Player 2", "fell!");
        cancelAnimationFrame(animationID);
        return;
      }

      // Remover inimigos fora do alcance
      if (enemy.position.z > ground.front) {
        scene.remove(enemy);
        enemies.splice(index, 1);
      }
    });

    frames++;

    renderer.render(scene, camera);
    requestAnimationFrame(animateMultiplayer);
  }

scoreInterval = setInterval(() => {
  if (gameRunning && !isPaused && !inMainMenu) {
    score++;
    document.getElementById('score').textContent = `Score: ${score}`;
  }
}, 1000);

const scoreboardButton = document.getElementById('scoreboard-button');
const scoreboardPopup = document.getElementById('scoreboard-popup');
const scoreList = document.getElementById('score-list');

scoreboardButton.addEventListener('mouseenter', () => {

  onValue(scoresRef, (snapshot) => {
    const allScores = [];
    snapshot.forEach(daySnap => {
      daySnap.forEach(countrySnap => {
        countrySnap.forEach(scoreSnap => {
          const data = scoreSnap.val();
          if (data && typeof data.score !== 'undefined') {
            const scoreValue = Number(data.score);
            if (!isNaN(scoreValue)) {
              allScores.push(scoreValue);
            }
          }
        });
      });
    });

    const uniqueScores = [...new Set(allScores)];
    uniqueScores.sort((a, b) => b - a);

    const top10 = uniqueScores.slice(0, 10);

    scoreList.innerHTML = '';
    top10.forEach((score, i) => {
      const item = document.createElement('li');
      item.textContent = `#${i + 1} - ${score} pts`;
      scoreList.appendChild(item);
    });

    scoreboardPopup.style.display = 'block';
  });
});

scoreboardButton.addEventListener('mouseleave', () => {
  scoreboardPopup.style.display = 'none';
});

scoreboardPopup.addEventListener('mouseleave', () => {
  scoreboardPopup.style.display = 'none';
});

const menuMusic = document.getElementById('menu-music');


// MUSIC


const muteButton = document.getElementById('mute-button');
const volumeSlider = document.getElementById('volume-slider');

// Atualizar o volume da música com o slider
volumeSlider.addEventListener('input', () => {
  menuMusic.volume = volumeSlider.value;
  localStorage.setItem('menuMusicVolume', volumeSlider.value); // Salva o volume no localStorage

  if (menuMusic.volume === 0) {
    muteButton.textContent = '🔇'; // Atualiza o ícone para mute
  } else {
    muteButton.textContent = '🔊'; // Atualiza o ícone para som
  }
});

// Alternar mute ao clicar no botão
muteButton.addEventListener('click', () => {
  if (menuMusic.volume > 0) {
    menuMusic.volume = 0;
    volumeSlider.value = 0;
    muteButton.textContent = '🔇'; // Atualiza o ícone para mute
  } else {
    menuMusic.volume = localStorage.getItem('menuMusicVolume') || 0.5; // Recupera o volume salvo ou define o padrão
    volumeSlider.value = menuMusic.volume;
    muteButton.textContent = '🔊'; // Atualiza o ícone para som
  }

  localStorage.setItem('menuMusicVolume', menuMusic.volume); // Salva o volume no localStorage
});

document.addEventListener('DOMContentLoaded', () => {
  const savedVolume = localStorage.getItem('menuMusicVolume'); // Recupera o volume salvo
  if (savedVolume !== null) {
    menuMusic.volume = savedVolume;
    volumeSlider.value = savedVolume;
    muteButton.textContent = savedVolume > 0 ? '🔊' : '🔇'; // Atualiza o ícone
  } else {
    menuMusic.volume = 0.5; // Define o volume padrão
    volumeSlider.value = 0.5;
  }

  if (inMainMenu) {
    playMenuMusic();
  }
});

// Reproduzir música ao entrar no menu principal
function playMenuMusic() {
  const savedVolume = localStorage.getItem('menuMusicVolume'); // Recupera o volume salvo
  menuMusic.volume = savedVolume !== null ? savedVolume : 0.5; // Usa o volume salvo ou define o padrão como 0.5
  menuMusic.play();
}

// Pausar música ao sair do menu principal
function stopMenuMusic() {
  menuMusic.pause();
  menuMusic.currentTime = 0; // Reinicia a música
}

// Iniciar música ao carregar o menu principal
document.addEventListener('DOMContentLoaded', () => {
  if (inMainMenu) {
    playMenuMusic();
  }
});

// Parar música ao iniciar o jogo
document.getElementById("singleplayer-button").addEventListener("click", () => {
  stopMenuMusic();
});

document.getElementById("multiplayer-button").addEventListener("click", () => {
  stopMenuMusic();
});

// Reproduzir música novamente ao voltar ao menu principal
document.getElementById("main-menu-button").addEventListener("click", () => {
  playMenuMusic();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopMenuMusic(); // Pausa a música quando a aba não está visível
  } else if (inMainMenu) {
    playMenuMusic(); // Retoma a música se o usuário estiver no menu principal
  }
});

const clickSound = document.getElementById('click-sound');

// Função para reproduzir o som de clique
function playClickSound() {
  clickSound.volume = 0.4; // Define o volume do som de salto (0.0 a 1.0)
  clickSound.currentTime = 0; // Reinicia o som para evitar sobreposição
  clickSound.play();
}

// Adicionar o evento de clique a todos os botões do menu
const menuButtons = document.querySelectorAll('button');
menuButtons.forEach(button => {
  button.addEventListener('click', () => {
    playClickSound();
  });
});

const jumpSound = document.getElementById('jump-sound');

// Função para reproduzir o som de salto
function playJumpSound() {
  jumpSound.volume = 0.1; // Define o volume do som de salto (0.0 a 1.0)
  jumpSound.currentTime = 0; // Reinicia o som para evitar sobreposição
  jumpSound.play();
}

// Adicione o som de salto ao evento de pulo do cubo
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && cube.canJump) {
    playJumpSound(); // Reproduz o som de salto
    cube.velocity.y = 0.1; // Lógica do salto
    cube.canJump = false;
  }
});

// Para o multiplayer (Player 2)
document.addEventListener('keydown', (event) => {
  if (event.key === 'p' && player2Cube && player2Cube.canJump) {
    playJumpSound(); // Reproduz o som de salto
    player2Cube.velocity.y = 0.1; // Lógica do salto
    player2Cube.canJump = false;
  }
});

const gameStart = document.getElementById('game-start');

// Função para reproduzir o som especial
function playGameStart() {
  gameStart.volume = 0.2; // Define o volume do som (0.0 a 1.0)
  gameStart.currentTime = 0; // Reinicia o som para evitar sobreposição
  gameStart.play();
}

// Adicionar o som especial aos botões específicos
document.getElementById("singleplayer-button").addEventListener("click", () => {
  playGameStart();
});

document.getElementById("multiplayer-button").addEventListener("click", () => {
  playGameStart();
});

document.getElementById("restart-button").addEventListener("click", () => {
  playGameStart();
});

const gameOver = document.getElementById('game-over');

// Função para reproduzir o som de "End Game"
function playGameOver() {
  gameOver.volume = 0.15; // Define o volume do som (0.0 a 1.0)
  gameOver.currentTime = 0; // Reinicia o som para evitar sobreposição
  gameOver.play();
}

const top10Sound = document.getElementById('top10-sound');

// Função para reproduzir o som de Top 10
function playTop10Sound() {
  top10Sound.volume = 0.5; // Define o volume do som (0.0 a 1.0)
  top10Sound.currentTime = 0; // Reinicia o som para evitar sobreposição
  top10Sound.play();
}