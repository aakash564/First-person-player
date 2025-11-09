import * as THREE from "three";
import { PlayerControls } from "./controls.js";

// Random colors for player avatars - pastel colors
const COLORS = [
  "#FF9AA2", // Pastel red
  "#FFB7B2", // Pastel salmon
  "#FFDAC1", // Pastel orange
  "#E2F0CB", // Pastel green
  "#B5EAD7", // Pastel mint
  "#C7CEEA", // Pastel blue
  "#F2D5F8", // Pastel purple
  "#FDFFB6"  // Pastel yellow
];

// Simple seeded random number generator
class MathRandom {
  constructor(seed) {
    this.seed = seed;
  }
  
  random() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }
}

async function main() {
  // Get username from Websim API if available, otherwise generate random name
  let playerName = `Player${Math.floor(Math.random() * 1000)}`;
  
  try {
    const user = await window.websim?.getUser();
    if (user && user.username) {
      playerName = user.username;
    }
  } catch (error) {
    console.log("Could not get websim user, using random name");
  }
  
  // Generate random HSL color for this player
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70 + Math.floor(Math.random() * 30); // 70-100%
  const lightness = 50 + Math.floor(Math.random() * 30); // 50-80%
  const playerColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  
  // Safe initial position values with fallbacks
  const safePlayerX = (Math.random() * 10) - 5;
  const safePlayerZ = (Math.random() * 10) - 5;

  // Initialize WebsimSocket
  const room = new WebsimSocket();
  
  // Set initial presence
  room.party.updatePresence({
    x: safePlayerX,
    y: 0.5, // Height of player (half of height)
    z: safePlayerZ,
    quaternion: [0, 0, 0, 1],
    name: playerName,
    color: playerColor
  });
  
  // Setup Three.js scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Light sky blue background
  
  // Create barriers and walls
  function createBarriers() {
    // Use a deterministic random number generator based on a fixed seed
    const barrierSeed = 12345; // Fixed seed for deterministic generation
    let rng = new MathRandom(barrierSeed);
    
    // Wall material
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x888888,
      roughness: 0.7,
      metalness: 0.2
    });
    
    // Create some random barriers
    for (let i = 0; i < 15; i++) {
      const width = 1 + rng.random() * 3;
      const height = 1 + rng.random() * 3;
      const depth = 1 + rng.random() * 3;
      
      const wallGeometry = new THREE.BoxGeometry(width, height, depth);
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      
      // Random position, but not too close to center
      const angle = rng.random() * Math.PI * 2;
      const distance = 5 + rng.random() * 15;
      wall.position.x = Math.cos(angle) * distance;
      wall.position.z = Math.sin(angle) * distance;
      wall.position.y = height / 2;
      
      wall.castShadow = true;
      wall.receiveShadow = true;
      wall.userData.isBarrier = true;
      
      scene.add(wall);
    }
    
    // Add some platform blocks at various heights
    for (let i = 0; i < 10; i++) {
      const platformGeo = new THREE.BoxGeometry(2, 0.5, 2);
      const platform = new THREE.Mesh(platformGeo, wallMaterial);
      
      const angle = rng.random() * Math.PI * 2;
      const distance = 5 + rng.random() * 15;
      platform.position.x = Math.cos(angle) * distance;
      platform.position.z = Math.sin(angle) * distance;
      platform.position.y = 1 + rng.random() * 3;
      
      platform.castShadow = true;
      platform.receiveShadow = true;
      platform.userData.isBlock = true;
      
      scene.add(platform);
    }
  }
  
  createBarriers();
  
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('game-container').appendChild(renderer.domElement);
  
  // Initialize player controls
  const playerControls = new PlayerControls(scene, room, {
    renderer: renderer
  });
  const camera = playerControls.getCamera();
  
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // Directional light (sun)
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -25;
  dirLight.shadow.camera.right = 25;
  dirLight.shadow.camera.top = 25;
  dirLight.shadow.camera.bottom = -25;
  scene.add(dirLight);
  
  // Ground
  const groundGeometry = new THREE.PlaneGeometry(50, 50);
  const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x55aa55,
    roughness: 0.8,
    metalness: 0.2
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2; // Rotate to horizontal
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid helper for better spatial awareness
  const gridHelper = new THREE.GridHelper(50, 50);
  scene.add(gridHelper);

  const onlineUsers = document.querySelector("#online-users");

  // Map to store player objects in the scene
  const playerObjects = new Map();

  // Function to create or update a player mesh
  function updatePlayerObject(user) {
    if (!user || !user.presence) return;
    
    const { presence, id } = user;
    
    // Additional safety check
    if (!presence || !id) return;
    
    // Ensure required presence properties exist with default values
    const safePresence = {
      x: 0,
      y: 0.5,
      color: '#FFFFFF',
      name: 'Unknown',
      quaternion: [0, 0, 0, 1],
      ...presence
    };
    
    let playerObj = playerObjects.get(id);
  
    // Create player mesh if it doesn't exist
    if (!playerObj) {
      // Don't create visible body for own player in first person
      if (id === room.party.client.id) {
        const playerGroup = new THREE.Group();
        playerGroup.userData.id = id;
        scene.add(playerGroup);
        playerObjects.set(id, playerGroup);
        playerObj = playerGroup;
      } else {
        // Create body for other players
        const bodyGeometry = new THREE.BoxGeometry(0.6, 1, 0.6);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: safePresence.color });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        
        // Head
        const headGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const headMaterial = new THREE.MeshStandardMaterial({ color: safePresence.color });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.75;
        head.castShadow = true;
        head.name = "head";

        // Eyes (now on front of head)
        const eyeGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        // Left eye
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(0.1, 0.1, -0.25); // Pulled back from -0.3 to -0.25
        
        // Right eye
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(-0.1, 0.1, -0.25); // Pulled back from -0.3 to -0.25
        
        // Eye pupils
        const pupilGeometry = new THREE.SphereGeometry(0.04, 16, 16);
        const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        
        // Left pupil
        const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        leftPupil.position.set(0.1, 0.1, -0.3); // Pulled back from -0.35 to -0.3
        
        // Right pupil
        const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        rightPupil.position.set(-0.1, 0.1, -0.3); // Pulled back from -0.35 to -0.3
        
        // Nose (updated dimensions)
        const noseGeometry = new THREE.ConeGeometry(0.08, 0.15, 4); 
        const noseMaterial = new THREE.MeshBasicMaterial({ color: safePresence.color }); 
        const nose = new THREE.Mesh(noseGeometry, noseMaterial);
        nose.rotation.x = -Math.PI / 2; // Point backward
        nose.position.set(0, 0, -0.26); // Center on back of face

        // Add eyes and nose to head
        head.add(leftEye);
        head.add(rightEye);
        head.add(leftPupil);
        head.add(rightPupil);
        head.add(nose);
        
        // Create nametag sprite
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // Draw name text
        context.font = 'bold 32px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Draw with black outline
        context.strokeStyle = 'black';
        context.lineWidth = 4;
        context.strokeText(safePresence.name, canvas.width/2, canvas.height/2);
        context.fillText(safePresence.name, canvas.width/2, canvas.height/2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const spriteMaterial = new THREE.SpriteMaterial({ 
          map: texture,
          transparent: true,
          depthTest: true,
          depthWrite: false
        });
        
        const nameSprite = new THREE.Sprite(spriteMaterial);
        nameSprite.scale.set(2, 0.5, 1);
        nameSprite.position.y = 2; // Position above head
        nameSprite.name = "nameTag";
        
        // Group all parts together
        const playerGroup = new THREE.Group();
        playerGroup.userData.id = id;
        playerGroup.add(body);
        playerGroup.add(head);
        playerGroup.add(nameSprite);
        
        scene.add(playerGroup);
        playerObjects.set(id, playerGroup);
        playerObj = playerGroup;
      }
    }

    // Update name if it changed
    if (playerObj && id !== room.party.client.id) {
      const nameTag = playerObj.getObjectByName("nameTag");
      if (nameTag && nameTag.material.map) {
        const currentName = safePresence.name;
        const canvas = nameTag.material.map.image;
        const context = canvas.getContext('2d');
        
        // Only update if name changed
        if (!nameTag.userData || !nameTag.userData.currentName || nameTag.userData.currentName !== currentName) {
          // Clear canvas
          context.clearRect(0, 0, canvas.width, canvas.height);
          
          // Redraw name
          context.font = 'bold 32px Arial';
          context.fillStyle = 'white';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          
          context.strokeStyle = 'black';
          context.lineWidth = 4;
          context.strokeText(currentName, canvas.width/2, canvas.height/2);
          context.fillText(currentName, canvas.width/2, canvas.height/2);
          
          nameTag.material.map.needsUpdate = true;
          nameTag.userData = nameTag.userData || {};
          nameTag.userData.currentName = currentName;
        }
      }
    }

    // Update player position and rotation
    if (playerObj) {
      playerObj.position.set(safePresence.x, safePresence.y, safePresence.z);
      
      if (safePresence.quaternion) {
        playerObj.quaternion.fromArray(safePresence.quaternion);
      }
      
      // Make nametag always face camera
      const nameTag = playerObj.getObjectByName("nameTag");
      if (nameTag) {
        nameTag.quaternion.copy(camera.quaternion);
      }
    }
  }

  // Remove disconnected players
  function removePlayerObject(connectionId) {
    const playerObj = playerObjects.get(connectionId);
    if (playerObj) {
      scene.remove(playerObj);
      playerObjects.delete(connectionId);
    }
  }

  // Subscribe to presence changes
  room.party.subscribePresence((presence) => {
    // Handle presence updates and create/update players
    Object.keys(presence).forEach(clientId => {
      // Always update non-self players to catch name changes
      if (clientId !== room.party.client.id && presence[clientId]) {
        updatePlayerObject({
          id: clientId,
          presence: presence[clientId]
        });
      }
    });
    
    // Remove players whose presence is no longer available
    playerObjects.forEach((obj, connectionId) => {
      if (connectionId !== room.party.client.id && !presence[connectionId]) {
        removePlayerObject(connectionId);
      }
    });
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    
    playerControls.update();
    
    renderer.render(scene, camera);
  }

  animate();
}

main();
