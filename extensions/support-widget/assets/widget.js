(function () {
  var root = document.getElementById('support-assistant-root');
  if (!root) return;

  var PROXY = root.dataset.proxyUrl || '/apps/support/query';
  var ACCENT = root.dataset.accent || '#1a1a1a';
  var GREETING = root.dataset.greeting || 'Hi! Ask about your order or our policies.';
  var WHATSAPP = (root.dataset.whatsapp || '').replace(/[^0-9]/g, '');

  var launcher = el('button', 'sa-launcher');
  launcher.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  launcher.style.background = ACCENT;

  var panel = el('div', 'sa-panel');
  panel.innerHTML =
    '<div class="sa-header" style="background:' + ACCENT + '">' +
      '<span>Support</span>' +
      '<button class="sa-close" aria-label="Close">×</button>' +
    '</div>' +
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
      '<button type="submit" style="background:' + ACCENT + '">Check status</button>' +
    '</form>' +
    '<div class="sa-inputbar">' +
      '<input type="text" placeholder="Type your message…">' +
      '<button class="sa-send" style="background:' + ACCENT + '" aria-label="Send">→</button>' +
    '</div>';

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  var body = panel.querySelector('.sa-body');
  var textInput = panel.querySelector('.sa-inputbar input');
  var sendBtn = panel.querySelector('.sa-send');
  var orderForm = panel.querySelector('.sa-order-form');
  var mode = 'faq'; // faq | product

  bot(GREETING);

  launcher.addEventListener('click', function () { panel.classList.add('sa-open'); });
  panel.querySelector('.sa-close').addEventListener('click', function () { panel.classList.remove('sa-open'); });

  panel.querySelectorAll('.sa-quick button').forEach(function (b) {
    b.addEventListener('click', function () {
      var q = b.dataset.q;
      if (q === 'order') {
        orderForm.classList.add('sa-show');
        bot('Enter your order number and email, and I’ll check the status.');
      } else if (q === 'wa') {
        openWhatsApp('Hi, I need help.');
      } else if (q === 'product') {
        mode = 'product';
        orderForm.classList.remove('sa-show');
        textInput.placeholder = 'What are you looking for?';
        bot('What are you looking for? e.g. "black running shoes" or "gift for my mom".');
        textInput.focus();
      } else {
        mode = 'faq';
        orderForm.classList.remove('sa-show');
        textInput.placeholder = 'Type your question…';
        textInput.focus();
      }
    });
  });

  sendBtn.addEventListener('click', sendText);
  textInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendText(); });

  orderForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = orderForm.orderName.value.trim();
    var email = orderForm.email.value.trim();
    if (!name || !email) return;
    user('Track order ' + name);
    orderForm.classList.remove('sa-show');
    post({ intent: 'order', orderName: name, email: email });
  });

  function sendText() {
    var v = textInput.value.trim();
    if (!v) return;
    user(v);
    textInput.value = '';
    post({ intent: mode, message: v });
  }

  function post(payload) {
    var typing = bot('', true);
    fetch(PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        typing.remove();
        bot(data.text || 'Sorry, something went wrong.');
        if (data.kind === 'recommend' && data.products && data.products.length) {
          renderProducts(data.products);
        }
        if (WHATSAPP && (data.kind === 'unresolved' || data.kind === 'limit' || data.kind === 'recommend_locked')) {
          offerWhatsApp(payload.message || 'my question');
        }
      })
      .catch(function () {
        typing.remove();
        bot('Sorry, I could not reach support right now.');
        if (WHATSAPP) offerWhatsApp(payload.message || 'my question');
      });
  }

  function renderProducts(products) {
    var wrap = el('div', 'sa-products');
    products.forEach(function (p) {
      var card = el('a', 'sa-card');
      card.href = p.url; card.target = '_top';
      card.innerHTML =
        (p.image ? '<div class="sa-card-img" style="background-image:url(' + p.image + ')"></div>' : '<div class="sa-card-img"></div>') +
        '<div class="sa-card-info"><div class="sa-card-title">' + escapeHtml(p.title) + '</div>' +
        '<div class="sa-card-price">' + escapeHtml(p.price || '') + '</div></div>';
      wrap.appendChild(card);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  function offerWhatsApp(question) {
    var btn = el('button', 'sa-wa-btn', '💬 Continue on WhatsApp');
    btn.addEventListener('click', function () { openWhatsApp(question); });
    body.appendChild(btn);
    body.scrollTop = body.scrollHeight;
  }

  function openWhatsApp(text) {
    var url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text);
    var a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function bot(text, typing) {
    var m = el('div', 'sa-msg sa-bot' + (typing ? ' sa-typing' : ''), typing ? '' : text);
    if (typing) m.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(m); body.scrollTop = body.scrollHeight; return m;
  }
  function user(text) {
    var m = el('div', 'sa-msg sa-user', text);
    body.appendChild(m); body.scrollTop = body.scrollHeight; return m;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null && text !== '') e.textContent = text;
    return e;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
