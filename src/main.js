import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

/* error එකක් ආවොත් තිරය මත රතු පෙට්ටියක පෙන්නනවා (සුදු තිරයක් වෙනුවට) */
function showErr(msg) {
  let el = document.getElementById('err-overlay')
  if (!el) {
    el = document.createElement('pre')
    el.id = 'err-overlay'
    Object.assign(el.style, { position: 'fixed', left: '0', top: '0', right: '0', maxHeight: '50vh', overflow: 'auto', margin: '0', padding: '12px', background: 'rgba(120,0,0,.92)', color: '#fff', font: '12px/1.4 monospace', zIndex: 99999, whiteSpace: 'pre-wrap' })
    document.body.appendChild(el)
  }
  el.textContent += msg + '\n'
}
addEventListener('error', e => showErr('ERROR: ' + e.message + ' (' + String(e.filename || '').split('/').pop() + ':' + e.lineno + ')'))
addEventListener('unhandledrejection', e => showErr('PROMISE: ' + ((e.reason && e.reason.message) || e.reason)))

/* =====================================================================
   SETTINGS
   ===================================================================== */

const BASE = '/'

const FILES = {
  trees: ['tree_low_poly_lowpoly', 'scene', 'tree1', 'tree2', 'tree3', 'tree4'],
  treehouse: ['treehouse', 'tree_house'],                                 // ගස් ගෙදර (treehouse.gltf) - එක්වරක් විතරක්
  rocks: ['ruined_rock_fence'],
  flock: ['12_animated_butterflies'],
  grass: ['grass1', 'grass2'],
  plants: ['scanned_plants_and_grass_free_download', 'plant1', 'plant2', 'plant3'],
  boat: ['boat'],
  lamp: ['wooden lantern 3d model', 'lamp'],
  bridge: ['bridge'],
  dock: ['dock'],
  butterfly: ['butterfly'],
  water: ['water', 'small_flat_cube_of_water'],
  floor: ['forest_ground_08', 'floor'],
  moss: ['moss'],
}
const BUTTERFLY_FBX = 'BUTTERFLY.fbx'
const ROCK_FBX = 'rock3.fbx'

/* ---- දුර (gap) වෙනස් කරන්න මේ 3 වෙනස් කරන්න ---- */
const EXT = 60        // පාලම => තොටුපළ අතර පාර (road) දිග
const RIV = 32        // බෝට්ටුවෙන් යන ගඟ දිග වැඩි කිරීම
const POOL = 14       // බෝට්ටුව නවතින තැන => දිය ඇල්ල (pool) දුර
const S1 = EXT                    // තොටුපළ / ගඟ පටන් ගැනීම
const S2 = EXT + RIV              // ගල් තට්ටුව
const S3 = EXT + RIV + POOL       // දිය ඇල්ල

const CHAR_HEIGHT = 1.8      // ඇයගේ උස (m)
const CHAR_GLOW = 0.12
const BOARD_S = 57 + S1
const LAND_S = 120.5 + S2
const MAX_PROGRESS = 134 + S2
const LAND_Z = -133 - S2
const WF = -145 - S3         // දිය ඇල්ලේ පාදම z
const END_CAM = { dist: 5.6, h: 2.2, look: 2.2 }   // අවසාන shot: dist = දුර (වැඩි = දුරින්), h = උස, look = බලන උස (වැඩි = දිය ඇල්ලත් පේනවා)
const CAM_DIST = 4.3          // ඇවිදිද්දී camera දුර (අඩු = ඇයට ළං)
const CAM_HEIGHT = 2.7
const WATER_Y = -0.45
const BG = '#16201d'
const PATH_HW = 3.0

const SZ = {
  tree: 9,
  fence: 3.4,
  fenceSmall: 2.6,
  rockBank: 3.8,
  rockPath: 2.6,
  rockRim: 2.2,
  fenceCliff: 7,
  fenceFall: 5.5,
  smallPlant: 0.4,
  moss: 1.8,
  bridgeRise: 0.9,
  grass: 0.7,
  plant: 1.1,
  boatLen: 4.4,
  boatFlip: false,
  boatDraft: -0.05,
  lampH: 2.4,
  lampLightY: 0.85,
  bridgeLen: 7,
  dockLen: 9,
  butterfly: 0.55,
  flock: 4.5,
  waterTile: 16,
  waterThick: 0.3,
}
const BOAT_FLOOR = 0.35
const BOAT_LIFT = 0.24      // බෝට්ටුව වතුරෙන් උඩට (ඇතුළට වතුර නොපෙනෙන්න)
const PIER_Y = 0.12
const BRIDGE_DECK_Y = 0.15
const LAMP_CULL = 62

const OAR = { rot: [0, 0, 90], off: [0, 0, 0], hand: 'Right' }

const LOW = matchMedia('(max-width: 800px)').matches
/* LITE = සැහැල්ලු mode (default). ඉහළ quality ඕන නම් URL එකට ?hq එකතු කරන්න: localhost:5173/?hq */
const LITE = !location.search.includes('hq')
const pick = (lite, full) => (LITE || LOW) ? lite : full
/* 128MB GPU වගේ පොඩි ඒවාට: render resolution (0.7 = 70%), texture උපරිම ප්‍රමාණය, දුර ඉවත් කිරීම (culling) */
let RES = LITE ? 0.7 : Math.min(window.devicePixelRatio || 1, 1.5)
const MAXT = pick(512, 1024)
const CULL = LITE ? 90 : 110
const ADAPT = LITE                      // FPS අඩු නම් resolution එක ඉබේම අඩු කරනවා
const COUNT = {
  treeNear: pick(380, 800),
  treeFar: pick(520, 1300),
  grass: 0,
  plants: pick(140, 520),
  smallPlants: pick(450, 1700),
  moss: pick(80, 300),
  bankRocks: pick(30, 70),
  pathRocks: pick(8, 20),
  butterflies: pick(7, 9),
  fireflies: pick(260, 1000),
}

/* =====================================================================
   HELPERS
   ===================================================================== */
const clamp = THREE.MathUtils.clamp
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const rand = (a, b) => a + Math.random() * (b - a)
const pathX = z => 4 * Math.sin(z * 0.05)
const dirAt = s => new THREE.Vector3(-0.2 * Math.cos(s * 0.05), 0, -1).normalize()
const riverMask = z => ss(-51 - S1, -55 - S1, z)
const riverHW = z => 4.2 + 4.5 * ss(-118 - S2, -140 - S3, z)
const noise3 = (x, y, z) => Math.sin(x * 1.7 + y * 2.3) * Math.cos(z * 1.9 + x * 1.1) * 0.5 + Math.sin(y * 3.1 + z * 2.7) * 0.5
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/* ---- ගස් ගෙදර (tree_low_poly_lowpoly.glb): පාර අයිනේ, ඇය ඉණිමගෙන් නැගලා උඩ Waving කරනවා ---- */
const TH = {
  z: -17,                     // පාරේ කොතනටද (z)
  side: 1,                    // 1 = දකුණු පැත්ත, -1 = වම් පැත්ත
  off: 10.5,                  // පාරේ මැද සිට දුර (m)
  height: 11.5,               // ගෙයි + ගහේ සම්පූර්ණ උස (m)
  yaw: 0,                     // කරකැවීම (අංශක). ඉණිමග පාර දිහා නොබලනවා නම්: game එකේ Y ඔබන්න (90° බැගින්)
  s0: 10, s1: 30,             // scroll අගයන් අතර ඉණිමගෙන් නගිනවා
  stairFoot: [-0.22, 0.30],   // ඉණිමං පාමුල (ගෙයි පළල/ගැඹුරේ භාගයේ ප්‍රතිශතයක්: x, z)
  stairTop: [-0.10, 0.20],    // ඉණිමං මුදුන
  deckY: 0.27,                // ගෙයි බිම උස (සම්පූර්ණ උසේ ප්‍රතිශතයක්)
  deck: [0.05, 0.0],          // ගෙයි බිම ඇය නවතින තැන
  climb: true,                // false කළොත් නගින්නේ නැහැ
}
const TH_X = pathX(TH.z) + TH.side * TH.off
const TH_Z = TH.z
const inHouse = (x, z) => Math.hypot(x - TH_X, z - TH_Z) < 9.5
let thHolder = null, thWay = null, thDbg = null, thAuto = null, thLight = null, thK = 1

/* =====================================================================
   RENDERER / SCENE
   ===================================================================== */
const scene = new THREE.Scene()
scene.background = new THREE.Color(BG)
scene.fog = new THREE.Fog(BG, 16, LITE ? 92 : 100)          // ගස් ඈතටත් පේන්න (fog අඩු)

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, LITE ? 200 : 260)
camera.position.set(0, 3, 7)

function makeRenderer() {                                   // WebGL fail උනොත් සරල විදිහට නැවත උත්සාහ කරනවා
  const tries = [
    { antialias: !LITE, powerPreference: 'high-performance' },
    { antialias: false, powerPreference: 'default' },
    { antialias: false, powerPreference: 'low-power' },
  ]
  for (const opts of tries) {
    try { return new THREE.WebGLRenderer(opts) } catch (e) { console.warn('WebGL try failed', opts, e) }
  }
  document.body.style.background = '#16201d'
  showErr('WebGL පටන් ගන්න බැහැ.\n1) Edge/Chrome සම්පූර්ණයෙන්ම වසලා නැවත open කරන්න\n2) Settings => System => "Use graphics acceleration when available" ON කරන්න\n3) වෙනත් WebGL tabs (three.js / games) වසන්න\n4) edge://gpu එකේ WebGL "Hardware accelerated" ද බලන්න')
  throw new Error('WebGL unavailable')
}
const renderer = makeRenderer()
renderer.domElement.addEventListener('webglcontextlost', e => {
  e.preventDefault()
  showErr('WebGL context lost (GPU එක අමාරුවෙලා). Tab එක reload කරන්න.')
})
renderer.setPixelRatio(1)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.98
renderer.shadowMap.enabled = true                          // ඇයගේ සෙවණැල්ල (පොඩි shadow map එකක් - VRAM 4MB)
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.style.margin = 0
document.body.style.overflow = 'hidden'
document.body.style.background = BG
document.body.appendChild(renderer.domElement)

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const BLOOM_K = LITE ? 0.5 : 1                                  // bloom අඩ resolution එකෙන් (වේගවත්)
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth * BLOOM_K, innerHeight * BLOOM_K), 0.38, 0.55, 0.93)
composer.addPass(bloom)
composer.addPass(new OutputPass())

/* canvas එක RES ප්‍රමාණයෙන් render කරලා CSS වලින් තිරයට ඇදගන්නවා (VRAM + වේගය) */
function applySize() {
  /* ඕනම තිරයකට: portrait (ෆෝන්) වලදී FOV වැඩි කරනවා ඇය සහ පරිසරය පෙනෙන්න */
  const asp = innerWidth / Math.max(1, innerHeight)
  camera.aspect = asp
  camera.fov = asp >= 1.45 ? 50 : Math.min(88, 2 * Math.atan(Math.tan(25 * Math.PI / 180) * 1.45 / asp) * 180 / Math.PI)
  camera.updateProjectionMatrix()
  const w = Math.max(2, Math.round(innerWidth * RES)), h = Math.max(2, Math.round(innerHeight * RES))
  renderer.setSize(w, h, false)
  const cs = renderer.domElement.style
  cs.position = 'fixed'; cs.left = '0'; cs.top = '0'; cs.width = '100vw'; cs.height = (window.CSS && CSS.supports('height', '100dvh')) ? '100dvh' : '100vh'; cs.display = 'block'; cs.touchAction = 'none'
  composer.setSize(w, h)
  bloom.setSize(w * BLOOM_K, h * BLOOM_K)
}
applySize()

/* ---------- Loading overlay ---------- */
const loadingEl = document.createElement('div')
Object.assign(loadingEl.style, {
  position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: BG, color: '#d9c9a3', font: '13px/1.6 system-ui, sans-serif', letterSpacing: '0.25em',
  zIndex: 10, transition: 'opacity 1s', pointerEvents: 'none'
})
loadingEl.textContent = 'GROWING THE FOREST…'
document.body.appendChild(loadingEl)

/* =====================================================================
   LIGHTS
   ===================================================================== */
scene.add(new THREE.HemisphereLight(0x9ab8c0, 0x2e3e2e, 0.8))
const moon = new THREE.DirectionalLight(0xb4ccff, 1.2)
moon.position.set(-10, 20, 5)
scene.add(moon)

/* ඇයව ලස්සනට පෙන්නන්න: key (උණුසුම්, camera පැත්තෙන් උඩින්) + rim (සීතල, පිටිපස්සෙන්). වැඩිය දීප්තිමත් නොවී ස්වභාවිකව */
const pool = new THREE.SpotLight(0xffd98a, 150, 22, 0.55, 0.9, 2)   // කහ පැහැති key light (ඇයට පමණක් - බිම වැඩිය නොදැල්වෙන්න)
pool.castShadow = true
pool.shadow.mapSize.set(1024, 1024)
pool.shadow.bias = -0.0004
pool.shadow.normalBias = 0.03
pool.shadow.camera.near = 1
pool.shadow.camera.far = 16
pool.shadow.radius = 4
scene.add(pool, pool.target)
const rim = new THREE.DirectionalLight(0x9fc2ff, 0.8)
scene.add(rim, rim.target)
const fill = new THREE.PointLight(0xffc860, 5, 6, 2)             // ඇය වටේ මෘදු කහ ආලෝකය
scene.add(fill)

const lampLights = Array.from({ length: LITE ? 3 : 5 }, () => {      // ළඟම තියෙන lantern වලට ආලෝකය (lamp ලඟ දැල්වෙනවා)
  const l = new THREE.PointLight(0xffa850, 26, 15, 2)
  scene.add(l)
  return l
})
thLight = new THREE.PointLight(0xffc860, 0, 8, 2)                       // ගස් ගෙදරේම ආලෝකය (ළඟ ගහට නෙමෙයි)
const thLight2 = new THREE.PointLight(0xffd060, 0, 8, 2)            // ගස ළඟ කහ ආලෝකය
scene.add(thLight, thLight2)

/* =====================================================================
   TEXTURES
   ===================================================================== */
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.25, 'rgba(255,255,255,0.6)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const glow = glowTexture()
const glowDisc = new THREE.Mesh(                         // ඇය යට බිමේ ආලෝක කවය
  new THREE.CircleGeometry(2.4, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(1, 0.84, 0.58), transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false })
)
scene.add(glowDisc)

const haloMat = new THREE.SpriteMaterial({
  map: glow, color: new THREE.Color(1, 0.62, 0.22), blending: THREE.AdditiveBlending,
  depthWrite: false, transparent: true, opacity: 0.6
})
const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.78, 0.4).multiplyScalar(3.2), toneMapped: false })
const lampDiscMat = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(1, 0.62, 0.25), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
const lampDiscGeo = new THREE.CircleGeometry(2.2, 20).rotateX(-Math.PI / 2)
const bulbGeo = new THREE.SphereGeometry(1, 10, 8)

function fallTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 512
  const g = c.getContext('2d')
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 128, w = 1 + Math.random() * 4, a = 0.15 + Math.random() * 0.6
    const grad = g.createLinearGradient(0, 0, 0, 512)
    grad.addColorStop(0, `rgba(255,255,255,${a})`)
    grad.addColorStop(0.5, `rgba(255,255,255,${a * 0.3})`)
    grad.addColorStop(1, `rgba(255,255,255,${a})`)
    g.fillStyle = grad
    g.fillRect(x, 0, w, 512)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, 3)
  return t
}

/* =====================================================================
   WIND
   ===================================================================== */
const wind = { uTime: { value: 0 } }
function addWind(mat, H, amp = 1) {
  if (!mat || mat.userData.windDone) return
  mat.userData.windDone = true
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.uTime
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hh = clamp(position.y / ${H.toFixed(2)}, 0.0, 1.0);
        float sw = hh * hh * ${amp.toFixed(2)};
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3][0] * 0.31 + instanceMatrix[3][2] * 0.17;
        #else
          float ph = 0.0;
        #endif
        transformed.x += (sin(uTime * 1.1 + ph) * 0.10 + sin(uTime * 2.7 + ph * 2.3) * 0.035) * sw;
        transformed.z += (cos(uTime * 0.9 + ph * 1.3) * 0.07) * sw;`)
  }
  mat.customProgramCacheKey = () => 'wind' + H.toFixed(2) + '_' + amp
  mat.needsUpdate = true
}

/* =====================================================================
   TERRAIN
   ===================================================================== */
const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
let terrainGeo = null

function groundH(x, z) {
  const dx = Math.abs(x - pathX(z))
  const rm = riverMask(z), hw = riverHW(z)
  const river = -1.4 * rm * (1 - ss(hw * 0.55, hw * 1.15, dx))
  const stream = -1.0 * (1 - ss(1.3, 2.7, Math.abs(z + 35)))
  const wet = Math.max(1 - ss(1.5, 4.5, Math.abs(z + 35)), rm * (1 - ss(hw * 0.9, hw * 1.5, dx)))
  const hills = (Math.sin(x * 0.21 + z * 0.13) * 0.5 + Math.sin(x * 0.07 - z * 0.17) * 0.5 + 1) * 0.5
  const bump = hills * 1.6 * ss(PATH_HW + 1.5, PATH_HW + 9, dx) * (1 - wet) * ss(6, 11, Math.hypot(x - TH_X, z - TH_Z))
  return Math.min(river, stream) + bump
}

{
  const geo = new THREE.PlaneGeometry(400, 340, LITE ? 170 : 270, LITE ? 190 : 300)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0, -110)
  const pos = geo.attributes.position
  const cols = new Float32Array(pos.count * 3)
  const cGrass = new THREE.Color('#1c3120'), cDirt = new THREE.Color('#8a6f52'), cMud = new THREE.Color('#2a2a22')
  const tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const h = groundH(x, z)
    pos.setY(i, h)
    const dx = Math.abs(x - pathX(z))
    const pathM = (1 - ss(PATH_HW * 0.6, PATH_HW, dx)) * (1 - riverMask(z))
    tmp.copy(cGrass).lerp(cDirt, pathM)
    if (h < -0.1) tmp.lerp(cMud, 0.8)
    cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  geo.computeVertexNormals()
  terrainGeo = geo
  const groundMesh = new THREE.Mesh(geo, groundMat)
  groundMesh.receiveShadow = true
  scene.add(groundMesh)
}

{
  const tl = new THREE.TextureLoader()
  const setup = (t, srgb) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(100, 80)
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  tl.load('/textures/ground_diff.jpg', t => { shrinkTex(t, 1024); groundMat.map = setup(t, true); groundMat.color.set(0xffffff); groundMat.needsUpdate = true }, undefined, () => {})
  if (!LITE) {
    tl.load('/textures/ground_nor.jpg', t => { shrinkTex(t, 1024); groundMat.normalMap = setup(t, false); groundMat.needsUpdate = true }, undefined, () => {})
    tl.load('/textures/ground_rough.jpg', t => { shrinkTex(t, 1024); groundMat.roughnessMap = setup(t, false); groundMat.needsUpdate = true }, undefined, () => {})
  }
}

/* forest_ground_08.glb / floor.gltf ඒකේ texture බිමට දානවා */
function applyFloor(gltf) {
  let mat = null
  gltf.scene.traverse(o => { if (!mat && o.isMesh) mat = Array.isArray(o.material) ? o.material[0] : o.material })
  if (!mat) return
  const set = (k, srgb) => {
    if (!mat[k]) return
    const t = mat[k].clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(100, 80)
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.needsUpdate = true
    groundMat[k] = t
  }
  set('map', true)
  if (!LITE) { set('normalMap', false); set('roughnessMap', false) }
  groundMat.color.set(0xffffff)
  if (terrainGeo) {
    const c = terrainGeo.attributes.color
    for (let i = 0; i < c.array.length; i++) c.array[i] = 0.55 + 0.45 * c.array[i]
    c.needsUpdate = true
  }
  groundMat.needsUpdate = true
}

/* =====================================================================
   WATER
   ===================================================================== */
let waterMesh = null
const f1 = n => n.toFixed(1)
const waterMat = new THREE.ShaderMaterial({
  transparent: true,
  fog: true,
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#010709') },
      uSky: { value: new THREE.Color('#22384a') }
    }
  ]),
  vertexShader: `
    uniform float uTime;
    varying vec3 vWorld;
    #include <fog_pars_vertex>
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      w.y += sin(w.x * 0.9 + uTime * 1.2) * 0.015 + sin(w.z * 0.7 - uTime * 1.6) * 0.015;
      vWorld = w.xyz;
      vec4 mvPosition = viewMatrix * w;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uDeep;
    uniform vec3 uSky;
    varying vec3 vWorld;
    #include <fog_pars_fragment>
    float vhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(vhash(i), vhash(i + vec2(1.0, 0.0)), f.x),
                 mix(vhash(i + vec2(0.0, 1.0)), vhash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float hgt(vec2 p) {
      vec2 q = p;
      q.y -= uTime * 0.9;
      return vnoise(q * 1.2) * 0.55
           + vnoise(q * 2.7 + vec2(4.0, -uTime * 0.25)) * 0.35${LITE ? '' : `
           + vnoise(q * 6.0 + vec2(-uTime * 0.4, -uTime * 0.8)) * 0.2`};
    }
    void main() {
      vec2 p = vWorld.xz;
      float e = 0.07;
      float h0 = hgt(p);
      float hx = hgt(p + vec2(e, 0.0)) - h0;
      float hz = hgt(p + vec2(0.0, e)) - h0;
      vec3 n = normalize(vec3(-hx * 9.0, 1.0, -hz * 9.0));
      vec3 v = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);

      float bd = abs(vWorld.x - 4.0 * sin(vWorld.z * 0.05));
      float hw = 4.2 + 4.5 * (1.0 - smoothstep(${f1(-140 - S3)}, ${f1(-118 - S2)}, vWorld.z));
      float depth = 1.0 - smoothstep(0.05 * hw, 0.9 * hw, bd);
#ifdef STREAM
      depth = 0.65;
#endif
      vec3 col = mix(vec3(0.02, 0.07, 0.085), uDeep, depth);

      float pool = 1.0 - smoothstep(${f1(LAND_Z + 1)}, ${f1(LAND_Z + 15)}, vWorld.z);
      float c1 = vnoise(p * 2.2 + vec2(uTime * 0.3, uTime * 0.2));
      float c2 = vnoise(p * 2.9 - vec2(uTime * 0.25, uTime * 0.35));
      float caustic = max(pow(max(1.0 - abs(c1 - c2) * 2.2, 0.0), 6.0), 0.0);
      col *= 1.0 - 0.3 * pool;                                  // pool එකේ වතුර තවත් අඳුරු (ගැඹුරු)
      col += vec3(0.03, 0.24, 0.32) * pool * (0.12 + caustic * 0.7);

      vec3 skyCol = mix(uSky, vec3(0.5, 0.62, 0.78), fres);
      col = mix(col, skyCol, fres * 0.7 + 0.05);
      vec3 L = normalize(vec3(0.3, 0.8, 0.5));
      float spec = pow(max(dot(reflect(-L, n), v), 0.0), 120.0);
      col += vec3(0.75, 0.88, 1.0) * spec * 2.6;

      float foam = smoothstep(0.78 * hw, 0.97 * hw, bd) * (0.5 + 0.5 * vnoise(p * 4.0 + vec2(0.0, -uTime * 0.6)));
      float baseFoam = (1.0 - smoothstep(${f1(WF - 1)}, ${f1(WF + 6)}, vWorld.z)) * (0.4 + 0.6 * vnoise(p * 3.5 + vec2(0.0, -uTime * 1.2)));
      foam = clamp(foam + baseFoam, 0.0, 1.0);
#ifdef STREAM
      foam = smoothstep(1.5, 2.1, abs(vWorld.z + 35.0)) * (0.4 + 0.6 * vnoise(p * 4.0 + vec2(uTime * 0.5, 0.0)));
#endif
      col = mix(col, vec3(0.8, 0.9, 0.95), foam * 0.65);

      float alpha = max(mix(0.74, 0.96, depth), foam * 0.9);
      gl_FragColor = vec4(col, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }
  `
})
{
  const WZ0 = -45 - S1, WZ1 = WF - 4
  const WLEN = WZ0 - WZ1
  const geo = new THREE.PlaneGeometry(124, WLEN, 100, Math.ceil(WLEN / 1.4))
  geo.rotateX(-Math.PI / 2)
  waterMesh = new THREE.Mesh(geo, waterMat)
  waterMesh.position.set(0, WATER_Y, (WZ0 + WZ1) / 2)
  scene.add(waterMesh)
}

/* පාලම යට දිය පාර (stream): z = -35 හරහා තියෙන අගල වතුරෙන් පුරවනවා */
{
  const streamMat = waterMat.clone()
  streamMat.defines = { STREAM: 1 }
  streamMat.uniforms = waterMat.uniforms                 // uTime එක share වෙනවා
  const sg = new THREE.PlaneGeometry(130, 5.6, 80, 4)
  sg.rotateX(-Math.PI / 2)
  const stream = new THREE.Mesh(sg, streamMat)
  stream.position.set(0, WATER_Y, -35)
  scene.add(stream)
}

/* water.gltf ටයිල් කරලා ගඟේ ගැඹුරු තට්ටුව ලෙස (shader වතුර යටින්) */
function buildWaterTiles(gltf) {
  const T = SZ.waterTile
  gltf.scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(gltf.scene)
  const size = box.getSize(new THREE.Vector3())
  const c = box.getCenter(new THREE.Vector3())
  const sx = (T + 0.2) / Math.max(size.x, 1e-4)
  const sz = (T + 0.2) / Math.max(size.z, 1e-4)
  const sy = size.y > 0.02 ? SZ.waterThick / size.y : 1
  for (let x = -64; x < 64; x += T) {
    for (let z = -52 - S1; z > WF - 6; z -= T) {
      const m = SkeletonUtils.clone(gltf.scene)
      const h = new THREE.Group()
      h.add(m)
      m.scale.set(sx, sy, sz)
      m.position.set(-c.x * sx, -box.max.y * sy, -c.z * sz)
      h.position.set(x + T / 2, WATER_Y - 0.38, z - T / 2)
      scene.add(h)
    }
  }
}

/* =====================================================================
   ROCK GEOMETRY
   ===================================================================== */
function makeRockGeo(seed = 0, detail = 2, amp = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = 1 + amp * (0.28 * noise3(v.x * 1.6 + seed, v.y * 1.6, v.z * 1.6) + 0.1 * noise3(v.x * 4 + seed, v.y * 4, v.z * 4))
    v.multiplyScalar(n)
    v.y *= 0.75
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.translate(0, 0.55, 0)
  g.computeVertexNormals()
  return g
}
const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true })
const rockTint = () => new THREE.Color().setHSL(rand(0.08, 0.35), rand(0.04, 0.14), rand(0.1, 0.2))

/* =====================================================================
   WATERFALL + CLIFF
   ===================================================================== */
const CX = pathX(WF)
const fallTex = fallTexture()
let cliffMesh = null
const MIST = LITE ? 130 : 260
const mistGeo = new THREE.BufferGeometry()
const mistPos = new Float32Array(MIST * 3)
{
  const geo = new THREE.BoxGeometry(150, 34, 10, LITE ? 60 : 110, LITE ? 16 : 26, 4)
  const p = geo.attributes.position
  const cols = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const wx = x + CX, wy = y + 15
    const chan = ss(2.5, 7, Math.abs(x))
    const n1 = noise3(wx * 0.25, wy * 0.25, wx * 0.11 + wy * 0.07), n2 = noise3(wx * 0.9 + 3.0, wy * 0.9, wx * 0.4 - wy * 0.3)
    const d = Math.max(0, n1 * 1.9 + n2 * 0.5 + 1.5) * chan
    if (z > 0) z -= d
    x += n2 * 0.3 * chan
    y += n1 * 0.3
    p.setXYZ(i, x, y, z)
    const t = 0.5 + 0.5 * n1
    c.setHSL(0.22 + 0.05 * n2, 0.14, 0.07 + 0.09 * t)
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  geo.computeVertexNormals()
  cliffMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.06, flatShading: true }))
  cliffMesh.position.set(CX, 15, WF - 6)
  scene.add(cliffMesh)

  const fall = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 30),
    new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.85, color: new THREE.Color(0.9, 1.1, 1.3), blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  )
  fall.position.set(CX, 15, WF - 0.7)
  scene.add(fall)
  const body = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 30),
    new THREE.MeshBasicMaterial({ color: '#6a8fa8', transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide })
  )
  body.position.set(CX, 15, WF - 0.75)
  scene.add(body)

  for (let i = 0; i < MIST; i++) {
    mistPos[i * 3] = CX + rand(-3.8, 3.8)
    mistPos[i * 3 + 1] = rand(0.2, 5)
    mistPos[i * 3 + 2] = rand(WF, WF + 6)
  }
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3))
  scene.add(new THREE.Points(mistGeo, new THREE.PointsMaterial({
    map: glow, size: 2.8, color: new THREE.Color(0.55, 0.7, 0.85), transparent: true, opacity: 0.25,
    blending: THREE.AdditiveBlending, depthWrite: false
  })))
}

/* ---------- waterfall extras ---------- */
const poolLight = new THREE.PointLight(0x4fd8ff, 14, 22, 2)       // pool එකට නිල් ආලෝකය
poolLight.position.set(CX, 0.4, WF + 9)
scene.add(poolLight)

const cascades = []                                               // ගල් දිගේ ගලන කුඩා දිය දහරා
for (const [dx, w, h, op] of [[-3.3, 0.9, 20, 0.55], [3.4, 1.1, 17, 0.55], [-4.5, 0.6, 11, 0.4], [4.6, 0.7, 12, 0.4]]) {
  const tx = fallTex.clone()
  tx.needsUpdate = true
  tx.repeat.set(1, 2)
  tx.offset.y = Math.random()
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: op, color: new THREE.Color(0.85, 1.05, 1.25), blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  )
  m.position.set(CX + dx, h / 2 - 0.5, WF - 1.2 - Math.abs(dx) * 0.12)
  scene.add(m)
  cascades.push(tx)
}

const FOAM = LITE ? 90 : 180                                      // ඇල්ල යට පෙණ
const foamGeo = new THREE.BufferGeometry()
const foamPos = new Float32Array(FOAM * 3)
const foamSeed = new Float32Array(FOAM)
for (let i = 0; i < FOAM; i++) {
  foamPos[i * 3] = CX + rand(-4.5, 4.5)
  foamPos[i * 3 + 1] = WATER_Y + 0.08
  foamPos[i * 3 + 2] = rand(WF - 0.4, WF + 6.4)
  foamSeed[i] = rand(0, 0.6)
}
foamGeo.setAttribute('position', new THREE.BufferAttribute(foamPos, 3))
scene.add(new THREE.Points(foamGeo, new THREE.PointsMaterial({
  map: glow, size: 1.1, color: new THREE.Color(0.9, 0.97, 1), transparent: true, opacity: 0.35,
  blending: THREE.AdditiveBlending, depthWrite: false
})))

/* =====================================================================
   NIGHT SKY: තරු, ගිනි ගෙඩි (shooting stars), සඳ, ගඟ උඩින් මීදුම
   ===================================================================== */
const skyGroup = new THREE.Group()
scene.add(skyGroup)
const starSets = []
for (let k = 0; k < (LITE ? 1 : 2); k++) {
  const N = LITE ? 320 : 450
  const sp = new Float32Array(N * 3)
  const sc = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const u = rand(0, Math.PI * 2), v = Math.acos(rand(0.1, 1)), r = 200
    sp[i * 3] = r * Math.sin(v) * Math.cos(u)
    sp[i * 3 + 1] = r * Math.cos(v)
    sp[i * 3 + 2] = r * Math.sin(v) * Math.sin(u)
    const b = rand(0.55, 1)
    sc[i * 3] = b; sc[i * 3 + 1] = b * rand(0.9, 1); sc[i * 3 + 2] = b * rand(0.8, 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(sp, 3))
  g.setAttribute('color', new THREE.BufferAttribute(sc, 3))
  const pts = new THREE.Points(g, new THREE.PointsMaterial({
    size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, fog: false, depthWrite: false
  }))
  skyGroup.add(pts)
  starSets.push(pts)
}
const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(0.75, 0.88, 1), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
moonGlow.scale.setScalar(46)
moonGlow.position.set(-70, 110, -90)
const moonCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1, 1, 0.95), transparent: true, depthWrite: false, fog: false, toneMapped: false }))
moonCore.scale.setScalar(11)
moonCore.position.copy(moonGlow.position)
skyGroup.add(moonGlow, moonCore)

function shootTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 8
  const g = c.getContext('2d')
  const gr = g.createLinearGradient(0, 0, 256, 0)
  gr.addColorStop(0, 'rgba(255,255,255,0)')
  gr.addColorStop(1, 'rgba(255,255,255,1)')
  g.fillStyle = gr
  g.fillRect(0, 2, 256, 4)
  return new THREE.CanvasTexture(c)
}
const shootTex = shootTexture()
const shooters = []
for (let i = 0; i < (LITE ? 1 : 2); i++) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 0.4),
    new THREE.MeshBasicMaterial({ map: shootTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })
  )
  m.visible = false
  m.userData = { t: 0, dur: 1, next: rand(3, 8) + i * 4, v: new THREE.Vector3() }
  scene.add(m)
  shooters.push(m)
}

const RMIST = LITE ? 70 : 150                                     // ගඟ උඩින් ගලන මීදුම
const rmGeo = new THREE.BufferGeometry()
const rmPos = new Float32Array(RMIST * 3)
const rmOff = new Float32Array(RMIST)
const rmBase = new Float32Array(RMIST)
const RM_Z0 = -48 - S1
for (let i = 0; i < RMIST; i++) {
  const z = rand(RM_Z0, WF + 2)
  rmOff[i] = rand(-1, 1) * riverHW(z) * 0.85
  rmBase[i] = WATER_Y + rand(0.15, 0.9)
  rmPos[i * 3] = pathX(z) + rmOff[i]
  rmPos[i * 3 + 1] = rmBase[i]
  rmPos[i * 3 + 2] = z
}
rmGeo.setAttribute('position', new THREE.BufferAttribute(rmPos, 3))
scene.add(new THREE.Points(rmGeo, new THREE.PointsMaterial({
  map: glow, size: 5, color: new THREE.Color(0.6, 0.75, 0.9), transparent: true, opacity: 0.1,
  blending: THREE.AdditiveBlending, depthWrite: false
})))

/* පාර දිගේ පහළින් ගලන සියුම් නිල් මීදුම (ස්වභාවික පෙනුමට) */
const GM = LITE ? 36 : 70
const gmGeo = new THREE.BufferGeometry()
const gmPos = new Float32Array(GM * 3)
const gmOff = new Float32Array(GM)
const gmBase = new Float32Array(GM)
for (let i = 0; i < GM; i++) {
  const z = rand(14, -48)
  gmOff[i] = rand(-14, 14)
  gmBase[i] = rand(0.25, 1.3)
  gmPos[i * 3] = pathX(z) + gmOff[i]
  gmPos[i * 3 + 1] = gmBase[i]
  gmPos[i * 3 + 2] = z
}
gmGeo.setAttribute('position', new THREE.BufferAttribute(gmPos, 3))
scene.add(new THREE.Points(gmGeo, new THREE.PointsMaterial({
  map: glow, size: 8, color: new THREE.Color(0.5, 0.65, 0.74), transparent: true, opacity: 0.07,
  blending: THREE.AdditiveBlending, depthWrite: false
})))

/* වැටෙන කොළ (ස්වභාවික පෙනුමට) */
const LV = LITE ? 26 : 56
const lvGeo = new THREE.BufferGeometry()
const lvPos = new Float32Array(LV * 3)
const lvSeed = new Float32Array(LV)
const leafTex = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')
  g.translate(16, 16); g.rotate(-0.6)
  g.fillStyle = '#fff'
  g.beginPath(); g.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2); g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
for (let i = 0; i < LV; i++) {
  const z = rand(12, -40)
  lvPos[i * 3] = pathX(z) + rand(-9, 9)
  lvPos[i * 3 + 1] = rand(0.2, 6)
  lvPos[i * 3 + 2] = z
  lvSeed[i] = rand(0, 6.28)
}
lvGeo.setAttribute('position', new THREE.BufferAttribute(lvPos, 3))
scene.add(new THREE.Points(lvGeo, new THREE.PointsMaterial({
  map: leafTex, size: 0.2, color: new THREE.Color(0.85, 0.6, 0.3), transparent: true, opacity: 0.85, depthWrite: false
})))

/* =====================================================================
   FIREFLIES
   ===================================================================== */
const FF = COUNT.fireflies
const ffGeo = new THREE.BufferGeometry()
const ffBase = new Float32Array(FF)
{
  const ffPos = new Float32Array(FF * 3)
  for (let i = 0; i < FF; i++) {
    const z = rand(10, WF - 1)
    ffPos[i * 3] = pathX(z) + rand(-16, 16)
    ffBase[i] = rand(0.3, 3.6)
    ffPos[i * 3 + 1] = ffBase[i]
    ffPos[i * 3 + 2] = z
  }
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3))
  scene.add(new THREE.Points(ffGeo, new THREE.PointsMaterial({
    map: glow, size: 0.35, color: new THREE.Color(1, 0.8, 0.35).multiplyScalar(2.5),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  })))
}

/* =====================================================================
   ASSET LOADING
   ===================================================================== */
const draco = new DRACOLoader()
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(draco)
gltfLoader.setMeshoptDecoder(MeshoptDecoder)
const fbxLoader = new FBXLoader()

/* ---- GPU මතකය: ලොකු texture පොඩි කරනවා (මුළු VRAM එකෙන් වැඩිම කෑවෙන්නේ ඒවා) ---- */
const PBR_DROP = ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap']
const TEX_KEYS = ['map', 'emissiveMap', 'alphaMap', ...PBR_DROP]
const shrinkStats = { shrunk: 0, dropped: 0 }
function shrinkTex(t, max = MAXT) {
  const img = t && t.image
  if (!img || t.userData.shrunk) return
  const w = img.width || img.naturalWidth || 0, h = img.height || img.naturalHeight || 0
  if (!w || !h || Math.max(w, h) <= max) return
  try {
    const k = max / Math.max(w, h)
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k))
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    if (typeof img.close === 'function') img.close()
    t.image = c
    t.userData.shrunk = true
    t.needsUpdate = true
    shrinkStats.shrunk++
  } catch (e) { /* පොඩි කරන්න බැරි නම් තියෙන විදිහටම */ }
}
function shrinkObj(obj, max = MAXT, drop = false) {
  try {
    obj.traverse(o => {
      if (!o.isMesh) return
      ;(Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if (!m) return
        if (drop) {                                   // LITE: normal/roughness/AO texture අයින් කරනවා
          let dropped = false
          for (const k of PBR_DROP) if (m[k]) { m[k].dispose(); m[k] = null; dropped = true }
          if (dropped) {
            if ('metalness' in m) m.metalness = Math.min(m.metalness, 0.1)
            if ('roughness' in m) m.roughness = Math.max(m.roughness, 0.8)
            m.needsUpdate = true
            shrinkStats.dropped++
          }
        }
        for (const k of TEX_KEYS) if (m[k]) shrinkTex(m[k], max)
      })
    })
  } catch (e) { console.warn('shrink failed', e) }
}
window.gpuInfo = () => ({ memory: renderer.info.memory, render: renderer.info.render, shrink: shrinkStats, RES, LITE })

const loadFbxSafe = name => fbxLoader.loadAsync(`${BASE}${name}`).then(o => { shrinkObj(o, MAXT, LITE); return o }).catch(() => null)

let loadedCount = 0
async function tryLoad(name) {
  for (const ext of ['glb', 'gltf']) {
    try {
      const g = await gltfLoader.loadAsync(encodeURI(`${BASE}${name}.${ext}`))
      const isFloor = FILES.floor.includes(name)
      shrinkObj(g.scene, isFloor ? Math.max(MAXT, 1024) : MAXT, LITE && !isFloor)
      loadedCount++
      loadingEl.textContent = `GROWING THE FOREST…  (${loadedCount} models)`
      if (window.setLoad) window.setLoad(loadedCount)
      console.log('✔ loaded', `${name}.${ext}`)
      return g
    } catch (e) {                                       // file නැත්නම් නිහඬව ඉක්මවනවා (ගස් ගෙදර නම් console එකේ හේතුව පෙන්නනවා)
      if (ext === 'gltf' && FILES.treehouse.includes(name)) console.warn('✖', name + '.gltf load failed:', (e && e.message) || e, '(.gltf එකට අදාල .bin / texture files public/ එකේ තියෙන්න ඕන)')
    }
  }
  return null
}
const tryLoadList = async names => (await Promise.all(names.map(tryLoad))).filter(Boolean)
const tryLoadFirst = async names => (await tryLoadList(names))[0] || null

function fitProp(root, { height, length, max, alongZ = false, flip = false } = {}) {
  const holder = new THREE.Group()
  const flipG = new THREE.Group()
  const inner = new THREE.Group()
  holder.add(flipG); flipG.add(inner); inner.add(root)
  root.updateMatrixWorld(true)
  let box = new THREE.Box3().setFromObject(root)
  let size = box.getSize(new THREE.Vector3())
  if (alongZ && size.x > size.z) {
    root.rotation.y = Math.PI / 2
    root.updateMatrixWorld(true)
    box = new THREE.Box3().setFromObject(root)
    size = box.getSize(new THREE.Vector3())
  }
  let ref = size.y
  if (length) ref = Math.max(size.x, size.z)
  else if (max) ref = Math.max(size.x, size.y, size.z)
  const target = height || length || max
  const k = ref > 1e-6 ? target / ref : 1
  const c = box.getCenter(new THREE.Vector3())
  inner.scale.setScalar(k)
  inner.position.set(-c.x * k, -box.min.y * k, -c.z * k)
  if (flip) flipG.rotation.y = Math.PI
  holder.userData.size = size.clone().multiplyScalar(k)
  return holder
}

/* =====================================================================
   SCATTER (instancing)
   ===================================================================== */
const dummy = new THREE.Object3D()
const col = new THREE.Color()

/* instance ඔක්කොම එකම mesh එකක් වෙනුවට කොටස් (chunk) වලට බෙදනවා: camera එකෙන් ඈත ඒවා draw කරන්නේ නැහැ (GPU වේගය) */
const chunkList = []
const CH_Z = 26, CH_X = 44
function scatter(meshes, count, place, tint = false) {
  const items = []
  let guard = 0
  while (items.length < count && guard++ < count * 80) {
    const p = place()
    if (!p) continue
    dummy.position.set(p.x, p.y, p.z)
    dummy.rotation.set(p.rx || 0, p.ry ?? rand(0, 6.283), p.rz || 0)
    dummy.scale.set(p.s * (p.sx || 1), p.s * (p.sy || 1), p.s * (p.sx || 1))
    dummy.updateMatrix()
    let c = null
    if (tint) c = (p.color || col.setScalar(rand(0.72, 1.0)).multiply(new THREE.Color(1, rand(0.95, 1.06), rand(0.88, 1)))).clone()
    items.push({ m: dummy.matrix.clone(), c, x: p.x, z: p.z })
  }
  const bins = new Map()
  for (const it of items) {
    const key = Math.floor(it.z / CH_Z) + ':' + Math.floor(it.x / CH_X)
    let b = bins.get(key)
    if (!b) bins.set(key, b = [])
    b.push(it)
  }
  for (const list of bins.values()) {
    for (const tpl of meshes) {
      const im = new THREE.InstancedMesh(tpl.geometry, tpl.material, list.length)
      list.forEach((it, i) => {
        im.setMatrixAt(i, it.m)
        if (tint && it.c) im.setColorAt(i, it.c)
      })
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
      if (typeof im.computeBoundingSphere === 'function') {
        im.computeBoundingSphere()
        im.frustumCulled = true
        chunkList.push(im)
      } else im.frustumCulled = false
      scene.add(im)
    }
  }
  return items.length
}

function scatterGLTF(gltf, { height, max, count, place, wind: w = 0, tint = false, wet = false }) {
  gltf.scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(gltf.scene)
  const size = box.getSize(new THREE.Vector3())
  const c = box.getCenter(new THREE.Vector3())
  const ref = max ? Math.max(size.x, size.y, size.z) : size.y
  const target = max || height
  const k = ref > 1e-6 ? target / ref : 1
  const fix = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z))
  const meshes = []
  gltf.scene.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh) return
    const g = o.geometry.clone()
    g.applyMatrix4(o.matrixWorld)
    g.applyMatrix4(fix)
    if (w && !Array.isArray(o.material)) addWind(o.material, target, w)
    let mt = o.material
    if (wet && !Array.isArray(mt)) {                 // තෙත ගල්
      mt = mt.clone()
      mt.roughness = 0.28
      mt.metalness = 0.12
      if (mt.color) mt.color.multiplyScalar(0.7)
    }
    meshes.push(new THREE.InstancedMesh(g, mt, count))
  })
  return scatter(meshes, count, place, tint)
}

const rockSources = []
function scatterRocks(max, count, place, wet = false) {
  const n = rockSources.length
  if (!n) return
  rockSources.forEach(g => scatterGLTF(g, { max, count: Math.ceil(count / n), place, tint: true, wet }))
}

/* දිය ඇල්ල පිටිපස්සේ ගල් බිත්තිය: rock3.fbx (ස්වභාවික ගල්) ලොකුවට, තට්ටු 4කට, මැද ඇල්ල යන තැන හිස් කරලා */
function buildCliffRocks(src) {
  if (!src) return
  if (cliffMesh) cliffMesh.position.z -= 4                // පරණ low-poly බිත්තිය පිටිපස්සට (ගල් වලින් වැහෙනවා)
  const layers = [
    { y: -0.6, max: 13, n: pick(14, 24), z: 0 },
    { y: 8,    max: 15, n: pick(10, 17), z: -2 },
    { y: 17,   max: 17, n: pick(8, 13),  z: -4 },
    { y: 26,   max: 19, n: pick(6, 10),  z: -6 },
  ]
  layers.forEach(L => scatterGLTF(src, {
    max: L.max, count: L.n, tint: true, wet: L.y < 6,
    place: () => {
      const s = rand(0.85, 1.35)
      const side = Math.random() < 0.5 ? -1 : 1
      const dx = 2.8 + L.max * 0.42 * s + Math.pow(Math.random(), 0.85) * 46
      return { x: CX + side * dx, y: L.y + rand(-1, 1), z: WF - 1 + L.z + rand(-1.5, 1.5), s, ry: rand(0, 6.28) }
    }
  }))
}

/* ---------- placement rules ---------- */
const FALL_Z = WF + 2
function nearLanding(x, z) { return Math.abs(z - LAND_Z) < 16 && Math.abs(x - PLAT_X) < 8 }

function placeTreeNear() {
  const z = rand(18, FALL_Z)
  if (Math.abs(z + 35) < 4.5) return null
  const side = Math.random() < 0.5 ? -1 : 1
  const clearance = PATH_HW + 2.0 + riverMask(z) * (riverHW(z) + 0.6)
  const dx = clearance + Math.pow(Math.random(), 1.5) * 34
  if (Math.abs(z + 35) < 15 && dx < 11) return null
  if (z < -40 - S1 && z > -62 - S1 && dx < 9) return null
  const x = pathX(z) + side * dx
  if (inHouse(x, z)) return null
  const y = groundH(x, z)
  if (y < -0.25) return null
  return { x, y: y - 0.08, z, s: rand(0.8, 1.35), sx: rand(0.85, 1.15), sy: rand(0.9, 1.2) }
}
function placeTreeFar() {
  const z = rand(25, FALL_Z + 6)
  const side = Math.random() < 0.5 ? -1 : 1
  const x = pathX(z) + side * (26 + Math.pow(Math.random(), 1.2) * 80)
  const y = groundH(x, z)
  if (y < -0.25) return null
  return { x, y: y - 0.1, z, s: rand(1.0, 2.0) }
}
/* ගඟ ඉවුරු දිගේ පොඩි පැළ + pool එක වටේ පොඩි පැළ / පොඩි ගස් */
function placeRiverPlant() {
  const z = rand(-52 - S1, WF + 2)
  const side = Math.random() < 0.5 ? -1 : 1
  const x = pathX(z) + side * (riverHW(z) * riverMask(z) * 1.05 + 0.4 + Math.pow(Math.random(), 1.4) * 7)
  const y = groundH(x, z)
  if (y < -0.2 || nearLanding(x, z)) return null
  return { x, y: y - 0.02, z, s: rand(0.8, 1.6) }
}
function placePoolPlant() {
  const z = rand(WF + 3, LAND_Z + 6)
  const x = CX + (Math.random() < 0.5 ? -1 : 1) * rand(4, 13)
  const y = groundH(x, z)
  if (y < -0.2 || nearLanding(x, z)) return null
  return { x, y: y - 0.02, z, s: rand(0.8, 1.6) }
}
/* ගස් ගෙදර වටේ ලස්සන ගස් + පැළ (පාරට ඉඩ තියලා) */
function placeTHTree() {
  const a = rand(0, Math.PI * 2), r = rand(10.2, 19)
  const x = TH_X + Math.cos(a) * r, z = TH_Z + Math.sin(a) * r
  if (Math.abs(x - pathX(z)) < PATH_HW + 3.6) return null
  if (Math.abs(z + 35) < 6) return null
  const y = groundH(x, z)
  if (y < -0.25) return null
  return { x, y: y - 0.08, z, s: rand(0.75, 1.15), sx: rand(0.9, 1.1), sy: rand(0.95, 1.15) }
}
function placeTHPlant() {
  const a = rand(0, Math.PI * 2), r = rand(5.5, 13)
  const x = TH_X + Math.cos(a) * r, z = TH_Z + Math.sin(a) * r
  if (Math.abs(x - pathX(z)) < PATH_HW + 0.4) return null
  if (Math.hypot(x - TH_X, z - TH_Z) < 4.2) return null
  const y = groundH(x, z)
  if (y < -0.2) return null
  return { x, y: y - 0.02, z, s: rand(0.8, 1.5) }
}
/* ආරම්භක කොටසේ (පාර දෙපැත්තේ) ගස් ඝනව */
function placeStartTree() {
  const z = rand(20, -62)
  if (Math.abs(z + 35) < 4.5) return null
  const side = Math.random() < 0.5 ? -1 : 1
  const dx = PATH_HW + 2.3 + Math.pow(Math.random(), 1.2) * 14
  const x = pathX(z) + side * dx
  if (inHouse(x, z) || Math.hypot(x - TH_X, z - TH_Z) < 13) return null
  const y = groundH(x, z)
  if (y < -0.25) return null
  return { x, y: y - 0.08, z, s: rand(0.8, 1.25), sx: rand(0.9, 1.1), sy: rand(0.95, 1.2) }
}
function placeGapTree() {                                    // ආරම්භයේ ඉස්සරහ හිස් (මීදුම) කොටස පුරවන ගස්
  const z = rand(-12, -58)
  if (Math.abs(z + 35) < 4.5) return null
  const side = Math.random() < 0.55 ? -1 : 1
  const x = pathX(z) + side * (PATH_HW + 1.9 + Math.pow(Math.random(), 1.2) * 9)
  if (Math.hypot(x - TH_X, z - TH_Z) < 11) return null
  const y = groundH(x, z)
  if (y < -0.25) return null
  return { x, y: y - 0.08, z, s: rand(0.8, 1.3), sx: rand(0.9, 1.1), sy: rand(0.95, 1.2) }
}
function placeBackTree() {                                   // ඈතට පාරේ දෙපැත්තේ + පිටිපස්සේ (ඇය පිටුපස) ගස්
  const z = rand(-20, -100)
  if (Math.abs(z + 35) < 4.5) return null
  const side = Math.random() < 0.5 ? -1 : 1
  const x = pathX(z) + side * (PATH_HW + 2.6 + Math.pow(Math.random(), 1.1) * 22)
  if (Math.hypot(x - TH_X, z - TH_Z) < 12) return null
  const y = groundH(x, z)
  if (y < -0.25) return null
  return { x, y: y - 0.08, z, s: rand(0.85, 1.4), sx: rand(0.9, 1.1), sy: rand(0.95, 1.2) }
}
function placeStartSmall() {
  const z = rand(14, -60)
  if (Math.abs(z + 35) < 4.5) return null
  const side = Math.random() < 0.5 ? -1 : 1
  const x = pathX(z) + side * (PATH_HW + 1.6 + Math.pow(Math.random(), 1.4) * 7)
  if (Math.hypot(x - TH_X, z - TH_Z) < 7) return null
  const y = groundH(x, z)
  if (y < -0.2) return null
  return { x, y: y - 0.05, z, s: rand(0.8, 1.3) }
}
function placeBabyTree() {
  const p = Math.random() < 0.7 ? placeRiverPlant() : placePoolPlant()
  if (!p) return null
  const cx = pathX(p.z)
  p.x += (p.x > cx ? 1 : -1) * rand(1.5, 4)
  p.y = groundH(p.x, p.z) - 0.05
  if (p.y < -0.2 || nearLanding(p.x, p.z)) return null
  p.s = rand(0.85, 1.35)
  return p
}
function placeGrass() {
  const z = rand(12, -142 - S3)
  if (Math.abs(z + 35) < 3.5) return null
  const clr = PATH_HW + 3 + riverMask(z) * (riverHW(z) + 1.2)
  const x = pathX(z) + (Math.random() < 0.5 ? -1 : 1) * (clr + Math.pow(Math.random(), 1.5) * 18)
  const y = groundH(x, z)
  if (y < -0.15) return null
  return { x, y, z, s: rand(0.6, 1.6), rx: rand(-0.2, 0.2), rz: rand(-0.2, 0.2) }
}
function placePlant() {
  const z = rand(10, -140 - S3)
  if (Math.abs(z + 35) < 6) return null
  const clr = PATH_HW + 3.2 + riverMask(z) * (riverHW(z) + 1.2)
  const x = pathX(z) + (Math.random() < 0.5 ? -1 : 1) * (clr + Math.pow(Math.random(), 1.4) * 22)
  if (nearLanding(x, z)) return null
  const y = groundH(x, z)
  if (y < -0.1) return null
  return { x, y: y - 0.02, z, s: rand(0.7, 1.4) }
}
function placeSmallPlant() {
  const z = rand(14, -142 - S3)
  if (Math.abs(z + 35) < 3.2) return null
  const clr = PATH_HW + 0.2 + riverMask(z) * (riverHW(z) * 0.9)
  const x = pathX(z) + (Math.random() < 0.5 ? -1 : 1) * (clr + Math.pow(Math.random(), 1.6) * 16)
  const y = groundH(x, z)
  if (y < -0.2) return null
  if (nearLanding(x, z)) return null
  return { x, y: y - 0.02, z, s: rand(0.7, 1.5) }
}
function placePathEdgePlant() {
  const z = rand(14, -44 - S1)
  if (Math.abs(z + 35) < 3.4) return null
  const x = pathX(z) + (Math.random() < 0.5 ? -1 : 1) * (PATH_HW + 0.25 + Math.pow(Math.random(), 1.4) * 3.4)
  const y = groundH(x, z)
  if (y < -0.2) return null
  return { x, y: y - 0.02, z, s: rand(0.7, 1.4) }
}
function placeMoss() {
  const z = rand(14, -142 - S3)
  if (Math.abs(z + 35) < 4) return null
  const clr = PATH_HW + 1.0 + riverMask(z) * (riverHW(z) + 0.5)
  const x = pathX(z) + (Math.random() < 0.5 ? -1 : 1) * (clr + Math.pow(Math.random(), 1.3) * 30)
  const y = groundH(x, z)
  if (y < -0.15) return null
  return { x, y: y + 0.01, z, s: rand(0.6, 1.6) }
}
function placeBankRock() {
  const z = rand(-52 - S1, -141 - S3)
  const hw = riverHW(z)
  const x = pathX(z) + (Math.random() < 0.5 ? -1 : 1) * hw * rand(0.8, 1.3)
  return { x, y: groundH(x, z) - 0.08, z, s: rand(0.5, 1.5) }
}
function placePathRock() {
  const z = rand(12, -50 - S1)
  if (Math.abs(z + 35) < 8) return null
  const x = pathX(z) + (Math.random() < 0.5 ? -1 : 1) * rand(PATH_HW + 0.6, 10)
  return { x, y: groundH(x, z) - 0.08, z, s: rand(0.3, 0.8) }
}
function placeFallRock() {
  const dx = rand(3.8, 17) * (Math.random() < 0.5 ? -1 : 1)
  const z = rand(WF + 0.5, WF + 7)
  const x = CX + dx
  return { x, y: groundH(x, z) - 0.1, z, s: rand(1.0, 2.0) }
}
function placeCliffRock() {                                  // දිය ඇල්ලේ පිටිපස්සේ ගල් බිත්තිය
  const dx = rand(3.6, 36) * (Math.random() < 0.5 ? -1 : 1)
  const z = rand(WF - 2.5, WF + 1)
  const x = CX + dx
  const y = Math.max(groundH(x, z), -1.2) + rand(-0.3, 0.6)
  return { x, y, z, s: rand(1.0, 2.0) }
}
function placeSmallFence() {
  const z = rand(-56 - S1, -140 - S3)
  const hw = riverHW(z)
  const x = pathX(z) + (Math.random() < 0.5 ? -1 : 1) * hw * rand(0.85, 1.6)
  const y = groundH(x, z)
  if (y < -0.9) return null
  return { x, y: y - 0.05, z, s: rand(0.7, 1.4) }
}

/* =====================================================================
   LAMPS
   ===================================================================== */
const props = {}
const lanterns = []
const lampGroups = []

function procLamp() {
  const g = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 1 })
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.95, 6), wood)
  pole.position.y = 0.475
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), bulbMat)
  bulb.position.y = 0.97
  g.add(pole, bulb)
  return g
}
function makeLamp(h, glowSize = 1) {
  const g = new THREE.Group()
  const body = props.lamp ? SkeletonUtils.clone(props.lamp) : procLamp()
  body.scale.setScalar(h)
  g.add(body)
  const y = h * SZ.lampLightY
  const bulb = new THREE.Mesh(bulbGeo, bulbMat)               // දැල්වෙන බල්බය
  bulb.scale.setScalar(0.05 + 0.025 * h)
  bulb.position.y = y
  const halo = new THREE.Sprite(haloMat)
  halo.scale.setScalar(Math.max(1.1, h * 0.8) * glowSize)
  halo.position.y = y
  const disc = new THREE.Mesh(lampDiscGeo, lampDiscMat)       // බිමේ ආලෝක කවය
  disc.position.y = 0.07
  disc.scale.setScalar(Math.max(0.8, h * 0.55))
  g.add(bulb, halo, disc)
  return g
}
function placeLamp(x, y, z, h = SZ.lampH, light = true) {
  const g = makeLamp(h)
  g.position.set(x, y, z)
  scene.add(g)
  lampGroups.push(g)
  if (light) lanterns.push(new THREE.Vector3(x, y + h * SZ.lampLightY, z))
  return g
}

/* =====================================================================
   BOAT, PIER, BRIDGE, LANDING
   ===================================================================== */
let boat = null
let boatSeat = { y: BOAT_FLOOR, z: 0.9 }
let boatOarNode = null
const PLAT_X = pathX(LAND_Z) + 1.8
const PLAT_TOP = WATER_Y + 0.28
const MOOR = { x: PLAT_X - 6.0, z: LAND_Z + 2, yaw: 0.12 }

/* බෝට්ටුවේ ආසන (thwart) දෙක අතරට ඇයව තියනවා. නිවැරදි නැත්නම් game එකේ [ ] = ඉස්සරහට/පිටිපස්සට, - = = පහළට/උඩට */
const SEAT = { z: 0, y: 0 }
const SIT_DROP = 0.30           // ආසනයේ උඩ සිට ඇගේ පාද මූලය (origin) දක්වා පහළට (m). ඉඳගත් තැන නිවැරදි නැත්නම් - = යතුරු
addEventListener('keydown', e => {
  let ch = true
  if (e.key === '[') SEAT.z -= 0.1
  else if (e.key === ']') SEAT.z += 0.1
  else if (e.key === '-') SEAT.y -= 0.05
  else if (e.key === '=') SEAT.y += 0.05
  else ch = false
  if (ch) console.log('SEAT =', JSON.stringify({ z: +SEAT.z.toFixed(2), y: +SEAT.y.toFixed(2) }), '(මේක SEAT const එකට දාන්න)')
})

function measureBoatSeat(model) {
  const ray = new THREE.Raycaster()
  const down = new THREE.Vector3(0, -1, 0)
  model.updateMatrixWorld(true)
  const L = SZ.boatLen
  const samples = []
  let lo = Infinity
  for (let t = -0.46; t <= 0.461; t += 0.02) {
    const z = t * L
    ray.set(new THREE.Vector3(0, 8, z), down)
    const hit = ray.intersectObject(model, true)[0]
    if (!hit) continue
    samples.push({ z, y: hit.point.y })
    if (hit.point.y < lo) lo = hit.point.y
  }
  if (!isFinite(lo) || samples.length < 4) return null
  // ආසන = බෝට්ටුවේ මැද කොටසේ ඉහළට නෙරා ඇති තැන් (කොන් දෙක ඉවත්)
  const seats = []
  let cur = null
  for (const sm of samples) {
    const up = sm.y - lo > 0.1 && Math.abs(sm.z) < L * 0.38
    if (up) { if (!cur) { cur = { a: sm.z, b: sm.z }; seats.push(cur) } else cur.b = sm.z } else cur = null
  }
  /* ඇය ඉඳගන්නේ පිටිපස්ස (stern, +z) ආසනයේ. ආසනයේ උඩ මට්ටමෙන් ඇගේ ඉඳගත් උස අඩු කරලා */
  const centers = seats.map(c => (c.a + c.b) / 2).sort((p, q) => q - p)
  let z = centers.length ? centers[0] : L * 0.24
  if (z < 0.3) z = L * 0.24
  let top = lo + 0.3
  let bd = 9
  for (const sm of samples) { const d = Math.abs(sm.z - z); if (d < bd) { bd = d; top = sm.y } }
  return { y: Math.max(lo + 0.02, top - SIT_DROP), z, top }
}

function buildBoat() {
  const g = new THREE.Group()
  if (props.boat) {
    const b = SkeletonUtils.clone(props.boat)
    b.position.y = SZ.boatDraft
    g.add(b)
    b.traverse(o => { if (!boatOarNode && /oar|paddle|paddel|\brow\b/i.test(o.name || '')) boatOarNode = o })
    const hid = []
    b.traverse(o => { if (/oar|paddle|paddel|\brow\b/i.test(o.name || '')) { o.visible = false; hid.push(o.name) } })   // බෝට්ටුවේ තියෙන වෙනම හබල සඟවනවා (ඇයගේ හබල විතරක් පෙනෙන්න)
    if (hid.length) console.log('boat එකේ හබල සඟවුවා:', hid)
    boatOarNode = null
    const seat = measureBoatSeat(b)
    if (seat) boatSeat = seat
    console.log('boat seat (floor y, thwart z):', boatSeat)
  } else {
    const shape = new THREE.Shape()
    shape.moveTo(0, 2.2)
    shape.bezierCurveTo(0.9, 1.2, 1.0, -0.8, 0.6, -1.8)
    shape.lineTo(-0.6, -1.8)
    shape.bezierCurveTo(-1.0, -0.8, -0.9, 1.2, 0, 2.2)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false })
    geo.rotateX(-Math.PI / 2)
    const hull = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#6b4429', roughness: 0.9 }))
    hull.position.y = -0.2
    const inner = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 1 }))
    inner.scale.set(0.82, 0.3, 0.86)
    inner.position.y = 0.33
    g.add(hull, inner)
  }
  scene.add(g)
  return g
}

function buildPier() {
  const z0 = -45.5 - S1, z1 = -54.5 - S1
  const L = z0 - z1
  const cz = (z0 + z1) / 2
  const d = dirAt(-cz)
  if (props.dock) {
    const dk = SkeletonUtils.clone(props.dock)
    const h = dk.userData.size ? dk.userData.size.y : 0.5
    dk.position.set(pathX(cz), PIER_Y - h, cz)
    dk.rotation.y = Math.atan2(-d.x, -d.z)
    scene.add(dk)
  } else {
    const g = new THREE.Group()
    const wood = new THREE.MeshStandardMaterial({ color: '#5a3d26', roughness: 1 })
    const dark = new THREE.MeshStandardMaterial({ color: '#3a2616', roughness: 1 })
    const plank = new THREE.BoxGeometry(2.2, 0.08, 0.42)
    for (let i = 0; i < Math.round(L / 0.5); i++) {
      const p = new THREE.Mesh(plank, i % 2 ? wood : dark)
      p.position.set(rand(-0.02, 0.02), 0, -L / 2 + 0.25 + i * 0.5)
      g.add(p)
    }
    const beam = new THREE.BoxGeometry(0.14, 0.14, L)
    const post = new THREE.BoxGeometry(0.16, 1.9, 0.16)
    for (const x of [-1.0, 1.0]) {
      const b = new THREE.Mesh(beam, wood); b.position.set(x, -0.12, 0); g.add(b)
      for (let k = 0; k <= 3; k++) {
        const p = new THREE.Mesh(post, wood)
        p.position.set(x, -0.9, -L / 2 + k * (L / 3))
        g.add(p)
      }
    }
    g.position.set(pathX(cz), PIER_Y, cz)
    g.rotation.y = Math.atan2(-d.x, -d.z)
    scene.add(g)
  }
  placeLamp(pathX(-46.5 - S1) + 1.25, PIER_Y, -46.5 - S1, 1.8)
  placeLamp(pathX(-53.5 - S1) - 1.25, PIER_Y, -53.5 - S1, 1.8)
}

let bridgeRise = 0
function archBridge(holder) {                              // පාලම මැදට උස් කරලා රවුම් කරනවා
  holder.updateMatrixWorld(true)
  const out = new THREE.Group()
  const half = SZ.bridgeLen / 2
  holder.traverse(o => {
    if (!o.isMesh) return
    const geo = o.geometry.clone()
    geo.applyMatrix4(o.matrixWorld)
    const pp = geo.attributes.position
    for (let i = 0; i < pp.count; i++) {
      const t = clamp(pp.getZ(i) / half, -1, 1)
      pp.setY(i, pp.getY(i) + SZ.bridgeRise * (1 - t * t))
    }
    geo.computeVertexNormals()
    out.add(new THREE.Mesh(geo, o.material))
  })
  return out
}

function buildBridge() {
  const g = new THREE.Group()
  if (props.bridge) {
    g.add(archBridge(SkeletonUtils.clone(props.bridge)))
    bridgeRise = SZ.bridgeRise
  } else {
    const wood = new THREE.MeshStandardMaterial({ color: '#5a3d26', roughness: 1 })
    const L = 7
    const plankGeo = new THREE.BoxGeometry(2.8, 0.1, 0.42)
    for (let i = 0; i < 14; i++) {
      const p = new THREE.Mesh(plankGeo, wood)
      p.position.set(0, 0.1, -L / 2 + 0.25 + i * 0.5)
      g.add(p)
    }
    const beamGeo = new THREE.BoxGeometry(0.12, 0.12, L)
    const railGeo = new THREE.BoxGeometry(0.08, 0.08, L)
    const postGeo = new THREE.BoxGeometry(0.1, 1.0, 0.1)
    for (const x of [-1.3, 1.3]) {
      const b = new THREE.Mesh(beamGeo, wood); b.position.set(x, 0, 0); g.add(b)
      const r = new THREE.Mesh(railGeo, wood); r.position.set(x, 0.95, 0); g.add(r)
      for (let k = 0; k <= 6; k++) {
        const post = new THREE.Mesh(postGeo, wood)
        post.position.set(x, 0.5, -L / 2 + k * (L / 6))
        g.add(post)
      }
    }
  }
  const d = dirAt(35)
  g.position.set(pathX(-35), 0, -35)
  g.rotation.y = Math.atan2(d.x, d.z)
  scene.add(g)
  placeLamp(pathX(-30) + 1.9, groundH(pathX(-30) + 1.9, -30), -30, 2.1)
  placeLamp(pathX(-40) - 1.9, groundH(pathX(-40) - 1.9, -40), -40, 2.1)
}

const FIN_X = pathX(-MAX_PROGRESS), FIN_Z = -MAX_PROGRESS
function buildLanding() {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#4a4033', roughness: 1 })
  )
  disc.scale.set(4.8, 1, 9.2)
  disc.position.set(PLAT_X, PLAT_TOP, LAND_Z)
  scene.add(disc)

  const sg = makeRockGeo(3.3, 3, 0.35)
  sg.computeBoundingBox()
  const sy = 0.9
  const slab = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: '#2d3029', roughness: 1, flatShading: true }))
  slab.scale.set(5.4, sy, 9.8)
  slab.position.set(PLAT_X, PLAT_TOP - 0.28 - sg.boundingBox.max.y * sy, LAND_Z)
  scene.add(slab)

  if (rockSources.length) {
    scatterRocks(SZ.rockRim, 36, () => {
      const a = rand(0, Math.PI * 2)
      return { x: PLAT_X + Math.cos(a) * 4.9 * rand(0.92, 1.08), y: PLAT_TOP - 0.1, z: LAND_Z + Math.sin(a) * 9.3 * rand(0.92, 1.08), s: rand(0.5, 1.1) }
    })
  } else for (const g of [makeRockGeo(1.1), makeRockGeo(2.2), makeRockGeo(5.7)]) {
    scatter([new THREE.InstancedMesh(g, rockMat, 12)], 12, () => {
      const a = rand(0, Math.PI * 2)
      return { x: PLAT_X + Math.cos(a) * 4.9 * rand(0.92, 1.08), y: PLAT_TOP - 0.2, z: LAND_Z + Math.sin(a) * 9.3 * rand(0.92, 1.08), s: rand(0.3, 0.75), color: rockTint() }
    }, true)
  }

  const xs = [-2.9, -0.95, 1.0, 2.9]
  const hs = [2.4, 2.9, 2.2, 2.6]
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#3b3a33', roughness: 1, flatShading: true })
  xs.forEach((dx, k) => {
    const z = LAND_Z - 6 + rand(-0.6, 0.6)
    let m
    if (rockSources.length) {
      m = fitProp(SkeletonUtils.clone(rockSources[k % rockSources.length].scene), { max: hs[k] * 1.3 })
    } else {
      m = new THREE.Mesh(makeRockGeo(10 + k, 3, 0.55), stoneMat)
      m.scale.set(0.85, hs[k] / 1.3, 0.8)
    }
    m.position.set(PLAT_X + dx, PLAT_TOP - 0.15, z)
    m.rotation.y = rand(0, 6)
    scene.add(m)
    placeLamp(PLAT_X + dx + rand(-0.15, 0.15), PLAT_TOP, z + 1.3, 0.95)
  })

  placeLamp(FIN_X - 2.1, PLAT_TOP, FIN_Z - 0.6, 2.7)
  placeLamp(FIN_X + 2.1, PLAT_TOP, FIN_Z - 0.6, 2.7)
}

/* =====================================================================
   BUTTERFLIES
   ===================================================================== */
const butterflies = []
/* ගස් ගෙදර ඉදිකිරීම + ඉණිමගෙන් නගින ගමන් මාර්ගය */
const TW = { a: 0.14, up: 0.30, pause: 0.24, down: 0.18 }       // detour එකේ කොටස් වල අනුපාත (ඉතිරිය = පාරට ආපසු)
function makeRoute(pts) {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
  return { pts, cum, total: cum[cum.length - 1] }
}
function computeTH() {
  if (!thHolder) return
  thHolder.rotation.y = -Math.PI / 2 * TH.side + TH.yaw * Math.PI / 180
  thHolder.updateMatrixWorld(true)
  const sz = thHolder.userData.size
  const L = (fx, fy, fz) => thHolder.localToWorld(new THREE.Vector3(fx * sz.x / 2, fy * sz.y, fz * sz.z / 2))
  const foot = L(TH.stairFoot[0], 0, TH.stairFoot[1]); foot.y = 0
  const top = L(TH.stairTop[0], TH.deckY, TH.stairTop[1])
  const deck = L(TH.deck[0], TH.deckY, TH.deck[1])
  const P0 = new THREE.Vector3(pathX(-TH.s0), 0, -TH.s0)
  const P1 = new THREE.Vector3(pathX(-TH.s1), 0, -TH.s1)
  thManual = { pts: [foot.clone(), top.clone(), deck.clone()], stand: deck.clone(), camDir: new THREE.Vector3(Math.sign(pathX(deck.z) - deck.x) || -1, 0, 0), camDist: 4.5 }
  thWay = { foot, top, deck, P0, P1, h: 0, camDir: null, camDist: 5, route: makeRoute([foot, top, deck]), auto: false }
  if (thAuto) applyAutoRoute()
  thSpeed()
  if (thDbg) { thDbg.children[0].position.copy(foot); thDbg.children[1].position.copy(top); thDbg.children[2].position.copy(deck) }
}
/* detour එක ඇතුළේ ඇය යන වේගය (m/s) ~ ඉණිමං නගිනකොට හෙමින්: scroll වේගය අඩු කරන සාධකය */
function thSpeed() {
  if (!thWay) return
  const pathLen = thWay.P0.distanceTo(thWay.route.pts[0]) * 2 + thWay.route.total * 2
  thK = clamp(3.6 * (TH.s1 - TH.s0) / Math.max(pathLen, 1) / 8, 0.18, 1)
}

/* ---------- ඇත්තම ඉණිමග සොයාගැනීම: ගස් ගෙදර model එක මතින් raycast කරලා (උස සිතියමක්) පාරේ සිට ගෙයි බිම දක්වා පියගැට මාර්ගය BFS/Dijkstra වලින් හොයනවා ---------- */
let thLine = null
function drawRoute() {
  if (!thWay) return
  if (thLine) { scene.remove(thLine); thLine.geometry.dispose() }
  const pts = thWay.route.pts.map(p => p.clone().add(new THREE.Vector3(0, 0.08, 0)))
  thLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x00ff66, depthTest: false }))
  thLine.renderOrder = 998
  thLine.visible = !!(thDbg && thDbg.visible)
  scene.add(thLine)
}
function applyAutoRoute() {
  const a = thAuto
  thWay.route = makeRoute(a.pts)
  thWay.deck = a.stand.clone()
  thWay.top = a.pts[Math.max(0, a.pts.length - 8)].clone()
  thWay.foot = a.pts[0].clone()
  thWay.camDir = a.camDir; thWay.camDist = a.camDist
  thWay.auto = true
  drawRoute()
}
let thSearchToken = 0
function startRouteSearch() {
  if (!thHolder) return
  const token = ++thSearchToken
  thHolder.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(thHolder)
  const c0 = box.getCenter(new THREE.Vector3())
  let CELL = 0.25
  while (((box.max.x - box.min.x + 2) / CELL) * ((box.max.z - box.min.z + 2) / CELL) > 6000) CELL += 0.05
  const gx0 = Math.floor((box.min.x - 1) / CELL), gx1 = Math.ceil((box.max.x + 1) / CELL)
  const gz0 = Math.floor((box.min.z - 1) / CELL), gz1 = Math.ceil((box.max.z + 1) / CELL)
  const nx = gx1 - gx0 + 1, nz = gz1 - gz0 + 1
  const cellsY = new Array(nx * nz)                 // ඒ ඒ කොටුවේ පාවිච්චි කළ හැකි උස (බිම + ගෙදර මතුපිට)
  const ray = new THREE.Raycaster()
  ray.firstHitOnly = false
  const down = new THREE.Vector3(0, -1, 0)
  const o = new THREE.Vector3()
  const nrm = new THREE.Vector3()
  let idx = 0
  const total = nx * nz
  const step = () => {
    if (token !== thSearchToken) return
    const t0 = performance.now()
    while (idx < total && performance.now() - t0 < 5) {
      const ix = idx % nx, iz = (idx / nx) | 0
      const x = (gx0 + ix) * CELL, z = (gz0 + iz) * CELL
      const g = groundH(x, z)
      const ys = [g]
      o.set(x, box.max.y + 1, z)
      ray.set(o, down)
      const hits = ray.intersectObject(thHolder, true)
      for (const h of hits) {
        if (!h.face || h.object.userData.leaf) continue                  // කොළ / ගහේ මතුපිට නගින්නේ නැහැ (පියගැට විතරයි)
        nrm.copy(h.face.normal).transformDirection(h.object.matrixWorld)
        if (nrm.y < 0.6) continue
        const y = h.point.y
        if (y < g + 0.05) continue
        if (!ys.some(v => Math.abs(v - y) < 0.07)) ys.push(y)
      }
      cellsY[idx] = ys
      idx++
    }
    if (idx < total) requestAnimationFrame(step)
    else finishRouteSearch(token, { gx0, gz0, nx, nz, CELL, cellsY, c0, box })
  }
  requestAnimationFrame(step)
}
function finishRouteSearch(token, G) {
  if (token !== thSearchToken || !thWay) return
  const { gx0, gz0, nx, nz, CELL, cellsY, c0, box } = G
  // nodes
  const nodes = []
  const cellNodes = new Array(nx * nz)
  for (let c = 0; c < nx * nz; c++) {
    const ix = c % nx, iz = (c / nx) | 0
    cellNodes[c] = cellsY[c].map(y => { nodes.push({ c, ix, iz, y, d: Infinity, p: -1, id: nodes.length }); return nodes.length - 1 })
  }
  // source = පාරේ ලක්ෂ්‍යයට ළඟම බිම කොටුව
  const P0 = thWay.P0
  const six = clamp(Math.round(P0.x / CELL) - gx0, 0, nx - 1), siz = clamp(Math.round(P0.z / CELL) - gz0, 0, nz - 1)
  const src = cellNodes[siz * nx + six][0]
  // Dijkstra (සරල heap)
  const heap = []
  const push = id => { heap.push(id); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (nodes[heap[p]].d <= nodes[heap[i]].d) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p } }
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && nodes[heap[l]].d < nodes[heap[m]].d) m = l; if (r < heap.length && nodes[heap[r]].d < nodes[heap[m]].d) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m } } return top }
  const STEP = 0.45
  const gRef = groundH(c0.x, c0.z)
  let yD = 0
  const runDij = (allow) => {
    for (const n of nodes) { n.d = Infinity; n.p = -1 }
    heap.length = 0
    nodes[src].d = 0; push(src)
    while (heap.length) {
      const id = pop(), n = nodes[id]
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue
        const jx = n.ix + dx, jz = n.iz + dz
        if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue
        for (const k of cellNodes[jz * nx + jx]) {
          const m = nodes[k]
          const dy = m.y - n.y
          if (Math.abs(dy) > STEP) continue
          if (allow && !allow(n, m, dy, k)) continue
          const nd = n.d + Math.hypot(dx * CELL, dz * CELL, dy) + (Math.abs(dy) > 0.2 ? 0.25 : 0)
          if (nd < m.d - 1e-6) { m.d = nd; m.p = id; push(k) }
        }
      }
    }
  }
  const findDeck = () => {                           // ගෙයි බිම මට්ටම + ඒ මත ළඟම "මැද" ලක්ෂ්‍යය
    const bins = new Map()
    for (const n of nodes) {
      if (!isFinite(n.d) || n.y < gRef + 1.2 || n.y > gRef + TH.height * 0.55) continue
      const b = Math.round(n.y / 0.2)
      bins.set(b, (bins.get(b) || 0) + 1)
    }
    let bestB = null, bestC = 0
    for (const [b, cnt] of bins) if (cnt > bestC || (cnt === bestC && b > bestB)) { bestC = cnt; bestB = b }
    if (bestB === null || bestC < 12) return -1
    yD = bestB * 0.2
    const inD = new Set()
    for (let i = 0; i < nodes.length; i++) { const n = nodes[i]; if (isFinite(n.d) && Math.abs(n.y - yD) < 0.22) inD.add(i) }
    const hasD = (ix, iz) => { if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return false; return cellNodes[iz * nx + ix].some(k => inD.has(k)) }
    let goal = -1, goalD = Infinity
    for (const id of inD) {
      const n = nodes[id]
      let cnt = 0
      for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (hasD(n.ix + a, n.iz + b)) cnt++
      if (cnt >= 38 && n.d < goalD) { goal = id; goalD = n.d }
    }
    if (goal < 0) for (const id of inD) { const n = nodes[id]; let cnt = 0; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (hasD(n.ix + a, n.iz + b)) cnt++; if (cnt >= 20 && n.d < goalD) { goal = id; goalD = n.d } }
    if (goal < 0) for (const id of inD) { const n = nodes[id]; let cnt = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (hasD(n.ix + a, n.iz + b)) cnt++; if (cnt >= 7 && n.d < goalD) { goal = id; goalD = n.d } }
    return goal
  }
  const steps = g => { let c = 0; for (let id = g; nodes[id].p >= 0; id = nodes[id].p) if (Math.abs(nodes[id].y - nodes[nodes[id].p].y) >= 0.13) c++; return c }
  runDij(null)
  let goal = findDeck()
  if (goal < 0) { console.warn('⚠ ගෙයි බිම (deck) / ඉණිමං මාර්ගය auto හොයාගන්න බැරි වුනා. T / Y යතුරු හෝ thTune() පාවිච්චි කරන්න.'); thDoneResolve && thDoneResolve(); return }
  if (steps(goal) < 3) {                              // ඉණිමං පියගැට නෙමෙයි, බෑවුම් (ramp) එකක් තෝරගත්තා නම්: බෑවුම් වලට ඉඩ දෙන්නේ නැතිව ආයෙ හොයනවා
    const yDp = yD
    runDij((n, m, dy) => { const hi = Math.max(n.y, m.y); if (hi < gRef + 0.3 || hi > yDp - 0.3) return true; const a = Math.abs(dy); return a < 0.03 || a >= 0.13 })
    const g2 = findDeck()
    if (g2 >= 0 && steps(g2) >= 3) { goal = g2; console.log('ඉණිමං පියගැට (ramp නොවේ) තෝරාගත්තා') }
    else { runDij(null); goal = findDeck() }
  }
  const makeAuto = (goal, allowOrient) => {
  let chain = []
  for (let id = goal; id >= 0; id = nodes[id].p) chain.push(id)
  chain.reverse()
  let pts = chain.map(id => new THREE.Vector3((gx0 + nodes[id].ix) * CELL, nodes[id].y, (gz0 + nodes[id].iz) * CELL))
  /* ඉණිමග පාර පැත්තට හැරෙන්න ගස් ගෙදර ඉබේම කරකවනවා (එක් වරක්) */
  if (allowOrient && !thOriented) {
    thOriented = true
    let fi = pts.findIndex(p => p.y > gRef + 0.25); if (fi < 0) fi = 0
    const f = pts[fi]
    const fx = f.x - c0.x, fz = f.z - c0.z
    if (Math.hypot(fx, fz) > 0.8) {
      const a1 = Math.atan2(fx, fz)
      const tx = pathX(c0.z) - c0.x
      const a2 = Math.atan2(tx, 0.0001)
      let dl = a2 - a1
      dl = Math.atan2(Math.sin(dl), Math.cos(dl))
      if (Math.abs(dl) > 0.26) {
        TH.yaw = (TH.yaw + dl * 180 / Math.PI + 360) % 360
        console.log('ගස් ගෙදර ඉණිමග පාර පැත්තට කරකැවුවා, yaw =', TH.yaw.toFixed(0))
        thAuto = null
        computeTH()
        startRouteSearch()
        return 'restart'
      }
    }
  }
  /* පියගැට මැදටම: පාර දෙපැත්තට පියගැටයේ පළල මැන මැදට ගන්නවා (කෙළවරින් නොයන්න) */
  const walk = (x, z, y) => {
    const ix = Math.round(x / CELL) - gx0, iz = Math.round(z / CELL) - gz0
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return false
    return cellsY[iz * nx + ix].some((v, k) => k > 0 && Math.abs(v - y) < 0.3)
  }
  const orig = pts.map(p => p.clone())
  for (let i = 2; i < pts.length - 1; i++) {
    const a = orig[Math.max(0, i - 3)], b = orig[Math.min(orig.length - 1, i + 3)]
    let tx = b.x - a.x, tz = b.z - a.z
    const tl = Math.hypot(tx, tz)
    if (tl < 0.3 || (b.y - a.y) / tl < 0.15) continue          // පියගැට නොවන තැන් නැහැ
    tx /= tl; tz /= tl
    const px = -tz, pz = tx, p = orig[i]
    let plus = 0, minus = 0
    while (plus < 1.4 && walk(p.x + px * (plus + 0.1), p.z + pz * (plus + 0.1), p.y)) plus += 0.1
    while (minus < 1.4 && walk(p.x - px * (minus + 0.1), p.z - pz * (minus + 0.1), p.y)) minus += 0.1
    const off = (plus - minus) / 2
    pts[i].x = p.x + px * off; pts[i].z = p.z + pz * off
  }
  for (let pass = 0; pass < 2; pass++) {               // සුමට කිරීම
    const q = pts.map(p => p.clone())
    for (let i = 1; i < pts.length - 1; i++) {
      const w = Math.min(3, i, pts.length - 1 - i)
      q[i].set(0, 0, 0)
      for (let k = -w; k <= w; k++) q[i].add(pts[i + k])
      q[i].multiplyScalar(1 / (2 * w + 1))
    }
    pts = q
  }
  // ලක්ෂ්‍ය අඩු කිරීම (සෑම ~0.4m කට එකක්)
  const thin = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) if (pts[i].distanceTo(thin[thin.length - 1]) > 0.38) thin.push(pts[i])
  thin.push(pts[pts.length - 1])
  const stand = thin[thin.length - 1].clone()
  // camera දිශාව: ගස් ගෙදර අවහිර නොවන, පාර පැත්ත වැඩිපුර
  const toRoad = new THREE.Vector3(pathX(stand.z) - stand.x, 0, 0)
  if (toRoad.lengthSq() < 1e-4) toRoad.set(0, 0, 1)
  toRoad.normalize()
  const ray = new THREE.Raycaster()
  let bestDir = toRoad.clone(), bestScore = -9, bestFree = 5
  const head = new THREE.Vector3(stand.x, stand.y + 1.6, stand.z)
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    const d = new THREE.Vector3(Math.sin(a), 0.12, Math.cos(a)).normalize()
    ray.set(head, d); ray.far = 6
    const hit = ray.intersectObject(thHolder, true)[0]
    const free = hit ? hit.distance : 6
    const sc = Math.min(free, 5.2) + 1.4 * new THREE.Vector3(d.x, 0, d.z).normalize().dot(toRoad)
    if (sc > bestScore) { bestScore = sc; bestDir = new THREE.Vector3(d.x, 0, d.z).normalize(); bestFree = free }
  }
  return { pts: thin, stand, camDir: bestDir, camDist: clamp(bestFree - 0.5, 2.8, 5.2), chain }
  }
  const A = makeAuto(goal, true)
  if (A === 'restart') return
  const routes = [A]
  /* දෙවෙනි ඉණිමං මාර්ගය (වෙනත් පියගැට/බෑවුම): පළමු මාර්ගයේ මැද කොටස අවහිර කරලා ආයෙ හොයනවා */
  const blocked = new Set()
  for (const id of A.chain) {
    const n = nodes[id]
    if (n.y < gRef + 0.3 || n.y > yD - 0.3) continue
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const jx = n.ix + a, jz = n.iz + b
      if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue
      for (const k of cellNodes[jz * nx + jx]) if (Math.abs(nodes[k].y - n.y) < 0.5) blocked.add(k)
    }
  }
  const yDa = yD
  runDij((n, m, dy, k) => !blocked.has(k))
  const g2 = findDeck()
  if (g2 >= 0 && Math.abs(yD - yDa) < 0.6 && nodes[g2].d < nodes[goal].d * 3 + 12) {
    const B = makeAuto(g2, false)
    if (B && B !== 'restart') routes.push(B)
  }
  if (thManual) routes.push(thManual)                    // අතින් දුන් (පරණ) මාර්ගයත් විකල්පයක් ලෙස
  thRoutes = routes
  const saved = parseInt(lsGet('thRoute2'))
  thRouteIdx = Number.isFinite(saved) && saved >= 0 && saved < routes.length ? saved : 0          // default = 1 වෙනි (ඔයා හරි කියපු) මාර්ගය   // N යතුරෙන් මාරු කරන්න; තෝරපු එක මතක තියාගන්නවා
  thAuto = routes[thRouteIdx]
  applyAutoRoute()
  thSpeed()
  setupTHLights()
  console.log(`✔ ඉණිමං මාර්ග ${routes.length}ක් (1,2 = auto, 3 = අතින් දුන්) හම්බුනා. දැන් ${thRouteIdx + 1} වෙනි (N = මාරු කරන්න, T = මාර්ගය පෙන්වන්න). දිග ${thWay.route.total.toFixed(1)}m`)
  if (thDbg) { thDbg.children[0].position.copy(thWay.foot); thDbg.children[1].position.copy(thWay.top); thDbg.children[2].position.copy(thWay.deck) }
  thDoneResolve && thDoneResolve()
}
let thRoutes = [], thRouteIdx = 0, thManual = null
let thDoneResolve = null
const thDone = new Promise(r => { thDoneResolve = r })       // ඉණිමං මාර්ග සෙවීම ඉවර වෙනකම් loading තිරය තියනවා (පළමු වතාවෙත් හරි මාර්ගයෙන් නගින්න)
const lsGet = k => { try { return localStorage.getItem(k) } catch (e) { return null } }
const lsSet = (k, v) => { try { localStorage.setItem(k, v) } catch (e) {} }
let thLamp = null, thOriented = false     // ඉණිමග පාර පැත්තට ඉබේම කරකැවෙනවා (Y යතුරෙන් අතින් ද කරකවන්න පුළුවන්)
const thCenter = new THREE.Vector3()
function setupTHLights() {
  if (!thWay) return
  const st = thWay.deck
  const perp = new THREE.Vector3(-thWay.camDir.z, 0, thWay.camDir.x)
  if (thLamp) { scene.remove(thLamp); lampGroups.splice(lampGroups.indexOf(thLamp), 1) }
  thLamp = placeLamp(st.x + perp.x * 1.1, st.y, st.z + perp.z * 1.1, 1.0, false)     // ගෙයි බිමේ lantern එක (දැල්වෙන)
  thLamp.userData.keep = true
}

/* treehouse.gltf load වුනේ නැත්නම් (bin/texture නැති නිසා) ඒ වෙනුවට මේ ගස් ගෙදර හදනවා: ඉණිමග + බිම + කුටිය + ජනෙල් */
function procTreehouse() {
  const g = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: '#7a5636', roughness: 0.95 })
  const bark = new THREE.MeshStandardMaterial({ color: '#4a3422', roughness: 1 })
  const roofM = new THREE.MeshStandardMaterial({ color: '#8a3a2e', roughness: 0.9 })
  const leaf = new THREE.MeshStandardMaterial({ color: '#2f5f3c', roughness: 1 })
  const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.72, 0.28).multiplyScalar(1.25) })
  const add = (geo, mat, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); g.add(m); return m }
  add(new THREE.CylinderGeometry(0.7, 1.05, 9, 10), bark, 0, 4.5, 0)                            // කඳ
  add(new THREE.ConeGeometry(3.6, 4.2, 9), leaf, 0, 7.2, 0)                                      // කොළ
  add(new THREE.ConeGeometry(2.6, 3.8, 9), leaf, 0, 9.5, 0)
  add(new THREE.ConeGeometry(1.5, 2.8, 9), leaf, 0, 11.1, 0)
  add(new THREE.BoxGeometry(5.6, 0.3, 5.6), wood, 0, 2.95, 0)                                   // ගෙයි බිම (උඩ = 3.1)
  for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) add(new THREE.CylinderGeometry(0.14, 0.14, 3, 6), wood, x, 1.5, z)
  add(new THREE.BoxGeometry(3.2, 2.4, 3.2), wood, 0, 4.3, -0.8)                                  // කුටිය
  add(new THREE.ConeGeometry(2.9, 1.7, 4), roofM, 0, 6.35, -0.8, Math.PI / 4)                    // වහලය
  add(new THREE.BoxGeometry(0.75, 0.95, 0.06), win, 0.8, 4.3, 0.83)                              // ජනේල
  add(new THREE.BoxGeometry(0.75, 0.95, 0.06), win, -0.8, 4.3, 0.83)
  for (const x of [-2.7, 2.7]) add(new THREE.BoxGeometry(0.07, 0.07, 5.6), wood, x, 4.0, 0)       // රේල්
  add(new THREE.BoxGeometry(3.2, 0.07, 0.07), wood, -1.1, 4.0, 2.7)
  const N = 12                                                                                    // ඉණිමං පියගැට: z = 7.2 (බිම) → 2.7 (බිම මට්ටම 3.1)
  for (let i = 0; i < N; i++) add(new THREE.BoxGeometry(1.1, 0.1, 0.42), wood, 1.6, 3.1 * (i + 1) / N - 0.05, 7.2 - 4.5 * (i + 0.5) / N)
  const th = Math.atan2(3.1, 4.5)
  for (const dx of [-0.55, 0.55]) add(new THREE.BoxGeometry(0.1, 0.2, Math.hypot(4.5, 3.1)), wood, 1.6 + dx, 1.55, 4.95, 0, th)
  g.updateMatrixWorld(true)
  const b = new THREE.Box3().setFromObject(g), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3())
  const fx = x => (x - c.x) / (s.x / 2), fz = z => (z - c.z) / (s.z / 2)
  Object.assign(TH, {                                                                              // ඉණිමං ලක්ෂ්‍ය (බිම / මුදුන / ගෙයි බිම) මේකට ගැලපෙන්න
    stairFoot: [fx(1.6), fz(7.0)], stairTop: [fx(1.6), fz(2.9)],
    deckY: (3.15 - b.min.y) / s.y, deck: [fx(0.8), fz(1.7)], yaw: 0
  })
  return g
}

function buildTreehouse(gltf) {
  thHolder = fitProp(gltf ? gltf.scene : procTreehouse(), { height: TH.height })
  if (!gltf) console.warn('treehouse.gltf නැති නිසා ගොඩනගපු ගස් ගෙදර භාවිතා කරනවා')
  thHolder.position.set(TH_X, -0.05, TH_Z)
  scene.add(thHolder)
  thDbg = new THREE.Group()
  for (const c of [0xff3030, 0xffd030, 0x30ff60]) {                // ඉණිමං පාමුල / මුදුන / ගෙයි බිම (T ඔබලා බලන්න)
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: c, depthTest: false }))
    m.renderOrder = 999
    thDbg.add(m)
  }
  thDbg.visible = false
  scene.add(thDbg)
  /* දිලිසෙන කළු ලෝහ පෙනුම නැතිකරනවා: matte, ස්වභාවික දැව පාට */
  thHolder.traverse(o => {
    if (!o.isMesh) return
    ;(Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (!m) return
      if ('metalness' in m) m.metalness = Math.min(m.metalness || 0, 0.05)
      if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 1, 0.8)
      m.envMapIntensity = 0
      if (m.color && !m.map) { const hsl = {}; m.color.getHSL(hsl); if (hsl.l < 0.12) m.color.set('#6b4a30') }
      m.needsUpdate = true
    })
    o.castShadow = false; o.receiveShadow = false
  })
  /* ගස් කොළ කොළ පාට (කොළ වලට green) */
  const hb = new THREE.Box3().setFromObject(thHolder)
  hb.getCenter(thCenter); thCenter.y = hb.min.y
  const Hh = hb.max.y - hb.min.y
  const mb = new THREE.Box3(), mc = new THREE.Vector3()
  thHolder.traverse(o => {
    if (!o.isMesh) return
    mb.setFromObject(o); mb.getCenter(mc)
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    const leafy = mats.some(m => m && /leaf|leaves|foliage|canopy|crown|plant|needle/i.test((m.name || '') + (o.name || ''))) || (mc.y - hb.min.y > 0.62 * Hh && (mb.max.x - mb.min.x) > 1.5)
    if (!leafy) return
    const g = mats.map(m => {
      if (!m) return m
      const n = m.clone()
      if (n.color) n.color.set('#5fa04a')
      if (n.emissive) { n.emissive.set('#12380f'); n.emissiveIntensity = 0.25 }
      n.side = THREE.DoubleSide
      n.needsUpdate = true
      return n
    })
    o.material = Array.isArray(o.material) ? g : g[0]
    o.userData.leaf = true
  })
  computeTH()
  startRouteSearch()
  console.log('✔ tree house placed. Keys: T = ඉණිමං ලක්ෂ්‍ය පෙන්වන්න, Y = 90° කරකවන්න. Console: thTune({ stairFoot:[x,z], stairTop:[x,z], deckY, deck:[x,z] })')
}
window.thTune = (o = {}) => { Object.assign(TH, o); computeTH(); console.log('TH =', JSON.stringify(TH)) }
addEventListener('keydown', e => {
  const k = e.key.toLowerCase()
  if (k === 'n' && thRoutes.length > 1) { thRouteIdx = (thRouteIdx + 1) % thRoutes.length; thAuto = thRoutes[thRouteIdx]; applyAutoRoute(); thSpeed(); setupTHLights(); lsSet('thRoute2', thRouteIdx); console.log('ඉණිමං මාර්ගය', thRouteIdx + 1, '/', thRoutes.length, 'තෝරාගත්තා (මතක තියාගන්නවා)') }
  else if (k === 't' && thDbg) { thDbg.visible = !thDbg.visible; if (thLine) thLine.visible = thDbg.visible }
  else if (k === 'y' && thHolder) { TH.yaw = (TH.yaw + 90) % 360; thOriented = true; thAuto = null; computeTH(); startRouteSearch(); console.log('TH.yaw =', TH.yaw) }
})

const _rA = new THREE.Vector3(), _rB = new THREE.Vector3()
function routeAt(R, Ld, out) {
  const L = clamp(Ld, 0, R.total)
  let lo = 0, hi = R.cum.length - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (R.cum[m] <= L) lo = m; else hi = m }
  const seg = R.cum[hi] - R.cum[lo]
  const t = seg > 1e-6 ? (L - R.cum[lo]) / seg : 0
  return out.lerpVectors(R.pts[lo], R.pts[hi], t)
}
const thOut = { x: 0, y: 0, z: 0, pause: false, heading: 0, stairs: false }
function thDetour(u) {
  const W = thWay, R = W.route
  const o = thOut
  o.pause = false; o.stairs = false
  const a = TW.a, e1 = a + TW.up, e2 = e1 + TW.pause, e3 = e2 + TW.down
  const first = R.pts[0]
  const look = (p, q) => { const dx = q.x - p.x, dz = q.z - p.z; if (dx * dx + dz * dz > 1e-5) W.h = Math.atan2(dx, dz) }
  if (u < a) {
    const t = u / a
    _rA.set(THREE.MathUtils.lerp(W.P0.x, first.x, t), THREE.MathUtils.lerp(groundH(W.P0.x, W.P0.z), first.y, t), THREE.MathUtils.lerp(W.P0.z, first.z, t))
    look(W.P0, first)
  } else if (u < e1) {
    const L = (u - a) / TW.up * R.total
    routeAt(R, L, _rA); routeAt(R, L + 0.7, _rB)
    look(routeAt(R, L - 0.7, _rA.clone()), _rB)
    routeAt(R, L, _rA)
    o.stairs = (_rB.y - _rA.y) / Math.max(0.05, Math.hypot(_rB.x - _rA.x, _rB.z - _rA.z)) > 0.2
  } else if (u < e2) {
    _rA.copy(R.pts[R.pts.length - 1]); o.pause = true
  } else if (u < e3) {
    const L = (1 - (u - e2) / TW.down) * R.total
    routeAt(R, L, _rA); routeAt(R, L - 0.7, _rB)
    look(_rA, _rB)
  } else {
    const t = (u - e3) / (1 - e3)
    _rA.set(THREE.MathUtils.lerp(first.x, W.P1.x, t), THREE.MathUtils.lerp(first.y, groundH(W.P1.x, W.P1.z), t), THREE.MathUtils.lerp(first.z, W.P1.z, t))
    look(first, W.P1)
  }
  o.x = _rA.x; o.y = _rA.y; o.z = _rA.z; o.heading = W.h
  return o
}

/* සමනලුන් ස්වභාවිකව පෙනෙන්න (අඳුරු වෙන්නේ නැතිව) */
function brightenFly(root) {
  root.traverse(o => {
    if (!o.isMesh) return
    ;(Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (!m) return
      m.side = THREE.DoubleSide
      if (m.emissive) {
        if (m.map) { m.emissiveMap = m.map; m.emissive.setRGB(1, 1, 1) } else m.emissive.setRGB(0.25, 0.25, 0.25)   // ස්වභාවික පාට (halo / කහ ආලෝකය නැහැ)
        m.emissiveIntensity = 0
      }
      m.needsUpdate = true
    })
  })
}

function buildButterflies() {
  if (props.flock) {
    for (let i = 0; i < 3; i++) {
      const root = SkeletonUtils.clone(props.flock.scene)
      const holder = fitProp(root, { max: SZ.flock })
      const g = new THREE.Group()
      g.add(holder)
      const u = { flock: true, ph: rand(0, 6.28), sp: rand(0.35, 0.6), rx: rand(1.5, 3), rz: rand(2, 4), cy: 1.3 + i * 0.5, side: (i - 1) * 4.5, ahead: 5 + i * 9 }
      if (props.flock.animations.length) {
        u.mixer = new THREE.AnimationMixer(root)
        props.flock.animations.forEach(c => u.mixer.clipAction(c).play())
      }
      g.userData = u
      g.position.set(pathX(-u.ahead) + u.side, 1.8, -u.ahead)
      scene.add(g)
      butterflies.push(g)
    }
    return
  }
  const palette = [[2.6, 2.0, 0.25], [2.4, 1.6, 0.2], [2.6, 2.2, 0.6], [2.2, 1.4, 0.15]]
  const wingGeo = new THREE.PlaneGeometry(0.2, 0.15)
  wingGeo.rotateX(-Math.PI / 2)
  wingGeo.translate(0.1, 0, 0)
  for (let i = 0; i < COUNT.butterflies; i++) {
    const g = new THREE.Group()
    /* සමනලුන් හැමතැනම නැහැ: කොටස් 3 කදී විතරක් (ආරම්භය / ගඟ අසල පාර / අවසානය), ඇය ළඟින්ම පොඩි ගාණක් */
    const zone = i < 4 ? [0, 34] : i < 6 ? [60, 96] : [LAND_S - 8, MAX_PROGRESS + 6]
    const u = {
      ph: rand(0, 6.28), sp: rand(0.5, 0.9), zone,
      rx: rand(0.6, 1.3), rz: rand(0.8, 1.5),
      cy: rand(1.0, 1.9),
      side: rand(-2.0, 2.0), ahead: rand(0.8, 4.5)
    }
    if (props.butterfly) {
      const root = SkeletonUtils.clone(props.butterfly.scene)
      brightenFly(root)
      const fitted = fitProp(root, { max: SZ.butterfly })
      g.add(fitted)
      if (props.butterfly.animations.length) {
        u.mixer = new THREE.AnimationMixer(root)
        const a = u.mixer.clipAction(props.butterfly.animations[0])
        a.timeScale = rand(0.8, 1.3)
        a.time = rand(0, 1)
        a.play()
      } else u.flap = fitted                 // animation නැත්නම් පියාපත් සෙලවීම අපි කරනවා
    } else {
      const c = palette[i % palette.length]
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]), side: THREE.DoubleSide })
      const r = new THREE.Mesh(wingGeo, mat)
      const l = new THREE.Mesh(wingGeo, mat)
      l.scale.x = -1
      g.add(r, l)
      u.r = r; u.l = l
    }
    g.userData = u
    g.position.set(pathX(-u.ahead) + u.side, 1.5, -u.ahead)
    scene.add(g)
    butterflies.push(g)
  }
}

/* =====================================================================
   BUILD WORLD  (පළමුව අත්‍යවශ්‍ය දේවල්, ඉන්පසු කුඩා පැළ/moss/සමනලුන් පසුබිමේ load වෙනවා)
   ===================================================================== */
async function buildWorld() {
  const [treeG, rockG, boatG, lampG, bridgeG, dockG, waterG, floorG, rock3, thG, thFbx] = await Promise.all([
    tryLoadList(FILES.trees), tryLoadList(FILES.rocks),
    tryLoadFirst(FILES.boat), tryLoadFirst(FILES.lamp), tryLoadFirst(FILES.bridge), tryLoadFirst(FILES.dock),
    tryLoadFirst(FILES.water), tryLoadFirst(FILES.floor), loadFbxSafe(ROCK_FBX),
    tryLoadFirst(FILES.treehouse), loadFbxSafe('treehouse.fbx')          // treehouse.fbx තියෙනවා නම් ඒක පළමුව
  ])
  console.log('Assets found:', { trees: treeG.length, rocks: rockG.length, boat: !!boatG, lamp: !!lampG, bridge: !!bridgeG, dock: !!dockG, water: !!waterG, floor: !!floorG, rock3: !!rock3, treehouse: !!thG })

  if (boatG) props.boat = fitProp(boatG.scene, { length: SZ.boatLen, alongZ: true, flip: SZ.boatFlip })
  if (lampG) props.lamp = fitProp(lampG.scene, { height: 1 })
  if (bridgeG) props.bridge = fitProp(bridgeG.scene, { length: SZ.bridgeLen, alongZ: true })
  if (dockG) props.dock = fitProp(dockG.scene, { length: SZ.dockLen, alongZ: true })

  if (rock3) props.rock3 = { scene: rock3 }
  if (props.rock3) rockSources.push(props.rock3)
  rockSources.push(...rockG)

  if (floorG) applyFloor(floorG)

  /* ---- ගස් ---- */
  const pineLeaf = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })
  const pineTrunk = new THREE.MeshStandardMaterial({ color: '#2e2118', roughness: 1 })
  addWind(pineLeaf, 8, 1.1)
  function pines(count, place) {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 2.6, 6); trunkGeo.translate(0, 1.3, 0)
    const l1 = new THREE.ConeGeometry(1.7, 3.2, 8); l1.translate(0, 3.0, 0)
    const l2 = new THREE.ConeGeometry(1.35, 3.0, 8); l2.translate(0, 4.8, 0)
    const l3 = new THREE.ConeGeometry(0.95, 2.6, 8); l3.translate(0, 6.4, 0)
    const meshes = [
      new THREE.InstancedMesh(trunkGeo, pineTrunk, count),
      ...[l1, l2, l3].map(g => new THREE.InstancedMesh(g, pineLeaf, count))
    ]
    return scatter(meshes, count, () => {
      const p = place()
      if (p) p.color = col.setHSL(0.36 + rand(0, 0.05), 0.4, 0.14 + rand(0, 0.1)).clone()
      return p
    }, true)
  }

  if (treeG.length) {
    const per = Math.ceil(COUNT.treeNear / treeG.length)
    treeG.forEach(g => scatterGLTF(g, { height: SZ.tree, count: per, place: placeTreeNear, wind: 1.4, tint: true }))
    pines(COUNT.treeFar, placeTreeFar)
  } else {
    pines(COUNT.treeNear, placeTreeNear)
    pines(COUNT.treeFar, placeTreeFar)
  }
  /* ගඟ / pool එක අවට පොඩි ගස් */
  if (treeG.length) treeG.forEach(g => scatterGLTF(g, { height: 3.4, count: Math.ceil(pick(70, 160) / treeG.length), place: placeBabyTree, wind: 1.4, tint: true }))
  else pines(pick(70, 160), () => { const p = placeBabyTree(); if (p) p.s *= 0.4; return p })
  /* ගස් ගෙදර වටේ ගස් */
  if (treeG.length) treeG.forEach(g => scatterGLTF(g, { height: SZ.tree * 0.85, count: Math.ceil(pick(16, 34) / treeG.length), place: placeTHTree, wind: 1.4, tint: true }))
  else pines(pick(14, 30), () => { const p = placeTHTree(); if (p) p.s *= 1.0; return p })

  /* ---- ගල් (models වලින්) ---- */
  if (rockSources.length) {
    scatterRocks(SZ.rockBank, COUNT.bankRocks, placeBankRock)
    scatterRocks(SZ.rockPath, COUNT.pathRocks, placePathRock)
    scatterRocks(SZ.fenceFall, 18, placeFallRock, true)
    scatterRocks(SZ.fenceSmall, 30, placeSmallFence)
    buildCliffRocks(props.rock3 || rockSources[0])           // දිය ඇල්ල පිටිපස්සේ ස්වභාවික ගල් බිත්තිය
  } else {
    const geos = [makeRockGeo(1), makeRockGeo(4.2), makeRockGeo(7.7)]
    const procRocks = (count, place) => {
      const per = Math.ceil(count / geos.length)
      geos.forEach(g => scatter([new THREE.InstancedMesh(g, rockMat, per)], per, () => { const p = place(); if (p) p.color = rockTint(); return p }, true))
    }
    procRocks(COUNT.bankRocks, placeBankRock)
    procRocks(COUNT.pathRocks, placePathRock)
    procRocks(28, placeFallRock)
  }

  /* ---- ඉදිකිරීම් ---- */
  buildBridge()
  buildPier()
  buildLanding()
  boat = buildBoat()
  if (waterG) buildWaterTiles(waterG)
  buildTreehouse(thFbx ? { scene: thFbx } : (thG || null))      // පරණ treehouse.fbx පළමුව, නැත්නම් treehouse.glb/gltf

  /* ---- Lamps: පාර දෙපැත්තේ සහ ගඟ ඉවුරේ ---- */
  let side = 1
  for (let z = -6; z > -44 - S1; z -= 22) {                  // lamp ටික (තැනින් තැන විතරයි)
    if (Math.abs(z + 35) < 6) continue
    const x = pathX(z) + side * (PATH_HW + 0.5)
    placeLamp(x, groundH(x, z), z)
    side *= -1
  }
  for (let z = -66 - S1; z > -126 - S2; z -= 28) {
    const x = pathX(z) + side * (riverHW(z) * 1.15 + 0.3)
    placeLamp(x, groundH(x, z), z)
    side *= -1
  }

  /* chapter (නැවතුම්) එකක් ළඟ lantern එකක් (card එක එහි සිට පෙනේ) */
  CHAPTERS.forEach(c => {
    if (c.noCard || c.th) return
    const sp = lampSpot(c)
    if (sp) placeLamp(sp.x, sp.y, sp.z, 2.2)
  })

  await Promise.race([thDone, new Promise(r => setTimeout(r, 25000))])        // ඉණිමං මාර්ගය හොයාගන්නකම් (උපරිම තත්පර 25)
  loadingEl.style.opacity = 0
  setTimeout(() => loadingEl.remove(), 1200)
  window.forestReady && window.forestReady()

  buildExtras().catch(e => { console.error('Extras error:', e); showErr('EXTRAS: ' + (e && e.stack || e)) })
}

async function buildExtras() {
  const [plantG, grassG, mossG, flyG, flockG, flyFbx] = await Promise.all([
    tryLoadList(FILES.plants), tryLoadList(FILES.grass), tryLoadFirst(FILES.moss),
    tryLoadFirst(FILES.butterfly), tryLoadFirst(FILES.flock), loadFbxSafe(BUTTERFLY_FBX)
  ])
  if (flyG) props.butterfly = flyG
  if (flockG) props.flock = flockG
  if (flyFbx) {
    props.butterfly = { scene: flyFbx, animations: flyFbx.animations || [] }
    props.flock = null
  }
  console.log('Extras found:', { plants: plantG.length, grass: grassG.length, moss: !!mossG, butterfly: !!props.butterfly, flock: !!props.flock })

  if (grassG.length) {
    const total = Math.max(COUNT.grass, pick(300, 700))
    grassG.forEach(g => scatterGLTF(g, { height: SZ.grass, count: Math.ceil(total / grassG.length), place: placeGrass, wind: 2.2, tint: true }))
  }
  if (plantG.length) {
    plantG.forEach(g => scatterGLTF(g, { height: SZ.plant, count: Math.ceil(COUNT.plants / plantG.length), place: placePlant, wind: 1.6, tint: true }))
  }
  const smallSrc = [...plantG, ...grassG]
  smallSrc.forEach(g => scatterGLTF(g, { height: SZ.smallPlant, count: Math.ceil(COUNT.smallPlants / smallSrc.length), place: placeSmallPlant, wind: 1.8, tint: true }))
  // පාර දෙපැත්තේ (ඇය ඇවිදින තැන වටේ) කුඩා පැළ තව එකතු කරනවා
  smallSrc.forEach(g => scatterGLTF(g, { height: SZ.smallPlant * 1.15, count: Math.ceil(pick(320, 800) / smallSrc.length), place: placePathEdgePlant, wind: 1.8, tint: true }))
  smallSrc.forEach(g => scatterGLTF(g, { height: SZ.smallPlant * 1.3, count: Math.ceil(pick(380, 900) / smallSrc.length), place: placeRiverPlant, wind: 1.8, tint: true }))
  smallSrc.forEach(g => scatterGLTF(g, { height: SZ.smallPlant * 1.5, count: Math.ceil(pick(150, 340) / smallSrc.length), place: placePoolPlant, wind: 1.8, tint: true }))
  smallSrc.forEach(g => scatterGLTF(g, { height: SZ.smallPlant * 1.4, count: Math.ceil(pick(110, 260) / smallSrc.length), place: placeTHPlant, wind: 1.8, tint: true }))
  if (plantG.length) plantG.forEach(g => scatterGLTF(g, { height: SZ.plant, count: Math.ceil(pick(30, 70) / plantG.length), place: placeTHPlant, wind: 1.6, tint: true }))
  if (mossG) scatterGLTF(mossG, { max: SZ.moss, count: COUNT.moss, place: placeMoss, tint: true })

  buildButterflies()
  setTimeout(() => console.log('GPU info:', JSON.stringify(window.gpuInfo())), 6000)
}
buildWorld().catch(e => {
  console.error('World build error:', e)
  showErr('WORLD BUILD: ' + (e && e.stack || e))
  loadingEl.remove()
  window.forestReady && window.forestReady()
})

/* =====================================================================
   CHARACTER
   ===================================================================== */
let mixer, girl, current = 'Waving'
const actions = {}

function lockRoot(clip) {
  clip.tracks.forEach(tr => {
    if (/Hips\.position$/.test(tr.name)) {
      const v = tr.values
      const x0 = v[0], z0 = v[2]
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0 }
    }
  })
}

async function initCharacter() {
  try {
    const names = ['Walking', 'Waving', 'Talking', 'Paddling']
    const missing = []
    let lastErr = ''
    /* එක් එක් file එක වෙන වෙනම load කරනවා (එකක් නැති වුනාට ඇය නැති වෙන්නේ නැහැ). Linux/Vercel වල ලොකු-පොඩි අකුරු වැදගත් නිසා lowercase නමත් උත්සාහ කරනවා */
    const grab = async (file, optional = false) => {
      for (const f of [file, file.toLowerCase()]) {
        try { return await fbxLoader.loadAsync(encodeURI(`${BASE}${f}`)) } catch (e) { lastErr = (e && (e.message || e.type || e.target && e.target.status)) || String(e); console.warn('FBX load fail:', f, e) }
      }
      if (!optional) missing.push(file + ' [' + lastErr + ']')
      return null
    }
    const [idleFbx, stairsFbx, ...fbxs] = await Promise.all([
      grab('Idle.fbx', true),
      grab('Walking Up The Stairs.fbx', true),
      ...names.map(n => grab(`${n}.fbx`))
    ])
    if (idleFbx) shrinkObj(idleFbx, MAXT, LITE)
    if (stairsFbx) stairsFbx.animations.forEach(lockRoot)
    const hasSkin = o => { let f = false; o.traverse(c => { if (c.isSkinnedMesh) f = true }); return f }
    girl = [...fbxs, idleFbx, stairsFbx].find(f => f && hasSkin(f)) || null       // skin (මෝස්තරය) තියෙන පළමු file එක ඇයගේ ශරීරය
    if (!girl) {
      const msg = 'ඇයගේ model එක load වුනේ නැහැ. public/ ඇතුලේ Walking.fbx (skin එක්ක) තියෙනවද බලන්න. නැති file: ' + (missing.join(', ') || 'Walking.fbx')
      console.warn(msg)
      showErr(msg)
      return
    }
    if (missing.length) { console.warn('public/ ඇතුලේ නැති animation files:', missing) }
    shrinkObj(girl, pick(512, 1024), false)            // ඇයගේ texture (phone වල 512)
    fbxs.forEach(f => f && f.animations.forEach(lockRoot))
    if (idleFbx) idleFbx.animations.forEach(lockRoot)
    girl.scale.setScalar(1)
    girl.updateMatrixWorld(true)
    const size = new THREE.Box3().setFromObject(girl).getSize(new THREE.Vector3())
    let k = size.y > 0.001 ? CHAR_HEIGHT / size.y : 0.01
    if (k < 0.0005 || k > 0.1) k = 0.01
    girl.scale.setScalar(k)
    /* FBX (Phong) මැටීරියල් => PBR වලට හරවනවා: ආලෝකයට ස්වභාවිකව ප්‍රතිචාර දක්වනවා, සුදු/දිලිසෙන ගතිය නැතිවෙනවා */
    const toStd = m => {
      if (!m || m.isMeshStandardMaterial) return m
      try {
        const n = new THREE.MeshStandardMaterial({
          color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
          map: m.map || null, normalMap: m.normalMap || null, alphaMap: m.alphaMap || null,
          transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side,
          depthWrite: m.depthWrite, roughness: 0.8, metalness: 0,
          emissive: m.map ? new THREE.Color(1, 1, 1) : (m.color ? m.color.clone() : new THREE.Color(0)),
          emissiveMap: m.map || null, emissiveIntensity: CHAR_GLOW
        })
        if (n.map) n.map.colorSpace = THREE.SRGBColorSpace
        n.name = m.name
        return n
      } catch (e) { return m }
    }
    girl.traverse(o => {
      if (!o.isMesh) return
      o.frustumCulled = false
      o.castShadow = true
      o.material = Array.isArray(o.material) ? o.material.map(toStd) : toStd(o.material)
    })
    scene.add(girl)
    mixer = new THREE.AnimationMixer(girl)
    names.forEach((n, i) => { if (fbxs[i] && fbxs[i].animations[0]) actions[n] = mixer.clipAction(fbxs[i].animations[0]) })
    if (idleFbx && idleFbx.animations[0]) actions.Idle = mixer.clipAction(idleFbx.animations[0])
    if (stairsFbx && stairsFbx.animations[0]) actions.Stairs = mixer.clipAction(stairsFbx.animations[0])
    const first = actions.Waving || actions.Idle || actions.Walking || Object.values(actions)[0]
    if (first) { first.play(); current = Object.keys(actions).find(k => actions[k] === first) }
    console.log('Character loaded, scale =', k, 'Idle =', !!actions.Idle)
  } catch (e) {
    console.warn('Character load failed:', e)
  }
}
initCharacter()

function play(name, timeScale = 1) {
  if (!actions[name]) name = actions.Idle ? 'Idle' : 'Waving'
  if (!actions[name]) return
  actions[name].timeScale = timeScale
  if (current === name) return
  actions[name].reset().fadeIn(0.3).play()
  actions[current]?.fadeOut(0.3)
  current = name
}

/* ---------- හබල (paddle): ඇයගේ අතේ සිට දිය තෙක්. Paddling animation එකත් එක්ක දියට ඇතුල් වෙලා / උඩට ඇදලා, ripple + splash ---------- */
let paddle = null, handR = null
function makeProcPaddle() {
  const g = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: '#a56d3c', roughness: 0.8 })
  const dark = new THREE.MeshStandardMaterial({ color: '#6b4429', roughness: 0.9 })
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.9, 8), wood)
  shaft.position.y = -0.7                                   // මුදුන +0.25 සිට පහළ -1.65 දක්වා
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), dark)
  knob.position.y = 0.27
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.74, 0.035), wood)
  blade.position.y = -1.28
  g.add(shaft, knob, blade)
  return g
}
const PADDLE_L = 1.65                                       // අතේ සිට හබල අග දක්වා (m)

const ripples = []
const RIPN = 10
{
  const rg = new THREE.RingGeometry(0.12, 0.17, 28)
  rg.rotateX(-Math.PI / 2)
  for (let i = 0; i < RIPN; i++) {
    const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }))
    m.visible = false; m.renderOrder = 2; m.userData.t = 1
    scene.add(m); ripples.push(m)
  }
}
let ripNext = 0
function emitRipple(x, z) {
  const m = ripples[ripNext++ % RIPN]
  m.position.set(x, WATER_Y + 0.04, z)
  m.userData.t = 0; m.visible = true
}
const SPN = 30
const spPos = new Float32Array(SPN * 3).fill(-50), spVel = new Float32Array(SPN * 3), spLife = new Float32Array(SPN)
const spGeo = new THREE.BufferGeometry()
spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3))
const spPts = new THREE.Points(spGeo, new THREE.PointsMaterial({ map: glow, color: 0xcfeeff, size: 0.1, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }))
spPts.frustumCulled = false
scene.add(spPts)
let spNext = 0
function emitSplash(x, y, z, n = 10) {
  for (let i = 0; i < n; i++) {
    const k = spNext++ % SPN
    spPos[k * 3] = x; spPos[k * 3 + 1] = y; spPos[k * 3 + 2] = z
    spVel[k * 3] = rand(-0.7, 0.7); spVel[k * 3 + 1] = rand(1.3, 2.6); spVel[k * 3 + 2] = rand(-0.7, 0.7)
    spLife[k] = rand(0.4, 0.8)
  }
}
function updateWaterFx(dt) {
  for (const m of ripples) {
    if (!m.visible) continue
    m.userData.t += dt / 1.5
    const t = m.userData.t
    if (t >= 1) { m.visible = false; continue }
    m.scale.setScalar(1 + t * 8)
    m.material.opacity = (1 - t) * 0.6
  }
  for (let k = 0; k < SPN; k++) {
    if (spLife[k] <= 0) { spPos[k * 3 + 1] = -50; continue }
    spLife[k] -= dt
    spVel[k * 3 + 1] -= 9 * dt
    spPos[k * 3] += spVel[k * 3] * dt; spPos[k * 3 + 1] += spVel[k * 3 + 1] * dt; spPos[k * 3 + 2] += spVel[k * 3 + 2] * dt
  }
  spGeo.attributes.position.needsUpdate = true
}

const _H = new THREE.Vector3(), _dir = new THREE.Vector3(), _up = new THREE.Vector3(), _zx = new THREE.Vector3(), _xx = new THREE.Vector3(), _bm = new THREE.Matrix4()
let wasWet = false, ripT = 0
function updatePaddle(dt, riding, byaw, bwx, bwz, moving = true, dir = 1) {
  if (!girl) return
  if (!paddle) { paddle = makeProcPaddle(); scene.add(paddle) }
  if (!handR) {
    girl.traverse(o => { if (!handR && /RightHand$/i.test(o.name || '')) handR = o })
    if (!handR) return
  }
  paddle.visible = riding
  if (!riding) { wasWet = false; return }
  handR.updateWorldMatrix(true, false)
  handR.getWorldPosition(_H)
  const a = actions.Paddling
  const dur = a ? a.getClip().duration : 1
  const phi = a ? (((a.time % dur) + dur) % dur) / dur : (time * 0.5) % 1
  const lift = ss(0.6, 0.72, phi) * (1 - ss(0.93, 1.0, phi))                 // 0 = දියේ ඇදෙනවා, 1 = දියෙන් උඩට
  const sz = boatSeat.z + SEAT.z
  const beam = props.boat && props.boat.userData.size ? props.boat.userData.size.x * 0.5 + 0.22 : 0.9
  const zb = sz + (phi < 0.62 ? THREE.MathUtils.lerp(-0.5, 0.65, phi / 0.62) : THREE.MathUtils.lerp(0.65, -0.5, (phi - 0.62) / 0.38))
  const sy = Math.sin(byaw), cy = Math.cos(byaw)
  const Px = bwx + beam * cy + zb * sy, Pz = bwz - beam * sy + zb * cy     // බෝට්ටුවේ දකුණු පැත්තේ දිය මත ලක්ෂ්‍යය
  const tipY = THREE.MathUtils.lerp(WATER_Y - 0.3, WATER_Y + 0.45, lift)
  const dy = clamp((tipY - _H.y) / PADDLE_L, -0.98, 0.6)
  let hx = Px - _H.x, hz = Pz - _H.z, hl = Math.hypot(hx, hz)
  if (hl < 0.05) { hx = cy; hz = -sy; hl = 1 }
  const k = Math.sqrt(1 - dy * dy) / hl
  _dir.set(hx * k, dy, hz * k)
  _up.copy(_dir).negate()                                                    // හබලේ මුදුන (අතේ ඉඳන් උඩට)
  _zx.set(-sy, 0, -cy)                                                       // බෝට්ටුව ඉස්සරහට යන දිශාව (හබල පතුල එහාට)
  _zx.addScaledVector(_up, -_zx.dot(_up)).normalize()
  _xx.crossVectors(_up, _zx)
  _bm.makeBasis(_xx, _up, _zx)
  paddle.quaternion.setFromRotationMatrix(_bm)
  paddle.position.copy(_H)
  const tx = _H.x + _dir.x * PADDLE_L, ty = _H.y + _dir.y * PADDLE_L, tz = _H.z + _dir.z * PADDLE_L
  const wet = ty < WATER_Y - 0.02
  if (wet && !wasWet) { emitSplash(tx, WATER_Y, tz, 12); emitRipple(tx, tz); ripT = 0.2 }
  if (wet) { ripT -= dt; if (ripT <= 0) { emitRipple(tx, tz); ripT = 0.22 } }
  wasWet = wet
}

/* =====================================================================
   INPUT
   ===================================================================== */

/* =====================================================================
   STORY: පියවර (chapters) + subtitles + ගැහැණු හඬ + auto-play + hotspot card (sathishlella.online වගේ)
   CHAPTERS: s = scroll අගය (ඇය ඒ තැනට ආවම පටන් ගන්නවා), sec = කොටස, text = කියවන වාක්‍ය,
             card = hotspot එකේ card එක (title / sub / bullets / link). ඔයාගේ සැබෑ විස්තර වලින් වෙනස් කරගන්න.
   ===================================================================== */
const SECTIONS = ['Arrival', 'Summary', 'Projects', 'Journey', 'Thanks']
const SECTION_INFO = [
  { title: 'Ruwanthika', sub: 'IT student. Walk with me through the forest.' },
  { title: 'Who I am', sub: 'IT student building skills in data mining, machine learning and AI.' },
  { title: 'What I have built', sub: 'Agents, microservices, deep learning and MLOps.' },
  { title: 'How I work', sub: 'Teamwork, learning and growing together.' },
  { title: 'Thank you', sub: "Let's build something together." }
]
const thS = f => TH.s0 + f * (TH.s1 - TH.s0)            // ගස් ගෙදර detour එකේ කොටසක s අගය (f = 0..1)
const THP = TW.a + TW.up                                    // ගෙයි බිම නතර වෙන කොටස පටන් ගන්නා තැන
const CHAPTERS = [
  { s: 0, sec: 0, pill: 'Welcome', noCard: true,
    text: "Hi, I'm Ruwanthika. Come walk with me for a few minutes, and I'll show you what I build and what I've learned along the way." },
  { s: 4.5, sec: 1, pill: 'About me', side: 1,
    card: { title: 'About me', sub: 'BSc (Hons) Information Technology | Horizon Campus, Sri Lanka',
      bullets: ['Third year student, Intake 12/13', 'Based in Sri Lanka', 'Works in a five member project team'], link: '#' },
    text: "I'm a third year B S c Information Technology student at Horizon Campus in Sri Lanka." },
  { s: 8.2, sec: 1, pill: 'My focus', side: -1,
    card: { title: 'What I focus on', sub: 'Data mining | Machine learning | AI',
      bullets: ['Data mining and machine learning', 'Intelligent systems and MLOps', 'Agentic AI with retrieval'], link: '#' },
    text: "My focus is data mining and machine learning, and now I'm learning to build intelligent agents. Let me show you, up in the tree house." },
  { s: thS(THP + 0.05), sec: 2, pill: 'Ella', th: true,
    card: { title: 'Ella trip assistant', sub: 'Agentic AI | Tourism',
      bullets: ['Trip planning assistant', 'Retrieval augmented generation (RAG)', 'Streamlit interface'], link: '#' },
    text: "Up here lives Ella, my trip planning assistant. It answers with retrieval augmented generation, so every suggestion is grounded in real travel information." },
  { s: thS(THP + 0.17), sec: 2, pill: 'Ella agents', th: true,
    card: { title: 'Ella: multi-agent design', sub: 'Agents that cooperate',
      bullets: ['Several agents share the work', 'Planning, searching and answering', 'Simple Streamlit front end'], link: '#' },
    text: "Behind Ella is a team of cooperating agents. One plans the trip, one searches, and one writes the answer." },
  { s: 32.6, sec: 2, pill: 'The bridge', side: 1,
    card: { title: 'Connecting the pieces', sub: 'Front end | Services | Data',
      bullets: ['Interfaces that talk to services', 'Services that talk to data', 'Everything tested end to end'], link: '#' },
    text: "Like this bridge, good software connects the pieces: the interface, the services and the data." },
  { s: 36, sec: 2, pill: 'BookNest', side: -1,
    card: { title: 'BookNest', sub: 'Spring Boot microservices',
      bullets: ['A full system built and tested', 'Independent services working together', 'Prepared for a live viva demo'], link: '#' },
    text: "Crossing the bridge, this is BookNest. A set of Spring Boot microservices that I built and tested." },
  { s: 47, sec: 2, pill: 'Microservices', side: 1,
    card: { title: 'Why microservices', sub: 'BookNest design',
      bullets: ['Each service does one job', 'Services talk through clean APIs', 'Easy to test one piece at a time'], link: '#' },
    text: "Each service in BookNest does one job and talks to the others through clean interfaces, so I can test every piece on its own, and show it live." },
  { s: 59, sec: 2, pill: 'DermaMatch AI', side: -1,
    card: { title: 'DermaMatch AI', sub: 'Multimodal deep learning',
      bullets: ['Skin analysis from images', 'Skincare and makeup recommendations', 'Mini project'], link: '#' },
    text: "Further along is DermaMatch A I. It looks at a photo of the skin and recommends skincare and makeup." },
  { s: 71, sec: 2, pill: 'Multimodal', side: 1,
    card: { title: 'Multimodal learning', sub: 'DermaMatch AI',
      bullets: ['Combines images with other inputs', 'Deep learning models', 'Personal recommendations'], link: '#' },
    text: "DermaMatch uses multimodal deep learning, which means it learns from more than one kind of input at the same time." },
  { s: 83, sec: 2, pill: 'Docker fullstack', side: -1,
    card: { title: 'Fullstack in Docker', sub: 'Multi-container deployment',
      bullets: ['Spring Boot and Node.js services', 'MongoDB database', 'Everything runs with Docker Compose'], link: '#' },
    text: "Here is a full stack app with Spring Boot, Node and MongoDB, all running together in Docker containers." },
  { s: 95, sec: 2, pill: 'Compose', side: 1,
    card: { title: 'One command to run it', sub: 'Docker Compose',
      bullets: ['Every service in its own container', 'Same setup on any machine', 'Database included'], link: '#' },
    text: "With Docker Compose, one command starts every service, so the whole system runs the same way on any machine." },
  { s: 109, sec: 3, pill: 'The pier', noCard: true,
    text: "Now let's leave the road. Hop in the boat, and we'll drift down the river." },
  { s: 130, sec: 2, pill: 'Freshness MLOps', side: 1,
    card: { title: 'Fruit freshness MLOps', sub: 'IT41043 Intelligent Systems',
      bullets: ['Mango, banana and papaya', 'Multimodal pipeline', 'Freshness and shelf-life prediction'], link: '#' },
    text: "Drifting down the river, an M L Ops pipeline that predicts the freshness and shelf life of mangoes, bananas and papayas." },
  { s: 152, sec: 2, pill: 'The pipeline', side: -1,
    card: { title: 'From data to prediction', sub: 'MLOps pipeline',
      bullets: ['Prepare and track the data', 'Train and compare models', 'Serve freshness predictions'], link: '#' },
    text: "The pipeline prepares the data, trains and compares models, and then serves freshness predictions." },
  { s: 172, sec: 3, pill: 'Teamwork', side: 1,
    card: { title: 'Teamwork', sub: 'IT41033 Data Mining and Machine Learning',
      bullets: ['Five member group project', 'Guided by Mr. Ravidu Sankha', 'Learning by building together'], link: '#' },
    text: "Along the stream I learned that the best work grows in a team. I work with a group of five on my data mining module." },
  { s: 192, sec: 3, pill: 'Learning', side: -1,
    card: { title: 'Always learning', sub: 'Build, test, improve',
      bullets: ['Learn by building real projects', 'Test early and often', 'Ask for feedback and improve'], link: '#' },
    text: "I learn best by building real projects, testing early, and asking for feedback." },
  { s: LAND_S + 2, sec: 3, pill: 'Landing', side: 1,
    card: { title: 'Almost there', sub: 'What comes next',
      bullets: ['More agents and deeper models', 'Production ready MLOps', 'Open to learning with others'], link: '#' },
    text: "We have almost arrived. Next I want to build more agents, deeper models, and production ready pipelines." },
  { s: LAND_S + 8, sec: 3, pill: 'Toolbox', side: -1,
    card: { title: 'My toolbox', sub: 'From these projects',
      bullets: ['Python, Streamlit, RAG', 'Spring Boot and Node.js', 'Docker, MongoDB, MLOps'], link: '#' },
    text: "These are the tools I reach for: Python and Streamlit, Spring Boot and Node, Docker and MongoDB." },
  { s: MAX_PROGRESS - 0.6, sec: 4, pill: 'Thank you', noCard: true,
    text: "Thank you for walking with me. Every project here is still growing, and so am I. Let's build something together." }
]

/* chapter එකේ lantern එක + card එක පෙනෙන තැන (ඇය යන පාර අයිනේ) */
function lampSpot(c) {
  const z = -c.s - 3.2
  if (Math.abs(z + 35) < 6) return null                                    // පාලම
  if (c.s > 104 && c.s < 117) return null                                  // තොටුපළ
  if (c.s >= LAND_S - 1) return null                                       // ගොඩබෑම
  const side = c.side || 1
  const rm = riverMask(z)
  const x = pathX(z) + side * (rm > 0.3 ? riverHW(z) * 1.15 + 0.3 : PATH_HW + 0.5)
  const y = groundH(x, z)
  if (y < -0.2) return null
  return { x, y, z }
}

const $ = id => document.getElementById(id)
const el = {
  loader: $('loader'), loadbar: $('loadbar'), intro: $('intro'), enterSound: $('enterSound'), enterQuiet: $('enterQuiet'),
  heading: $('heading'), hKick: $('hKick'), hTitle: $('hTitle'), hSub: $('hSub'), cap: $('caption'), capText: $('capText'),
  card: $('card'), cKick: $('cKick'), cTitle: $('cTitle'), cSub: $('cSub'), cList: $('cList'), cLink: $('cLink'), pill: $('pill'), pillTxt: $('pillTxt'),
  count: $('count'), prev: $('prev'), next: $('next'), play: $('btnPlay'), restart: $('btnRestart'), voice: $('btnVoice'), side: $('sidenav'), end: $('endcard')
}
const ICON = {
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9zM16 8a5 5 0 0 1 0 8l-1-1.4a3.2 3.2 0 0 0 0-5.2zM18.5 5.5a8.5 8.5 0 0 1 0 13l-1-1.4a6.8 6.8 0 0 0 0-10.2z"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9zM15 9.4 16.4 8l2.1 2.1L20.6 8 22 9.4 19.9 11.5 22 13.6 20.6 15l-2.1-2.1L16.4 15 15 13.6l2.1-2.1z"/></svg>'
}
if (el.restart) el.restart.innerHTML = ICON.restart
if (el.loader) loadingEl.style.display = 'none'                    // පරණ loading පෙළ වෙනුවට HTML loader එක
window.setLoad = n => { if (el.loadbar) el.loadbar.style.width = Math.min(92, 6 + n * 8) + '%' }
SECTIONS.forEach(n => {
  if (!el.side) return
  const li = document.createElement('li')
  li.innerHTML = `<span>${n}</span><i></i>`
  el.side.appendChild(li)
})

/* ---- ගැහැණු හඬ (browser speechSynthesis) ---- */
const synth = ('speechSynthesis' in window) ? window.speechSynthesis : null
let voiceOn = false, voiceReady = false, femaleVoice = null
function pickVoice() {
  if (!synth) return
  const vs = synth.getVoices().filter(v => /^en/i.test(v.lang))
  femaleVoice = vs.find(v => /aria|jenny|libby|sonia|zira|samantha|google uk english female|google us english|female|hazel|susan|karen|moira|tessa|victoria|serena/i.test(v.name)) || vs[0] || null
}
if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice }
function updateVoiceBtn() { if (el.voice) el.voice.innerHTML = voiceOn ? ICON.sound : ICON.mute }
updateVoiceBtn()

/* ---- කතාව කියවීම + subtitle (වාක්‍යෙන් වාක්‍යය) ---- */
let started = !el.intro                       // intro button එක ඔබනකම් පටන් ගන්නේ නැහැ
let narrating = false, narrToken = 0, curStep = -1, curSec = -1, stepTimer = 0
let autoplay = false, autoPos = 0, goalIdx = 0, arrivedWait = 0
const sentencesOf = t => (t.match(/[^.!?]+[.!?]*/g) || [t]).map(s => s.trim()).filter(Boolean)
function showCaption(t) {
  if (!el.capText) return
  el.capText.textContent = t
  el.cap.classList.add('on')
}
function startNarration(i) {
  const tok = ++narrToken
  if (synth) synth.cancel()
  const sents = sentencesOf(CHAPTERS[i].text)
  narrating = true
  const safety = sents.join(' ').length * 80 + 5000                // හඬ අසාර්ථක වුනොත් auto-play හිර වෙන්න දෙන්නේ නැහැ
  setTimeout(() => { if (tok === narrToken) narrating = false }, safety)
  if (voiceOn && voiceReady && synth) {
    setTimeout(() => {
      if (tok !== narrToken) return
      sents.forEach((sent, k) => {
        const u = new SpeechSynthesisUtterance(sent)
        if (femaleVoice) u.voice = femaleVoice
        u.lang = (femaleVoice && femaleVoice.lang) || 'en-US'
        u.pitch = 1.08; u.rate = 0.95; u.volume = 1
        u.onstart = () => { if (tok === narrToken) showCaption(sent) }
        if (k === sents.length - 1) u.onend = u.onerror = () => { if (tok === narrToken) narrating = false }
        synth.speak(u)
      })
    }, 80)
    showCaption(sents[0])
  } else {
    let k = 0
    const tick = () => {
      if (tok !== narrToken) return
      if (k >= sents.length) { narrating = false; return }
      showCaption(sents[k])
      const d = 1000 + sents[k].length * 55
      k++
      setTimeout(tick, d)
    }
    tick()
  }
}

/* ---- hotspot (දිලිසෙන ගෝලය + නම + card) ---- */
const anchor = new THREE.Vector3()
const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1, 0.78, 0.3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }))
orb.visible = false
scene.add(orb)
let cardOn = false, orbOpacity = 0
const ovV = new THREE.Vector3()
function anchorFor(c) {
  if (c.th && thWay) { anchor.copy(thWay.deck); anchor.y += 2.3; return }
  const sp = lampSpot(c)
  if (sp) { anchor.set(sp.x, sp.y + 2.7, sp.z); return }
  const z = -c.s - 5
  const x = pathX(z) + (c.side || 1) * (3.4 + riverMask(z) * (riverHW(z) + 0.5))
  anchor.set(x, Math.max(groundH(x, z), WATER_Y) + 2.4, z)
}
function hideCard() {
  cardOn = false
  el.card?.classList.remove('on'); el.pill?.classList.remove('on')
}
function showCard(i) {
  const c = CHAPTERS[i]
  if (c.noCard || !c.card || !el.card) { hideCard(); return }
  el.cKick.textContent = `0${c.sec} / ${SECTIONS[c.sec].toUpperCase()}`
  el.cTitle.textContent = c.card.title
  el.cSub.textContent = c.card.sub
  el.cList.innerHTML = c.card.bullets.map(b => `<li>${b}</li>`).join('')
  el.cLink.href = c.card.link || '#'
  el.pillTxt.textContent = c.pill
  anchorFor(c)
  cardOn = true
  el.card.classList.add('on'); el.pill.classList.add('on')
}
function updateOverlay(dt) {
  orbOpacity += ((cardOn ? 0.95 : 0) - orbOpacity) * Math.min(1, dt * 4)
  orb.material.opacity = orbOpacity
  orb.visible = orbOpacity > 0.02
  orb.position.copy(anchor); orb.position.y += Math.sin(time * 1.6) * 0.08
  orb.scale.setScalar(0.85 + Math.sin(time * 2.2) * 0.1)
  if (!el.pill || !el.card) return
  ovV.copy(anchor).project(camera)
  const vis = cardOn && ovV.z < 1 && Math.abs(ovV.x) < 1.15 && Math.abs(ovV.y) < 1.15
  const x = (ovV.x * 0.5 + 0.5) * innerWidth, y = (-ovV.y * 0.5 + 0.5) * innerHeight
  el.pill.style.visibility = vis ? 'visible' : 'hidden'
  el.card.style.visibility = vis ? 'visible' : 'hidden'
  el.pill.style.transform = `translate(${x + 16}px, ${y - 18}px)`
  const cw = el.card.offsetWidth || 340, ch = el.card.offsetHeight || 220
  if (innerWidth < 760) {                                    // ෆෝන්: card එක උඩින් මැදට (පෙළ / ඇය වහන්නේ නැතිව)
    el.card.style.transform = `translate(${Math.max(8, (innerWidth - cw) / 2)}px, ${innerHeight < 640 ? 64 : 76}px)`
    el.pill.style.visibility = 'hidden'
    return
  }
  const cx = clamp(x + 34, 16, innerWidth - cw - 70), cy = clamp(y + 34, 90, innerHeight - ch - 120)
  el.card.style.transform = `translate(${cx}px, ${cy}px)`
}

/* ---- පියවර මාරු වීම ---- */
function setHeading(secI) {
  if (secI === curSec) return
  curSec = secI
  el.heading?.classList.remove('on')
  setTimeout(() => {
    if (curSec !== secI || !el.heading) return
    el.hKick.textContent = secI === 0 ? 'WELCOME' : `0${secI} / ${SECTIONS[secI].toUpperCase()}`
    el.hTitle.textContent = SECTION_INFO[secI].title
    el.hSub.textContent = SECTION_INFO[secI].sub
    el.heading.classList.add('on')
  }, 420)
  el.side?.querySelectorAll('li').forEach((li, i) => li.classList.toggle('on', i === secI))
}
function setStep(i) {
  if (!started || i === curStep) return
  curStep = i
  setHeading(CHAPTERS[i].sec)
  if (el.count) el.count.textContent = `${i + 1} / ${CHAPTERS.length}`
  hideCard()
  narrToken++
  if (synth) synth.cancel()
  narrating = true                                         // පටන් ගන්න ඉන්න අතරතුර auto-play ඉස්සරහට යන්නේ නැහැ
  clearTimeout(stepTimer)
  stepTimer = setTimeout(() => { if (i !== curStep) return; startNarration(i); showCard(i) }, 550)
}
function updateStory(s) {
  let idx = 0
  for (let i = 0; i < CHAPTERS.length; i++) if (s >= CHAPTERS[i].s - 0.001) idx = i
  setStep(idx)
  el.end?.classList.toggle('show', s > MAX_PROGRESS - 3)
}

/* ---- auto-play / buttons ---- */
function setAutoplay(v) {
  autoplay = v
  if (v) { pending = 0; glide = null; goalIdx = Math.max(0, curStep); arrivedWait = 0 }
  if (el.play) el.play.innerHTML = v ? ICON.pause : ICON.play
}
if (el.play) el.play.innerHTML = ICON.play
function jump(i) { setAutoplay(false); pending = 0; glide = CHAPTERS[i].s }
function toggleVoice() {
  if (!synth) return
  voiceReady = true
  voiceOn = !voiceOn
  updateVoiceBtn()
  if (!voiceOn) synth.cancel()
  if (started && curStep >= 0) startNarration(curStep)
}
function enter(withSound) {
  voiceReady = true
  voiceOn = withSound && !!synth
  updateVoiceBtn()
  el.intro?.classList.add('hide')
  started = true
  setAutoplay(true)
}
el.enterSound?.addEventListener('click', () => enter(true))
el.enterQuiet?.addEventListener('click', () => enter(false))
el.play?.addEventListener('click', () => setAutoplay(!autoplay))
el.restart?.addEventListener('click', () => {
  if (synth) synth.cancel()
  narrToken++
  window.forestGoTo(0)
  curStep = -1; curSec = -1
  setAutoplay(true)
})
el.voice?.addEventListener('click', toggleVoice)
el.prev?.addEventListener('click', () => jump(Math.max(0, curStep - 1)))
el.next?.addEventListener('click', () => jump(Math.min(CHAPTERS.length - 1, curStep + 1)))
window.forestReady = () => {
  window.setLoad && window.setLoad(12)
  el.loader?.classList.add('hide')
  el.intro?.classList.remove('hide')
}
document.title = 'Ruwanthika · A walk through the forest'

let target = 0, progress = 0, pending = 0, lastInput = -9, glide = null, vel = 0
const hint = document.createElement('div')
hint.textContent = matchMedia('(pointer: coarse)').matches ? 'SWIPE UP TO WALK' : 'SCROLL SLOWLY TO WALK'
Object.assign(hint.style, {
  position: 'fixed', left: '32px', top: '84px', color: '#d9c9a3',
  font: '12px/1.4 system-ui, sans-serif', letterSpacing: '0.2em',
  transition: 'opacity .8s', pointerEvents: 'none'
})
document.body.appendChild(hint)

function move(delta) {
  if (autoplay) setAutoplay(false)                        // scroll කළොත් auto-play නතර වෙනවා (ඔයා තෝරනවා)
  glide = null
  pending = clamp(pending + delta, -4, 4)
  lastInput = time
  hint.style.opacity = 0
}
addEventListener('wheel', e => move(e.deltaY * 0.02), { passive: true })
addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === ' ') move(4)
  if (e.key === 'ArrowUp') move(-4)
})
let touchY = 0
addEventListener('touchstart', e => { touchY = e.touches[0].clientY })
addEventListener('touchmove', e => {
  const y = e.touches[0].clientY
  move((touchY - y) * 0.06)
  touchY = y
})
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  applySize()
})
window.forestGoTo = s => { target = progress = clamp(s, 0, MAX_PROGRESS); pending = 0; glide = null }

/* =====================================================================
   LOOP
   ===================================================================== */
const clock = new THREE.Clock()
let time = 0, idleTime = 0
const camLook = new THREE.Vector3(0, 1.5, 0)
const charPos = new THREE.Vector3()
const tmpV = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const tmpDir = new THREE.Vector3()
const tmpSide = new THREE.Vector3()
const camBase = new THREE.Vector3()
const frontPos = new THREE.Vector3(), thCam = new THREE.Vector3()
let frontW = 0
let frameN = 0, perfAcc = 0, perfN = 0

function updateShooters(dt) {
  for (const m of shooters) {
    const u = m.userData
    if (!m.visible) {
      u.next -= dt
      if (u.next > 0) continue
      camera.getWorldDirection(tmpDir)
      tmpDir.y = 0
      tmpDir.normalize()
      tmpSide.set(-tmpDir.z, 0, tmpDir.x)
      m.position.copy(camera.position)
        .addScaledVector(tmpDir, rand(90, 140))
        .addScaledVector(tmpSide, rand(-60, 60))
      m.position.y += rand(45, 85)
      const dirSign = Math.random() < 0.5 ? -1 : 1
      u.v.copy(tmpSide).multiplyScalar(dirSign * rand(40, 70))
      u.v.y = -rand(8, 16)
      m.lookAt(camera.position)
      camera.updateMatrixWorld(true)
      const vc = u.v.clone().transformDirection(camera.matrixWorldInverse)
      m.rotateZ(Math.atan2(vc.y, vc.x))
      u.t = 0
      u.dur = rand(0.9, 1.4)
      m.visible = true
    } else {
      u.t += dt
      m.position.addScaledVector(u.v, dt)
      const k = u.t / u.dur
      m.material.opacity = Math.sin(Math.min(k, 1) * Math.PI) * 0.9
      if (k >= 1) { m.visible = false; u.next = rand(5, 12) }
    }
  }
}

function animate() {
  requestAnimationFrame(animate)
  const rawDt = clock.getDelta()
  const dt = Math.min(rawDt, 0.05)
  time += dt
  /* FPS අඩු නම් (මුල් තත්පර 10 ට පස්සේ) resolution එක පියවරෙන් පියවර අඩු කරනවා */
  if (ADAPT && time > 10) {
    perfAcc += Math.min(rawDt, 0.2); perfN++
    if (perfN >= 90) {
      const avg = perfAcc / perfN
      if (avg > 0.045 && RES > 0.5) {
        RES = Math.max(0.5, +(RES - 0.1).toFixed(2))
        applySize()
        console.log('⚙ resolution scale ->', RES, '| avg frame ms', Math.round(avg * 1000))
      }
      perfAcc = 0; perfN = 0
    }
  }
  /* camera එකෙන් ඈත chunk හංගනවා */
  if ((frameN++ & 7) === 0) {
    for (const im of chunkList) {
      const bs = im.boundingSphere
      if (!bs) continue
      const d = Math.hypot(bs.center.x - camera.position.x, bs.center.y - camera.position.y, bs.center.z - camera.position.z) - bs.radius
      im.visible = d < CULL
    }
  }
  wind.uTime.value = time
  mixer?.update(dt)

  /* ---- චලනය: scroll නතර වුණ ගමන් ඇය එතැනම නවතිනවා (ලිස්සීමක් නැහැ). පිටිපස්සට scroll කළොත් ඇයත් පිටිපස්සට (action reverse) ---- */
  const AUTO_V = 9.5, SCROLL_V = 10
  let dsp = 0
  if (autoplay && started) {
    const g = CHAPTERS[goalIdx].s
    const d = g - progress
    const stp = clamp(Math.abs(d) * 2.4, 1.2, AUTO_V) * dt
    dsp = Math.abs(d) <= stp ? d : Math.sign(d) * stp
    if (Math.abs(g - progress) < 0.05 && curStep === goalIdx && !narrating) {
      arrivedWait += dt
      if (arrivedWait > 2.0) {
        arrivedWait = 0
        if (goalIdx < CHAPTERS.length - 1) goalIdx++
        else setAutoplay(false)
      }
    } else arrivedWait = 0
  } else if (glide !== null) {
    const d = glide - progress
    const stp = clamp(Math.abs(d) * 3, 2, 22) * dt
    dsp = Math.abs(d) <= stp ? d : Math.sign(d) * stp
    if (Math.abs(glide - progress) < 0.05) glide = null
  } else {
    if (time - lastInput > 0.14) pending = 0                       // input නැත්නම් ඉතිරි ගමන ඉවත් කරනවා => ක්ෂණිකව නවතිනවා
    const stp = clamp(pending, -SCROLL_V * dt, SCROLL_V * dt)
    pending -= stp
    dsp = stp
  }
  const sNow = progress
  if (sNow > TH.s0 && sNow < TH.s1 && thWay && TH.climb) dsp *= thK         // ඉණිමං ප්‍රදේශයේ හෙමින්
  progress = clamp(progress + dsp, 0, MAX_PROGRESS)
  target = progress
  vel = dt > 0 ? (progress - sNow) / dt : 0
  const moving = Math.abs(vel) > 0.12
  const back = vel < -0.12
  const s = progress
  const z = -s
  const D = dirAt(s)
  const riding = s >= BOARD_S && s < LAND_S
  idleTime = moving ? 0 : idleTime + dt
  updateStory(s)

  const bs = clamp(s, BOARD_S, LAND_S)
  const bz = -bs
  const bx = pathX(bz)
  const bd = dirAt(bs)
  const leave = ss(LAND_S + 4, LAND_S + 12, s)
  const bwx = THREE.MathUtils.lerp(bx, MOOR.x, leave)
  const bwz = THREE.MathUtils.lerp(bz, MOOR.z, leave)
  const byaw = lerpAngle(Math.atan2(-bd.x, -bd.z), MOOR.yaw, leave)
  const boatY = Math.max(WATER_Y - 0.12, groundH(bwx, bwz) + 0.05) + BOAT_LIFT + Math.sin(time * 1.4) * 0.03
  if (boat) {
    boat.position.set(bwx, boatY, bwz)
    boat.rotation.y = byaw
    boat.rotation.z = Math.sin(time * 1.1) * 0.02
  }

  let targetY = 0
  if (riding) targetY = boatY + boatSeat.y + SEAT.y
  else if (s >= LAND_S) targetY = PLAT_TOP
  else if (s >= 45.5 + S1 && s < BOARD_S) targetY = PIER_Y
  else if (Math.abs(z + 35) < 3.5) { const tt = (z + 35) / 3.5; targetY = BRIDGE_DECK_Y + bridgeRise * (1 - tt * tt) }

  if (riding) {
    const sz = boatSeat.z + SEAT.z
    charPos.x = bwx + sz * Math.sin(byaw)
    charPos.z = bwz + sz * Math.cos(byaw)
  } else {
    charPos.x = pathX(z)
    charPos.z = z
  }
  /* ගස් ගෙදර: ඉණිමං පියගැටවලින් නැගලා ගෙයි බිමේ නතර වෙලා (Talking) කතා කරලා, ආපසු බහිනවා */
  let detourPause = false, detourHeading = 0, detourStairs = false
  const detourOn = !!(TH.climb && thWay && !riding && s > TH.s0 && s < TH.s1)
  const uDet = clamp((s - TH.s0) / (TH.s1 - TH.s0), 0, 1)
  if (detourOn) {
    const r = thDetour(uDet)
    charPos.x = r.x; charPos.z = r.z; charPos.y = r.y + 0.03
    detourPause = r.pause; detourHeading = r.heading; detourStairs = r.stairs
  } else charPos.y += (targetY - charPos.y) * Math.min(1, dt * 8)

  /* ---- camera shots: ඇවිදිද්දී පිටිපස්සෙන්, නතර වුණාම ඉස්සරහින් (මුහුණ පැහැදිලිව) ---- */
  const camSide = tmpSide.set(-D.z, 0, D.x)                  // ඇයගේ දකුණු පැත්ත
  const tEnd = ss(LAND_S + 6, MAX_PROGRESS - 1, s)
  const frontT = (idleTime > 0.3 || s < 1) ? 1 : 0
  frontW += (frontT - frontW) * (1 - Math.exp(-dt * (frontT ? 2.4 : 7)))
  const fd = riding ? 4.4 : 4.3, fr = riding ? 2.8 : 1.4, fh = riding ? 1.9 : 1.75
  frontPos.copy(charPos).addScaledVector(D, fd).addScaledVector(camSide, fr)
  frontPos.y = charPos.y + fh
  const wDet = (TH.climb && thWay && thWay.camDir) ? ss(0.08, 0.2, uDet) * (1 - ss(0.82, 0.94, uDet)) : 0
  const thDist = detourPause ? thWay?.camDist : Math.min(thWay?.camDist ?? 5, 4.6)
  if (wDet > 0.001) {
    thCam.copy(charPos).addScaledVector(thWay.camDir, thDist || 4.5)
    thCam.y = charPos.y + (detourPause ? 1.5 : 1.9)
  }

  if (girl) {
    girl.position.copy(charPos)
    const faceFwd = Math.atan2(D.x, D.z)
    const shot = wDet > 0.5 ? thCam : frontPos
    const faceShot = Math.atan2(shot.x - charPos.x, shot.z - charPos.z)
    const faceBehind = Math.atan2(-D.x, -D.z)
    let want
    if (riding) want = faceFwd
    else if (detourOn) want = detourPause ? faceShot : (moving ? detourHeading : faceShot)
    else if (moving) want = faceFwd                                         // පිටිපස්සට යද්දීත් ඉස්සරහම බලාගෙන (action reverse වෙනවා)
    else want = lerpAngle(faceShot, faceBehind, tEnd)
    girl.rotation.y = lerpAngle(girl.rotation.y, want, 1 - Math.exp(-dt * 7))

    const dir = back ? -1 : 1
    const atEnd = s >= MAX_PROGRESS - 3
    if (riding) play('Paddling', moving ? dir : 0)
    else if (detourOn && detourPause) play(actions.Talking ? 'Talking' : 'Waving', 1)                         // ගස් ගෙදර උඩ: කතා කරනවා
    else if (detourOn && detourStairs && !back && actions.Stairs && moving) play('Stairs', 1.15)
    else if (detourOn && detourStairs && back && actions.Stairs && moving) play('Stairs', -1.15)             // පසුපසට: ඉණිමං action reverse
    else if (moving) play('Walking', dir * 1.3)
    else if (s < 3 || atEnd) play('Waving', 1)
    else play(actions.Talking ? 'Talking' : (actions.Idle ? 'Idle' : 'Waving'), 1)                           // නතර වුණාම කතා කරනවා

    updatePaddle(dt, riding, byaw, bwx, bwz, moving, dir)
  }

  /* camera */
  const camDist = THREE.MathUtils.lerp(CAM_DIST * (riding ? 0.95 : 1), END_CAM.dist, tEnd)
  const camH = THREE.MathUtils.lerp(CAM_HEIGHT + (riding ? 0.35 : 0), END_CAM.h, tEnd)
  const fw = frontW * (1 - tEnd)
  camBase.copy(charPos).addScaledVector(D, -camDist).addScaledVector(camSide, 0.55 * (1 - tEnd))
  camBase.y = charPos.y + camH
  tmpV.lerpVectors(camBase, frontPos, fw)
  if (wDet > 0.001) tmpV.lerp(thCam, wDet * (detourPause ? 1 : 0.8))
  camera.position.lerp(tmpV, 1 - Math.exp(-dt * 4.5))
  const lookWalk = tmpB.copy(charPos).addScaledVector(D, THREE.MathUtils.lerp(2.2, 0.4, tEnd))
  lookWalk.y = charPos.y + THREE.MathUtils.lerp(0.95, END_CAM.look, tEnd)
  const lookFront = tmpDir.copy(charPos); lookFront.y = charPos.y + 1.0
  tmpV.lerpVectors(lookWalk, lookFront, fw)
  if (wDet > 0.001) { tmpDir.copy(charPos); tmpDir.y = charPos.y + 1.25; tmpV.lerp(tmpDir, wDet) }
  camLook.lerp(tmpV, 1 - Math.exp(-dt * 6))
  camera.lookAt(camLook)

  /* ආලෝකය: key light එක camera පැත්තෙන් (ඇයගේ මුහුණට), rim එක පිටිපස්සෙන් */
  tmpDir.set(camera.position.x - charPos.x, 0, camera.position.z - charPos.z)
  if (tmpDir.lengthSq() < 1e-4) tmpDir.copy(D).negate()
  tmpDir.normalize()
  tmpSide.set(-tmpDir.z, 0, tmpDir.x)
  pool.position.copy(charPos).addScaledVector(tmpDir, 2.5).addScaledVector(tmpSide, 1.3)
  pool.position.y = charPos.y + 4.8
  pool.target.position.set(charPos.x, charPos.y + 1.0, charPos.z)
  rim.position.copy(charPos).addScaledVector(tmpDir, -4).addScaledVector(tmpSide, -2)
  rim.position.y = charPos.y + 5
  rim.target.position.set(charPos.x, charPos.y + 1.0, charPos.z)
  fill.position.copy(charPos).addScaledVector(tmpDir, 1.5).addScaledVector(tmpSide, 0.6)
  fill.position.y = charPos.y + 1.7
  glowDisc.visible = !riding
  glowDisc.position.set(charPos.x, charPos.y + 0.05, charPos.z)
  if (lanterns.length) {
    const sorted = lanterns.slice().sort((a, b) => a.distanceToSquared(charPos) - b.distanceToSquared(charPos))
    lampLights.forEach((l, i) => { if (sorted[i]) l.position.copy(sorted[i]) })
  }
  for (const g of lampGroups) g.visible = g.userData.keep ? g.position.distanceToSquared(charPos) < 70 * 70 : g.position.distanceToSquared(charPos) < LAMP_CULL * LAMP_CULL
  if (thLight && thWay && thWay.camDir) {                    // ගස් ගෙදරේ (ගෙයි බිම උඩ) උණුසුම් ආලෝකය
    const dd = Math.hypot(charPos.x - thWay.deck.x, charPos.z - thWay.deck.z)
    thLight.position.set(thWay.deck.x - thWay.camDir.x * 0.8, thWay.deck.y + 2.3, thWay.deck.z - thWay.camDir.z * 0.8)
    thLight.intensity = 6 * (1 - ss(10, 24, dd))
    thLight2.position.set(thCenter.x, thCenter.y + 1.4, thCenter.z)
    thLight2.intensity = 5 * (1 - ss(10, 24, dd))
  }

  const p = ffGeo.attributes.position
  for (let i = 0; i < FF; i++) p.setY(i, ffBase[i] + Math.sin(time * 0.8 + i) * 0.35)
  p.needsUpdate = true

  for (const b of butterflies) {
    const u = b.userData
    if (u.zone) {                                              // තමන්ගේ කොටසේ විතරක් පෙනේ (දෙපැත්තෙන් සුමටව මැකේ)
      const f = ss(u.zone[0] - 4, u.zone[0], s) * (1 - ss(u.zone[1], u.zone[1] + 4, s))
      b.visible = f > 0.02
      if (!b.visible) continue
      b.scale.setScalar(f)
    }
    const t = time * u.sp + u.ph
    const zc = -(s + u.ahead)
    const D2 = dirAt(-zc)
    const cx = pathX(zc) + u.side
    const tx = cx + (-D2.z) * Math.sin(t) * u.rx + D2.x * Math.cos(t * 0.8) * u.rz
    const tz = zc + D2.x * Math.sin(t) * u.rx + D2.z * Math.cos(t * 0.8) * u.rz
    const ty = Math.max(WATER_Y + 0.4, groundH(cx, zc)) + u.cy + Math.sin(t * 1.7) * 0.4
    tmpB.set(tx, ty, tz)
    const vx = tmpB.x - b.position.x, vz = tmpB.z - b.position.z
    b.position.lerp(tmpB, 1 - Math.exp(-dt * 3))
    if (vx * vx + vz * vz > 1e-4) b.rotation.y = lerpAngle(b.rotation.y, Math.atan2(vx, vz), 1 - Math.exp(-dt * 6))
    if (u.r) {
      const a = Math.sin(time * 18 + u.ph * 3) * 0.9
      u.r.rotation.z = a
      u.l.rotation.z = -a
    }
    u.mixer?.update(dt)
    if (u.flap) u.flap.scale.x = 0.45 + 0.55 * Math.abs(Math.sin(time * 13 + u.ph * 3))
  }

  waterMat.uniforms.uTime.value = time
  fallTex.offset.y += dt * 0.9
  cascades.forEach((t, i) => { t.offset.y += dt * (0.8 + i * 0.1) })
  for (let i = 0; i < FOAM; i++) {
    let fz = foamPos[i * 3 + 2] + dt * (0.5 + foamSeed[i])
    if (fz > WF + 6.5) { fz = WF - 0.4; foamPos[i * 3] = CX + rand(-4.5, 4.5) }
    foamPos[i * 3 + 2] = fz
    foamPos[i * 3] += Math.sin(time + i) * dt * 0.15
  }
  foamGeo.attributes.position.needsUpdate = true
  for (let i = 0; i < MIST; i++) {
    let y = mistPos[i * 3 + 1] + dt * (0.5 + (i % 5) * 0.12)
    if (y > 5) y = 0.2
    mistPos[i * 3 + 1] = y
  }
  mistGeo.attributes.position.needsUpdate = true

  /* රාත්‍රී effects */
  skyGroup.position.copy(camera.position)
  starSets[0].material.opacity = 0.65 + 0.35 * Math.sin(time * 1.7)
  if (starSets[1]) starSets[1].material.opacity = 0.65 + 0.35 * Math.sin(time * 2.3 + 2.0)
  updateShooters(dt)
  for (let i = 0; i < RMIST; i++) {
    let rz = rmPos[i * 3 + 2] + dt * 0.5
    if (rz > RM_Z0) { rz = WF + 2 - rand(0, 4) }
    rmPos[i * 3 + 2] = rz
    rmPos[i * 3] = pathX(rz) + rmOff[i] * (riverHW(rz) / 5)
    rmPos[i * 3 + 1] = rmBase[i] + Math.sin(time * 0.6 + i) * 0.12
  }
  rmGeo.attributes.position.needsUpdate = true
  for (let i = 0; i < GM; i++) {                              // මීදුම ඇය ළඟින්ම තියාගන්නවා (ඉස්සරහට/පිටිපස්සට recycle)
    let gz = gmPos[i * 3 + 2]
    if (gz > charPos.z + 16) gz -= 62
    else if (gz < charPos.z - 46) gz += 62
    gmPos[i * 3 + 2] = gz
    gmPos[i * 3] = pathX(gz) + gmOff[i] + Math.sin(time * 0.15 + i) * 0.8
    gmPos[i * 3 + 1] = gmBase[i] + Math.sin(time * 0.3 + i * 2) * 0.12
  }
  gmGeo.attributes.position.needsUpdate = true
  for (let i = 0; i < LV; i++) {                              // කොළ හෙමින් වැටෙනවා, ඇය ළඟින්ම recycle වෙනවා
    let lz = lvPos[i * 3 + 2]
    if (lz > charPos.z + 14) lz -= 56
    else if (lz < charPos.z - 42) lz += 56
    lvPos[i * 3 + 2] = lz
    let ly = lvPos[i * 3 + 1] - dt * (0.35 + 0.25 * Math.sin(lvSeed[i]))
    if (ly < 0.05) ly = 6
    lvPos[i * 3 + 1] = ly
    lvPos[i * 3] += Math.sin(time * 0.9 + lvSeed[i] * 3) * dt * 0.5
  }
  lvGeo.attributes.position.needsUpdate = true

  updateWaterFx(dt)
  updateOverlay(dt)
  composer.render()
}
animate()