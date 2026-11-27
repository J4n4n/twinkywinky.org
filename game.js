// Astolfo virtual-pet game layer — rebuild.
// State, economy, shop (items.json), games, 12 room props, sheets, settings.
// Plain script. Exposes window.Game. Rig in rig.js, chat in chat.js.
(function () {
  'use strict';

  var STORE_KEY = 'astolfo-pet-v2';
  var DAY_MS = 24 * 60 * 60 * 1000;

  // ---------- state ----------
  function defaultState() {
    return {
      v: 2,
      stats: { hunger: 80, happiness: 80, energy: 80, cleanliness: 80 },
      affectionXP: 0, level: 1, coins: 20,
      owned: [], gear: { head: null, neck: null, braid: null, outfit: null, room: null, decor: [] },
      cake: 0, tea: 0, cookie: 0, milk: 0, candy: 0, pudding: 0,
      records: { starTop: [], memoryBest: null, timingBest: null, levelBest: 1, coinsTotal: 0,
        totalPets: 0, totalFeeds: 0, petStreak: { count: 0, last: '' }, feedStreak: { count: 0, last: '' },
        petStreakBest: 0, feedStreakBest: 0, achievements: [] },
      lastPlushAt: 0, lastWandAt: 0, lastBallAt: 0, lastPetCoinAt: 0, lastFeedAt: 0, lastCleanAt: 0,
      sleeping: false, lastSeen: Date.now(), chatCoinsDate: '', chatCoinsToday: 0,
      lastGreetDate: '', excitedUntil: 0, muted: false,
      settings: { reducedMotion: false, dayNight: 'auto' },
      counters: { pets: 0, feeds: 0, starsBest: 0, gamesPlayed: { star: 0, memory: 0, timing: 0, hide: 0 } },
      best: { star: 0, memory: 0, timing: 0, hide: 0 },
      quests: {},
      firstSeen: Date.now(), streakDays: 1, lastCareDate: '',
      diary: [], windowOpen: false, lampOn: false, plantFlower: false, bowlFull: false,
      shelfLastUpset: 0, shelfBusy: false
    };
  }
  var state = load();
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      if (!s || s.v !== 2) return defaultState();
      var d = defaultState();
      for (var k in d) if (s[k] === undefined) s[k] = d[k];
      s.stats = Object.assign({}, d.stats, s.stats || {});
      s.gear = Object.assign({}, d.gear, s.gear || {});
      s.settings = Object.assign({}, d.settings, s.settings || {});
      s.counters = Object.assign({}, d.counters, s.counters || {});
      s.counters.gamesPlayed = Object.assign({}, d.counters.gamesPlayed, s.counters.gamesPlayed || {});
      s.best = Object.assign({}, d.best, s.best || {});
      s.quests = s.quests || {};
      s.records = Object.assign({}, d.records, s.records || {});
      s.records.petStreak = Object.assign({}, d.records.petStreak, s.records.petStreak || {});
      s.records.feedStreak = Object.assign({}, d.records.feedStreak, s.records.feedStreak || {});
      if (!Array.isArray(s.records.starTop)) s.records.starTop = [];
      if (!Array.isArray(s.records.achievements)) s.records.achievements = [];
      if (!Array.isArray(s.gear.decor)) s.gear.decor = [];
      if (!Array.isArray(s.diary)) s.diary = [];
      return s;
    } catch (e) { return defaultState(); }
  }
  function save() {
    state.lastSeen = Date.now();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function applyOfflineDecay() {
    var mins = (Date.now() - (state.lastSeen || Date.now())) / 60000;
    if (mins < 5) return;
    var drop = Math.floor(mins / 90);
    if (drop <= 0) return;
    ['hunger', 'happiness', 'energy', 'cleanliness'].forEach(function (k) {
      state.stats[k] = Math.max(30, state.stats[k] - drop);
    });
    save();
  }
  function tickDecay() {
    if (state.sleeping) state.stats.energy = clamp(state.stats.energy + 2.4, 0, 100);
    else {
      state.stats.hunger = clamp(state.stats.hunger - 0.5, 30, 100);
      state.stats.happiness = clamp(state.stats.happiness - 0.3, 30, 100);
      state.stats.energy = clamp(state.stats.energy - 0.2, 30, 100);
      state.stats.cleanliness = clamp(state.stats.cleanliness - 0.3, 30, 100);
    }
    save(); render();
  }
  setInterval(tickDecay, 60000);
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function addStat(k, d) { state.stats[k] = clamp(state.stats[k] + d, 0, 100); }
  function L(pool, ctx, n) {
    var line = '';
    try { line = window.Lines ? window.Lines.next(pool, ctx || {}) : ''; } catch (e) {}
    if (!line) line = 'یاهو!';
    if (n !== undefined && n !== null) line = line.replace('{n}', toFaDigits(n));
    return line;
  }
  function hourNow() { return new Date().getHours(); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function faDate(d) {
    d = d || new Date();
    try { return d.toLocaleDateString('fa-IR'); } catch (e) { return todayStr(); }
  }
  function toFaDigits(n) { return String(n).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
  function dayNumber() { return Math.floor((Date.now() - state.firstSeen) / DAY_MS) + 1; }
  function bumpCare() {
    var t = todayStr();
    if (state.lastCareDate === t) return;
    var y = new Date(Date.now() - DAY_MS);
    var ys = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    state.streakDays = (state.lastCareDate === ys) ? state.streakDays + 1 : 1;
    state.lastCareDate = t;
  }
  function bumpStreak(st) {
    var t = todayStr();
    if (st.last === t) return st.count;
    var y = new Date(Date.now() - DAY_MS);
    var ys = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    st.count = (st.last === ys) ? st.count + 1 : 1;
    st.last = t;
    return st.count;
  }

  // ---------- diary ----------
  function logDiary(text) {
    state.diary.unshift({ date: faDate(), day: dayNumber(), text: text });
    if (state.diary.length > 60) state.diary.length = 60;
    save(); renderToday();
  }

  // ---------- XP / coins / level ----------
  function xpForNext() { return 20 * state.level; }
  function addXP(n) {
    state.affectionXP += n;
    while (state.affectionXP >= xpForNext()) {
      state.affectionXP -= xpForNext();
      state.level += 1;
      if (state.level > state.records.levelBest) state.records.levelBest = state.level;
      sayBubble(L('levelUp', {}, state.level));
      logDiary('به سطح ' + toFaDigits(state.level) + ' رسید!');
      if (window.Rig) window.Rig.celebrate();
    }
  }
  function addCoins(n, why) {
    if (!n) return;
    state.coins += n;
    state.records.coinsTotal += n;
  }
  function spendCoins(n) { if (state.coins < n) return false; state.coins -= n; return true; }
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  // ---------- bubble ----------
  var bubbleEl = null, bubbleTimer = null;
  function sayBubble(text, ms) {
    if (!bubbleEl) bubbleEl = document.getElementById('bubble');
    if (!bubbleEl) return;
    // NEW BRIEF 2026-11-27 — one fixed wide zone above her head. The bubble
    // is ALWAYS 300px wide at x 45..345, directly above her head, and it
    // NEVER flips sides or moves mid-sentence: there is no side logic at
    // all. She NEVER translates any more (no walk/fetch/carry — charX is
    // HOME_X forever), so the tail is aimed ONCE at show time: her head-x
    // cannot change under a showing bubble, and the old 200ms re-aim
    // interval is deleted.
    // Measured on the POCO profile, room coords 390x600 (r6 probes):
    //   rings end y 94, clock/poster tops y 200, rail y 224-376
    //   window x 130-260 y 58-188, curtains x 92-128 / 262-298 y 100-192
    //   head-top: standing 156, sitting 210, sleeping 451 (lying)
    //   head centre x: cx-20 standing/sitting (head spans ~cx-58..cx+59);
    //     sleeping she lies with her head at x 40-107, centre ~73
    //   bubble text at 13px: line 20px, 1 line 34 tall, 2 lines 54 tall;
    //     the longest pool line (67 chars, 362px nowrap) fits in 2 lines
    //     at 300px, and all 617 pool lines do (r6 probe, re-verified
    //     2026-11-27 against lines.js).
    // So: bottom = headTop - 8, clamped to 198 while standing/sitting so
    // the bubble never touches the clock/poster tops (200); sleeping is
    // exempt — her lying head is at 451, far below every wall prop, and
    // the bubble belongs at 443 just above her. Top = bottom - height,
    // floored at 94 so it never covers the rings/HUD. Sitting is read
    // from body.sitting (the rug tap in this file sets it, and calls
    // sayBubble right after, so a sit always re-positions the bubble
    // from the sitting state — no timer); sleeping from state.sleeping
    // (sleep outranks sitting, as in rig.js).
    // A wide bubble above her head necessarily floats over the window
    // glass / curtain tops behind it — that overlap is inherent to the
    // prescribed zone (no 300px run exists in the 96-156 band that
    // avoids x 92-298: the curtain-free gaps are 0-92, 128-262, 298-390).
    // What is guaranteed: it never covers the clock, poster, rail or
    // shelf, and the tail never points at them.
    // Tail: on the BOTTOM edge, at her head's x, so it always points
    // DOWN at her — never at the back of her hair, the clock, or the
    // curtain. Standing 2-line bubble: top 94, bottom 148, tail-x 195
    // (head centre); sitting 2-line: top 144, bottom 198, tail-x 195 —
    // the bubble follows her head DOWN 50px when she sits.
    var BUBBLE_LEFT = 45, BUBBLE_WIDTH = 300, GAP = 8, BOTTOM_MAX = 198, TOP_MIN = 94;
    var HEAD_TOP_STAND = 156, HEAD_TOP_SIT = 210, HEAD_TOP_SLEEP = 451, SLEEP_HEAD_X = 73;
    var sleeping = !!state.sleeping;
    var sitting = !sleeping && document.body.classList.contains('sitting');
    var headTop = sleeping ? HEAD_TOP_SLEEP : (sitting ? HEAD_TOP_SIT : HEAD_TOP_STAND);
    function headX() {
      if (sleeping) return SLEEP_HEAD_X;
      var cx = window.Rig ? window.Rig.getCharX() : 215;
      return cx - 20;
    }
    function aimTail() {
      var tx = Math.max(24, Math.min(BUBBLE_WIDTH - 24, headX() - BUBBLE_LEFT));
      bubbleEl.style.setProperty('--tail-x', tx + 'px');
    }
    bubbleEl.textContent = text;
    bubbleEl.classList.remove('tail-l', 'tail-r'); // dead side-tail classes, kept cleared
    bubbleEl.style.left = BUBBLE_LEFT + 'px';
    bubbleEl.style.right = 'auto';
    bubbleEl.style.width = BUBBLE_WIDTH + 'px';
    // Measure the real height (1 line 34, 2 lines 54), then pin the
    // bubble's bottom just above her head.
    var bottom = headTop - GAP;
    if (!sleeping) bottom = Math.min(bottom, BOTTOM_MAX);
    var top = bottom - bubbleEl.offsetHeight;
    if (top < TOP_MIN) top = TOP_MIN;
    bubbleEl.style.top = top + 'px';
    aimTail();
    bubbleEl.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      bubbleEl.classList.remove('show');
    }, ms || 4000);
  }
  function clearBubble() { if (bubbleEl) bubbleEl.classList.remove('show'); clearTimeout(bubbleTimer); }

  // ---------- mood ----------
  var MOOD_FA = { happy: 'خوشحال', hungry: 'گرسنه', sleepy: 'خواب‌آلود', messy: 'کثیف', sad: 'ناراحت', bored: 'حوصله‌سررفته', excited: 'هیجان‌زده' };
  function mood() {
    if (state.sleeping) return 'sleepy';
    if (state.stats.hunger < 40) return 'hungry';
    if (state.stats.energy < 40) return 'sleepy';
    if (state.stats.cleanliness < 40) return 'messy';
    if (state.stats.happiness < 40) return 'sad';
    if (Date.now() < state.excitedUntil) return 'excited';
    if (state.stats.happiness < 60) return 'bored';
    return 'happy';
  }
  var idleTimer = null;
  function startIdleLines() {
    stopIdleLines();
    idleTimer = setInterval(function () {
      if (state.sleeping || document.body.classList.contains('sheet-open')) return;
      var m = mood();
      var pool = 'idle' + m.charAt(0).toUpperCase() + m.slice(1);
      if (!window.Lines || !window.Lines.pools || !window.Lines.pools[pool]) pool = 'idle';
      sayBubble(L(pool, { hour: hourNow() }), 3500);
    }, 45000);
  }
  function stopIdleLines() { if (idleTimer) clearInterval(idleTimer); idleTimer = null; }

  // ---------- SheetManager: one sheet at a time, by construction ----------
  var SHEETS = {
    shop: { title: 'فروشگاه', panel: 'panel-shop' },
    games: { title: 'بازی‌ها', panel: 'panel-games' },
    quests: { title: 'ماموریت‌ها', panel: 'panel-quests' },
    diary: { title: 'دفتر خاطرات', panel: 'panel-diary' },
    leaderboard: { title: 'جدول امتیازها', panel: 'panel-leaderboard' },
    food: { title: 'غذا بده', panel: 'panel-food' },
    settings: { title: 'تنظیمات', panel: 'panel-settings' },
    star: { title: 'ستاره‌گیر', panel: 'panel-star' },
    memory: { title: 'حافظه', panel: 'panel-memory' },
    timing: { title: 'ضربه‌ی دقیق', panel: 'panel-timing' },
    hideseek: { title: 'قایم‌باشک', panel: 'panel-hideseek' },
    chat: { title: 'چت با آستولفو', panel: 'panel-chat', frosted: true }
  };
  // Chat panel lives inside the sheet body but is rendered by chat.js into #chat-log;
  // we create it dynamically (not in the static HTML) to keep index.html small.
  var currentSheet = null;
  function openSheet(id) {
    if (state.sleeping && id === 'chat') { sayBubble('آستولفو خوابه…'); return; }
    var def = SHEETS[id];
    if (!def) return;
    closeSheet(true);
    var panel = document.getElementById(def.panel);
    if (!panel) { if (id === 'chat') { ensureChatPanel(); panel = document.getElementById('panel-chat'); } }
    if (!panel) return;
    document.querySelectorAll('.sheet-panel').forEach(function (p) { p.classList.remove('active'); });
    panel.classList.add('active');
    document.getElementById('sheet-title').textContent = def.title;
    document.getElementById('sheet').classList.toggle('frosted', !!def.frosted);
    document.getElementById('chat-sheet-input').style.display = id === 'chat' ? 'flex' : 'none';
    document.body.classList.add('sheet-open');
    currentSheet = id;
    if (id === 'shop') renderShop();
    if (id === 'games') renderGames();
    if (id === 'quests') renderQuests();
    if (id === 'diary') renderDiary();
    if (id === 'leaderboard') renderLeaderboard();
    if (id === 'food') renderFood();
    if (id === 'settings') renderSettings();
    if (id === 'chat' && window.Chat) window.Chat.onOpen();
  }
  function closeSheet(silent) {
    if (!currentSheet && !document.body.classList.contains('sheet-open')) return;
    document.body.classList.remove('sheet-open');
    currentSheet = null;
    // Leaving hide-and-seek mid-game must bring her back: otherwise the
    // canvas stays at opacity 0 and the room looks empty.
    if (hideGame.active) {
      hideGame.active = false;
      var cv = document.getElementById('charCanvas');
      if (cv) cv.style.opacity = '1';
    }
    if (!silent) { /* games stop on close */ stopStarGame(true); stopTimingGame(true); }
  }
  function ensureChatPanel() {
    var body = document.getElementById('sheet-body');
    var div = document.createElement('div');
    div.className = 'sheet-panel'; div.id = 'panel-chat';
    div.innerHTML = '<div id="chat-log"></div>';
    body.appendChild(div);
  }

  // ---------- shop (items.json) ----------
  var ITEMS = null, shopCat = 'all';
  var SHOP_CATS = { all: 'همه', head: 'سر', clothes: 'لباس', room: 'اتاق', food: 'خوراکی' };
  function loadItems() {
    if (window.ITEMS_DATA) { ITEMS = window.ITEMS_DATA; return Promise.resolve(); }
    return fetch('assets/items.json').then(function (r) { return r.json(); }).then(function (d) { ITEMS = d; })
      .catch(function () { ITEMS = null; });
  }
  function itemById(id) {
    if (!ITEMS) return null;
    for (var i = 0; i < ITEMS.items.length; i++) if (ITEMS.items[i].id === id) return ITEMS.items[i];
    return null;
  }
  function renderShop() {
    var grid = document.getElementById('shop-grid');
    var chips = document.getElementById('shop-chips');
    if (!grid) return;
    chips.innerHTML = '';
    Object.keys(SHOP_CATS).forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'chip' + (shopCat === c ? ' on' : '');
      b.textContent = SHOP_CATS[c];
      b.addEventListener('click', function () { shopCat = c; renderShop(); });
      chips.appendChild(b);
    });
    grid.innerHTML = '';
    if (!ITEMS) { grid.innerHTML = '<p class="empty-note">فروشگاه بارگذاری نشد — دوباره امتحان کن.</p>'; return; }
    ITEMS.items.forEach(function (it) {
      if (shopCat !== 'all' && it.category !== shopCat) return;
      var owned = state.owned.indexOf(it.id) !== -1;
      var locked = state.level < it.level;
      var card = document.createElement('div');
      card.className = 'shop-card' + (locked ? ' locked' : '') + (owned ? ' owned' : '');
      var btnHtml;
      if (locked) btnHtml = '<div class="lock-line"><img src="assets/icons/lock.png" alt=""> سطح ' + toFaDigits(it.level) + ' · ' + toFaDigits(it.price) + '</div>';
      else if (owned && it.slot) btnHtml = '<button class="buy-btn" data-act="equip">' + (state.gear[it.slot] === it.id ? 'پوشیده ✓' : 'بپوش') + '</button>';
      else if (owned) btnHtml = '<button class="buy-btn" disabled>خریده شده</button>';
      else btnHtml = '<button class="buy-btn" data-act="buy">خرید</button>';
      card.innerHTML = '<img class="art" src="assets/items/' + it.art + '" alt=""><div class="nm">' + it.fa + '</div>' +
        '<div class="fx">' + it.effect + '</div>' +
        '<div class="price-row"><img src="assets/icons/coin.png" alt=""> <span class="px-num">' + it.price + '</span></div>' + btnHtml;
      var btn = card.querySelector('.buy-btn[data-act]');
      if (btn) btn.addEventListener('click', function () {
        if (btn.getAttribute('data-act') === 'buy') buy(it.id);
        else equip(it.id);
      });
      grid.appendChild(card);
    });
  }
  function buy(itemId) {
    var it = itemById(itemId);
    if (!it) return;
    if (state.level < it.level) { sayBubble(L('locked', {})); return; }
    if (state.owned.indexOf(itemId) !== -1) { equip(itemId); return; }
    if (!spendCoins(it.price)) { sayBubble(L('cantAfford', {})); return; }
    state.owned.push(itemId);
    if (it.consumable) {
      var key = it.invKey || itemId;
      state[key] = (state[key] || 0) + 1;
      sayBubble(L('shopCake', {}));
    } else {
      equip(itemId, true);
      sayBubble(L('shopBuy', {}));
    }
    addXP(3);
    logDiary('«' + it.fa + '» رو خرید!');
    save(); render(); renderShop();
    if (window.Rig) window.Rig.celebrate();
    checkQuests(); checkAchievements();
  }
  function equip(itemId, silent) {
    var it = itemById(itemId);
    if (!it || !it.slot) return;
    if (state.owned.indexOf(itemId) === -1) return;
    if (it.slot === 'decor') {
      if (state.gear.decor.indexOf(itemId) === -1) state.gear.decor.push(itemId);
    } else if (it.slot === 'room') {
      state.gear.room = itemId;
    } else {
      state.gear[it.slot] = (state.gear[it.slot] === itemId) ? null : itemId;
    }
    applyGear();
    save(); render();
    if (!silent) { renderShop(); sayBubble(L('shopBuy', {})); }
  }
  function applyGear() {
    if (!window.Rig) return;
    window.Rig.setGear(state.gear);
    // Preload equipped item art for the canvas overlay.
    Object.keys(state.gear).forEach(function (slot) {
      var id = state.gear[slot];
      if (id && typeof id === 'string') {
        var it = itemById(id);
        if (it) window.Rig.loadItemImage(id, it.art);
      }
    });
    if (Array.isArray(state.gear.decor)) state.gear.decor.forEach(function (id) {
      var it = itemById(id);
      if (it) window.Rig.loadItemImage(id, it.art);
    });
    // Room themes + decor.
    document.body.classList.toggle('room-pink', state.gear.room === 'roomPink');
    document.body.classList.toggle('room-mint', state.gear.room === 'roomMint');
    document.body.classList.toggle('room-lavender', state.gear.room === 'roomLavender');
    var hasLights = state.gear.decor && state.gear.decor.indexOf('fairylights') !== -1;
    document.body.classList.toggle('has-fairylights', !!hasLights);
    if (hasLights) buildFairyLights();
  }
  function buildFairyLights() {
    var el = document.getElementById('fairy-lights');
    if (!el || el.children.length) return;
    var colors = ['#F27EA9', '#F2B705', '#7FC8A9', '#A8D8EA'];
    for (var i = 0; i < 14; i++) {
      var s = document.createElement('span');
      s.style.left = (8 + i * 26) + 'px';
      s.style.top = (4 + Math.abs(Math.sin(i * 0.9)) * 14) + 'px';
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = (i * 0.12) + 's';
      el.appendChild(s);
    }
  }

  // ---------- food ----------
  var FOOD = {
    snack: { fa: 'اسنک', price: 5, hunger: 12, happiness: 3, energy: 0, icon: 'cookie.png' },
    meal: { fa: 'غذای کامل', price: 15, hunger: 25, happiness: 5, energy: 0, icon: 'meal.png' },
    drink: { fa: 'نوشیدنی', price: 8, hunger: 8, happiness: 6, energy: 2, icon: 'drink.png' },
    cake: { fa: 'کیک', price: 0, hunger: 10, happiness: 15, energy: 0, inventory: true, invKey: 'cake', icon: 'cake.png' },
    tea: { fa: 'چای حبابی', price: 0, hunger: 8, happiness: 8, energy: 10, inventory: true, invKey: 'tea', icon: 'tea.png' },
    cookie: { fa: 'کوکی ستاره‌ای', price: 0, hunger: 10, happiness: 12, energy: 0, inventory: true, invKey: 'cookie', icon: 'starcookie.png' },
    milk: { fa: 'شیر توت‌فرنگی', price: 0, hunger: 10, happiness: 10, energy: 5, inventory: true, invKey: 'milk', icon: 'milk.png' },
    candy: { fa: 'آبنبات ستاره‌ای', price: 0, hunger: 6, happiness: 8, energy: 2, inventory: true, invKey: 'candy', icon: 'candy.png' },
    pudding: { fa: 'پودینگ', price: 0, hunger: 14, happiness: 10, energy: 4, inventory: true, invKey: 'pudding', icon: 'pudding.png' }
  };
  var FEED_POOL = { snack: 'feedSnack', meal: 'feedMeal', drink: 'feedDrink', cake: 'feedCake', tea: 'feedTea', cookie: 'feedCookie', milk: 'feedMilk', candy: 'feedCandy', pudding: 'feedPudding' };
  function renderFood() {
    var grid = document.getElementById('food-grid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.keys(FOOD).forEach(function (kind) {
      var f = FOOD[kind];
      var owned = f.inventory ? (state[f.invKey] || 0) : null;
      var card = document.createElement('div');
      card.className = 'food-card';
      card.innerHTML = '<img src="assets/icons/' + f.icon + '" alt=""><h4>' + f.fa + '</h4>' +
        '<p>گرسنگی +' + toFaDigits(f.hunger) + ' · شادی +' + toFaDigits(f.happiness) + '</p>' +
        (f.inventory ? '<p>داری: ' + toFaDigits(owned) + '</p>' : '<p>' + toFaDigits(f.price) + ' سکه</p>') +
        '<button class="buy-btn">بده بخوره</button>';
      card.querySelector('.buy-btn').addEventListener('click', function () { feed(kind); });
      grid.appendChild(card);
    });
  }
  function feed(kind) {
    if (state.sleeping) { sayBubble(L('refuseSleep', {})); return false; }
    if (Date.now() - state.lastFeedAt < 2000) { sayBubble('یه لحظه صبر کن، هنوز دارم می‌جوم!'); return false; }
    var f = FOOD[kind];
    if (!f) return false;
    if (f.inventory) {
      if ((state[f.invKey] || 0) <= 0) { sayBubble('اینو ندارم! اول از فروشگاه بخر.'); return false; }
      state[f.invKey] -= 1;
    } else if (!spendCoins(f.price)) { sayBubble(L('cantAfford', {})); return false; }
    state.lastFeedAt = Date.now();
    addStat('hunger', f.hunger); addStat('happiness', f.happiness); addStat('energy', f.energy);
    addXP(2);
    state.counters.feeds += 1;
    state.records.totalFeeds += 1;
    var fs = bumpStreak(state.records.feedStreak);
    if (fs > state.records.feedStreakBest) state.records.feedStreakBest = fs;
    state.bowlFull = true;
    bumpCare();
    save(); render();
    if (window.Rig) window.Rig.eat();
    sayBubble(L(FEED_POOL[kind] || 'feedSnack', {}));
    logDiary('یه وعده «' + f.fa + '» خورد.');
    checkQuests(); checkAchievements();
    closeSheet(true);
    return true;
  }
  function clean() {
    if (state.sleeping) { sayBubble(L('refuseSleep', {})); return false; }
    if (Date.now() - state.lastCleanAt < 10000) { sayBubble('همین الان حموم کردم! یه کم صبر کن.'); return false; }
    state.lastCleanAt = Date.now();
    addStat('cleanliness', 22); addStat('happiness', 3);
    addXP(2); save(); render();
    if (window.Rig) window.Rig.bath();
    dropletsFx(195); // water over her (the bath used to be a pose + line only)
    setTimeout(function () { dropletsFx(195); }, 800);
    sayBubble(L('bath', {}));
    return true;
  }
  function pet() {
    if (state.sleeping) { wake(); return; }
    addStat('happiness', 3); addXP(2);
    state.counters.pets += 1;
    state.records.totalPets += 1;
    var ps = bumpStreak(state.records.petStreak);
    if (ps > state.records.petStreakBest) state.records.petStreakBest = ps;
    var now = Date.now();
    if (now - state.lastPetCoinAt > 10000) { state.lastPetCoinAt = now; addCoins(2, 'pet'); }
    bumpCare();
    save(); render();
    if (window.Rig) window.Rig.pet();
    heartsFx(); // MERGE 2026-11-28 (pre-walk character): her pet had hearts
    sayBubble(L('pet', {}));
    checkQuests(); checkAchievements();
  }
  function poke() {
    if (state.sleeping) { wake(); return; }
    if (window.Rig) window.Rig.annoyed();
    sayBubble(L('poke', {}));
  }
  function toggleSleep() {
    if (state.sleeping) { wake(); return; }
    clearBubble();
    state.sleeping = true;
    save(); render();
    document.body.classList.add('sleeping');
    document.body.classList.remove('sheet-open');
    currentSheet = null;
    var z = document.getElementById('sleep-z');
    if (z) { z.style.left = '28px'; z.style.top = '468px'; }
    sayBubble(L('sleep', {}) + ' Zzz', 6000);
    if (window.Rig) window.Rig.setSleep(true);
  }
  function wake() {
    if (!state.sleeping) return;
    state.sleeping = false;
    save(); render();
    if (window.Rig) window.Rig.setSleep(false);
    document.body.classList.remove('sleeping');
    clearBubble();
    addStat('energy', 5);
    sayBubble(L('wake', { hour: hourNow() }));
    logDiary('از خواب بیدار شد.');
  }

  // ---------- games ----------
  var GAMES = [
    { id: 'star', fa: 'ستاره‌گیر', desc: 'ستاره‌ها رو بگیر، نذار بیفتن!', icon: 'star-pink.png', reward: 10, best: function () { return state.best.star || 0; } },
    { id: 'memory', fa: 'حافظه', desc: 'جفت کارت‌ها رو پیدا کن', icon: 'sparkle.png', reward: 10, best: function () { return state.best.memory ? ('کمترین حرکت: ' + toFaDigits(state.best.memory)) : 0; } },
    { id: 'timing', fa: 'ضربه‌ی دقیق', desc: 'لحظه‌ی درست بزن، امتیاز بگیر', icon: 'bolt.png', reward: 8, best: function () { return state.best.timing || 0; } },
    { id: 'hide', fa: 'قایم‌باشک', desc: 'پیداش کن! فقط ۲ شانس داری', icon: 'moon.png', reward: 15, best: function () { return state.best.hide || 0; } }
  ];
  function renderGames() {
    var list = document.getElementById('games-list');
    if (!list) return;
    list.innerHTML = '';
    GAMES.forEach(function (g) {
      var card = document.createElement('div');
      card.className = 'game-card';
      card.innerHTML = '<div class="tile"><img src="assets/icons/' + g.icon + '" alt=""></div>' +
        '<div class="g-info"><h3>' + g.fa + '</h3><p>' + g.desc + '</p>' +
        '<div class="g-meta">بهترین ' + g.best() + ' · ' + toFaDigits(g.reward) + ' سکه</div></div>' +
        '<button class="play-btn">بازی</button>';
      card.querySelector('.play-btn').addEventListener('click', function () {
        if (g.id === 'star') { openSheet('star'); startStarGame(); }
        else if (g.id === 'memory') { openSheet('memory'); startMemoryGame(); }
        else if (g.id === 'timing') { openSheet('timing'); startTimingGame(); }
        else if (g.id === 'hide') { openSheet('hideseek'); startHideSeek(); }
      });
      list.appendChild(card);
    });
    var foot = document.getElementById('games-leaderboard');
    if (foot) foot.onclick = function () { openSheet('leaderboard'); };
  }

  // --- star-catch ---
  var starGame = { active: false, score: 0, stars: [], raf: 0, timer: null, timeLeft: 30, lastSpawn: 0 };
  function startStarGame() {
    if (state.sleeping) { sayBubble(L('refuseSleep', {})); return; }
    stopStarGame(true);
    starGame.active = true; starGame.score = 0; starGame.stars = []; starGame.timeLeft = 30;
    state.counters.gamesPlayed.star += 1; save();
    document.getElementById('star-score').textContent = '0';
    document.getElementById('star-time').textContent = '30';
    document.getElementById('star-status').textContent = L('starStart', {});
    var cv = document.getElementById('star-canvas');
    var sctx = cv.getContext('2d');
    var last = performance.now();
    function loop(now) {
      if (!starGame.active) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (now - starGame.lastSpawn > 480) {
        starGame.lastSpawn = now;
        starGame.stars.push({ x: 20 + Math.random() * 300, y: -14, v: 55 + Math.random() * 55, r: 13 });
      }
      sctx.clearRect(0, 0, cv.width, cv.height);
      starGame.stars.forEach(function (s) {
        s.y += s.v * dt;
        drawStarShape(sctx, s.x, s.y, s.r);
      });
      starGame.stars = starGame.stars.filter(function (s) { return s.y < cv.height + 20; });
      starGame.raf = requestAnimationFrame(loop);
    }
    starGame.raf = requestAnimationFrame(loop);
    starGame.timer = setInterval(function () {
      starGame.timeLeft -= 1;
      document.getElementById('star-time').textContent = String(starGame.timeLeft);
      if (starGame.timeLeft <= 0) endStarGame();
    }, 1000);
    cv.onclick = function (e) {
      if (!starGame.active) return;
      var r = cv.getBoundingClientRect();
      var cx = (e.clientX - r.left) * (cv.width / r.width);
      var cy = (e.clientY - r.top) * (cv.height / r.height);
      for (var i = 0; i < starGame.stars.length; i++) {
        var s = starGame.stars[i];
        if (Math.hypot(s.x - cx, s.y - cy) < 26) {
          starGame.stars.splice(i, 1);
          starGame.score += 1;
          document.getElementById('star-score').textContent = String(starGame.score);
          if (window.Rig) window.Rig.blip();
          break;
        }
      }
    };
  }
  function drawStarShape(c, x, y, r) {
    c.save(); c.translate(x, y);
    c.fillStyle = '#F2B705'; c.strokeStyle = '#E85D8A'; c.lineWidth = 2;
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var rr = i % 2 === 0 ? r : r * 0.45;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      c[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath(); c.fill(); c.stroke(); c.restore();
  }
  function endStarGame() {
    if (!starGame.active) return;
    stopStarGame(true);
    var sc = starGame.score;
    addStat('happiness', 5); addStat('energy', -3); addXP(4);
    if (sc > state.best.star) state.best.star = sc;
    if (sc > state.counters.starsBest) state.counters.starsBest = sc;
    state.records.starTop.push({ score: sc, date: faDate() });
    state.records.starTop.sort(function (a, b) { return b.score - a.score; });
    state.records.starTop = state.records.starTop.slice(0, 5);
    var coins = Math.floor(sc / 5) + (sc >= 15 ? 10 : 0);
    if (coins > 0) addCoins(coins, 'star');
    save(); render();
    document.getElementById('star-status').textContent = L(sc >= 15 ? 'starWin' : 'starLow', {}, sc);
    sayBubble(L(sc >= 15 ? 'starWin' : 'starLow', {}, sc));
    if (window.Rig) window.Rig.celebrate();
    logDiary('ستاره‌گیر: ' + toFaDigits(sc) + ' ستاره گرفت.');
    checkQuests(); checkAchievements();
  }
  function stopStarGame(silent) {
    starGame.active = false;
    cancelAnimationFrame(starGame.raf);
    clearInterval(starGame.timer);
    if (!silent) sayBubble(L('starQuit', {}));
  }

  // --- memory ---
  var memoryGame = { active: false, cards: [], flipped: [], matched: 0, moves: 0, lock: false };
  var MEMORY_ICONS = [
    { id: 'star', icon: 'star-pink.png' }, { id: 'heart', icon: 'heart.png' }, { id: 'moon', icon: 'moon.png' }
  ];
  function startMemoryGame() {
    if (state.sleeping) { sayBubble(L('refuseSleep', {})); return; }
    memoryGame.active = true; memoryGame.matched = 0; memoryGame.moves = 0; memoryGame.flipped = []; memoryGame.lock = false;
    state.counters.gamesPlayed.memory += 1; save();
    var deck = MEMORY_ICONS.concat(MEMORY_ICONS).map(function (c, i) { return { key: c.id, icon: c.icon, uid: i }; });
    for (var i = deck.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
    memoryGame.cards = deck;
    var grid = document.getElementById('memory-grid');
    grid.innerHTML = '';
    document.getElementById('memory-moves').textContent = '0';
    deck.forEach(function (card, idx) {
      var b = document.createElement('button');
      b.className = 'memory-card';
      b.setAttribute('data-idx', idx);
      b.innerHTML = '<span class="memory-back"><img src="assets/icons/sparkle.png" alt=""></span>' +
        '<span class="memory-face"><img src="assets/icons/' + card.icon + '" alt=""></span>';
      b.addEventListener('click', function () { memoryFlip(idx); });
      grid.appendChild(b);
    });
    document.getElementById('memory-status').textContent = L('memoryStart', {});
  }
  function memoryFlip(idx) {
    if (!memoryGame.active || memoryGame.lock) return;
    var card = memoryGame.cards[idx];
    if (!card || card.done || memoryGame.flipped.indexOf(idx) !== -1) return;
    var el = document.querySelector('.memory-card[data-idx="' + idx + '"]');
    if (!el) return;
    el.classList.add('flipped');
    memoryGame.flipped.push(idx);
    if (window.Rig) window.Rig.blip();
    if (memoryGame.flipped.length < 2) return;
    memoryGame.moves += 1;
    document.getElementById('memory-moves').textContent = String(memoryGame.moves);
    var a = memoryGame.cards[memoryGame.flipped[0]], b = memoryGame.cards[memoryGame.flipped[1]];
    if (a.key === b.key) {
      a.done = b.done = true;
      memoryGame.matched += 1;
      addCoins(5, 'memory');
      document.getElementById('memory-status').textContent = 'یه جفت پیدا شد! +' + toFaDigits(5) + ' سکه';
      if (window.Rig) window.Rig.chatReact();
      memoryGame.flipped = [];
      if (memoryGame.matched === 3) endMemoryGame();
    } else {
      memoryGame.lock = true;
      var pair = memoryGame.flipped.slice();
      setTimeout(function () {
        pair.forEach(function (i) {
          var e2 = document.querySelector('.memory-card[data-idx="' + i + '"]');
          if (e2) e2.classList.remove('flipped');
        });
        memoryGame.flipped = []; memoryGame.lock = false;
      }, 800);
    }
  }
  function endMemoryGame() {
    if (!memoryGame.active) return;
    memoryGame.active = false;
    addStat('happiness', 5); addStat('energy', -3); addXP(4);
    if (!state.best.memory || memoryGame.moves < state.best.memory) state.best.memory = memoryGame.moves;
    if (!state.records.memoryBest || memoryGame.moves < state.records.memoryBest.moves) state.records.memoryBest = { moves: memoryGame.moves, date: faDate() };
    addCoins(10, 'memory-win');
    save(); render();
    document.getElementById('memory-status').textContent = L('memoryWin', {}, memoryGame.moves);
    sayBubble(L('memoryWin', {}, memoryGame.moves));
    if (window.Rig) window.Rig.celebrate();
    checkQuests(); checkAchievements();
  }

  // --- timing tap ---
  var timingGame = { active: false, round: 0, score: 0, pos: 0, dir: 1, timer: null };
  function startTimingGame() {
    if (state.sleeping) { sayBubble(L('refuseSleep', {})); return; }
    if (timingGame.active) return;
    timingGame.active = true; timingGame.round = 0; timingGame.score = 0;
    state.counters.gamesPlayed.timing += 1; save();
    document.getElementById('timing-status').textContent = L('timingStart', {});
    document.getElementById('timing-round').textContent = '۰/۱۰';
    document.getElementById('timing-score').textContent = '۰';
    timingNextRound();
  }
  function timingNextRound() {
    if (!timingGame.active) return;
    timingGame.round += 1;
    if (timingGame.round > 10) { endTimingGame(); return; }
    document.getElementById('timing-round').textContent = toFaDigits(timingGame.round) + '/۱۰';
    var centre = 30 + Math.random() * 40;
    var zone = document.getElementById('timing-zone');
    zone.style.left = (centre - 8) + '%'; zone.style.width = '16%';
    timingGame.pos = 0; timingGame.dir = 1;
    var marker = document.getElementById('timing-marker');
    clearInterval(timingGame.timer);
    timingGame.timer = setInterval(function () {
      timingGame.pos += timingGame.dir * 2.2;
      if (timingGame.pos >= 100) { timingGame.pos = 100; timingGame.dir = -1; }
      if (timingGame.pos <= 0) { timingGame.pos = 0; timingGame.dir = 1; }
      marker.style.left = timingGame.pos + '%';
    }, 16);
  }
  function timingTap() {
    if (!timingGame.active) return;
    clearInterval(timingGame.timer);
    var zone = document.getElementById('timing-zone');
    var zLeft = parseFloat(zone.style.left), zW = parseFloat(zone.style.width);
    var centre = zLeft + zW / 2;
    var dist = Math.abs(timingGame.pos - centre);
    var pts = dist <= 3 ? 100 : (dist <= 8 ? 70 : (dist <= 16 ? 40 : 10));
    timingGame.score += pts;
    document.getElementById('timing-score').textContent = toFaDigits(timingGame.score);
    document.getElementById('timing-status').textContent =
      pts === 100 ? 'دقیق وسط! ۱۰۰ امتیاز!' : (pts >= 70 ? 'خیلی خوب! ' + toFaDigits(pts) + ' امتیاز!' :
      (pts >= 40 ? 'خوب بود! ' + toFaDigits(pts) + ' امتیاز!' : 'آخ! فقط ' + toFaDigits(pts) + ' امتیاز...'));
    if (window.Rig) window.Rig.blip();
    setTimeout(timingNextRound, 700);
  }
  function endTimingGame() {
    if (!timingGame.active) return;
    timingGame.active = false;
    clearInterval(timingGame.timer);
    var coins = Math.floor(timingGame.score / 10);
    addStat('happiness', 5); addStat('energy', -3); addXP(4);
    if (timingGame.score > state.best.timing) state.best.timing = timingGame.score;
    if (!state.records.timingBest || timingGame.score > state.records.timingBest.score) state.records.timingBest = { score: timingGame.score, date: faDate() };
    if (coins > 0) addCoins(coins, 'timing');
    save(); render();
    document.getElementById('timing-status').textContent = L('timingWin', {}, timingGame.score);
    sayBubble(L('timingWin', {}, timingGame.score));
    if (window.Rig) window.Rig.celebrate();
    checkQuests(); checkAchievements();
  }
  function stopTimingGame(silent) {
    if (!timingGame.active) return;
    timingGame.active = false; clearInterval(timingGame.timer);
    if (!silent) sayBubble(L('starQuit', {}));
  }

  // --- hide-and-seek ---
  var hideGame = { active: false, spot: null, tries: 2 };
  function startHideSeek() {
    if (state.sleeping) { sayBubble(L('refuseSleep', {})); return; }
    hideGame.active = true; hideGame.tries = 2;
    hideGame.spot = ['curtain', 'shelf', 'rug'][Math.floor(Math.random() * 3)];
    state.counters.gamesPlayed.hide += 1; save();
    document.getElementById('hideseek-status').textContent = L('hideSeekStart', {});
    var cv = document.getElementById('charCanvas');
    if (cv) cv.style.transition = 'opacity .5s', cv.style.opacity = '0';
  }
  function hideSeekGuess(spot) {
    if (!hideGame.active) return;
    var cv = document.getElementById('charCanvas');
    if (spot === hideGame.spot) {
      hideGame.active = false;
      if (cv) cv.style.opacity = '1';
      addStat('happiness', 8); addXP(4);
      state.best.hide = (state.best.hide || 0) + 1;
      addCoins(15, 'hide');
      save(); render();
      document.getElementById('hideseek-status').textContent = L('hideSeekWin', {});
      sayBubble(L('hideSeekWin', {}));
      if (window.Rig) window.Rig.celebrate();
      logDiary('قایم‌باشک: پیداش کرد!');
      checkQuests(); checkAchievements();
    } else {
      hideGame.tries -= 1;
      if (hideGame.tries <= 0) {
        hideGame.active = false;
        if (cv) cv.style.opacity = '1';
        document.getElementById('hideseek-status').textContent = L('hideSeekLose', {});
        sayBubble(L('hideSeekLose', {}));
        if (window.Rig) window.Rig.chatReact();
      } else {
        document.getElementById('hideseek-status').textContent = 'اینجا نیست! یه شانس دیگه داری…';
      }
    }
  }

  // ---------- quests / achievements / diary / leaderboard ----------
  var QUESTS = [
    { id: 'pet10', fa: '۱۰ بار نازش کن', desc: 'سر آستولفو رو ۱۰ بار ناز کن', reward: 15,
      check: function () { return state.counters.pets >= 10; },
      progress: function () { return Math.min(10, state.counters.pets) + '/۱۰'; } },
    { id: 'stars10', fa: 'یه بازی ۱۰ ستاره بگیر', desc: 'تو یه دور ستاره‌بگیر ۱۰ تا ستاره بگیر', reward: 20,
      check: function () { return state.counters.starsBest >= 10; },
      progress: function () { return Math.min(10, state.counters.starsBest) + '/۱۰'; } },
    { id: 'feed3', fa: '۳ وعده غذا بده', desc: '۳ بار به آستولفو غذا بده', reward: 10,
      check: function () { return state.counters.feeds >= 3; },
      progress: function () { return Math.min(3, state.counters.feeds) + '/۳'; } },
    { id: 'level3', fa: 'به سطح ۳ برس', desc: 'محبت آستولفو رو تا سطح ۳ بالا ببر', reward: 25,
      check: function () { return state.level >= 3; },
      progress: function () { return 'سطح ' + toFaDigits(state.level) + '/۳'; } },
    { id: 'playAll', fa: 'هر سه بازی رو امتحان کن', desc: 'ستاره‌بگیر، حافظه و ضربه‌ی دقیق رو یک بار بازی کن', reward: 20,
      check: function () { var g = state.counters.gamesPlayed; return g.star >= 1 && g.memory >= 1 && g.timing >= 1; },
      progress: function () { var g = state.counters.gamesPlayed; return (g.star >= 1 ? 1 : 0) + (g.memory >= 1 ? 1 : 0) + (g.timing >= 1 ? 1 : 0) + '/۳'; } },
    { id: 'hide1', fa: 'قایم‌باشک رو ببر', desc: 'توی قایم‌باشک پیداش کن', reward: 15,
      check: function () { return (state.best.hide || 0) >= 1; },
      progress: function () { return (state.best.hide || 0) >= 1 ? '۱/۱' : '۰/۱'; } }
  ];
  function questState(id) { if (!state.quests[id]) state.quests[id] = { done: false, claimed: false }; return state.quests[id]; }
  function checkQuests() {
    var changed = false;
    QUESTS.forEach(function (q) {
      var qs = questState(q.id);
      if (!qs.done && q.check()) { qs.done = true; changed = true; }
    });
    if (changed) save();
  }
  function claimQuest(id) {
    var q = null;
    QUESTS.forEach(function (it) { if (it.id === id) q = it; });
    if (!q) return false;
    var qs = questState(id);
    if (!qs.done || qs.claimed) return false;
    qs.claimed = true;
    addCoins(q.reward, 'quest');
    save(); render(); renderQuests();
    sayBubble(L('questDone', {}, q.reward));
    if (window.Rig) window.Rig.celebrate();
    return true;
  }
  function renderQuests() {
    var list = document.getElementById('quests-list');
    if (!list) return;
    list.innerHTML = '';
    QUESTS.forEach(function (q) {
      var qs = questState(q.id);
      var row = document.createElement('div');
      row.className = 'q-row';
      row.innerHTML = '<img src="assets/icons/trophy.png" alt=""><div class="q-info"><h4>' + q.fa + '</h4><p>' + q.desc + '</p><p>' + q.progress() + ' · جایزه ' + toFaDigits(q.reward) + ' سکه</p></div>';
      var btn = document.createElement('button');
      btn.className = 'claim-btn';
      btn.textContent = qs.claimed ? 'گرفته شد' : (qs.done ? 'گرفتن جایزه' : 'در حال انجام');
      btn.disabled = !qs.done || qs.claimed;
      btn.addEventListener('click', function () { claimQuest(q.id); });
      row.appendChild(btn);
      list.appendChild(row);
    });
  }
  var ACHIEVEMENTS = [
    { id: 'first-pet', fa: 'اولین ناز', desc: '۱ بار نازش کن', check: function () { return state.records.totalPets >= 1; } },
    { id: 'pets-100', fa: 'نوازشگر حرفه‌ای', desc: '۱۰۰ بار نازش کن', check: function () { return state.records.totalPets >= 100; } },
    { id: 'feeds-50', fa: 'آشپز آستولفو', desc: '۵۰ وعده غذا بده', check: function () { return state.records.totalFeeds >= 50; } },
    { id: 'level-3', fa: 'دوست صمیمی', desc: 'به سطح ۳ برس', check: function () { return state.level >= 3; } },
    { id: 'level-5', fa: 'بهترین دوست', desc: 'به سطح ۵ برس', check: function () { return state.level >= 5; } },
    { id: 'coins-1000', fa: 'گنجینه‌دار', desc: '۱۰۰۰ سکه در کل به دست بیار', check: function () { return state.records.coinsTotal >= 1000; } },
    { id: 'star-15', fa: 'شکارچی ستاره', desc: 'تو یه دور ۱۵ ستاره بگیر', check: function () { return state.counters.starsBest >= 15; } },
    { id: 'collector-10', fa: 'کلکسیونر', desc: '۱۰ آیتم داشته باش', check: function () { return state.owned.length >= 10; } },
    { id: 'streak-7', fa: 'وفادار', desc: '۷ روز پشت سر هم ناز کن یا غذا بده', check: function () { return state.records.petStreakBest >= 7 || state.records.feedStreakBest >= 7; } },
    { id: 'games-25', fa: 'بازی‌باز', desc: '۲۵ بار بازی کن', check: function () { return (state.counters.gamesPlayed.star + state.counters.gamesPlayed.memory + state.counters.gamesPlayed.timing) >= 25; } }
  ];
  function checkAchievements() {
    var changed = false;
    ACHIEVEMENTS.forEach(function (a) {
      if (state.records.achievements.indexOf(a.id) === -1 && a.check()) {
        state.records.achievements.push(a.id);
        changed = true;
        toast('دستاورد: ' + a.fa + '!');
        logDiary('دستاورد «' + a.fa + '» رو گرفت!');
      }
    });
    if (changed) save();
  }
  function renderDiary() {
    var list = document.getElementById('diary-list');
    if (!list) return;
    list.innerHTML = '';
    if (!state.diary.length) { list.innerHTML = '<p class="empty-note">هنوز چیزی نوشته نشده — برو باهاش بازی کن!</p>'; return; }
    state.diary.forEach(function (e) {
      var row = document.createElement('div');
      row.className = 'd-row';
      row.innerHTML = '<div class="d-info"><h4>روز ' + toFaDigits(e.day) + ' — ' + e.date + '</h4><p>' + e.text + '</p></div>';
      list.appendChild(row);
    });
  }
  function renderLeaderboard() {
    var list = document.getElementById('leaderboard-list');
    if (!list) return;
    list.innerHTML = '';
    var rows = [];
    state.records.starTop.forEach(function (s) { rows.push({ label: 'ستاره‌گیر', score: s.score, date: s.date }); });
    if (state.records.memoryBest) rows.push({ label: 'حافظه', score: state.records.memoryBest.moves + ' حرکت', date: state.records.memoryBest.date });
    if (state.records.timingBest) rows.push({ label: 'ضربه‌ی دقیق', score: state.records.timingBest.score, date: state.records.timingBest.date });
    if (!rows.length) { list.innerHTML = '<p class="empty-note">هنوز رکوردی نیست — یه بازی بکن!</p>'; return; }
    rows.forEach(function (r, i) {
      var row = document.createElement('div');
      row.className = 'lb-row';
      row.innerHTML = '<span class="rank">' + (i + 1) + '</span><img src="assets/icons/trophy.png" alt=""><div class="q-info"><h4>' + r.label + '</h4><p>' + r.date + '</p></div><span class="px-num">' + r.score + '</span>';
      list.appendChild(row);
    });
  }
  function renderToday() {
    var el = document.getElementById('today-text');
    if (!el) return;
    if (state.diary.length) el.textContent = 'روز ' + toFaDigits(dayNumber()) + ' — ' + state.diary[0].text;
    else el.textContent = 'روز ' + toFaDigits(dayNumber()) + ' — آستولفو تازه به اتاقش اومده!';
    var st = document.getElementById('streak-text');
    if (st) st.textContent = state.streakDays > 1 ? toFaDigits(state.streakDays) + ' روز پیاپی' : '';
  }

  // ---------- settings ----------
  function renderSettings() {
    var m = document.getElementById('set-mute');
    if (m) m.classList.toggle('on', !state.muted);
    var rm = document.getElementById('set-motion');
    if (rm) rm.classList.toggle('on', !!state.settings.reducedMotion);
    var dn = document.getElementById('set-daynight');
    if (dn) dn.value = state.settings.dayNight || 'auto';
  }
  function applyDayNight() {
    var mode = state.settings.dayNight || 'auto';
    var night = false;
    if (mode === 'night') night = true;
    else if (mode === 'auto') {
      try {
        var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', hour12: false }).format(new Date());
        var h = parseInt(parts, 10);
        night = (h < 6 || h >= 20);
      } catch (e) {}
    }
    document.body.classList.toggle('night-mode', night && !state.sleeping);
  }
  function exportState() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'astolfo-save.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function importState(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var s = JSON.parse(reader.result);
        if (!s || s.v !== 2) { toast('فایل پشتیبان معتبر نیست'); return; }
        state = s; save(); applyGear(); render(); renderToday();
        toast('پشتیبان برگردانده شد!');
      } catch (e) { toast('فایل پشتیبان معتبر نیست'); }
    };
    reader.readAsText(file);
  }

  // ---------- music box (WebAudio) ----------
  var musicCtx = null, musicTimer = null, musicOn = false;
  var MUSIC_NOTES = [523, 659, 784, 1047, 784, 659, 587, 659, 784, 880, 784, 659, 587, 523];
  function musicNote(freq, when, dur) {
    var o = musicCtx.createOscillator(), g = musicCtx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.12, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(musicCtx.destination);
    o.start(when); o.stop(when + dur + 0.05);
  }
  function toggleMusicBox() {
    var img = document.getElementById('p-musicbox');
    if (musicOn) {
      musicOn = false;
      clearInterval(musicTimer); musicTimer = null;
      if (img) img.src = 'assets/props/music-box-closed.png';
      if (window.Rig) window.Rig.setDancing(false);
      return;
    }
    try {
      if (!musicCtx) musicCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (musicCtx.state === 'suspended') musicCtx.resume();
      var i = 0;
      var playNext = function () {
        var t = musicCtx.currentTime + 0.05;
        musicNote(MUSIC_NOTES[i % MUSIC_NOTES.length], t, 0.9);
        i++;
      };
      playNext();
      musicTimer = setInterval(playNext, 340);
      musicOn = true;
      if (img) img.src = 'assets/props/music-box-open.png';
      if (window.Rig) window.Rig.setDancing(true);
      sayBubble(L('musicBox', {}));
    } catch (e) { sayBubble(L('musicBox', {})); }
  }

  // ---------- clock (real Tehran time) ----------
  function updateClock() {
    try {
      var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', minute: 'numeric', hour12: false });
      var parts = fmt.formatToParts(new Date());
      var h = 0, m = 0;
      parts.forEach(function (p) { if (p.type === 'hour') h = parseInt(p.value, 10); if (p.type === 'minute') m = parseInt(p.value, 10); });
      var hh = document.getElementById('clock-hour'), mm = document.getElementById('clock-minute');
      if (hh) { hh.style.transformOrigin = '28px 30px'; hh.style.transform = 'rotate(' + ((h % 12 + m / 60) * 30) + 'deg)'; }
      if (mm) { mm.style.transformOrigin = '28px 30px'; mm.style.transform = 'rotate(' + (m * 6) + 'deg)'; }
    } catch (e) {}
  }
  setInterval(updateClock, 30000);

  // ---------- room props ----------
  // NEW BRIEF 2026-11-27 — she STANDS in her place, never walks anywhere.
  // A shelf tap is an in-place reaction ONLY: a bubble line, nothing
  // else. No glance (the pre-walk character never turned her head to
  // the shelf), no book falls, no walk, no bend, no carry, no put-back,
  // no upset-after-fetch. The old choreography is DELETED here
  // (animateFallingBook + the walkTo/bendPickup/putBackBook/upsetPose
  // chain); the Rig functions themselves stay defined in rig.js as dead
  // code, unexported. state.shelfBusy /
  // shelfLastUpset stay in defaultState only for save-compat with older
  // saves; nothing reads or writes them any more. The shelfUpset /
  // pickUp / walking pools in lines.js are now unused by this file.
  var shelfLastAt = 0;
  function shelfSequence() {
    if (window.Rig && window.Rig.isBusy()) return;
    if (Date.now() - shelfLastAt < 1500) return; // don't spam the line
    shelfLastAt = Date.now();
    // MERGE 2026-11-28 (pre-walk character): no glance. The pre-walk
    // character never turned her head to the shelf — a shelf tap is a
    // bubble line only. (Rig.triggerGlance is removed.)
    sayBubble('قفسه‌ی کتابامه! دست نزن بهشون!');
  }
  function heartsFx() {
    var layer = document.getElementById('hearts');
    if (!layer) return;
    for (var i = 0; i < 6; i++) {
      var h = document.createElement('img');
      h.className = 'h';
      h.src = 'assets/icons/heart.png';
      h.style.left = (150 + i * 14 + Math.random() * 10) + 'px';
      h.style.top = (220 + Math.random() * 30) + 'px';
      h.style.animationDelay = (i * 0.08) + 's';
      layer.appendChild(h);
      (function (el) { setTimeout(function () { el.remove(); }, 1800); })(h);
    }
  }
  function dropletsFx(cx) {
    var layer = document.getElementById('droplets');
    if (!layer) return;
    var c = (typeof cx === 'number') ? cx : 55; // room coords: 55 = plant, 195 = her
    for (var i = 0; i < 8; i++) {
      var d = document.createElement('span');
      d.className = 'd';
      d.style.left = (c - 10 + i * 3) + 'px';
      d.style.top = '300px';
      d.style.animationDelay = (i * 0.07) + 's';
      layer.appendChild(d);
      (function (el) { setTimeout(function () { el.remove(); }, 1200); })(d);
    }
  }

  function bindProps() {
    var on = function (id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', function (e) { e.stopPropagation(); fn(); }); };
    on('p-books', shelfSequence);
    // The four props below sit UNDER #charCanvas (z-index 2 < 3), so a real
    // tap never reaches their own click listener — the canvas swallows it.
    // Their handlers are named functions so the canvas tap router below can
    // dispatch to the exact same code. (z-index is NOT raised: the window
    // must stay visually BEHIND her head.)
    var doShelfLine = function () { sayBubble('قفسه‌ی کتابامه! دست نزن بهشون!'); };
    var doWindow = function () {
      state.windowOpen = !state.windowOpen;
      save();
      var w = document.getElementById('p-window');
      var closed = document.getElementById('win-closed'), open = document.getElementById('win-open');
      if (state.windowOpen) {
        if (closed) closed.style.display = 'none';
        if (open) open.style.display = 'block';
        if (w) { w.classList.add('opening'); setTimeout(function () { w.classList.remove('opening'); }, 600); }
        document.body.classList.add('window-open');
        sayBubble(L('windowOpen', {}));
      } else {
        if (closed) closed.style.display = 'block';
        if (open) open.style.display = 'none';
        document.body.classList.remove('window-open');
        sayBubble(L('windowClose', {}));
      }
    };
    on('p-shelf', doShelfLine);
    on('p-window', doWindow);
    on('p-lamp', function () {
      state.lampOn = !state.lampOn;
      save();
      var img = document.getElementById('p-lamp');
      if (img) img.src = state.lampOn ? 'assets/props/lamp-on.png' : 'assets/props/lamp-off.png';
      document.body.classList.toggle('lamp-on', state.lampOn);
      sayBubble(L(state.lampOn ? 'lampOn' : 'lampOff', {}));
    });
    on('p-plant', function () {
      if (window.Rig && window.Rig.isBusy()) return;
      // NEW BRIEF 2026-11-27: in place — she waters from where she stands.
      dropletsFx();
      state.plantFlower = true;
      var img = document.getElementById('p-plant');
      if (img) img.src = 'assets/props/plant-flower.png';
      addStat('happiness', 3); addXP(1);
      sayBubble(L('plantWater', {}));
      save(); render();
    });
    on('p-plush', function () {
      if (window.Rig && window.Rig.isBusy()) return;
      if (Date.now() - state.lastPlushAt < 5000) { sayBubble('همین الان بغلش کردم!'); return; }
      state.lastPlushAt = Date.now();
      // NEW BRIEF 2026-11-27: in place — hug from where she stands.
      if (window.Rig) window.Rig.happyPose();
      heartsFx();
      if (window.Rig.playVoice) window.Rig.playVoice('pet');
      addStat('happiness', 5); addXP(2);
      sayBubble(L('plushHug', {}));
      save(); render();
    });
    on('p-ball', function () {
      if (window.Rig && window.Rig.isBusy()) return;
      if (Date.now() - state.lastBallAt < 5000) return;
      state.lastBallAt = Date.now();
      var ball = document.getElementById('p-ball');
      var target = 150 + Math.random() * 80;
      // NEW BRIEF 2026-11-27: the BALL rolls, she does not move — in-place
      // happy bounce + bubble line while the ball rolls away and back.
      if (ball) {
        ball.style.transition = 'left .9s cubic-bezier(.3,.7,.4,1), top .9s ease';
        ball.style.left = target + 'px'; ball.style.top = '505px';
      }
      if (window.Rig) window.Rig.happyPose();
      sayBubble(L('ballKick', {}));
      addStat('happiness', 4); addXP(1);
      save(); render();
      setTimeout(function () {
        if (ball) { ball.style.left = '60px'; ball.style.top = '520px'; }
      }, 1200);
    });
    var doPoster = function () {
      if (window.Rig && window.Rig.isBusy()) return;
      // NEW BRIEF 2026-11-27: in place — the lookPose glance is already
      // zero-translation, so just do it from where she stands.
      // lookPose dur is SECONDS (rig.js runAnim convention — every other
      // pose uses seconds); 2200 here would mean a 2200s animation and
      // leave the rig stuck busy for 36 minutes.
      if (window.Rig) window.Rig.lookPose(15, 2.2);
      sayBubble(L('posterLook', {}));
    };
    var doClock = function () {
      // lookPose dur is SECONDS (see doPoster note): 2000 would stick the
      // rig busy for 2000s.
      if (window.Rig) window.Rig.lookPose(-12, 2.0);
      sayBubble(L('clockLook', {}));
    };
    on('p-poster', doPoster);
    on('p-clock', doClock);
    on('p-musicbox', toggleMusicBox);
    on('p-bowl', function () {
      if (!state.bowlFull) { sayBubble('کاسه خالیه! اول غذا بده.'); return; }
      if (window.Rig && window.Rig.isBusy()) return;
      // NEW BRIEF 2026-11-27: in place — she eats from where she stands.
      if (window.Rig) window.Rig.eatPose();
      state.bowlFull = false;
      var img = document.getElementById('p-bowl');
      if (img) img.src = 'assets/props/bowl-empty.png';
      addStat('hunger', 10); addStat('happiness', 4);
      sayBubble(L('bowlEat', {}));
      save(); render();
    });
    on('p-diary', function () { openSheet('diary'); });
    // Canvas: tap character = pet/poke; tap rug = sit/stand.
    var cv = document.getElementById('charCanvas');
    if (cv) cv.addEventListener('click', function (e) {
      if (state.sleeping) { wake(); return; }
      var r = cv.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      var cx = window.Rig ? window.Rig.getCharX() : 215;
      var roomH = r.height;
      var scaleY = roomH / 600;
      // Props UNDER the canvas (z-index 2 < 3) never receive their own click:
      // route taps by region, in room coords (390x600). Checked BEFORE the
      // character bbox — clock/poster/shelf rects overlap its left/right
      // edges, and the window's bottom strip is behind her hair (window rect
      // ends at y170, headTop starts at 172, so no head-pet is stolen).
      var rx = x / (r.width / 390), ry = y / scaleY;
      if (rx >= 130 && rx <= 260 && ry >= 58 && ry <= 170) { doWindow(); return; }
      if (rx >= 12 && rx <= 70 && ry >= 200 && ry <= 260) { doClock(); return; }
      if (rx >= 290 && rx <= 370 && ry >= 200 && ry <= 290) { doPoster(); return; }
      if (rx >= 10 && rx <= 78 && ry >= 300 && ry <= 362) { doShelfLine(); return; }
      // Rug first when the tap is on the rug but clear of her feet: the rug
      // zone (y 496-592) otherwise sits inside the character bbox and a rug
      // tap would always read as a poke. All comparisons in ROOM coords
      // (rx/ry): cx is a room coordinate (Rig.getCharX) and comparing the raw
      // screen x against it shifted the hit box ~20px left on the POCO
      // (437px viewport, room scale 1.10), so taps near her right edge missed
      // and taps left of her body registered as pets.
      if (ry > 496 && ry < 592 && Math.abs(rx - cx) > 70) {
        var sitting = !document.body.classList.contains('sitting');
        document.body.classList.toggle('sitting', sitting);
        if (window.Rig) window.Rig.setSitting(sitting);
        sayBubble(L('rugSit', {}));
      } else if (rx > cx - 165 && rx < cx + 165 && ry > 172 && ry < 552) {
        if (ry < 300) pet(); else poke();
      }
    });
  }

  // ---------- render HUD ----------
  function render() {
    var m = mood();
    if (window.Rig) {
      window.Rig.setSleepy(m === 'sleepy' || m === 'bored');
      window.Rig.setExcited(m === 'excited');
      window.Rig.setMuted(!!state.muted);
      window.Rig.setReducedMotion(!!state.settings.reducedMotion);
    }
    var C = 97.4;
    document.querySelectorAll('.ring').forEach(function (ring) {
      var key = ring.getAttribute('data-meter');
      var v = key === 'affection' ? Math.round(100 * state.affectionXP / xpForNext()) : state.stats[key];
      var fg = ring.querySelector('.ring-fg');
      if (fg) fg.style.strokeDashoffset = (C * (1 - v / 100)).toFixed(1);
      ring.classList.toggle('low', v < 40 && key !== 'affection');
    });
    var coinsEl = document.getElementById('coins-val');
    if (coinsEl) coinsEl.textContent = state.coins;
    var sc = document.getElementById('sheet-coins-val');
    if (sc) sc.textContent = state.coins;
    var dayEl = document.getElementById('day-val');
    if (dayEl) dayEl.textContent = dayNumber();
    var stage = document.getElementById('stage-pill');
    if (stage) stage.textContent = '· مرحله ' + toFaDigits(dayNumber() >= 30 ? 3 : (dayNumber() >= 14 ? 2 : 1));
    var bowl = document.getElementById('p-bowl');
    if (bowl) bowl.src = state.bowlFull ? 'assets/props/bowl-full.png' : 'assets/props/bowl-empty.png';
    var plant = document.getElementById('p-plant');
    if (plant && state.plantFlower) plant.src = 'assets/props/plant-flower.png';
    var lamp = document.getElementById('p-lamp');
    if (lamp) lamp.src = state.lampOn ? 'assets/props/lamp-on.png' : 'assets/props/lamp-off.png';
    document.body.classList.toggle('lamp-on', !!state.lampOn);
    var closed = document.getElementById('win-closed'), open = document.getElementById('win-open');
    if (closed && open) {
      closed.style.display = state.windowOpen ? 'none' : 'block';
      open.style.display = state.windowOpen ? 'block' : 'none';
    }
    document.body.classList.toggle('window-open', !!state.windowOpen);
    if (state.sleeping) document.body.classList.add('sleeping');
    renderToday();
    applyDayNight();
  }

  // ---------- room scale-to-fit ----------
  // The room is a fixed 390x600 stage (every prop/character coordinate is in
  // that space). Scale it to fill the phone: min(wrapW/390, wrapH/600). The
  // wrap's flexbox centres it; its gradient hides the slack. Re-fit the rig
  // canvas afterwards so its backing store matches the scaled rect (rig.js
  // draws resolution-independently, but the backing must be re-measured
  // after the transform changes — and rig's own resize listener runs BEFORE
  // this one, so it would read the stale rect).
  function fitRoom() {
    var wrap = document.querySelector('.room-wrap');
    var room = document.getElementById('room');
    if (!wrap || !room) return;
    var w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    room.style.transform = 'scale(' + Math.min(w / 390, h / 600) + ')';
    if (window.Rig && window.Rig.refit) window.Rig.refit();
  }

  // ---------- init ----------
  function init() {
    applyOfflineDecay();
    fitRoom();
    window.addEventListener('resize', fitRoom);
    window.addEventListener('orientationchange', function () { setTimeout(fitRoom, 120); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { applyOfflineDecay(); render(); } });
    var canvas = document.getElementById('charCanvas');
    var rigReady = window.Rig ? window.Rig.init(canvas) : Promise.resolve();
    loadItems().then(function () { applyGear(); });
    rigReady.then(function () {
      fitRoom();
      applyGear();
      render();
      updateClock();
      // Greeting in the pet's bubble (not a billboard).
      var today = todayStr();
      if (state.lastGreetDate !== today) {
        state.lastGreetDate = today; save();
        setTimeout(function () { sayBubble(L('greet', { hour: hourNow() }), 5000); }, 600);
      }
      startIdleLines();
      bindProps();
      // Dock
      var dock = function (id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
      dock('dock-feed', function () { openSheet('food'); });
      dock('dock-play', function () { openSheet('games'); });
      dock('dock-wash', clean);
      dock('dock-sleep', toggleSleep);
      dock('dock-praise', pet);
      dock('gear-btn', function () { openSheet('settings'); });
      dock('rail-shop', function () { openSheet('shop'); });
      dock('rail-quests', function () { openSheet('quests'); });
      dock('rail-diary', function () { openSheet('diary'); });
      dock('wake-btn', wake);
      dock('today-strip', function () { openSheet('diary'); });
      dock('sheet-x', function () { closeSheet(); });
      dock('sheetBackdrop', function () { closeSheet(); });
      // Games
      dock('star-start', startStarGame);
      dock('star-quit', function () { stopStarGame(); openSheet('games'); });
      dock('memory-quit', function () { memoryGame.active = false; openSheet('games'); });
      dock('timing-tap', timingTap);
      dock('timing-quit', function () { stopTimingGame(); openSheet('games'); });
      dock('hideseek-quit', function () { hideGame.active = false; var cv = document.getElementById('charCanvas'); if (cv) cv.style.opacity = '1'; openSheet('games'); });
      document.querySelectorAll('.hide-spots button').forEach(function (b) {
        b.addEventListener('click', function () { hideSeekGuess(b.getAttribute('data-spot')); });
      });
      // Settings
      var sm = document.getElementById('set-mute');
      if (sm) sm.addEventListener('click', function () { state.muted = !state.muted; save(); render(); renderSettings(); });
      var srm = document.getElementById('set-motion');
      if (srm) srm.addEventListener('click', function () { state.settings.reducedMotion = !state.settings.reducedMotion; save(); render(); renderSettings(); });
      var sdn = document.getElementById('set-daynight');
      if (sdn) sdn.addEventListener('change', function () { state.settings.dayNight = sdn.value; save(); render(); });
      var be = document.getElementById('btn-export');
      if (be) be.addEventListener('click', exportState);
      var bi = document.getElementById('btn-import');
      var fi = document.getElementById('import-file');
      if (bi && fi) { bi.addEventListener('click', function () { fi.click(); }); fi.addEventListener('change', function () { if (fi.files[0]) importState(fi.files[0]); }); }
      var br = document.getElementById('btn-reset');
      if (br) br.addEventListener('click', function () {
        if (confirm('همه‌چیز از اول شروع بشه؟ سکه‌ها، آیتم‌ها و دفتر خاطرات پاک می‌شن.')) {
          localStorage.removeItem(STORE_KEY);
          location.reload();
        }
      });
      // PWA install prompt
      var deferredPrompt = null;
      window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;
        var ib = document.getElementById('install-btn');
        if (ib) ib.style.display = 'block';
      });
      var ib = document.getElementById('install-btn');
      if (ib) ib.addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () { deferredPrompt = null; ib.style.display = 'none'; });
      });
      if ('serviceWorker' in navigator) { /* no SW file yet: manifest only, no offline cache claim */ }
      render();
    });
  }

  window.Game = {
    init: init, get state() { return state; }, save: save, render: render, mood: mood,
    openSheet: openSheet, closeSheet: closeSheet, sayBubble: sayBubble, clearBubble: clearBubble,
    feed: feed, clean: clean, pet: pet, poke: poke, toggleSleep: toggleSleep, wake: wake,
    buy: buy, equip: equip, addCoins: addCoins, addXP: addXP, toFaDigits: toFaDigits,
    xpForNext: xpForNext, L: L, hourNow: hourNow, logDiary: logDiary,
    startStarGame: startStarGame, startMemoryGame: startMemoryGame, startTimingGame: startTimingGame,
    startHideSeek: startHideSeek, shelfSequence: shelfSequence,
    QUESTS: QUESTS, ACHIEVEMENTS: ACHIEVEMENTS, checkQuests: checkQuests, checkAchievements: checkAchievements
  };
})();
