#!/usr/bin/env python3
"""Draws the app icons in src/icons/ with the standard library only (no image packages).

    python3 tools/icons.py

The icon is a path of three topics on the brand blue, the last one done (green, with a check).
icon.svg is the source of truth for browsers that take SVG; the PNGs are the same drawing,
rasterized with 4x supersampling, for install prompts and home screens. The maskable variant
fills the whole square and keeps the drawing inside the central safe zone, as Android expects.
"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "icons"
BG, LINE, NODE, DONE, CHECK = (0x23, 0x3B, 0x65), (0x8F, 0xA6, 0xCC), (0xFF, 0xFF, 0xFF), (0x2F, 0xB3, 0x7A), (0xFF, 0xFF, 0xFF)

SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#233b65"/>
  <path d="M256 140V372" stroke="#8fa6cc" stroke-width="26" stroke-linecap="round"/>
  <circle cx="256" cy="140" r="46" fill="#fff"/>
  <circle cx="256" cy="256" r="46" fill="#fff"/>
  <circle cx="256" cy="372" r="52" fill="#2fb37a"/>
  <path d="M232 372l17 17 32-34" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
"""


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return ((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2) ** 0.5


def color_at(x, y, maskable):
    """The drawing in a 512 x 512 space; maskable shrinks it to 80% and fills the corners."""
    if maskable:
        x, y = 256 + (x - 256) / 0.8, 256 + (y - 256) / 0.8
    else:  # rounded square, radius 112
        cx, cy = min(max(x, 112), 400), min(max(y, 112), 400)
        if (x - cx) ** 2 + (y - cy) ** 2 > 112 ** 2:
            return None
    if seg_dist(x, y, 232, 372, 249, 389) <= 8 or seg_dist(x, y, 249, 389, 281, 355) <= 8:
        return CHECK
    if (x - 256) ** 2 + (y - 372) ** 2 <= 52 ** 2:
        return DONE
    if (x - 256) ** 2 + (y - 140) ** 2 <= 46 ** 2 or (x - 256) ** 2 + (y - 256) ** 2 <= 46 ** 2:
        return NODE
    if seg_dist(x, y, 256, 140, 256, 372) <= 13:
        return LINE
    return BG


def png(size, maskable=False, ss=4):
    rows = []
    scale = 512 / (size * ss)
    for py in range(size):
        row = bytearray([0])  # filter: none
        for px in range(size):
            r = g = b = a = 0
            for sy in range(ss):
                for sx in range(ss):
                    c = color_at((px * ss + sx + 0.5) * scale, (py * ss + sy + 0.5) * scale, maskable)
                    if c:
                        r += c[0]; g += c[1]; b += c[2]; a += 255
            n = ss * ss
            alpha = a // n
            k = a // 255 or 1
            row += bytes((r // k, g // k, b // k, alpha))
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", raw) + chunk(b"IEND", b"")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "icon.svg").write_text(SVG, "utf-8")
    for name, size, mask in (("icon-192.png", 192, False), ("icon-512.png", 512, False), ("maskable-512.png", 512, True), ("apple-touch-icon.png", 180, True)):
        (OUT / name).write_bytes(png(size, mask))
        print("wrote", OUT / name)


if __name__ == "__main__":
    main()
