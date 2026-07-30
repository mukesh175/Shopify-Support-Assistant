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
  var WHATSAPP = (root.dataset.whatsapp || '').replace(/[^0-9]/g, '');
  var SUGGESTIONS = [];

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
    '<div class="sa-header" style="background:' + ACCENT + ';color:' + TEXTCOLOR + '">' +
      '<span>Support</span><button class="sa-close" aria-label="Close" style="color:' + TEXTCOLOR + '">×</button></div>' +
    '<div class="sa-body"></div>' +
    '<div class="sa-quick">' +
      '<button data-q="faq">💬 Ask a question</button>' +
      '<button data-q="product">🛍️ Find a product</button>' +
      '<button data-q="order">📦 Track my order</button>' +
      (WHATSAPP ? '<button data-q="wa" class="sa-wa-quick">WhatsApp us</button>' : '') +
    '</div>' +
    '<form class="sa-order-form">' +
      '<input name="orderName" placeholder="Order number e.g. #1001" required>' +
      '<input name="email" type="email" placeholder="Email used at checkout" required>' +
      '<button type="submit" style="background:' + ACCENT + ';color:' + TEXTCOLOR + '">Check status</button></form>' +
    '<div class="sa-inputbar">' +
      '<input type="text" placeholder="Type your message…">' +
      '<button class="sa-send" style="background:' + ACCENT + ';color:' + TEXTCOLOR + '" aria-label="Send">→</button></div>';

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
      })
      .catch(function () {});
  })();

  var body = panel.querySelector('.sa-body');
  var textInput = panel.querySelector('.sa-inputbar input');
  var sendBtn = panel.querySelector('.sa-send');
  var orderForm = panel.querySelector('.sa-order-form');
  var mode = 'faq';
  var greeted = false;

  function open() {
    panel.classList.add('sa-open');
    if (pop) { pop.remove(); pop = null; }
    if (!greeted) {
      bot(GREETING);
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

  panel.querySelectorAll('.sa-quick button').forEach(function (b) {
    b.addEventListener('click', function () {
      var q = b.dataset.q;
      if (q === 'order') { orderForm.classList.add('sa-show'); bot('Enter your order number and email, and I’ll check the status.'); }
      else if (q === 'wa') { openWhatsApp('Hi, I need help.'); }
      else if (q === 'product') { mode = 'product'; orderForm.classList.remove('sa-show'); textInput.placeholder = 'What are you looking for?'; bot('What are you looking for? e.g. "black snowboard" or "gift under $500".'); textInput.focus(); }
      else { mode = 'faq'; orderForm.classList.remove('sa-show'); textInput.placeholder = 'Type your question…'; textInput.focus(); }
    });
  });

  sendBtn.addEventListener('click', sendText);
  textInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendText(); });

  orderForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = orderForm.orderName.value.trim(), email = orderForm.email.value.trim();
    if (!name || !email) return;
    user('Track order ' + name); orderForm.classList.remove('sa-show');
    post({ intent: 'order', orderName: name, email: email });
  });

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
        if (data.kind === 'recommend' && data.products && data.products.length) renderProducts(data.products);
        if (WHATSAPP && (data.kind === 'unresolved' || data.kind === 'limit' || data.kind === 'recommend_locked')) offerWhatsApp(payload.message || 'my question');
      })
      .catch(function () {
        typing.remove(); bot('Sorry, I could not reach support right now.');
        if (WHATSAPP) offerWhatsApp(payload.message || 'my question');
      });
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

  function bot(text, typing) {
    var m = el('div', 'sa-msg sa-bot' + (typing ? ' sa-typing' : ''), typing ? '' : text);
    if (typing) m.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(m); body.scrollTop = body.scrollHeight; return m;
  }
  function user(text) { var m = el('div', 'sa-msg sa-user', text); body.appendChild(m); body.scrollTop = body.scrollHeight; return m; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null && text !== '') e.textContent = text; return e; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
})();
