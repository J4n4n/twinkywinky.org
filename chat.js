// Astolfo in-site chat client — rebuild.
// Talks to the Render proxy (twinkywinky-chat.onrender.com). No API key here, ever.
// Plain script. Exposes window.Chat { init, send, onOpen }.
(function () {
  'use strict';

  // The only line to change when the proxy moves. No trailing slash.
  var CHAT_API_BASE_URL = 'https://twinkywinky-chat.onrender.com';
  var CHAT_COINS_PER_DAY = 10;

  var logEl = null, audioCtx = null, opened = false;

  // Local fallback lines (used only if the proxy itself is unreachable;
  // the server also has its own fallback pool for Gemini failures).
  var LOCAL_FALLBACK = [
    'یاهو! مغزم یه لحظه رفت استراحت، یه بار دیگه بگو ببینم!',
    'اوه! سرم یه کم گیج رفت، ولی برگشتم! دوباره بگو چی گفتی؟',
    'هی هی! یه لحظه هنگ کردم، ولی الان سر حالم! دوباره بگو!',
    'اوه اوه! فکرم یه لحظه رفت پیاده‌روی! برگشت، بگو چی گفتی؟',
    'هی! یه ثانیه مغزم رفت دنبال یه پروانه! برگشتم، دوباره بگو!',
    'وای! یه لحظه ذهنم رفت تو ابرا! پیداش کردم، بگو ببینم!'
  ];

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function appendMsg(cls, text) {
    if (!logEl) logEl = document.getElementById('chat-log');
    if (!logEl) return null;
    var div = document.createElement('div');
    div.className = 'msg ' + cls;
    div.textContent = text;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
    return div;
  }

  function blip() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 1150 + Math.random() * 250;
      g.gain.setValueAtTime(0.06, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.07);
    } catch (e) {}
  }

  function typewriter(el, fullText, done) {
    var i = 0;
    el.textContent = '';
    var step = function () {
      i += 2;
      el.textContent = fullText.slice(0, i);
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
      if (i % 8 === 0) blip();
      if (i < fullText.length) setTimeout(step, 18);
      else if (done) done();
    };
    step();
  }

  function awardChatCoin() {
    if (!window.Game) return;
    var s = window.Game.state;
    var today = todayStr();
    if (s.chatCoinsDate !== today) { s.chatCoinsDate = today; s.chatCoinsToday = 0; }
    if (s.chatCoinsToday < CHAT_COINS_PER_DAY) {
      s.chatCoinsToday += 1;
      window.Game.addCoins(1, 'chat');
    }
    window.Game.save();
  }

  function send(text) {
    if (!text || !text.trim()) return;
    if (window.Game && window.Game.clearBubble) window.Game.clearBubble();
    appendMsg('me', text);
    var typing = appendMsg('sys', 'داره فکر می‌کنه...');
    setInputsDisabled(true);
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 45000); // Render free tier cold-starts slowly
    fetch(CHAT_API_BASE_URL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
      signal: controller.signal
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        clearTimeout(timeout);
        if (typing) typing.remove();
        var reply = (data && data.reply) ? String(data.reply) : '';
        if (!reply) reply = LOCAL_FALLBACK[Math.floor(Math.random() * LOCAL_FALLBACK.length)];
        var el = appendMsg('astolfo', '');
        typewriter(el, reply, function () {
          awardChatCoin();
          if (window.Rig) window.Rig.chatReact();
        });
      })
      .catch(function () {
        clearTimeout(timeout);
        if (typing) typing.remove();
        var reply = LOCAL_FALLBACK[Math.floor(Math.random() * LOCAL_FALLBACK.length)];
        var el = appendMsg('astolfo', '');
        typewriter(el, reply, function () {
          awardChatCoin();
          if (window.Rig) window.Rig.chatReact();
        });
        appendMsg('sys', '(چت آفلاین شد — ولی آستولفو هنوز اینجاست!)');
      })
      .finally(function () { setInputsDisabled(false); });
  }

  function setInputsDisabled(dis) {
    ['chat-input', 'chat-input-sheet'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.disabled = dis;
    });
    ['chat-send', 'chat-send-sheet'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.disabled = dis;
    });
  }

  function onOpen() {
    if (!opened) {
      opened = true;
      logEl = document.getElementById('chat-log');
      if (logEl && !logEl.children.length) {
        appendMsg('astolfo', 'یاهو! خوش اومدی! امروز چطوری؟ بریم بازی کنیم؟');
      }
    }
    // Focus the SHEET input on every device (the old pointer:fine check left
    // mobile users tapping a dead input). Delay past the sheet transition so
    // the mobile keyboard actually opens.
    var input = document.getElementById('chat-input-sheet');
    if (input) setTimeout(function () { input.focus(); }, 320);
  }

  // Move the user from the collapsed home-bar input into the sheet input:
  // the sheet slides OVER the bar, so anything typed in the hidden collapsed
  // input is stranded and its send button is unreachable under the overlay
  // (the message was silently lost). Transfer any text already typed and
  // focus the sheet input so every keystroke lands there.
  function handOffToSheet() {
    var collapsed = document.getElementById('chat-input');
    var sheet = document.getElementById('chat-input-sheet');
    if (!collapsed || !sheet) return;
    if (collapsed.value) { sheet.value = collapsed.value; collapsed.value = ''; }
    collapsed.blur();
    setTimeout(function () { sheet.focus(); }, 320);
  }

  function init() {
    var sendCollapsed = function () {
      var input = document.getElementById('chat-input');
      if (!input) return;
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      if (window.Game && window.Game.state && window.Game.state.sleeping) return;
      openChatSheet();
      send(text);
    };
    var sendSheet = function () {
      var input = document.getElementById('chat-input-sheet');
      if (!input) return;
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      send(text);
    };
    var sendBtn = document.getElementById('chat-send');
    if (sendBtn) sendBtn.addEventListener('click', sendCollapsed);
    var input = document.getElementById('chat-input');
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendCollapsed(); }
      // No auto-open on other keys: focus already opens the sheet, and
      // opening here would steal the keystroke that triggered it.
    });
    if (input) input.addEventListener('focus', function () {
      if (window.Game && window.Game.state && window.Game.state.sleeping) return;
      openChatSheet();
      handOffToSheet();
    });
    var sendBtn2 = document.getElementById('chat-send-sheet');
    if (sendBtn2) sendBtn2.addEventListener('click', sendSheet);
    var input2 = document.getElementById('chat-input-sheet');
    if (input2) input2.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendSheet(); }
    });
    var mic = document.getElementById('mic-btn');
    if (mic) mic.addEventListener('click', function () {
      if (window.Game) window.Game.sayBubble('میکروفون هنوز آماده نیست — فعلاً تایپ کن!');
    });
  }

  function openChatSheet() {
    if (window.Game) window.Game.openSheet('chat');
  }

  window.Chat = { init: init, send: send, onOpen: onOpen, baseUrl: CHAT_API_BASE_URL, fallbackCount: LOCAL_FALLBACK.length };
})();
