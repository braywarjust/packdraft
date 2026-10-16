# Renders the Mega Case cover from CASE.blend: re-unwraps the inner box into the 3×2 atlas from build-texture.mjs,
# applies it and renders a transparent square PNG with the file's own camera.
#   Blender -b CASE.blend -P scripts/mega-case/render.py -- <atlas.png> <out.png> [samples] [--glow 1.2] [--clear-acrylic] [--keep-comp] [--save]
import bpy, sys, os, glob

argv = sys.argv[sys.argv.index("--") + 1:]
ATLAS, OUT = argv[0], argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 256
sc = bpy.context.scene
for o in bpy.data.objects: o.animation_data_clear()
for a in list(bpy.data.actions): bpy.data.actions.remove(a)

box = bpy.data.objects["Cube.002"]
me, mw = box.data, box.matrix_world
ws = [mw @ v.co for v in me.vertices]
lo = [min(v[i] for v in ws) for i in range(3)]; hi = [max(v[i] for v in ws) for i in range(3)]
nx = lambda v, i: (v[i] - lo[i]) / (hi[i] - lo[i])
# UVs follow the fold-out net in layout.json (true proportions), so a design made on the guide maps 1:1.
import json
L = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "layout.json")))
IW, IH = L["width"], L["height"]
# face key -> (net face, s(v), t(v)); s runs left→right and t bottom→top as seen from outside the box.
FACES = {
    (0, -1, 0): ("front", lambda v: nx(v, 0), lambda v: nx(v, 2)),
    (0, 1, 0): ("back", lambda v: 1 - nx(v, 0), lambda v: nx(v, 2)),
    (0, 0, 1): ("top", lambda v: nx(v, 0), lambda v: nx(v, 1)),
    (-1, 0, 0): ("left", lambda v: 1 - nx(v, 1), lambda v: nx(v, 2)),
    (1, 0, 0): ("right", lambda v: nx(v, 1), lambda v: nx(v, 2)),
    (0, 0, -1): ("bottom", lambda v: nx(v, 0), lambda v: 1 - nx(v, 1)),
}
uv = me.uv_layers.active.data
for p in me.polygons:
    n = tuple(round(x) for x in (mw.to_3x3() @ p.normal).normalized())
    face, fs, ft = FACES[n]
    x0, y0, w, h = L["faces"][face]
    for li in p.loop_indices:
        v = mw @ me.vertices[me.loops[li].vertex_index].co
        s, t = fs(v), ft(v)
        uv[li].uv = ((x0 + 1 + s * (w - 2)) / IW, 1 - (y0 + 1 + (1 - t) * (h - 2)) / IH)

mat = box.material_slots[0].material
tex = next(n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE")
tex.image = bpy.data.images.load(ATLAS, check_existing=False); tex.interpolation = "Cubic"
bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
if not bsdf.inputs["Base Color"].is_linked: mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.35
bsdf.inputs["Metallic"].default_value = 0.1
# --glow N: let the box art emit a little light so it reads through the original frosted case.
if "--glow" in argv:
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = float(argv[argv.index("--glow") + 1])

# Clear acrylic shell. The original frosted/dispersion shaders hazed the artwork, and Cycles can't light through
# refraction cleanly, so the shell also stops casting shadows onto the box.
def acrylic(name, rough):
    # Thin-acrylic look: straight-through transparency plus a Fresnel-weighted gloss. No refraction, so the
    # stacked walls of the case don't black out the front.
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out, mix = nt.nodes.new("ShaderNodeOutputMaterial"), nt.nodes.new("ShaderNodeMixShader")
    tr, gl, fr = nt.nodes.new("ShaderNodeBsdfTransparent"), nt.nodes.new("ShaderNodeBsdfGlossy"), nt.nodes.new("ShaderNodeFresnel")
    tr.inputs["Color"].default_value = (0.97, 0.98, 1.0, 1)
    gl.inputs["Roughness"].default_value = rough
    fr.inputs["IOR"].default_value = 1.49
    k = nt.nodes.new("ShaderNodeMath"); k.operation = "MULTIPLY"; k.inputs[1].default_value = 0.35  # keep grazing walls see-through
    nt.links.new(fr.outputs[0], k.inputs[0]); nt.links.new(k.outputs[0], mix.inputs[0]); nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(gl.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m
# Off by default: Brayden prefers the file's original frosted case. --clear-acrylic swaps it for clear plastic.
for name, rough in ((("Cube.006", 0.04), ("Card_Slab_v2_Slab_0.002", 0.02)) if "--clear-acrylic" in argv else ()):
    o = bpy.data.objects[name]
    for slot in o.material_slots: slot.material = acrylic("Case_Acrylic", rough)
    o.visible_shadow = False

# The Windows-only HDRI in this file is missing; light the world with Blender's bundled studio HDRI instead.
hdr = glob.glob(os.path.join(os.path.dirname(bpy.app.binary_path), "../Resources/*/datafiles/studiolights/world/studio.exr"))
if hdr and sc.world:
    for n in sc.world.node_tree.nodes:
        if n.type == "TEX_ENVIRONMENT": n.image = bpy.data.images.load(os.path.abspath(hdr[0]), check_existing=True)

r = sc.render
r.engine = "CYCLES"; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
# Several acrylic walls stack up in front of the box; give light enough bounces to get through them.
sc.cycles.max_bounces = 32; sc.cycles.transmission_bounces = 32; sc.cycles.glossy_bounces = 12; sc.cycles.transparent_max_bounces = 32
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = "GPU"
except Exception as e: print("GPU off:", e)
r.resolution_x = r.resolution_y = 1400; r.resolution_percentage = 100
r.film_transparent = True
r.use_compositing = "--keep-comp" in argv
r.image_settings.file_format = "PNG"; r.image_settings.color_mode = "RGBA"
sc.frame_current = sc.frame_start
r.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
if "--save" in argv:
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    print("SAVED")
