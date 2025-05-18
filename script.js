import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getDatabase, ref, push, set, get, child } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';
import { onValue } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

controls.addEventListener('change', () => {
  // Limita a altura mínima da câmara ao nível do topo do chão
  if (camera.position.y < ground.top + 0.5) {
    camera.position.y = ground.top + 0.5;
    controls.update();
  }
});

let score = 0;
let scoreInterval;
let gameRunning = true;
let inMainMenu = true; 
let player1Cube; 
let player2Cube; 
let keysPlayer1; 
let keysPlayer2; 

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
  depth: 50, 
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

// Configuração dos obstaculos
const obstacleModels = [
  '/assets/obstacle1.glb',
  '/assets/obstacle2.glb',
];

// Array de scales (um para cada modelo, na mesma ordem)
const obstacleScales = [
  { x: 2, y: 2, z: 1.5 }, // obstacle1.glb
  { x: 0.008, y: 0.013, z: 0.008 }, // obstacle2.glb
];

// PRÉ-CARREGAMENTO DOS MODELOS
const loadedObstacleModels = [];
const gltfLoader = new GLTFLoader();
let obstaclesLoaded = false;

Promise.all(obstacleModels.map((url, i) =>
  new Promise((resolve) => {
    gltfLoader.load(url, (gltf) => {
      loadedObstacleModels[i] = gltf.scene;
      resolve();
    });
  })
)).then(() => {
  obstaclesLoaded = true;
});

// Configuração da câmara
const cameraPositions = [
  { position: new THREE.Vector3(0, ground.height * 6, ground.depth * 0.32 + 13), lookAt: ground.position.clone() },
  { position: new THREE.Vector3(10, ground.height * 10, -(ground.back-5)), lookAt: ground.position.clone() },
  { position: new THREE.Vector3(-10, ground.height * 10, -(ground.back-5)), lookAt: ground.position.clone() },
  { position: new THREE.Vector3(0, ground.height *65, 0), lookAt: ground.position.clone()}
];

let currentCameraIndex = 0;

function setCameraPosition(index) {
  const camPos = cameraPositions[index];
  camera.position.copy(camPos.position);
  if (camera.position.y < ground.top + 0.1) {
    camera.position.y = ground.top + 0.1;
  }
  camera.lookAt(camPos.lookAt);
}

setCameraPosition(currentCameraIndex);

// Troca de câmara
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'v'|| 'V') {
  }
  if (event.key.toLowerCase() === 'v' && !window.inMainMenu) {
    currentCameraIndex = (currentCameraIndex + 1) % cameraPositions.length;
    setCameraPosition(currentCameraIndex);
  }
});

const keys = {
  a: { pressed: false },
  d: { pressed: false },
  w: { pressed: false },
  s: { pressed: false }
};

window.addEventListener('keydown', (event) => {
  if (inMainMenu) return; 

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
  if (inMainMenu) return; 

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
      playJumpSound(); 
      cube.velocity.y = 0.1;
      cube.canJump = false;
    }
  });
}

function endGame(player, message) {
  gameRunning = false; // Certificar que o jogo para
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
  enemySpeed = 0.005;
  gameRunning = true;
  isPaused = false;

  // Limpar inimigos existentes
  enemies.forEach(enemyObj => {
    scene.remove(enemyObj.model);
    scene.remove(enemyObj.box);
  });
  enemies.length = 0;

  // Verificar se está no modo multiplayer
  if (typeof player1Cube !== 'undefined' && typeof player2Cube !== 'undefined') {
    // Remover o cubo do Player 1
    if (player1Cube) {
      scene.remove(player1Cube);
      player1Cube = null;
    }

    // Remover o cubo do Player 2
    if (player2Cube) {
      scene.remove(player2Cube);
      player2Cube = null;
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

  setCameraPosition(0); // Voltar à câmara padrão

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
  resumeGame();
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

    // Atualiza a posição do modelo 3D
  if (cubeModel && cube) {
    cubeModel.position.copy(cube.position);
  }

  if (cube.bottom < ground.top - 5 || cube.top <= ground.top) {
    endGame("You", "fell!");
    cancelAnimationFrame(animationID);
    return;
  }

  enemies.forEach((enemyObj, index) => {
    // Atualiza o box invisível
    enemyObj.box.update(ground);
    // Move o modelo 3D para a posição do box
    enemyObj.model.position.copy(enemyObj.box.position);

    if (boxColision({ box1: cube, box2: enemyObj.box })) {
      endGame("You", "have collided!");
      cancelAnimationFrame(animationID);
    }

    // Remover inimigos fora do alcance
    if (enemyObj.box.position.z > ground.front) {
      scene.remove(enemyObj.model);
      scene.remove(enemyObj.box);
      enemies.splice(index, 1);
    }
  });

  if (frames % spawnRate === 0) {
    if (spawnRate > 25) spawnRate -= 10;
    spawnObstacle();
  }
  frames++;
}

function spawnObstacle() {
  if (!obstaclesLoaded) return; // Garante que só spawna após carregar

  const maxTries = 10;
  let tries = 0;
  let validPosition = false;
  let spawnX, spawnZ;

  while (!validPosition && tries < maxTries) {
    spawnX = (Math.random() * (ground.right - ground.left)) + ground.left;
    spawnZ = ground.back + 1.8 / 2 - 1;

    validPosition = true;
    for (const enemy of enemies) {
      const dx = Math.abs(enemy.box.position.x - spawnX);
      const dz = Math.abs(enemy.box.position.z - spawnZ);
      if (dx < 2 && dz < 2) {
        validPosition = false;
        break;
      }
    }
    tries++;
  }

  if (validPosition) {
    const randomIndex = Math.floor(Math.random() * loadedObstacleModels.length);
    const scale = obstacleScales[randomIndex];

    const obstacle = loadedObstacleModels[randomIndex].clone(true);
    obstacle.scale.set(scale.x, scale.y, scale.z);
    obstacle.rotation.y = Math.PI / 2;
    scene.add(obstacle);

    const box3 = new THREE.Box3().setFromObject(obstacle);
    const modelBaseY = box3.min.y;
    const yOffset = ground.top - modelBaseY;

    obstacle.position.set(
      spawnX,
      yOffset,
      spawnZ
    );

    const box = new Box({
      width: 1,
      height: 1,
      depth: 1,
      position: { x: obstacle.position.x, y: obstacle.position.y, z: obstacle.position.z },
      velocity: { x: 0, y: 0, z: enemySpeed },
      color: 'red',
      zAcceleration: true
    });
    box.visible = false;
    scene.add(box);

    obstacle.userData.box = box;
    enemies.push({ model: obstacle, box: box });

    enemySpeed += 0.0008;
  }
}

let cube;
let cubeModel; // NOVO: referência ao modelo 3D do singleplayer

function startSinglePlayerGame() {
  // Criar o cubo invisível para lógica e colisão
  cube = new Box({
    width: 2,
    height: 1,
    depth: 1,
    velocity: { x: 0, y: -0.01, z: 0 },
    position: { x: 0, y: 3, z: -(ground.back + 2) }
  });
  cube.castShadow = true;
  cube.visible = false; // Torna o cubo invisível
  scene.add(cube);

  // Carregar o modelo 3D
  const loader = new GLTFLoader();
  loader.load('/assets/hat_cube.glb', function(gltf) {
    // Remove modelo antigo se existir
    if (cubeModel) {
      scene.remove(cubeModel);
      cubeModel = null;
    }
    cubeModel = gltf.scene;
    cubeModel.position.copy(cube.position);
    cubeModel.scale.set(0.5, 0.5, 0.5); // Ajusta o tamanho
    cubeModel.rotation.y = Math.PI;      // Roda 180 graus
    scene.add(cubeModel);

    // Inicializar o jogo só depois do modelo estar carregado
    animate();
  });
}

let player1Model; // Referência ao modelo 3D do player 1
let player2Model; // Referência ao modelo 3D do player 2
let player1Loaded = false;
let player2Loaded = false;

function setupMultiplayer() {
  const loader = new GLTFLoader();

  // Player 1
  loader.load('/assets/hat_cube.glb', function(gltf) {
    if (player1Model) {
      scene.remove(player1Model);
      player1Model = null;
    }
    player1Model = gltf.scene;
    player1Model.scale.set(0.5, 0.5, 0.5);
    player1Model.rotation.y = Math.PI;

    // Calcula o bounding box do modelo já com o scale
    scene.add(player1Model); // Adiciona temporariamente para calcular
    const box3 = new THREE.Box3().setFromObject(player1Model);
    const modelBaseY = box3.min.y;
    const yOffset = ground.top - modelBaseY;

    // Define a posição correta
    player1Model.position.set(-2, yOffset, -(ground.back + 2));
    // Se quiseres, podes remover e adicionar de novo, mas não é obrigatório

    player1Cube = new Box({
      width: 2,
      height: 1,
      depth: 1,
      color: '#00ff00',
      velocity: { x: 0, y: -0.01, z: 0 },
      position: { x: -2, y: 3, z: -(ground.back + 2) }
    });
    player1Cube.visible = false;
    scene.add(player1Cube);

    player1Loaded = true;
    startIfBothLoaded();
  });

  // Player 2
  loader.load('/assets/hat_cube.glb', function(gltf) {
    if (player2Model) {
      scene.remove(player2Model);
      player2Model = null;
    }
    player2Model = gltf.scene;
    player2Model.scale.set(0.5, 0.5, 0.5);
    player2Model.rotation.y = Math.PI;

    scene.add(player2Model);
    const box3 = new THREE.Box3().setFromObject(player2Model);
    const modelBaseY = box3.min.y;
    const yOffset = ground.top - modelBaseY;

    player2Model.position.set(2, yOffset, -(ground.back + 2));

    player2Cube = new Box({
      width: 1.8,
      height: 1,
      depth: 1,
      color: '#ffff00',
      velocity: { x: 0, y: -0.01, z: 0 },
      position: { x: 2, y: 3, z: -(ground.back + 2) }
    });
    player2Cube.visible = false;
    scene.add(player2Cube);

    player2Loaded = true;
    startIfBothLoaded();
  });

  function startIfBothLoaded() {
    if (player1Loaded && player2Loaded) {
      animateMultiplayer();
    }
  }

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
      playJumpSound(); // Adiciona o som de salto para o Player 1
      player1Cube.velocity.y = 0.1;
      player1Cube.canJump = false;
    }

    if (event.key === "ArrowLeft") keysPlayer2.ArrowLeft.pressed = true;
    if (event.key === "ArrowRight") keysPlayer2.ArrowRight.pressed = true;
    if (event.key === "ArrowUp") keysPlayer2.ArrowUp.pressed = true;
    if (event.key === "ArrowDown") keysPlayer2.ArrowDown.pressed = true;
    if (event.key === "p" && player2Cube.canJump) {
      playJumpSound(); // Adiciona o som de salto para o Player 1
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
}

function animateMultiplayer() {
    if (!gameRunning || isPaused) return;

    player1Cube.velocity.x = 0;
    player1Cube.velocity.z = 0;
    if (keysPlayer1.a.pressed) player1Cube.velocity.x -= 0.045;
    if (keysPlayer1.d.pressed) player1Cube.velocity.x += 0.045;
    if (keysPlayer1.w.pressed) player1Cube.velocity.z = -0.045;
    if (keysPlayer1.s.pressed) player1Cube.velocity.z = 0.045;
    player1Cube.update(ground);

    if (player1Model && player1Cube) {
    player1Model.position.copy(player1Cube.position);
    }
    if (player2Model && player2Cube) {
      player2Model.position.copy(player2Cube.position);
    }

    player2Cube.velocity.x = 0;
    player2Cube.velocity.z = 0;
    if (keysPlayer2.ArrowLeft.pressed) player2Cube.velocity.x -= 0.045;
    if (keysPlayer2.ArrowRight.pressed) player2Cube.velocity.x += 0.045;
    if (keysPlayer2.ArrowUp.pressed) player2Cube.velocity.z = -0.045;
    if (keysPlayer2.ArrowDown.pressed) player2Cube.velocity.z = 0.045;
    player2Cube.update(ground);

    if (player1Model && player1Cube) {
      player1Model.position.copy(player1Cube.position);
    }

    // Spawn de inimigos
    if (frames % spawnRate === 0) {
      if (spawnRate > 25) spawnRate -= 10;
      spawnObstacleMultiplayer();
    }


    // Atualizar inimigos
    enemies.forEach((enemyObj, index) => {
      enemyObj.box.update(ground);
      enemyObj.model.position.copy(enemyObj.box.position);

      if (boxColision({ box1: player1Cube, box2: enemyObj.box })) {
        endGame("Player 1", "has colided!");
        cancelAnimationFrame(animationID);
        return;
      }

      if (boxColision({ box1: player2Cube, box2: enemyObj.box })) {
        endGame("Player 2", "has colided!");
        cancelAnimationFrame(animationID);
        return;
      }

      if (player1Cube.bottom < ground.top - 5 || player1Cube.top <= ground.top) {
        endGame("Player 1", "fell!");
        cancelAnimationFrame(animationID);
        return;
      }

      if (player2Cube.bottom < ground.top - 5 || player2Cube.top <= ground.top) {
        endGame("Player 2", "fell!");
        cancelAnimationFrame(animationID);
        return;
      }

      if (enemyObj.box.position.z > ground.front) {
        scene.remove(enemyObj.model);
        scene.remove(enemyObj.box);
        enemies.splice(index, 1);
      }
    });

    frames++;

    renderer.render(scene, camera);
    requestAnimationFrame(animateMultiplayer);
}

function spawnObstacleMultiplayer() {
  if (!obstaclesLoaded) return;

  const maxTries = 10;
  let tries = 0;
  let validPosition = false;
  let spawnX, spawnZ;

  while (!validPosition && tries < maxTries) {
    spawnX = (Math.random() * (ground.right - ground.left)) + ground.left;
    spawnZ = ground.back + 1.8 / 2 - 1;

    validPosition = true;
    for (const enemy of enemies) {
      const dx = Math.abs(enemy.box.position.x - spawnX);
      const dz = Math.abs(enemy.box.position.z - spawnZ);
      if (dx < 2 && dz < 2) {
        validPosition = false;
        break;
      }
    }
    tries++;
  }

  if (validPosition) {
    const randomIndex = Math.floor(Math.random() * loadedObstacleModels.length);
    const scale = obstacleScales[randomIndex];

    const obstacle = loadedObstacleModels[randomIndex].clone(true);
    obstacle.scale.set(scale.x, scale.y, scale.z);
    obstacle.rotation.y = Math.PI / 2;
    scene.add(obstacle);

    const box3 = new THREE.Box3().setFromObject(obstacle);
    const modelBaseY = box3.min.y;
    const yOffset = ground.top - modelBaseY;

    obstacle.position.set(spawnX, yOffset, spawnZ);

    const box = new Box({
      width: 1,
      height: 1,
      depth: 1,
      position: { x: obstacle.position.x, y: obstacle.position.y, z: obstacle.position.z },
      velocity: { x: 0, y: 0, z: enemySpeed },
      color: 'red',
      zAcceleration: true
    });
    box.visible = false;
    scene.add(box);

    obstacle.userData.box = box;
    enemies.push({ model: obstacle, box: box });

    enemySpeed += 0.0008;
  }
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
  localStorage.setItem('menuMusicVolume', volumeSlider.value);

  if (menuMusic.volume === 0) {
    muteButton.textContent = '🔇';
    menuMusic.pause();
  } else {
    muteButton.textContent = '🔊';
    playMenuMusic(); // <-- Toca a música se o volume for maior que 0
  }
});

// Alternar mute ao clicar no botão
let lastVolume = 0.2; // valor padrão ao tirar mute

muteButton.addEventListener('click', () => {
  if (menuMusic.volume > 0) {
    lastVolume = menuMusic.volume; // guarda o volume antes de mutar
    menuMusic.volume = 0;
    volumeSlider.value = 0;
    muteButton.textContent = '🔇';
    menuMusic.pause();
  } else {
    menuMusic.volume = lastVolume;
    volumeSlider.value = lastVolume;
    muteButton.textContent = '🔊';
    playMenuMusic();
    localStorage.setItem('menuMusicVolume', lastVolume);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  menuMusic.volume = 0;
  volumeSlider.value = 0;
  muteButton.textContent = '🔇';
  localStorage.setItem('menuMusicVolume', 0);
});

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

  clearInterval(scoreInterval);

  window.location.reload();
});

// Reproduzir música ao entrar no menu principal
function playMenuMusic() {
  const savedVolume = localStorage.getItem('menuMusicVolume'); // Recupera o volume salvo
  menuMusic.volume = savedVolume !== null ? savedVolume : 0.5; // Usa o volume salvo ou define o padrão como 0.5
  if (menuMusic.volume > 0) {
    menuMusic.play();
  }
}

// Pausar música ao sair do menu principal
function stopMenuMusic() {
  menuMusic.pause();
  menuMusic.currentTime = 0; // Reinicia a música
}

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