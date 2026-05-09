class IsometricEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.debug = false;
        this.settings = {
            interaction: {
                radiusMultiplier: 0.8,
                radiusBase: 10,
                wallObjectBoost: 100
            },
            rendering: {
                showShadows: false
            }
        };
        this.camera = { x: 0, y: 0 };
        this.keys = {};
        this.objects = [];
        this.character = null;
        this.camera = { x: 0, y: 0 };
        this.interactionCallback = null;

        this.setupCanvas();
        window.addEventListener('resize', () => this.setupCanvas());

        this.targetIso = null;
        this.canvas.addEventListener('click', (e) => this.handleMouseClick(e));

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isModalOpen) {
                closeModal();
            }
        });
    }

    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setSettings(settings) {
        if (settings.interaction) {
            this.settings.interaction = { ...this.settings.interaction, ...settings.interaction };
        }
        if (settings.rendering) {
            this.settings.rendering = { ...this.settings.rendering, ...settings.rendering };
        }
    }

    setRooms(roomsData) {
        this.rooms = roomsData;
        this.doors = [];
        for (let room of this.rooms) {
            if (room.wallObjects) {
                for (let wObj of room.wallObjects) {
                    if (wObj.name.toLowerCase().includes('door')) {
                        if (wObj.wall === 'NW') {
                            this.doors.push({
                                axis: 'x',
                                pos: room.isoX,
                                min: room.isoY + wObj.y - wObj.width / 2,
                                max: room.isoY + wObj.y + wObj.width / 2
                            });
                        } else if (wObj.wall === 'NE') {
                            this.doors.push({
                                axis: 'y',
                                pos: room.isoY + 250,
                                min: room.isoX + wObj.x - wObj.width / 2,
                                max: room.isoX + wObj.x + wObj.width / 2
                            });
                        }
                    }
                }
            }
        }
    }

    setTextures(floorImg, wallImg) {
        this.floorTexture = floorImg;
        this.wallTexture = wallImg;
    }

    setCharacter(char) {
        this.character = char;
    }

    addObject(obj) {
        this.objects.push(obj);
    }

    onInteract(callback) {
        this.interactionCallback = callback;
    }

    // Helper to calculate dimensions while preserving aspect ratio
    getEntitySize(entity) {
        let w = entity.width || entity.imageWidth;
        let h = entity.height || entity.imageHeight;
        const img = entity.image;

        if (img && img.complete) {
            if (w && !h) {
                h = w * (img.height / img.width);
            } else if (h && !w) {
                w = h * (img.width / img.height);
            } else if (!w && !h) {
                w = img.width;
                h = img.height;
            }
        } else {
            w = w || 40;
            h = h || 40;
        }
        return { width: w, height: h };
    }

    screenToIso(screenX, screenY) {
        const sX = screenX + 500;
        const sY = 2 * (screenY - 125);
        return { x: (sX + sY) / 2, y: (sX - sY) / 2 };
    }

    isoToScreen(isoX, isoY) {
        return { x: isoX + isoY - 500, y: 0.5 * isoX - 0.5 * isoY + 125 };
    }

    isValidPos(x, y) {
        const r = 20; // collision margin

        let insideRoom = false;
        for (let room of this.rooms) {
            if (x >= room.isoX + r && x <= room.isoX + 250 - r &&
                y >= room.isoY + r && y <= room.isoY + 250 - r) {
                insideRoom = true;
                break;
            }
        }
        if (insideRoom) return true;

        for (let door of this.doors) {
            if (door.axis === 'x') {
                if (Math.abs(x - door.pos) <= r && y >= door.min + r && y <= door.max - r) return true;
            } else if (door.axis === 'y') {
                if (Math.abs(y - door.pos) <= r && x >= door.min + r && x <= door.max - r) return true;
            }
        }
        return false;
    }

    getNearbyObject() {
        if (!this.character) return null;
        for (let obj of this.objects) {
            if (!obj.interactable) continue;

            // Check if in the same room
            // We use a small -1 offset so objects on the far boundary (250, 500 etc) 
            // are counted as part of the room they are in.
            const charRoomX = Math.floor((this.character.isoX - 1) / 250);
            const charRoomY = Math.floor((this.character.isoY - 1) / 250);
            const objRoomX = Math.floor((obj.isoX - 1) / 250);
            const objRoomY = Math.floor((obj.isoY - 1) / 250);
            if (charRoomX !== objRoomX || charRoomY !== objRoomY) continue;

            const dx = obj.x - this.character.x;
            // Use the floor-level Y for distance checking
            const floorY = obj.type === 'wallObject' ? obj.y + (obj.z || 0) : obj.y;
            const dy = floorY - this.character.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const clickRadius = this.getInteractionRadius(obj);
            if (dist < clickRadius) return obj;
        }
        return null;
    }

    getInteractionRadius(entity) {
        const size = this.getEntitySize(entity);
        const baseSize = Math.max(size.width, size.height);

        const mult = (this.settings.interaction.radiusMultiplier !== undefined) ? this.settings.interaction.radiusMultiplier : 0.8;
        const base = (this.settings.interaction.radiusBase !== undefined) ? this.settings.interaction.radiusBase : 40;
        
        let radius = baseSize * mult + base;
        
        if (entity.type === 'wallObject') {
            radius += (this.settings.interaction.wallObjectBoost !== undefined ? this.settings.interaction.wallObjectBoost : 100);
        }

        return radius;
    }

    handleMouseClick(e) {
        if (isModalOpen) return;

        const rect = this.canvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left) + this.camera.x;
        const worldY = (e.clientY - rect.top) + this.camera.y;

        let clickedObject = null;
        let entities = [...this.objects].sort((a, b) => b.y - a.y);
        for (let obj of entities) {
            if (!obj.interactable) continue;

            const size = this.getEntitySize(obj);
            const imgWidth = size.width;
            const imgHeight = size.height;

            let objLeft, objRight, objTop, objBottom;

            if (obj.type === 'wallObject') {
                // Wall objects use their exact center for x,y. 
                // We use a generously padded bounding box to account for isometric skew.
                objLeft = obj.x - imgWidth;
                objRight = obj.x + imgWidth;
                objTop = obj.y - imgHeight;
                objBottom = obj.y + imgHeight;
            } else {
                // Regular objects use their bottom center for alignment
                objLeft = obj.x - imgWidth / 2;
                objRight = obj.x + imgWidth / 2;
                objTop = obj.y - imgHeight + 10;
                objBottom = obj.y + 10;
            }

            if (worldX >= objLeft && worldX <= objRight && worldY >= objTop && worldY <= objBottom) {
                clickedObject = obj;
                break;
            }
        }

        if (clickedObject) {
            // Check if in the same room
            // We use a small -1 offset so objects on the far boundary (250, 500 etc) 
            // are counted as part of the room they are in.
            const charRoomX = Math.floor((this.character.isoX - 1) / 250);
            const charRoomY = Math.floor((this.character.isoY - 1) / 250);
            const objRoomX = Math.floor((clickedObject.isoX - 1) / 250);
            const objRoomY = Math.floor((clickedObject.isoY - 1) / 250);

            if (charRoomX === objRoomX && charRoomY === objRoomY) {
                const dx = clickedObject.x - this.character.x;
                const floorY = clickedObject.type === 'wallObject' ? clickedObject.y + (clickedObject.z || 0) : clickedObject.y;
                const dy = floorY - this.character.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const clickRadius = this.getInteractionRadius(clickedObject);

                if (dist < clickRadius) {
                    if (this.interactionCallback) this.interactionCallback(clickedObject);
                    this.targetIso = null;
                    return;
                }
            }
        }

        this.targetIso = this.screenToIso(worldX, worldY);
    }

    update(dt) {
        if (isModalOpen) return; // Pause game when modal is open

        // Character Movement
        if (this.character && this.targetIso) {
            const isoSpeed = this.character.speed;
            const dx = this.targetIso.x - this.character.isoX;
            const dy = this.targetIso.y - this.character.isoY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > isoSpeed) {
                let nextX = this.character.isoX + (dx / dist) * isoSpeed;
                let nextY = this.character.isoY + (dy / dist) * isoSpeed;

                if (!this.isValidPos(nextX, nextY)) {
                    if (this.isValidPos(nextX, this.character.isoY)) {
                        nextY = this.character.isoY;
                    } else if (this.isValidPos(this.character.isoX, nextY)) {
                        nextX = this.character.isoX;
                    } else {
                        nextX = this.character.isoX;
                        nextY = this.character.isoY;
                        this.targetIso = null;
                    }
                }

                this.character.isoX = nextX;
                this.character.isoY = nextY;
                const sp = this.isoToScreen(nextX, nextY);
                this.character.x = sp.x;
                this.character.y = sp.y;
            } else {
                if (this.isValidPos(this.targetIso.x, this.targetIso.y)) {
                    this.character.isoX = this.targetIso.x;
                    this.character.isoY = this.targetIso.y;
                }
                const sp = this.isoToScreen(this.character.isoX, this.character.isoY);
                this.character.x = sp.x;
                this.character.y = sp.y;
                this.targetIso = null;
            }
        }

        // Update camera to follow character
        if (this.character) {
            const targetCamX = this.character.x - this.canvas.width / 2;
            const targetCamY = this.character.y - this.canvas.height / 2;
            
            // Smooth camera
            this.camera.x += (targetCamX - this.camera.x) * 0.1;
            this.camera.y += (targetCamY - this.camera.y) * 0.1;
        }

    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        // Camera translation
        this.ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

        // Draw Rooms
        if (this.rooms) {
            // Sort rooms by Y (back to front) to ensure proper depth drawing
            let sortedRooms = [...this.rooms].sort((a, b) => a.y - b.y);

            for (let room of sortedRooms) {
                let currentFloor = room.floorTexture || this.floorTexture;
                let currentWall = room.wallTexture || this.wallTexture;

                // Draw floor
                if (currentFloor && currentFloor.complete) {
                    this.ctx.save();
                    this.ctx.transform(
                        (room.w / 2) / currentFloor.width,
                        (room.h / 2) / currentFloor.width,
                        (-room.w / 2) / currentFloor.height,
                        (room.h / 2) / currentFloor.height,
                        room.x,
                        room.y - room.h / 2
                    );
                    this.ctx.drawImage(currentFloor, 0, 0);
                    this.ctx.restore();
                } else {
                    this.ctx.fillStyle = room.color || '#4a5e42';
                    this.ctx.beginPath();
                    this.ctx.moveTo(room.x, room.y - room.h / 2);
                    this.ctx.lineTo(room.x + room.w / 2, room.y);
                    this.ctx.lineTo(room.x, room.y + room.h / 2);
                    this.ctx.lineTo(room.x - room.w / 2, room.y);
                    this.ctx.closePath();
                    this.ctx.fill();
                }

                // Floor outline
                this.ctx.beginPath();
                this.ctx.moveTo(room.x, room.y - room.h / 2);
                this.ctx.lineTo(room.x + room.w / 2, room.y);
                this.ctx.lineTo(room.x, room.y + room.h / 2);
                this.ctx.lineTo(room.x - room.w / 2, room.y);
                this.ctx.closePath();
                this.ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();

                const wallHeight = 160;

                if (currentWall && currentWall.complete) {
                    // Draw NW Wall
                    this.ctx.save();
                    this.ctx.transform(
                        (room.w / 2) / currentWall.width,
                        (-room.h / 2) / currentWall.width,
                        0,
                        wallHeight / currentWall.height,
                        room.x - room.w / 2,
                        room.y - wallHeight
                    );
                    this.ctx.drawImage(currentWall, 0, 0);
                    this.ctx.restore();

                    // Draw NE Wall
                    this.ctx.save();
                    this.ctx.transform(
                        (room.w / 2) / currentWall.width,
                        (room.h / 2) / currentWall.width,
                        0,
                        wallHeight / currentWall.height,
                        room.x,
                        room.y - room.h / 2 - wallHeight
                    );
                    this.ctx.drawImage(currentWall, 0, 0);
                    this.ctx.restore();

                    // Draw Wall Objects
                    if (room.wallObjects) {
                        for (let obj of room.wallObjects) {
                            if (!obj.image || !obj.image.complete) continue;

                            this.ctx.save();
                            if (obj.wall === 'NW') {
                                // Transform for NW Wall
                                this.ctx.transform(
                                    (room.w / 2) / 250,
                                    (-room.h / 2) / 250,
                                    0,
                                    1,
                                    room.x - room.w / 2,
                                    room.y
                                );

                                const size = this.getEntitySize(obj);
                                const z = obj.z || 0;
                                this.ctx.drawImage(obj.image, obj.y - size.width / 2, -z - size.height / 2, size.width, size.height);
                            } else if (obj.wall === 'NE') {
                                // Transform for NE Wall
                                this.ctx.transform(
                                    (room.w / 2) / 250,
                                    (room.h / 2) / 250,
                                    0,
                                    1,
                                    room.x,
                                    room.y - room.h / 2
                                );

                                const size = this.getEntitySize(obj);
                                const z = obj.z || 0;
                                this.ctx.drawImage(obj.image, obj.x - size.width / 2, -z - size.height / 2, size.width, size.height);
                            }
                            this.ctx.restore();
                        }
                    }
                } else {
                    // NW Fallback
                    this.ctx.fillStyle = '#7b6d5e';
                    this.ctx.beginPath();
                    this.ctx.moveTo(room.x - room.w / 2, room.y);
                    this.ctx.lineTo(room.x, room.y - room.h / 2);
                    this.ctx.lineTo(room.x, room.y - room.h / 2 - wallHeight);
                    this.ctx.lineTo(room.x - room.w / 2, room.y - wallHeight);
                    this.ctx.closePath();
                    this.ctx.fill();
                    this.ctx.stroke();

                    // NE Fallback
                    this.ctx.fillStyle = '#6b5d4e';
                    this.ctx.beginPath();
                    this.ctx.moveTo(room.x, room.y - room.h / 2);
                    this.ctx.lineTo(room.x + room.w / 2, room.y);
                    this.ctx.lineTo(room.x + room.w / 2, room.y - wallHeight);
                    this.ctx.lineTo(room.x, room.y - room.h / 2 - wallHeight);
                    this.ctx.closePath();
                    this.ctx.fill();
                    this.ctx.stroke();
                }


            }
        }

        // Collect all entities (objects + character) for depth sorting
        let entities = [...this.objects];
        if (this.character) entities.push(this.character);

        // Depth sorting: entities lower on the screen (higher Y) are drawn last (in front)
        entities.sort((a, b) => a.y - b.y);

        for (let entity of entities) {
            if (entity.type === 'wallObject') continue;

            if (this.settings.rendering.showShadows) {
                this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
                this.ctx.beginPath();
                this.ctx.ellipse(entity.x, entity.y, 20, 8, 0, 0, Math.PI * 2);
                this.ctx.fill();
            }

            if (entity.image && entity.image.complete) {
                // Draw image centered at the bottom
                const size = this.getEntitySize(entity);
                const imgWidth = size.width;
                const imgHeight = size.height;
                // Add a small offset to visually align with the floor
                this.ctx.drawImage(entity.image, entity.x - imgWidth / 2, entity.y - imgHeight + 10, imgWidth, imgHeight);
            } else if (entity.type === 'character') {
                this.ctx.fillStyle = '#ff6b6b';
                this.ctx.fillRect(entity.x - 15, entity.y - 50, 30, 50);
            } else {
                this.ctx.fillStyle = entity.color || '#4facfe';
                this.ctx.fillRect(entity.x - 20, entity.y - 40, 40, 40);
            }

            if (this.debug && entity.type === 'character') {
                const sX = entity.x + 500;
                const sY = 2 * (entity.y - 125);
                const isoX = Math.round((sX + sY) / 2);
                const isoY = Math.round((sX - sY) / 2);

                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 16px Courier New';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`X:${isoX} Y:${isoY}`, entity.x, entity.y + 25);
            }
        }

        if (this.debug) {
            for (let obj of this.objects) {
                if (!obj.interactable) continue;
                const radius = this.getInteractionRadius(obj);
                const floorY = obj.type === 'wallObject' ? obj.y + (obj.z || 0) : obj.y;

                this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
                this.ctx.setLineDash([5, 5]);
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(obj.x, floorY, radius, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.setLineDash([]);

                // Also draw the name
                this.ctx.fillStyle = 'white';
                this.ctx.font = '12px Courier New';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`${obj.name} (R:${Math.round(radius)})`, obj.x, floorY + radius + 15);
            }
        }

        this.ctx.restore();
    }

    loop(time) {
        const dt = time - (this.lastTime || time);
        this.lastTime = time;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    start() {
        requestAnimationFrame((t) => this.loop(t));
    }
}
