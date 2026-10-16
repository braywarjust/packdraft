# Renders the shared slab back from PackDraft-3D-Slab.blend, framed like the 1200×1200 slab scans.
#   Blender -b PackDraft-3D-Slab.blend -P scripts/slab-back/render.py -- <texDir> <out.png> [samples] [--clarity 0.5] [--clear-acrylic] [--scan-lights] [--save]
import bpy, sys, os, glob, math

argv = sys.argv[sys.argv.index("--") + 1:]
TEX, OUT = argv[0], argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 256
sc = bpy.context.scene

for o in bpy.data.objects:
    o.animation_data_clear()
    if o.type == "MESH":
        # Only the slab itself: case, inner case, label and card. The bubbles/spheres were showroom props.
        o.hide_render = o.name not in ("CASE", "INNER CASE", "LABEL", "Plane.001")

def set_tex(mat, file):
    tex = next(n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE")
    tex.image = bpy.data.images.load(os.path.join(TEX, file), check_existing=False)
    tex.interpolation = "Cubic"
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 0.6
    bsdf.inputs["Specular IOR Level"].default_value = 0.15  # printed paper, not gloss
    return bsdf
set_tex(bpy.data.materials["Material.002"], "label.png")
set_tex(bpy.data.materials["Material.001"], "card.png")

# Default keeps the file's original frosted case materials (Brayden's call). --clear-acrylic swaps in clear
# plastic over a grey insert, closer to a flat scanner look.
if "--clear-acrylic" in argv:
    # Clear acrylic case (the original had frosted/dispersion shaders that hazed the label) over a light grey
    # insert, which is what the scans show around the card.
    def plastic(name, rough):
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        b.inputs["Base Color"].default_value = (0.95, 0.96, 0.97, 1)
        b.inputs["Transmission Weight"].default_value = 1.0
        b.inputs["Roughness"].default_value = rough
        b.inputs["IOR"].default_value = 1.49
        return m
    for name, rough in (("CASE", 0.06), ("INNER CASE", 0.02)):
        o = bpy.data.objects[name]
        for slot in o.material_slots: slot.material = plastic("Scan_Acrylic_" + name.replace(" ", "_"), rough)
        o.visible_shadow = False  # let light reach the card directly; Cycles won't do caustics through the acrylic
    ins = bpy.data.objects.get("Scan_Insert")
    if not ins:
        me = bpy.data.meshes.new("Scan_Insert")
        x0, x1, z0, z1, y = -0.121, 0.120, 0.017, 0.429, 0.0046
        me.from_pydata([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [], [(0, 1, 2, 3)])
        ins = bpy.data.objects.new("Scan_Insert", me); sc.collection.objects.link(ins)
        m = bpy.data.materials.new("Scan_Insert"); m.use_nodes = True
        bb = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bb.inputs["Base Color"].default_value = (0.5, 0.52, 0.55, 1); bb.inputs["Roughness"].default_value = 0.6
        me.materials.append(m)
    ins.hide_render = False
elif "--clarity" in argv:
    # --clarity C (0–1): keep the frosted case but cut its blur and glare so the label and card read.
    c = float(argv[argv.index("--clarity") + 1])
    for m in {s.material for o in ("CASE",) for s in bpy.data.objects[o].material_slots if s.material}:
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if b:
            b.inputs["Roughness"].default_value *= (1 - c)
            b.inputs["IOR"].default_value = 1.5 + (b.inputs["IOR"].default_value - 1.5) * (1 - c)

# Straight-on orthographic camera, slab filling the frame height like the scans.
cam = bpy.data.objects.get("Scan_Cam") or bpy.data.objects.new("Scan_Cam", bpy.data.cameras.new("Scan_Cam"))
if cam.name not in sc.collection.objects: sc.collection.objects.link(cam)
cam.data.type = "ORTHO"
cam.data.ortho_scale = 0.4157 / 0.985
cam.location = (-0.0006, -1.0, 0.2228)
cam.rotation_euler = (math.radians(90), 0, 0)
sc.camera = cam

hdr = glob.glob(os.path.join(os.path.dirname(bpy.app.binary_path), "../Resources/*/datafiles/studiolights/world/studio.exr"))
if "--scan-lights" in argv:
    # Scanner-like light: big soft panels from the front, a little from above to pick out the case bevels.
    def area(name, loc, rot, energy, size):
        l = bpy.data.objects.get(name) or bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
        if l.name not in sc.collection.objects: sc.collection.objects.link(l)
        l.data.energy, l.data.size = energy, size
        l.location, l.rotation_euler = loc, rot
        return l
    for o in bpy.data.objects:
        if o.type == "LIGHT": o.hide_render = True
    # Lights sit off-axis so the flat acrylic face never mirrors them straight into the camera (that washes the art out).
    for l in (area("Scan_Left", (-0.75, -0.6, 0.45), (math.radians(70), 0, math.radians(-50)), 4, 0.9),
              area("Scan_Right", (0.75, -0.6, 0.35), (math.radians(75), 0, math.radians(50)), 3, 0.9),
              area("Scan_Top", (0, -0.35, 0.95), (math.radians(25), 0, 0), 1.5, 0.8)):
        l.hide_render = False; l.visible_camera = False

    w = bpy.data.worlds.new("ScanWorld"); sc.world = w; w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear()
    bg, out = nt.nodes.new("ShaderNodeBackground"), nt.nodes.new("ShaderNodeOutputWorld")
    hdr = glob.glob(os.path.join(os.path.dirname(bpy.app.binary_path), "../Resources/*/datafiles/studiolights/world/studio.exr"))
    if hdr:
        env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(os.path.abspath(hdr[0]), check_existing=True)
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.25
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
elif hdr and sc.world:
    # Original lights and world. The file's HDRI is a missing Windows path, so swap in Blender's studio HDRI.
    for n in sc.world.node_tree.nodes:
        if n.type == "TEX_ENVIRONMENT": n.image = bpy.data.images.load(os.path.abspath(hdr[0]), check_existing=True)

r = sc.render
r.engine = "CYCLES"
sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = "GPU"
except Exception as e: print("GPU off:", e)
r.resolution_x = r.resolution_y = 1200; r.resolution_percentage = 100
r.film_transparent = True
r.use_compositing = False  # the file had a lens-dispersion comp that smeared the label text
r.image_settings.file_format = "PNG"; r.image_settings.color_mode = "RGBA"
if "--scan-lights" in argv:
    sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"; sc.view_settings.exposure = -0.35
sc.frame_current = sc.frame_start
r.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
if "--save" in argv:
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    print("SAVED")
