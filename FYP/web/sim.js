let scene, camera, renderer;
let sceneObjects = [];

// ----------------- MOVEMENT -----------------
let move = { forward: false, backward: false, left: false, right: false };
let yaw = 0;
let pitch = 0;
const sensitivity = 0.002;
const speed = 0.1;

// ----------------- PROMPT -----------------
const prompt = sessionStorage.getItem("prompt");

document.getElementById("promptLabel").innerText =
  "Prompt: " + (prompt || "none");

function addSky() {
  const skyGeo = new THREE.SphereGeometry(500, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x87CEEB) },   // sky blue
      bottomColor: { value: new THREE.Color(0xFFFFFF) },
      offset: { value: 33 },
      exponent: { value: 0.6 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(
          mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)),
          1.0
        );
      }
    `
  });

  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
}



// ----------------- TEMPLATES -----------------
const templates = {
  house: (() => {
    const p = [];
    const w = 8, h = 4, d = 6;

    for (let y = 0; y < h; y++) {
      for (let x = -w; x <= w; x++) {
        p.push({ x, y: 0.5 + y, z: -d });
      }
      for (let z = -d; z <= d; z++) {
        p.push({ x: -w, y: 0.5 + y, z });
        p.push({ x: w, y: 0.5 + y, z });
      }
    }

    for (let x = -w; x <= w; x++) {
      for (let z = -d; z <= d; z++) {
        p.push({ x, y: h + 0.5, z });
      }
    }

    return p;
  })(),

  // 🗼 TOWER
  tower: (() => {
    const p = [];
    const radius = 3;
    const height = 10;

    for (let y = 0; y < height; y++) {
      for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
          if (x * x + z * z <= radius * radius) {
            p.push({ x, y: y + 0.5, z });
          }
        }
      }
    }
    return p;
  })(),

  // 🧱 WALL
  wall: (() => {
    const p = [];
    const length = 20;
    const height = 3;

    for (let x = -length / 2; x <= length / 2; x++) {
      for (let y = 0; y < height; y++) {
        p.push({ x, y: y + 0.5, z: 0 });
      }
    }
    return p;
  })(),

  // 🌉 BRIDGE
  bridge: (() => {
    const p = [];
    const length = 15;
    const width = 3;

    for (let x = -length / 2; x <= length / 2; x++) {
      for (let z = -width; z <= width; z++) {
        p.push({ x, y: 0.5, z });
      }
    }

    // rails
    for (let x = -length / 2; x <= length / 2; x++) {
      p.push({ x, y: 1.5, z: -width - 1 });
      p.push({ x, y: 1.5, z: width + 1 });
    }

    return p;
  })(),

  // 🧩 ROOM (CLOSED CUBE)
  room: (() => {
    const p = [];
    const size = 6;
    const h = 4;

    for (let y = 0; y < h; y++) {
      for (let x = -size; x <= size; x++) {
        p.push({ x, y: y + 0.5, z: -size });
        p.push({ x, y: y + 0.5, z: size });
      }
      for (let z = -size; z <= size; z++) {
        p.push({ x: -size, y: y + 0.5, z });
        p.push({ x: size, y: y + 0.5, z });
      }
    }

    // ceiling
    for (let x = -size; x <= size; x++) {
      for (let z = -size; z <= size; z++) {
        p.push({ x, y: h + 0.5, z });
      }
    }

    return p;
  })(),

  // 🏙️ CITY BLOCK
  city: (() => {
    const p = [];
    const buildings = 6;

    for (let i = 0; i < buildings; i++) {
      const bx = (i % 3) * 10 - 10;
      const bz = Math.floor(i / 3) * 10 - 5;
      const h = Math.floor(Math.random() * 6) + 3;

      for (let y = 0; y < h; y++) {
        for (let x = -2; x <= 2; x++) {
          for (let z = -2; z <= 2; z++) {
            p.push({ x: bx + x, y: y + 0.5, z: bz + z });
          }
        }
      }
    }

    return p;
  })(),

  maze: [
    {x:-2,y:0.5,z:-2},{x:-1,y:0.5,z:-2},{x:0,y:0.5,z:-2},
    {x:-2,y:1.5,z:-2},{x:0,y:1.5,z:-2}
  ]
};


// ----------------- INIT -----------------
init();
animate();

function init() {
  scene = new THREE.Scene();
  addSky();
  //scene.background = new THREE.Color(0x202020);

  camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(0, 1.8, 8);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  // Enable focus & pointer lock
  renderer.domElement.setAttribute("tabindex", "0");
  renderer.domElement.focus();
  renderer.domElement.addEventListener("click", () => {
    renderer.domElement.requestPointerLock();
    renderer.domElement.focus();
  });

  // Input
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  document.addEventListener("mousemove", onMouseMove);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x228B22 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const d = new THREE.DirectionalLight(0xffffff, 1);
  d.position.set(5, 10, 5);
  scene.add(d);

  generateFromPrompt();
}

// ----------------- INPUT -----------------
function onKeyDown(e) {
  if (e.code === "KeyW") move.forward = true;
  if (e.code === "KeyS") move.backward = true;
  if (e.code === "KeyA") move.left = true;
  if (e.code === "KeyD") move.right = true;
}

function onKeyUp(e) {
  if (e.code === "KeyW") move.forward = false;
  if (e.code === "KeyS") move.backward = false;
  if (e.code === "KeyA") move.left = false;
  if (e.code === "KeyD") move.right = false;
}

function onMouseMove(e) {
  if (document.pointerLockElement !== renderer.domElement) return;

  yaw -= e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;
  pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
}

// ----------------- PROMPT SPAWN -----------------
function generateFromPrompt() {
  const list = templates[prompt];
  if (!list) return;

  list.forEach(pos => {
    const obj = {
      type: "cube",
      color: 0xffffff * Math.random(),
      position: pos
    };
    sceneObjects.push(obj);
    spawnCube(obj);
  });
}

function spawnCube(o) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ color: o.color })
  );
  m.position.set(o.position.x, o.position.y, o.position.z);
  scene.add(m);
}

// ----------------- DOWNLOAD -----------------
function downloadScene() {
  const data =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(sceneObjects, null, 2));

  const a = document.createElement("a");
  a.href = data;
  a.download = "scene.json";
  a.click();
}

// ----------------- LOOP -----------------
function animate() {
  requestAnimationFrame(animate);

  // Apply rotation
  camera.rotation.set(pitch, yaw, 0);

  // Movement vectors
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3();
  right.crossVectors(forward, camera.up).normalize();

  if (move.forward) camera.position.add(forward.clone().multiplyScalar(speed));
  if (move.backward) camera.position.add(forward.clone().multiplyScalar(-speed));
  if (move.left) camera.position.add(right.clone().multiplyScalar(-speed));
  if (move.right) camera.position.add(right.clone().multiplyScalar(speed));

  renderer.render(scene, camera);
}
