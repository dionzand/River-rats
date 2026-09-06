#!/usr/bin/env python3
"""Generates the app icons (no image libraries needed).

Draws a cream playing card on the dark table felt with a gold diamond pip,
supersampled 3x for smooth edges. Run: python3 tools/make_icons.py
"""
import struct
import zlib

BG = (12, 23, 26)
CARD = (247, 244, 236)
EDGE = (232, 182, 76)
PIP = (192, 57, 43)
SS = 3  # supersampling factor


def rounded_rect(x, y, w, h, r):
    def inside(px, py):
        if not (x <= px <= x + w and y <= py <= y + h):
            return False
        cx = min(max(px, x + r), x + w - r)
        cy = min(max(py, y + r), y + h - r)
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
    return inside


def rotate(px, py, cx, cy, cos_t, sin_t):
    dx, dy = px - cx, py - cy
    return cx + dx * cos_t + dy * sin_t, cy - dx * sin_t + dy * cos_t


def render(size):
    import math
    n = size * SS
    card_w, card_h = n * 0.46, n * 0.64
    cx, cy = n / 2, n / 2
    card = rounded_rect(cx - card_w / 2, cy - card_h / 2, card_w, card_h, n * 0.06)
    border = rounded_rect(cx - card_w / 2 - n * 0.018, cy - card_h / 2 - n * 0.018,
                          card_w + n * 0.036, card_h + n * 0.036, n * 0.075)
    bg = rounded_rect(0, 0, n - 1, n - 1, n * 0.22)
    angle = math.radians(-8)
    cos_t, sin_t = math.cos(angle), math.sin(angle)
    pip_r = n * 0.15

    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            acc = [0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    px, py = x * SS + sx + 0.5, y * SS + sy + 0.5
                    colour = (0, 0, 0)
                    if bg(px, py):
                        colour = BG
                        rx, ry = rotate(px, py, cx, cy, cos_t, sin_t)
                        if border(rx, ry):
                            colour = EDGE
                        if card(rx, ry):
                            colour = CARD
                            if abs(rx - cx) / 0.72 + abs(ry - cy) < pip_r:
                                colour = PIP
                    for i in range(3):
                        acc[i] += colour[i]
            row += bytes(v // (SS * SS) for v in acc)
        rows.append(bytes(row))
    return rows


def write_png(path, size):
    rows = render(size)
    raw = b''.join(b'\x00' + r for r in rows)

    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body))

    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as fh:
        fh.write(png)
    print('wrote', path, size, 'x', size)


if __name__ == '__main__':
    write_png('icon.png', 180)       # apple-touch-icon
    write_png('icon-192.png', 192)
    write_png('icon-512.png', 512)
