from PIL import Image
import os

def fix_background(input_path, output_path, target_bg_color=(255, 240, 243)): # #fff0f3
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    new_data = []
    # Grid colors are usually gray and white. 
    # Let's target pixels that are very close to white or mid-gray
    # and replace them with the target background color.
    # Note: This is an approximation. If the icon itself has these colors, it might get affected.
    # But since it's a grid, we can also check for patterns or just use a threshold.
    
    for item in datas:
        r, g, b, a = item
        # Grayish grid color check (e.g., around 204/204/204 or white 255/255/255)
        # We assume the icon itself doesn't have exactly these alternating gray/white colors at the edges.
        is_grid = (abs(r - g) < 5 and abs(g - b) < 5 and r > 180) # Very simple threshold for gray/white
        
        if is_grid:
            new_data.append(target_bg_color + (255,))
        else:
            new_data.append(item)

    img.putdata(new_data)
    img.save(output_path, "PNG")

# Path to original uploads
brain_path = "C:/Users/selen/.gemini/antigravity/brain/44ca05af-7882-4f69-8ee7-f7c00720f8e7"
uploads = [
    ("uploaded_media_0_1770008545585.png", "snow.png"),
    ("uploaded_media_1_1770008545585.png", "cloudy_sun.png"),
    ("uploaded_media_2_1770008545585.png", "cloudy.png"),
    ("uploaded_media_3_1770008545585.png", "sun.png")
]

os.makedirs("assets/weather", exist_ok=True)

for original, target in uploads:
    input_file = os.path.join(brain_path, original)
    output_file = os.path.join("assets/weather", target)
    print(f"Processing {original} -> {target}")
    fix_background(input_file, output_file)
