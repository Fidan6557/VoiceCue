import * as THREE from 'three';

export class MinecraftWorld {
  constructor(canvasElement, onInteractWithAd) {
    this.canvas = canvasElement;
    this.onInteractWithAd = onInteractWithAd || (() => {});

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // Player state
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.isLocked = false;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    // Slots & Meshes
    this.slots = new Map(); // slotId -> { mesh, canvas, ctx, texture, currentAd }
    this.interactableSlot = null;

    this.initThree();
    this.createWorld();
    this.setupControls();
    this.animate();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x78a7ff); // Minecraft sky blue
    this.scene.fog = new THREE.Fog(0x78a7ff, 25, 75);

    this.camera = new THREE.PerspectiveCamera(
      70,
      this.canvas.clientWidth / this.canvas.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.7, 5);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 0.7);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    sunLight.position.set(25, 40, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    this.scene.add(sunLight);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
  }

  // --- PROCEDURAL BLOCK TEXTURES ---

  createPixelTexture(type) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    if (type === 'grass_top') {
      ctx.fillStyle = '#5c8e32';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 200; i++) {
        const shade = rand(70, 150);
        ctx.fillStyle = `rgb(${shade - 30}, ${shade + 20}, ${shade - 50})`;
        ctx.fillRect(rand(0, size - 4), rand(0, size - 4), 4, 4);
      }
    } else if (type === 'dirt') {
      ctx.fillStyle = '#866043';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 250; i++) {
        const shade = rand(80, 140);
        ctx.fillStyle = `rgb(${shade + 20}, ${shade}, ${shade - 30})`;
        ctx.fillRect(rand(0, size - 4), rand(0, size - 4), 4, 4);
      }
    } else if (type === 'stone') {
      ctx.fillStyle = '#7a7a7a';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 280; i++) {
        const val = rand(90, 140);
        ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
        ctx.fillRect(rand(0, size - 4), rand(0, size - 4), 4, 4);
      }
    } else if (type === 'wood_plank') {
      ctx.fillStyle = '#a17849';
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 16) {
        ctx.fillStyle = '#6e4c27';
        ctx.fillRect(0, y, size, 2);
        for (let i = 0; i < 30; i++) {
          ctx.fillStyle = '#b88954';
          ctx.fillRect(rand(0, size - 4), y + rand(2, 12), 4, 2);
        }
      }
    } else if (type === 'wood_log') {
      ctx.fillStyle = '#523c28';
      ctx.fillRect(0, 0, size, size);
      for (let x = 0; x < size; x += 8) {
        ctx.fillStyle = '#3a2919';
        ctx.fillRect(x, 0, 2, size);
      }
    } else if (type === 'leaves') {
      ctx.fillStyle = '#2e6b21';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 300; i++) {
        const g = rand(80, 160);
        ctx.fillStyle = `rgb(30, ${g}, 20)`;
        ctx.fillRect(rand(0, size - 4), rand(0, size - 4), 4, 4);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  createWorld() {
    const grassTop = this.createPixelTexture('grass_top');
    const dirtTex = this.createPixelTexture('dirt');
    const stoneTex = this.createPixelTexture('stone');
    const plankTex = this.createPixelTexture('wood_plank');
    const logTex = this.createPixelTexture('wood_log');
    const leafTex = this.createPixelTexture('leaves');

    // Grass block materials
    const grassMaterials = [
      new THREE.MeshLambertMaterial({ map: dirtTex }),
      new THREE.MeshLambertMaterial({ map: dirtTex }),
      new THREE.MeshLambertMaterial({ map: grassTop }),
      new THREE.MeshLambertMaterial({ map: dirtTex }),
      new THREE.MeshLambertMaterial({ map: dirtTex }),
      new THREE.MeshLambertMaterial({ map: dirtTex })
    ];

    const stoneMat = new THREE.MeshLambertMaterial({ map: stoneTex });
    const plankMat = new THREE.MeshLambertMaterial({ map: plankTex });
    const logMat = new THREE.MeshLambertMaterial({ map: logTex });
    const leafMat = new THREE.MeshLambertMaterial({ map: leafTex, transparent: true, opacity: 0.95 });

    // 1. Terrain Ground (Voxel Grid)
    const groundGeo = new THREE.BoxGeometry(1, 1, 1);
    const groundGroup = new THREE.Group();

    for (let x = -25; x <= 25; x += 1) {
      for (let z = -25; z <= 25; z += 1) {
        // Natural slight height variations
        let y = 0;
        const distFromCenter = Math.sqrt(x * x + z * z);
        if (x < -14) y = Math.floor((Math.abs(x) - 14) * 0.6); // hills on West
        if (z < -14) y = Math.max(y, Math.floor((Math.abs(z) - 14) * 0.7)); // hills on North

        // Skip ground under building foundation
        const block = new THREE.Mesh(groundGeo, y > 1 ? stoneMat : grassMaterials);
        block.position.set(x, y, z);
        block.receiveShadow = true;
        groundGroup.add(block);
      }
    }
    this.scene.add(groundGroup);

    // 2. Cobblestone Path
    for (let z = -12; z <= 15; z++) {
      const pathBlock = new THREE.Mesh(groundGeo, stoneMat);
      pathBlock.position.set(0, 0.05, z);
      this.scene.add(pathBlock);
      if (z % 3 === 0) {
        const sideBlock = new THREE.Mesh(groundGeo, stoneMat);
        sideBlock.position.set(1, 0.05, z);
        this.scene.add(sideBlock);
      }
    }

    // 3. Trees
    this.buildTree(6, 1, -8, logMat, leafMat);
    this.buildTree(-10, 1, -12, logMat, leafMat);
    this.buildTree(14, 1, 8, logMat, leafMat);
    this.buildTree(-12, 1, 12, logMat, leafMat);

    // 4. Village Tavern (Holds Slot 1: Tavern Painting 2x1)
    this.buildTavern(plankMat, logMat, stoneMat);

    // 5. Town Square Billboard (Holds Slot 2: 4x2 Billboard)
    this.buildTownSquareBillboard(stoneMat, logMat);

    // 6. Mining Outpost Tower (Holds Slot 3: 1x1 Frame)
    this.buildOutpostTower(stoneMat, logMat);

    // 7. Clouds
    this.buildClouds();
  }

  buildTree(x, y, z, logMat, leafMat) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    // Trunk
    for (let ty = 0; ty < 5; ty++) {
      const log = new THREE.Mesh(geo, logMat);
      log.position.set(x, y + ty, z);
      log.castShadow = true;
      this.scene.add(log);
    }
    // Leaves
    for (let lx = -2; lx <= 2; lx++) {
      for (let lz = -2; lz <= 2; lz++) {
        for (let ly = 3; ly <= 5; ly++) {
          if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && ly === 5) continue;
          const leaf = new THREE.Mesh(geo, leafMat);
          leaf.position.set(x + lx, y + ly, z + lz);
          leaf.castShadow = true;
          this.scene.add(leaf);
        }
      }
    }
  }

  buildTavern(plankMat, logMat, stoneMat) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const tavernGroup = new THREE.Group();
    tavernGroup.position.set(-8, 0, -4);

    // Floor & Walls
    const width = 8;
    const depth = 6;
    const height = 4;

    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        // Floor
        const floor = new THREE.Mesh(geo, plankMat);
        floor.position.set(x, 0.5, z);
        tavernGroup.add(floor);

        // Walls
        const isWall = x === 0 || x === width - 1 || z === 0 || z === depth - 1;
        const isDoor = z === depth - 1 && (x === 3 || x === 4);

        if (isWall) {
          for (let y = 1; y <= height; y++) {
            if (isDoor && y <= 2) continue; // Door hole
            const mat = (x === 0 && (z === 0 || z === depth - 1)) || (x === width - 1 && (z === 0 || z === depth - 1)) ? logMat : plankMat;
            const wall = new THREE.Mesh(geo, mat);
            wall.position.set(x, y + 0.5, z);
            wall.castShadow = true;
            tavernGroup.add(wall);
          }
        }
      }
    }

    // Roof
    for (let x = -1; x <= width; x++) {
      for (let z = -1; z <= depth; z++) {
        const roof = new THREE.Mesh(geo, plankMat);
        roof.position.set(x, height + 1.5, z);
        roof.castShadow = true;
        tavernGroup.add(roof);
      }
    }

    this.scene.add(tavernGroup);

    // --- REGISTER SLOT 1: Tavern Painting (2x1 blocks) ---
    // Mounted on Tavern Front Facade next to door: world pos roughly (-6, 2.5, 2.05)
    this.createAdSlotMesh({
      slotId: 'slot_tavern_01',
      name: 'Tavern Wooden Wall Painting',
      width: 2.2,
      height: 1.1,
      aspectRatio: '2:1',
      position: new THREE.Vector3(-4, 2.5, 2.08),
      rotationY: 0,
      defaultTheme: 'pizza'
    });
  }

  buildTownSquareBillboard(stoneMat, logMat) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const billboardGroup = new THREE.Group();
    billboardGroup.position.set(6, 0, 4);

    // 2 Wooden Pillars
    for (let y = 1; y <= 5; y++) {
      const p1 = new THREE.Mesh(geo, logMat);
      p1.position.set(-2.5, y, 0);
      billboardGroup.add(p1);

      const p2 = new THREE.Mesh(geo, logMat);
      p2.position.set(2.5, y, 0);
      billboardGroup.add(p2);
    }

    // Top Beam
    for (let x = -3; x <= 3; x++) {
      const beam = new THREE.Mesh(geo, stoneMat);
      beam.position.set(x, 5.5, 0);
      billboardGroup.add(beam);
    }

    this.scene.add(billboardGroup);

    // --- REGISTER SLOT 2: Town Square Billboard (4x2 blocks) ---
    this.createAdSlotMesh({
      slotId: 'slot_square_02',
      name: 'Village Town Square Billboard',
      width: 4.4,
      height: 2.2,
      aspectRatio: '2:1',
      position: new THREE.Vector3(6, 3.2, 4.08),
      rotationY: 0,
      defaultTheme: 'gaming'
    });
  }

  buildOutpostTower(stoneMat, logMat) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const tower = new THREE.Group();
    tower.position.set(12, 0, -14);

    for (let y = 1; y <= 6; y++) {
      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
          const b = new THREE.Mesh(geo, stoneMat);
          b.position.set(x, y, z);
          tower.add(b);
        }
      }
    }
    this.scene.add(tower);

    // --- REGISTER SLOT 3: Outpost Frame (1x1 block) ---
    this.createAdSlotMesh({
      slotId: 'slot_outpost_03',
      name: 'Mining Outpost Item Frame',
      width: 1.2,
      height: 1.2,
      aspectRatio: '1:1',
      position: new THREE.Vector3(12, 2.5, -12.45),
      rotationY: 0,
      defaultTheme: 'energy'
    });
  }

  buildClouds() {
    const cloudGeo = new THREE.BoxGeometry(4, 1, 4);
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const cloudGroup = new THREE.Group();

    for (let i = 0; i < 20; i++) {
      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 80,
        22 + Math.random() * 3,
        (Math.random() - 0.5) * 80
      );
      cloud.scale.set(1 + Math.random() * 2, 1, 1 + Math.random() * 2);
      cloudGroup.add(cloud);
    }
    this.scene.add(cloudGroup);
  }

  // --- AD SLOTS & DYNAMIC CANVAS RENDERING ---

  createAdSlotMesh(spec) {
    const { slotId, name, width, height, position, rotationY, defaultTheme } = spec;

    // 1. Dynamic Canvas for Slot Texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = spec.aspectRatio === '1:1' ? 512 : 256;
    const ctx = canvas.getContext('2d');

    // Draw initial ambient Minecraft painting
    this.renderDefaultPainting(ctx, canvas.width, canvas.height, defaultTheme);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearFilter;

    // Wooden Frame Border Mesh
    const frameGeo = new THREE.BoxGeometry(width + 0.2, height + 0.2, 0.1);
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.copy(position);
    frameMesh.rotation.y = rotationY;

    // Painting Surface Mesh
    const surfaceGeo = new THREE.PlaneGeometry(width, height);
    const surfaceMat = new THREE.MeshBasicMaterial({ map: texture });
    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    surfaceMesh.position.set(0, 0, 0.06);
    frameMesh.add(surfaceMesh);

    this.scene.add(frameMesh);

    // Store reference
    this.slots.set(slotId, {
      slotId,
      name,
      mesh: frameMesh,
      canvas,
      ctx,
      texture,
      position: position.clone(),
      currentAd: null
    });
  }

  renderDefaultPainting(ctx, w, h, theme) {
    ctx.imageSmoothingEnabled = false;

    // Wooden border
    ctx.fillStyle = '#3a271d';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1c1510';
    ctx.fillRect(10, 10, w - 20, h - 20);

    // Classic Minecraft Sunset Pixel Landscape
    const skyGrad = ctx.createLinearGradient(0, 10, 0, h - 30);
    skyGrad.addColorStop(0, '#f97316');
    skyGrad.addColorStop(0.5, '#fde047');
    skyGrad.addColorStop(1, '#3b82f6');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(14, 14, w - 28, h - 28);

    // Pixel Sun
    ctx.fillStyle = '#fff';
    ctx.fillRect(w / 2 - 20, 30, 40, 40);

    // Pixel Mountains
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(14, h - 28);
    ctx.lineTo(w * 0.35, h * 0.45);
    ctx.lineTo(w * 0.65, h * 0.7);
    ctx.lineTo(w - 14, h * 0.5);
    ctx.lineTo(w - 14, h - 28);
    ctx.fill();

    // Default In-Game Badge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(20, h - 45, w - 40, 24);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('• MINECRAFT IN-GAME CANVAS •', w / 2, h - 28);
  }

  // Update painting with high-impact sponsored ad
  updateSlotWithAd(slotId, creative) {
    const slot = this.slots.get(slotId);
    if (!slot) return;

    slot.currentAd = creative;
    const { ctx, canvas, texture } = slot;
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background gradient with brand colors
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, creative.bannerBg || '#1e293b');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Minecraft gold/neon pixel border
    ctx.lineWidth = 10;
    ctx.strokeStyle = creative.bannerAccent || '#ffca28';
    ctx.strokeRect(5, 5, w - 10, h - 10);

    // Top Sponsored Bar
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(10, 10, w - 20, 32);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('● SPONSORED • VOICECUE VERIFIED', 24, 32);

    // Brand icon & Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Outfit", sans-serif';
    ctx.fillText(`${creative.accentIcon || '⭐'} ${creative.brand}`, 24, 78);

    // Headline
    ctx.fillStyle = creative.bannerAccent || '#ffd700';
    ctx.font = 'bold 20px "Inter", sans-serif';
    ctx.fillText(creative.headline, 24, 114);

    // Tagline / Call to Action
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '15px "Inter", sans-serif';
    ctx.fillText(creative.callToAction || creative.tagline, 24, 148);

    // Coupon Code Badge
    if (creative.couponCode) {
      const boxW = 280;
      const boxH = 46;
      const boxX = 24;
      const boxY = h - 68;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = creative.bannerAccent || '#ffca28';
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = '#ffca28';
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`🎟 CODE: ${creative.couponCode}`, boxX + 16, boxY + 30);
    }

    // Mini QR / Minecraft Emerald Reward Badge
    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.fillRect(w - 180, h - 68, 160, 46);
    ctx.strokeStyle = '#10b981';
    ctx.strokeRect(w - 180, h - 68, 160, 46);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('REWARD: +50 💎', w - 100, h - 48);
    ctx.font = '10px "Inter", sans-serif';
    ctx.fillText('[E] PRESS TO CLAIM', w - 100, h - 32);

    texture.needsUpdate = true;
  }

  // --- CONTROLS & CAMERA ---

  setupControls() {
    // Mouse Look via Pointer Lock
    document.addEventListener('mousemove', (event) => {
      if (!this.isLocked) return;
      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= movementX * 0.0022;
      this.euler.x -= movementY * 0.0022;
      this.euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.euler.x));
      this.camera.quaternion.setFromEuler(this.euler);
    });

    // Keyboard
    document.addEventListener('keydown', (event) => {
      switch (event.code) {
        case 'KeyW': case 'ArrowUp': this.moveForward = true; break;
        case 'KeyS': case 'ArrowDown': this.moveBackward = true; break;
        case 'KeyA': case 'ArrowLeft': this.moveLeft = true; break;
        case 'KeyD': case 'ArrowRight': this.moveRight = true; break;
        case 'Space':
          if (this.canJump) {
            this.velocity.y += 8;
            this.canJump = false;
          }
          break;
        case 'KeyE':
          if (this.interactableSlot) {
            this.onInteractWithAd(this.interactableSlot);
          }
          break;
      }
    });

    document.addEventListener('keyup', (event) => {
      switch (event.code) {
        case 'KeyW': case 'ArrowUp': this.moveForward = false; break;
        case 'KeyS': case 'ArrowDown': this.moveBackward = false; break;
        case 'KeyA': case 'ArrowLeft': this.moveLeft = false; break;
        case 'KeyD': case 'ArrowRight': this.moveRight = false; break;
      }
    });
  }

  // Proximity & Interaction Check
  checkInteraction() {
    let nearest = null;
    let minDistance = 5.0; // Interaction threshold in blocks

    for (const [slotId, slot] of this.slots.entries()) {
      const dist = this.camera.position.distanceTo(slot.position);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = slot;
      }
    }

    this.interactableSlot = nearest;
    const prompt = document.getElementById('interaction-prompt');
    if (prompt) {
      if (nearest) {
        prompt.classList.add('visible');
        const text = nearest.currentAd 
          ? `[E] View ${nearest.currentAd.brand} (+50 💎 & Promo Code)`
          : `[E] Inspect slot "${nearest.name}"`;
        prompt.querySelector('.prompt-text').textContent = text;
      } else {
        prompt.classList.remove('visible');
      }
    }
  }

  // Main Render Loop
  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Friction & Gravity
    this.velocity.x -= this.velocity.x * 10.0 * delta;
    this.velocity.z -= this.velocity.z * 10.0 * delta;
    this.velocity.y -= 25.0 * delta; // Gravity

    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    const speed = 35.0;
    if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * speed * delta;
    if (this.moveLeft || this.moveRight) this.velocity.x += this.direction.x * speed * delta;

    // Move camera relative to direction
    this.camera.translateX(-this.velocity.x * delta);
    this.camera.translateZ(this.velocity.z * delta);
    this.camera.position.y += this.velocity.y * delta;

    // Ground clamp
    if (this.camera.position.y < 1.7) {
      this.velocity.y = 0;
      this.camera.position.y = 1.7;
      this.canJump = true;
    }

    // World bounds clamp
    this.camera.position.x = Math.max(-23, Math.min(23, this.camera.position.x));
    this.camera.position.z = Math.max(-23, Math.min(23, this.camera.position.z));

    this.checkInteraction();
    this.renderer.render(this.scene, this.camera);
  }
}
