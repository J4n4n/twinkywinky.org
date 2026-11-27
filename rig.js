// twinkywinky.org rebuild — skeletal MESH rig (canvas 2D, linear-blend skinning).
// Real bone hierarchy + textured triangle meshes (mesh-data.js): every body
// region is a grid of vertices weighted to 1-2 bones, rendered per-triangle
// with affine texture mapping. A bend DEFORMS the torso into a smooth curve
// (chest/spine/hips weights) instead of rotating rigid parts about pivots.
// PIXEL REVERT + AMPLIFIED MOTION (2026-11-27): the vector rig was rejected
// by the owner («چرا کرکتر رو کلا عوض کردی») and reverted — this file IS the
// mesh rig again, driving the ORIGINAL pixel art. Only the MOTION changed,
// designed from a study of shipped pixel walk cycles (Stardew Valley 4f,
// Celeste 4f run, Shovel Knight 6f, Owlboy 8f/6f; 8-frame classic
// contact/down/passing/up; Pixeli timing rules; Disney principles adapted
// for pixels — see verify-mine/PIXEL-ANIMATION-DESIGN.md):
//  WALK (side, 76px stride, 60px/s, 1.27s/step = a stroll): CONTACT feet
//    76px apart, arms widest, 4.5% squash -> DOWN hips +13px, front knee
//    flexes ~20deg (the down-dip is what makes the knee bend REAL — the old
//    rig's IK was always at max reach so the leg was a straight stick) ->
//    PASSING support leg straight, free foot lifted 34px, 3% stretch ->
//    UP hips -11px, planted heel lifts (toe-down push-off, not a float).
//    Swing boot is FLAT (12deg) through the pass and toe-down (40deg)
//    only at push-off/landing, so the boots stay distinguishable at EVERY
//    moment, not just the four phases. Arms +-34deg opposite the legs
//    with a gentle 14deg elbow (a 32deg elbow bias cancelled the back
//    swing and left the near arm hanging like a rod); hair/braid trail
//    ~1/6 cycle behind.
//  BEND (2.0s): ANTICIPATION -> 80deg FOLD + 205 squat -> 200ms GRASP HOLD
//    -> HAIR-BACK -> RISE -> SETTLE. Arm grasp angles UNCHANGED (verified).
//  CARRY: same gait, 30px stride, 45px/s, clutch arms, 8deg lean-back,
//    bob damped x0.7, lift 12px.
//  UPSET (2.4s): TURN -> CROSS tight -> STOMP wind-up (7% squash, leg
//    cocks) -> STOMP LAND -> TURN-AWAY HOLD (must read in one still frame).
//  HAPPY (1.6s): 8% squash -> 8% stretch bounce, arms 32deg -> settle.
// Squash/stretch is volume-preserving and inside the 3-6% band for a
// 64px-class sprite; a pose meant to be read is held >= 83ms.
// Bone tree + pivots from rebuild/RIG-DATA.md (which supersedes SPECIALIST §2
// where they differ: braids AFTER arms BEFORE head; IK bind hips 1230).
// FK default; 2-bone IK ONLY for planted feet (walk / bend). Deterministic
// seeded idle (R31): no Math.random per frame. imageSmoothingEnabled=false,
// whole-degree rotation snapping.
(function () {
  'use strict';

  var SCALE = 380 / 1850;          // character 380px tall on screen
  var GROUND_Y = 552;              // boots on the rug (room coords)
  var HOME_X = 215;              // room centre in canvas CSS px at POCO scale (room 430 wide; 195 design px)
  var DEG = Math.PI / 180;

  // ---------------- seeded PRNG (deterministic idle) ----------------
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry32(20261127);
  // Precomputed deterministic blink schedule: cycle lengths 2.8–5.0s.
  // (pre-walk character, pixel-char Nov 26: blink 130ms every ~2.8-5s).
  var BLINK_CYCLES = [];
  (function () { for (var i = 0; i < 64; i++) BLINK_CYCLES.push(2.8 + rng() * 2.2); })();
  var FIDGET_KINDS = [];
  (function () { for (var i = 0; i < 32; i++) FIDGET_KINDS.push(Math.floor(rng() * 3)); })();
  // Precomputed deterministic tilt schedule (round 7 idle wiring): cycle
  // lengths 8-12s; frontIdleSprite shows front-idle-tilt for the first
  // 1.0s of each cycle. Generated after BLINK_CYCLES / FIDGET_KINDS so
  // their sequences are unchanged (rng() has no other consumers).
  var TILT_CYCLES = [];
  (function () { for (var i = 0; i < 64; i++) TILT_CYCLES.push(8 + rng() * 4); })();

  // Per-set scale for the 1930-tall FRONT sprite sets (idle + sit,
  // round 7): crown top image row 60 (idle) / 340 (sit), sole bottom
  // 1930, so SCALE_FRONT = 380/(1930-60) = 380/1870 with source
  // (800,1930) anchored at (charX, groundY) — head-top 172.0 room CSS
  // px = 155.6 design px (the lock) for idle, 228.9 CSS = 207.1 design
  // px for sit (span 1930-340=1590). Do NOT just change the global 1850
  // constant to 1930 with SCALE=380/1930: that drops the crown ~11
  // design px below the lock. The mapping is PER SPRITE SET: the mesh
  // parts, side sprites and upset-f-* (1850 tall) keep the global
  // SCALE/1850 — only the two front draw sites use SCALE_FRONT.
  var SCALE_FRONT = 380 / 1870;

  // ---------------- voice ----------------
  var VOICE = {
    pet: ['v03_pet.mp3', 'v12_tickle.mp3', 'v10_cute.mp3', 'v11_love.mp3', 'v01_yahoo.mp3'],
    eat: ['v06_best.mp3', 'v01_yahoo.mp3'],
    celebrate: ['v01_yahoo.mp3', 'v02_giggle.mp3', 'v09_knight.mp3'],
    chat: ['v02_giggle.mp3', 'v08_adventure.mp3'],
    poke: ['v07_huh.mp3'],
    upset: ['v07_huh.mp3', 'v09_knight.mp3'],
    giggle: ['v02_giggle.mp3']
  };
  var voiceCache = {};
  var muted = false;
  function loadVoice(name) {
    if (voiceCache[name]) return voiceCache[name];
    var a = new Audio('assets/voice/' + name);
    a.preload = 'auto';
    voiceCache[name] = a;
    return a;
  }
  function playVoice(pool) {
    if (muted) return;
    var list = VOICE[pool] || VOICE.pet;
    var name = list[Math.floor(Math.random() * list.length)];
    try { var a = loadVoice(name); a.currentTime = 0; a.play().catch(function () {}); } catch (e) {}
  }
  var blipAudio = null;
  function blip() {
    if (muted) return;
    try {
      if (!blipAudio) blipAudio = loadVoice('blip.mp3');
      blipAudio.currentTime = 0; blipAudio.play().catch(function () {});
    } catch (e) {}
  }

  // ---------------- images ----------------
  var PARTS = [
    'backhair', 'blush', 'head', 'head_closed', 'head_sleep', 'head_frown', 'head_happy',
    'braid_upper_L', 'braid_upper_R', 'braid_lower_L', 'braid_lower_R',
    'torso_mesh', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R',
    'hand_open_L', 'hand_open_R', 'hand_holding_L', 'hand_holding_R', 'hand_fist_L', 'hand_fist_R',
    'thigh_L', 'thigh_R', 'shin_L', 'shin_R', 'boot_L', 'boot_R', 'book', 'sleep_lying'
  ];
  var SIDE_PARTS = [
    'side_head', 'side_braid', 'side_backhair', 'side_torso_mesh',
    'side_upperarm', 'side_upperarm_far', 'side_forearm', 'side_forearm_far',
    'side_hand_open', 'side_hand_open_far', 'side_thigh', 'side_thigh_far',
    'side_shin', 'side_shin_far', 'side_boot', 'side_boot_far'
  ];
  var IMG = {};
  var ITEM_IMG = {};
  // Side-view SPRITE set (frame-by-frame pixel art, one unified grid —
  // see SIDE-SPRITE-DESIGN.md). Each frame is a complete 1600x1850 drawing,
  // never rotated/sheared/scaled on canvas. Round-7 fix: the list is
  // intentionally EMPTY — the side poses are dead code under the new
  // in-place brief (see the window.Rig export note), and loading the files
  // only produced console 404s in the deploy package. The v7 mesh rig
  // stays as the fallback; spriteFor() null-guards every lookup.
  var SPRITE_FILES = [];
  // Front-view idle sprites (rebuild round 3, FIX 1): the front view redrawn
  // on the SAME 160x185 pixel grid as the side sprites (see
  // build-scripts/front_sprite.py). Loaded into the same SPR map; the
  // 'front-' prefix keeps the two sets apart.
  // Round-7 fix: upset-f-* removed — the upset pose is dead code under the
  // new in-place brief, and loading the files only produced console 404s.
  // MERGE 2026-11-28 (pre-walk character): the home idle is the mesh, so
  // the front-idle-* sprites are no longer loaded (the PNG files stay in
  // the repo, undeleted). Only the sit sprites load — the rug sit is
  // still sprite-based (frontSitSprite).
  var FRONT_FILES = ['front-sit-0', 'front-sit-1', 'front-sit-closed'];
  // GEMINI 2026-11-28 (approved 2D character): the 5 Gemini states,
  // chroma-keyed PNGs on the 1600x1930 front-sprite grid (same grid as
  // the pixel front sprites). Loaded into the same SPR map under the
  // 'gemini-' keys; assets/gemini/char-<state>.png.
  var GEMINI_FILES = ['idle', 'blink', 'tilt', 'happy', 'sit'];
  var SPR = {};
  var readyPromise = null;

  function loadImg(path) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = path;
    });
  }
  function loadAll() {
    if (readyPromise) return readyPromise;
    var jobs = [];
    PARTS.forEach(function (n) { jobs.push(loadImg('assets/parts/' + n + '.png').then(function (im) { IMG[n] = im; })); });
    SIDE_PARTS.forEach(function (n) { jobs.push(loadImg('assets/parts-side/' + n + '.png').then(function (im) { IMG[n] = im; })); });
    // The carried object is the shelf stack itself (assets/props/books.png,
    // 50x30 natural) — the same image as #p-books / #falling-book, so the
    // stack that falls is pixel-identical to the stack she carries back.
    jobs.push(loadImg('assets/props/books.png').then(function (im) { IMG.booksStack = im; }));
    SPRITE_FILES.forEach(function (n) { jobs.push(loadImg('assets/sprites-side/' + n + '.png').then(function (im) { SPR[n] = im; })); });
    FRONT_FILES.forEach(function (n) { jobs.push(loadImg('assets/sprites-front/' + n + '.png').then(function (im) { SPR[n] = im; })); });
    GEMINI_FILES.forEach(function (n) { jobs.push(loadImg('assets/gemini/char-' + n + '.png').then(function (im) { SPR['gemini-' + n] = im; })); });
    readyPromise = Promise.all(jobs);
    return readyPromise;
  }

  // Side-view sprite selection. Returns the sprite Image for the current
  // pose, or null to fall back to the mesh renderSide. The sprite is drawn
  // UNDEFORMED (base transform only, never the pose's squash/scale — the
  // walk's squash is baked into the sprite frames via the hip bob, and the
  // head must never be scaled: that was the head-squash bug).
  function spriteFor(pose, ws, anim) {
    if (pose && typeof pose.spriteBend === 'number') {
      var bim = SPR['bend-' + pose.spriteBend];
      if (bim) return bim;
    }
    if (pose && typeof pose.spritePutback === 'number') {
      var pbim = SPR['putback-' + pose.spritePutback];
      if (pbim) return pbim;
    }
    if (pose && typeof pose.spriteUpset === 'number') {
      var uim = SPR['upset-f-' + pose.spriteUpset];
      if (uim) return uim;
    }
    if (ws && ws.carrying && pose && pose.spriteWalk) {
      var sw = pose.spriteWalk;
      var cim = SPR['carry-' + sw.lead + '-' + sw.phase];
      if (cim) return cim;
    }
    if (ws && !ws.carrying && pose && pose.spriteWalk) {
      var sw = pose.spriteWalk;
      var im = SPR['walk-' + sw.lead + '-' + sw.phase];
      if (im) return im;
    }
    if (!ws && !anim && !holdPose && mode === 'side') {
      if (SPR.rest) return SPR.rest;
    }
    return null;
  }

  // MERGE 2026-11-28 (pre-walk character): the round-7 shelf glance is
  // REMOVED. The pre-walk character never turned her head to the shelf;
  // a shelf tap is a bubble line only (game.js shelfSequence). The
  // triggerGlance export, the glanceUntil state and the front-idle-glance
  // sprite branch are all gone; the sprite PNG stays in the repo.

  // MERGE 2026-11-28 (pre-walk character): the home idle is the MESH
  // (renderFront + the pre-walk idlePose below), NOT a sprite. The
  // front-idle sprites were the round-7 breath/tilt/glance frames — the
  // breath moved the whole body, which the pre-walk character never did.
  // This function now always returns null so frame() falls through to
  // the mesh. The sit sprites (frontSitSprite) are untouched.
  // GEMINI 2026-11-28 (approved 2D character): the home idle is the
  // Gemini 2D character (flat sprites), NOT the mesh. Head-only motion:
  // blink swaps (130ms per BLINK_CYCLES) + an occasional tilt swap
  // (1.0s per TILT_CYCLES); the body never moves — the sprite is drawn
  // undeformed, so there is no breath, weight-shift, fidget or braid
  // lag (the mesh idlePose's bob/sway/spring do not apply to a flat
  // sprite; see the head-spring note in pet()). faceOverride (pet /
  // chat / poke / sleepy) maps to a Gemini state; there is no frown
  // image, so head_frown falls back to the neutral idle.
  function frontIdleSprite(t) {
    if (mode !== 'front' || anim || holdPose || walkState) return null;
    if (sitting || dancing || carriedBook) return null;
    if (gear.head || gear.neck || gear.braid || gear.outfit) return null;
    if (faceOverride) {
      if (Date.now() < faceOverride.until) {
        var f = faceOverride.face;
        if (f === 'head_happy') return SPR['gemini-happy'] || null;
        if (f === 'head_tilt') return SPR['gemini-tilt'] || null;
        if (f === 'head_sleep' || f === 'head_closed') return SPR['gemini-blink'] || null;
        return SPR['gemini-idle'] || null;
      }
      faceOverride = null;
    }
    if (Date.now() < excitedUntil) return SPR['gemini-idle'] || null;
    if (reducedMotion) return SPR['gemini-idle'] || null;
    var idx = 0, acc = 0;
    while (acc + BLINK_CYCLES[idx % BLINK_CYCLES.length] < t) { acc += BLINK_CYCLES[idx % BLINK_CYCLES.length]; idx++; }
    if (t - acc < 0.13) return SPR['gemini-blink'] || null;
    var tidx = 0, tacc = 0;
    while (tacc + TILT_CYCLES[tidx % TILT_CYCLES.length] < t) { tacc += TILT_CYCLES[tidx % TILT_CYCLES.length]; tidx++; }
    if (t - tacc < 1.0) return SPR['gemini-tilt'] || null;
    return SPR['gemini-idle'] || null;
  }

  // Front-sit sprite selection (rebuild round 4, face composite +
  // headroom round 7). Returns the front-sit sprite Image when sitting
  // at home — mode 'front', sitting, no anim, no holdPose, no walkState
  // — or null to fall back to the mesh renderFront. The mesh sit never
  // rendered: its thigh/knee rotations are in the screen plane, so a
  // front sit reads as a shorter standing figure (the pose applies —
  // head-top drops ~65 design px — but the legs stay vertical). The
  // sprite is a REAL front sit drawn on the same grid
  // (build-scripts/front_sit.py): the upper body is the exact rest-pose
  // pixels shifted down 28 grid, the thighs fold up-out to the knees,
  // the shins cross in front of the lap, the boots lie flat on the sole
  // row, the hands rest on the knees. Round 7: the head is composited
  // from Worker A's finished idle frames (same face pixels, translated)
  // and the PNGs are 1600x1930 with headroom (crown fully round) —
  // drawn with the per-set SCALE_FRONT/1930 mapping at the draw site.
  // Blink uses the SAME BLINK_CYCLES schedule as the idle sprite.
  // Breathing KEEPS the piecewise 3.0s rule (front-sit-1, upper body +
  // arms drop 1 grid px, legs fixed — round 5): front-sit-1 never
  // changed meaning — it is and stays the LOW frame, shown during the
  // mesh breath's low phase — so the idle's signed-sine rewrite does
  // NOT apply here. The same guards as frontIdleSprite apply — no
  // dancing, carried book, gear, faceOverride, excited — sitting is
  // the only difference.
  // GEMINI 2026-11-28: the sit image already has her eyes closed and
  // is a single frame — no blink/breath alternation (the pixel
  // front-sit-0/1/closed set is retired). faceOverride / excited are
  // deliberately NOT guards here: a pet while sitting must keep her
  // seated (the happy state is a standing sprite; falling through to
  // it would pop her upright while body.sitting stays set).
  function frontSitSprite(t) {
    if (mode !== 'front' || !sitting || anim || holdPose || walkState) return null;
    if (dancing || carriedBook) return null;
    if (gear.head || gear.neck || gear.braid || gear.outfit) return null;
    return SPR['gemini-sit'] || null;
  }

  // ---------------- bone tree (front pivots, RIG-DATA §2/§3) ----------------
  // bind: [x, y], parent name. L/R = viewer's left/right.
  var BONES_F = {
    root:      { bind: [800, 1850], parent: null },
    hips:      { bind: [800, 1215], parent: 'root' },
    spine:     { bind: [800, 1090], parent: 'hips' },
    chest:     { bind: [800, 800],  parent: 'spine' },
    neck:      { bind: [800, 560],  parent: 'chest' },
    head:      { bind: [800, 520],  parent: 'neck' },
    shoulder_L:{ bind: [625, 640],  parent: 'chest' },
    elbow_L:   { bind: [490, 1030], parent: 'shoulder_L' },
    wrist_L:   { bind: [410, 1425], parent: 'elbow_L' },
    shoulder_R:{ bind: [975, 640],  parent: 'chest' },
    elbow_R:   { bind: [1110, 1030],parent: 'shoulder_R' },
    wrist_R:   { bind: [1190, 1425],parent: 'elbow_R' },
    thigh_L:   { bind: [660, 1215], parent: 'hips' },
    knee_L:    { bind: [660, 1560], parent: 'thigh_L' },
    ankle_L:   { bind: [665, 1720], parent: 'knee_L' },
    thigh_R:   { bind: [940, 1215], parent: 'hips' },
    knee_R:    { bind: [940, 1560], parent: 'thigh_R' },
    ankle_R:   { bind: [935, 1720], parent: 'knee_R' },
    braidUL:   { bind: [660, 430],  parent: 'head' },
    braidLL:   { bind: [660, 580],  parent: 'braidUL' },
    braidUR:   { bind: [940, 430],  parent: 'head' },
    braidLR:   { bind: [940, 580],  parent: 'braidUR' },
    backhair:  { bind: [800, 300],  parent: 'root' }
  };
  // Side-view pivots (RIG-DATA §5). Near arm/shoulder (850,640); far (800,640).
  var BONES_S = {
    root:      { bind: [800, 1850], parent: null },
    hips:      { bind: [810, 1215], parent: 'root' },
    spine:     { bind: [810, 1090], parent: 'hips' },
    chest:     { bind: [810, 800],  parent: 'spine' },
    neck:      { bind: [810, 560],  parent: 'chest' },
    head:      { bind: [810, 520],  parent: 'neck' },
    shoulder_N:{ bind: [850, 640],  parent: 'chest' },
    elbow_N:   { bind: [860, 1030], parent: 'shoulder_N' },
    wrist_N:   { bind: [860, 1425], parent: 'elbow_N' },
    shoulder_F:{ bind: [800, 640],  parent: 'chest' },
    elbow_F:   { bind: [810, 1030], parent: 'shoulder_F' },
    wrist_F:   { bind: [810, 1425], parent: 'elbow_F' },
    thigh_N:   { bind: [820, 1215], parent: 'hips' },
    knee_N:    { bind: [830, 1560], parent: 'thigh_N' },
    ankle_N:   { bind: [830, 1720], parent: 'knee_N' },
    thigh_F:   { bind: [815, 1215], parent: 'hips' },
    knee_F:    { bind: [825, 1560], parent: 'thigh_F' },
    ankle_F:   { bind: [825, 1720], parent: 'knee_F' },
    braid:     { bind: [700, 430],  parent: 'head' },
    backhair:  { bind: [715, 300],  parent: 'root' }
  };
  var ORDER_F = ['root', 'hips', 'spine', 'chest', 'neck', 'head',
    'shoulder_L', 'elbow_L', 'wrist_L', 'shoulder_R', 'elbow_R', 'wrist_R',
    'thigh_L', 'knee_L', 'ankle_L', 'thigh_R', 'knee_R', 'ankle_R',
    'braidUL', 'braidLL', 'braidUR', 'braidLR', 'backhair'];
  var ORDER_S = ['root', 'hips', 'spine', 'chest', 'neck', 'head',
    'shoulder_N', 'elbow_N', 'wrist_N', 'shoulder_F', 'elbow_F', 'wrist_F',
    'thigh_N', 'knee_N', 'ankle_N', 'thigh_F', 'knee_F', 'ankle_F', 'braid', 'backhair'];

  // IK bind pose (RIG-DATA §3): hips 15px lower -> hip->ankle 490px, ~9.4deg knee bend.
  var IK_HIPS_Y = 1230, THIGH_LEN = 345, SHIN_LEN = 160;

  // ---------------- state ----------------
  var canvas = null, ctx = null, dpr = 1, fitCanvas = null;
  var mode = 'front';           // 'front' | 'side' | 'sleep'
  var facing = 1;               // side view: +1 facing right, -1 facing left
  var charX = HOME_X, groundY = GROUND_Y;
  var anim = null;              // {t0, dur, sample(t01)->patch, done, hold}
  var holdPose = null;          // pose held after an animation (e.g. upset)
  var busy = false;
  var busyUntil = 0; // GEMINI 2026-11-28: faceOverride poses (happy/eat/
  // bath/look) no longer run a mesh anim, so they set a busy deadline
  // instead — isBusy() stays true for the pose duration.
  var reducedMotion = false;
  var dancing = false;
  var sitting = false;
  var sleeping = false;
  var sleepT0 = 0;
  var faceOverride = null;      // {face, until}
  var excitedUntil = 0;
  var gear = { head: null, neck: null, braid: null, outfit: null, room: null, decor: [] };
  var carriedBook = false;      // book parented to hands
  var handWorld = { x: 0, y: 0, a: 0 }; // last computed near-hand world pos (composite)
  var lastRender = { mode: 'front', charX: HOME_X, face: 'head' };

  // Pose patch: { ang:{bone:deg}, rootDx, rootDy, hipsDy, chestSY, face, handL, handR,
  //   swapArms, scaleX, scaleY, braidA, headDy, headDx }
  function basePose() {
    return { ang: {}, rootDx: 0, rootDy: 0, hipsDy: 0, chestSY: 1, face: 'head',
      handL: 'open', handR: 'open', swapArms: false, scaleX: 1, scaleY: 1, braidA: 0, headDy: 0, headDx: 0 };
  }

  // ---------------- keyframe helpers ----------------
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(t) { return t < 0 ? 0 : (t > 1 ? 1 : t); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t * t; }
  // keys: [{t:0..1, v:pose, e:'inOut'|'out'|'in'|'lin'}]; step fields (face/hand) snap.
  var NUM_FIELDS = ['rootDx', 'rootDy', 'hipsDy', 'chestSY', 'scaleX', 'scaleY', 'braidA', 'headDy'];
  function sampleKeys(keys, t01) {
    var out = basePose();
    if (!keys || !keys.length) return out;
    var i = 0;
    while (i < keys.length - 1 && keys[i + 1].t <= t01) i++;
    var k0 = keys[i], k1 = keys[Math.min(i + 1, keys.length - 1)];
    var span = (k1.t - k0.t) || 1;
    var lt = clamp01((t01 - k0.t) / span);
    var e = k0.e || 'inOut';
    var et = e === 'lin' ? lt : (e === 'out' ? easeOut(lt) : (e === 'in' ? easeIn(lt) : easeInOut(lt)));
    function mixV(a, b) {
      if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, et);
      return lt < 0.5 ? a : b;
    }
    var allKeys = {};
    [k0.v, k1.v].forEach(function (v) { for (var k in v) allKeys[k] = 1; });
    Object.keys(allKeys).forEach(function (k) {
      if (k === 'ang') {
        out.ang = {};
        var bones = {};
        [k0.v.ang || {}, k1.v.ang || {}].forEach(function (a) { for (var b in a) bones[b] = 1; });
        Object.keys(bones).forEach(function (b) {
          var a0 = (k0.v.ang || {})[b], a1 = (k1.v.ang || {})[b];
          if (a0 === undefined) a0 = a1; if (a1 === undefined) a1 = a0;
          out.ang[b] = mixV(a0, a1);
        });
      } else if (NUM_FIELDS.indexOf(k) !== -1) {
        var n0 = k0.v[k], n1 = k1.v[k];
        if (n0 === undefined) n0 = n1; if (n1 === undefined) n1 = n0;
        out[k] = mixV(n0, n1);
      } else {
        out[k] = lt < 0.5 ? (k0.v[k] !== undefined ? k0.v[k] : k1.v[k]) : (k1.v[k] !== undefined ? k1.v[k] : k0.v[k]);
      }
    });
    // carry forward fields present only in k0
    return out;
  }

  // ---------------- FK solve ----------------
  // pose: {ang, rootDx, rootDy, hipsDy} ; bones: BONES_F or BONES_S.
  // Returns world {bone:{x,y,a}} in composite coords. hipsDy shifts hips+children down.
  function solveFK(bones, order, pose) {
    var world = {};
    var ang = pose.ang || {};
    order.forEach(function (name) {
      var b = bones[name];
      var parent = b.parent ? world[b.parent] : null;
      var localA = (ang[name] || 0);
      var a = parent ? parent.a + localA : localA;
      var x, y;
      if (!parent) {
        x = b.bind[0] + (pose.rootDx || 0);
        y = b.bind[1] + (pose.rootDy || 0);
      } else {
        var pb = bones[b.parent].bind;
        var dx = b.bind[0] - pb[0], dy = b.bind[1] - pb[1];
        var ca = Math.cos(parent.a * DEG), sa = Math.sin(parent.a * DEG);
        x = parent.x + dx * ca - dy * sa;
        y = parent.y + dx * sa + dy * ca;
      }
      // hipsDy: whole body below hips sags (breath / crouch) — apply to hips and descendants.
      if (name === 'hips' && pose.hipsDy) y += pose.hipsDy;
      // backhairDy/Dx: the backhair is parented to root, so in a deep bend
      // its pivot stays at the upright neck and the hair floats in mid-air.
      // Shift it down (Dy) and forward toward the book (Dx, +x in facing
      // coords = toward the head, whichever way she faces) so it stays
      // attached to the head instead of swinging out as a separate slab.
      if (name === 'backhair') {
        if (pose.backhairDy) y += pose.backhairDy;
        if (pose.backhairDx) x += pose.backhairDx;
      }
      else if (parent && world.__hipsDy && name !== 'hips') {
        // descendants inherit the hips offset through parent's position already
      }
      world[name] = { x: x, y: y, a: a };
    });
    return world;
  }

  // 2-bone IK: hip H, ankle target A, lengths L1/L2, knee forward (+x in facing coords).
  // Returns {knee:{x,y}, thighA, shinA} where angles are absolute (deg, 0 = +x, 90 = down).
  function solveIK(H, A, L1, L2) {
    var dx = A.x - H.x, dy = A.y - H.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var maxD = L1 + L2 - 15;              // never full extension (R16)
    if (d > maxD) { var s = maxD / d; A = { x: H.x + dx * s, y: H.y + dy * s }; d = maxD; }
    if (d < 40) d = 40;
    var phi = Math.atan2(dy, dx);
    var cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
    cosA = Math.max(-1, Math.min(1, cosA));
    var alpha = Math.acos(cosA);
    // knee forward: rotate phi toward +x (decreasing angle in y-down coords)
    var kA = phi - alpha;
    var K = { x: H.x + L1 * Math.cos(kA), y: H.y + L1 * Math.sin(kA) };
    var thighA = Math.atan2(K.y - H.y, K.x - H.x) / DEG;
    var shinA = Math.atan2(A.y - K.y, A.x - K.x) / DEG;
    return { knee: K, thighA: thighA, shinA: shinA, ankle: A };
  }

  // ---------------- mesh skinning ----------------
  // Bone matrix: maps bind-pose composite coords to current composite coords.
  // [a,b,c,d,e,f]: x' = a*x + c*y + e; y' = b*x + d*y + f.
  // M = T(P) * R(theta) * S(sx,sy) * T(-Q). For FK bones P = the bone's current
  // world origin, Q = its bind origin (this reproduces drawPart exactly).
  // For IK leg bones P = Q = the CURRENT pivot (hip/knee/ankle), which
  // reproduces drawPartAt exactly (rotate about the current pivot).
  function boneMat(Px, Py, thetaDeg, Qx, Qy, sx, sy) {
    var th = thetaDeg * DEG;
    var cos = Math.cos(th), sin = Math.sin(th);
    sx = sx || 1; sy = sy || 1;
    var a = cos * sx, b = sin * sx, c = -sin * sy, d = cos * sy;
    return [a, b, c, d, Px - a * Qx - c * Qy, Py - b * Qx - d * Qy];
  }
  // Build one matrix per bone for the current frame. legs (side view, IK) is
  // pose._legs {near:{hip,knee,ankle,thighA,shinA,bootA}, far:{...}}; when
  // absent the leg bones fall back to their FK world transforms.
  function buildBoneMats(bones, world, pose, legs) {
    var mats = {};
    var chestSY = pose.chestSY || 1;
    var braidA = pose.braidA || 0;
    var order = (bones === BONES_F) ? ORDER_F : ORDER_S;
    order.forEach(function (name) {
      var w = world[name];
      var b = bones[name];
      var a = w.a;
      // Braid lag: the lower braid segments get the extra lag angle (the old
      // code applied it at draw time; here it belongs in the bone matrix).
      if ((name === 'braidLL' || name === 'braidLR' || name === 'braid') && braidA) a += braidA;
      // Breathing: the chest bone carries the vertical chest scale, so the
      // torso mesh breathes; the 1.5% stretch on the sleeve-cap rows that
      // blend to the chest is negligible and reads as the hoodie breathing.
      var sy = (name === 'chest') ? chestSY : 1;
      mats[name] = boneMat(w.x, w.y, a, b.bind[0], b.bind[1], 1, sy);
    });
    if (legs) {
      [['near', 'thigh_N', 'knee_N', 'ankle_N'], ['far', 'thigh_F', 'knee_F', 'ankle_F']].forEach(function (cfg) {
        var leg = legs[cfg[0]];
        if (!leg) return;
        mats[cfg[1]] = boneMat(leg.hip.x, leg.hip.y, leg.thighA, leg.hip.x, leg.hip.y, 1, 1);
        mats[cfg[2]] = boneMat(leg.knee.x, leg.knee.y, leg.shinA, leg.knee.x, leg.knee.y, 1, 1);
        mats[cfg[3]] = boneMat(leg.ankle.x, leg.ankle.y, leg.bootA, leg.ankle.x, leg.ankle.y, 1, 1);
      });
    }
    return mats;
  }
  // One textured triangle: affine map from texture coords (bind positions) to
  // skinned composite positions, clipped to the triangle. Texture coords ==
  // bind-pose composite coords (parts are 1600x1850 full-canvas images).
  // Two details matter:
  // - The clip triangle is expanded ~1.5 composite px about its centroid, so
  //   adjacent triangles overlap by a hairline. Canvas clips are antialiased,
  //   and without the overlap a hairline of background shows through between
  //   triangles (visible as triangulation seams on flat areas like the hoodie).
  //   The texture is continuous across the shared edge, so the overlap samples
  //   the correct texture; at the silhouette the overlap samples transparency.
  // - Only the triangle's texture bounding box is drawn (source rect), not
  //   the whole 1600x1850 image — much less sampling work per triangle.
  function drawMeshTri(img, t0, t1, t2, x0, y0, x1, y1, x2, y2) {
    var du1 = t1[0] - t0[0], dv1 = t1[1] - t0[1];
    var du2 = t2[0] - t0[0], dv2 = t2[1] - t0[1];
    var det = du1 * dv2 - du2 * dv1;
    if (det > -0.5 && det < 0.5) return;
    var dx1 = x1 - x0, dy1 = y1 - y0;
    var dx2 = x2 - x0, dy2 = y2 - y0;
    var a = (dx1 * dv2 - dx2 * dv1) / det;
    var b = (dy1 * dv2 - dy2 * dv1) / det;
    var c = (du1 * dx2 - du2 * dx1) / det;
    var d = (du1 * dy2 - du2 * dy1) / det;
    var e = x0 - a * t0[0] - c * t0[1];
    var f = y0 - b * t0[0] - d * t0[1];
    var cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;
    function ex(x, y) {
      var ddx = x - cx, ddy = y - cy;
      var L = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      var k = 1.5 / L;
      return [x + ddx * k, y + ddy * k];
    }
    var p0 = ex(x0, y0), p1 = ex(x1, y1), p2 = ex(x2, y2);
    var u0 = Math.max(0, Math.floor(Math.min(t0[0], t1[0], t2[0]) - 1));
    var v0 = Math.max(0, Math.floor(Math.min(t0[1], t1[1], t2[1]) - 1));
    var u1 = Math.min(1600, Math.ceil(Math.max(t0[0], t1[0], t2[0]) + 1));
    var v1 = Math.min(1850, Math.ceil(Math.max(t0[1], t1[1], t2[1]) + 1));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, e + a * u0 + c * v0, f + b * u0 + d * v0);
    ctx.drawImage(img, u0, v0, u1 - u0, v1 - v0, 0, 0, u1 - u0, v1 - v0);
    ctx.restore();
  }
  var _skinned = new Float32Array(512); // reused skinning buffer (x,y per vertex)
  function drawMesh(name, img, mats) {
    if (!img) return;
    var m = window.MESH_DATA && window.MESH_DATA[name];
    if (!m) return;
    var verts = m.verts, tris = m.tris;
    var i, v, M0, x, y, sx, sy, w, M1;
    for (i = 0; i < verts.length; i++) {
      v = verts[i];
      M0 = mats[v[2]];
      x = v[0]; y = v[1];
      if (!M0) { _skinned[i * 2] = x; _skinned[i * 2 + 1] = y; continue; }
      sx = M0[0] * x + M0[2] * y + M0[4];
      sy = M0[1] * x + M0[3] * y + M0[5];
      if (v[4]) {
        w = v[3];
        M1 = mats[v[4]];
        if (M1) {
          sx = sx * w + (M1[0] * x + M1[2] * y + M1[4]) * (1 - w);
          sy = sy * w + (M1[1] * x + M1[3] * y + M1[5]) * (1 - w);
        }
      }
      _skinned[i * 2] = sx;
      _skinned[i * 2 + 1] = sy;
    }
    for (i = 0; i < tris.length; i++) {
      var tri = tris[i];
      var i0 = tri[0], i1 = tri[1], i2 = tri[2];
      drawMeshTri(img, verts[i0], verts[i1], verts[i2],
        _skinned[i0 * 2], _skinned[i0 * 2 + 1],
        _skinned[i1 * 2], _skinned[i1 * 2 + 1],
        _skinned[i2 * 2], _skinned[i2 * 2 + 1]);
    }
  }

  // Head spring (pre-walk character, pixel-char Nov 26): the head is a
  // spring-damped pendulum around the neck pivot (k=180, c=15, slightly
  // underdamped; angle clamp ±0.10 rad, dx ±14, dy -10..12 composite px).
  // At rest it sits at 0; pet() impulses it so the head wobbles and
  // settles. Integrated in frame(); applied to the pose's head (ang.head
  // in deg, headDx/headDy in composite px) on top of the idle sway.
  var headSpring = { angle: 0, angVel: 0, dx: 0, dxVel: 0, dy: 0, dyVel: 0 };
  var headSpringLast = 0;
  function stepHeadSpring(now) {
    var dt = headSpringLast ? Math.min(0.05, (now - headSpringLast) / 1000) : 0.016;
    headSpringLast = now;
    var k = 180, c = 15;
    headSpring.angVel += (-k * headSpring.angle - c * headSpring.angVel) * dt;
    headSpring.angle += headSpring.angVel * dt;
    headSpring.dxVel += (-k * headSpring.dx - c * headSpring.dxVel) * dt;
    headSpring.dx += headSpring.dxVel * dt;
    headSpring.dyVel += (-k * headSpring.dy - c * headSpring.dyVel) * dt;
    headSpring.dy += headSpring.dyVel * dt;
    headSpring.angle = Math.max(-0.10, Math.min(0.10, headSpring.angle));
    headSpring.dx = Math.max(-14, Math.min(14, headSpring.dx));
    headSpring.dy = Math.max(-10, Math.min(12, headSpring.dy));
  }
  function headSpringActive() {
    return Math.abs(headSpring.angle) > 0.0005 || Math.abs(headSpring.angVel) > 0.001 ||
           Math.abs(headSpring.dx) > 0.05 || Math.abs(headSpring.dxVel) > 0.1 ||
           Math.abs(headSpring.dy) > 0.05 || Math.abs(headSpring.dyVel) > 0.1;
  }

  // ---------------- idle (front, procedural, deterministic) ----------------
  // MERGE 2026-11-28 (pre-walk character, pixel-char Nov 26 22:32): the
  // home idle is HEAD-ONLY. The pre-walk character never breathed, never
  // shifted its weight, never fidgeted, never tucked its hair — the body
  // is still and only the head moves: a tiny whole-character bob, a
  // ±0.012 rad head sway, and a blink. Breath / weight-shift / fidgets /
  // braid-lag / torso-sway are REMOVED here (they moved the body). The
  // head spring is applied in frame(), on top of this pose. The sitting
  // and dancing branches below are the round-7 mesh fallbacks and stay.
  function idlePose(t) {
    var p = basePose();
    if (sleeping) return p;
    var amp = reducedMotion ? 0 : 1;
    // Pre-walk bob: whole-character translate only, never stretch.
    // bobPhase advances 1.4/s; amp 3 (excited 5), composite px.
    var bobAmp = (Date.now() < excitedUntil) ? 5 : 3;
    p.rootDy = Math.sin(t * 1.4) * bobAmp * amp;
    // Pre-walk head sway: ±0.012 rad = ±0.69 deg, same phase as the bob.
    p.ang.head = Math.sin(t * 1.4 * 0.65) * 0.69 * amp;
    // Blink: deterministic cycle schedule, head_closed for 130ms at the
    // start of each 2.8-5.0s cycle (BLINK_CYCLES, pre-walk schedule).
    var idx = 0, acc = 0;
    while (acc + BLINK_CYCLES[idx % BLINK_CYCLES.length] < t) { acc += BLINK_CYCLES[idx % BLINK_CYCLES.length]; idx++; }
    var into = t - acc;
    if (into < 0.13 && !faceOverride) p.face = 'head_closed';
    if (dancing) {
      p.ang.hips = Math.sin(t * 2 * Math.PI / 0.9) * 4;
      p.ang.chest = Math.sin(t * 2 * Math.PI / 0.9) * 5;
      p.ang.head = Math.sin(t * 2 * Math.PI / 0.9 + 0.5) * 6;
      p.braidA = Math.sin(t * 2 * Math.PI / 0.9 - 0.6) * 8;
    }
    if (sitting) {
      // REAL SEATED POSE (2026-11-27, gap 2 — verified variant G): hips low
      // on the rug, knees bent, feet flat on the floor in front, torso
      // upright, arms resting at her sides. hipsDy 350 drops the body ~72
      // screen px (vs 23 for the old 110); thigh 45deg splays the knees out
      // past the shorts so the bend reads, knee 55deg brings the shins back
      // to near-vertical so the feet land flat. backhairDy = hipsDy: the
      // backhair is parented to ROOT, not to the hips, so without its own Dy
      // it floats at standing height while the head drops (see solveFK).
      // Thigh 50deg+ folds the front-leg meshes (socks vanish, black
      // pillars); 45deg is the widest clean splay. The old pose (hipsDy 110,
      // thigh 18, knee 25) read as a shallow squat.
      p.hipsDy = 350;
      p.backhairDy = 350;
      p.ang.thigh_L = -45; p.ang.thigh_R = 45;
      p.ang.knee_L = 55; p.ang.knee_R = -55;
      p.ang.shoulder_L = -15; p.ang.shoulder_R = 15;
      p.ang.elbow_L = 30; p.ang.elbow_R = -30;
      p.ang.chest = 4;
      // The seated mesh fallback is still: no idle bob or head sway while
      // sitting (the sit sprite is primary; this is only its fallback).
      p.rootDy = 0;
      p.ang.head = 0;
    }
    if (Date.now() < excitedUntil) { p.braidA += 2; }
    return p;
  }

  // ---------------- walk (side view, IK legs) ----------------
  // walk state, driven by anim sampler; stored here so render() can draw legs.
  var walkState = null; // {fromX,toX,dir,speed,stepPx,carrying,elapsed,dur}
  var walkCheck = null; // the active walkTo interval; only ONE walk drives
  // charX at a time (fix round 2): a new walkTo cancels the previous
  // interval, otherwise the old interval keeps writing charX toward its
  // stale target and fires its done() mid-walk, hijacking the new walk.
  function walkPose(elapsed, ws) {
    var p = basePose();
    var d = ws.speed * elapsed;                    // px travelled along dir
    var total = Math.abs(ws.toX - ws.fromX);
    if (d > total) d = total;
    var step = ws.stepPx;                          // 30 walk / 22 carry
    var u = d % step;                              // px into current step
    var stepIdx = Math.floor(d / step);
    var stepFrac = u / step;
    // Bob (SPECIALIST §3 phasing, AMPLIFIED 2026-11-27 from the pixel-walk
    // study — 8-frame classic: contact / DOWN / passing / UP):
    // contact +6 -> DOWN +13 (hips lowest, front knee absorbs the weight) ->
    // passing -3 (rising) -> UP -11 (push-off, hips highest) -> contact +6.
    // The old +8/-8 bob could not flex the knee: the IK leg was always at
    // max reach (490 = hip->ankle vertical), so the leg was a straight stick
    // pivoting at the hip and the walk read as sliding. The +13 down-dip
    // shortens hip->ankle to ~427, so the knee genuinely flexes ~20deg and
    // the thigh leans ~17deg off vertical at DOWN; at PASSING the support
    // leg is straight again (vertical ~505, clamped to max reach).
    // CONTACT DIP +8 (2026-11-27, gap 1): the wide stride (76) needs
    // horizontal reach 185 composite at contact; with hips at idle height
    // (vertical 490) the leg (maxD 490 = 505-15, see solveIK) can only reach
    // 122 composite, so the ankle would clamp short and the boot hover.
    // Dipping the hips 8px at contact shortens the vertical to ~451, so
    // D = sqrt(451^2+185^2) = 488 < 490 and the 76px stride lands clean.
    // Keyframes at u fractions: 0 -> +8, 8/30 -> +13, 15/30 -> -3, 23/30 -> -11, 30 -> +8.
    var bobKeys = [[0, 8], [0.267, 13], [0.5, -3], [0.767, -11], [1, 8]];
    var bob = 0;
    for (var i = 0; i < bobKeys.length - 1; i++) {
      if (stepFrac >= bobKeys[i][0] && stepFrac <= bobKeys[i + 1][0]) {
        var f = (stepFrac - bobKeys[i][0]) / (bobKeys[i + 1][0] - bobKeys[i][0]);
        bob = lerp(bobKeys[i][1], bobKeys[i + 1][1], f);
        break;
      }
    }
    if (ws.carrying) bob *= 0.7;               // loaded: less bounce, more weight
    if (reducedMotion) bob = 0;
    var bobC = bob / SCALE;                        // composite px
    var hipX = 810, hipY = IK_HIPS_Y + bobC;
    // Foot world positions (screen coords, facing coords: dir folded in).
    // Planted foot: fixed in world during the step.
    var q0 = ws.fromX + ws.dir * (Math.floor(d / step) * step); // hip screen x at step start
    var plantedX = q0 + ws.dir * (step / 2);
    var swingFromX = q0 - ws.dir * (step / 2);
    var swingToX = q0 + ws.dir * (step * 1.5);
    var e = stepFrac * stepFrac * (3 - 2 * stepFrac); // smoothstep
    var swingX = lerp(swingFromX, swingToX, e);
    // Foot lift: 34px walk / 22px carry (was 22 / 12 — the v6 lift left the
    // swing boot tangled with the planted boot through most of the stride:
    // the boots are 57px long, so while the swing foot passes the planted
    // foot (stepFrac ~0.3-0.7) the feet are horizontally overlapping and
    // ONLY vertical clearance separates them. At 22px lift the toe-down
    // boot (37px vertical extent) still overlapped the planted boot by
    // ~8px, so the two boots read as one dark mass at any random moment
    // between the four designed phases. 34px clears it with margin (see
    // the swing-boot angle profile below). 22px when carrying: a loaded
    // foot does not lift high, but it must still clear.
    var lift = Math.sin(stepFrac * Math.PI) * (ws.carrying ? 22 : 34);
    if (reducedMotion) lift *= 0.4;
    // Which leg is planted alternates each step.
    var plantedIsNear = (stepIdx % 2 === 0);
    var feet = {
      near: plantedIsNear ? { x: plantedX, y: GROUND_Y, planted: true }
                          : { x: swingX, y: GROUND_Y - lift, planted: false },
      far: plantedIsNear ? { x: swingX, y: GROUND_Y - lift, planted: false }
                         : { x: plantedX, y: GROUND_Y, planted: true }
    };
    // Convert to local composite coords (facing +x).
    function toLocal(fx, fy) {
      return { x: 800 + ws.dir * (fx - charX) / SCALE, y: 1850 + (fy - GROUND_Y) / SCALE };
    }
    var hipLocal = { x: hipX, y: hipY };
    var legs = {};
    ['near', 'far'].forEach(function (side) {
      var f = feet[side];
      var fl = toLocal(f.x, f.y);
      // Ankle sits 70 composite behind the ball of the foot, 130 above ground.
      var ankle = { x: fl.x - 70, y: 1720 + (f.y - GROUND_Y) / SCALE };
      var ik = solveIK(hipLocal, ankle, THIGH_LEN, SHIN_LEN);
      // Bind angles: thigh bind hip->knee ~88.3deg (side), shin bind knee->ankle ~90deg.
      var thighBind = Math.atan2(1560 - 1215, 830 - 820) / DEG;
      var shinBind = Math.atan2(1720 - 1560, 830 - 830) / DEG;
      // Boot rotation is ABSOLUTE (the boot bone matrix rotates about the
      // ankle in composite space, it does not compose with the leg chain).
      // SWING BOOT ANGLE PROFILE (2026-11-27, gap 2 — the v7 dense sweep):
      // the old constant 40deg toe-down made the swing boot a 37px-tall
      // diagonal slash (57px * sin40), so even at 22px lift its toe hung
      // below the planted boot's top while the feet overlapped
      // horizontally — one dark mass at any random moment. Now the boot is
      // FLAT through the pass (12deg walk / 8deg carry, vertical extent
      // 12px / 8px) and only points toe-down at push-off and landing
      // (40deg at stepFrac 0 / 1, m^2 profile so the transition is smooth).
      // With 34px lift the toe clears the planted boot by 12-29px through
      // the whole pass; at landing the feet are 71px apart horizontally,
      // so the toe-down angle there cannot tangle them.
      var upBump = Math.exp(-Math.pow((stepFrac - 0.767) / 0.18, 2));
      var passA = ws.carrying ? 8 : 12;
      var m = Math.abs(stepFrac - 0.5) * 2;
      var swingBootA = passA + (40 - passA) * m * m;
      var bootWorld = f.planted ? upBump * 28 : swingBootA;
      legs[side] = {
        thighA: ik.thighA - thighBind, shinA: ik.shinA - shinBind,
        bootA: bootWorld,
        hip: hipLocal, knee: ik.knee, ankle: ik.ankle, foot: f
      };
    });
    // Arms swing opposite legs, +-34deg (was 20 — the old swing moved the
    // hand ~50px; 34deg moves it ~90px, widest at CONTACT, passing close to
    // the body at PASSING, exactly the classic phasing), 1-2f lag.
    // At contact the near leg is planted ahead, so the near arm is BACK (+).
    var cyc = (d / (step * 2)) * 2 * Math.PI;
    var swing = ws.carrying ? 0 : 34;
    p.ang.shoulder_N = Math.cos(cyc) * swing;
    p.ang.shoulder_F = -Math.cos(cyc) * swing * 0.7;
    // Elbow stays gently bent (14deg +- 8, was 32 +- 10) so the arm reads
    // as a swinging arm with a natural kink, never as one straight plank.
    // THE 32deg BIAS WAS THE STIFF-ARM BUG (2026-11-27, gap 1 — the v7
    // dense sweep + the owner's phone frame): the forearm's world angle is
    // shoulder + elbow, so with a 32deg elbow bias the forearm ranged
    // [-2deg, +66deg] — it never swung BACK. At the back of the swing
    // (shoulder -34) the forearm sat at ~0deg, i.e. vertical, the upper
    // arm hid behind the torso, and the near arm read as a straight rod
    // hanging down while the far arm swung clearly. With a 14deg bias the
    // forearm ranges [-21deg, +49deg]: a visible back swing AND a visible
    // forward swing, and the arm never reads as a hanging rod. The far
    // elbow is untouched — the far arm already reads as a clear swing.
    p.ang.elbow_N = 14 + Math.sin(cyc) * 8;
    p.ang.elbow_F = 32 - Math.sin(cyc) * 10;
    if (ws.carrying) {
      // Carry: elbows bent, stack clutched to the chest. The old pose
      // (shoulder -35 / elbow -78) held the arm nearly straight forward, so
      // the wrist sat ~132px screen ahead of the body and the book slid
      // behind the right-rail circles. shoulder -12 / elbow -125 puts the
      // near wrist ~83px ahead of the body centre at chest height; the stack
      // (centre 31px screen behind the wrist, see GRASP_DX) then sits ~52px
      // ahead of the chest, its far edge ~66px clear of the rail (x>=338).
      p.ang.shoulder_N = -12; p.ang.elbow_N = -125;
      p.ang.shoulder_F = -10; p.ang.elbow_F = -115;
    }
    p.ang.chest = ws.carrying ? 8 : 3;         // carry: lean back 8deg under the load
    p.ang.head = -2;
    // Secondary motion (rig v2, AMPLIFIED 2026-11-27) — a body, not a sliding cutout:
    // hips sway with the stride, chest counter-rotates, head stabilises
    // against the chest, and the whole body squashes at foot contact and
    // stretches at the passing step (volume-preserving, about the ground).
    // Squash 4.5% / stretch 3% (was 3% / 2%): the 64px-sprite band is 3-6%,
    // and Celeste's rule is that the deformation is aggressive but lasts
    // only a frame or two — ours peaks exactly at contact / passing.
    var sway = Math.sin(cyc);
    p.ang.hips = sway * 8;
    p.ang.chest = (ws.carrying ? 8 : 3) - sway * 6;
    p.ang.head = -2 - sway * 3;
    var sq = Math.sin(stepFrac * Math.PI);            // 0 contact, 1 passing
    var ct = Math.cos(stepFrac * Math.PI);
    p.scaleY = 1 + 0.03 * sq - 0.045 * ct * ct;
    p.scaleX = 1 - (p.scaleY - 1) * 0.7;
    // Backhair is a child of root: give it a lagged sway so it never
    // floats in mid-air where the head used to be (bend) or lags the body.
    // Follow-through: hair trails the body by ~1/6 cycle (phase -0.6) and
    // overshoots 8deg (was 4); the braid lags further, 14deg (was 8).
    p.ang.backhair = Math.sin(cyc - 0.6) * 8;
    p.hipsDy = bobC;
    p.braidA = Math.sin(cyc - 0.6) * (ws.carrying ? 8 : 14);
    p._legs = legs; p._hipY = hipY;
    // Sprite frame (side-view sprite set): 8-frame walk, phase from stepFrac
    // (bob keyframes at 0 / 0.267 / 0.5 / 0.767 / 1), lead from the planted
    // leg. The sprite is drawn undeformed — never scaled by pose.scaleX/Y.
    var ph;
    if (stepFrac < 0.1335 || stepFrac >= 0.8835) ph = 0;      // contact
    else if (stepFrac < 0.3835) ph = 1;                        // down
    else if (stepFrac < 0.6335) ph = 2;                        // passing
    else ph = 3;                                               // up
    p.spriteWalk = { lead: plantedIsNear ? 'R' : 'L', phase: ph };
    return p;
  }

  // ---------------- drawing ----------------
  // Character drawing is mesh-based now (drawMesh in the skinning section
  // above). The old rigid drawPart / drawPartAt are gone: no part is ever
  // rotated as a rigid image any more.

  function renderFront(pose) {
    var world = solveFK(BONES_F, ORDER_F, pose);
    // headDy (breathing) is a draw-time offset on the head only — apply it to
    // the head bone's world position before building matrices (the braids were
    // already solved from the unshifted head, exactly as before).
    if (pose.headDy) world.head.y += pose.headDy;
    if (pose.headDx) world.head.x += pose.headDx;
    var mats = buildBoneMats(BONES_F, world, pose, null);
    var face = pose.face || 'head';
    if (faceOverride && Date.now() < faceOverride.until) face = faceOverride.face;
    else if (faceOverride) faceOverride = null;
    var handL = pose.handL || 'open', handR = pose.handR || 'open';
    var arms = pose.swapArms;
    function armSet(first) {
      if (first === 'R') {
        drawMesh('upperarm_R', IMG.upperarm_R, mats);
        drawMesh('forearm_R', IMG.forearm_R, mats);
        drawMesh('hand_R', IMG['hand_' + handR + '_R'], mats);
      } else {
        drawMesh('upperarm_L', IMG.upperarm_L, mats);
        drawMesh('forearm_L', IMG.forearm_L, mats);
        drawMesh('hand_L', IMG['hand_' + handL + '_L'], mats);
      }
    }
    // RIG-DATA §4 corrected draw order: backhair -> R leg -> L leg -> torso ->
    // R arm -> L arm -> braids -> head -> blush -> book. Same order as the old
    // rigid renderer; only the drawing primitive changed (mesh, not rotated part).
    drawMesh('backhair', IMG.backhair, mats);
    drawMesh('thigh_R', IMG.thigh_R, mats);
    drawMesh('shin_R', IMG.shin_R, mats);
    drawMesh('boot_R', IMG.boot_R, mats);
    drawMesh('thigh_L', IMG.thigh_L, mats);
    drawMesh('shin_L', IMG.shin_L, mats);
    drawMesh('boot_L', IMG.boot_L, mats);
    // One torso mesh (torso_mesh.png = the current split art composited):
    // its rows blend hips<->spine<->chest, so a bend is a smooth curve.
    drawMesh('torso', IMG.torso_mesh, mats);
    drawEquipped('outfit', world, mats);
    if (arms) { armSet('L'); armSet('R'); } else { armSet('R'); armSet('L'); }
    drawMesh('braid_upper_R', IMG.braid_upper_R, mats);
    drawMesh('braid_lower_R', IMG.braid_lower_R, mats);
    drawMesh('braid_upper_L', IMG.braid_upper_L, mats);
    drawMesh('braid_lower_L', IMG.braid_lower_L, mats);
    drawEquipped('braid', world, mats);
    drawMesh('head', IMG[face] || IMG.head, mats);
    drawMesh('blush', IMG.blush, mats);
    drawEquipped('head', world, mats);
    drawEquipped('neck', world, mats);
    if (carriedBook) drawCarriedStack(world.wrist_N || world.wrist_L, world.chest.a);
    handWorld = { x: world.wrist_L.x, y: world.wrist_L.y, a: world.wrist_L.a };
    return world;
  }

  function renderSide(pose) {
    var world = solveFK(BONES_S, ORDER_S, pose);
    if (pose.headDy) world.head.y += pose.headDy;
    if (pose.headDx) world.head.x += pose.headDx;
    var legs = pose._legs;
    var mats = buildBoneMats(BONES_S, world, pose, legs);
    // far leg (IK), far arm, torso, near leg (IK), near arm, braid, head.
    // Legs are drawn unconditionally now: without _legs they fall back to
    // their FK bind pose instead of vanishing.
    drawMesh('side_backhair', IMG.side_backhair, mats);
    drawMesh('side_thigh_far', IMG.side_thigh_far, mats);
    drawMesh('side_shin_far', IMG.side_shin_far, mats);
    drawMesh('side_boot_far', IMG.side_boot_far, mats);
    drawMesh('side_upperarm_far', IMG.side_upperarm_far, mats);
    drawMesh('side_forearm_far', IMG.side_forearm_far, mats);
    drawMesh('side_hand_far', IMG.side_hand_open_far, mats);
    drawMesh('side_torso', IMG.side_torso_mesh, mats);
    drawMesh('side_thigh', IMG.side_thigh, mats);
    drawMesh('side_shin', IMG.side_shin, mats);
    drawMesh('side_boot', IMG.side_boot, mats);
    drawMesh('side_upperarm', IMG.side_upperarm, mats);
    drawMesh('side_forearm', IMG.side_forearm, mats);
    drawMesh('side_hand', IMG.side_hand_open, mats);
    drawMesh('side_braid', IMG.side_braid, mats);
    drawMesh('side_head', IMG.side_head, mats);
    if (carriedBook) drawCarriedStack(world.wrist_N, world.chest.a);
    handWorld = { x: world.wrist_N.x, y: world.wrist_N.y, a: world.wrist_N.a };
    return world;
  }

  // Carried object: THE stack that fell (assets/props/books.png), not the
  // single pink book (parts/book.png) — one object through fall, lie, carry
  // and put-back, so nothing pops or swaps mid-sequence.
  // Drawn at the shelf stack's on-screen size (50x30 screen = 243x146
  // composite). GRASP_OFFSET centres the stack behind-below the wrist in
  // facing coords: measured at the grasp frame, the wrist sits at screen
  // (104,539) while the lying stack's centre is (135,555) — +31px right,
  // +16px down on screen = -151/+78 composite in facing coords. With that
  // offset the carried stack lands exactly on the lying stack at the grasp
  // frame (zero jump when the DOM stack hides), and during the carry it
  // sits between the hands and the chest instead of out at arm's length.
  var STACK_W = 243, STACK_H = 146;   // composite px (= 50x30 screen)
  var GRASP_DX = -151, GRASP_DY = 78; // facing coords, behind-below wrist
  function drawCarriedStack(wrist, chestA) {
    if (!IMG.booksStack || !wrist) return;
    ctx.save();
    ctx.translate(wrist.x + GRASP_DX, wrist.y + GRASP_DY);
    ctx.rotate(Math.round((chestA || 0) * 0.25) * DEG);
    ctx.drawImage(IMG.booksStack, -STACK_W / 2, -STACK_H / 2, STACK_W, STACK_H);
    ctx.restore();
  }

  // Equipped shop items drawn on the character (front view; side view: head items only).
  var EQUIP_DRAW = {
    head: {
      starclip: [{ x: 700, y: 200, s: 130 }, { x: 905, y: 200, s: 130 }],
      beanie: [{ x: 800, y: 150, s: 420 }],
      glasses: [{ x: 800, y: 345, s: 330 }],
      crown: [{ x: 800, y: 70, s: 280 }],
      flowercrown: [{ x: 800, y: 95, s: 380 }],
      catears: [{ x: 800, y: 60, s: 320 }],
      bunnyears: [{ x: 800, y: 45, s: 330 }],
      sleepmask: [{ x: 800, y: 345, s: 320 }]
    },
    neck: {
      bowtie: [{ x: 800, y: 580, s: 130 }],
      scarf: [{ x: 800, y: 640, s: 300 }],
      necklacePearl: [{ x: 800, y: 660, s: 180 }],
      necklaceGold: [{ x: 800, y: 660, s: 180 }]
    },
    braid: {
      ribbonBlue: [{ x: 660, y: 520, s: 100 }, { x: 940, y: 520, s: 100 }],
      bow: [{ x: 660, y: 500, s: 110 }, { x: 940, y: 500, s: 110 }],
      starties: [{ x: 660, y: 470, s: 90 }, { x: 940, y: 470, s: 90 }],
      bell: [{ x: 660, y: 690, s: 80 }, { x: 940, y: 690, s: 80 }]
    },
    outfit: {
      apron: [{ x: 800, y: 950, s: 520 }],
      sailor: [{ x: 800, y: 700, s: 420 }],
      vest: [{ x: 800, y: 900, s: 480 }],
      cape: [{ x: 800, y: 800, s: 560 }]
    }
  };
  // Equipped shop items ride their bone: the item's bind-pose centre is
  // transformed by the bone matrix and the item rotates with the bone, so a
  // starclip stays on the hair and an apron stays on the torso through a bend.
  // (The old code drew them at fixed composite positions, so they floated off
  // the body whenever it moved.) Braid items: first position = left braid,
  // second = right braid.
  function drawEquipped(slot, world, mats) {
    var id = gear[slot];
    if (!id || !EQUIP_DRAW[slot] || !EQUIP_DRAW[slot][id]) return;
    var im = ITEM_IMG[id];
    if (!im) return;
    EQUIP_DRAW[slot][id].forEach(function (d, idx) {
      var bone = slot === 'head' ? 'head' : slot === 'neck' ? 'neck' :
                 slot === 'outfit' ? 'chest' :
                 slot === 'braid' ? (idx === 0 ? 'braidUL' : 'braidUR') : null;
      if (!bone || !mats || !mats[bone] || !world || !world[bone]) {
        ctx.drawImage(im, d.x - d.s / 2, d.y - d.s / 2, d.s, d.s);
        return;
      }
      var M = mats[bone];
      var cx = M[0] * d.x + M[2] * d.y + M[4];
      var cy = M[1] * d.x + M[3] * d.y + M[5];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.round(world[bone].a) * DEG);
      ctx.drawImage(im, -d.s / 2, -d.s / 2, d.s, d.s);
      ctx.restore();
    });
  }
  function loadItemImage(id, file) {
    if (ITEM_IMG[id]) return Promise.resolve();
    return loadImg('assets/items/' + file).then(function (im) { ITEM_IMG[id] = im; });
  }

  // ---------------- sleep ----------------
  function renderSleep(t) {
    // GEMINI 2026-11-28: no sleep (lying) image exists, so sleep reuses
    // the blink sprite — she stands with her eyes closed under the DOM
    // sleep veil + Zzz (game.js toggleSleep). The pixel lying figure
    // (IMG.sleep_lying) is retired; drawing it would show the old pixel
    // character. No breathing scale: a flat sprite must not squash.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var im = SPR['gemini-blink'];
    if (im) {
      frontSpriteTransform();
      ctx.drawImage(im, 0, 0);
    }
  }

  // ---------------- main loop ----------------
  // Per-set transform for the 1930-tall front sprite sets (idle + sit):
  // SCALE_FRONT with source (800,1930) anchored at (charX, groundY).
  // The mesh / side / upset draws keep the global SCALE/1850 transform
  // — do not "simplify" this into the base transform.
  function frontSpriteTransform() {
    ctx.setTransform(dpr * SCALE_FRONT, 0, 0, dpr * SCALE_FRONT,
      dpr * charX - dpr * SCALE_FRONT * 800,
      dpr * groundY - dpr * SCALE_FRONT * 1930);
  }

  var t0 = performance.now();
  var lastFrame = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (now - lastFrame < 16) return; // cap ~60fps
    lastFrame = now;
    if (!ctx) return;
    var t = (now - t0) / 1000;
    stepHeadSpring(now); // head spring: integrate every frame (decays to 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    // Clip all character drawing to the canvas (room) bounds: no part may
    // poke below the floor — in the deep squat the far shin overshoots the
    // boot by ~20px and its end is cut by the room edge (fix round 3).
    // The clip is set in device space, so later setTransform calls keep it.
    // Nothing legitimate is drawn outside the canvas: rug/floor are DOM.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.clip();
    // Base transform: composite -> screen, origin at (charX, groundY).
    ctx.setTransform(dpr * SCALE, 0, 0, dpr * SCALE, dpr * charX - dpr * SCALE * 800, dpr * groundY - dpr * SCALE * 1850);
    var pose;
    if (sleeping) {
      renderSleep(t);
      lastRender = { mode: 'sleep', charX: charX, face: 'head_sleep' };
      ctx.restore(); // release the room-bounds clip
      return;
    }
    if (anim) {
      var el = (now - anim.t0) / 1000;
      var t01 = Math.min(1, el / anim.dur);
      if (anim.sample) pose = anim.sample(t01, el);
      else pose = basePose();
      if (t01 >= 1) {
        var done = anim.done, hold = anim.hold;
        anim = null; busy = false;
        if (hold) holdPose = hold;
        if (done) done();
      }
    } else if (holdPose) {
      pose = holdPose;
    } else if (mode === 'side' && walkState) {
      pose = walkPose((now - walkState.t0) / 1000, walkState);
    } else {
      pose = idlePose(t);
    }
    if (!pose) pose = idlePose(t);
    // Head spring: apply the wobble on top of the pose's head. Clone so
    // a shared holdPose is never mutated in place.
    if (headSpringActive()) {
      var sp = {}, sk;
      for (sk in pose) sp[sk] = pose[sk];
      sp.ang = {};
      for (sk in (pose.ang || {})) sp.ang[sk] = pose.ang[sk];
      sp.ang.head = (sp.ang.head || 0) + headSpring.angle * 57.29578;
      sp.headDy = (sp.headDy || 0) + headSpring.dy;
      sp.headDx = (sp.headDx || 0) + headSpring.dx;
      pose = sp;
    }
    // Whole-body squash/stretch about the ground point.
    if (pose.scaleX !== 1 || pose.scaleY !== 1) {
      ctx.setTransform(dpr * SCALE * (pose.scaleX || 1), 0, 0, dpr * SCALE * (pose.scaleY || 1),
        dpr * charX - dpr * SCALE * (pose.scaleX || 1) * 800,
        dpr * groundY - dpr * SCALE * (pose.scaleY || 1) * 1850);
    }
    // GEMINI 2026-11-28: lastRender.face must name the SPRITE shown
    // (idle/blink/tilt/happy/sit), not the mesh pose face — the harness
    // reads it to tell which Gemini state is on screen.
    var shownFace = pose.face || 'head';
    if (mode === 'side') {
      var spr = spriteFor(pose, walkState, anim);
      if (spr) {
        // Sprite path: reset to the BASE transform (no pose squash/scale —
        // a sprite is never deformed on canvas) then the facing flip.
        ctx.setTransform(dpr * SCALE, 0, 0, dpr * SCALE, dpr * charX - dpr * SCALE * 800, dpr * groundY - dpr * SCALE * 1850);
        if (facing === -1) { ctx.translate(800, 0); ctx.scale(-1, 1); ctx.translate(-800, 0); }
        ctx.drawImage(spr, 0, 0);
      } else {
        if (facing === -1) { ctx.translate(800, 0); ctx.scale(-1, 1); ctx.translate(-800, 0); }
        renderSide(pose);
      }
    } else {
      // UPSET (front, rebuild round 3 FIX 6): when the pose carries
      // spriteUpset (upset anim or its holdPose), draw the front upset
      // sprite undeformed — it takes priority over the idle sprite AND
      // the mesh, and it is what keeps the hold frame on screen after
      // the anim ends. frontIdleSprite() already returns null during
      // any anim/hold, so this cannot fight the idle path.
      var uspr = (pose && typeof pose.spriteUpset === 'number')
        ? SPR['upset-f-' + pose.spriteUpset] : null;
      if (uspr) {
        // Sprite path: reset to the BASE transform (no pose squash/scale —
        // a sprite is never deformed on canvas), exactly like the side
        // sprite path above. No facing flip in front view.
        ctx.setTransform(dpr * SCALE, 0, 0, dpr * SCALE, dpr * charX - dpr * SCALE * 800, dpr * groundY - dpr * SCALE * 1850);
        ctx.drawImage(uspr, 0, 0);
      } else {
        // SIT (front, rebuild round 4): when sitting, draw the pixel-grid
        // front-sit sprite undeformed — it takes priority over the idle
        // sprite, and the mesh sit stays only as the fallback when the
        // sprite is missing (e.g. a load failure) or a guard blocks it
        // (dancing, gear, faceOverride). frontIdleSprite() already returns
        // null while sitting, so this cannot fight the idle path.
        var sspr = frontSitSprite(t);
        if (sspr) {
          // Sprite path: reset to the per-set FRONT transform (1930-tall
          // sit PNGs, SCALE_FRONT/1930 — no pose squash/scale, a sprite
          // is never deformed on canvas), exactly like the side sprite
          // path above. No facing flip in front view.
          frontSpriteTransform();
          ctx.drawImage(sspr, 0, 0);
          shownFace = 'head_closed'; // GEMINI: the sit image has her eyes closed
        } else {
          // HOME IDLE (front): draw the pixel-grid front-idle sprite
          // undeformed when frontIdleSprite() has one (no anim / hold / walk,
          // no sitting/dancing/faceOverride/gear). ALL other front poses
          // (happy/eat/bath/look/glare, fidgets, weight shift) keep the mesh
          // renderFront — untouched.
          var fspr = frontIdleSprite(t);
          if (fspr) {
            // Sprite path: reset to the per-set FRONT transform (1930-tall
            // idle PNGs, SCALE_FRONT/1930 — no pose squash/scale, a sprite
            // is never deformed on canvas), exactly like the side sprite
            // path above. No facing flip in front view.
            frontSpriteTransform();
            ctx.drawImage(fspr, 0, 0);
            // GEMINI: name the shown sprite for lastRender.
            if (fspr === SPR['gemini-happy']) shownFace = 'head_happy';
            else if (fspr === SPR['gemini-blink']) shownFace = 'head_closed';
            else if (fspr === SPR['gemini-tilt']) shownFace = 'head_tilt';
            else shownFace = 'head';
          } else {
            renderFront(pose);
          }
        }
      }
    }
    lastRender = { mode: mode, charX: charX, face: shownFace };
    ctx.restore(); // release the room-bounds clip
  }

  function runAnim(animDef, done) {
    anim = { t0: performance.now(), dur: animDef.dur, sample: animDef.sample, done: done || null, hold: animDef.hold || null };
    busy = true;
  }
  function clearHold() { holdPose = null; }

  // ---------------- public actions ----------------
  function walkTo(targetX, opts, done) {
    opts = opts || {};
    var speed = opts.carrying ? 45 : 60;      // px/s (derived from cycle)
    var stepPx = opts.carrying ? 57 : 76;     // WIDENED 2026-11-27 (gap 1):
    // the side boot is 57 screen px long (279 composite), so a 40px stride
    // overlaps the boots by 17px at Contact and 28px at Up — one dark mass.
    // Measured gap: Contact = s - 54.1, Up = 0.724*s - 48.9 (toe-down
    // foreshortening). s=76 gives Contact +22px, Up +6px: separated at
    // every phase. The 40->48 proposal was measured and REJECTED (still
    // merged: Contact -6, Up -14). 76 needs the +8 contact dip in the bob
    // or the IK clamps (see walkPose). Carry keeps the 3:4 ratio (57).
    // Speed unchanged for now: 1.27s/step walk and carry (was 0.67s) — a
    // slower, longer stride; judge the motion by eye before touching speed.
    var dist = Math.abs(targetX - charX);
    if (dist < 4) { if (done) done(); return; }
    if (walkCheck) { clearInterval(walkCheck); walkCheck = null; }
    mode = 'side';
    facing = targetX >= charX ? 1 : -1;
    clearHold();
    var ws = { fromX: charX, toX: targetX, dir: facing, speed: speed, stepPx: stepPx,
      carrying: !!opts.carrying, t0: performance.now(), dur: dist / speed };
    walkState = ws;
    busy = true;
    var check = setInterval(function () {
      var el = (performance.now() - ws.t0) / 1000;
      charX = ws.fromX + ws.dir * Math.min(el * speed, dist);
      if (el * speed >= dist) {
        clearInterval(check);
        if (walkCheck === check) walkCheck = null;
        charX = targetX;
        walkState = null; busy = false;
        mode = 'front';
        if (done) done();
      }
    }, 16);
    walkCheck = check;
  }

  function bendPickup(bookScreen, done, onGrasp) {
    // Side-view bend + reach + pick-up, ~2.0s (SPECIALIST §3).
    // FIX 5 (b): the DOM #falling-book is hidden HERE, at bend entry —
    // the frame-drawn stack (bend-1..4) is the only stack from the first
    // fold frame, so the two stacks never coexist on screen. onGrasp
    // fires once at the hand-close moment (t=0.45) for the bubble swap
    // to the pick-up line only; it no longer hides anything.
    mode = 'side';
    facing = bookScreen.x < charX ? -1 : 1;
    var fb0 = document.getElementById('falling-book');
    if (fb0) fb0.style.display = 'none';
    clearHold();
    var keys = [
      { t: 0.00, v: { face: 'head', ang: {} }, e: 'lin' },
      { t: 0.10, v: { face: 'head', ang: { head: -8, chest: 4 }, hipsDy: 12 }, e: 'out' },       // anticipation
      // Deep bend, RE-AUTHORED for the mesh rig (2026-11-27) and DEEPENED
      // 2026-11-27 (pixel revert, from the walk-cycle study): the bend is
      // designed as ANTICIPATION -> FOLD -> GRASP HOLD -> HAIR-BACK -> RISE
      // -> SETTLE. The fold is now 80deg (spine 40 + chest 40, was 70) with
      // a 205 squat (was 180), so the head drops to the book and the knees
      // flex ~27deg; the GRASP is a 200ms hold (a pose meant to be read
      // stays >= 83ms). The arm is re-solved by 2-bone IK for this torso:
      // shoulder_N -47, elbow_N -47 puts the wrist on the book (screen
      // 97,529 — verified by FK, same grasp point as the old keys) — the
      // arm angles are UNCHANGED by the deepening, so the grasp cannot miss.
      // Head -14 (was -10) looks down at the book. Far arm counter-rotates
      // to hang down (shoulder_F -60) instead of sticking out with the
      // pitched chest. Backhair 55 with a large Dy/Dx drapes the hair down
      // from the bowed head.
      { t: 0.35, v: { face: 'head', ang: { spine: 40, chest: 40, head: -14, shoulder_N: -47, elbow_N: -47, shoulder_F: -60, elbow_F: -10, backhair: 0 }, hipsDy: 205, backhairDy: 650, backhairDx: 650 }, e: 'in' }, // bend
      { t: 0.45, v: { face: 'head', handL: 'holding', handR: 'holding', ang: { spine: 40, chest: 40, head: -14, shoulder_N: -47, elbow_N: -47, shoulder_F: -60, elbow_F: -10, backhair: 0 }, hipsDy: 205, backhairDy: 650, backhairDx: 650 }, e: 'lin' }, // grasp
      // RIG: hair snap-back — the drape offset (650,650) is in world coords, so
      // if it lingers while the head returns upright it reads as a horizontal
      // pink slab sticking out in front of the face (mesh-bend-b.png). The hair
      // must swing back onto the head right after the grasp, while the head is
      // still bowed (so the return is masked by the pitch), not trail behind it.
      { t: 0.55, v: { face: 'head', handL: 'holding', handR: 'holding', ang: { spine: 36, chest: 36, head: -12, shoulder_N: -40, elbow_N: -60, shoulder_F: -50, elbow_F: -30, backhair: 0 }, hipsDy: 185, backhairDy: 120, backhairDx: 120 }, e: 'out' }, // hair back
      { t: 0.80, v: { face: 'head', handL: 'holding', handR: 'holding', ang: { spine: 6, chest: 8, head: -4, shoulder_N: -12, elbow_N: -125, shoulder_F: -10, elbow_F: -115 }, hipsDy: 10, backhairDy: 0, backhairDx: 0 }, e: 'out' },  // rise, stack to chest (same angles as the carry walk — no snap)
      { t: 1.00, v: { face: 'head', handL: 'holding', handR: 'holding', ang: { spine: 2, chest: 6, head: 0, shoulder_N: -12, elbow_N: -125, shoulder_F: -10, elbow_F: -115 }, hipsDy: 0 }, e: 'out' }   // settle
    ];
    // During the bend the feet stay planted: emulate with a static walk pose
    // (legs at contact, hips lowered by hipsDy via the FK hips offset).
    var graspFired = false;
    runAnim({ dur: 2.0, sample: function (t01) {
      var p = sampleKeys(keys, t01);
      // Sprite frame (side-view sprite set): 6 bend frames keyed to the
      // anim phases — anticipation 0, fold 1, grasp hold 2, hair-back 3,
      // rise 4, settle 5. The sprite is drawn undeformed.
      var bf;
      if (t01 < 0.10) bf = 0;
      else if (t01 < 0.35) bf = 1;
      else if (t01 < 0.45) bf = 2;
      else if (t01 < 0.55) bf = 3;
      else if (t01 < 0.80) bf = 4;
      else bf = 5;
      p.spriteBend = bf;
      // Keep side legs planted: fake a zero-step walk pose for the legs.
      // stepPx 76: same stance as the walk's Contact, so the feet do not
      // jump when the walk ends and the bend begins.
      var ws = { fromX: charX, toX: charX, dir: facing, speed: 60, stepPx: 76, carrying: false, t0: performance.now(), dur: 1 };
      var wp = walkPose(0, ws);
      p._legs = wp._legs;
      p._hipY = wp._hipY;
      // Bend lowers hips: shift leg hip target down by hipsDy.
      if (p.hipsDy) {
        var hipY = IK_HIPS_Y + p.hipsDy;
        ['near', 'far'].forEach(function (side) {
          var leg = p._legs[side];
          var H = { x: 810, y: hipY };
          var ik = solveIK(H, leg.ankle, THIGH_LEN, SHIN_LEN);
          var thighBind = Math.atan2(1560 - 1215, 830 - 820) / DEG;
          var shinBind = 90;
          leg.knee = ik.knee;
          leg.thighA = ik.thighA - thighBind;
          leg.shinA = ik.shinA - shinBind;
          leg.bootA = 0; // absolute: sole flat on the floor
        });
      }
      if (t01 >= 0.45) {
        carriedBook = true;
        if (!graspFired) { graspFired = true; if (onGrasp) onGrasp(); }
      }
      return p;
    }, hold: null }, function () {
      mode = 'front';
      if (done) done();
    });
  }

  function putBackBook(done, onPlace) {
    // Side-view put-back, ~1.6s (FIX 5 (g), see
    // build-scripts/putback_frames.py): HOLD (books clutched, facing the
    // shelf) -> RAISE (both hands lift the stack to shelf height) ->
    // PLACE (hands on the shelf wood, book touching the shelf) -> LOWER
    // (hands empty, stepping back). She faces the shelf (left, facing -1)
    // at x~120; the frames are drawn facing right and the whole frame is
    // flipped by the sprite path. The frame-drawn stack IS the shelf
    // stack (same palette, same size, same place on the shelf wood), so
    // onPlace fires exactly when frame 2 (place) begins — the caller
    // shows #p-books there and NOT before, and the frame book and the
    // DOM books never coexist. carriedBook clears at the place moment.
    mode = 'side';
    facing = -1;
    clearHold();
    var placeFired = false;
    runAnim({ dur: 1.6, sample: function (t01) {
      var p = { face: 'head', ang: {}, scaleX: 1, scaleY: 1 };
      var pf;
      if (t01 < 0.20) pf = 0;
      else if (t01 < 0.45) pf = 1;
      else if (t01 < 0.75) pf = 2;
      else pf = 3;
      p.spritePutback = pf;
      // Feet stay planted like the bend: static walk pose for the legs
      // (only used if the sprite is missing and the mesh falls back).
      var ws = { fromX: charX, toX: charX, dir: facing, speed: 60, stepPx: 76, carrying: false, t0: performance.now(), dur: 1 };
      var wp = walkPose(0, ws);
      p._legs = wp._legs;
      p._hipY = wp._hipY;
      if (pf >= 2 && !placeFired) {
        placeFired = true;
        carriedBook = false;
        if (onPlace) onPlace();
      }
      return p;
    }, hold: null }, function () {
      mode = 'front';
      if (done) done();
    });
  }

  function upsetPose(done) {
    // ~2.4s, DESIGNED 2026-11-27 (pixel revert, from the animation study):
    // TURN -> CROSS -> STOMP WIND-UP -> STOMP LAND -> TURN-AWAY HOLD.
    // The mood arrives first (frown + head drop), the body follows; the
    // STOMP is the accent — the leg cocks up, the body squashes 7%, the
    // foot plants on a beat and the impact frame is held >= 83ms; the final
    // hold must read as "upset" in a SINGLE still frame (chin down -26,
    // chest hunched 14, turned away -22, arms crossed tight inside the
    // silhouette). Ends in a hold.
    // Crossed arms (rig v2, 2026-11-27, tightened 2026-11-27): shoulder
    // ±36 / elbow ∓34, so the forearms angle DOWN-INWARD ~45deg and the
    // fists tuck at the opposite waist, INSIDE the torso silhouette. The old
    // ±49/±42 (and my first ±38/±70) put the forearms nearly horizontal
    // across the chest, so the fists poked out past the body's sides and the
    // pose read as arms jutting out instead of arms wrapped around the torso
    // (verified in v2-seq-05).
    // FRONT-VIEW SPRITE (rebuild round 3, FIX 6): the upset plays in
    // front / three-quarter view with hand-drawn front sprites
    // (upset-f-0 turn / upset-f-1 cross / upset-f-2 hold — see
    // build-scripts/upset_front_frames.py): arms crossed HIGH on the
    // chest, both forearms checkered sleeves (far one darker, behind),
    // strengthened frown, hold genuinely turned away. The mesh keys
    // below are kept only for the timing/face (the sprite is drawn
    // undeformed); mode is 'front' throughout.
    mode = 'front'; clearHold();
    var keys = [
      { t: 0.00, v: { face: 'head', ang: {} }, e: 'lin' },
      { t: 0.12, v: { face: 'head_frown', ang: { head: -8, chest: 2 } }, e: 'out' },
      { t: 0.33, v: { face: 'head_frown', swapArms: true, ang: { head: -18, chest: 6, shoulder_L: -36, elbow_L: -34, shoulder_R: 36, elbow_R: 34 }, rootDx: -10, handL: 'fist', handR: 'fist' }, e: 'out' },
      { t: 0.50, v: { face: 'head_frown', swapArms: true, ang: { head: -18, chest: 6, shoulder_L: -36, elbow_L: -34, shoulder_R: 36, elbow_R: 34, thigh_R: -22, knee_R: 45 }, rootDx: -10, handL: 'fist', handR: 'fist', scaleY: 0.93, scaleX: 1.05 }, e: 'in' }, // stomp wind-up: leg cocks, body squashes
      { t: 0.58, v: { face: 'head_frown', swapArms: true, ang: { head: -18, chest: 6, shoulder_L: -36, elbow_L: -34, shoulder_R: 36, elbow_R: 34 }, rootDx: -10, handL: 'fist', handR: 'fist' }, e: 'out' }, // stomp lands
      { t: 1.00, v: { face: 'head_frown', swapArms: true, ang: { head: -26, chest: 14, shoulder_L: -36, elbow_L: -34, shoulder_R: 36, elbow_R: 34 }, rootDx: -22, handL: 'fist', handR: 'fist' }, e: 'inOut' } // turn-away hold
    ];
    var upsetHold = sampleKeys(keys, 1);
    upsetHold.spriteUpset = 2; // the hold frame stays on screen after the anim
    runAnim({ dur: 2.4, sample: function (t01) {
      var p = sampleKeys(keys, t01);
      // Sprite frame (front-view sprite set): 0 turn, 1 cross/stomp, 2 hold.
      if (t01 < 0.12) p.spriteUpset = 0;
      else if (t01 < 0.58) p.spriteUpset = 1;
      else p.spriteUpset = 2;
      return p;
    },
      hold: upsetHold }, function () { if (done) done(); });
  }

  function happyPose(done) {
    // GEMINI 2026-11-28: no mesh anim — the happy state is a face swap
    // (gemini-happy) for 1.6s via faceOverride. The old squash/bounce/
    // arms-up keyframes deformed the pixel mesh; running them would
    // flash the pixel character for 1.6s. busyUntil keeps isBusy()
    // true for the same 1.6s (game.js gates prop taps on it).
    mode = 'front'; clearHold();
    faceOverride = { face: 'head_happy', until: Date.now() + 1600 };
    busyUntil = Date.now() + 1600;
    if (done) setTimeout(done, 1600);
  }

  function lookPose(dirDeg, dur, done) {
    // GEMINI 2026-11-28: no mesh anim — looking at a prop (poster/clock)
    // is a tilt-sprite swap (gemini-tilt) for the duration. The head-turn
    // direction (dirDeg) has no meaning on a flat sprite; the tilt frame
    // is the single "she looks" state. Shelf taps never call this
    // (bubble only; the glance was removed in the merge).
    mode = 'front'; clearHold();
    var d = (dur || 2.0) * 1000;
    faceOverride = { face: 'head_tilt', until: Date.now() + d };
    busyUntil = Date.now() + d;
    if (done) setTimeout(done, d);
  }

  function eatPose(done) {
    // GEMINI 2026-11-28: no mesh anim — eating is an eyes-closed swap
    // (gemini-blink) for 1.4s via faceOverride. The old lean/reach
    // keyframes would flash the pixel mesh.
    mode = 'front'; clearHold();
    faceOverride = { face: 'head_closed', until: Date.now() + 1400 };
    busyUntil = Date.now() + 1400;
    if (done) setTimeout(done, 1400);
  }

  function bathPose(done) {
    // GEMINI 2026-11-28: no mesh anim — the bath is a happy swap
    // (gemini-happy) for 2.0s via faceOverride. The old sway/arms
    // keyframes would flash the pixel mesh.
    mode = 'front'; clearHold();
    faceOverride = { face: 'head_happy', until: Date.now() + 2000 };
    busyUntil = Date.now() + 2000;
    if (done) setTimeout(done, 2000);
  }

  // ---------------- init / API ----------------
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    dpr = Math.min(3, window.devicePixelRatio || 1);
    function fit() {
      var r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    }
    fit();
    fitCanvas = fit; // game.js fitRoom() calls Rig.refit() after scaling the room
    window.addEventListener('resize', fit);
    Object.keys(VOICE).forEach(function (k) { VOICE[k].forEach(loadVoice); });
    blipAudio = loadVoice('blip.mp3');
    return loadAll().then(function () {
      requestAnimationFrame(frame);
      return true;
    });
  }

  function setGear(g) { gear = g || gear; }
  function setMuted(m) { muted = !!m; }
  function setReducedMotion(v) { reducedMotion = !!v; }
  function setDancing(v) { dancing = !!v; }
  function setSitting(v) { sitting = !!v; clearHold(); }
  function setSleepy(v) { faceOverride = v ? { face: 'head_sleep', until: Date.now() + 100000000 } : null; if (!v) faceOverride = null; }
  function setExcited(v) { excitedUntil = v ? Date.now() + 10000 : 0; }
  function setSleep(on) {
    sleeping = !!on;
    if (on) { sleepT0 = performance.now(); clearHold(); anim = null; mode = 'sleep'; charX = HOME_X; }
    else { mode = 'front'; }
  }
  function chatReact() { faceOverride = { face: 'head_happy', until: Date.now() + 900 }; playVoice('chat'); }
  function celebrate() { happyPose(); playVoice('celebrate'); }
  function pet() {
    // Head-spring impulse (pre-walk character): the head wobbles and
    // settles. No tap coords reach the Rig (game.js calls pet() bare),
    // so the lean is a small random one + a hop, as in pixel-char pet().
    // GEMINI 2026-11-28: the spring still integrates (frame() applies it
    // to the mesh pose), but a flat sprite has no separate head — the
    // impulse has NO visible effect on the Gemini sprites. Kept
    // (harmless) so the mesh fallback still wobbles; do NOT fake a
    // sprite wobble by rotating the whole sprite (it would swing the
    // boots).
    headSpring.angVel += (Math.random() < 0.5 ? -1 : 1) * 0.8;
    headSpring.dxVel += (Math.random() - 0.5) * 40;
    headSpring.dyVel += -70;
    happyPose(); playVoice('pet');
  }
  function annoyed() {
    faceOverride = { face: 'head_frown', until: Date.now() + 1600 };
    playVoice('poke');
  }
  function eat() { eatPose(); playVoice('eat'); }
  function bath() { bathPose(); playVoice('giggle'); }
  function tossBall() { happyPose(); playVoice('giggle'); }
  function glare() {
    faceOverride = { face: 'head_frown', until: Date.now() + 2200 };
    playVoice('upset');
  }
  function isBusy() { return busy || !!anim || !!walkState || Date.now() < busyUntil; }
  function getCharX() { return charX; }
  function getHandWorld() { return handWorld; }
  function getLastRender() { return lastRender; }

  window.Rig = {
    init: init, ready: loadAll, refit: function () { if (fitCanvas) fitCanvas(); },
    setGear: setGear, loadItemImage: loadItemImage, setMuted: setMuted,
    setReducedMotion: setReducedMotion, setDancing: setDancing, setSitting: setSitting,
    setSleepy: setSleepy, setExcited: setExcited, setSleep: setSleep,
    chatReact: chatReact, celebrate: celebrate, pet: pet, annoyed: annoyed,
    eat: eat, bath: bath, tossBall: tossBall, glare: glare,
    // NEW BRIEF 2026-11-27: walkTo / bendPickup / putBackBook / upsetPose
    // are DEAD CODE — their definitions stay in this file (do not delete
    // the side-sprite files), but they are NO LONGER EXPORTED: nothing
    // calls them, she never translates, charX is HOME_X forever.
    happyPose: happyPose,
    lookPose: lookPose, eatPose: eatPose, bathPose: bathPose,
    isBusy: isBusy, getCharX: getCharX, getHandWorld: getHandWorld, getLastRender: getLastRender,
    playVoice: playVoice, blip: blip,
    setCarriedBook: function (v) { carriedBook = !!v; },
    get carriedBook() { return carriedBook; },
    HOME_X: HOME_X, GROUND_Y: GROUND_Y
  };
})();
