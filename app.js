(() => {
  'use strict';

  const STORAGE_KEY = 'twinkywinky_astolfo_v3';
  const LEGACY_KEYS = ['twinkywinky_astolfo_v2', 'twinkywinky_anime_v1', 'twinkywinky_state', 'twinkywinky_v1', 'astolfo_state'];

  const SPRITE_BASES = {
    idle:     'assets/char-idle',
    blink:    'assets/char-blink',
    tilt:     'assets/char-tilt',
    happy:    'assets/char-happy',
    sit:      'assets/char-sit',
    sitBlink: 'assets/char-sit-blink',
    sitHappy: 'assets/char-sit-happy',
    sleep:    'assets/char-sleep',      // اسپرایت مستقل درازکش (3:2)
    sleepSit: 'assets/char-sleep-sit',  // پشتیبان در صورت نبودن char-sleep
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
    giggle(){ this.tone(740, 0.09, 'sine', 0.07, 0); this.tone(988, 0.11, 'sine', 0.07, 0.07); this.tone(1174, 0.14, 'triangle', 0.06, 0.14); }
    pop()   { this.tone(540, 0.08, 'sine', 0.06); }
    sit()   { this.tone(430, 0.10, 'sine', 0.07, 0); this.tone(560, 0.12, 'sine', 0.06, 0.06); }
    sleep() { this.tone(392, 0.24, 'sine', 0.06, 0); this.tone(330, 0.34, 'sine', 0.05, 0.16); }
    coin()  { this.tone(988, 0.08, 'triangle', 0.08, 0); this.tone(1318, 0.15, 'triangle', 0.08, 0.06); }
    horn()  { this.tone(523, 0.12, 'triangle', 0.08, 0); this.tone(659, 0.12, 'triangle', 0.08, 0.10); this.tone(784, 0.22, 'triangle', 0.09, 0.20); }
    bad()   { this.tone(210, 0.18, 'sawtooth', 0.05); }
  }
  const sfx = new SoundFX();

  // ---------------- صدای واقعی آستولفو (کلیپ‌های Fate/Grand Order — Rumi Okubo) ----------------
  // کلیپ‌ها فریادهای کوتاه‌اند (۰٫۴۴ تا ۲٫۸۵ ثانیه)، نه خواندن کامل متن فارسی؛
  // حباب متن فارسی را نشان می‌دهد و هم‌زمان یک فریاد هماهنگ پخش می‌شود. بدون TTS.
  const VOICE_POOLS = {
    pet:       ['v03_pet.mp3', 'v12_tickle.mp3', 'v10_cute.mp3', 'v11_love.mp3', 'v01_yahoo.mp3'],
    greet:     ['v01_yahoo.mp3'],
    cheek:     ['v12_tickle.mp3', 'v02_giggle.mp3'],
    hand:      ['v08_adventure.mp3'],
    torso:     ['v10_cute.mp3'],
    chat:      ['v02_giggle.mp3', 'v08_adventure.mp3'],
    celebrate: ['v06_best.mp3', 'v09_knight.mp3'],
    buy:       ['blip.mp3', 'v06_best.mp3'],
    confused:  ['v07_huh.mp3'],
    love:      ['v11_love.mp3'],
  };
  const voiceCache = {};
  function loadVoice(name) {
    const a = new Audio(`assets/voice/${name}`);
    a.preload = 'auto';
    voiceCache[name] = a;
    return a;
  }
  function playVoice(name) {
    if (!state.sound) return;
    const a = voiceCache[name];
    if (!a) return;
    try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  function playVoicePool(pool) {
    if (!pool || !pool.length) return;
    playVoice(pool[Math.floor(Math.random() * pool.length)]);
  }

  // =========================================================================
  // دیالوگ‌های تاییدشده‌ی آستولفو — فقط نقل‌قول‌های واقعی از Fate/Apocrypha
  // و Fate/Grand Order (ترجمه‌ی فارسی). هیچ جمله‌ای ساخته نشده است.
  // منبع هر بخش در کامنت همان بخش آمده است. خط‌هایی که برای یک اسلات
  // نقل‌قول واقعی ندارند، از خط‌های واقعی عمومی/لمس بازاستفاده می‌کنند.
  // =========================================================================
  const DIALOGUES = {
    // سلام و معرفی — FGO Summon، Ep 2، FGO Dialogue 1، FGO «Something you Like»
    greet: [
      'یاهو! اسم من آستولفوعه! کلاسم رایدره! و، و… خب، مراقبم باش!',
      'اسم من آستولفوعه. عضو دوازده شوالیه‌ی شارلمانی‌ام. کلاسم رایدره. سلام!',
      'ارباب، هی ارباب. یه چیزی هست~',
      'چی دوست دارم؟ همه‌چی! هر چی تو این دنیا هست رو دوست دارم!',
    ],

    // لمس بدن — سه خط واقعی My Room در FGO (واکنش به لمس‌شدن). در هر شش
    // ناحیه‌ی لمس می‌چرخند؛ خط واقعی دیگری برای لمس وجود ندارد.
    // Bond 1 «هیاو!» / Bond 2 پوست لطیف دوشیزه / Bond 3 دست‌مالی
    pet: [
      'هیاو!',
      'به پوست لطیف یه دوشیزه این‌جوری حریصانه دست نزن! …هه؟ چیز عجیبی گفتم؟',
      'اوه، از وقتی احضارم کردی همین‌طور داری دست‌مالی‌ام می‌کنی! اگه این‌طوره مجبورم به زور متوسل بشم! آهاهاها، بگیر!',
    ],
    touchHair: [
      'هیاو!',
      'به پوست لطیف یه دوشیزه این‌جوری حریصانه دست نزن! …هه؟ چیز عجیبی گفتم؟',
      'اوه، از وقتی احضارم کردی همین‌طور داری دست‌مالی‌ام می‌کنی! اگه این‌طوره مجبورم به زور متوسل بشم! آهاهاها، بگیر!',
    ],
    touchCheek: [
      'هیاو!',
      'به پوست لطیف یه دوشیزه این‌جوری حریصانه دست نزن! …هه؟ چیز عجیبی گفتم؟',
      'اوه، از وقتی احضارم کردی همین‌طور داری دست‌مالی‌ام می‌کنی! اگه این‌طوره مجبورم به زور متوسل بشم! آهاهاها، بگیر!',
    ],
    touchHand: [
      'هیاو!',
      'به پوست لطیف یه دوشیزه این‌جوری حریصانه دست نزن! …هه؟ چیز عجیبی گفتم؟',
      'اوه، از وقتی احضارم کردی همین‌طور داری دست‌مالی‌ام می‌کنی! اگه این‌طوره مجبورم به زور متوسل بشم! آهاهاها، بگیر!',
    ],
    touchTorso: [
      'هیاو!',
      'به پوست لطیف یه دوشیزه این‌جوری حریصانه دست نزن! …هه؟ چیز عجیبی گفتم؟',
      'اوه، از وقتی احضارم کردی همین‌طور داری دست‌مالی‌ام می‌کنی! اگه این‌طوره مجبورم به زور متوسل بشم! آهاهاها، بگیر!',
      'آه! کمر بیچاره‌ام! فکر کنم باید دراز بکشم!', // Ep 4
    ],
    touchFeet: [
      'هیاو!',
      'به پوست لطیف یه دوشیزه این‌جوری حریصانه دست نزن! …هه؟ چیز عجیبی گفتم؟',
      'اوه، از وقتی احضارم کردی همین‌طور داری دست‌مالی‌ام می‌کنی! اگه این‌طوره مجبورم به زور متوسل بشم! آهاهاها، بگیر!',
    ],

    // خوابیدن — FGO Battle Finish 2
    sleepOn: [
      'آره، عالیه! خب، خسته‌ام پس می‌رم یه کم استراحت کنم. بای‌بای!',
    ],
    // بیدار شدن — Ep 4 (به زیگ) — PROBABLE: گوینده در ترانسکریپت ۱۰۰٪ مشخص نیست
    sleepOff: [
      'هی، تو! بیدار شو! خوبی؟! هی! جواب بده!',
    ],
    // لمس حین خواب — خط واقعی ندارد؛ همان سه خط لمس FGO می‌چرخند
    sleepPoke: [
      'هیاو!',
      'به پوست لطیف یه دوشیزه این‌جوری حریصانه دست نزن! …هه؟ چیز عجیبی گفتم؟',
      'اوه، از وقتی احضارم کردی همین‌طور داری دست‌مالی‌ام می‌کنی! اگه این‌طوره مجبورم به زور متوسل بشم! آهاهاها، بگیر!',
    ],

    // نشستن — خط واقعی ندارد؛ خط‌های طولانی و تامل‌برانگیز Ep 4 (در حالت
    // نشسته سر پایین‌تر است و حباب بلند جا می‌شود) + دو خط کوتاه عمومی
    sit: [
      'لازم نیست هیچ غلطی بکنی. تغییر ایجاد کردن یا به کسی وفادار بودن چیزهاییه که چون خودت می‌خوای انجامشون می‌دی. تنها چیزی که لازم داری اراده‌ی زندگی‌کردنه! تا وقتی قلبت می‌زنه، باید برای زندگی کردن تلاش کنی!', // Ep 4، به زیگ
      'می‌خوام از روی اراده‌ی خودم بهش کمک کنم! مگه خدمتگزارها برای کمک به مردم دلیل لازم دارن؟ … من آستولفو، شوالیه‌ی شارلمانی‌ام! نمی‌ذارم سقوط کنه! قسم خوردم!', // Ep 4، به سلنیکه
      'ارباب، هی ارباب. یه چیزی هست~', // FGO Dialogue 1
      'چی دوست دارم؟ همه‌چی! هر چی تو این دنیا هست رو دوست دارم!', // FGO «Something you Like»
    ],
    // بلند شدن — FGO Noble Phantasm و FGO Bond 5
    stand: [
      'قدرت واقعیت رو نشون بده! هیپوگریف!',
      'باشه، ارباب! من شمشیر توام، تیغ توام، تیر توام! چون تا حالا به منِ ضعیف اعتماد کردی، با تمام قدرتم جواب اعتمادت رو می‌دم!',
    ],

    // اشیای اتاق — خط مختص شیء وجود ندارد؛ خط‌های عمومی واقعی (نزدیک‌ترین مضمون)
    shelf: [
      'چی دوست دارم؟ همه‌چی! هر چی تو این دنیا هست رو دوست دارم!', // FGO «Something you Like»
      'اوه، قطعاً پیشنهاد نمی‌کنم تصمیم‌گیری رو کامل به من بسپری. چون هیچ‌کس به اندازه‌ی من، آستولفو، بی‌قید و بند نیست!', // TYPE-MOON Wiki، به زیگ
    ],
    clock: [
      'ارباب برام یه کار گذاشت. گفت تو دنیا بمونم و با مردم خوشحال زندگی کنم.', // Ep 25
      'آستولفو از دوازده شوالیه‌ی شارلمانی! مثل برگِ در حال سقوط باش! …ولی واقعاً سقوط نکن!', // FGO Battle Start 1
    ],
    poster: [
      'قدرت واقعیت رو نشون بده! هیپوگریف!', // FGO Noble Phantasm
      'فقط یه زخم سطحیه! بی‌دلیل که شوالیه‌ی شارلمانی نیستم!', // Ep 25
    ],
    plush: [
      'قدرت واقعیت رو نشون بده! هیپوگریف!', // FGO Noble Phantasm
      'چی دوست دارم؟ همه‌چی! هر چی تو این دنیا هست رو دوست دارم!', // FGO «Something you Like»
    ],
    trunk: [
      'ارباب، هی ارباب. یه چیزی هست~', // FGO Dialogue 1
      'به خدمتگزار وفادارت بسپار!', // Ep 25
    ],
    bowl: [
      'چی دوست دارم؟ همه‌چی! هر چی تو این دنیا هست رو دوست دارم!', // FGO «Something you Like»
      'ارباب، هی ارباب. یه چیزی هست~', // FGO Dialogue 1
    ],
    windowNight: [
      'ارباب برام یه کار گذاشت. گفت تو دنیا بمونم و با مردم خوشحال زندگی کنم.', // Ep 25
    ],
    windowDay: [
      'اسم من آستولفوعه. عضو دوازده شوالیه‌ی شارلمانی‌ام. کلاسم رایدره. سلام!', // Ep 2
    ],
    lampToggle: [
      'ارباب، هی ارباب. یه چیزی هست~', // FGO Dialogue 1
      'چی دوست دارم؟ همه‌چی! هر چی تو این دنیا هست رو دوست دارم!', // FGO «Something you Like»
    ],
    hungryWarn: [
      'چی دوست دارم؟ همه‌چی! هر چی تو این دنیا هست رو دوست دارم!', // FGO «Something you Like»
    ],
    tiredWarn: [
      'آره، عالیه! خب، خسته‌ام پس می‌رم یه کم استراحت کنم. بای‌بای!', // FGO Battle Finish 2
    ],
    idle: [
      'باشه، ارباب! من شمشیر توام، تیغ توام، تیر توام! چون تا حالا به منِ ضعیف اعتماد کردی، با تمام قدرتم جواب اعتمادت رو می‌دم!', // FGO Bond 5
      'اوه، قطعاً پیشنهاد نمی‌کنم تصمیم‌گیری رو کامل به من بسپری. چون هیچ‌کس به اندازه‌ی من، آستولفو، بی‌قید و بند نیست!', // TYPE-MOON Wiki، به زیگ
      'من خدمتگزار سیاه‌ام، و سرنوشتم با ایگدمیرنیا یکی‌ست.', // Ep 2
      'ارباب برام یه کار گذاشت. گفت تو دنیا بمونم و با مردم خوشحال زندگی کنم.', // Ep 25
      'فقط یه زخم سطحیه! بی‌دلیل که شوالیه‌ی شارلمانی نیستم!', // Ep 25
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

  // ---------------- فروشگاه گنجینه‌ی آستولفو (هر آیتم اثر واقعی دارد) ----------------
  const SHOP_ITEMS = [
    { id: 'strawberry', cat: 'food',  ico: '🍓', title: 'توت‌فرنگی شکری',         desc: '+۲۵ خوراکی و +۱۰ رفاقت',                          price: 15, effect: { hunger: 25, love: 10 } },
    { id: 'crepe',      cat: 'food',  ico: '🍰', title: 'کرپ خامه‌ای صورتی',      desc: '+۳۵ خوراکی، +۱۵ انرژی، +۸ رفاقت',                 price: 25, effect: { hunger: 35, energy: 15, love: 8 } },
    { id: 'skewer',     cat: 'food',  ico: '🍖', title: 'کباب ضیافت پالادین',     desc: '+۴۵ خوراکی و +۲۰ انرژی',                          price: 30, effect: { hunger: 45, energy: 20 } },
    { id: 'boba',       cat: 'food',  ico: '🧋', title: 'شیرتوت ستاره‌ای',        desc: '+۳۵ انرژی و +۱۲ رفاقت',                           price: 20, effect: { energy: 35, love: 12 } },
    { id: 'crown',      cat: 'gear',  ico: '👑', title: 'تاج کوچولوی پالادین',    desc: 'روی سر آستولفو قرار می‌گیره + ۵۰ امتیاز',          price: 45, effect: { love: 25, xp: 50 }, unique: true, equippable: true },
    { id: 'ribbons',    cat: 'gear',  ico: '🎀', title: 'روبان جادویی صورتی',     desc: 'درخشش دور موها + هر ناز ۲ رفاقت بیشتر',           price: 35, effect: { love: 20, xp: 40 }, unique: true, equippable: true },
    { id: 'horn',       cat: 'decor', ico: '🎺', title: 'لا بلک لونا (درخشش)',    desc: 'هاله‌ی طلایی روی قفسه + ۳۰٪ سکه‌ی بیشتر در بازی', price: 55, effect: { love: 20, xp: 60 }, unique: true, equippable: true },
    { id: 'pillow',     cat: 'decor', ico: '☁️', title: 'بالشتک ابر جادویی',      desc: 'روی فرش میاد + احیای دوونیم‌برابری انرژی در خواب', price: 40, effect: { energy: 25, xp: 45 }, unique: true, equippable: true },
    { id: 'fairy',      cat: 'decor', ico: '✨', title: 'ریسه‌ی ستاره‌های شب',    desc: 'چراغ‌های رنگی در شب + ۲۵٪ امتیاز بیشتر',          price: 50, effect: { love: 20, xp: 55 }, unique: true, equippable: true },
  ];

  // ---------------- وضعیت با نگهداری اعشار دقیق (رفع قطعی باگ عدم کاهش آمار!) ----------------
  const defaultState = {
    playerName: 'رفیق',
    coins: 50,
    xp: 0,
    day: 1,
    love: 78.0,
    hunger: 82.0,
    energy: 86.0,
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
      { from: 'bot', text: 'یاهو! اسم من آستولفوعه! کلاسم رایدره! و، و… خب، مراقبم باش!' },
    ],
  };

  function clampFloat(v, min = 0, max = 100) {
    return Math.max(min, Math.min(max, v));
  }

  function loadAndMigrateState() {
    try {
      const cur = localStorage.getItem(STORAGE_KEY);
      if (cur) return { ...defaultState, ...JSON.parse(cur) };

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
            owned: Array.isArray(old.owned) ? old.owned : [],
            equipped: Array.isArray(old.equipped) ? old.equipped : [],
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
  Object.keys(VOICE_POOLS).forEach((k) => VOICE_POOLS[k].forEach(loadVoice));

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function hasEquipped(id) {
    return Array.isArray(state.equipped) && state.equipped.includes(id);
  }

  // ---------------- کاهش تدریجی واقعی آمار (بدون خطای رُند شدن! تضمینی داخل ۴۰ تا ۶۰ ثانیه) ----------------
  function applyStatDecay() {
    const now = Date.now();
    const elapsedSec = Math.min(14400, Math.max(0, (now - (state.lastTickAt || now)) / 1000));
    if (elapsedSec < 5) return;

    const elapsedMin = elapsedSec / 60;
    state.lastTickAt = now;

    const prevH = Math.floor(state.hunger);
    const prevE = Math.floor(state.energy);
    const prevL = Math.floor(state.love);

    if (state.sleeping) {
      // هنگام خواب: انرژی برمی‌گردد (با بالشتک ۲.۵ برابر سریع‌تر)، اشتها خیلی آهسته کم می‌شود
      const gainPerMin = hasEquipped('pillow') ? 10.0 : 4.0;
      state.energy = clampFloat(state.energy + elapsedMin * gainPerMin);
      state.hunger = clampFloat(state.hunger - elapsedMin * 0.45);
    } else {
      // هنگام بیداری: اشتها -1.5/دقیقه، انرژی -1.2/دقیقه، رفاقت -1.0/دقیقه
      // در ۶۰ ثانیه: اشتها ۱ تا ۲ واحد، انرژی ۱ واحد و رفاقت ۱ واحد واقعاً کم می‌شود!
      state.hunger = clampFloat(state.hunger - elapsedMin * 1.5);
      state.energy = clampFloat(state.energy - elapsedMin * 1.2);
      state.love   = clampFloat(state.love   - elapsedMin * 1.0);
    }

    saveState();
    if (
      Math.floor(state.hunger) !== prevH ||
      Math.floor(state.energy) !== prevE ||
      Math.floor(state.love) !== prevL
    ) {
      syncUI();
    }
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

  // ---------------- نقشه‌ی پیکسلی دقیق اتاق ۱:۱٫۹۵ (اندازه‌گیری‌شده روی ۵۴۰×۱۰۵۲) ----------------
  const ROOM_LAYOUT_TALL = {
    window:    { u: 0.278, v: 0.181, w: 0.380, h: 0.157 },
    clock:     { u: 0.030, v: 0.228, w: 0.205, h: 0.115 },
    clockFace: { u: 0.055, v: 0.255, w: 0.154, h: 0.077 },
    shelf:     { u: 0.015, v: 0.425, w: 0.365, h: 0.115 },
    shelfAura: { u: 0.210, v: 0.435, w: 0.110, h: 0.065 },
    poster:    { u: 0.770, v: 0.222, w: 0.210, h: 0.140 },
    lamp:      { u: 0.810, v: 0.370, w: 0.180, h: 0.265 },
    lampGlow:  { u: 0.680, v: 0.340, w: 0.360, h: 0.220 },
    trunk:     { u: 0.020, v: 0.600, w: 0.240, h: 0.105 },
    rug:       { u: 0.045, v: 0.685, w: 0.910, h: 0.230 },
    rugPillow: { u: 0.340, v: 0.790, w: 0.320, h: 0.052 },
    rugPillowSleep: { u: 0.140, v: 0.785, w: 0.240, h: 0.055 },
    plush:     { u: 0.710, v: 0.640, w: 0.200, h: 0.130 },
    bowl:      { u: 0.590, v: 0.710, w: 0.130, h: 0.060 },
    charBottomV: 0.885,
    charHeightV: 0.585,
  };

  // حباب گفتگو را از روی ارتفاع واقعی‌اش جای می‌دهد تا هرگز روی صورتش نیفتد
  // (جای ثابتِ قبلی در حالت نشسته و در ویوپورت کوتاه روی سر می‌افتاد)
  function placeBubble() {
    const stageTop = stageEl.getBoundingClientRect().top;
    const headTop = $('hs-head').getBoundingClientRect().top - stageTop;
    const h = speechBubble.offsetHeight;
    speechBubble.style.top = `${Math.max(8, headTop - h - 22)}px`;
  }

  // نگاشت تمام المان‌ها و ۶ ناحیه‌ی بدن آستولفو به پیکسل دقیق روی استیج
  function layoutRoomElements() {
    const sw = stageEl.clientWidth;
    const sh = stageEl.clientHeight;
    if (!sw || !sh) return;

    const nw = bgDay.naturalWidth || 540;
    const nh = bgDay.naturalHeight || 1052;
    const imgRatio = nw / nh;
    const stageRatio = sw / sh;

    let rw, rh, ox, oy;
    if (stageRatio > imgRatio) {
      rw = sw;
      rh = sw / imgRatio;
      ox = 0;
      oy = sh - rh;
    } else {
      rh = sh;
      rw = sh * imgRatio;
      ox = (sw - rw) / 2;
      oy = 0;
    }

    const L = ROOM_LAYOUT_TALL;
    const place = (el, box) => {
      if (!el || !box) return;
      el.style.left   = `${ox + box.u * rw}px`;
      el.style.top    = `${oy + box.v * rh}px`;
      el.style.width  = `${box.w * rw}px`;
      el.style.height = `${box.h * rh}px`;
    };

    const isSleep = state.sleeping;
    const isLying = isSleep && isSleepSpriteLandscape();
    const isSit   = state.sitting || (isSleep && !isLying);

    place($('hs-window'),     L.window);
    place($('window-fx'),     L.window);
    place($('hs-clock'),      L.clock);
    place($('clock-overlay'), L.clockFace);
    place($('hs-shelf'),      L.shelf);
    place($('shelf-aura'),    L.shelfAura);
    place($('hs-poster'),     L.poster);
    place($('hs-lamp'),       L.lamp);
    place($('lamp-glow'),     L.lampGlow);
    place($('hs-trunk'),      L.trunk);
    place($('hs-rug'),        L.rug);
    place($('rug-pillow'),    isLying ? L.rugPillowSleep : L.rugPillow);
    place($('hs-plush'),      L.plush);
    place($('hs-bowl'),       L.bowl);

    // قرارگیری دقیق کاراکتر و ۶ ناحیه‌ی لمس بدن
    const rugBottomY = oy + L.charBottomV * rh;
    const charBottomPx = sh - rugBottomY;

    if (isLying) {
      // حالت خوابیده‌ی درازکش روی فرش (نسبت افقی ۳:۲)
      const sleepW = Math.min(sw * 0.78, rw * 0.78);
      const sp = loadedSprites.sleep;
      const sleepH = sp ? sleepW * (sp.height / sp.width) : sleepW * 0.66;
      const sleepBottomPx = charBottomPx - 8;

      charWrap.style.width  = `${sleepW}px`;
      charWrap.style.height = `${sleepH}px`;
      charWrap.style.bottom = `${sleepBottomPx}px`;
      charShadow.style.bottom = `${sleepBottomPx + 8}px`;

      const topY = sh - sleepBottomPx - sleepH;
      const leftX = (sw - sleepW) / 2;

      // مستطیل‌های کاملاً غیرهمپوشان (۰ پیکسل هم‌پوشانی و ۰ نشت گوشه به فرش)
      setRect($('hs-hair-l'), leftX + sleepW * 0.00, topY + sleepH * 0.08, sleepW * 0.08, sleepH * 0.78);
      setRect($('hs-head'),   leftX + sleepW * 0.08, topY + sleepH * 0.03, sleepW * 0.21, sleepH * 0.33);
      setRect($('hs-cheek'),  leftX + sleepW * 0.08, topY + sleepH * 0.36, sleepW * 0.21, sleepH * 0.24);
      setRect($('hs-hair-r'), leftX + sleepW * 0.29, topY + sleepH * 0.06, sleepW * 0.08, sleepH * 0.54);
      setRect($('hs-hand-l'), leftX + sleepW * 0.08, topY + sleepH * 0.60, sleepW * 0.29, sleepH * 0.32);
      setRect($('hs-hand-r'), leftX + sleepW * 0.37, topY + sleepH * 0.12, sleepW * 0.14, sleepH * 0.72);
      setRect($('hs-torso'),  leftX + sleepW * 0.51, topY + sleepH * 0.12, sleepW * 0.18, sleepH * 0.74);
      setRect($('hs-feet'),   leftX + sleepW * 0.69, topY + sleepH * 0.18, sleepW * 0.31, sleepH * 0.76);


    } else {
      // حالت ایستاده یا چهارزانو (هر دو ۵۶۰×۸۳۵ هم‌تراز از کف پا)
      const charH = L.charHeightV * rh;
      const charW = charH * (560 / 835);
      charWrap.style.width  = `${charW}px`;
      charWrap.style.height = `${charH}px`;
      charWrap.style.bottom = `${charBottomPx}px`;
      charShadow.style.bottom = `${charBottomPx + 4}px`;

      const topY = rugBottomY - charH;
      const leftX = (sw - charW) / 2;

      if (isSit) {
        // مستطیل‌های غیرهمپوشان منطبق بر سیلوت واقعی حالت چهارزانو
        setRect($('hs-hair-l'), leftX + charW * 0.32, topY + charH * 0.33, charW * 0.08, charH * 0.20);
        setRect($('hs-head'),   leftX + charW * 0.40, topY + charH * 0.31, charW * 0.20, charH * 0.11);
        setRect($('hs-cheek'),  leftX + charW * 0.40, topY + charH * 0.42, charW * 0.20, charH * 0.11);
        setRect($('hs-hair-r'), leftX + charW * 0.60, topY + charH * 0.33, charW * 0.08, charH * 0.20);
        setRect($('hs-hand-l'), leftX + charW * 0.23, topY + charH * 0.53, charW * 0.14, charH * 0.26);
        setRect($('hs-torso'),  leftX + charW * 0.37, topY + charH * 0.53, charW * 0.26, charH * 0.26);
        setRect($('hs-hand-r'), leftX + charW * 0.63, topY + charH * 0.53, charW * 0.14, charH * 0.26);
        setRect($('hs-feet'),   leftX + charW * 0.20, topY + charH * 0.79, charW * 0.60, charH * 0.20);


      } else {
        // مستطیل‌های غیرهمپوشان منطبق بر سیلوت حالت ایستاده با دست‌های طبیعی (بدون نشت گوشه به پنجره)
        setRect($('hs-hair-l'), leftX + charW * 0.32, topY + charH * 0.08, charW * 0.08, charH * 0.19);
        setRect($('hs-head'),   leftX + charW * 0.40, topY + charH * 0.06, charW * 0.20, charH * 0.11);
        setRect($('hs-cheek'),  leftX + charW * 0.40, topY + charH * 0.17, charW * 0.20, charH * 0.10);
        setRect($('hs-hair-r'), leftX + charW * 0.60, topY + charH * 0.08, charW * 0.08, charH * 0.19);
        setRect($('hs-hand-l'), leftX + charW * 0.26, topY + charH * 0.27, charW * 0.12, charH * 0.32);
        setRect($('hs-torso'),  leftX + charW * 0.38, topY + charH * 0.27, charW * 0.24, charH * 0.32);
        setRect($('hs-hand-r'), leftX + charW * 0.62, topY + charH * 0.27, charW * 0.12, charH * 0.32);
        setRect($('hs-feet'),   leftX + charW * 0.36, topY + charH * 0.59, charW * 0.28, charH * 0.40);

      }
    }
    placeBubble();
  }

  function setRect(el, x, y, w, h) {
    if (!el) return;
    el.style.left   = `${x}px`;
    el.style.top    = `${y}px`;
    el.style.width  = `${w}px`;
    el.style.height = `${h}px`;
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

  // ---------------- لودینگ تصاویر + حذف خودکار پس‌زمینه‌ی سبز (برای char-sleep.jpg) ----------------
  const loadedSprites = {};
  let activePose = 'idle';

  function isSleepSpriteLandscape() {
    const sp = loadedSprites.sleep;
    return Boolean(sp && sp.width > sp.height);
  }

  function processIfGreenScreen(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    if (p[3] < 180) return c;
    const isGreen = p[1] > 145 && p[1] > p[0] * 1.35 && p[1] > p[2] * 1.35;
    if (!isGreen) return c;

    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], g = p[i + 1], b = p[i + 2];
      const m = Math.max(r, b);
      const gr = g - m;
      if (gr > 44 && g > 90) {
        p[i + 3] = 0;
      } else if (gr > 10 && g > 50) {
        p[i + 3] = Math.round(p[i + 3] * clampFloat(1 - (gr - 10) / 34, 0, 1));
        p[i + 1] = Math.min(g, Math.round(r * 0.55 + b * 0.45));
      } else if (gr > 1) {
        p[i + 1] = m;
      }
      if (p[i + 3] < 14) p[i + 3] = 0;
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
      $('preloader-bar').style.width = `${Math.min(100, Math.round((done / total) * 100))}%`;
      if (msg) $('preloader-text').textContent = msg;
    };

    await Promise.all([
      loadImageWithFallback('assets/room-day').then((im) => {
        if (im) bgDay.src = im.src;
        tick('پنجره‌ی اتاق باز شد ☀️');
      }),
      loadImageWithFallback('assets/room-night').then((im) => {
        if (im) bgNight.src = im.src;
        tick('چراغ و ماه شب آماده شد 🌙');
      }),
    ]);

    await Promise.all(keys.map(async (key) => {
      const im = await loadImageWithFallback(SPRITE_BASES[key]);
      if (im) loadedSprites[key] = processIfGreenScreen(im);
      tick('آستولفو داره می‌پره توی اتاق 🎀');
    }));

    // اگر کاربر هنوز char-sleep جدید رو نذاشته، از پشتیبان استفاده کن
    if (!loadedSprites.sleep && loadedSprites.sleepSit) {
      loadedSprites.sleep = loadedSprites.sleepSit;
    }

    activePose = getBasePose();
    layoutRoomElements();
    renderCharacter();
    syncUI();

    setTimeout(() => {
      $('preloader').classList.add('done');
      playVoicePool(VOICE_POOLS.greet);
      say(pick('greet'), 5400);
    }, 240);
  }

  function getBasePose() {
    if (state.sleeping) return 'sleep';
    if (state.sitting) return 'sit';
    return 'idle';
  }

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
      charCtx.fillStyle = state.lampOn ? 'rgba(56, 64, 130, 0.24)' : 'rgba(30, 36, 90, 0.36)';
      charCtx.fillRect(0, 0, charCanvas.width, charCanvas.height);

      if (state.lampOn) {
        const rim = charCtx.createLinearGradient(charCanvas.width * 0.94, 0, charCanvas.width * 0.25, 0);
        rim.addColorStop(0, 'rgba(255, 206, 128, 0.34)');
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

  // ---------------- پلک زدن، سر کج و حرف‌زدن خودجوش آستولفو ----------------
  let reactionLockUntil = 0;
  let lastInteractionAt = Date.now();

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
    }, 6500 + Math.random() * 5000);
  }

  // افکت خواب + کاهش/احیای آمار هر ۱۰ ثانیه + گفتگوی خودجوش وقتی کاربر ساکت است
  setInterval(() => {
    if (state.sleeping) spawnZzz();
  }, 2300);

  setInterval(applyStatDecay, 10000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) applyStatDecay();
  });

  setInterval(() => {
    if (state.sleeping) return;
    if (Date.now() - lastInteractionAt < 14000) return;
    if (state.hunger < 30) { say(pick('hungryWarn'), 5200); return; }
    if (state.energy < 25) { say(pick('tiredWarn'), 5200); return; }
    if (Math.random() < 0.45) {
      if (!state.sitting) setTempPose('tilt', 1600);
      say(pick('idle'), 5000);
    }
  }, 18000);

  // ---------------- حباب گفتگو و ذرات ----------------
  let speechTimer = null;
  function say(text, duration = 4800) {
    speechText.textContent = text;
    speechBubble.classList.remove('is-hidden');
    requestAnimationFrame(placeBubble);
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
    const lying = isSleepSpriteLandscape();
    el.style.left = `${(lying ? 26 : 45) + Math.random() * 10}%`;
    el.style.top  = lying ? '66%' : '45%';
    el.style.fontSize = `${14 + Math.random() * 8}px`;
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }

  // ---------------- آمار و رابط کاربری ----------------
  function adjustStats(delta) {
    const xpMult = hasEquipped('fairy') ? 1.25 : 1.0;
    if (delta.love)   state.love   = clampFloat(state.love + delta.love);
    if (delta.hunger) state.hunger = clampFloat(state.hunger + delta.hunger);
    if (delta.energy) state.energy = clampFloat(state.energy + delta.energy);
    if (delta.coins)  state.coins  = Math.max(0, Math.round(state.coins + delta.coins));
    if (delta.xp)     state.xp    += Math.round(delta.xp * xpMult);
    state.lastTickAt = Date.now();
    saveState();
    syncUI();
  }

  function syncUI() {
    const level = Math.floor(state.xp / 100) + 1;
    const loveDisp   = Math.round(state.love);
    const hungerDisp = Math.round(state.hunger);
    const energyDisp = Math.round(state.energy);

    $('hud-level').textContent = `سطح ${level}`;
    $('hud-day').textContent   = `روز ${state.day}`;
    $('hud-coins').textContent = state.coins;
    $('shop-coins').textContent = state.coins;

    $('bar-love').style.width   = `${loveDisp}%`;
    $('bar-hunger').style.width = `${hungerDisp}%`;
    $('bar-energy').style.width = `${energyDisp}%`;
    $('val-love').textContent   = loveDisp;
    $('val-hunger').textContent = hungerDisp;
    $('val-energy').textContent = energyDisp;

    $('bar-love').closest('.stat-chip').classList.toggle('low', loveDisp < 28);
    $('bar-hunger').closest('.stat-chip').classList.toggle('low', hungerDisp < 28);
    $('bar-energy').closest('.stat-chip').classList.toggle('low', energyDisp < 25);

    $('btn-sound').textContent = state.sound ? '🔊' : '🔇';
    $('act-sit').classList.toggle('active', state.sitting && !state.sleeping);
    $('sit-label').textContent = state.sitting ? 'بلند شو' : 'چهارزانو';
    $('act-sleep').classList.toggle('active', state.sleeping);
    $('sleep-label').textContent = state.sleeping ? 'بیدار شو' : 'خوابیدن';

    const lying = state.sleeping && isSleepSpriteLandscape();
    const isSitVisual = state.sitting || (state.sleeping && !lying);
    const isNight = state.night || state.sleeping;

    appEl.classList.toggle('is-sitting', isSitVisual);
    appEl.classList.toggle('is-sleeping', state.sleeping);
    appEl.classList.toggle('sleep-lying', lying);
    appEl.classList.toggle('is-night', isNight);
    appEl.classList.toggle('lamp-on', state.lampOn);

    bgDay.classList.toggle('active', !isNight);
    bgNight.classList.toggle('active', isNight);

    $('char-crown').classList.toggle('hidden', !hasEquipped('crown'));
    $('char-ribbons').classList.toggle('hidden', !hasEquipped('ribbons'));
    $('shelf-aura').classList.toggle('hidden', !hasEquipped('horn'));
    $('rug-pillow').classList.toggle('hidden', !hasEquipped('pillow'));
    $('fairy-lights').classList.toggle('hidden', !hasEquipped('fairy'));

    layoutRoomElements();
    renderCharacter();
  }

  // ---------------- تعامل با تک‌تک بخش‌های بدن آستولفو ----------------
  function handleBodyTouch(zone) {
    lastInteractionAt = Date.now();
    if (state.sleeping) {
      playVoicePool(VOICE_POOLS.cheek);
      spawnParticles('💤', isSleepSpriteLandscape() ? 32 : 50, isSleepSpriteLandscape() ? 70 : 48, 2);
      say(pick('sleepPoke'), 4800);
      adjustStats({ love: 1.5, xp: 3 });
      return;
    }

    popCharacter();
    const sit = state.sitting;

    if (zone === 'head') {
      playVoicePool(VOICE_POOLS.pet);
      state.pets += 1;
      spawnParticles('💖', 50, sit ? 52 : 34, 5);
      setTempPose(sit ? 'sitHappy' : 'happy', 1550);
      adjustStats({ love: hasEquipped('ribbons') ? 8 : 6, coins: 2, xp: 10 });
      say(pick('pet'), 5000);
      return;
    }

    if (zone === 'hair') {
      playVoicePool(VOICE_POOLS.cheek);
      spawnParticles('🎀', 50, sit ? 54 : 36, 4);
      setTempPose(sit ? 'sitHappy' : 'tilt', 1500);
      adjustStats({ love: 4, xp: 6 });
      say(pick('touchHair'), 5000);
      return;
    }

    if (zone === 'cheek') {
      playVoicePool(VOICE_POOLS.cheek);
      spawnParticles('✨', 50, sit ? 56 : 38, 4);
      setTempPose(sit ? 'sitHappy' : 'happy', 1450);
      adjustStats({ love: 5, coins: 1, xp: 7 });
      say(pick('touchCheek'), 5000);
      return;
    }

    if (zone === 'hand') {
      playVoicePool(VOICE_POOLS.hand);
      spawnParticles('⭐', 50, sit ? 64 : 52, 4);
      setTempPose(sit ? 'sitHappy' : 'tilt', 1400);
      adjustStats({ love: 4, xp: 6 });
      say(pick('touchHand'), 5000);
      return;
    }

    if (zone === 'torso') {
      playVoicePool(VOICE_POOLS.torso);
      spawnParticles('💖', 50, sit ? 64 : 48, 3);
      setTempPose(sit ? 'sitHappy' : 'happy', 1300);
      adjustStats({ love: 3, xp: 5 });
      say(pick('touchTorso'), 5000);
      return;
    }

    if (zone === 'feet') {
      playVoicePool(VOICE_POOLS.cheek);
      spawnParticles('🪽', 50, 78, 3);
      if (!sit) setTempPose('tilt', 1300);
      adjustStats({ love: 2, xp: 4 });
      say(pick('touchFeet'), 5000);
    }
  }

  $('hs-head').addEventListener('click',   () => handleBodyTouch('head'));
  $('act-pet').addEventListener('click',   () => handleBodyTouch('head'));
  $('hs-hair-l').addEventListener('click', () => handleBodyTouch('hair'));
  $('hs-hair-r').addEventListener('click', () => handleBodyTouch('hair'));
  $('hs-cheek').addEventListener('click',  () => handleBodyTouch('cheek'));
  $('hs-hand-l').addEventListener('click', () => handleBodyTouch('hand'));
  $('hs-hand-r').addEventListener('click', () => handleBodyTouch('hand'));
  $('hs-torso').addEventListener('click',  () => handleBodyTouch('torso'));
  $('hs-feet').addEventListener('click',   () => handleBodyTouch('feet'));

  // ---------------- نشستن و خوابیدن (با اسپرایت درازکش مستقل!) ----------------
  function handleToggleSit() {
    lastInteractionAt = Date.now();
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
    say(pick(state.sitting ? 'sit' : 'stand'), 4800);
  }

  function wakeUpFromSleep(staySitting = false) {
    const sleptSec = (Date.now() - (state.sleepStartedAt || Date.now())) / 1000;
    const energyGained = state.energy - (state.sleepEnergyStart || state.energy);
    if (sleptSec >= 15 || energyGained >= 15) {
      state.day += 1;
    }
    state.sleeping = false;
    state.night = false;
    state.sitting = staySitting;
    playVoicePool(VOICE_POOLS.greet);
    popCharacter();
    activePose = getBasePose();
    syncUI();
    saveState();
    say(pick('sleepOff'), 5200);
  }

  function handleToggleSleep() {
    lastInteractionAt = Date.now();
    if (state.sleeping) {
      wakeUpFromSleep(false);
      return;
    }
    state.sleeping = true;
    state.night = true;
    state.lampOn = true;
    state.sitting = false; // خوابیدن حالت مستقل درازکش است، نه نشستن!
    state.sleepStartedAt = Date.now();
    state.sleepEnergyStart = state.energy;
    sfx.sleep();
    popCharacter();
    activePose = 'sleep';
    spawnZzz();
    syncUI();
    saveState();
    say(pick('sleepOn'), 5200);
  }

  $('hs-rug').addEventListener('click', handleToggleSit);
  $('act-sit').addEventListener('click', handleToggleSit);
  $('act-sleep').addEventListener('click', handleToggleSleep);

  // ---------------- اشیای اتاق اختصاصی آستولفو ----------------
  $('hs-window').addEventListener('click', () => {
    lastInteractionAt = Date.now();
    if (state.sleeping) { wakeUpFromSleep(false); return; }
    state.night = !state.night;
    playVoicePool(VOICE_POOLS.chat);
    syncUI();
    saveState();
    say(pick(state.night ? 'windowNight' : 'windowDay'), 4800);
  });

  $('hs-lamp').addEventListener('click', () => {
    lastInteractionAt = Date.now();
    playVoicePool(VOICE_POOLS.chat);
    if (!state.night && !state.sleeping) {
      say(pick('lampToggle'));
      return;
    }
    state.lampOn = !state.lampOn;
    syncUI();
    saveState();
    say(state.lampOn ? DIALOGUES.lampToggle[0] : DIALOGUES.lampToggle[1]);
  });

  $('hs-trunk').addEventListener('click', () => {
    lastInteractionAt = Date.now();
    const now = Date.now();
    if (now - (state.lastTrunkAt || 0) >= 180000) {
      state.lastTrunkAt = now;
      const bonus = 8 + Math.floor(Math.random() * 10);
      sfx.horn();
      spawnParticles('🪙', 14, 65, 5);
      adjustStats({ coins: bonus, love: 3, xp: 12 });
      say(pick('trunk'), 5200);
    } else {
      playVoicePool(VOICE_POOLS.chat);
      spawnParticles('🎀', 14, 65, 3);
      say(pick('trunk'));
    }
  });

  $('hs-shelf').addEventListener('click', () => {
    lastInteractionAt = Date.now();
    if (hasEquipped('horn')) sfx.horn(); else playVoicePool(VOICE_POOLS.chat);
    spawnParticles('✨', 20, 47, 4);
    say(pick('shelf'), 5400);
  });

  $('hs-clock').addEventListener('click', () => {
    lastInteractionAt = Date.now();
    playVoicePool(VOICE_POOLS.chat);
    say(pick('clock'));
  });

  $('hs-poster').addEventListener('click', () => {
    lastInteractionAt = Date.now();
    playVoicePool(VOICE_POOLS.chat);
    spawnParticles('⭐', 86, 29, 4);
    say(pick('poster'));
  });

  $('hs-plush').addEventListener('click', () => {
    lastInteractionAt = Date.now();
    playVoicePool(VOICE_POOLS.pet);
    spawnParticles('🪽', 80, 70, 3);
    say(pick('plush'));
  });

  $('hs-bowl').addEventListener('click', () => {
    lastInteractionAt = Date.now();
    if (state.hunger >= 98) {
      playVoicePool(VOICE_POOLS.chat);
      say(pick('bowl'));
      return;
    }
    playVoicePool(VOICE_POOLS.chat);
    spawnParticles('🍓', 65, 73, 4);
    if (!state.sleeping) setTempPose(state.sitting ? 'sitHappy' : 'happy', 1250);
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

  // ---------------- مودال‌ها ----------------
  const overlay = $('modal-overlay');
  const modals = {
    shop: $('modal-shop'),
    game: $('modal-game'),
    rank: $('modal-rank'),
    chat: $('modal-chat'),
  };

  function openModal(name) {
    lastInteractionAt = Date.now();
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

  // ---------------- فروشگاه ----------------
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

      const ico = document.createElement('div'); ico.className = 'ico'; ico.textContent = item.ico;
      const title = document.createElement('div'); title.className = 'title'; title.textContent = item.title;
      const desc = document.createElement('div'); desc.className = 'desc'; desc.textContent = item.desc;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `primary-btn small${equipped ? ' alt' : ''}`;

      if (owned && item.equippable) {
        btn.textContent = equipped ? 'نصب‌شده (برداشتن)' : 'نصب کن ✓';
        btn.addEventListener('click', () => {
          sfx.pop();
          state.equipped = equipped
            ? state.equipped.filter((x) => x !== item.id)
            : [...state.equipped, item.id];
          saveState();
          syncUI();
          renderShop();
        });
      } else {
        btn.textContent = `خرید (${item.price} 🪙)`;
        btn.disabled = state.coins < item.price;
        btn.addEventListener('click', () => {
          if (state.coins < item.price) return;
          playVoicePool(VOICE_POOLS.buy);
          if (item.unique) {
            state.owned.push(item.id);
            if (item.equippable) state.equipped.push(item.id);
          }
          adjustStats({ ...item.effect, coins: -item.price });
          renderShop();
          spawnParticles(item.ico, 50, 44, 5);
          if (!state.sleeping) setTempPose(state.sitting ? 'sitHappy' : 'happy', 1450);
          say('یاهو! اسم من آستولفوعه! کلاسم رایدره! و، و… خب، مراقبم باش!', 5000);
        });
      }

      card.append(ico, title, desc, btn);
      grid.appendChild(card);
    });
  }

  // ---------------- مینی‌گیم پرواز ستاره‌چین (۱۰۰٪ وکتور پاستلی، بدون ایموجی سیستمی) ----------------
  const gCanvas = $('game-canvas');
  const gCtx = gCanvas.getContext('2d');
  let gRunning = false, gRaf = null, gClock = null;
  let gScore = 0, gCombo = 0, gTime = 30, gBasketX = 190;
  let gDrops = [], gBursts = [];

  function drawStar(ctx, x, y, r, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.46;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = '#fde047'; ctx.strokeStyle = '#ca8a04'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke(); ctx.restore();
  }

  function drawHeart(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.65);
    ctx.bezierCurveTo(-s * 1.15, -s * 0.1, -s * 0.75, -s * 0.95, 0, -s * 0.3);
    ctx.bezierCurveTo(s * 0.75, -s * 0.95, s * 1.15, -s * 0.1, 0, s * 0.65);
    ctx.closePath();
    ctx.fillStyle = '#f472b6'; ctx.strokeStyle = '#be185d'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke(); ctx.restore();
  }

  function drawBerry(ctx, x, y, r) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, r * 1.05);
    ctx.quadraticCurveTo(-r * 0.95, r * 0.2, -r * 0.75, -r * 0.45);
    ctx.quadraticCurveTo(0, -r * 0.85, r * 0.75, -r * 0.45);
    ctx.quadraticCurveTo(r * 0.95, r * 0.2, 0, r * 1.05);
    ctx.fillStyle = '#fb7185'; ctx.strokeStyle = '#be123c'; ctx.lineWidth = 1.8;
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4ade80';
    ctx.beginPath(); ctx.ellipse(0, -r * 0.55, r * 0.48, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawStormCloud(ctx, x, y, r) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#7c3aed'; ctx.strokeStyle = '#4c1d95'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-r * 0.55, 2, r * 0.52, 0, Math.PI * 2);
    ctx.arc(0, -r * 0.28, r * 0.66, 0, Math.PI * 2);
    ctx.arc(r * 0.58, 2, r * 0.50, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -2); ctx.lineTo(-2, 2);
    ctx.moveTo(8, -2);  ctx.lineTo(2, 2);
    ctx.stroke(); ctx.restore();
  }

  function drawAstolfoBasket(ctx, x, y) {
    ctx.save(); ctx.translate(x, y);
    // بدنه‌ی سبد صورتی
    ctx.fillStyle = '#f472b6'; ctx.strokeStyle = '#9d174d'; ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-42, -9); ctx.lineTo(42, -9); ctx.lineTo(34, 15); ctx.lineTo(-34, 15);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // لبه‌ی شطرنجی سیاه‌وسفیدِ الهام‌گرفته از آستین هودی آستولفو
    for (let i = 0; i < 11; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#2b1a28' : '#ffffff';
      ctx.fillRect(-44 + i * 8, -15, 8, 7);
    }
    ctx.strokeStyle = '#382235'; ctx.lineWidth = 1.6;
    ctx.strokeRect(-44, -15, 88, 7);
    // ستاره‌ی طلایی وسط سبد
    drawStar(ctx, 0, 3, 6.5, 0);
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
      $('game-status').textContent = 'نیا~ انرژی‌م زیر ۱۰ شده! اول یه خوراکی برسون یا بذار چند ثانیه روی فرش دراز بکشم 🌙🍓';
      return;
    }
    stopGame();
    gRunning = true; gScore = 0; gCombo = 0; gTime = 30;
    gDrops = []; gBursts = []; gBasketX = gCanvas.width / 2;
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
    $('game-status').textContent = `یاهو! امتیازت ${gScore} شد و ${reward} سکه 🪙 بردیم!${hasEquipped('horn') ? ' (با پاداش +۳۰٪ لا بلک لونا!)' : ''}`;
    $('game-overlay').classList.remove('hidden');
    playVoicePool(VOICE_POOLS.celebrate);
    say('قدرت واقعیت رو نشون بده! هیپوگریف!', 5200);
  }

  function loopGame() {
    if (!gRunning) return;
    gCtx.clearRect(0, 0, gCanvas.width, gCanvas.height);

    gCtx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let s = 0; s < 14; s++) {
      gCtx.beginPath();
      gCtx.arc((s * 67) % gCanvas.width, (s * 43) % 240, 2, 0, Math.PI * 2);
      gCtx.fill();
    }

    if (Math.random() < 0.062) {
      const r = Math.random();
      const kind = r < 0.48 ? 'star' : r < 0.68 ? 'heart' : r < 0.80 ? 'berry' : 'cloud';
      gDrops.push({ x: 26 + Math.random() * (gCanvas.width - 52), y: -22, vy: 2.5 + Math.random() * 2.2, rot: Math.random() * Math.PI, kind });
    }

    drawAstolfoBasket(gCtx, gBasketX, gCanvas.height - 28);

    for (let i = gDrops.length - 1; i >= 0; i--) {
      const d = gDrops[i];
      d.y += d.vy; d.rot += 0.04;
      if (d.kind === 'star') drawStar(gCtx, d.x, d.y, 13, d.rot);
      else if (d.kind === 'heart') drawHeart(gCtx, d.x, d.y, 12);
      else if (d.kind === 'berry') drawBerry(gCtx, d.x, d.y, 12);
      else drawStormCloud(gCtx, d.x, d.y, 14);

      const hit = d.y >= gCanvas.height - 46 && d.y <= gCanvas.height - 10 && Math.abs(d.x - gBasketX) < 48;
      if (hit) {
        if (d.kind === 'cloud') {
          gCombo = 0; gScore = Math.max(0, gScore - 6);
          addGameBurst(d.x, d.y, '#7c3aed'); sfx.bad();
        } else {
          gCombo += 1;
          const mult = gCombo >= 10 ? 3 : gCombo >= 5 ? 2 : 1;
          gScore += (d.kind === 'heart' ? 10 : d.kind === 'berry' ? 8 : 5) * mult;
          addGameBurst(d.x, d.y, d.kind === 'star' ? '#fde047' : '#f472b6'); sfx.coin();
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
      gCtx.globalAlpha = b.life; gCtx.fillStyle = b.color;
      gCtx.beginPath(); gCtx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); gCtx.fill();
      gCtx.globalAlpha = 1;
    }
    gRaf = requestAnimationFrame(loopGame);
  }

  function moveBasket(clientX) {
    const rect = gCanvas.getBoundingClientRect();
    gBasketX = clampFloat((clientX - rect.left) * (gCanvas.width / rect.width), 46, gCanvas.width - 46);
  }

  gCanvas.addEventListener('pointermove', (e) => { if (gRunning) moveBasket(e.clientX); });
  gCanvas.addEventListener('pointerdown', (e) => { if (gRunning) moveBasket(e.clientX); });
  $('btn-game-start').addEventListener('click', startGame);

  // ---------------- لیدربورد همراهان Fate/Apocrypha (ایمن + هوک آماده برای بک‌اند زنده) ----------------
  const RIVALS = [
    { name: 'ژان دارک ⚜️', score: 210, level: 6 },
    { name: 'رولان ⚔️',    score: 165, level: 5 },
    { name: 'موردرد ⚡',    score: 130, level: 4 },
    { name: 'زیگ 🐉',      score: 95,  level: 3 },
    { name: 'فران 🌸',     score: 60,  level: 2 },
  ];

  async function renderRank() {
    $('player-name-input').value = state.playerName;
    const myLevel = Math.floor(state.xp / 100) + 1;
    let rows = null;

    if (typeof window.TWINKY_LEADERBOARD_API === 'string' && window.TWINKY_LEADERBOARD_API.startsWith('http')) {
      try {
        const res = await fetch(window.TWINKY_LEADERBOARD_API);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.rows)) rows = data.rows;
        }
      } catch {}
    }

    if (!rows) {
      rows = [
        ...RIVALS,
        { name: state.playerName || 'رفیق', score: state.bestScore, level: myLevel, isMe: true },
      ].sort((a, b) => b.score - a.score);
    }

    const list = $('rank-list');
    list.textContent = '';

    rows.forEach((row, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      const el = document.createElement('div');
      el.className = `rank-row${row.isMe ? ' is-me' : ''}`;

      const left = document.createElement('span');
      left.append(document.createTextNode(`${medal} ${String(row.name || '')} `));
      const lvl = document.createElement('small');
      lvl.style.opacity = '0.68';
      lvl.textContent = `(سطح ${Number(row.level) || 1})`;
      left.append(lvl);

      const right = document.createElement('strong');
      right.textContent = `${Number(row.score) || 0} امتیاز`;

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

  // ---------------- چت با لحن اصیل آستولفو + هوک آماده برای اندپوینت زنده ----------------
  async function generateAstolfoReply(msg) {
    if (typeof window.TWINKY_CHAT_API === 'string' && window.TWINKY_CHAT_API.startsWith('http')) {
      try {
        const res = await fetch(window.TWINKY_CHAT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: msg,
            state: {
              love: Math.round(state.love),
              hunger: Math.round(state.hunger),
              energy: Math.round(state.energy),
              sitting: state.sitting,
              sleeping: state.sleeping,
              night: state.night,
              name: state.playerName,
            },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.reply === 'string' && data.reply.trim()) return data.reply.trim();
        }
      } catch {}
    }

    const t = msg.trim();
    const who = state.playerName || 'رفیق';

    if (/سلام|درود|یاهو|نیا|هی|صبح|شب بخیر/.test(t)) {
      if (!state.sleeping) setTempPose(state.sitting ? 'sitHappy' : 'happy', 1350);
      playVoicePool(VOICE_POOLS.greet);
      return state.night
        ? `یاهو ${who}! شب شده و ماه طلایی از پنجره افتاده تو اتاق 🌙 بگو چه نقشه‌ای داریم؟`
        : `یاهو ${who}! نیا~ بالاخره پیدات شد 🎀 بی‌خیال قوانین خشک، امروز چه کار باحالی کنیم؟`;
    }
    if (/چطوری|حالت|خوبی|چه خبر/.test(t)) {
      if (state.hunger < 35) return `راستش ${who}، شکمم داره صدای شاخ لا بلک لونا درمیاره (${Math.round(state.hunger)}٪)! یه کرپ یا توت‌فرنگی بدی دوباره سرحال می‌شم 🍓`;
      if (state.energy < 30) return `انرژی‌م رسیده به ${Math.round(state.energy)}٪... یه کم روی فرش دراز بکشم دوباره می‌پرم هوا 🌙`;
      return `عالیِ عالی‌ام ${who}! رفاقتمون شده ${Math.round(state.love)}٪ و پُرم از حس ماجراجویی نیا~ ✨`;
    }
    if (/هیپوگریف|پرواز|اسب|بال/.test(t)) {
      spawnParticles('🪽', 50, 40, 4);
      return 'هیپوگریف بهترین هم‌سفر دنیاست! نصفش عقابه نصفش اسب، از قفس متنفره و توی آسمون هیچ‌کی به گردش نمی‌رسه 🪽⭐';
    }
    if (/کتاب|طلسم|لوگستیلا|قفسه|شاخ|لا بلک/.test(t)) {
      return 'اوه! اون کتاب بنفشِ روبان‌دار اسمش... اممم... کاسا دی لوگستیلا بود! آره! همه‌ی طلسم‌ها رو باطل می‌کنه، و کنارش هم شاخ طلاییِ لا بلک لوناست 🎺📚 هی‌هی~';
    }
    if (/غافلگیری|سورپرایز|صندوق|گنج/.test(t)) {
      return 'عاشق غافلگیری‌ام نیا~ 🎁 یه سر به صندوقچه‌ی پایین سمت چپ بزن، یا دست و لپمو لمس کن ببین چه واکنشی نشون می‌دم ✨';
    }
    if (/زیگ|رولان|موردرد|ژان|پالادین|شارلمانی|فیت/.test(t)) {
      return 'رفیق‌های قدیمیم رو می‌شناسی؟ زیگ خیلی خوش‌قلبه، رولان همیشه شلوغ‌کاری می‌کنه و موردرد هم زیادی جدیه! ولی بین خودمون باشه، گپ زدن با تو از همه باحال‌تره 🎀⚔️';
    }
    if (/دوستت|عشق|قشنگ|ناز|کیوت|زیبا|بهترین/.test(t)) {
      if (!state.sleeping) setTempPose(state.sitting ? 'sitHappy' : 'happy', 1550);
      spawnParticles('💖', 50, 36, 5);
      playVoicePool(VOICE_POOLS.love);
      adjustStats({ love: 5, xp: 6 });
      return `نیا~ خجالتم دادی ${who}! 💖 هر جا بری و هر ماجرایی پیش بیاد، رایدرِ سیاه تا آخرش کنارت می‌مونه!`;
    }
    if (/بشین|چهارزانو|فرش/.test(t)) {
      if (!state.sitting && !state.sleeping) handleToggleSit();
      return 'چشم! چهارزانو روی فرش نشستم 🎀 حالا تعریف کن چه خبر!';
    }
    if (/پاشو|بلند شو/.test(t)) {
      if (state.sitting || state.sleeping) handleToggleSit();
      return 'یاهو! پریدم بالا، آماده‌ی ماجراجویی‌ام ⚡';
    }
    if (/خواب|چرت|بخواب|دراز/.test(t)) {
      if (!state.sleeping) handleToggleSleep();
      return 'باشه، همینجا روی فرش دراز می‌کشم یه چرت حسابی بزنم 🌙💤';
    }
    if (/غذا|گرسنه|کرپ|کباب|توت|شیرتوت/.test(t)) {
      return 'اسمشو آوردی آب دهنم راه افتاد نیا~ 🍰 بزن روی گنجینه یا کاسه‌ی ستاره‌ای تا یه ضیافت راه بندازیم!';
    }
    if (/بازی|ستاره|رکورد/.test(t)) {
      return `پایه‌ام! رکوردت الان ${state.bestScore} امتیازه — بزن بریم توی «پرواز ستاره» از رولان و موردرد جلو بزنیم ⭐🪽`;
    }
    if (/قانون|رسمی|قفس/.test(t)) {
      return 'اَه نه! از قوانین خشک و قفس متنفرم! آدم باید آزادِ آزاد باشه و دنبال غافلگیری و خوش‌گذرونی بره 🎀✨';
    }

    if (!state.sitting && !state.sleeping) setTempPose('tilt', 1600);
    playVoicePool(VOICE_POOLS.confused);
    const dynamic = [
      `جالبه ${who}! اینکه گفتی «${t}» یه ایده‌ی شیطنت‌آمیز تو سرم انداخت نیا~ ✨ بیشتر بگو!`,
      `هی‌هی، حرف زدن با تو از همه‌ی تشریفات قصر بهتره 🎀 راستی حواست به سکه‌هات (${state.coins} 🪙) هست؟`,
      `سرمو کج کردم کامل گوش بدم ${who}! هر ماجرایی بگی من پایه‌ام 💖`,
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
    lastInteractionAt = Date.now();
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
