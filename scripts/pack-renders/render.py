# Renders the Pack Shop images from PackDraft.blend.
#   Blender -b PackDraft.blend -P scripts/pack-renders/render.py -- <wrapsDir> <outDir> [ids,...] [samples] [--save]
# Strips every animation, assembles the pack at rest, applies each pack's wrap and renders a transparent PNG.
import bpy, sys, os, glob, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
WRAPS, OUT = argv[0], argv[1]
IDS = argv[2].split(",") if len(argv) > 2 and argv[2] else ["rookie", "starter", "pro", "allpro", "hof", "goat"]
SAMPLES = int(argv[3]) if len(argv) > 3 else 256
SAVE = "--save" in argv
sc = bpy.context.scene

# 1. Remove all animation.
for coll in (bpy.data.objects, bpy.data.cameras, bpy.data.lights, bpy.data.materials, bpy.data.meshes, bpy.data.worlds):
    for idb in coll:
        idb.animation_data_clear()
        if getattr(idb, "node_tree", None): idb.node_tree.animation_data_clear()
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
sc.frame_start = sc.frame_end = sc.frame_current = 0

# 2. Assemble the pack at rest; hide everything else.
root, body, top = (bpy.data.objects[n] for n in ("A_PackRoot", "A_PackBody", "A_PackTop"))
root.location, root.rotation_euler, root.scale = (0, 0, 0), (0, 0, 0), (1, 1, 1)
top.location, top.rotation_euler = (-0.04003, 0, 0.04352), (0, 0, 0)
for o in bpy.data.objects:
    if o.type in {"MESH", "LIGHT", "CURVE", "FONT"}:
        o.hide_render = o.name not in ("A_PackBody", "A_PackTop")
for o in (root, body, top): o.hide_render = o.hide_viewport = False
# Slight three-quarter turn so the foil catches the light.
root.rotation_euler = (math.radians(4), 0, math.radians(-14))

# 3. Shop camera + studio lights.
def obj(name, data):
    o = bpy.data.objects.get(name)
    if o: bpy.data.objects.remove(o)
    o = bpy.data.objects.new(name, data); sc.collection.objects.link(o); return o
cam = obj("Shop_Cam", bpy.data.cameras.new("Shop_Cam"))
cam.data.lens, cam.data.sensor_fit = 85, "AUTO"
cam.location = (0, -0.37, -0.004)
cam.rotation_euler = (math.radians(90), 0, 0)
sc.camera = cam

def area(name, loc, energy, size, color=(1, 1, 1)):
    l = obj(name, bpy.data.lights.new(name, "AREA"))
    l.data.energy, l.data.size, l.data.color = energy, size, color
    l.location = loc
    d = Vector((0, 0, 0)) - Vector(loc)
    l.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    l.hide_render = False
    return l
area("Shop_Key", (-0.25, -0.3, 0.22), 6, 0.25)
area("Shop_Fill", (0.3, -0.25, 0.0), 1.8, 0.35, (0.85, 0.9, 1))
area("Shop_Rim", (0.12, 0.3, 0.25), 7, 0.2, (1, 0.95, 0.9))

# Soft white reflector cards (hidden from the camera) so the chrome ends mirror something bright.
def card(name, loc, size, strength):
    me = bpy.data.meshes.get(name) or bpy.data.meshes.new(name)
    me.clear_geometry(); me.from_pydata([(-size, -size, 0), (size, -size, 0), (size, size, 0), (-size, size, 0)], [], [(0, 1, 2, 3)])
    o = obj(name, me)
    o.location = loc
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("Z", "Y").to_euler()
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True
    mn = m.node_tree.nodes; mn.clear()
    em, mo = mn.new("ShaderNodeEmission"), mn.new("ShaderNodeOutputMaterial")
    em.inputs["Strength"].default_value = strength
    m.node_tree.links.new(em.outputs[0], mo.inputs["Surface"])
    me.materials.clear(); me.materials.append(m)
    o.visible_camera = False; o.visible_shadow = False; o.hide_render = False
card("Shop_Reflector_Top", (0, -0.2, 0.3), 0.2, 2.0)
card("Shop_Reflector_Low", (-0.1, -0.3, -0.2), 0.2, 1.5)

w = sc.world or bpy.data.worlds.new("World"); sc.world = w
w.use_nodes = True
nt = w.node_tree; nt.nodes.clear()
hdr = glob.glob(os.path.join(os.path.dirname(bpy.app.binary_path), "../Resources/*/datafiles/studiolights/world/studio.exr"))
bg, outn = nt.nodes.new("ShaderNodeBackground"), nt.nodes.new("ShaderNodeOutputWorld")
bg.inputs["Strength"].default_value = 0.35
if hdr:
    env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(os.path.abspath(hdr[0]), check_existing=True)
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
nt.links.new(bg.outputs["Background"], outn.inputs["Surface"])

# 4. Foil wrapper materials.
CRIMP_SCALE = 38.0
def setup(mat):
    n = mat.node_tree.nodes
    bsdf = next(x for x in n if x.type == "BSDF_PRINCIPLED")
    tex = next(x for x in n if x.type == "TEX_IMAGE")
    if not bsdf.inputs["Base Color"].is_linked: mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Metallic"].default_value = 0.2
    bsdf.inputs["Roughness"].default_value = 0.3
    if "Coat Weight" in bsdf.inputs: bsdf.inputs["Coat Weight"].default_value = 0.25; bsdf.inputs["Coat Roughness"].default_value = 0.08
    tex.interpolation = "Cubic"
    # Chrome ends: the tear strip (v > 0.834) and bottom seal (v < 0.14) become polished metal with bumpy crimps.
    nt = mat.node_tree
    for x in [x for x in n if x.label.startswith("chrome")]: n.remove(x)
    def node(t, label, **kw):
        x = n.new(t); x.label = "chrome " + label
        for k, v in kw.items(): setattr(x, k, v)
        return x
    uv = node("ShaderNodeUVMap", "uv", uv_map="PackUV")
    sep = node("ShaderNodeSeparateXYZ", "sep")
    hi = node("ShaderNodeMath", "hi", operation="GREATER_THAN"); hi.inputs[1].default_value = 0.834
    lo = node("ShaderNodeMath", "lo", operation="LESS_THAN"); lo.inputs[1].default_value = 0.14
    mask = node("ShaderNodeMath", "mask", operation="MAXIMUM")
    met = node("ShaderNodeMapRange", "metal"); met.inputs["To Min"].default_value = 0.75; met.inputs["To Max"].default_value = 1.0
    rough = node("ShaderNodeMapRange", "rough"); rough.inputs["To Min"].default_value = 0.2; rough.inputs["To Max"].default_value = 0.17
    bump = node("ShaderNodeBump", "bump"); bump.inputs["Distance"].default_value = 0.0004
    bstr = node("ShaderNodeMath", "bstr", operation="MULTIPLY"); bstr.inputs[1].default_value = 0.25
    L = nt.links.new
    L(uv.outputs["UV"], sep.inputs[0]); L(uv.outputs["UV"], tex.inputs["Vector"])
    L(sep.outputs["Y"], hi.inputs[0]); L(sep.outputs["Y"], lo.inputs[0])
    L(hi.outputs[0], mask.inputs[0]); L(lo.outputs[0], mask.inputs[1])
    L(mask.outputs[0], met.inputs["Value"]); L(mask.outputs[0], rough.inputs["Value"]); L(mask.outputs[0], bstr.inputs[0])
    L(met.outputs["Result"], bsdf.inputs["Metallic"]); L(rough.outputs["Result"], bsdf.inputs["Roughness"])
    L(bstr.outputs[0], bump.inputs["Strength"]); L(tex.outputs["Color"], bump.inputs["Height"])
    # Crimp ridges across the whole wrapper: fine vertical bands feeding a second bump.
    wave = node("ShaderNodeTexWave", "wave", wave_type="BANDS", bands_direction="X", wave_profile="SIN")
    wave.inputs["Scale"].default_value = CRIMP_SCALE
    wave.inputs["Distortion"].default_value = 0
    crimp = node("ShaderNodeBump", "crimp"); crimp.inputs["Strength"].default_value = 0.35; crimp.inputs["Distance"].default_value = 0.0003
    L(uv.outputs["UV"], wave.inputs["Vector"]); L(wave.outputs["Color"], crimp.inputs["Height"])
    L(crimp.outputs["Normal"], bump.inputs["Normal"]); L(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return tex
tf, tb = setup(bpy.data.materials["M_PackFront"]), setup(bpy.data.materials["M_PackBack"])

# 5. Render settings.
r = sc.render
try: r.engine = "CYCLES"
except TypeError: pass
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = "GPU"
except Exception as e: print("GPU off:", e)
r.resolution_x, r.resolution_y, r.resolution_percentage = 800, 1100, 100
r.film_transparent = True
r.image_settings.file_format = "PNG"; r.image_settings.color_mode = "RGBA"
# AgX with a punchy look keeps the wrap colours saturated while taming the foil highlights.
try:
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Punchy"
except TypeError:
    sc.view_settings.view_transform = "Standard"

os.makedirs(OUT, exist_ok=True)
for pid in IDS:
    tf.image = bpy.data.images.load(os.path.join(WRAPS, f"{pid}_front.png"), check_existing=False)
    tb.image = bpy.data.images.load(os.path.join(WRAPS, f"{pid}_back.png"), check_existing=False)
    r.filepath = os.path.join(OUT, f"{pid}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", pid)

if SAVE:
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
    print("SAVED", bpy.data.filepath)
