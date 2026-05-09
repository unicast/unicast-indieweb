import json
import os
import subprocess

def process_image(img_path, width, height):
    if not img_path:
        return
    
    filename = os.path.basename(img_path)
    source = os.path.join('assets_orig', filename)
    target = os.path.join('assets', filename)
    
    if not os.path.exists(source):
        print(f"Skipping {filename}: Source not found in assets_orig/")
        return
    
    # Determine resize string
    if width and height:
        resize_str = f"{width}x{height}"
    elif width:
        resize_str = f"{width}"
    elif height:
        resize_str = f"x{height}"
    else:
        print(f"Skipping {filename}: No width or height specified in config")
        return
        
    print(f"Resizing {filename} to {resize_str}...")
    try:
        subprocess.run(['magick', source, '-resize', resize_str, target], check=True)
    except Exception as e:
        print(f"Error processing {filename}: {e}")

def main():
    if not os.path.exists('assets'):
        os.makedirs('assets')
        
    with open('config.json', 'r') as f:
        config = json.load(f)
        
    # Process textures
    textures = config.get('textures', {})
    process_image(textures.get('floor'), 250, None)
    process_image(textures.get('wall'), 250, None)

    for room in config.get('rooms', []):
        # Process room-specific textures
        room_textures = room.get('textures', {})
        process_image(room_textures.get('floor'), 250, None)
        process_image(room_textures.get('wall'), 250, None)

        # Process regular objects
        for obj in room.get('objects', []):
            process_image(obj.get('image'), obj.get('width'), obj.get('height'))
        
        # Process wall objects
        for obj in room.get('wallObjects', []):
            process_image(obj.get('image'), obj.get('width'), obj.get('height'))
            
    # Process player
    player = config.get('player', {})
    process_image(player.get('image'), player.get('width'), player.get('height'))

if __name__ == "__main__":
    main()
