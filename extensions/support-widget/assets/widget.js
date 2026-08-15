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
        '<button class="sa-expand" aria-label="Expand">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>' +
        '<button class="sa-close" aria-label="Close">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
          '<path d="M5 12h14"/></svg></button>' +
      '</div>' +
    '</div>' +
    '<div class="sa-body"></div>' +
    '<div class="sa-quick">' +
      '<button data-q="faq">Ask a question</button>' +
      '<button data-q="product">Find a product</button>' +
      '<button data-q="order">Track my order</button>' +
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
        if (cfg && cfg.suggestions && cfg.suggestions.length) SUGGESTIONS = cfg.suggestions;
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
  var mode = 'faq';
  var greeted = false;
  var lastEmail = '';

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

  function showSuggestions() {
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
  panel.querySelector('.sa-expand').addEventListener('click', function () {
    panel.classList.toggle('sa-expanded');
    body.scrollTop = body.scrollHeight;
  });

  panel.querySelectorAll('.sa-quick button').forEach(function (b) {
    b.addEventListener('click', function () {
      var q = b.dataset.q;
      if (q === 'order') { showOrderChoice(); }
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

    cancel.addEventListener('click', function () { card.remove(); });
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
      card.remove();
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
      })
      .catch(function () {
        typing.remove(); bot('Sorry, I could not reach support right now.');
        if (waReady()) offerWhatsApp(payload.message || 'my question');
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
