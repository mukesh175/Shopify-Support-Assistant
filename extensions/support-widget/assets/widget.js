(function () {
  var root = document.getElementById('support-assistant-root');
  if (!root) return;

  var PROXY = root.dataset.proxyUrl || '/apps/support/query';
  var ACCENT = root.dataset.accent || '#1a1a1a';
  var GREETING = root.dataset.greeting || 'Hi! Ask about your order or our policies.';
  var WHATSAPP = (root.dataset.whatsapp || '').replace(/[^0-9]/g, '');

  var launcher = el('button', 'sa-launcher', '💬');
  launcher.style.background = ACCENT;

  var panel = el('div', 'sa-panel');
  panel.innerHTML =
    '<div class="sa-header" style="background:' + ACCENT + '">Support</div>' +
    '<div class="sa-body"></div>' +
    '<div class="sa-quick">' +
    '<button data-q="faq">Ask a question</button>' +
    '<button data-q="order">Track my order</button>' +
    (WHATSAPP ? '<button data-q="wa">WhatsApp us</button>' : '') +
    '</div>' +
    '<form class="sa-order-form">' +
    '<input name="orderName" placeholder="Order number e.g. #1001" required>' +
    '<input name="email" type="email" placeholder="Email used at checkout" required>' +
    '<button type="submit" style="background:' + ACCENT + ';color:#fff;border:none;padding:9px;border-radius:10px;cursor:pointer;font-weight:600">Check status</button>' +
    '</form>' +
    '<div class="sa-inputbar">' +
    '<input type="text" placeholder="Type your question…">' +
    '<button style="background:' + ACCENT + '">Send</button>' +
    '</div>';

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  var body = panel.querySelector('.sa-body');
  var textInput = panel.querySelector('.sa-inputbar input');
  var sendBtn = panel.querySelector('.sa-inputbar button');
  var orderForm = panel.querySelector('.sa-order-form');

  bot(GREETING);

  launcher.addEventListener('click', function () {
    panel.classList.toggle('sa-open');
  });

  panel.querySelectorAll('.sa-quick button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.q === 'order') {
        orderForm.classList.add('sa-show');
        bot('Enter your order number and email, and I’ll check the status.');
      } else if (b.dataset.q === 'wa') {
        openWhatsApp('Hi, I need help with my order.');
      } else {
        orderForm.classList.remove('sa-show');
        textInput.focus();
      }
    });
  });

  sendBtn.addEventListener('click', sendText);
  textInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendText();
  });

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
    post({ intent: 'faq', message: v });
  }

  function post(payload) {
    var typing = bot('…');
    fetch(PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        typing.textContent = data.text || 'Sorry, something went wrong.';
        // If AI couldn't resolve (or hit a limit), offer WhatsApp handoff.
        if (WHATSAPP && (data.kind === 'unresolved' || data.kind === 'limit')) {
          offerWhatsApp(payload.message || 'my question');
        }
      })
      .catch(function () {
        typing.textContent = 'Sorry, I could not reach support right now.';
        if (WHATSAPP) offerWhatsApp(payload.message || 'my question');
      });
  }

  function offerWhatsApp(question) {
    var btn = el('button', 'sa-wa-btn', '💬 Continue on WhatsApp');
    btn.addEventListener('click', function () { openWhatsApp(question); });
    body.appendChild(btn);
    body.scrollTop = body.scrollHeight;
  }

  function openWhatsApp(text) {
    var url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text);
    window.open(url, '_blank');
  }

  function bot(text) {
    var m = el('div', 'sa-msg sa-bot', text);
    body.appendChild(m); body.scrollTop = body.scrollHeight; return m;
  }
  function user(text) {
    var m = el('div', 'sa-msg sa-user', text);
    body.appendChild(m); body.scrollTop = body.scrollHeight; return m;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
})();
