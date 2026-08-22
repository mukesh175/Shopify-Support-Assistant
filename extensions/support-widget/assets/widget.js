(function () {
  var root = document.getElementById('support-assistant-root');
  if (!root) return;

  var PROXY = root.dataset.proxyUrl || '/apps/support/query';
  var ACCENT = root.dataset.accent || '#1a1a1a';
  var TEXTCOLOR = root.dataset.textColor || '#ffffff';
  var GREETING = root.dataset.greeting || 'Hi! Ask about your order or our policies.';
  var POPUP = root.dataset.popup || '';
  var ICON = root.dataset.icon || 'bubble';
  var POSITION = root.dataset.position === 'left' ? 'left' : 'right';
  var BRAND = root.dataset.brandName || 'Support';
  var CUSTOMER = root.dataset.customerName || '';
  var SUGGESTIONS = [];
  // WhatsApp handoff is a paid feature. The number is served by /config only
  // when the shop's plan includes handoff, so it is never present in the page
  // for shops without it. Empty until config answers, so a failed or slow call
  // cannot leak the feature.
  var WHATSAPP = '';
  function waReady() { return !!WHATSAPP; }
  // Photo evidence is a paid feature; off until /config says otherwise, so a
  // slow or failed call never offers something the shop cannot use.
  var PHOTOS_ENABLED = false;

  var ICONS = {
    bubble: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    headset: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
    robot: '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16h.01M16 16h.01"/>',
    question: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'
  };

  // launcher
  var launcher = el('button', 'sa-launcher');
  launcher.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="' + TEXTCOLOR + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[ICON] || ICONS.bubble) + '</svg>';
  launcher.style.background = ACCENT;
  launcher.style[POSITION] = '20px';

  // popup teaser bubble
  var pop = null;
  if (POPUP) {
    pop = el('div', 'sa-popup', POPUP);
    pop.style[POSITION] = '88px';
    var popClose = el('button', 'sa-popup-close', '×');
    pop.appendChild(popClose);
    popClose.addEventListener('click', function (e) { e.stopPropagation(); pop.remove(); pop = null; });
    pop.addEventListener('click', open);
  }

  var panel = el('div', 'sa-panel');
  panel.style[POSITION] = '20px';
  panel.innerHTML =
    '<div class="sa-header">' +
      '<div class="sa-ident">' +
        '<span class="sa-avatar" style="background:' + ACCENT + ';color:' + TEXTCOLOR + '">' +
          escapeHtml((BRAND || '?').charAt(0).toUpperCase()) + '</span>' +
        '<span class="sa-brandname">' + escapeHtml(BRAND) + '</span>' +
      '</div>' +
      '<div class="sa-hactions">' +
        '<button class="sa-hist-btn" aria-label="Chat history">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 106 5.3L3 8"/><path d="M12 7v5l4 2"/></svg></button>' +
        '<button class="sa-new-btn" aria-label="New chat">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg></button>' +
        '<button class="sa-expand" aria-label="Expand">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>' +
        '<button class="sa-close" aria-label="Close">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
          '<path d="M5 12h14"/></svg></button>' +
      '</div>' +
    '</div>' +
    '<div class="sa-body"></div>' +
    '<div class="sa-history"></div>' +
    '<div class="sa-quick">' +
      '<button data-q="faq">Ask a question</button>' +
      '<button data-q="product">Find a product</button>' +
      '<button data-q="order">Track my order</button>' +
      '<button data-q="return">Return an item</button>' +
      '<button data-q="cancel">Cancel an order</button>' +
      '<button data-q="reorder">Buy again</button>' +
      '<button data-q="wa" class="sa-wa-quick" style="display:none">WhatsApp us</button>' +
    '</div>' +
    '<div class="sa-inputbar">' +
      '<input type="text" placeholder="Ask anything…">' +
      '<button class="sa-send" style="background:' + ACCENT + ';color:' + TEXTCOLOR + '" aria-label="Send">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div>';

  document.body.appendChild(launcher);
  if (pop) document.body.appendChild(pop);
  document.body.appendChild(panel);

  // "Powered by" branding footer — shown by default, hidden on Pro plan.
  var brandFoot = el('div', 'sa-brand', '⚡ Powered by Zappy');
  panel.appendChild(brandFoot);
  (function loadConfig() {
    var configUrl = PROXY.replace(/\/query$/, '/config');
    fetch(configUrl, { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        if (cfg && cfg.branding === false) brandFoot.style.display = 'none';
        if (cfg && cfg.suggestions && cfg.suggestions.length) {
          SUGGESTIONS = cfg.suggestions.filter(function (q) {
            return typeof q === 'string' && q.trim();
          });
          // The panel may already be open — config can resolve after the
          // shopper clicks the launcher, which used to lose the chips.
          if (greeted) showSuggestions();
        }
        if (cfg && cfg.photos === true) PHOTOS_ENABLED = true;
        if (cfg && typeof cfg.whatsapp === 'string' && cfg.whatsapp) {
          WHATSAPP = cfg.whatsapp.replace(/[^0-9]/g, '');
          var waQuick = panel.querySelector('.sa-wa-quick');
          if (waQuick && WHATSAPP) waQuick.style.display = '';
        }
      })
      .catch(function () {});
  })();

  var body = panel.querySelector('.sa-body');
  var textInput = panel.querySelector('.sa-inputbar input');
  var sendBtn = panel.querySelector('.sa-send');
  var histView = panel.querySelector('.sa-history');
  var mode = 'faq';
  var greeted = false;
  var lastEmail = '';

  /* ---- Chat history -------------------------------------------------------
   * Kept in the shopper's own browser. Nothing is sent to the server, so a
   * shared or public device does not leak past conversations to the store,
   * and the shopper can clear it with normal browser data controls.
   */
  var HKEY = 'zappy-chat-history-v1';
  var MAX_SESSIONS = 20;
  var sessions = loadSessions();
  var current = null;
  var restoring = false;

  function loadSessions() {
    try {
      var raw = JSON.parse(window.localStorage.getItem(HKEY));
      return Object.prototype.toString.call(raw) === '[object Array]' ? raw : [];
    } catch (e) { return []; }
  }
  function saveSessions() {
    try {
      sessions = sessions.slice(-MAX_SESSIONS);
      window.localStorage.setItem(HKEY, JSON.stringify(sessions));
    } catch (e) { /* private mode or quota — history is best-effort */ }
  }
  function record(who, text) {
    if (restoring || !text) return;
    if (!current) {
      current = { startedAt: new Date().toISOString(), messages: [] };
      sessions.push(current);
    }
    current.messages.push({ who: who, text: text });
    saveSessions();
  }

  function fmtDateTime(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) +
        ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function showHistory() {
    histView.innerHTML = '';
    var head = el('div', 'sa-hist-head');
    var back = el('button', 'sa-hist-back', '← Back');
    back.addEventListener('click', hideHistory);
    head.appendChild(back);
    histView.appendChild(head);
    histView.appendChild(el('div', 'sa-hist-title', 'Chat history'));

    var past = sessions.filter(function (s) { return s.messages && s.messages.length; });
    if (!past.length) {
      histView.appendChild(el('div', 'sa-hist-empty', 'No previous chats yet.'));
    } else {
      past.slice().reverse().forEach(function (s) {
        var item = el('button', 'sa-hist-item');
        item.appendChild(el('div', 'sa-hist-when', fmtDateTime(s.startedAt)));
        var last = s.messages[s.messages.length - 1];
        item.appendChild(el('div', 'sa-hist-prev', last ? last.text : ''));
        item.addEventListener('click', function () { openSession(s); });
        histView.appendChild(item);
      });
    }
    panel.classList.add('sa-showhist');
  }
  function hideHistory() { panel.classList.remove('sa-showhist'); }

  function openSession(s) {
    body.innerHTML = '';
    restoring = true;
    s.messages.forEach(function (m) {
      if (m.who === 'user') user(m.text); else bot(m.text);
    });
    restoring = false;
    current = s;
    greeted = true;
    hideHistory();
    showSuggestions();
  }

  function newChat() {
    current = null;
    body.innerHTML = '';
    greeted = false;
    hideHistory();
    open();
  }

  // The welcome panel stands in for the first bot message. It is cleared the
  // moment a real conversation starts so it never sits above the transcript.
  function showWelcome() {
    var wrap = el('div', 'sa-welcome');
    var hi = CUSTOMER ? 'Hi ' + CUSTOMER + '!' : 'Hi there!';
    wrap.appendChild(el('div', 'sa-welcome-title', hi));
    wrap.appendChild(el('div', 'sa-welcome-sub', GREETING));
    body.appendChild(wrap);
  }
  function clearWelcome() {
    var w = body.querySelector('.sa-welcome');
    if (w) w.remove();
  }

  function open() {
    panel.classList.add('sa-open');
    if (pop) { pop.remove(); pop = null; }
    if (!greeted) {
      showWelcome();
      showSuggestions();
      greeted = true;
    }
  }

  /**
   * Render the saved-question chips at the bottom of the transcript. Called
   * again after every answer so the shopper can keep picking from the
   * knowledge base instead of having to think of wording themselves — and
   * re-called when /config resolves, since it may land after the panel opens.
   */
  function showSuggestions() {
    var old = body.querySelector('.sa-suggests');
    if (old) old.remove();
    if (!SUGGESTIONS.length) return;
    var wrap = el('div', 'sa-suggests');
    SUGGESTIONS.slice(0, 4).forEach(function (q) {
      var chip = el('button', 'sa-suggest', q);
      chip.addEventListener('click', function () {
        wrap.remove();
        mode = 'faq';
        user(q);
        post({ intent: 'faq', message: q });
      });
      wrap.appendChild(chip);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }
  function close() { panel.classList.remove('sa-open'); }

  launcher.addEventListener('click', function () {
    panel.classList.contains('sa-open') ? close() : open();
  });
  panel.querySelector('.sa-close').addEventListener('click', close);
  panel.querySelector('.sa-hist-btn').addEventListener('click', function () {
    this.blur();
    panel.classList.contains('sa-showhist') ? hideHistory() : showHistory();
  });
  panel.querySelector('.sa-new-btn').addEventListener('click', function () {
    this.blur();
    newChat();
  });
  panel.querySelector('.sa-expand').addEventListener('click', function () {
    panel.classList.toggle('sa-expanded');
    body.scrollTop = body.scrollHeight;
  });

  panel.querySelectorAll('.sa-quick button').forEach(function (b) {
    b.addEventListener('click', function () {
      b.blur();
      var q = b.dataset.q;
      if (q === 'order') { showOrderChoice(); }
      else if (q === 'return') { showReturnStart(); }
      else if (q === 'cancel') { showCancelStart(); }
      else if (q === 'reorder') { showReorderStart(); }
      else if (q === 'wa') { if (waReady()) openWhatsApp('Hi, I need help.'); }
      else if (q === 'product') { mode = 'product'; textInput.placeholder = 'What are you looking for?'; bot('What are you looking for? e.g. "black snowboard" or "gift under $500".'); textInput.focus(); }
      else { mode = 'faq'; textInput.placeholder = 'Ask anything…'; textInput.focus(); }
    });
  });

  sendBtn.addEventListener('click', sendText);
  textInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendText(); });

  /**
   * Build a form rendered as a card inside the transcript (rather than docked
   * at the bottom), so collecting details reads as part of the conversation.
   * `fields` is a list of {name, type, placeholder, value}.
   */
  function formCard(opts) {
    var card = el('form', 'sa-formcard');
    var head = el('div', 'sa-fc-head');
    head.appendChild(el('div', 'sa-fc-icon', opts.icon || '📦'));
    var htext = el('div', 'sa-fc-htext');
    htext.appendChild(el('div', 'sa-fc-title', opts.title));
    htext.appendChild(el('div', 'sa-fc-sub', opts.subtitle));
    head.appendChild(htext);
    card.appendChild(head);

    opts.fields.forEach(function (f) {
      var input = el('input', 'sa-fc-input');
      input.name = f.name;
      input.type = f.type || 'text';
      input.placeholder = f.placeholder;
      if (f.value) input.value = f.value;
      input.required = true;
      card.appendChild(input);
    });

    var actions = el('div', 'sa-fc-actions');
    var cancel = el('button', 'sa-fc-cancel', 'Cancel');
    cancel.type = 'button';
    var submit = el('button', 'sa-fc-submit', opts.cta);
    submit.type = 'submit';
    submit.style.background = ACCENT;
    submit.style.color = TEXTCOLOR;
    actions.appendChild(cancel);
    actions.appendChild(submit);
    card.appendChild(actions);

    // While the card is asking for details, the quick actions and saved
    // questions below it are noise — and one of them repeats the card's own
    // submit button.
    panel.classList.add('sa-forming');
    var sug = body.querySelector('.sa-suggests');
    if (sug) sug.remove();
    function done() { panel.classList.remove('sa-forming'); card.remove(); }

    cancel.addEventListener('click', function () { done(); showSuggestions(); });
    card.addEventListener('submit', function (e) {
      e.preventDefault();
      var values = {};
      var ok = true;
      opts.fields.forEach(function (f) {
        var v = card[f.name].value.trim();
        if (!v) ok = false;
        values[f.name] = v;
      });
      if (!ok) return;
      done();
      opts.onSubmit(values);
    });

    body.appendChild(card);
    body.scrollTop = body.scrollHeight;
    return card;
  }

  function showOrderNumberForm() {
    formCard({
      icon: '📦',
      title: 'Track my order',
      subtitle: 'Please provide your information.',
      cta: 'Track my order',
      fields: [
        { name: 'orderName', placeholder: 'Order number' },
        { name: 'email', type: 'email', placeholder: 'Email used at checkout', value: lastEmail }
      ],
      onSubmit: function (v) {
        lastEmail = v.email;
        user('Track order ' + v.orderName);
        post({ intent: 'order', orderName: v.orderName, email: v.email });
      }
    });
  }

  function showEmailForm() {
    formCard({
      icon: '📧',
      title: 'Find my orders',
      subtitle: 'We’ll look up orders placed with this email.',
      cta: 'Find my orders',
      fields: [
        { name: 'email', type: 'email', placeholder: 'Email used at checkout', value: lastEmail }
      ],
      onSubmit: function (v) {
        lastEmail = v.email;
        user(v.email);
        post({ intent: 'orders_by_email', email: v.email });
      }
    });
  }

  function sendText() {
    var v = textInput.value.trim(); if (!v) return;
    user(v); textInput.value = '';
    post({ intent: mode, message: v });
  }

  function post(payload) {
    var typing = bot('', true);
    fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        typing.remove();
        bot(data.text || 'Sorry, something went wrong.');
        if (data.kind === 'order_status' && data.timeline && data.timeline.length) {
          renderTimeline(data.timeline, data.trackingUrl);
        }
        if (data.kind === 'order_list' && data.orders && data.orders.length) renderOrderList(data.orders);
        if (data.kind === 'recommend' && data.products && data.products.length) renderProducts(data.products);
        if (waReady() && (data.kind === 'unresolved' || data.kind === 'limit' || data.kind === 'recommend_locked')) offerWhatsApp(payload.message || 'my question');
        // Offer the saved questions again so the next question is one tap.
        showSuggestions();
      })
      .catch(function () {
        typing.remove(); bot('Sorry, I could not reach support right now.');
        if (waReady()) offerWhatsApp(payload.message || 'my question');
      });
  }

  /* ---- Returns ------------------------------------------------------------
   * Two steps: find the order, then pick items and a reason. The request is
   * recorded for the merchant to action — nothing is refunded automatically.
   */
  var RETURN_URL = PROXY.replace(/\/query$/, '/return');

  function postReturn(payload) {
    var typing = bot('', true);
    return fetch(RETURN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { typing.remove(); return data; })
      .catch(function () {
        typing.remove();
        bot('Sorry, I could not reach the store right now. Please try again.');
        return null;
      });
  }

  function showReturnStart() {
    bot('I can start a return for you. Which order is it for?');
    formCard({
      icon: '↩️',
      title: 'Return an item',
      subtitle: 'Find your order first.',
      cta: 'Find order',
      fields: [
        { name: 'orderName', placeholder: 'Order number' },
        { name: 'email', type: 'email', placeholder: 'Email used at checkout', value: lastEmail }
      ],
      onSubmit: function (v) {
        lastEmail = v.email;
        user('Return from order ' + v.orderName);
        postReturn({ action: 'lookup', orderName: v.orderName, email: v.email })
          .then(function (data) {
            if (!data) return;
            if (data.kind !== 'return_items') { bot(data.text || 'Sorry, something went wrong.'); showSuggestions(); return; }
            bot(data.text);
            showReturnItems(data, v.orderName, v.email);
          });
      }
    });
  }

  /**
   * Shrink a photo in the browser before it is uploaded. Phone cameras produce
   * several megabytes; the store only needs enough detail to see the damage,
   * and the server caps what it will accept anyway.
   */
  function compressImage(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('read failed')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('decode failed')); };
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
          else if (h >= w && h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  var MAX_PHOTOS = 2;

  /** Photo picker shown when the shopper says something arrived damaged. */
  function photoPicker(photos) {
    var wrap = el('div', 'sa-photos');
    var strip = el('div', 'sa-photo-strip');
    var input = el('input', 'sa-photo-input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    var addBtn = el('button', 'sa-photo-add', '📷 Add photo');
    addBtn.type = 'button';
    var hint = el('div', 'sa-photo-hint', 'Photos help the store see the damage. Up to ' + MAX_PHOTOS + '.');

    function redraw() {
      strip.innerHTML = '';
      photos.forEach(function (src, i) {
        var thumb = el('div', 'sa-photo-thumb');
        thumb.style.backgroundImage = 'url(' + src + ')';
        var rm = el('button', 'sa-photo-rm', '×');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Remove photo');
        rm.addEventListener('click', function () { photos.splice(i, 1); redraw(); });
        thumb.appendChild(rm);
        strip.appendChild(thumb);
      });
      addBtn.style.display = photos.length >= MAX_PHOTOS ? 'none' : '';
    }

    addBtn.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || [], 0, MAX_PHOTOS - photos.length);
      addBtn.disabled = true;
      Promise.all(files.map(function (f) { return compressImage(f, 900, 0.65).catch(function () { return null; }); }))
        .then(function (results) {
          results.forEach(function (src) { if (src) photos.push(src); });
          addBtn.disabled = false;
          input.value = '';
          redraw();
        });
    });

    wrap.appendChild(strip);
    wrap.appendChild(addBtn);
    wrap.appendChild(hint);
    wrap.appendChild(input);
    redraw();
    return wrap;
  }

  function showReturnItems(data, orderName, email) {
    panel.classList.add('sa-forming');
    var card = el('form', 'sa-formcard');

    var head = el('div', 'sa-fc-head');
    head.appendChild(el('div', 'sa-fc-icon', '↩️'));
    var htext = el('div', 'sa-fc-htext');
    htext.appendChild(el('div', 'sa-fc-title', 'Choose items'));
    htext.appendChild(el('div', 'sa-fc-sub', 'Select what you want to return from ' + data.orderName + '.'));
    head.appendChild(htext);
    card.appendChild(head);

    var list = el('div', 'sa-ret-items');
    data.items.forEach(function (it) {
      var row = el('label', 'sa-ret-item');
      var cb = el('input', 'sa-ret-check');
      cb.type = 'checkbox';
      cb.value = it.lineItemId;
      row.appendChild(cb);

      if (it.image) {
        var img = el('span', 'sa-ret-img');
        img.style.backgroundImage = 'url(' + it.image + ')';
        row.appendChild(img);
      }

      var info = el('span', 'sa-ret-info');
      info.appendChild(el('span', 'sa-ret-title', it.title));
      if (it.variantTitle) info.appendChild(el('span', 'sa-ret-variant', it.variantTitle));
      row.appendChild(info);

      // Only offer a quantity picker where there is a choice to make.
      if (it.quantity > 1) {
        var qty = el('select', 'sa-ret-qty');
        for (var n = 1; n <= it.quantity; n++) {
          var opt = el('option', '', String(n));
          opt.value = String(n);
          qty.appendChild(opt);
        }
        qty.setAttribute('data-for', it.lineItemId);
        row.appendChild(qty);
      }

      list.appendChild(row);
    });
    card.appendChild(list);

    var reason = el('select', 'sa-fc-input');
    var ph = el('option', '', 'Why are you returning this?');
    ph.value = '';
    reason.appendChild(ph);
    (data.reasons || []).forEach(function (r) {
      var o = el('option', '', r);
      o.value = r;
      reason.appendChild(o);
    });
    card.appendChild(reason);

    // Photos only make sense for damage, so the picker appears with that reason
    // rather than asking every shopper for one.
    var photos = [];
    if (PHOTOS_ENABLED) {
      var picker = photoPicker(photos);
      picker.style.display = 'none';
      card.appendChild(picker);
      reason.addEventListener('change', function () {
        var wantsPhotos = /damag|defect|wrong item/i.test(reason.value);
        picker.style.display = wantsPhotos ? '' : 'none';
        if (!wantsPhotos) photos.length = 0;
      });
    }

    var note = el('input', 'sa-fc-input');
    note.type = 'text';
    note.placeholder = 'Anything else we should know? (optional)';
    card.appendChild(note);

    var err = el('div', 'sa-fc-err');
    err.style.display = 'none';
    card.appendChild(err);

    var actions = el('div', 'sa-fc-actions');
    var cancel = el('button', 'sa-fc-cancel', 'Cancel');
    cancel.type = 'button';
    var submit = el('button', 'sa-fc-submit', 'Request return');
    submit.type = 'submit';
    submit.style.background = ACCENT;
    submit.style.color = TEXTCOLOR;
    actions.appendChild(cancel);
    actions.appendChild(submit);
    card.appendChild(actions);

    function done() { panel.classList.remove('sa-forming'); card.remove(); }
    cancel.addEventListener('click', function () { done(); showSuggestions(); });

    card.addEventListener('submit', function (e) {
      e.preventDefault();
      var chosen = [];
      card.querySelectorAll('.sa-ret-check').forEach(function (cb) {
        if (!cb.checked) return;
        var sel = card.querySelector('.sa-ret-qty[data-for="' + cb.value + '"]');
        chosen.push({ lineItemId: cb.value, quantity: sel ? Number(sel.value) : 1 });
      });
      if (!chosen.length) { err.textContent = 'Choose at least one item.'; err.style.display = ''; return; }
      if (!reason.value) { err.textContent = 'Choose a reason for the return.'; err.style.display = ''; return; }

      done();
      user('Return ' + chosen.length + ' item' + (chosen.length > 1 ? 's' : ''));
      postReturn({
        action: 'submit',
        orderName: orderName,
        email: email,
        items: chosen,
        reason: reason.value,
        note: note.value,
        photos: photos,
      }).then(function (res) {
        if (!res) return;
        bot(res.text || 'Your request has been sent.');
        showSuggestions();
      });
    });

    var sug = body.querySelector('.sa-suggests');
    if (sug) sug.remove();
    body.appendChild(card);
    body.scrollTop = body.scrollHeight;
  }

  /* ---- Cancel and buy-again ----------------------------------------------
   * Both start from the same order lookup. Cancelling is recorded for the
   * merchant; buying again needs nothing from them and goes straight to a cart.
   */
  var ACTION_URL = PROXY.replace(/\/query$/, '/order-action');

  function postAction(payload) {
    var typing = bot('', true);
    return fetch(ACTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { typing.remove(); return data; })
      .catch(function () {
        typing.remove();
        bot('Sorry, I could not reach the store right now. Please try again.');
        return null;
      });
  }

  function orderLookupCard(opts) {
    formCard({
      icon: opts.icon,
      title: opts.title,
      subtitle: opts.subtitle,
      cta: opts.cta,
      fields: [
        { name: 'orderName', placeholder: 'Order number' },
        { name: 'email', type: 'email', placeholder: 'Email used at checkout', value: lastEmail }
      ],
      onSubmit: function (v) {
        lastEmail = v.email;
        user(opts.userLine(v.orderName));
        opts.onFound(v);
      }
    });
  }

  function showCancelStart() {
    bot('I can ask the store to cancel an order. Which one?');
    orderLookupCard({
      icon: '🚫',
      title: 'Cancel an order',
      subtitle: 'Find your order first.',
      cta: 'Find order',
      userLine: function (n) { return 'Cancel order ' + n; },
      onFound: function (v) {
        postAction({ action: 'cancel_lookup', orderName: v.orderName, email: v.email })
          .then(function (data) {
            if (!data) return;
            if (data.kind !== 'cancel_confirm') { bot(data.text || 'Sorry, something went wrong.'); showSuggestions(); return; }
            bot(data.text);
            showCancelReason(data, v.orderName, v.email);
          });
      }
    });
  }

  function showCancelReason(data, orderName, email) {
    panel.classList.add('sa-forming');
    var card = el('form', 'sa-formcard');

    var head = el('div', 'sa-fc-head');
    head.appendChild(el('div', 'sa-fc-icon', '🚫'));
    var htext = el('div', 'sa-fc-htext');
    htext.appendChild(el('div', 'sa-fc-title', 'Cancel ' + data.orderName));
    htext.appendChild(el('div', 'sa-fc-sub', 'The store will confirm by email.'));
    head.appendChild(htext);
    card.appendChild(head);

    var reason = el('select', 'sa-fc-input');
    var ph = el('option', '', 'Why are you cancelling?');
    ph.value = '';
    reason.appendChild(ph);
    (data.reasons || []).forEach(function (r) {
      var o = el('option', '', r);
      o.value = r;
      reason.appendChild(o);
    });
    card.appendChild(reason);

    var note = el('input', 'sa-fc-input');
    note.type = 'text';
    note.placeholder = 'Anything else we should know? (optional)';
    card.appendChild(note);

    var err = el('div', 'sa-fc-err');
    err.style.display = 'none';
    card.appendChild(err);

    var actions = el('div', 'sa-fc-actions');
    var cancelBtn = el('button', 'sa-fc-cancel', 'Never mind');
    cancelBtn.type = 'button';
    var submit = el('button', 'sa-fc-submit', 'Request cancellation');
    submit.type = 'submit';
    submit.style.background = ACCENT;
    submit.style.color = TEXTCOLOR;
    actions.appendChild(cancelBtn);
    actions.appendChild(submit);
    card.appendChild(actions);

    function done() { panel.classList.remove('sa-forming'); card.remove(); }
    cancelBtn.addEventListener('click', function () { done(); showSuggestions(); });

    card.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!reason.value) { err.textContent = 'Choose a reason.'; err.style.display = ''; return; }
      done();
      user(reason.value);
      postAction({
        action: 'cancel_submit',
        orderName: orderName,
        email: email,
        reason: reason.value,
        note: note.value,
      }).then(function (res) {
        if (!res) return;
        bot(res.text || 'Your request has been sent.');
        showSuggestions();
      });
    });

    var sug = body.querySelector('.sa-suggests');
    if (sug) sug.remove();
    body.appendChild(card);
    body.scrollTop = body.scrollHeight;
  }

  function showReorderStart() {
    bot('I can put a past order back in your cart. Which one?');
    orderLookupCard({
      icon: '🛒',
      title: 'Buy again',
      subtitle: 'Find the order you want to repeat.',
      cta: 'Find order',
      userLine: function (n) { return 'Buy order ' + n + ' again'; },
      onFound: function (v) {
        postAction({ action: 'reorder', orderName: v.orderName, email: v.email })
          .then(function (data) {
            if (!data) return;
            bot(data.text || 'Sorry, something went wrong.');
            if (data.kind === 'reorder' && data.cartUrl) {
              var go = el('button', 'sa-cart-btn', '🛒 Go to cart');
              go.style.background = ACCENT;
              go.style.color = TEXTCOLOR;
              go.addEventListener('click', function () { window.top.location.href = data.cartUrl; });
              body.appendChild(go);
            }
            showSuggestions();
          });
      }
    });
  }

  function showOrderChoice() {
    bot('How would you like to track your order?');
    var wrap = el('div', 'sa-suggests');
    var b1 = el('button', 'sa-suggest', '🔢 I have my order number');
    var b2 = el('button', 'sa-suggest', '📧 Find my orders by email');
    b1.addEventListener('click', function () { wrap.remove(); showOrderNumberForm(); });
    b2.addEventListener('click', function () { wrap.remove(); showEmailForm(); });
    wrap.appendChild(b1); wrap.appendChild(b2);
    body.appendChild(wrap); body.scrollTop = body.scrollHeight;
  }

  function renderOrderList(orders) {
    var wrap = el('div', 'sa-products');
    orders.forEach(function (o) {
      var card = el('button', 'sa-order-item');
      card.innerHTML = '<div class="sa-oi-left"><div class="sa-oi-name">' + escapeHtml(o.name) + '</div>' +
        '<div class="sa-oi-date">' + fmtDate(o.createdAt) + '</div></div>' +
        '<div class="sa-oi-status">' + escapeHtml((o.fulfillmentStatus || '').toLowerCase()) + ' ›</div>';
      card.addEventListener('click', function () {
        user('Check ' + o.name);
        post({ intent: 'order', orderName: o.name, email: lastEmail });
      });
      wrap.appendChild(card);
    });
    body.appendChild(wrap); body.scrollTop = body.scrollHeight;
  }

  function renderTimeline(steps, trackingUrl) {
    var card = el('div', 'sa-timeline');
    var row = el('div', 'sa-tl-row');
    steps.forEach(function (s, i) {
      var col = el('div', 'sa-tl-step' + (s.done ? ' sa-tl-done' : '') + (s.current ? ' sa-tl-current' : ''));
      var dot = el('div', 'sa-tl-dot', s.done ? '✓' : '');
      var lbl = el('div', 'sa-tl-label', s.label);
      var dt = el('div', 'sa-tl-date', s.date ? fmtDate(s.date) : '');
      if (i > 0) col.appendChild(el('div', 'sa-tl-line' + (s.done ? ' sa-tl-line-done' : '')));
      col.appendChild(dot); col.appendChild(lbl); col.appendChild(dt);
      row.appendChild(col);
    });
    card.appendChild(row);
    if (trackingUrl) {
      var link = el('a', 'sa-tl-track', 'Track package →');
      link.href = trackingUrl; link.target = '_blank'; link.rel = 'noopener';
      card.appendChild(link);
    }
    body.appendChild(card); body.scrollTop = body.scrollHeight;
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  function renderProducts(products) {
    var wrap = el('div', 'sa-products');
    products.forEach(function (p) {
      var card = el('a', 'sa-card'); card.href = p.url; card.target = '_top';
      var imgHtml = p.image
        ? '<div class="sa-card-img" style="background-image:url(' + p.image + ')"></div>'
        : '<div class="sa-card-img sa-card-noimg">' + escapeHtml((p.title || '?').charAt(0).toUpperCase()) + '</div>';
      card.innerHTML = imgHtml +
        '<div class="sa-card-info"><div class="sa-card-title">' + escapeHtml(p.title) + '</div>' +
        '<div class="sa-card-price">' + escapeHtml(p.price || '') + '</div></div>';
      wrap.appendChild(card);
    });
    body.appendChild(wrap); body.scrollTop = body.scrollHeight;
  }

  function offerWhatsApp(question) {
    var btn = el('button', 'sa-wa-btn', '💬 Continue on WhatsApp');
    btn.addEventListener('click', function () { openWhatsApp(question); });
    body.appendChild(btn); body.scrollTop = body.scrollHeight;
  }
  function openWhatsApp(text) {
    var url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text);
    var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function fmtTime() {
    try {
      return new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  /**
   * Wrap a bubble in a row so a caption can sit under it. Typing indicators get
   * no caption — they are replaced by the real message a moment later.
   */
  function addMessage(cls, text, caption, isTyping) {
    clearWelcome();
    var row = el('div', 'sa-row ' + cls);
    var m = el('div', 'sa-msg ' + cls + (isTyping ? ' sa-typing' : ''), isTyping ? '' : text);
    if (isTyping) m.innerHTML = '<span></span><span></span><span></span>';
    row.appendChild(m);
    if (caption) row.appendChild(el('div', 'sa-meta', caption + ' · ' + fmtTime()));
    if (!isTyping) record(cls === 'sa-user' ? 'user' : 'bot', text);
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
    // Callers remove the typing indicator, so hand back the row for both cases.
    return row;
  }

  function bot(text, typing) {
    return addMessage('sa-bot', text, typing ? '' : 'Automated', !!typing);
  }
  function user(text) { return addMessage('sa-user', text, 'Sent', false); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null && text !== '') e.textContent = text; return e; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
})();
