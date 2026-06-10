/* ===========================================================
   APP.JS — Flux · Finanzas Personales
   =========================================================== */

(function () {
  'use strict';

  /* -----------------------------------------------------------
     1. ESTADO + PERSISTENCIA
     ----------------------------------------------------------- */
  const KEYS = {
    balance:   'fx_balance',
    expenses:  'fx_expenses',
    incomes:   'fx_incomes',
    onboarded: 'fx_onboarded',
  };

  /* Consejos financieros que rotan en la pantalla de inicio */
  const TIPS = [
    'Apunta cada gasto el mismo día. Lo que no se mide, no se controla.',
    'Antes de una compra grande, espera 24h. Muchas veces el impulso desaparece.',
    'Intenta ahorrar al menos el 10% de cada ingreso que entre.',
    'Revisa tus suscripciones: las pequeñas cuotas mensuales suman mucho al año.',
    'Llevar el dinero en efectivo te hace gastar menos que con tarjeta.',
    'Fija un límite de gasto diario y respétalo. Tu yo del futuro lo agradecerá.',
    'Los cafés y caprichos diarios parecen poco, pero son cientos de euros al año.',
    'Ahorrar no es gastar menos en todo, es gastar mejor en lo que importa.',
    'Si gastas menos de lo que ingresas, ya vas por buen camino. 💪',
    'Pon nombre a tus ahorros: un objetivo concreto motiva más que ahorrar "por ahorrar".',
    'Compara precios antes de comprar online. Dos minutos pueden ahorrarte mucho.',
    'Cada ingreso extra (Bizum, devolución…) es para ahorrar, no para gastar más.',
  ];

  /* Categorías cerradas (con emoji) */
  const CATEGORIES = [
    { key: 'comida',       emoji: '🍔', label: 'Comida' },
    { key: 'ocio',         emoji: '🍿', label: 'Ocio' },
    { key: 'supermercado', emoji: '🛒', label: 'Supermercado' },
    { key: 'transporte',   emoji: '🚗', label: 'Transporte' },
    { key: 'otros',        emoji: '📦', label: 'Otros' },
  ];
  const catByKey = (k) => CATEGORIES.find((c) => c.key === k) || CATEGORIES[4];

  // Resuelve un gasto (compatibilidad con datos antiguos de texto libre)
  function resolveExpense(e) {
    const known = CATEGORIES.find((c) => c.key === e.category);
    if (known) return { cat: known, concept: e.concept || '' };
    // Dato antiguo: 'category' era texto libre y no había concepto
    return { cat: CATEGORIES[4], concept: e.concept || e.category || '' };
  }

  const state = {
    balance:  0,
    expenses: [],
    incomes:  [],
    mode:     'expense', // 'expense' | 'income'
    category: 'comida',  // categoría seleccionada para el nuevo gasto
  };

  let keypadInput = ''; // cadena construida por el teclado numérico

  function loadState() {
    const raw = localStorage.getItem(KEYS.balance);
    state.balance = raw !== null ? parseFloat(raw) : 0;
    try { state.expenses = JSON.parse(localStorage.getItem(KEYS.expenses) || '[]'); } catch { state.expenses = []; }
    try { state.incomes  = JSON.parse(localStorage.getItem(KEYS.incomes)  || '[]'); } catch { state.incomes  = []; }
  }

  function saveBalance()  { localStorage.setItem(KEYS.balance,  String(state.balance)); }
  function saveExpenses() { localStorage.setItem(KEYS.expenses, JSON.stringify(state.expenses)); }
  function saveIncomes()  { localStorage.setItem(KEYS.incomes,  JSON.stringify(state.incomes)); }

  /* -----------------------------------------------------------
     2. UTILIDADES
     ----------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);

  function formatMoney(v) {
    return '€' + (Number(v) || 0).toFixed(2);
  }

  function getTotalSpent() {
    return state.expenses.reduce((a, e) => a + e.amount, 0);
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  /* Color de fondo del icono según categoría */
  const CAT_BG = {
    comida:       '#FFF3E8',
    ocio:         '#F3EEFF',
    supermercado: '#E8FFF1',
    transporte:   '#E8F4FF',
    otros:        '#F5F0FF',
  };
  function catBg(key) { return 'background:' + (CAT_BG[key] || '#F5F0FF'); }

  function getIncomStyle(concept) {
    const n = (concept || '').toLowerCase();
    if (/nómin|nomina|sueldo|salario/.test(n))       return { emoji: '💼', bg: 'background:#E8FFF1' };
    if (/bizum|transfe|ingreso/.test(n))              return { emoji: '📲', bg: 'background:#E8FFF1' };
    if (/regalo|propina/.test(n))                    return { emoji: '🎁', bg: 'background:#E8FFF1' };
    if (/venta|vendido/.test(n))                     return { emoji: '🛒', bg: 'background:#E8FFF1' };
    if (/devoluci|reembolso/.test(n))                return { emoji: '↩️', bg: 'background:#E8FFF1' };
    return { emoji: '💰', bg: 'background:#E8FFF1' };
  }

  /* -----------------------------------------------------------
     3. TECLADO NUMÉRICO
     ----------------------------------------------------------- */
  function handleKeypadPress(key) {
    if (key === '⌫') {
      keypadInput = keypadInput.slice(0, -1);
    } else if (key === '.') {
      if (keypadInput.includes('.')) return;
      keypadInput = keypadInput === '' ? '0.' : keypadInput + '.';
    } else {
      if (keypadInput.length >= 9) return;
      // evitar ceros iniciales dobles
      if (keypadInput === '0') { keypadInput = key; }
      else { keypadInput += key; }
    }
    updateDisplay();
  }

  function updateDisplay() {
    const el  = $('keypad-display-value');
    const sym = el.previousElementSibling; // .amount-display-sym

    if (!keypadInput) {
      el.textContent = '0';
      el.classList.add('is-placeholder');
    } else {
      el.textContent = keypadInput;
      el.classList.remove('is-placeholder');
    }

    if (state.mode === 'income') {
      el.classList.add('income-mode');
      sym.classList.add('income-mode');
    } else {
      el.classList.remove('income-mode');
      sym.classList.remove('income-mode');
    }
  }

  /* -----------------------------------------------------------
     4. MODO (Gasto / Ingreso)
     ----------------------------------------------------------- */
  function setMode(mode) {
    state.mode = mode;
    const btnE     = $('btn-mode-expense');
    const btnI     = $('btn-mode-income');
    const catSel   = $('btn-category');
    const concept  = $('input-concept');
    const btn      = $('btn-register');
    const txt      = $('btn-register-text');

    if (mode === 'income') {
      btnE.classList.remove('seg-active');
      btnI.classList.add('seg-active', 'income-seg');
      catSel.classList.add('hidden');           // sin categoría en ingresos
      concept.placeholder = 'Concepto: Nómina, Bizum, Regalo…';
      btn.classList.add('income-cta');
      txt.textContent     = 'Añadir ingreso';
    } else {
      btnI.classList.remove('seg-active', 'income-seg');
      btnE.classList.add('seg-active');
      catSel.classList.remove('hidden');
      concept.placeholder = 'Concepto (ej. Burger King)';
      btn.classList.remove('income-cta');
      txt.textContent     = 'Añadir gasto';
    }
    updateDisplay();
  }

  /* -----------------------------------------------------------
     4b. SELECTOR DE CATEGORÍA (bottom sheet)
     ----------------------------------------------------------- */
  function renderCategoryButton() {
    const c = catByKey(state.category);
    $('category-emoji').textContent = c.emoji;
    $('category-name').textContent  = c.label;
  }

  function openCategorySheet() {
    const list = $('cat-sheet-list');
    list.innerHTML = CATEGORIES.map((c) => `
      <li class="cat-opt ${c.key === state.category ? 'is-selected' : ''}" data-key="${c.key}">
        <span class="cat-opt-emoji">${c.emoji}</span>
        <span class="cat-opt-label">${c.label}</span>
        <svg class="cat-opt-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
        </svg>
      </li>`).join('');
    $('category-sheet').classList.remove('hidden');
  }

  function closeCategorySheet() {
    $('category-sheet').classList.add('hidden');
  }

  function selectCategory(key) {
    state.category = key;
    renderCategoryButton();
    closeCategorySheet();
  }

  /* -----------------------------------------------------------
     5. RENDERIZADO
     ----------------------------------------------------------- */
  function renderBudgetBar() {
    const spent = getTotalSpent();
    const total = state.balance + spent;
    const pct   = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
    const bar   = $('budget-bar');
    const pctEl = $('budget-pct');

    if (bar) {
      bar.style.width = pct.toFixed(1) + '%';
      bar.style.background =
        pct > 80 ? 'linear-gradient(90deg,#C0392B,#FF3B30)' :
        pct > 50 ? 'linear-gradient(90deg,#E67E22,#FF9500)' :
                   'linear-gradient(90deg,#27AE60,#30D158)';
    }
    if (pctEl) pctEl.textContent = pct.toFixed(0) + '%';
  }

  /* Muestra el saldo adaptando el tamaño de fuente a los dígitos */
  function setBalanceDisplay(val) {
    const el = $('balance-display');
    if (!el) return;
    const str = val.toFixed(2);
    el.textContent = str;
    const digits = str.replace(/[^0-9]/g, '').length;
    el.style.fontSize = digits > 10 ? '24px'
                      : digits > 8  ? '30px'
                      : digits > 6  ? '36px'
                      : '';          // usa el CSS por defecto (42px)
  }

  function renderBalance() {
    setBalanceDisplay(state.balance);
    $('summary-balance').textContent = formatMoney(state.balance);
    $('summary-spent').textContent   = formatMoney(getTotalSpent());
    renderBudgetBar();
  }

  function renderMovements() {
    const list    = $('expense-list');
    const empty   = $('empty-state');
    const countEl = $('expense-count');
    list.innerHTML = '';

    const movements = [
      ...state.expenses.map(e => ({ ...e, _t: 'expense' })),
      ...state.incomes.map(i  => ({ ...i, _t: 'income'  })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const n = movements.length;
    if (countEl) countEl.textContent = `${n} movimiento${n !== 1 ? 's' : ''}`;

    if (n === 0) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    movements.forEach(mov => {
      const isIncome = mov._t === 'income';
      let emoji, bg, name, sub;
      if (isIncome) {
        const s = getIncomStyle(mov.concept || '');
        emoji = s.emoji; bg = s.bg;
        name = mov.concept || 'Ingreso';
        sub  = formatDate(mov.date);
      } else {
        const { cat, concept } = resolveExpense(mov);
        emoji = cat.emoji; bg = catBg(cat.key);
        name = concept ? concept : cat.label;
        sub  = (concept ? cat.label + ' · ' : '') + formatDate(mov.date);
      }

      const li = document.createElement('li');
      li.className = 'mov-cell';
      li.innerHTML = `
        <div class="mov-icon" style="${bg}">${emoji}</div>
        <div class="mov-info">
          <p class="mov-name">${escapeHtml(name)}</p>
          <p class="mov-date">${escapeHtml(sub)}</p>
        </div>
        <div class="mov-right">
          <span class="${isIncome ? 'mov-amount-pos' : 'mov-amount-neg'}">
            ${isIncome ? '+' : '−'}€${mov.amount.toFixed(2)}
          </span>
          <button
            class="mov-delete"
            data-id="${mov.id}"
            data-type="${mov._t}"
            aria-label="Eliminar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:16px;height:16px;pointer-events:none">
              <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  /* Agrupa una lista de gastos por categoría → [{cat,total,items[]}] desc */
  function groupByCategory(expenses) {
    const map = {};
    expenses.forEach((e) => {
      const { cat, concept } = resolveExpense(e);
      if (!map[cat.key]) map[cat.key] = { cat, total: 0, items: [] };
      map[cat.key].total += e.amount;
      map[cat.key].items.push({ concept: concept || cat.label, amount: e.amount, date: e.date });
    });
    return Object.values(map)
      .map((g) => { g.items.sort((a, b) => b.amount - a.amount); return g; })
      .sort((a, b) => b.total - a.total);
  }

  function renderCategoryStats() {
    const wrap = $('category-stats-wrap');
    const cont = $('category-stats');
    if (!wrap || !cont) return;

    const groups = groupByCategory(state.expenses);
    const spent  = getTotalSpent();

    if (groups.length === 0) {
      wrap.classList.add('hidden');
      cont.innerHTML = '';
      return;
    }
    wrap.classList.remove('hidden');

    cont.innerHTML = groups.map((g) => {
      const pct = spent > 0 ? (g.total / spent) * 100 : 0;
      const color = catBg(g.cat.key).replace('background:', '');
      const barColor =
        g.cat.key === 'comida'       ? '#FF9500' :
        g.cat.key === 'ocio'         ? '#5E5CE6' :
        g.cat.key === 'supermercado' ? '#30D158' :
        g.cat.key === 'transporte'   ? '#007AFF' : '#8E8E93';
      return `
        <div class="cat-stat-row">
          <div class="cat-stat-head">
            <span class="cat-stat-emoji">${g.cat.emoji}</span>
            <span class="cat-stat-label">${g.cat.label}</span>
            <span class="cat-stat-amt">€${g.total.toFixed(2)}</span>
          </div>
          <div class="cat-stat-track"><div class="cat-stat-bar" style="width:${pct.toFixed(1)}%;background:${barColor}"></div></div>
          <span class="cat-stat-pct">${pct.toFixed(0)}% del gasto · ${g.items.length} movimiento${g.items.length !== 1 ? 's' : ''}</span>
        </div>`;
    }).join('');
  }

  function renderAll() {
    renderBalance();
    renderMovements();
    renderCategoryStats();
    renderTip();
  }

  /* -----------------------------------------------------------
     5a-bis. ANIMACIÓN DEL SALDO (contador + pulse)
     ----------------------------------------------------------- */
  function animateBalance(from, to) {
    const disp = $('balance-display');
    const card = document.querySelector('.balance-card');
    if (!disp) return;

    if (card) {
      card.classList.remove('balance-pulse');
      void card.offsetWidth;
      card.classList.add('balance-pulse');
    }

    const duration = 600;
    const start = performance.now();
    const diff = to - from;

    function frame(now) {
      const t     = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setBalanceDisplay(from + diff * eased);
      if (t < 1) requestAnimationFrame(frame);
      else setBalanceDisplay(to);
    }
    requestAnimationFrame(frame);
  }

  /* -----------------------------------------------------------
     5b. CONSEJO FINANCIERO (Tip del día / contextual)
     ----------------------------------------------------------- */
  function renderTip() {
    const el = $('tip-text');
    if (!el) return;

    const spent = getTotalSpent();
    const total = state.balance + spent;
    const pct   = total > 0 ? (spent / total) * 100 : 0;

    // Consejos contextuales según la situación del usuario
    let tip;
    if (state.expenses.length === 0 && state.incomes.length === 0) {
      tip = '¡Bienvenido! Empieza registrando tu primer gasto o ingreso para ver tu progreso.';
    } else if (pct > 85) {
      tip = '⚠️ Has consumido más del 85% de tu presupuesto. Frena los gastos no esenciales.';
    } else if (pct > 60) {
      tip = 'Vas por más de la mitad del presupuesto. Buen momento para moderar el ritmo.';
    } else {
      // Tip rotativo según el día del año (estable durante el día)
      const dayIndex = Math.floor(Date.now() / 86400000) % TIPS.length;
      tip = TIPS[dayIndex];
    }
    el.textContent = tip;
  }

  /* -----------------------------------------------------------
     5c. ONBOARDING (Pantalla de bienvenida)
     ----------------------------------------------------------- */
  function maybeShowOnboarding() {
    const done = localStorage.getItem(KEYS.onboarded);
    if (!done) {
      $('onboarding').classList.remove('hidden');
      setTimeout(() => $('onboard-balance').focus(), 350);
    }
  }

  function finishOnboarding() {
    const value = parseFloat($('onboard-balance').value);
    state.balance = isNaN(value) || value < 0 ? 0 : value;
    saveBalance();
    localStorage.setItem(KEYS.onboarded, '1');
    $('onboarding').classList.add('hidden');
    renderAll();
    renderTip();
  }

  /* -----------------------------------------------------------
     5d. REINICIAR TODO
     ----------------------------------------------------------- */
  function openResetModal()  { $('reset-modal').classList.remove('hidden'); }
  function closeResetModal() { $('reset-modal').classList.add('hidden'); }

  function confirmReset() {
    state.balance  = 0;
    state.expenses = [];
    state.incomes  = [];
    keypadInput    = '';
    localStorage.removeItem(KEYS.balance);
    localStorage.removeItem(KEYS.expenses);
    localStorage.removeItem(KEYS.incomes);
    localStorage.removeItem(KEYS.onboarded);

    $('input-concept').value = '';
    state.category = 'comida';
    renderCategoryButton();
    setMode('expense');
    closeResetModal();
    renderAll();
    renderTip();
    showPage('page-home');
    // Vuelve a pedir el saldo inicial
    maybeShowOnboarding();
  }

  /* -----------------------------------------------------------
     6. ACCIONES
     ----------------------------------------------------------- */
  function handleRegister() {
    const amount  = parseFloat(keypadInput);
    const concept = $('input-concept').value.trim();
    const prevBalance = state.balance;

    if (!keypadInput || isNaN(amount) || amount <= 0) {
      showFeedback('Introduce una cantidad válida.', 'error');
      return;
    }

    if (state.mode === 'expense') {
      if (amount > state.balance) {
        showFeedback(`Saldo insuficiente. Tienes ${formatMoney(state.balance)}.`, 'error');
        return;
      }
      const cat = catByKey(state.category);
      state.expenses.push({
        id: Date.now(), amount,
        category: cat.key,
        concept: concept,
        date: new Date().toISOString(),
      });
      state.balance -= amount;
      saveExpenses();
      saveBalance();
      showFeedback(`✓ ${formatMoney(amount)} en ${cat.emoji} ${cat.label}${concept ? ' · ' + concept : ''}.`, 'ok');

    } else {
      state.incomes.push({ id: Date.now(), amount, concept: concept || 'Ingreso', date: new Date().toISOString() });
      state.balance += amount;
      saveIncomes();
      saveBalance();
      showFeedback(`✓ +${formatMoney(amount)} añadido a tu saldo.`, 'ok');
    }

    keypadInput = '';
    updateDisplay();
    $('input-concept').value = '';
    renderMovements();
    renderCategoryStats();
    renderTip();
    animateBalance(prevBalance, state.balance); // saldo animado + pulse
    $('summary-balance').textContent = formatMoney(state.balance);
    $('summary-spent').textContent   = formatMoney(getTotalSpent());
    renderBudgetBar();
  }

  function handleDeleteMovement(id, type) {
    const prevBalance = state.balance;
    if (type === 'income') {
      const item = state.incomes.find(i => i.id === id);
      if (!item) return;
      state.balance -= item.amount;
      state.incomes = state.incomes.filter(i => i.id !== id);
      saveIncomes();
    } else {
      const item = state.expenses.find(e => e.id === id);
      if (!item) return;
      state.balance += item.amount;
      state.expenses = state.expenses.filter(e => e.id !== id);
      saveExpenses();
    }
    saveBalance();
    renderMovements();
    renderCategoryStats();
    renderTip();
    animateBalance(prevBalance, state.balance);
    $('summary-balance').textContent = formatMoney(state.balance);
    $('summary-spent').textContent   = formatMoney(getTotalSpent());
    renderBudgetBar();
  }

  function openClearModal()  {
    if (state.expenses.length + state.incomes.length === 0) return;
    $('clear-modal').classList.remove('hidden');
  }
  function closeClearModal() { $('clear-modal').classList.add('hidden'); }

  function confirmClearAll() {
    closeClearModal();
    state.expenses = [];
    state.incomes  = [];
    saveExpenses();
    saveIncomes();
    renderAll();
  }

  function showFeedback(msg, type) {
    const el = $('feedback-msg');
    el.textContent = msg;
    el.className = `feedback ${type === 'error' ? 'is-error' : 'is-ok'}`;
    clearTimeout(showFeedback._t);
    showFeedback._t = setTimeout(() => {
      el.className = 'feedback hidden';
    }, 2600);
  }

  /* -----------------------------------------------------------
     7. NAVEGACIÓN (Tab bar)
     ----------------------------------------------------------- */
  function showPage(pageId) {
    document.querySelectorAll('.tab-page').forEach(p => {
      p.classList.remove('active');
    });
    document.querySelectorAll('.tab-item').forEach(b => {
      b.classList.remove('tab-active');
    });

    const page = $(pageId);
    if (page) page.classList.add('active');

    const btn = document.querySelector(`.tab-item[data-page="${pageId}"]`);
    if (btn) btn.classList.add('tab-active');
  }

  /* -----------------------------------------------------------
     8. CHAT
     ----------------------------------------------------------- */
  function addChatMessage(text, isUser = false) {
    const li = document.createElement('li');
    if (isUser) {
      li.className = 'chat-row-user';
      li.innerHTML = `<div class="bubble-user">${escapeHtml(text)}</div>`;
    } else {
      li.className = 'chat-row-bot';
      li.innerHTML = `
        <div class="chat-bot-sm">⚡</div>
        <div class="bubble-bot">${escapeHtml(text)}</div>
      `;
    }
    $('chat-messages').appendChild(li);
    const scroll = $('chat-scroll');
    setTimeout(() => { scroll.scrollTop = scroll.scrollHeight; }, 80);
  }

  function showTypingIndicator() {
    const li = document.createElement('li');
    li.id = 'typing-indicator';
    li.className = 'chat-row-bot';
    li.innerHTML = `
      <div class="chat-bot-sm">⚡</div>
      <div class="bubble-bot" style="padding:10px 14px">
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div>
    `;
    $('chat-messages').appendChild(li);
    const scroll = $('chat-scroll');
    setTimeout(() => { scroll.scrollTop = scroll.scrollHeight; }, 50);
  }

  function removeTypingIndicator() {
    const el = $('typing-indicator');
    if (el) el.remove();
  }

  async function handleSendMessage() {
    const input   = $('chat-input');
    const message = input.value.trim();
    if (!message) return;

    addChatMessage(message, true);
    input.value = '';
    $('btn-send-message').disabled = true;
    showTypingIndicator();

    try {
      await new Promise(r => setTimeout(r, 700 + Math.random() * 500));
      removeTypingIndicator();
      addChatMessage(generateSmartReply(message));
    } catch {
      removeTypingIndicator();
      addChatMessage('⚠️ Algo salió mal. Inténtalo de nuevo.');
    } finally {
      $('btn-send-message').disabled = false;
      input.focus();
    }
  }

  function generateSmartReply(userMessage) {
    const msg    = userMessage.toLowerCase();
    const bal    = state.balance;
    const spent  = getTotalSpent();
    const earned = state.incomes.reduce((a, i) => a + i.amount, 0);
    const n      = state.expenses.length;
    const total  = bal + spent;
    const pct    = total > 0 ? (spent / total) * 100 : 0;

    const cats = {};
    state.expenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    const sorted   = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const topCat   = sorted[0];
    const avg      = n > 0 ? spent / n : 0;

    if (/^(hola|buenas|hey|ola)/.test(msg) || msg === 'hola' || /ayuda/.test(msg)) {
      return '👋 ¡Hola! Soy Flux AI. Puedo ayudarte con:\n• Resumen de gastos e ingresos\n• Consejos para ahorrar\n• Análisis por categoría\n• Estado de tu presupuesto\n\n¿Por dónde empezamos?';
    }
    if (/gracias|genial|perfecto|increíble/.test(msg)) {
      return '😊 ¡De nada! Estar pendiente de tus finanzas es el primer paso para ahorrar más.';
    }
    if (/qué puedes|que puedes|para qué/.test(msg)) {
      return '🤖 Soy tu asistente financiero. Puedo:\n\n• Analizar tus gastos e ingresos\n• Decirte dónde gastas más\n• Darte consejos personalizados\n• Calcular tu porcentaje de ahorro\n\nPrueba: "¿Cómo voy este mes?"';
    }
    if (/ingreso|he ganado|he cobrado|cuánto.*ingres/.test(msg)) {
      if (!state.incomes.length) return '📥 No has registrado ingresos aún. Usa el modo "💰 Ingreso" en la pantalla de inicio.';
      const conceptos = state.incomes.slice(-5).map(i => `• ${i.concept}: +€${i.amount.toFixed(2)}`).join('\n');
      return `📥 ${state.incomes.length} ingreso${state.incomes.length !== 1 ? 's' : ''} registrado${state.incomes.length !== 1 ? 's' : ''}, total €${earned.toFixed(2)}:\n\n${conceptos}`;
    }
    if (/consejo|ahorrar|mejorar/.test(msg)) {
      if (n === 0) return '💡 Aún sin gastos registrados.\n\nEmpezar a anotar TODO lo que gastes esta semana es el primer paso para ahorrar.';
      let a = pct > 75 ? `⚠️ Llevas el ${pct.toFixed(0)}% del presupuesto gastado.\n\n` : `✅ Vas bien: ${pct.toFixed(0)}% consumido.\n\n`;
      a += '💡 Mis consejos:\n';
      if (topCat) a += `• "${topCat[0]}" es tu mayor gasto (€${topCat[1].toFixed(2)}). Reducirlo un 15% marcaría la diferencia.\n`;
      a += `• Gasto medio por movimiento: €${avg.toFixed(2)}.\n`;
      a += pct > 75 ? '• Frena los gastos no esenciales hasta fin de mes.' : '• Mantén este ritmo y transfiere lo sobrante a ahorro.';
      return a;
    }
    if (/categoría|categoria|resumen|gasto/.test(msg)) {
      if (n === 0) return '📊 Sin gastos aún. ¡Registra el primero!';
      let r = `📊 Resumen de ${n} gasto${n !== 1 ? 's' : ''}:\n\n`;
      sorted.forEach(([cat, amt]) => { r += `• ${cat}: €${amt.toFixed(2)} (${((amt / spent) * 100).toFixed(0)}%)\n`; });
      r += `\nTotal gastado: €${spent.toFixed(2)}`;
      if (earned > 0) r += `\nTotal ingresos: +€${earned.toFixed(2)}`;
      return r;
    }
    if (/saldo|dinero|balance|cómo voy|como voy/.test(msg)) {
      if (total === 0 && !earned) return '💰 Configura tu saldo en la pantalla de inicio para que pueda ayudarte.';
      let r = `💰 Tu situación:\n\n• Disponible: €${bal.toFixed(2)}\n• Gastado: €${spent.toFixed(2)}\n`;
      if (earned > 0) r += `• Ingresos totales: +€${earned.toFixed(2)}\n`;
      r += `• Consumido: ${pct.toFixed(1)}%\n\n`;
      r += pct > 80 ? '⚠️ Presupuesto muy justo. Cuidado.' : pct > 50 ? '🟡 A mitad. Modera los gastos.' : '🟢 Buen ritmo. Sigues con margen.';
      return r;
    }
    if (/mayor|más gasto|mas gasto|top/.test(msg)) {
      if (!topCat) return '📈 Sin datos suficientes aún.';
      return `🏆 Tu mayor gasto: "${topCat[0]}" con €${topCat[1].toFixed(2)}.\n${sorted.length > 1 ? `\nEl segundo: "${sorted[1][0]}" con €${sorted[1][1].toFixed(2)}.` : ''}\n\nAhí es donde más puedes ahorrar.`;
    }
    if (/tendencia|patrón|promedio/.test(msg)) {
      if (n < 2) return '📈 Necesito al menos 2 gastos para analizar tendencias.';
      return `📈 Análisis:\n\n• ${n} gastos registrados\n• Promedio: €${avg.toFixed(2)}/movimiento\n• Total: €${spent.toFixed(2)}\n• Categorías: ${sorted.length}`;
    }
    return '🤔 No entendí bien. Pregúntame:\n\n• "¿Cómo voy este mes?"\n• "Consejos para ahorrar"\n• "Resumen de gastos"\n• "¿Cuánto he ingresado?"\n• "¿Cuál es mi mayor gasto?"';
  }

  /* -----------------------------------------------------------
     8. INFORME MENSUAL
     ----------------------------------------------------------- */

  // ── Modal helpers ────────────────────────────────────────────
  function openReportModal() {
    const select = $('report-month');
    select.innerHTML = '';
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label.charAt(0).toUpperCase() + label.slice(1);
      select.appendChild(opt);
    }
    showReportState('form');
    $('modal-report').classList.remove('hidden');
  }

  function closeReportModal() {
    $('modal-report').classList.add('hidden');
  }

  function showReportState(s) {
    ['form', 'loading', 'success', 'error'].forEach((id) => {
      $('report-' + id).classList.toggle('hidden', id !== s);
    });
  }

  // ── Main handler ─────────────────────────────────────────────
  async function handleGenerateReport() {
    const [year, month] = $('report-month').value.split('-').map(Number);
    const monthLabel    = new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

    showReportState('loading');

    try {
      // 1. Filtrar datos del mes
      setLoadingText('Filtrando datos del mes…');
      const mExp = state.expenses.filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === month && d.getFullYear() === year;
      });
      const mInc = state.incomes.filter((i) => {
        const d = new Date(i.date);
        return d.getMonth() === month && d.getFullYear() === year;
      });

      const totalSpent  = mExp.reduce((a, e) => a + e.amount, 0);
      const totalIncome = mInc.reduce((a, i) => a + i.amount, 0);
      const netBalance  = totalIncome - totalSpent;

      // Agrupar por categoría (para IA y para el PDF)
      const groups = groupByCategory(mExp);
      const cats = {};
      groups.forEach((g) => { cats[g.cat.label] = g.total; });

      // 2. Análisis IA (opcional)
      setLoadingText('Analizando con IA…');
      let aiAnalysis = null;
      try { aiAnalysis = await getMonthlyAIAnalysis(monthLabelCap, mExp, mInc, cats, totalSpent, totalIncome); } catch (_) {}

      // 3. Maquetar el informe editorial y generar el PDF con html2pdf.js
      setLoadingText('Maquetando el informe…');
      const reportHtml = buildReportDoc({
        monthLabel: monthLabelCap,
        totalSpent, totalIncome, netBalance,
        groups, mExp, mInc, aiAnalysis,
      });

      setLoadingText('Generando PDF…');
      await generatePDF(reportHtml, monthLabelCap);

      $('btn-download-success').onclick = () => generatePDF(reportHtml, monthLabelCap);
      showReportState('success');

    } catch (err) {
      console.error('Report error:', err);
      $('report-error-msg').textContent = err.message || 'Error generando el PDF. Inténtalo de nuevo.';
      showReportState('error');
    }
  }

  function setLoadingText(t) {
    const el = $('report-loading-text');
    if (el) el.textContent = t;
  }

  // ── AI analysis ──────────────────────────────────────────────
  async function getMonthlyAIAnalysis(monthLabel, expenses, incomes, categories, totalSpent, totalIncome) {
    const catsText = Object.entries(categories)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([cat, amt]) => `- ${cat}: €${amt.toFixed(2)}`).join('\n') || 'Sin gastos.';

    const message =
      `Genera un analisis mensual de mis finanzas de ${monthLabel}. ` +
      `Responde EXACTAMENTE con este formato (sin emojis, texto plano):\n\n` +
      `POSITIVOS:\n[2 o 3 puntos positivos concretos con los numeros reales]\n\n` +
      `MEJORAS:\n[2 o 3 areas a mejorar con recomendaciones concretas]\n\n` +
      `Datos: Total gastado €${totalSpent.toFixed(2)}, Total ingresos €${totalIncome.toFixed(2)}, ` +
      `${expenses.length} gastos. Categorias:\n${catsText}`;

    const context = {
      balance:     state.balance,
      totalSpent,
      numExpenses: expenses.length,
      categories,
    };

    const res = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message, context }),
    });

    if (!res.ok) throw new Error('IA no disponible');
    const data = await res.json();
    return data.reply || '';
  }

  // ── Generación del PDF con html2pdf.js ──
  function barColorFor(key) {
    return ({
      comida: '#FF9500', ocio: '#5E5CE6', supermercado: '#30D158',
      transporte: '#007AFF', otros: '#8E8E93',
    })[key] || '#8E8E93';
  }

  async function generatePDF(html, monthLabel) {
    if (typeof html2pdf === 'undefined') {
      throw new Error('El generador de PDF aún se está cargando. Espera unos segundos e inténtalo de nuevo.');
    }
    const stage = $('pdf-stage');
    stage.innerHTML = html;
    const target = stage.querySelector('.pdfdoc');

    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }

    const safe = monthLabel.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');
    try {
      await html2pdf().set({
        margin:      [10, 10, 12, 10],
        filename:    'flux-informe-' + safe + '.pdf',
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 794 },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:   { mode: ['css', 'legacy'], avoid: ['.cat-group', '.ai-card', '.summary', '.report-head'] },
      }).from(target).save();
    } finally {
      stage.innerHTML = '';
    }
  }

  // ── Documento del informe (HTML agrupado por categoría) ──
  function buildReportDoc({ monthLabel, totalSpent, totalIncome, netBalance, groups, mExp, mInc, aiAnalysis }) {
    const genDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const genTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    // ── Grupos de gastos por categoría (con sus conceptos) ──
    const groupBlocks = groups.length === 0
      ? `<p class="muted-note">Sin gastos registrados en ${escapeHtml(monthLabel)}.</p>`
      : groups.map((g) => {
          const pct = totalSpent > 0 ? (g.total / totalSpent) * 100 : 0;
          const color = barColorFor(g.cat.key);
          const items = g.items.map((it) => {
            const d = new Date(it.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            return `
              <li class="cg-item">
                <span class="cg-item-name">${escapeHtml(it.concept)}</span>
                <span class="cg-item-date">${d}</span>
                <span class="cg-item-amt">€${it.amount.toFixed(2)}</span>
              </li>`;
          }).join('');
          return `
            <div class="cat-group">
              <div class="cg-head">
                <span class="cg-emoji">${g.cat.emoji}</span>
                <span class="cg-label">${escapeHtml(g.cat.label)}</span>
                <span class="cg-total">€${g.total.toFixed(2)}</span>
              </div>
              <div class="cg-track"><div class="cg-bar" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
              <span class="cg-pct">${pct.toFixed(0)}% del gasto · ${g.items.length} movimiento${g.items.length !== 1 ? 's' : ''}</span>
              <ul class="cg-items">${items}</ul>
            </div>`;
        }).join('');

    // ── Ingresos (si hay) ──
    let incomeBlock = '';
    if (mInc.length > 0) {
      const incItems = [...mInc].sort((a, b) => b.amount - a.amount).map((i) => {
        const d = new Date(i.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        return `
          <li class="cg-item">
            <span class="cg-item-name">${escapeHtml(i.concept || 'Ingreso')}</span>
            <span class="cg-item-date">${d}</span>
            <span class="cg-item-amt amt-pos">+€${i.amount.toFixed(2)}</span>
          </li>`;
      }).join('');
      incomeBlock = `
        <div class="cat-group">
          <div class="cg-head">
            <span class="cg-emoji">💰</span>
            <span class="cg-label">Ingresos</span>
            <span class="cg-total" style="color:#047857">+€${totalIncome.toFixed(2)}</span>
          </div>
          <ul class="cg-items">${incItems}</ul>
        </div>`;
    }

    // ── Bloque IA (POSITIVOS / MEJORAS) con fallback local ──
    let aiBlock = '';
    const cleanAI = (s) => (s || '').replace(/\*/g, '').trim();
    if (aiAnalysis) {
      const posMatch = aiAnalysis.match(/POSITIVOS:?\s*([\s\S]*?)(?=MEJORAS:|$)/i);
      const mejMatch = aiAnalysis.match(/MEJORAS:?\s*([\s\S]*?)$/i);
      const posText  = posMatch ? cleanAI(posMatch[1]) : '';
      const mejText  = mejMatch ? cleanAI(mejMatch[1]) : '';
      if (posText) aiBlock += `<div class="ai-card ai-card-pos"><p class="ai-card-cap">Lo mejor de este mes</p><p class="ai-card-text">${escapeHtml(posText)}</p></div>`;
      if (mejText) aiBlock += `<div class="ai-card ai-card-mej"><p class="ai-card-cap">Áreas de mejora</p><p class="ai-card-text">${escapeHtml(mejText)}</p></div>`;
    }
    if (!aiBlock) {
      const advice = generateSmartReply('consejo para ahorrar');
      aiBlock = `<div class="ai-card ai-card-pos"><p class="ai-card-cap">Consejo de ahorro</p><p class="ai-card-text">${escapeHtml(advice)}</p></div>`;
    }

    const netPos = netBalance >= 0;

    return `<div class="pdfdoc">
<style>
  .pdfdoc{ font-family:'Inter',sans-serif; color:#0F172A; background:#fff; width:794px; padding:40px 44px; font-size:12px; line-height:1.5; }
  .pdfdoc *{ margin:0; padding:0; box-sizing:border-box; }
  .pdfdoc .report-head{ display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:20px; border-bottom:2px solid #0F172A; margin-bottom:26px; }
  .pdfdoc .brand-row{ display:flex; align-items:center; gap:9px; margin-bottom:14px; }
  .pdfdoc .brand-mark{ width:30px; height:30px; border-radius:8px; background:linear-gradient(145deg,#0F172A,#1E3A8A); color:#fff; display:flex; align-items:center; justify-content:center; font-size:15px; }
  .pdfdoc .brand-name{ font-size:12px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; color:#64748B; }
  .pdfdoc .report-eyebrow{ font-size:11px; font-weight:600; letter-spacing:0.16em; text-transform:uppercase; color:#A16207; margin-bottom:4px; }
  .pdfdoc .report-title{ font-family:'Playfair Display',Georgia,serif; font-size:38px; font-weight:700; letter-spacing:-0.5px; line-height:1.05; color:#0F172A; }
  .pdfdoc .report-meta{ text-align:right; font-size:11px; color:#64748B; line-height:1.7; padding-top:4px; }
  .pdfdoc .report-meta strong{ display:block; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.1em; color:#94A3B8; margin-bottom:2px; }
  .pdfdoc .summary{ display:flex; gap:14px; margin-bottom:30px; }
  .pdfdoc .sum-box{ flex:1; border:1px solid #E2E8F0; border-radius:14px; padding:18px 20px; background:#F8FAFC; }
  .pdfdoc .sum-box.feature{ background:linear-gradient(150deg,#0F172A,#1E3A8A); border:none; }
  .pdfdoc .sum-cap{ font-size:9.5px; font-weight:600; text-transform:uppercase; letter-spacing:0.14em; color:#64748B; margin-bottom:8px; }
  .pdfdoc .sum-box.feature .sum-cap{ color:rgba(255,255,255,0.6); }
  .pdfdoc .sum-num{ font-family:'Playfair Display',Georgia,serif; font-size:27px; font-weight:600; letter-spacing:-0.5px; }
  .pdfdoc .sum-box.feature .sum-num{ color:#fff; }
  .pdfdoc .sum-sub{ margin-top:4px; font-size:10px; color:#64748B; }
  .pdfdoc .sum-box.feature .sum-sub{ color:rgba(255,255,255,0.55); }
  .pdfdoc .accent-bar{ height:3px; width:34px; background:#A16207; border-radius:2px; margin-top:12px; }
  .pdfdoc .section-cap{ font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.16em; color:#A16207; margin-bottom:16px; }
  .pdfdoc .muted-note{ font-size:12px; color:#94A3B8; font-style:italic; padding:8px 0; }
  .pdfdoc .cat-group{ border:1px solid #E2E8F0; border-radius:14px; padding:16px 18px; margin-bottom:14px; background:#fff; page-break-inside:avoid; break-inside:avoid; }
  .pdfdoc .cg-head{ display:flex; align-items:center; gap:10px; margin-bottom:9px; }
  .pdfdoc .cg-emoji{ font-size:20px; }
  .pdfdoc .cg-label{ flex:1; font-size:15px; font-weight:700; color:#0F172A; }
  .pdfdoc .cg-total{ font-size:16px; font-weight:800; color:#0F172A; font-variant-numeric:tabular-nums; }
  .pdfdoc .cg-track{ height:5px; background:#EEF2F7; border-radius:99px; overflow:hidden; margin-bottom:4px; }
  .pdfdoc .cg-bar{ height:100%; border-radius:99px; }
  .pdfdoc .cg-pct{ display:block; font-size:9.5px; color:#94A3B8; margin-bottom:10px; }
  .pdfdoc .cg-items{ list-style:none; border-top:1px solid #F1F5F9; }
  .pdfdoc .cg-item{ display:flex; align-items:center; gap:10px; padding:7px 0; border-bottom:0.5px solid #F1F5F9; }
  .pdfdoc .cg-item:last-child{ border-bottom:none; }
  .pdfdoc .cg-item-name{ flex:1; font-size:12.5px; font-weight:500; color:#1E293B; }
  .pdfdoc .cg-item-date{ font-size:10px; color:#94A3B8; white-space:nowrap; }
  .pdfdoc .cg-item-amt{ font-size:12.5px; font-weight:700; color:#B91C1C; font-variant-numeric:tabular-nums; min-width:64px; text-align:right; }
  .pdfdoc .cg-item-amt.amt-pos{ color:#047857; }
  .pdfdoc .ai-section{ margin-top:26px; }
  .pdfdoc .ai-head{ display:flex; align-items:center; gap:10px; margin-bottom:14px; }
  .pdfdoc .ai-badge{ width:30px; height:30px; border-radius:9px; background:linear-gradient(145deg,#0F172A,#1E3A8A); color:#fff; display:flex; align-items:center; justify-content:center; font-size:15px; }
  .pdfdoc .ai-title{ font-size:13px; font-weight:700; color:#0F172A; }
  .pdfdoc .ai-sub{ font-size:9px; font-weight:500; text-transform:uppercase; letter-spacing:0.12em; color:#A16207; }
  .pdfdoc .ai-card{ border:1px solid #E2E8F0; border-radius:14px; background:#F8FAFC; padding:18px 20px; margin-bottom:12px; position:relative; overflow:hidden; page-break-inside:avoid; break-inside:avoid; }
  .pdfdoc .ai-card::before{ content:''; position:absolute; left:0; top:0; bottom:0; width:4px; }
  .pdfdoc .ai-card-pos::before{ background:#047857; }
  .pdfdoc .ai-card-mej::before{ background:#A16207; }
  .pdfdoc .ai-card-cap{ font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:7px; }
  .pdfdoc .ai-card-pos .ai-card-cap{ color:#047857; }
  .pdfdoc .ai-card-mej .ai-card-cap{ color:#A16207; }
  .pdfdoc .ai-card-text{ font-size:12px; line-height:1.65; color:#0F172A; white-space:pre-wrap; }
  .pdfdoc .report-foot{ margin-top:28px; padding-top:14px; border-top:1px solid #E2E8F0; display:flex; justify-content:space-between; font-size:9px; color:#94A3B8; letter-spacing:0.04em; }
</style>

  <div class="report-head">
    <div>
      <div class="brand-row">
        <div class="brand-mark">⚡</div>
        <span class="brand-name">Flux · Finanzas</span>
      </div>
      <p class="report-eyebrow">Informe mensual</p>
      <h1 class="report-title">${escapeHtml(monthLabel)}</h1>
    </div>
    <div class="report-meta">
      <strong>Generado</strong>
      ${genDate}<br>${genTime}
    </div>
  </div>

  <div class="summary">
    <div class="sum-box feature">
      <p class="sum-cap">Balance Neto</p>
      <p class="sum-num">${netPos ? '+' : '−'}€${Math.abs(netBalance).toFixed(2)}</p>
      <p class="sum-sub">${netPos ? 'Has ahorrado este mes' : 'Has gastado de más'}</p>
    </div>
    <div class="sum-box">
      <p class="sum-cap">Ingresos</p>
      <p class="sum-num" style="color:#047857">+€${totalIncome.toFixed(2)}</p>
      <p class="sum-sub">${mInc.length} ingreso${mInc.length !== 1 ? 's' : ''}</p>
      <div class="accent-bar"></div>
    </div>
    <div class="sum-box">
      <p class="sum-cap">Gastos</p>
      <p class="sum-num" style="color:#B91C1C">−€${totalSpent.toFixed(2)}</p>
      <p class="sum-sub">${mExp.length} gasto${mExp.length !== 1 ? 's' : ''}</p>
      <div class="accent-bar"></div>
    </div>
  </div>

  <p class="section-cap">Gastos agrupados por categoría</p>
  ${groupBlocks}
  ${incomeBlock}

  <div class="ai-section">
    <div class="ai-head">
      <div class="ai-badge">⚡</div>
      <div>
        <div class="ai-title">Flux AI</div>
        <div class="ai-sub">Análisis inteligente</div>
      </div>
    </div>
    ${aiBlock}
  </div>

  <div class="report-foot">
    <span>Flux · Generado localmente en tu dispositivo</span>
    <span>Documento confidencial</span>
  </div>
</div>`;
  }


  /* -----------------------------------------------------------
     9. INICIALIZACIÓN + LISTENERS
     ----------------------------------------------------------- */
  function init() {
    loadState();
    renderAll();
    updateDisplay();

    // Tip — cerrar banner
    $('btn-tip-close').addEventListener('click', () => {
      $('tip-banner').style.display = 'none';
    });

    // Keypad
    document.querySelectorAll('.key').forEach(btn => {
      btn.addEventListener('click', () => handleKeypadPress(btn.dataset.key));
    });

    // Register
    $('btn-register').addEventListener('click', handleRegister);
    $('input-concept').addEventListener('keydown', e => {
      if (e.key === 'Enter') handleRegister();
    });

    // Category sheet
    $('btn-category').addEventListener('click', openCategorySheet);
    $('cat-sheet-backdrop').addEventListener('click', closeCategorySheet);
    $('cat-sheet-list').addEventListener('click', e => {
      const opt = e.target.closest('.cat-opt');
      if (opt) selectCategory(opt.dataset.key);
    });
    renderCategoryButton();

    // Mode toggle
    $('btn-mode-expense').addEventListener('click', () => setMode('expense'));
    $('btn-mode-income').addEventListener('click',  () => setMode('income'));

    // Tab bar
    document.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => showPage(btn.dataset.page));
    });

    // Borrar todo
    $('btn-clear').addEventListener('click', openClearModal);
    $('btn-clear-confirm').addEventListener('click', confirmClearAll);
    $('btn-clear-cancel').addEventListener('click', closeClearModal);
    $('clear-modal').addEventListener('click', e => {
      if (e.target === $('clear-modal')) closeClearModal();
    });

    // Delete movement
    $('expense-list').addEventListener('click', e => {
      const btn = e.target.closest('.mov-delete');
      if (btn) handleDeleteMovement(Number(btn.dataset.id), btn.dataset.type);
    });

    // AI card → chat tab
    $('btn-go-chat').addEventListener('click', () => showPage('page-chat'));

    // Chat
    $('btn-send-message').addEventListener('click', handleSendMessage);
    $('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
    });

    // Onboarding (pantalla de bienvenida)
    $('btn-onboard-start').addEventListener('click', finishOnboarding);
    $('onboard-balance').addEventListener('input', () => {
      const v = parseFloat($('onboard-balance').value);
      $('btn-onboard-start').disabled = !(v > 0);
    });
    $('onboard-balance').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const v = parseFloat($('onboard-balance').value);
        if (v > 0) finishOnboarding();
      }
    });

    // Reiniciar todo
    $('btn-reset').addEventListener('click', openResetModal);
    $('btn-reset-cancel').addEventListener('click', closeResetModal);
    $('btn-reset-confirm').addEventListener('click', confirmReset);
    $('reset-modal').addEventListener('click', e => {
      if (e.target === $('reset-modal')) closeResetModal();
    });

    // Informe mensual
    $('btn-open-report').addEventListener('click',     openReportModal);
    $('btn-close-modal').addEventListener('click',     closeReportModal);
    $('modal-backdrop').addEventListener('click',      closeReportModal);
    $('btn-generate-report').addEventListener('click', handleGenerateReport);
    $('btn-close-success').addEventListener('click',   closeReportModal);
    $('btn-retry-report').addEventListener('click',    () => showReportState('form'));
    $('btn-cancel-report').addEventListener('click',   closeReportModal);

    // Mostrar bienvenida si es la primera vez
    maybeShowOnboarding();

    // Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
