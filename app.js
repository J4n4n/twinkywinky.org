(() => {
  'use strict';

  const STORAGE_KEY = 'twinkywinky_astolfo_v2';
  const LEGACY_KEYS = ['twinkywinky_anime_v1', 'twinkywinky_state', 'twinkywinky_v1', 'astolfo_state'];

  const SPRITE_BASES = {
    idle:     'assets/char-idle',
    blink:    'assets/char-blink',
    tilt:     'assets/char-tilt',
    happy:    'assets/char-happy',
    sit:      'assets/char-sit',
    sitBlink: 'assets/char-sit-blink',
    sitHappy: 'assets/char-sit-happy',
    sleep:    'assets/char-sleep',
  };

  // ---------------- موتور صوتی داخلی (Web Audio API) ----------------
  class SoundFX {
    constructor() { this.ctx = null; this.enabled = true; }
    ensure() {
      if (!this.enabled) return null;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    tone(freq, dur = 0.12, type = 'sine', vol = 0.08, delay = 0) {
      const ctx = this.ensure();
      if (!ctx) return;
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
    pet()   { this.tone(680, 0.11, 'sine', 0.08, 0); this.tone(920, 0.16, 'triangle', 0.08, 0.07); }
    pop()   { this.tone(540, 0.08, 'sine', 0.06); }
    sit()   { this.tone(430, 0.10, 'sine', 0.07, 0); this.tone(560, 0.12, 'sine', 0.06, 0.06); }
    sleep() { this.tone(392, 0.24, 'sine', 0.06, 0); this.tone(330, 0.34, 'sine', 0.05, 0.16); }
    coin()  { this.tone(988, 0.08, 'triangle', 0.08, 0); this.tone(1318, 0.15, 'triangle', 0.08, 0.06); }
    horn()  { this.tone(523, 0.12, 'triangle', 0.08, 0); this.tone(659, 0.12, 'triangle', 0.08, 0.10); this.tone(784, 0.22, 'triangle', 0.09, 0.20); }
    bad()   { this.tone(210, 0.18, 'sawtooth', 0.05); }
  }
  const sfx = new SoundFX();

  // ---------------- استخر دیالوگ‌های اصیل آستولفو (Fate/Apocrypha) ----------------
  const DIALOGUES = {
    greet: [
      'یاهو! مستر بالاخره اومدی! داشتم نقشه می‌کشیدم از پنجره بپریم بریم ماجراجویی 🎀',
      'سلام سلام! حوصله‌ی قوانین رسمی رو ندارم، بیا مستقیم بریم سراغ خوش‌گذرونی ✨',
      'هی! ببین اتاق چقدر روشن و سرحاله! امروز چی تو سرمونه؟ ⭐',
    ],
    pet: [
      'اوووه! چه دستای گرمی! بازم موهامو ناز کن، قول می‌دم تکون نخورم 💖',
      'هی‌هی! اینجوری نازم می‌کنی دلم می‌خواد همین الان با هیپوگریف دور دنیا بپرم ✨',
      'آخیش! از همه‌ی قصرها و تشریفات دنیا این ناز کردن تو بهتره 🎀',
      'ایول! هر وقت پیش منی اصلاً حس قفس ندارم، حس پرواز دارم 💕',
    ],
    sit: [
      'آخیش! چهارزانو روی این فرش بشینیم و مثل دو تا ماجراجوی واقعی نقشه بکشیم 🎀',
      'این فرش از زین هیپوگریف هم نرم‌تره! بیا بشینیم یه کم گپ بزنیم ✨',
      'خب! پاهام استراحت کنن، ولی فکرم هنوز دنبال یه غافلگیری جدیده ⭐',
    ],
    stand: [
      'بپریم بالا! استراحت بسه، وقت شیطنت و ماجراجوییه ⚡',
      'پاشدم! بگو الان کجا بریم و چیکار کنیم؟ 🎀',
    ],
    shelf: [
      'اون شاخ طلاییِ کوچولو یادگاریِ «لا بلک لونا»ست! و اون کتاب پر از طلسم‌های فراموش‌شده‌ست... البته نصفشو یادم رفته 🎺📚',
      'قفسه‌ی گنجینه‌هامه! کاکتوس کوچولو هم تازگی یه گل صورتی داده، خیلی به موهام میاد 🌵🌸',
      'کتابای خشک و جدی رو گذاشتم ته‌ِ قفسه؛ جلوی قفسه فقط داستان‌های ماجراجویی و غافلگیریه!',
    ],
    clock: [
      'ساعت واقعی رو ببین! ولی بین خودمون باشه، بهترین زمان همیشه «همین الان»ه ⏰✨',
      'تیک‌تاک! عقربه‌ها می‌گن الان دقیقاً وقت خوراکی یا یه دست ستاره‌چینه!',
    ],
    poster: [
      'پوستر هیپوگریفم رو می‌بینی؟ توی آسمون هیچ‌کی به گرد پاش نمی‌رسه 🪽⭐',
      'هر وقت دلم تنگ پرواز می‌شه به این پوستر نگاه می‌کنم!',
    ],
    plush: [
      'این هیپوگریف کوچولوی پشمالومه! وقتی نمی‌تونیم بریم آسمون، همینجا کنارمه 🪽💖',
      'هیپوگریف کوچولو می‌گه مستر خیلی مهربونه، بیا یه دور دیگه بازی کنیم!',
    ],
    trunk: [
      'اوه! صندوقچه‌ی غافلگیری‌هامو پیدا کردی! بذار ببینم چی توش قایم کرده بودم... 🎁✨',
      'اینجا پر از روبان، یادگاری سفرها و یه مشت سکه‌ی گمشده‌ست!',
    ],
    bowl: [
      'به به! غذای خوب بهترین سوخت یه شوالیه‌ی ماجراجوئه 🍓✨',
      'آخیش شکمم سیر شد! دستت درد نکنه، حالا انرژی‌م دو برابر شد 💖',
    ],
    windowNight: [
      'هوا شب شد! ماه طلایی بیرون پنجره عجب نوری داره 🌙✨',
      'شبای پرستاره بهترین وقت برای چرت زدن یا قصه گفتنه!',
    ],
    windowDay: [
      'آفتاب زد توی اتاق! ابرا دارن از پشت پنجره رد می‌شن ☀️☁️',
      'صبح بخیر! هوا انقدر قشنگه که نباید توی قفس موند 🎀',
    ],
    lampToggle: [
      'نور گرم آباژور رو روشن کردم، حالا اتاق مثل یه مخفیگاه دنج شده ✨',
      'آباژور رو کم کردم تا نور ماه و ستاره‌ها بیشتر به چشم بیان 🌙',
    ],
    sleepOn: [
      'چشمام دیگه باز نمی‌مونه... همینجا چهارزانو یه چرت حسابی می‌زنم، شب بخیر 🌙💤',
      'فقط یه چرت کوچولو می‌زنم تا فردا با انرژی کامل بریم ماجراجویی 💤',
    ],
    sleepOff: [
      'یاهو! چه خوابی چسبید! کاملاً شارژ شدم، بزن بریم ☀️⚡',
      'بیدار شدم! خواب دیدم داریم روی ابرا مسابقه می‌دیم 🎀',
    ],
    hungryWarn: [
      'مستر... شکمم داره قاروقور می‌کنه! یه خوراکی از کاسه یا فروشگاه برسون 🍓',
    ],
    tiredWarn: [
      'انرژی‌م ته کشیده... یه کم روی فرش چرت بزنم دوباره سرحال می‌شم 🌙',
    ],
    idle: [
      'راستی، روی صندوقچه‌ی پایین سمت چپ زدی؟ گاهی توش سکه پیدا می‌شه 🎁',
      'اگه حوصلت سر رفته بیا توی ستاره‌چین رکورد رولان و موردرد رو بزنیم ⭐',
      'بگو ببینم امروز چه غافلگیری‌ای برام داری؟ 💬',
    ],
  };

  const poolMem = {};
  function pick(key) {
    const arr = DIALOGUES[key] || DIALOGUES.idle;
    if (!poolMem[key] || !poolMem[key].length) {
      poolMem[key] = arr.map((_, i) => i).sort(() => Math.random() - 0.5);
    }
    return arr[poolMem[key].pop()];
  }

  // ---------------- فروشگاه اختصاصی آستولفو (همه‌ی آیتم‌ها اثر واقعی دارند!) ----------------
  const SHOP_ITEMS = [
    { id: 'strawberry', cat: 'food',  ico: '🍓', title: 'توت‌فرنگی شکری',       desc: '+۲۵ سیری و +۱۰ صمیمیت',                      price: 15, effect: { hunger: 25, love: 10 } },
    { id: 'crepe',      cat: 'food',  ico: '🍰', title: 'کرپ خامه‌ای پاریسی',    desc: '+۳۵ سیری، +۱۵ انرژی، +۸ صمیمیت',             price: 25, effect: { hunger: 35, energy: 15, love: 8 } },
    { id: 'skewer',     cat: 'food',  ico: '🍖', title: 'سیخ کباب ماجراجو',      desc: '+۴۵ سیری و +۲۰ انرژی',                       price: 30, effect: { hunger: 45, energy: 20 } },
    { id: 'boba',       cat: 'food',  ico: '🧋', title: 'شیرتوت ستاره‌ای',       desc: '+۳۵ انرژی و +۱۲ صمیمیت',                     price: 20, effect: { energy: 35, love: 12 } },
    { id: 'crown',      cat: 'gear',  ico: '👑', title: 'تاج کوچولوی شوالیه',    desc: 'روی سر آستولفو قرار می‌گیره + ۵۰ امتیاز',     price: 45, effect: { love: 25, xp: 50 }, unique: true, equippable: true },
    { id: 'ribbons',    cat: 'gear',  ico: '🎀', title: 'روبان جادویی صورتی',    desc: 'درخشش دور موها + هر ناز ۲ صمیمیت بیشتر',     price: 35, effect: { love: 20, xp: 40 }, unique: true, equippable: true },
    { id: 'horn',       cat: 'decor', ico: '🎺', title: 'لا بلک لونا (شاخ طلایی)', desc: 'درخشش روی قفسه + ۳۰٪ سکه‌ی بیشتر در بازی',   price: 55, effect: { love: 20, xp: 60 }, unique: true, equippable: true },
    { id: 'pillow',     cat: 'decor', ico: '☁️', title: 'بالشتک ابر جادویی',      desc: 'روی فرش قرار می‌گیره + احیای ۳برابری انرژی خواب', price: 40, effect: { energy: 25, xp: 45 }, unique: true, equippable: true },
    { id: 'fairy',      cat: 'decor', ico: '✨', title: 'ریسه‌ی ستاره‌ای شب',    desc: 'چراغ‌های رنگی در شب + ۲۵٪ XP بیشتر',         price: 50, effect: { love: 20, xp: 55 }, unique: true, equippable: true },
  ];

  // ---------------- وضعیت و مهاجرت خودکار از localStorage قدیمی ----------------
  const defaultState = {
    playerName: 'مستر',
    coins: 50,
    xp: 0,
    day: 1,
    love: 78,
    hunger: 82,
    energy: 86,
    pets: 0,
    bestScore: 0,
    sitting: false,
    sleeping: false,
    night: false,
    lampOn: true,
    sound: true,
    owned: [],
    equipped: [],
    lastTickAt: Date.now(),
    lastTrunkAt: 0,
    sleepStartedAt: 0,
    sleepEnergyStart: 86,
    chatLog: [
      { from: 'bot', text: 'یاهو! به اتاق ماجراجویی من خوش اومدی 🎀 سرمو ناز کن، روی فرش بزن تا چهارزانو بشینم، روی پنجره بزن تا شب بشه، یا همینجا باهام گپ بزن!' },
    ],
  };

  function loadAndMigrateState() {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) return { ...defaultState, ...JSON.parse(current) };

      // مهاجرت امن از نسخه‌های قبلی تا پیشرفت کاربر از بین نرود
      for (const oldKey of LEGACY_KEYS) {
        const raw = localStorage.getItem(oldKey);
        if (raw) {
          const old = JSON.parse(raw);
          const migrated = {
            ...defaultState,
            playerName: typeof old.playerName === 'string' && old.playerName.trim() ? old.playerName : defaultState.playerName,
            coins: Number.isFinite(old.coins) ? old.coins : defaultState.coins,
            xp: Number.isFinite(old.xp) ? old.xp : defaultState.xp,
            day: Number.isFinite(old.day) ? old.day : defaultState.day,
            love: Number.isFinite(old.love) ? old.love : defaultState.love,
            hunger: Number.isFinite(old.hunger) ? old.hunger : defaultState.hunger,
            energy: Number.isFinite(old.energy) ? old.energy : defaultState.energy,
            pets: Number.isFinite(old.pets) ? old.pets : defaultState.pets,
            bestScore: Number.isFinite(old.bestScore) ? old.bestScore : defaultState.bestScore,
            sound: typeof old.sound === 'boolean' ? old.sound : true,
            lastTickAt: Date.now(),
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    } catch {}
    return { ...defaultState };
  }

  const state = loadAndMigrateState();
  sfx.enabled = state.sound;

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function hasEquipped(id) {
    return Array.isArray(state.equipped) && state.equipped.includes(id);
  }

  // ---------------- کاهش تدریجی واقعی آمار (آفلاین و آنلاین) ----------------
  function applyStatDecay() {
    const now = Date.now();
    const elapsedMin = Math.min(240, Math.max(0, (now - (state.lastTickAt || now)) / 60000));
    if (elapsedMin < 0.45) return;

    state.lastTickAt = now;
    if (state.sleeping) {
      const gainRate = hasEquipped('pillow') ? 4.5 : 2.0;
      state.energy = clamp(state.energy + elapsedMin * gainRate);
      state.hunger = clamp(state.hunger - elapsedMin * 0.35);
    } else {
      state.hunger = clamp(state.hunger - elapsedMin * 0.9);
      state.energy = clamp(state.energy - elapsedMin * 0.55);
      state.love   = clamp(state.love   - elapsedMin * 0.4);
    }
    saveState();
    syncUI();
  }

  // ---------------- ارجاعات DOM ----------------
  const $ = (id) => document.getElementById(id);
  const appEl = $('app');
  const stageEl = $('room-stage');
  const bgDay = $('room-bg-day');
  const bgNight = $('room-bg-night');
  const charWrap = $('char-wrap');
  const charCanvas = $('char-canvas');
  const charCtx = charCanvas.getContext('2d');
  const charShadow = $('char-shadow');
  const fxLayer = $('fx-layer');
  const speechBubble = $('speech-bubble');
  const speechText = $('speech-text');

  // ---------------- نقشه‌ی دقیق مختصات تصویر اتاق (پشتیبانی ۹:۱۶ جدید و ۲:۳ پشتیبان) ----------------
  const ROOM_LAYOUT_9_16 = {
    window: { u: 0.30, v: 0.11, w: 0.40, h: 0.19 },
    clock:  { u: 0.08, v: 0.295, w: 0.195, h: 0.112 },
    clockFace: { u: 0.115, v: 0.312, w: 0.122, h: 0.072 },
    shelf:  { u: 0.05, v: 0.425, w: 0.28, h: 0.115 },
    shelfAura: { u: 0.18, v: 0.43, w: 0.11, h: 0.07 },
    poster: { u: 0.72, v: 0.28, w: 0.21, h: 0.14 },
    lamp:   { u: 0.80, v: 0.46, w: 0.17, h: 0.27 },
    lampGlow: { u: 0.68, v: 0.41, w: 0.36, h: 0.24 },
    trunk:  { u: 0.04, v: 0.67, w: 0.21, h: 0.10 },
    rug:    { u: 0.11, v: 0.73, w: 0.78, h: 0.20 },
    rugPillow: { u: 0.33, v: 0.785, w: 0.34, h: 0.055 },
    plush:  { u: 0.75, v: 0.69, w: 0.18, h: 0.12 },
    bowl:   { u: 0.65, v: 0.765, w: 0.15, h: 0.07 },
    charBottomV: 0.865,
    charHeightV: 0.61,
  };

  const ROOM_LAYOUT_2_3 = {
    window: { u: 0.33, v: 0.08, w: 0.34, h: 0.22 },
    clock:  { u: 0.07, v: 0.27, w: 0.17, h: 0.12 },
    clockFace: { u: 0.095, v: 0.285, w: 0.115, h: 0.08 },
    shelf:  { u: 0.04, v: 0.43, w: 0.24, h: 0.11 },
    shelfAura: { u: 0.12, v: 0.43, w: 0.12, h: 0.07 },
    poster: { u: 0.75, v: 0.26, w: 0.18, h: 0.15 },
    lamp:   { u: 0.83, v: 0.42, w: 0.14, h: 0.34 },
    lampGlow: { u: 0.72, v: 0.38, w: 0.34, h: 0.25 },
    trunk:  { u: 0.02, v: 0.68, w: 0.18, h: 0.10 },
    rug:    { u: 0.12, v: 0.74, w: 0.76, h: 0.19 },
    rugPillow: { u: 0.34, v: 0.795, w: 0.32, h: 0.05 },
    plush:  { u: 0.78, v: 0.68, w: 0.15, h: 0.12 },
    bowl:   { u: 0.70, v: 0.76, w: 0.12, h: 0.06 },
    charBottomV: 0.87,
    charHeightV: 0.63,
  };

  // نگاشت دقیق مختصات تصویر واقعی (object-fit: cover; object-position: center bottom) به پیکسل‌های stage
  function layoutRoomElements() {
    const sw = stageEl.clientWidth;
    const sh = stageEl.clientHeight;
    if (!sw || !sh) return;

    const nw = bgDay.naturalWidth || 720;
    const nh = bgDay.naturalHeight || 1280;
    const imgRatio = nw / nh;
    const stageRatio = sw / sh;

    let rw, rh, ox, oy;
    if (stageRatio > imgRatio) {
      rw = sw;
      rh = sw / imgRatio;
      ox = 0;
      oy = sh - rh; // object-position: bottom
    } else {
      rh = sh;
      rw = sh * imgRatio;
      ox = (sw - rw) / 2; // object-position: center
      oy = 0;
    }

    const L = imgRatio > 0.62 ? ROOM_LAYOUT_2_3 : ROOM_LAYOUT_9_16;
    const place = (el, box) => {
      if (!el || !box) return;
      el.style.left   = `${ox + box.u * rw}px`;
      el.style.top    = `${oy + box.v * rh}px`;
      el.style.width  = `${box.w * rw}px`;
      el.style.height = `${box.h * rh}px`;
    };

    place($('hs-window'), L.window);
    place($('window-fx'), L.window);
    place($('hs-clock'),  L.clock);
    place($('clock-overlay'), L.clockFace);
    place($('hs-shelf'),  L.shelf);
    place($('shelf-aura'), L.shelfAura);
    place($('hs-poster'), L.poster);
    place($('hs-lamp'),   L.lamp);
    place($('lamp-glow'), L.lampGlow);
    place($('hs-trunk'),  L.trunk);
    place($('hs-rug'),    L.rug);
    place($('rug-pillow'), L.rugPillow);
    place($('hs-plush'),  L.plush);
    place($('hs-bowl'),   L.bowl);

    // قفل کردن قد و کف بوت کاراکتر دقیقاً روی مرکز فرش
    const charBottomPx = sh - (oy + L.charBottomV * rh);
    const charHeightPx = L.charHeightV * rh;
    charWrap.style.bottom = `${charBottomPx}px`;
    charWrap.style.height = `${charHeightPx}px`;
    charShadow.style.bottom = `${charBottomPx + 4}px`;

    // قفل کردن ناحیه‌ی لمس سر و حباب گفتگو نسبت به ارتفاع واقعی سر (ایستاده یا نشسته!)
    const isSit = state.sitting || state.sleeping;
    const charTopY = (oy + L.charBottomV * rh) - charHeightPx;
    const headTopY = charTopY + (isSit ? charHeightPx * 0.30 : charHeightPx * 0.04);
    const headHeightPx = charHeightPx * 0.25;
    const headWidthPx = Math.min(sw * 0.38, charHeightPx * 0.34);

    const hsHead = $('hs-head');
    hsHead.style.left   = `${(sw - headWidthPx) / 2}px`;
    hsHead.style.top    = `${headTopY}px`;
    hsHead.style.width  = `${headWidthPx}px`;
    hsHead.style.height = `${headHeightPx}px`;

    // ارتفاع پویا برای حباب گفتگو: هنگام نشستن پایین می‌آید و بالای سر می‌نشیند (هرگز ۱۶۰px معلق نمی‌ماند!)
    const bubbleTop = isSit
      ? Math.max(92, headTopY - 86)
      : Math.max(88, Math.min(headTopY - 78, 108));
    speechBubble.style.top = `${bubbleTop}px`;
  }

  window.addEventListener('resize', layoutRoomElements);

  // ---------------- ساعت دیواری زنده ----------------
  function updateLiveClock() {
    const now = new Date();
    const s = now.getSeconds();
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    $('clock-hour').setAttribute('transform', `rotate(${h * 30} 50 50)`);
    $('clock-min').setAttribute('transform',  `rotate(${m * 6} 50 50)`);
    $('clock-sec').setAttribute('transform',  `rotate(${s * 6} 50 50)`);
  }
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // ---------------- بارگذاری بهینه تصاویر + Preloader واقعی + نورپردازی شبانه روی کاراکتر ----------------
  const loadedSprites = {};
  let activePose = 'idle';

  function processIfGreenScreen(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    // اگر از قبل PNG/WebP شفاف است، صفر پردازش اضافی!
    if (p[3] < 180) return c;
    const isGreen = p[1] > 150 && p[1] > p[0] * 1.4 && p[1] > p[2] * 1.4;
    if (!isGreen) return c;

    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], g = p[i + 1], b = p[i + 2];
      const m = Math.max(r, b);
      const gr = g - m;
      if (gr > 48 && g > 95) p[i + 3] = 0;
      else if (gr > 12 && g > 55) {
        p[i + 3] = Math.round(p[i + 3] * clamp(1 - (gr - 12) / 36, 0, 1));
        p[i + 1] = m;
      } else if (gr > 2) {
        p[i + 1] = m;
      }
    }
    ctx.putImageData(d, 0, 0);
    return c;
  }

  function loadImageWithFallback(basePath, exts = ['.webp', '.png', '.jpg', '.jpeg']) {
    return new Promise((resolve) => {
      let idx = 0;
      const img = new Image();
      const tryNext = () => {
        if (idx >= exts.length) return resolve(null);
        img.src = basePath + exts[idx++];
      };
      img.onload = () => resolve(img);
      img.onerror = tryNext;
      tryNext();
    });
  }

  async function preloadAllAssets() {
    const keys = Object.keys(SPRITE_BASES);
    const total = keys.length + 2;
    let done = 0;
    const tick = (msg) => {
      done += 1;
      const pct = Math.min(100, Math.round((done / total) * 100));
      $('preloader-bar').style.width = `${pct}%`;
      if (msg) $('preloader-text').textContent = msg;
    };

    // اتاق روز و شب (با پشتیبانی خودکار webp/png/jpg)
    const [dayImg, nightImg] = await Promise.all([
      loadImageWithFallback('assets/room-day').then((im) => {
        if (im) bgDay.src = im.src;
        else bgDay.src = 'assets/room-day-fallback.webp';
        tick('اتاق روز آماده شد ☀️');
        return im;
      }),
      loadImageWithFallback('assets/room-night').then((im) => {
        if (im) bgNight.src = im.src;
        else bgNight.src = 'assets/room-night-fallback.webp';
        tick('چراغ شب روشن شد 🌙');
        return im;
      }),
    ]);

    await Promise.all(keys.map(async (key) => {
      const im = await loadImageWithFallback(SPRITE_BASES[key]);
      if (im) loadedSprites[key] = processIfGreenScreen(im);
      tick('آستولفو داره میاد توی اتاق 🎀');
    }));

    activePose = getBasePose();
    layoutRoomElements();
    renderCharacter();
    syncUI();

    setTimeout(() => {
      $('preloader').classList.add('done');
      say(pick('greet'), 5200);
    }, 240);
  }

  function getBasePose() {
    if (state.sleeping) return 'sleep';
    if (state.sitting) return 'sit';
    return 'idle';
  }

  // رندر کاراکتر + یکپارچه‌سازی نور شب (سایه‌ی یاسی + نور لبه‌ی گرم از سمت آباژور راست)
  function renderCharacter() {
    const sprite = loadedSprites[activePose] || loadedSprites[getBasePose()] || loadedSprites.idle;
    if (!sprite) return;

    if (charCanvas.width !== sprite.width || charCanvas.height !== sprite.height) {
      charCanvas.width = sprite.width;
      charCanvas.height = sprite.height;
    }

    charCtx.globalCompositeOperation = 'source-over';
    charCtx.clearRect(0, 0, charCanvas.width, charCanvas.height);
    charCtx.drawImage(sprite, 0, 0);

    if (state.night || state.sleeping) {
      charCtx.save();
      charCtx.globalCompositeOperation = 'source-atop';
      // سایه‌ی آبی-یاسی شبانه تا کاراکتر مثل استیکر روشن روی دیوار تاریک نچسبد
      charCtx.fillStyle = state.lampOn ? 'rgba(58, 66, 132, 0.24)' : 'rgba(32, 38, 92, 0.36)';
      charCtx.fillRect(0, 0, charCanvas.width, charCanvas.height);

      // نور گرم لبه‌ی راست از سمت آباژور روشن
      if (state.lampOn) {
        const rim = charCtx.createLinearGradient(charCanvas.width * 0.92, 0, charCanvas.width * 0.25, 0);
        rim.addColorStop(0, 'rgba(255, 206, 128, 0.32)');
        rim.addColorStop(0.45, 'rgba(255, 198, 120, 0.08)');
        rim.addColorStop(1, 'rgba(255, 198, 120, 0)');
        charCtx.fillStyle = rim;
        charCtx.fillRect(0, 0, charCanvas.width, charCanvas.height);
      }
      charCtx.restore();
    }
  }

  function popCharacter() {
    charWrap.classList.remove('pop-react');
    void charWrap.offsetWidth;
    charWrap.classList.add('pop-react');
  }

  // ---------------- پلک زدن و کج‌شدن سر (هم ایستاده و هم نشسته!) ----------------
  let reactionLockUntil = 0;

  function setTempPose(pose, ms) {
    activePose = pose;
    renderCharacter();
    reactionLockUntil = Date.now() + ms;
    setTimeout(() => {
      if (Date.now() >= reactionLockUntil - 20) {
        activePose = getBasePose();
        renderCharacter();
      }
    }, ms);
  }

  function scheduleBlink() {
    setTimeout(() => {
      if (Date.now() > reactionLockUntil && !state.sleeping) {
        const blinkPose = state.sitting ? 'sitBlink' : 'blink';
        activePose = blinkPose;
        renderCharacter();
        setTimeout(() => {
          if (Date.now() > reactionLockUntil && activePose === blinkPose) {
            activePose = getBasePose();
            renderCharacter();
          }
        }, 155);
      }
      scheduleBlink();
    }, 2600 + Math.random() * 2800);
  }

  function scheduleTilt() {
    setTimeout(() => {
      if (Date.now() > reactionLockUntil && !state.sleeping && !state.sitting) {
        activePose = 'tilt';
        renderCharacter();
        setTimeout(() => {
          if (Date.now() > reactionLockUntil && activePose === 'tilt') {
            activePose = getBasePose();
            renderCharacter();
          }
        }, 1800);
      }
      scheduleTilt();
    }, 6800 + Math.random() * 5200);
  }

  // چرخه‌ی زنده: افکت خواب + کاهش تدریجی آمار + دیالوگ‌های خودمونی
  setInterval(() => {
    if (state.sleeping) {
      spawnZzz();
      const boost = hasEquipped('pillow') ? 6 : 2;
      if (state.energy < 100) adjustStats({ energy: boost });
    }
  }, 2400);

  setInterval(applyStatDecay, 30000);

  setInterval(() => {
    if (state.sleeping) return;
    if (state.hunger < 30) { say(pick('hungryWarn'), 5000); return; }
    if (state.energy < 25) { say(pick('tiredWarn'), 5000); return; }
    if (Math.random() < 0.30) say(pick('idle'), 4800);
  }, 24000);

  // ---------------- حباب گفتگو و ذرات ----------------
  let speechTimer = null;
  function say(text, duration = 4600) {
    speechText.textContent = text;
    speechBubble.classList.remove('is-hidden');
    clearTimeout(speechTimer);
    speechTimer = setTimeout(() => speechBubble.classList.add('is-hidden'), duration);
  }

  function spawnParticles(symbol, xPct, yPct, count = 4) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'fx-particle';
      el.textContent = symbol;
      el.style.left = `${xPct + (Math.random() * 14 - 7)}%`;
      el.style.top  = `${yPct + (Math.random() * 8 - 4)}%`;
      el.style.setProperty('--dx', `${Math.round(Math.random() * 48 - 24)}px`);
      el.style.animationDelay = `${i * 70}ms`;
      fxLayer.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    }
  }

  function spawnZzz() {
    const el = document.createElement('span');
    el.className = 'fx-zzz';
    el.textContent = 'Zzz';
    el.style.left = `${45 + Math.random() * 10}%`;
    el.style.top = '44%';
    el.style.fontSize = `${14 + Math.random() * 8}px`;
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }

  // ---------------- آمار و رابط کاربری ----------------
  function clamp(v, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(v)));
  }

  function adjustStats(delta) {
    const xpMult = hasEquipped('fairy') ? 1.25 : 1.0;
    if (delta.love)   state.love   = clamp(state.love + delta.love);
    if (delta.hunger) state.hunger = clamp(state.hunger + delta.hunger);
    if (delta.energy) state.energy = clamp(state.energy + delta.energy);
    if (delta.coins)  state.coins  = Math.max(0, state.coins + delta.coins);
    if (delta.xp)     state.xp    += Math.round(delta.xp * xpMult);
    saveState();
    syncUI();
  }

  function syncUI() {
    const level = Math.floor(state.xp / 100) + 1;
    $('hud-level').textContent = `سطح ${level}`;
    $('hud-day').textContent   = `روز ${state.day}`;
    $('hud-coins').textContent = state.coins;
    $('shop-coins').textContent = state.coins;

    $('bar-love').style.width   = `${state.love}%`;
    $('bar-hunger').style.width = `${state.hunger}%`;
    $('bar-energy').style.width = `${state.energy}%`;
    $('val-love').textContent   = state.love;
    $('val-hunger').textContent = state.hunger;
    $('val-energy').textContent = state.energy;

    $('bar-love').closest('.stat-chip').classList.toggle('low', state.love < 28);
    $('bar-hunger').closest('.stat-chip').classList.toggle('low', state.hunger < 28);
    $('bar-energy').closest('.stat-chip').classList.toggle('low', state.energy < 25);

    $('btn-sound').textContent = state.sound ? '🔊' : '🔇';
    $('act-sit').classList.toggle('active', state.sitting && !state.sleeping);
    $('sit-label').textContent = state.sitting ? 'بلند شو' : 'چهارزانو';
    $('act-sleep').classList.toggle('active', state.sleeping);
    $('sleep-label').textContent = state.sleeping ? 'بیدار شو' : 'چرت زدن';

    const isSit = state.sitting || state.sleeping;
    const isNight = state.night || state.sleeping;

    appEl.classList.toggle('is-sitting', isSit);
    appEl.classList.toggle('is-sleeping', state.sleeping);
    appEl.classList.toggle('is-night', isNight);
    appEl.classList.toggle('lamp-on', state.lampOn);

    bgDay.classList.toggle('active', !isNight);
    bgNight.classList.toggle('active', isNight);

    // نمایش بصری آیتم‌های واقعیِ خریداری و نصب‌شده در اتاق و روی کاراکتر
    $('char-crown').classList.toggle('hidden', !hasEquipped('crown'));
    $('char-ribbons').classList.toggle('hidden', !hasEquipped('ribbons'));
    $('shelf-aura').classList.toggle('hidden', !hasEquipped('horn'));
    $('rug-pillow').classList.toggle('hidden', !hasEquipped('pillow'));
    $('fairy-lights').classList.toggle('hidden', !hasEquipped('fairy'));

    layoutRoomElements();
    renderCharacter();
  }

  // ---------------- اکشن‌های تعاملی اتاق و کاراکتر ----------------
  function handlePetHead() {
    if (state.sleeping) {
      sfx.pop();
      spawnParticles('💤', 50, 46, 2);
      say('آممم... الان خوابم مستر، یواش نازم کن... 🌙');
      adjustStats({ love: 3, xp: 4 });
      return;
    }
    sfx.pet();
    popCharacter();
    state.pets += 1;
    const headY = state.sitting ? 48 : 30;
    spawnParticles('💖', 50, headY, 5);
    // حالا در حالت نشسته هم چهره‌ی خوشحال واقعی نمایش داده می‌شود!
    setTempPose(state.sitting ? 'sitHappy' : 'happy', 1500);
    const loveBonus = hasEquipped('ribbons') ? 8 : 6;
    adjustStats({ love: loveBonus, coins: 2, xp: 10 });
    say(pick('pet'));
  }

  function handleToggleSit() {
    if (state.sleeping) {
      wakeUpFromSleep(true);
      return;
    }
    state.sitting = !state.sitting;
    sfx.sit();
    popCharacter();
    activePose = getBasePose();
    syncUI();
    saveState();
    say(pick(state.sitting ? 'sit' : 'stand'));
  }

  function wakeUpFromSleep(staySitting = false) {
    const sleptSec = (Date.now() - (state.sleepStartedAt || Date.now())) / 1000;
    const energyGained = state.energy - (state.sleepEnergyStart || state.energy);
    // رفع باگ روزشمار: فقط وقتی واقعاً چرت زده باشد (حداقل ۱۵ ثانیه یا ۱۵+ انرژی) روز جلو می‌رود
    if (sleptSec >= 15 || energyGained >= 15) {
      state.day += 1;
    }
    state.sleeping = false;
    state.night = false;
    state.sitting = staySitting;
    sfx.pet();
    popCharacter();
    activePose = getBasePose();
    syncUI();
    saveState();
    say(pick('sleepOff'), 5000);
  }

  function handleToggleSleep() {
    if (state.sleeping) {
      wakeUpFromSleep(false);
      return;
    }
    state.sleeping = true;
    state.night = true;
    state.lampOn = true;
    state.sitting = true;
    state.sleepStartedAt = Date.now();
    state.sleepEnergyStart = state.energy;
    sfx.sleep();
    popCharacter();
    activePose = 'sleep';
    spawnZzz();
    syncUI();
    saveState();
    say(pick('sleepOn'), 5000);
  }

  // پنجره: تغییر روز و شب (منطق درست و مستقل از آباژور!)
  $('hs-window').addEventListener('click', () => {
    if (state.sleeping) {
      wakeUpFromSleep(false);
      return;
    }
    state.night = !state.night;
    sfx.pop();
    syncUI();
    saveState();
    say(pick(state.night ? 'windowNight' : 'windowDay'), 4500);
  });

  // آباژور: در شب نور گرم آباژور را روشن/خاموش می‌کند؛ در روز توضیح بامزه می‌دهد
  $('hs-lamp').addEventListener('click', () => {
    sfx.pop();
    if (!state.night && !state.sleeping) {
      say('الان که روزه آفتاب تا وسط اتاق اومده! بزن روی پنجره تا شب بشه و آباژور رو روشن کنیم ☀️✨');
      return;
    }
    state.lampOn = !state.lampOn;
    syncUI();
    saveState();
    say(state.lampOn ? DIALOGUES.lampToggle[0] : DIALOGUES.lampToggle[1]);
  });

  // صندوقچه‌ی ماجراجویی (هر ۳ دقیقه یه غافلگیری سکه!)
  $('hs-trunk').addEventListener('click', () => {
    const now = Date.now();
    const cooldownMs = 180000;
    if (now - (state.lastTrunkAt || 0) >= cooldownMs) {
      state.lastTrunkAt = now;
      const bonus = 8 + Math.floor(Math.random() * 10);
      sfx.horn();
      spawnParticles('🪙', 15, 72, 5);
      adjustStats({ coins: bonus, love: 3, xp: 12 });
      say(`یاهو! ته صندوقچه ${bonus} تا سکه‌ی یادگاری پیدا کردم! غافلگیری شد، نه؟ 🎁🪙`, 5000);
    } else {
      sfx.pop();
      spawnParticles('🎀', 15, 72, 3);
      say(pick('trunk'));
    }
  });

  $('hs-head').addEventListener('click', handlePetHead);
  $('act-pet').addEventListener('click', handlePetHead);
  $('hs-rug').addEventListener('click', handleToggleSit);
  $('act-sit').addEventListener('click', handleToggleSit);
  $('act-sleep').addEventListener('click', handleToggleSleep);

  $('hs-shelf').addEventListener('click', () => {
    if (hasEquipped('horn')) sfx.horn(); else sfx.pop();
    spawnParticles('✨', 18, 46, 4);
    say(pick('shelf'), 5400);
  });

  $('hs-clock').addEventListener('click', () => {
    sfx.pop();
    say(pick('clock'));
  });

  $('hs-poster').addEventListener('click', () => {
    sfx.pop();
    spawnParticles('⭐', 82, 35, 4);
    say(pick('poster'));
  });

  $('hs-plush').addEventListener('click', () => {
    sfx.pet();
    spawnParticles('🪽', 82, 74, 3);
    say(pick('plush'));
  });

  $('hs-bowl').addEventListener('click', () => {
    if (state.hunger >= 98) {
      sfx.pop();
      say('الان کاملاً سیرم مستر! یه کم دیگه که ماجراجویی کنیم دوباره گرسنه‌م می‌شه 🍓');
      return;
    }
    sfx.coin();
    spawnParticles('🍓', 72, 79, 4);
    if (!state.sleeping) setTempPose(state.sitting ? 'sitHappy' : 'happy', 1200);
    adjustStats({ hunger: 14, love: 4, xp: 6 });
    say(pick('bowl'));
  });

  $('btn-sound').addEventListener('click', () => {
    state.sound = !state.sound;
    sfx.enabled = state.sound;
    if (state.sound) sfx.pop();
    saveState();
    syncUI();
  });

  // ---------------- مدیریت مودال‌ها ----------------
  const overlay = $('modal-overlay');
  const modals = {
    shop: $('modal-shop'),
    game: $('modal-game'),
    rank: $('modal-rank'),
    chat: $('modal-chat'),
  };

  function openModal(name) {
    sfx.pop();
    overlay.classList.remove('hidden');
    Object.entries(modals).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
    if (name === 'shop') renderShop();
    if (name === 'rank') renderRank();
    if (name === 'chat') {
      renderChatLog();
      setTimeout(() => $('modal-chat-input').focus(), 120);
    }
    if (name === 'game') {
      $('game-best').textContent = state.bestScore;
      $('game-combo').textContent = '×1';
    }
  }

  function closeModals() {
    stopGame();
    overlay.classList.add('hidden');
    Object.values(modals).forEach((el) => el.classList.add('hidden'));
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.hasAttribute('data-close')) closeModals();
  });

  $('act-shop').addEventListener('click', () => openModal('shop'));
  $('act-game').addEventListener('click', () => openModal('game'));
  $('btn-open-rank').addEventListener('click', () => openModal('rank'));
  $('btn-open-chatlog').addEventListener('click', () => openModal('chat'));

  // ---------------- فروشگاه (بدون innerHTML برای داده‌های کاربر + قابلیت نصب/برداشتن) ----------------
  let shopCat = 'all';
  $('shop-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-tab');
    if (!btn) return;
    shopCat = btn.dataset.cat;
    document.querySelectorAll('.chip-tab').forEach((b) => b.classList.toggle('active', b === btn));
    renderShop();
  });

  function renderShop() {
    $('shop-coins').textContent = state.coins;
    const grid = $('shop-grid');
    grid.textContent = '';

    SHOP_ITEMS.filter((it) => shopCat === 'all' || it.cat === shopCat).forEach((item) => {
      const owned = Boolean(item.unique && state.owned.includes(item.id));
      const equipped = owned && hasEquipped(item.id);

      const card = document.createElement('div');
      card.className = `shop-item${equipped ? ' equipped' : ''}`;

      const ico = document.createElement('div');
      ico.className = 'ico';
      ico.textContent = item.ico;

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = item.title;

      const desc = document.createElement('div');
      desc.className = 'desc';
      desc.textContent = item.desc;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `primary-btn small${equipped ? ' alt' : ''}`;

      if (owned && item.equippable) {
        btn.textContent = equipped ? 'نصب‌شده (برداشتن)' : 'نصب کن ✓';
        btn.addEventListener('click', () => {
          sfx.pop();
          if (equipped) {
            state.equipped = state.equipped.filter((x) => x !== item.id);
          } else {
            state.equipped.push(item.id);
          }
          saveState();
          syncUI();
          renderShop();
        });
      } else {
        btn.textContent = `خرید (${item.price} 🪙)`;
        btn.disabled = state.coins < item.price;
        btn.addEventListener('click', () => {
          if (state.coins < item.price) return;
          sfx.coin();
          if (item.unique) {
            state.owned.push(item.id);
            if (item.equippable) state.equipped.push(item.id);
          }
          adjustStats({ ...item.effect, coins: -item.price });
          renderShop();
          spawnParticles(item.ico, 50, 44, 5);
          if (!state.sleeping) setTempPose(state.sitting ? 'sitHappy' : 'happy', 1400);
          say(`یاهو! ${item.title} فوق‌العاده‌ست مستر! دستت درد نکنه 💖`, 4800);
        });
      }

      card.append(ico, title, desc, btn);
      grid.appendChild(card);
    });
  }

  // ---------------- مینی‌گیم ستاره‌چین (۱۰۰٪ گرافیک وکتور پاستلی اختصاصی، بدون ایموجی سیستمی) ----------------
  const gCanvas = $('game-canvas');
  const gCtx = gCanvas.getContext('2d');
  let gRunning = false, gRaf = null, gClock = null;
  let gScore = 0, gCombo = 0, gTime = 30, gBasketX = 190;
  let gDrops = [], gBursts = [];

  function drawStar(ctx, x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.46;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawHeart(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.65);
    ctx.bezierCurveTo(-s * 1.15, -s * 0.1, -s * 0.75, -s * 0.95, 0, -s * 0.3);
    ctx.bezierCurveTo(s * 0.75, -s * 0.95, s * 1.15, -s * 0.1, 0, s * 0.65);
    ctx.closePath();
    ctx.fillStyle = '#f472b6';
    ctx.strokeStyle = '#be185d';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawBerry(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, r * 1.05);
    ctx.quadraticCurveTo(-r * 0.95, r * 0.2, -r * 0.75, -r * 0.45);
    ctx.quadraticCurveTo(0, -r * 0.85, r * 0.75, -r * 0.45);
    ctx.quadraticCurveTo(r * 0.95, r * 0.2, 0, r * 1.05);
    ctx.fillStyle = '#fb7185';
    ctx.strokeStyle = '#be123c';
    ctx.lineWidth = 1.8;
    ctx.fill();
    ctx.stroke();
    // برگ سبز بالا
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.48, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawStormCloud(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#7c3aed';
    ctx.strokeStyle = '#4c1d95';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-r * 0.55, 2, r * 0.52, 0, Math.PI * 2);
    ctx.arc(0, -r * 0.28, r * 0.66, 0, Math.PI * 2);
    ctx.arc(r * 0.58, 2, r * 0.50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // ابروی اخمو
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -2); ctx.lineTo(-2, 2);
    ctx.moveTo(8, -2);  ctx.lineTo(2, 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBasket(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    // بدنه‌ی سبد پاستلی آستولفو
    ctx.fillStyle = '#f472b6';
    ctx.strokeStyle = '#9d174d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-42, -10);
    ctx.lineTo(42, -10);
    ctx.lineTo(34, 14);
    ctx.lineTo(-34, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // لبه‌ی سفید با خط شطرنجی ریز
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-44, -14, 88, 7);
    ctx.strokeRect(-44, -14, 88, 7);
    // پاپیون کوچک وسط سبد
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function addGameBurst(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.3;
      gBursts.push({ x, y, vx: Math.cos(ang) * 2.6, vy: Math.sin(ang) * 2.6, life: 1, color });
    }
  }

  function stopGame() {
    gRunning = false;
    cancelAnimationFrame(gRaf);
    clearInterval(gClock);
  }

  function startGame() {
    if (state.energy < 10) {
      sfx.bad();
      $('game-status').textContent = 'انرژی آستولفو زیر ۱۰ شده! اول یه خوراکی بده یا بذار چند ثانیه روی فرش چرت بزنه 🌙🍓';
      return;
    }
    stopGame();
    gRunning = true;
    gScore = 0;
    gCombo = 0;
    gTime = 30;
    gDrops = [];
    gBursts = [];
    gBasketX = gCanvas.width / 2;
    $('game-score').textContent = '0';
    $('game-combo').textContent = '×1';
    $('game-timer').textContent = '30';
    $('game-overlay').classList.add('hidden');

    gClock = setInterval(() => {
      gTime -= 1;
      $('game-timer').textContent = gTime;
      if (gTime <= 0) finishGame();
    }, 1000);

    loopGame();
  }

  function finishGame() {
    stopGame();
    const hornBoost = hasEquipped('horn') ? 1.3 : 1.0;
    const reward = Math.max(6, Math.round((gScore / 2.2) * hornBoost));
    if (gScore > state.bestScore) state.bestScore = gScore;
    adjustStats({ coins: reward, xp: Math.min(90, gScore * 2), energy: -10, hunger: -5, love: 6 });
    $('game-best').textContent = state.bestScore;
    $('game-status').textContent = `ایول مستر! امتیازت ${gScore} شد و ${reward} سکه 🪙 برنده شدی!${hasEquipped('horn') ? ' (با پاداش +۳۰٪ شاخ طلایی!)' : ''}`;
    $('game-overlay').classList.remove('hidden');
    sfx.horn();
    say(`یاهو! توی ستاره‌چین ${gScore} امتیاز گرفتی و ${reward} سکه به جیب زدیم ⭐🪙`, 5200);
  }

  function loopGame() {
    if (!gRunning) return;
    gCtx.clearRect(0, 0, gCanvas.width, gCanvas.height);

    // ستاره‌های ریز پس‌زمینه
    gCtx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let s = 0; s < 14; s++) {
      gCtx.beginPath();
      gCtx.arc((s * 67) % gCanvas.width, (s * 43) % 240, 2, 0, Math.PI * 2);
      gCtx.fill();
    }

    if (Math.random() < 0.062) {
      const r = Math.random();
      const kind = r < 0.48 ? 'star' : r < 0.68 ? 'heart' : r < 0.80 ? 'berry' : 'cloud';
      gDrops.push({
        x: 26 + Math.random() * (gCanvas.width - 52),
        y: -22,
        vy: 2.5 + Math.random() * 2.2,
        rot: Math.random() * Math.PI,
        kind,
      });
    }

    drawBasket(gCtx, gBasketX, gCanvas.height - 28);

    for (let i = gDrops.length - 1; i >= 0; i--) {
      const d = gDrops[i];
      d.y += d.vy;
      d.rot += 0.04;

      if (d.kind === 'star')       drawStar(gCtx, d.x, d.y, 13, d.rot);
      else if (d.kind === 'heart') drawHeart(gCtx, d.x, d.y, 12);
      else if (d.kind === 'berry') drawBerry(gCtx, d.x, d.y, 12);
      else                         drawStormCloud(gCtx, d.x, d.y, 14);

      const hit = d.y >= gCanvas.height - 46 && d.y <= gCanvas.height - 10 && Math.abs(d.x - gBasketX) < 48;
      if (hit) {
        if (d.kind === 'cloud') {
          gCombo = 0;
          gScore = Math.max(0, gScore - 6);
          addGameBurst(d.x, d.y, '#7c3aed');
          sfx.bad();
        } else {
          gCombo += 1;
          const mult = gCombo >= 10 ? 3 : gCombo >= 5 ? 2 : 1;
          const pts = (d.kind === 'heart' ? 10 : d.kind === 'berry' ? 8 : 5) * mult;
          gScore += pts;
          addGameBurst(d.x, d.y, d.kind === 'star' ? '#fde047' : '#f472b6');
          sfx.coin();
        }
        $('game-score').textContent = gScore;
        $('game-combo').textContent = `×${gCombo >= 10 ? 3 : gCombo >= 5 ? 2 : 1}`;
        gDrops.splice(i, 1);
      } else if (d.y > gCanvas.height + 28) {
        gDrops.splice(i, 1);
      }
    }

    for (let i = gBursts.length - 1; i >= 0; i--) {
      const b = gBursts[i];
      b.x += b.vx; b.y += b.vy; b.life -= 0.05;
      if (b.life <= 0) { gBursts.splice(i, 1); continue; }
      gCtx.globalAlpha = b.life;
      gCtx.fillStyle = b.color;
      gCtx.beginPath();
      gCtx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      gCtx.fill();
      gCtx.globalAlpha = 1;
    }

    gRaf = requestAnimationFrame(loopGame);
  }

  function moveBasket(clientX) {
    const rect = gCanvas.getBoundingClientRect();
    gBasketX = clamp((clientX - rect.left) * (gCanvas.width / rect.width), 46, gCanvas.width - 46);
  }

  gCanvas.addEventListener('pointermove', (e) => { if (gRunning) moveBasket(e.clientX); });
  gCanvas.addEventListener('pointerdown', (e) => { if (gRunning) moveBasket(e.clientX); });
  $('btn-game-start').addEventListener('click', startGame);

  // ---------------- لیدربورد همراهان Fate/Apocrypha (۱۰۰٪ ایمن بدون innerHTML) ----------------
  const RIVALS = [
    { name: 'ژان دارک ⚜️', score: 210, level: 6 },
    { name: 'رولان ⚔️',    score: 165, level: 5 },
    { name: 'موردرد ⚡',    score: 130, level: 4 },
    { name: 'زیگ 🐉',      score: 95,  level: 3 },
    { name: 'فران 🌸',     score: 60,  level: 2 },
  ];

  function renderRank() {
    $('player-name-input').value = state.playerName;
    const myLevel = Math.floor(state.xp / 100) + 1;
    const rows = [
      ...RIVALS,
      { name: state.playerName || 'مستر', score: state.bestScore, level: myLevel, isMe: true },
    ].sort((a, b) => b.score - a.score);

    const list = $('rank-list');
    list.textContent = '';

    rows.forEach((row, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      const el = document.createElement('div');
      el.className = `rank-row${row.isMe ? ' is-me' : ''}`;

      const left = document.createElement('span');
      const nameNode = document.createTextNode(`${medal} ${row.name} `);
      const lvl = document.createElement('small');
      lvl.style.opacity = '0.68';
      lvl.textContent = `(سطح ${row.level})`;
      left.append(nameNode, lvl);

      const right = document.createElement('strong');
      right.textContent = `${row.score} امتیاز`;

      el.append(left, right);
      list.appendChild(el);
    });
  }

  $('btn-save-name').addEventListener('click', () => {
    const val = $('player-name-input').value.trim().slice(0, 18);
    if (!val) return;
    state.playerName = val;
    saveState();
    sfx.pop();
    renderRank();
  });

  // ---------------- چت آگاه از وضعیت با لحن آستولفو + هوک اختیاری API زنده ----------------
  async function generateAstolfoReply(msg) {
    // اگر Worker هوش مصنوعی خودت (مثل FelixAgent) را در window.TWINKY_CHAT_API تنظیم کنی، مستقیم از آن می‌پرسد!
    if (typeof window.TWINKY_CHAT_API === 'string' && window.TWINKY_CHAT_API.startsWith('http')) {
      try {
        const res = await fetch(window.TWINKY_CHAT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: msg,
            state: { love: state.love, hunger: state.hunger, energy: state.energy, sitting: state.sitting, night: state.night, name: state.playerName },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.reply === 'string' && data.reply.trim()) return data.reply.trim();
        }
      } catch {}
    }

    const t = msg.trim();
    const who = state.playerName || 'مستر';

    if (/سلام|درود|یاهو|هی|صبح|شب بخیر/.test(t)) {
      if (!state.sleeping) setTempPose(state.sitting ? 'sitHappy' : 'happy', 1300);
      return state.night
        ? `یاهو ${who}! شب شده و اتاق حسابی دنج شده 🌙 چی تو سرمونه؟`
        : `یاهو ${who}! بالاخره اومدی 🎀 امروز پایه‌ی یه ماجراجویی یا یه دست ستاره‌چین هستی؟`;
    }
    if (/چطوری|حالت|خوبی|چه خبر/.test(t)) {
      if (state.hunger < 35) return `راستش ${who}، شکمم داره قاروقور می‌کنه (سیری ${state.hunger}٪)! یه کرپ یا توت‌فرنگی بدی دوباره سرحال می‌شم 🍓`;
      if (state.energy < 30) return `انرژی‌م رسیده به ${state.energy}٪... یه چرت کوچولو روی فرش بزنم دوباره می‌پرم بالا 🌙`;
      return `عالیِ عالی‌ام ${who}! صمیمیتمون ${state.love}٪ شده و حالم از هر وقت دیگه بهتره ✨`;
    }
    if (/هیپوگریف|پرواز|اسب|بال/.test(t)) {
      spawnParticles('🪽', 50, 40, 4);
      return 'هیپوگریف بهترین هم‌سفر دنیاست! نصفش عقابه نصفش اسب، از قفس متنفره و توی آسمون هیچ‌کی حریفش نمی‌شه 🪽⭐';
    }
    if (/غافلگیری|سورپرایز|صندوق|گنج/.test(t)) {
      return 'اوه عاشق غافلگیری‌ام! 🎁 یه سر به صندوقچه‌ی پایین سمت چپ اتاق بزن — گاهی سکه‌های یادگاری قایم‌شده توش پیدا می‌شه!';
    }
    if (/شاخ|لا بلک|طلسم|کتاب|قفسه/.test(t)) {
      return 'شاخ طلاییِ لا بلک لونا و کتاب طلسمم روی قفسه‌ست! البته اسم نصف طلسم‌هاشو یادم می‌ره ولی هیجانش به همینه 🎺📚';
    }
    if (/دوستت|عشق|قشنگ|ناز|کیوت|زیبا|بهترین/.test(t)) {
      if (!state.sleeping) setTempPose(state.sitting ? 'sitHappy' : 'happy', 1500);
      spawnParticles('💖', 50, 36, 5);
      adjustStats({ love: 5, xp: 6 });
      return `اوووه ${who} خجالتم دادی! 💖 هر جا بری و هر ماجراجویی‌ای باشه، من تا آخرش پشتتم!`;
    }
    if (/بشین|چهارزانو|فرش/.test(t)) {
      if (!state.sitting && !state.sleeping) handleToggleSit();
      return 'چشم! چهارزانو روی فرش نشستم 🎀 حالا تعریف کن!';
    }
    if (/پاشو|بلند شو/.test(t)) {
      if (state.sitting || state.sleeping) handleToggleSit();
      return 'پریدم بالا! آماده‌ی ماجراجویی‌ام ⚡';
    }
    if (/خواب|چرت|بخواب/.test(t)) {
      if (!state.sleeping) handleToggleSleep();
      return 'باشه، همینجا روی فرش یه چرت آروم می‌زنم 🌙💤';
    }
    if (/غذا|گرسنه|کرپ|کباب|توت|شیرتوت/.test(t)) {
      return 'اسمشو آوردی آب دهنم راه افتاد! 🍰 بزن روی کاسه‌ی غذا یا فروشگاه تا یه ضیافت راه بندازیم!';
    }
    if (/بازی|ستاره|رکورد|رولان|موردرد/.test(t)) {
      return `پایه‌ام! رکورد فعلیت ${state.bestScore} امتیازه — بیا ببینیم می‌تونیم توی ستاره‌چین از رولان و موردرد جلو بزنیم یا نه ⭐`;
    }
    if (/قانون|رسمی|قفس/.test(t)) {
      return 'اَه نه! از قوانین خشک و قفس متنفرم! آدم باید آزاد باشه و دنبال حس خوب و ماجراجویی بره 🎀✨';
    }

    if (!state.sitting && !state.sleeping) setTempPose('tilt', 1600);
    const dynamic = [
      `جالبه ${who}! اینکه گفتی «${t}» یه ایده‌ی بامزه تو سرم انداخت ✨ بیشتر بگو!`,
      `هی‌هی، با تو گپ زدن توی این اتاق از همه‌ی تشریفات قصر بهتره 🎀 راستی حواست به سکه‌هات (${state.coins} 🪙) هست؟`,
      `سرمو کج کردم کامل گوش بدم ${who}! هر چی بگی من پایه‌ام 💖`,
    ];
    return dynamic[Math.floor(Math.random() * dynamic.length)];
  }

  function renderChatLog() {
    const list = $('chat-log-list');
    list.textContent = '';
    state.chatLog.slice(-50).forEach((m) => {
      const div = document.createElement('div');
      div.className = `chat-msg ${m.from}`;
      div.textContent = m.text;
      list.appendChild(div);
    });
    list.scrollTop = list.scrollHeight;
  }

  async function submitChatMessage(rawText) {
    const text = rawText.trim();
    if (!text) return;
    sfx.pop();
    state.chatLog.push({ from: 'user', text });
    if (state.chatLog.length > 70) state.chatLog = state.chatLog.slice(-70);
    renderChatLog();

    const reply = await generateAstolfoReply(text);
    state.chatLog.push({ from: 'bot', text: reply });
    if (state.chatLog.length > 70) state.chatLog = state.chatLog.slice(-70);
    adjustStats({ love: 2, xp: 4 });
    say(reply, 5400);
    renderChatLog();
  }

  $('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('chat-input');
    const txt = inp.value;
    inp.value = '';
    submitChatMessage(txt);
  });

  $('modal-chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('modal-chat-input');
    const txt = inp.value;
    inp.value = '';
    submitChatMessage(txt);
  });

  $('chat-quick-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.quick-chip');
    if (chip) submitChatMessage(chip.textContent);
  });

  // ---------------- شروع برنامه ----------------
  applyStatDecay();
  syncUI();
  preloadAllAssets();
  scheduleBlink();
  scheduleTilt();
})();