let scene, camera, renderer;
let sceneObjects = [];

// Movement
let move = { forward: false, backward: false, left: false, right: false };
let yaw = 0;   // horizontal rotation
let pitch = 0; // vertical rotation
let sensitivity = 0.002;

// Jump & gravity
let velocityY = 0;
let onGround = true;
const gravity = -0.01;
const jumpStrength = 0.25;
const playerHeight = 1; // camera height from ground

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

init();
animate();

function init() {
    scene = new THREE.Scene();
    addSky();
    //scene.background = new THREE.Color(0x202020);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, playerHeight, 6);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    addDefaultGroundAndLights();

    // Keyboard
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Mouse
    window.addEventListener("mousemove", onMouseMove);

    // Pointer lock
    renderer.domElement.addEventListener("click", () => {
        renderer.domElement.requestPointerLock();
    });
}

function addDefaultGroundAndLights() {
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(50, 50),
        new THREE.MeshStandardMaterial({ color: 0x228B22 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(5, 10, 5);
    scene.add(directional);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    addSky();
}

// Keyboard
function onKeyDown(e) {
    if (e.code === "KeyW") move.forward = true;
    if (e.code === "KeyS") move.backward = true;
    if (e.code === "KeyA") move.left = true;
    if (e.code === "KeyD") move.right = true;
    if (e.code === "Space" && onGround) {
        velocityY = jumpStrength;
        onGround = false;
    }
}

function onKeyUp(e) {
    if (e.code === "KeyW") move.forward = false;
    if (e.code === "KeyS") move.backward = false;
    if (e.code === "KeyA") move.left = false;
    if (e.code === "KeyD") move.right = false;
}

// Mouse look
function onMouseMove(e) {
    if (document.pointerLockElement !== renderer.domElement) return;

    yaw -= e.movementX * sensitivity;
    pitch -= e.movementY * sensitivity;
    pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
}

// Add cube
function addCube() {
    const cube = {
        type: "cube",
        color: Math.random() * 0xffffff,
        position: {
            x: Math.random() * 10 - 5,
            y: 0.5,
            z: Math.random() * 10 - 5
        }
    };
    sceneObjects.push(cube);
    renderCube(cube);
}

// Render cube
function renderCube(obj) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial({ color: obj.color })
    );
    mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
    scene.add(mesh);
}

// Load scene JSON
async function loadScene() {
    const data = await window.electronAPI.openJSON();
    if (!data) return;

    const loadedObjects = JSON.parse(data);

    while (scene.children.length > 0) scene.remove(scene.children[0]);
    addDefaultGroundAndLights();

    sceneObjects = loadedObjects;

    loadedObjects.forEach(obj => {
        if (obj.type === "cube") renderCube(obj);
    });
}

// --- Collision detection ---
function checkCollision(newPos) {
    const radius = 0.3; // Camera "hitbox" radius
    for (let obj of sceneObjects) {
        if (obj.type === "cube") {
            const dx = newPos.x - obj.position.x;
            const dz = newPos.z - obj.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < 0.5 + radius) { // 0.5 = half cube size
                return true;
            }
        }
    }
    // Ground collision
    if (newPos.y < playerHeight) return true;

    return false;
}

// FPS Animation
function animate() {
    requestAnimationFrame(animate);

    // Camera direction vectors
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0; // ignore vertical pitch for horizontal movement
    direction.normalize();

    // Right vector
    const right = new THREE.Vector3();
    right.crossVectors(direction, camera.up).normalize();

    const speed = 0.1;

    // --- Horizontal movement ---
    const horizontalMove = new THREE.Vector3();

    if (move.forward) horizontalMove.add(direction.clone().multiplyScalar(speed));
    if (move.backward) horizontalMove.add(direction.clone().multiplyScalar(-speed));
    if (move.left) horizontalMove.add(right.clone().multiplyScalar(-speed));
    if (move.right) horizontalMove.add(right.clone().multiplyScalar(speed));

    const nextPos = camera.position.clone();
    nextPos.x += horizontalMove.x;
    nextPos.z += horizontalMove.z;

    if (!checkCollision({ x: nextPos.x, y: camera.position.y, z: nextPos.z })) {
        camera.position.x = nextPos.x;
        camera.position.z = nextPos.z;
    }

    // --- Vertical movement (gravity & jump) ---
    if (!onGround) {
        velocityY += gravity;
        const nextY = camera.position.y + velocityY;

        if (!checkCollision({ x: camera.position.x, y: nextY, z: camera.position.z })) {
            camera.position.y = nextY;
        } else {
            if (velocityY < 0) { // falling
                camera.position.y = playerHeight;
                onGround = true;
            }
            velocityY = 0;
        }
    }

    // Apply rotation
    camera.rotation.set(pitch, yaw, 0);

    renderer.render(scene, camera);
}
