"""
アイコン生成スクリプト
実行: python generate_icons.py
依存: Pillow  (pip install pillow)

icons/icon-192.png と icons/icon-512.png を生成します。
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont

ORANGE = (255, 122, 0)
WHITE  = (255, 255, 255)
SIZES  = [192, 512]
OUTPUT = os.path.join(os.path.dirname(__file__), "icons")


def make_squircle_mask(size: int, radius_ratio: float = 0.22) -> Image.Image:
    """iOS風のsquircle（超楕円）マスクを生成する。"""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    r = int(size * radius_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    return mask


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # squircle背景
    bg = Image.new("RGBA", (size, size), ORANGE + (255,))
    mask = make_squircle_mask(size)
    img.paste(bg, (0, 0), mask)

    draw = ImageDraw.Draw(img)

    # フォントサイズ = アイコン幅の約40%
    font_size = int(size * 0.40)

    font = None
    # 丸みのあるフォントを優先して探す
    candidates = [
        # Windows
        "C:/Windows/Fonts/bahnschrift.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/Arial Bold.ttf",
        # macOS / Linux fallback
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, font_size)
                break
            except Exception:
                continue

    if font is None:
        # どれも見つからなければデフォルト（小さくなるが動作する）
        font = ImageFont.load_default()

    text = "TO"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    ty = (size - th) // 2 - bbox[1]

    # 影（わずかに深みを出す）
    shadow_offset = max(1, size // 96)
    draw.text((tx + shadow_offset, ty + shadow_offset), text, font=font,
              fill=(0, 0, 0, 40))
    draw.text((tx, ty), text, font=font, fill=WHITE)

    return img


def main() -> None:
    os.makedirs(OUTPUT, exist_ok=True)
    for size in SIZES:
        icon = make_icon(size)
        path = os.path.join(OUTPUT, f"icon-{size}.png")
        icon.save(path, "PNG")
        print(f"生成完了: {path}")
    print("アイコン生成が完了しました。")


if __name__ == "__main__":
    main()
