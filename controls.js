import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Movement constants
const SPEED = 0.08;
const GRAVITY = 0.01;
const JUMP_FORCE = 0.25;

export class PlayerControls {
  constructor(scene, room, options = {}) {
    this.scene = scene;
    this.room = room;
    this.camera = options.camera || new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = options.renderer;
    this.domElement = this.renderer ? this.renderer.domElement : document.body;
    
    // Player state
    this.velocity = new THREE.Vector3();
    this.canJump = true;
    this.keysPressed = new Set();
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Mobile control variables
    this.joystick = null;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchSensitivity = 0.005;
    this.moveVector = { x: 0, z: 0 };
    this.jumpButtonPressed = false;
    this.moveForward = 0;
    this.moveRight = 0;
    
    // Initial player position
    this.playerX = (Math.random() * 10) - 5;
    this.playerY = 0.5;
    this.playerZ = (Math.random() * 10) - 5;
    
    // Set initial camera position
    this.camera.position.set(this.playerX, this.playerY + 1.2, this.playerZ);
    
    // Create audio for jump sound
    this.jumpSound = new Audio('/Wood_jump3.wav.mp3');
    this.jumpSound.volume = 0.5; // Set volume to 50%
    
    // Initialize controls based on device
    this.initializeControls();
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  initializeControls() {
    if (this.isMobile) {
      this.initializeMobileControls();
    } else {
      this.initializeDesktopControls();
    }
  }
  
  initializeDesktopControls() {
    this.controls = new PointerLockControls(this.camera, this.domElement);
    
    // Add instructions for desktop
    const instructionsDiv = document.createElement("div");
    instructionsDiv.className = "instructions";
    instructionsDiv.innerHTML = "Click to lock controls. <br>Use WASD to move, Space to jump.";
    document.getElementById('game-container').appendChild(instructionsDiv);
    
    // Lock controls on click
    document.addEventListener('click', () => {
      if (!this.controls.isLocked) {
        this.controls.lock();
      }
    });
    
    // Listen for pointer lock changes
    this.controls.addEventListener('lock', () => {
      if (document.querySelector(".instructions")) {
        document.querySelector(".instructions").style.display = 'none';
      }
    });

    this.controls.addEventListener('unlock', () => {
      if (document.querySelector(".instructions")) {
        document.querySelector(".instructions").style.display = 'block';
      }
    });
    
    // Add rotation change listener to sync rotation even when not moving
    this.controls.addEventListener('change', () => {
      if (this.room) {
        this.room.party.updatePresence({ 
          quaternion: this.camera.quaternion.toArray()
        });
      }
    });
  }
  
  initializeMobileControls() {
    // Setup camera position first with safe values
    this.camera.position.set(this.playerX, 1.7, this.playerZ);
    
    // Initialize OrbitControls for camera rotation
    this.orbitControls = new OrbitControls(this.camera, this.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.enableZoom = false;
    this.orbitControls.enablePan = false;
    this.orbitControls.rotateSpeed = 0.5;
    // Remove polar angle constraints to allow full 360-degree rotation
    this.orbitControls.minPolarAngle = 0;
    this.orbitControls.maxPolarAngle = Math.PI;
    
    // Set the target in front of the camera to ensure valid orientation
    const lookDirection = new THREE.Vector3(0, 0, -1);
    lookDirection.applyQuaternion(this.camera.quaternion);
    this.orbitControls.target.set(
      this.playerX + lookDirection.x,
      1.7,
      this.playerZ + lookDirection.z
    );
    this.orbitControls.update(); // Important: update controls immediately
    
    // Add joystick container for mobile
    const joystickContainer = document.getElementById('joystick-container');
    if (!joystickContainer) {
      const newJoystickContainer = document.createElement('div');
      newJoystickContainer.id = 'joystick-container';
      document.body.appendChild(newJoystickContainer);
    }
    
    // Add jump button for mobile
    const jumpButton = document.getElementById('jump-button');
    if (!jumpButton) {
      const newJumpButton = document.createElement('div');
      newJumpButton.id = 'jump-button';
      newJumpButton.innerText = 'JUMP';
      document.body.appendChild(newJumpButton);
    }
    
    // Jump button event listeners
    document.getElementById('jump-button').addEventListener('touchstart', (event) => {
      this.jumpButtonPressed = true;
      if (this.canJump) {
        this.velocity.y = JUMP_FORCE;
        this.canJump = false;
        this.jumpSound.currentTime = 0; // Reset sound to start
        this.jumpSound.play().catch(e => console.log("Error playing sound:", e));
      }
      event.preventDefault();
    });
    
    document.getElementById('jump-button').addEventListener('touchend', (event) => {
      this.jumpButtonPressed = false;
      event.preventDefault();
    });
    
    // Initialize joystick with improved behavior
    this.joystick = nipplejs.create({
      zone: document.getElementById('joystick-container'),
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: 'rgba(255, 255, 255, 0.5)',
      size: 120
    });
    
    // Joystick move event with better movement handling
    this.joystick.on('move', (evt, data) => {
      const force = Math.min(data.force, 1); // Normalize force between 0 and 1
      const angle = data.angle.radian - Math.PI/2 + Math.PI; // Fix rotation angle
      
      // Calculate movement values using the joystick
      // Scale down by SPEED to match keyboard movement speed
      this.moveForward = -Math.cos(angle) * force * SPEED;
      this.moveRight = Math.sin(angle) * force * SPEED;
      
      console.log('Joystick move:', {
        force, 
        angle: data.angle.radian, 
        moveForward: this.moveForward, 
        moveRight: this.moveRight
      });
    });
    
    // Joystick end event
    this.joystick.on('end', () => {
      console.log('Joystick released');
      this.moveForward = 0;
      this.moveRight = 0;
    });
  }
  
  setupEventListeners() {
    // Listen for key events (for desktop controls)
    document.addEventListener("keydown", (e) => {
      this.keysPressed.add(e.key.toLowerCase());
      
      // Handle jump with spacebar
      if (e.key === " " && this.canJump) {
        this.velocity.y = JUMP_FORCE;
        this.canJump = false;
        this.jumpSound.currentTime = 0; // Reset sound to start
        this.jumpSound.play().catch(e => console.log("Error playing sound:", e));
      }
    });

    document.addEventListener("keyup", (e) => {
      this.keysPressed.delete(e.key.toLowerCase());
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      if (this.renderer) {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    });
  }
  
  processMovement() {
    if (!this.isMobile && document.pointerLockElement !== this.domElement) return;
    
    console.log('processMovement mobile:', this.isMobile, 'moveForward:', this.moveForward, 'moveRight:', this.moveRight);
    
    const presence = this.room.party.presence[this.room.party.client.id] || {};
    
    // Ensure position values exist with fallbacks
    let x = presence.x || this.playerX;
    let y = presence.y || 0.5;
    let z = presence.z || this.playerZ;
    
    // Create movement vector based on key presses or joystick
    const moveDirection = new THREE.Vector3(0, 0, 0);
    
    if (this.isMobile) {
      // Use improved joystick movement logic
      if (this.moveForward !== 0 || this.moveRight !== 0) {
        // Calculate forward direction based on camera orientation
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0; // Keep movement on the xz plane
        forward.normalize();
        
        // Calculate right direction perpendicular to forward
        const right = new THREE.Vector3(-forward.z, 0, forward.x);
        
        console.log('Mobile movement vectors:', {
          cameraDirection: forward.toArray(),
          rightVector: right.toArray(),
          moveForward: this.moveForward,
          moveRight: this.moveRight
        });
        
        // Apply movement in camera-relative directions
        moveDirection.addScaledVector(forward, this.moveForward);
        moveDirection.addScaledVector(right, this.moveRight);
      }
    } else {
      // Keyboard controls for desktop
      // Forward/backward movement
      if (this.keysPressed.has("w") || this.keysPressed.has("arrowup")) {
        moveDirection.z = 1; 
      } else if (this.keysPressed.has("s") || this.keysPressed.has("arrowdown")) {
        moveDirection.z = -1; 
      }
      
      // Left/right movement
      if (this.keysPressed.has("a") || this.keysPressed.has("arrowleft")) {
        moveDirection.x = 1; 
      } else if (this.keysPressed.has("d") || this.keysPressed.has("arrowright")) {
        moveDirection.x = -1; 
      }
    }
    
    if (!this.isMobile && moveDirection.length() > 0) {
      moveDirection.normalize();
    }
    
    // Calculate camera-based movement vectors
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; 
    cameraDirection.normalize();
    
    const rightVector = new THREE.Vector3();
    rightVector.crossVectors(this.camera.up, cameraDirection).normalize();
    
    const movement = new THREE.Vector3();
    if (!this.isMobile) {
      // Desktop movement
      if (moveDirection.z !== 0) {
        movement.add(cameraDirection.clone().multiplyScalar(moveDirection.z));
      }
      if (moveDirection.x !== 0) {
        movement.add(rightVector.clone().multiplyScalar(moveDirection.x));
      }
      
      if (movement.length() > 0) {
        movement.normalize().multiplyScalar(SPEED);
      }
    } else {
      // Mobile movement: use the joystick values directly (which already incorporate SPEED)
      movement.copy(moveDirection);
    }
    
    // Apply gravity and vertical velocity
    this.velocity.y -= GRAVITY;
    
    // Calculate new positions
    let newX = this.isMobile ? this.camera.position.x + movement.x : this.camera.position.x + movement.x;
    let newY = y + this.velocity.y;
    let newZ = this.isMobile ? this.camera.position.z + movement.z : this.camera.position.z + movement.z;
    
    // Get all blocks and barriers from the scene
    const blockMeshes = this.scene.children.filter(child => 
      child.userData.isBlock || child.userData.isBarrier);
    
    // Define collision parameters
    const playerRadius = 0.3;
    const playerHeight = 1.8;
    
    let standingOnBlock = false;
    blockMeshes.forEach(block => {
      // Get block dimensions from geometry
      const blockSize = new THREE.Vector3();
      if (block.geometry) {
        const boundingBox = new THREE.Box3().setFromObject(block);
        boundingBox.getSize(blockSize);
      } else {
        // Default size if geometry is not available
        blockSize.set(1, 1, 1);
      }

      const blockWidth = blockSize.x;
      const blockHeight = blockSize.y;
      const blockDepth = blockSize.z;
      
      // Allow jump from a block: improved block standing detection
      if (
        this.velocity.y <= 0 &&
        Math.abs(newX - block.position.x) < (blockWidth / 2 + playerRadius) &&
        Math.abs(newZ - block.position.z) < (blockDepth / 2 + playerRadius) &&
        Math.abs(y - (block.position.y + blockHeight / 2)) < 0.2 &&
        y >= block.position.y
      ) {
        standingOnBlock = true;
        newY = block.position.y + blockHeight / 2 + 0.01; // Place slightly above block
        this.velocity.y = 0;
        this.canJump = true;
      }
      // Horizontal collision detection with improved accuracy
      else if (
        Math.abs(newX - block.position.x) < (blockWidth / 2 + playerRadius) &&
        Math.abs(newZ - block.position.z) < (blockDepth / 2 + playerRadius) &&
        newY < block.position.y + blockHeight / 2 &&
        newY + playerHeight > block.position.y - blockHeight / 2
      ) {
        // Determine which side of the block was hit
        const xDist = Math.abs(this.camera.position.x - block.position.x);
        const zDist = Math.abs(this.camera.position.z - block.position.z);
        
        // Reset position based on which axis had greater movement
        if (xDist > zDist && Math.abs(movement.x) > 0) {
          newX = this.camera.position.x;
        } else if (Math.abs(movement.z) > 0) {
          newZ = this.camera.position.z;
        }
      }
    });
    
    // Ground check: keep the player on the ground unless jumping.
    if (newY <= 0.5 && !standingOnBlock) {
      newY = 0.5;
      this.velocity.y = 0;
      this.canJump = true;
    }
    
    // Only update if position changed
    if (newX !== presence.x || newY !== presence.y || newZ !== presence.z) {
      // Update camera position; add eye offset of 1.2 above player center
      this.camera.position.set(newX, newY + 1.2, newZ);
      
      if (this.isMobile && this.orbitControls) {
        // Calculate full camera direction without constraining to the xz plane
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        
        if (isNaN(cameraDirection.x) || isNaN(cameraDirection.y) || isNaN(cameraDirection.z)) {
          console.log('Invalid camera direction detected, resetting');
          cameraDirection.set(0, 0, -1);
        }
        
        cameraDirection.normalize();
        
        console.log('Mobile movement vectors:', {
          cameraPos: [newX, newY + 1.2, newZ],
          cameraDirection: cameraDirection.toArray(),
          target: [
            newX + cameraDirection.x,
            newY + 1.2 + cameraDirection.y,
            newZ + cameraDirection.z
          ]
        });
        
        this.orbitControls.target.set(
          newX + cameraDirection.x,
          newY + 1.2 + cameraDirection.y,
          newZ + cameraDirection.z
        );
      }
      
      this.room.party.updatePresence({ 
        x: newX, 
        y: newY, 
        z: newZ,
        quaternion: this.camera.quaternion.toArray()
      });
    }
    
    if (this.isMobile && this.orbitControls) {
      console.log('OrbitControls state before update:', {
        enabled: this.orbitControls.enabled,
        enableDamping: this.orbitControls.enableDamping,
        dampingFactor: this.orbitControls.dampingFactor,
        enableRotate: this.orbitControls.enableRotate
      });
      this.orbitControls.update();
    }
  }
  
  update() {
    this.processMovement();
  }
  
  getCamera() {
    return this.camera;
  }
}
