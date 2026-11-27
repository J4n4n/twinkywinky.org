(() => {
  'use strict';

  // اگر فایل‌های تصویری را با پسوند .jpg ذخیره کردید، این مقدار را به '.jpg' تغییر دهید
  const IMG_EXT = '.png';
  const STORAGE_KEY = 'twinkywinky_anime_v1';

  const SPRITE_FILES = {
    idle:  `assets/char-idle${IMG_EXT}`,
    blink: `assets/char-blink${IMG_EXT}`,
    tilt:  `assets/char-tilt${IMG_EXT}`,
    happy: `assets/char-happy${IMG_EXT}`,
    sit:   `assets/char-sit${IMG_EXT}`,
    sleep: `assets/char-sleep${IMG_EXT}`,
  };

  // ---------------- موتور صوتی داخلی (Web Audio API — بدون نیاز به فایل MP3) ----------------
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }
    ensure() {
      if (!this.enabled) return null;
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) this.ctx = new Ctx();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    tone(freq, dur = 0.12, type = 'sine', vol = 0.08, delay = 0) {
      const ctx = this.ensure();
      if (!ctx) return;
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
    pet()   { this.tone(660, 0.11, 'sine', 0.08, 0); this.tone(880, 0.16, 'triangle', 0.08, 0.07); }
    pop()   { this.tone(520, 0.09, 'sine', 0.07); }
    sit()   { this.tone(420, 0.1, 'sine', 0.07, 0); this.tone(540, 0.12, 'sine', 0.06, 0.06); }
    sleep() { this.tone(392, 0.25, 'sine', 0.06, 0); this.tone(330, 0.35, 'sine', 0.05, 0.15); }
    coin()  { this.tone(988, 0.08, 'triangle', 0.08, 0); this.tone(1318, 0.16, 'triangle', 0.08, 0.06); }
    bad()   { this.tone(220, 0.18, 'sawtooth', 0.05); }
  }

  const sfx = new SoundFX();

  // ---------------- استخرهای دیالوگ فارسی غیرتکراری ----------------
  const DIALOGUES = {
    greet: [
      'سلام! خوش اومدی به اتاقم 🌸 امروز قراره کلی خوش بگذره!',
      'هی! بالاخره اومدی! داشتم منتظرت می‌موندم ✨',
      'چه هوای قشنگی از پنجره پیداست! حالت چطوره؟',
    ],
    pet: [
      'اوووه! چه دستای گرمی داری، بازم سرمو ناز کن 💖',
      'هی‌هی! اینجوری نازم می‌کنی کل خستگیم در می‌ره ✨',
      'آخیش! حس خیلی خوبی داره... ممنونم 🌸',
      'اگه همینجوری ادامه بدی تا شب لبخند از صورتم نمی‌ره! 💕',
    ],
    sit: [
      'آخیش! این فرش گرد انقدر نرمه که نشستن روش حال می‌ده 🌸',
      'چهارزانو اینجا می‌شینم یه کم استراحت کنم ✨',
      'بیا تو هم بشین، از اینجا کل اتاق قشنگ‌تر دیده می‌شه!',
    ],
    stand: [
      'خب! پاشم سر جام وایسم ببینم چه خبره ✨',
      'استراحت کافی بود، الان سرحالم!',
    ],
    shelf: [
      'این قفسه پر از مانگا و کتابای مورد علاقه‌مه! کاکتوس کوچولو هم مراقبشونه 🌵📚',
      'دیشب داشتم یه داستان فانتزی از همین قفسه می‌خوندم، آخرش خیلی قشنگ بود!',
      'مراقب گلدون روی قفسه باشی ها، تازه یه غنچه‌ی ریز داده 🌱',
    ],
    clock: [
      'ساعت دیواری می‌گه الان بهترین وقت برای یه استراحت کوتاه یا یه دست بازیه ⏰',
      'وقتی پیش منی اصلاً متوجه گذر زمان نمی‌شم!',
    ],
    poster: [
      'این پوستر ستاره‌ای رو خودم به دیوار زدم! هر وقت نگاهش می‌کنم انرژی می‌گیرم ⭐',
      'ستاره‌ها توی شب حتی از پوسترشون هم قشنگ‌ترن!',
    ],
    bunny: [
      'این خرگوشی بهترین دوست اتاقمه! خیلی نرمه، نه؟ 🐰',
      'خرگوشی می‌گه امروز قراره رکورد بازی ستاره‌چین رو بزنی!',
    ],
    bowl: [
      'اوه! یه خوراکی خوشمزه! مرسی که حواست بهم هست 🍓',
      'کاسه پر شد! دلم حسابی ضعف رفته بود، دستت درد نکنه ✨',
    ],
    sleepOn: [
      'چراغ رو روشن گذاشتم ولی هوا تاریکه... شب بخیر، یه کم چرت می‌زنم 🌙',
      'چشمام سنگین شده... یه خواب کوتاه روی فرش خیلی می‌چسبه 💤',
    ],
    sleepOff: [
      'صبح بخیر! چه خواب راحتی بود، پرانرژی شدم ☀️',
      'بیدار شدم! حالا بگو چیکار کنیم؟ 🌸',
    ],
    idle: [
      'راستی، از این پنجره‌ی گرد ابرا خیلی آروم رد می‌شن ☁️',
      'اگه حوصلت سر رفت بیا یه دست ستاره‌چین بازی کنیم 🎮',
      'هر وقت خواستی یه چیزی برام بنویس، همینجا گوش می‌دم 💬',
    ],
  };

  const poolMemory = {};
  function pickDialogue(key) {
    const list = DIALOGUES[key] || DIALOGUES.idle;
    if (!poolMemory[key] || poolMemory[key].length === 0) {
      poolMemory[key] = list.map((_, i) => i).sort(() => Math.random() - 0.5);
    }
    return list[poolMemory[key].pop()];
  }

  // ---------------- آیتم‌های فروشگاه ----------------
  const SHOP_ITEMS = [
    { id: 'strawberry', cat: 'food',  ico: '🍓', title: 'توت‌فرنگی تازه',   desc: '+۲۵ سیری و +۱۰ محبت', price: 15, effect: { hunger: 25, love: 10 } },
    { id: 'cake',       cat: 'food',  ico: '🍰', title: 'کیک خامه‌ای',      desc: '+۳۵ سیری و +۱۵ انرژی', price: 25, effect: { hunger: 35, energy: 15 } },
    { id: 'boba',       cat: 'food',  ico: '🧋', title: 'بابل‌تی شیرتوت',   desc: '+۳۰ انرژی و +۱۵ محبت', price: 20, effect: { energy: 30, love: 15 } },
    { id: 'ribbon',     cat: 'gift',  ico: '🎀', title: 'روبان صورتی جدید', desc: '+۳۰ محبت و +۴۰ امتیاز', price: 35, effect: { love: 30, xp: 40 }, unique: true },
    { id: 'starclip',   cat: 'gift',  ico: '⭐', title: 'سنجاق ستاره طلایی', desc: '+۴۰ محبت و +۶۰ امتیاز', price: 50, effect: { love: 40, xp: 60 }, unique: true },
    { id: 'plush',      cat: 'decor', ico: '🧸', title: 'بالشتک ابر نرم',    desc: '+۳۵ انرژی در خواب',     price: 45, effect: { energy: 35, xp: 50 }, unique: true },
    { id: 'manga',      cat: 'decor', ico: '📚', title: 'مجموعه مانگا نایاب', desc: '+۲۵ محبت و +۵۰ امتیاز', price: 40, effect: { love: 25, xp: 50 }, unique: true },
    { id: 'tea',        cat: 'food',  ico: '🍵', title: 'چای بابونه آرامش',  desc: '+۴۰ انرژی و +۱۰ سیری',  price: 18, effect: { energy: 40, hunger: 10 } },
  ];

  // ---------------- وضعیت ذخیره‌شونده ----------------
  const defaultState = {
    playerName: 'تو',
    coins: 50,
    xp: 0,
    day: 1,
    love: 75,
    hunger: 80,
    energy: 85,
    pets: 0,
    bestScore: 0,
    sitting: false,
    sleeping: false,
    night: false,
    sound: true,
    owned: [],
    chatLog: [
      { from: 'bot', text: 'سلام! به اتاق من خوش اومدی 🌸 هر وقت خواستی سرمو ناز کن، روی فرش بزن تا بشینم، یا باهام چت کن!' }
    ],
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaultState, ...JSON.parse(raw) } : { ...defaultState };
    } catch {
      return { ...defaultState };
    }
  }

  const state = loadState();
  sfx.enabled = state.sound;

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  // ---------------- عناصر DOM ----------------
  const $ = (id) => document.getElementById(id);
  const appEl = $('app');
  const charCanvas = $('char-canvas');
  const charCtx = charCanvas.getContext('2d');
  const fxLayer = $('fx-layer');
  const speechBubble = $('speech-bubble');
  const speechText = $('speech-text');
  const bgDay = $('room-bg-day');
  const bgNight = $('room-bg-night');

  // ---------------- موتور خودکار حذف پس‌زمینه‌ی سبز (Chroma-Key + Despill) ----------------
  const processedSprites = {};
  let activePose = 'idle'; // idle | blink | tilt | happy | sit | sleep

  function processChromaKey(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imgData.data;

    // اگر تصویر از قبل PNG شفاف واقعی است، دست‌نخورده برگردان
    if (d[3] < 200 && d[((c.width - 1) * 4) + 3] < 200) {
      return c;
    }

    // بررسی اینکه آیا گوشه‌های تصویر سبز کروماکی هستند
    const isCornerGreen = d[1] > 160 && d[1] > d[0] * 1.4 && d[1] > d[2] * 1.4;
    if (!isCornerGreen) return c;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const maxRB = Math.max(r, b);
      const greenness = g - maxRB;

      if (greenness > 58 && g > 110) {
        // پس‌زمینه‌ی سبز خالص -> کاملاً شفاف
        d[i + 3] = 0;
      } else if (greenness > 16 && g > 70) {
        // لبه‌ی ضدپله (Anti-aliased edge) -> شفافیت نرم + حذف کامل هاله‌ی سبز (Despill)
        const alphaFactor = Math.max(0, Math.min(1, 1 - (greenness - 16) / 42));
        d[i + 3] = Math.round(d[i + 3] * alphaFactor);
        d[i + 1] = maxRB; // حذف کامل ته‌رنگ سبز از لبه
      } else if (greenness > 4) {
        // حذف بازتاب 미세 سبز روی لبه‌ی هودی سفید و موی صورتی
        d[i + 1] = Math.min(g, maxRB + 4);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return c;
  }

  function loadAllSprites() {
    const keys = Object.keys(SPRITE_FILES);
    keys.forEach((key) => {
      const img = new Image();
      img.onload = () => {
        processedSprites[key] = processChromaKey(img);
        if (key === getCurrentBasePose() || key === 'idle') renderCharacter();
      };
      img.onerror = () => {
        // اگر پسوند png نبود، خودکار jpg را هم امتحان کن
        if (!img.dataset.fallback) {
          img.dataset.fallback = '1';
          img.src = SPRITE_FILES[key].replace(/\.png$/i, '.jpg');
        }
      };
      img.src = SPRITE_FILES[key];
    });
  }

  function getCurrentBasePose() {
    if (state.sleeping) return 'sleep';
    if (state.sitting) return 'sit';
    return 'idle';
  }

  function renderCharacter() {
    const sprite = processedSprites[activePose] || processedSprites[getCurrentBasePose()] || processedSprites.idle;
    if (!sprite) return;

    if (charCanvas.width !== sprite.width || charCanvas.height !== sprite.height) {
      charCanvas.width = sprite.width;
      charCanvas.height = sprite.height;
    }
    charCtx.clearRect(0, 0, charCanvas.width, charCanvas.height);
    charCtx.drawImage(sprite, 0, 0);
  }

  // ---------------- انیمیشن زنده فقط برای سر (پلک زدن + کج‌شدن خفیف سر، بدن کاملاً ثابت) ----------------
  let reactionLockUntil = 0;

  function setTemporaryPose(pose, durationMs) {
    activePose = pose;
    renderCharacter();
    reactionLockUntil = Date.now() + durationMs;
    setTimeout(() => {
      if (Date.now() >= reactionLockUntil - 20) {
        activePose = getCurrentBasePose();
        renderCharacter();
      }
    }, durationMs);
  }

  function scheduleBlink() {
    const nextMs = 2800 + Math.random() * 2800;
    setTimeout(() => {
      if (Date.now() > reactionLockUntil && !state.sleeping && !state.sitting) {
        activePose = 'blink';
        renderCharacter();
        setTimeout(() => {
          if (Date.now() > reactionLockUntil && activePose === 'blink') {
            activePose = getCurrentBasePose();
            renderCharacter();
          }
        }, 160);
      }
      scheduleBlink();
    }, nextMs);
  }

  function scheduleHeadTilt() {
    const nextMs = 7000 + Math.random() * 5500;
    setTimeout(() => {
      if (Date.now() > reactionLockUntil && !state.sleeping && !state.sitting) {
        activePose = 'tilt';
        renderCharacter();
        setTimeout(() => {
          if (Date.now() > reactionLockUntil && activePose === 'tilt') {
            activePose = getCurrentBasePose();
            renderCharacter();
          }
        }, 1800);
      }
      scheduleHeadTilt();
    }, nextMs);
  }

  // افکت Zzz هنگام خواب و احیای آرام انرژی
  setInterval(() => {
    if (state.sleeping) {
      spawnZzz();
      if (state.energy < 100) {
        adjustStats({ energy: 2 });
      }
    }
  }, 2400);

  // دیالوگ تصادفی آرام وقتی کاربر مدت زیادی کلیک نکرده
  setInterval(() => {
    if (!state.sleeping && Math.random() < 0.28) {
      say(pickDialogue('idle'), 4800);
    }
  }, 22000);

  // ---------------- حباب گفتگو و افکت‌ها ----------------
  let speechTimer = null;
  function say(text, duration = 4500) {
    speechText.textContent = text;
    speechBubble.classList.remove('is-hidden');
    clearTimeout(speechTimer);
    speechTimer = setTimeout(() => {
      speechBubble.classList.add('is-hidden');
    }, duration);
  }

  function spawnParticles(symbol, xPct, yPct, count = 4) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'fx-particle';
      el.textContent = symbol;
      el.style.left = `${xPct + (Math.random() * 16 - 8)}%`;
      el.style.top = `${yPct + (Math.random() * 10 - 5)}%`;
      el.style.setProperty('--dx', `${Math.round(Math.random() * 48 - 24)}px`);
      el.style.animationDelay = `${i * 75}ms`;
      fxLayer.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    }
  }

  function spawnZzz() {
    const el = document.createElement('span');
    el.className = 'fx-zzz';
    el.textContent = 'Zzz';
    el.style.left = `${44 + Math.random() * 10}%`;
    el.style.top = '42%';
    el.style.fontSize = `${14 + Math.random() * 8}px`;
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }

  // ---------------- به‌روزرسانی آمار و رابط کاربری ----------------
  function clamp(v, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(v)));
  }

  function adjustStats(delta) {
    if (delta.love)   state.love = clamp(state.love + delta.love);
    if (delta.hunger) state.hunger = clamp(state.hunger + delta.hunger);
    if (delta.energy) state.energy = clamp(state.energy + delta.energy);
    if (delta.coins)  state.coins = Math.max(0, state.coins + delta.coins);
    if (delta.xp)     state.xp += delta.xp;
    saveState();
    syncUI();
  }

  function syncUI() {
    const level = Math.floor(state.xp / 100) + 1;
    $('hud-level').textContent = `سطح ${level}`;
    $('hud-day').textContent = `روز ${state.day}`;
    $('hud-coins').textContent = state.coins;
    $('shop-coins').textContent = state.coins;

    $('bar-love').style.width = `${state.love}%`;
    $('bar-hunger').style.width = `${state.hunger}%`;
    $('bar-energy').style.width = `${state.energy}%`;
    $('val-love').textContent = state.love;
    $('val-hunger').textContent = state.hunger;
    $('val-energy').textContent = state.energy;

    $('btn-sound').textContent = state.sound ? '🔊' : '🔇';
    $('act-sit').classList.toggle('active', state.sitting && !state.sleeping);
    $('sit-label').textContent = state.sitting ? 'بلند شو' : 'چهارزانو';
    $('act-sleep').classList.toggle('active', state.sleeping);
    $('sleep-label').textContent = state.sleeping ? 'بیدار شو' : 'خواب';

    appEl.classList.toggle('is-sitting', state.sitting || state.sleeping);
    appEl.classList.toggle('is-night', state.night || state.sleeping);
    bgDay.classList.toggle('active', !(state.night || state.sleeping));
    bgNight.classList.toggle('active', state.night || state.sleeping);
  }

  // ---------------- اکشن‌های اصلی ----------------
  function handlePetHead() {
    if (state.sleeping) {
      sfx.pop();
      spawnParticles('💤', 50, 44, 2);
      say('آممم... الان خوابم، خیلی آروم نازم کن... 🌙');
      adjustStats({ love: 3, xp: 5 });
      return;
    }
    sfx.pet();
    state.pets += 1;
    const headY = state.sitting ? 45 : 31;
    spawnParticles('💖', 50, headY, 5);
    if (!state.sitting) {
      setTemporaryPose('happy', 1500);
    }
    adjustStats({ love: 6, coins: 2, xp: 10 });
    say(pickDialogue('pet'));
  }

  function handleToggleSit() {
    if (state.sleeping) {
      state.sleeping = false;
      state.night = false;
      state.sitting = true;
    } else {
      state.sitting = !state.sitting;
    }
    sfx.sit();
    activePose = getCurrentBasePose();
    renderCharacter();
    syncUI();
    saveState();
    say(pickDialogue(state.sitting ? 'sit' : 'stand'));
  }

  function handleToggleSleep() {
    state.sleeping = !state.sleeping;
    if (state.sleeping) {
      state.night = true;
      state.sitting = true;
      sfx.sleep();
      spawnZzz();
      say(pickDialogue('sleepOn'), 5000);
    } else {
      state.night = false;
      state.sitting = false;
      state.day += 1;
      sfx.pet();
      say(pickDialogue('sleepOff'), 5000);
    }
    activePose = getCurrentBasePose();
    renderCharacter();
    syncUI();
    saveState();
  }

  function handleToggleLamp() {
    if (state.sleeping) {
      handleToggleSleep();
      return;
    }
    state.night = !state.night;
    sfx.pop();
    syncUI();
    saveState();
    say(state.night ? 'چراغ رو روشن کردم، شبای این اتاق خیلی دنج می‌شه ✨' : 'هوای روز اومد توی اتاق! چه نور قشنگی ☀️');
  }

  // اتصال رویدادهای اتاق و دکمه‌ها
  $('hs-head').addEventListener('click', handlePetHead);
  $('act-pet').addEventListener('click', handlePetHead);
  $('hs-rug').addEventListener('click', handleToggleSit);
  $('act-sit').addEventListener('click', handleToggleSit);
  $('act-sleep').addEventListener('click', handleToggleSleep);
  $('hs-lamp').addEventListener('click', handleToggleLamp);

  $('hs-shelf').addEventListener('click', () => {
    sfx.pop();
    spawnParticles('✨', 15, 48, 3);
    say(pickDialogue('shelf'), 5000);
  });

  $('hs-clock').addEventListener('click', () => {
    sfx.pop();
    say(pickDialogue('clock'));
  });

  $('hs-poster').addEventListener('click', () => {
    sfx.pop();
    spawnParticles('⭐', 85, 33, 3);
    say(pickDialogue('poster'));
  });

  $('hs-bunny').addEventListener('click', () => {
    sfx.pet();
    spawnParticles('💕', 88, 76, 3);
    say(pickDialogue('bunny'));
  });

  $('hs-bowl').addEventListener('click', () => {
    sfx.coin();
    spawnParticles('🍓', 72, 82, 3);
    adjustStats({ hunger: 12, love: 4, xp: 6 });
    say(pickDialogue('bowl'));
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
    if (name === 'chat') renderChatLog();
    if (name === 'game') $('game-best').textContent = state.bestScore;
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
  $('btn-open-shop').addEventListener('click', () => openModal('shop'));
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
    grid.innerHTML = '';
    const items = SHOP_ITEMS.filter((it) => shopCat === 'all' || it.cat === shopCat);

    items.forEach((item) => {
      const owned = item.unique && state.owned.includes(item.id);
      const card = document.createElement('div');
      card.className = 'shop-item';
      card.innerHTML = `
        <div class="ico">${item.ico}</div>
        <div class="title">${item.title}</div>
        <div class="desc">${item.desc}</div>
        <button class="primary-btn small" type="button" ${owned || state.coins < item.price ? 'disabled' : ''}>
          ${owned ? 'دارم ✓' : `خرید (${item.price} 🪙)`}
        </button>
      `;
      card.querySelector('button').addEventListener('click', () => {
        if (state.coins < item.price || owned) return;
        sfx.coin();
        if (item.unique) state.owned.push(item.id);
        adjustStats({ ...item.effect, coins: -item.price });
        renderShop();
        spawnParticles(item.ico, 50, 42, 4);
        say(`وای مرسی! ${item.title} خیلی عالیه! 💖`, 4500);
      });
      grid.appendChild(card);
    });
  }

  // ---------------- مینی‌گیم ستاره‌چین ----------------
  const gCanvas = $('game-canvas');
  const gCtx = gCanvas.getContext('2d');
  let gRunning = false;
  let gRaf = null;
  let gClock = null;
  let gScore = 0;
  let gTime = 30;
  let gBasketX = 190;
  let gDrops = [];

  function stopGame() {
    gRunning = false;
    cancelAnimationFrame(gRaf);
    clearInterval(gClock);
  }

  function startGame() {
    stopGame();
    gRunning = true;
    gScore = 0;
    gTime = 30;
    gDrops = [];
    gBasketX = gCanvas.width / 2;
    $('game-score').textContent = '0';
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
    const reward = Math.max(5, Math.floor(gScore / 2));
    if (gScore > state.bestScore) state.bestScore = gScore;
    adjustStats({ coins: reward, xp: Math.min(80, gScore * 2), energy: -8, love: 5 });
    $('game-best').textContent = state.bestScore;
    $('game-status').textContent = `آفرین! امتیازت ${gScore} شد و ${reward} سکه 🪙 برنده شدی!`;
    $('game-overlay').classList.remove('hidden');
    sfx.coin();
    say(`ایول! توی ستاره‌چین ${gScore} امتیاز گرفتی و ${reward} سکه بردیم! ⭐`, 5000);
  }

  function loopGame() {
    if (!gRunning) return;
    gCtx.clearRect(0, 0, gCanvas.width, gCanvas.height);

    if (Math.random() < 0.055) {
      const r = Math.random();
      const kind = r < 0.58 ? 'star' : r < 0.8 ? 'heart' : 'cloud';
      gDrops.push({
        x: 24 + Math.random() * (gCanvas.width - 48),
        y: -20,
        vy: 2.3 + Math.random() * 2.1,
        kind,
      });
    }

    // سبد بازیکن
    gCtx.fillStyle = '#f472b6';
    gCtx.beginPath();
    gCtx.roundRect(gBasketX - 42, gCanvas.height - 34, 84, 20, 10);
    gCtx.fill();
    gCtx.font = '15px Vazirmatn, sans-serif';
    gCtx.textAlign = 'center';
    gCtx.fillStyle = '#ffffff';
    gCtx.fillText('🌸 سبد', gBasketX, gCanvas.height - 19);

    gCtx.font = '26px sans-serif';
    for (let i = gDrops.length - 1; i >= 0; i--) {
      const d = gDrops[i];
      d.y += d.vy;
      const emoji = d.kind === 'star' ? '⭐' : d.kind === 'heart' ? '💖' : '☁️';
      gCtx.fillText(emoji, d.x, d.y);

      const hit = d.y >= gCanvas.height - 44 && d.y <= gCanvas.height - 10 && Math.abs(d.x - gBasketX) < 46;
      if (hit) {
        if (d.kind === 'cloud') {
          gScore = Math.max(0, gScore - 5);
          sfx.bad();
        } else {
          gScore += d.kind === 'heart' ? 10 : 5;
          sfx.coin();
        }
        $('game-score').textContent = gScore;
        gDrops.splice(i, 1);
      } else if (d.y > gCanvas.height + 30) {
        gDrops.splice(i, 1);
      }
    }

    gRaf = requestAnimationFrame(loopGame);
  }

  function moveBasket(clientX) {
    const rect = gCanvas.getBoundingClientRect();
    const ratio = gCanvas.width / rect.width;
    gBasketX = Math.max(44, Math.min(gCanvas.width - 44, (clientX - rect.left) * ratio));
  }

  gCanvas.addEventListener('pointermove', (e) => { if (gRunning) moveBasket(e.clientX); });
  gCanvas.addEventListener('pointerdown', (e) => { if (gRunning) moveBasket(e.clientX); });
  $('btn-game-start').addEventListener('click', startGame);

  // ---------------- لیدربورد ----------------
  const NPC_BOARD = [
    { name: 'سارا 🌸', score: 165, level: 5 },
    { name: 'آرش ⭐',  score: 120, level: 4 },
    { name: 'نیلوفر 🎀', score: 95,  level: 3 },
    { name: 'کیان 🎮',  score: 60,  level: 2 },
  ];

  function renderRank() {
    $('player-name-input').value = state.playerName;
    const myLevel = Math.floor(state.xp / 100) + 1;
    const rows = [
      ...NPC_BOARD,
      { name: state.playerName || 'تو', score: state.bestScore, level: myLevel, isMe: true },
    ].sort((a, b) => b.score - a.score);

    const list = $('rank-list');
    list.innerHTML = '';
    rows.forEach((row, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      const el = document.createElement('div');
      el.className = `rank-row ${row.isMe ? 'is-me' : ''}`;
      el.innerHTML = `
        <span>${medal} ${row.name} <small style="opacity:.65">(سطح ${row.level})</small></span>
        <strong>${row.score} امتیاز</strong>
      `;
      list.appendChild(el);
    });
  }

  $('btn-save-name').addEventListener('click', () => {
    const val = $('player-name-input').value.trim();
    if (!val) return;
    state.playerName = val;
    saveState();
    sfx.pop();
    renderRank();
  });

  // ---------------- چت هوشمند داخل سایت ----------------
  function generateReply(msg) {
    const t = msg.trim();
    if (/سلام|درود|چطوری|خوبی|صبح|شب/.test(t)) {
      return 'سلام عزیز دلم! من عالی‌ام، همین که اومدی پیشم کلی خوشحال شدم 🌸';
    }
    if (/دوستت|عشق|قشنگ|ناز|کیوت|زیبا/.test(t)) {
      if (!state.sitting && !state.sleeping) setTemporaryPose('happy', 1500);
      spawnParticles('💖', 50, 35, 4);
      adjustStats({ love: 5, xp: 6 });
      return 'اوووه خجالتم دادی! 💖 منم خیلی خوشحالم که پیشمی!';
    }
    if (/خواب|خسته|بخواب/.test(t)) {
      return 'اگه خوابم بیاد روی همین فرش گرد چرت می‌زنم 🌙 دکمه‌ی خواب رو بزن تا چراغ شب روشن بشه!';
    }
    if (/کتاب|قفسه|بخون|گلدون/.test(t)) {
      return 'روی قفسه کلی کتاب و یه کاکتوس کوچولو دارم! روی قفسه بزن تا درباره‌شون بگم 📚';
    }
    if (/غذا|گرسنه|کیک|توت/.test(t)) {
      return 'وای اسمشو آوردی دلم خوراکی خواست! 🍓 از فروشگاه یا کاسه‌ی غذا برام یه چیز خوشمزه بیار!';
    }
    if (/بازی|ستاره|رکورد/.test(t)) {
      return 'پایه‌ی بازی ستاره‌چینی؟ 🎮 بیا ببینیم می‌تونی رکورد جدید بزنی و سکه ببری یا نه!';
    }
    if (/بشین|فرش/.test(t)) {
      if (!state.sitting) handleToggleSit();
      return 'چشم! چهارزانو روی فرش نشستم 🌸';
    }
    const fallbacks = [
      `جالبه که گفتی «${t}»! دوست دارم بیشتر برام تعریف کنی ✨`,
      'گوش می‌دم! سرم رو کج کردم که کامل حواسم به حرفات باشه 🌸',
      'هی‌هی، حرف زدن با تو توی این اتاق دنج بهترین بخش روزمه 💕',
    ];
    if (!state.sitting && !state.sleeping) setTemporaryPose('tilt', 1600);
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  function renderChatLog() {
    const list = $('chat-log-list');
    list.innerHTML = '';
    state.chatLog.slice(-40).forEach((m) => {
      const div = document.createElement('div');
      div.className = `chat-msg ${m.from}`;
      div.textContent = m.text;
      list.appendChild(div);
    });
    list.scrollTop = list.scrollHeight;
  }

  $('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sfx.pop();

    state.chatLog.push({ from: 'user', text });
    const reply = generateReply(text);
    state.chatLog.push({ from: 'bot', text: reply });
    if (state.chatLog.length > 60) state.chatLog = state.chatLog.slice(-60);

    adjustStats({ love: 2, xp: 4 });
    say(reply, 5500);
    if (!modals.chat.classList.contains('hidden')) renderChatLog();
  });

  // ---------------- شروع برنامه ----------------
  syncUI();
  loadAllSprites();
  scheduleBlink();
  scheduleHeadTilt();
  say(pickDialogue('greet'), 5000);
})();