"""Genera los iconos PNG de Flux (degradado + rayo) para la PWA / Play Store."""
from PIL import Image, ImageDraw

C1 = (79, 70, 229)    # #4f46e5 indigo
C2 = (139, 92, 246)   # #8b5cf6 violet

# Rayo normalizado (0..1, y hacia abajo) — forma clásica de ⚡
BOLT = [
    (0.62, 0.08), (0.30, 0.54), (0.50, 0.54),
    (0.40, 0.92), (0.74, 0.42), (0.52, 0.42),
]


def gradient(size):
    """RGB con degradado diagonal C1→C2."""
    w = h = size
    buf = bytearray(w * h * 3)
    denom = max(1, (w - 1) + (h - 1))
    for y in range(h):
        base = y * w * 3
        for x in range(w):
            t = (x + y) / denom
            i = base + x * 3
            buf[i]     = int(C1[0] + (C2[0] - C1[0]) * t)
            buf[i + 1] = int(C1[1] + (C2[1] - C1[1]) * t)
            buf[i + 2] = int(C1[2] + (C2[2] - C1[2]) * t)
    return Image.frombytes("RGB", (w, h), bytes(buf))


def bolt_points(size, scale):
    """Centra el rayo dentro de un cuadro de lado size*scale, centrado en el icono."""
    xs = [p[0] for p in BOLT]; ys = [p[1] for p in BOLT]
    bw, bh = max(xs) - min(xs), max(ys) - min(ys)
    target = size * scale
    k = target / max(bw, bh)
    # offset para centrar
    cx = size / 2 - ((min(xs) + max(xs)) / 2) * k
    cy = size / 2 - ((min(ys) + max(ys)) / 2) * k
    return [(p[0] * k + cx, p[1] * k + cy) for p in BOLT]


def make(size, bolt_scale, rounded, out):
    img = gradient(size).convert("RGBA")
    if rounded:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
        img.putalpha(mask)
    draw = ImageDraw.Draw(img)
    draw.polygon(bolt_points(size, bolt_scale), fill=(255, 255, 255, 255))
    img.save(out)
    print("wrote", out)


# "any" (esquinas redondeadas, se muestran tal cual)
make(192, 0.50, True,  "icon-192.png")
make(512, 0.50, True,  "icon-512.png")
# maskable (cuadro completo, el SO recorta — rayo dentro de la zona segura)
make(512, 0.42, False, "icon-maskable-512.png")
# apple touch (cuadro completo opaco)
make(180, 0.50, False, "apple-touch-icon.png")
