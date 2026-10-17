# Builds MINI-CRATE.blend: the frosted Mega crate from CASE.blend, made narrower and shallower for 1-slab packs.
#   Blender -b CASE.blend -P scripts/mini-crate/make_skinny.py -- <out.blend> [dx] [dy]
# Instead of scaling (which would squash the rounded edges), every vertex outside the middle is slid inward by
# dx (width) / dy (depth) world units per side, so the bevels, frosting and lighting stay identical.
import bpy, sys, json, os

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
DX = float(argv[1]) if len(argv) > 1 else 0.42
DY = float(argv[2]) if len(argv) > 2 else 0.12
CORE_X, CORE_Y = 0.3, 0.15  # world half-widths of the untouched middle

for name in ("Cube.002", "Cube.006", "Card_Slab_v2_Slab_0.002"):
    o = bpy.data.objects[name]
    sx, sy = o.scale.x, o.scale.y
    tx, ty, mx, my = CORE_X / sx, CORE_Y / sy, DX / sx, DY / sy
    for v in o.data.vertices:
        if v.co.x > tx: v.co.x -= mx
        elif v.co.x < -tx: v.co.x += mx
        if v.co.y > ty: v.co.y -= my
        elif v.co.y < -ty: v.co.y += my
    o.data.update()

# Report the inner box's new size for the UV layout (1000 px per Blender unit, like the Mega crate).
box = bpy.data.objects["Cube.002"]
ws = [box.matrix_world @ v.co for v in box.data.vertices]
W, D, H = (round((max(p[i] for p in ws) - min(p[i] for p in ws)) * 1000) for i in range(3))
print("BOX", W, D, H)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT), compress=True)
print("SAVED", OUT)
