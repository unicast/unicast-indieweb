function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
}

window.onload = async () => {
    const engine = new IsometricEngine('game-canvas');

    // Load config.json
    try {
        const response = await fetch('config.json');
        const config = await response.json();
        
        engine.debug = config.debug || false;
        if (config.settings) {
            engine.setSettings(config.settings);
        }

        if (config.textures) {
            const floorImg = loadImage(config.textures.floor);
            const wallImg = loadImage(config.textures.wall);
            engine.setTextures(floorImg, wallImg);
        }

        const ISO_OFFSET_X = -500;
        const ISO_OFFSET_Y = 125;
        const ISO_ROOM_SIZE = 250;

        function isoToScreen(isoX, isoY) {
            return {
                x: isoX + isoY + ISO_OFFSET_X,
                y: 0.5 * isoX - 0.5 * isoY + ISO_OFFSET_Y
            };
        }

        let engineRooms = [];
        for (let room of config.rooms) {
            let screenCenter = isoToScreen(room.x + ISO_ROOM_SIZE/2, room.y + ISO_ROOM_SIZE/2);
            let engineRoom = {
                name: room.name,
                x: screenCenter.x,
                y: screenCenter.y,
                isoX: room.x,
                isoY: room.y,
                w: 500,
                h: 250,
                color: room.color
            };
            
            if (room.textures) {
                if (room.textures.floor) engineRoom.floorTexture = loadImage(room.textures.floor);
                if (room.textures.wall) engineRoom.wallTexture = loadImage(room.textures.wall);
            }
            engineRooms.push(engineRoom);

            if (room.objects) {
                for (let obj of room.objects) {
                    let absoluteIsoX = room.x + obj.x;
                    let absoluteIsoY = room.y + obj.y;
                    let screenPos = isoToScreen(absoluteIsoX, absoluteIsoY);
                    
                    let engineObj = {
                        type: 'object',
                        name: obj.name,
                        x: screenPos.x,
                        y: screenPos.y,
                        isoX: absoluteIsoX,
                        isoY: absoluteIsoY,
                        interactable: obj.interactable,
                        contentFile: obj.contentFile,
                    };
                    if (obj.image) {
                        engineObj.image = loadImage(obj.image);
                        engineObj.imageWidth = obj.width;
                        engineObj.imageHeight = obj.height;
                    }
                    engine.addObject(engineObj);
                }
            }

            if (room.wallObjects) {
                for (let wObj of room.wallObjects) {
                    if (wObj.image) {
                        wObj.image = loadImage(wObj.image);
                    }
                    
                    let absoluteIsoX = room.x + wObj.x;
                    let absoluteIsoY = room.y + wObj.y;
                    let screenPos = isoToScreen(absoluteIsoX, absoluteIsoY);
                    
                    let screenX = screenPos.x;
                    let screenY = screenPos.y - (wObj.z || 0);

                    engine.addObject({
                        type: 'wallObject',
                        name: wObj.name,
                        x: screenX,
                        y: screenY,
                        isoX: absoluteIsoX,
                        isoY: absoluteIsoY,
                        z: wObj.z || 0,
                        interactable: wObj.interactable,
                        contentFile: wObj.contentFile
                    });
                }
                engineRoom.wallObjects = room.wallObjects;
            }
        }
        engine.setRooms(engineRooms);

        // Load Player
        const player = config.player;
        let playerScreen = isoToScreen(player.x, player.y);
        engine.setCharacter({
            type: 'character',
            x: playerScreen.x,
            y: playerScreen.y,
            isoX: player.x,
            isoY: player.y,
            speed: player.speed,
            image: loadImage(player.image),
            imageWidth: player.width,
            imageHeight: player.height
        });

        // Handle Interactions
        engine.onInteract((object) => {
            console.log(`Interacted with ${object.name}`);
            if (object.contentFile) {
                openModal(object.contentFile);
            }
        });

        engine.start();
    } catch (error) {
        console.error("Failed to load game config:", error);
        alert("Failed to load config.json. Make sure you are running a local web server!");
    }
};
