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

  const state = {
    balance:  0,
    expenses: [],
    incomes:  [],
    mode:     'expense', // 'expense' | 'income'
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

  /* Categorías → emoji + color */
  function getCatStyle(name) {
    const n = (name || '').toLowerCase();
    if (/comida|restaur|cafe|café|super|hambur|pizza|kebab|sushi|cena|bar/.test(n))
      return { emoji: '🍔', bg: 'background:#FFF3E8' };
    if (/trans|bus|metro|taxi|coche|gasolina|tren|uber|cabify|bici|parking/.test(n))
      return { emoji: '🚗', bg: 'background:#E8F4FF' };
    if (/ocio|cine|fiesta|disco|juego|netflix|spotify|suscripci/.test(n))
      return { emoji: '🎉', bg: 'background:#F3EEFF' };
    if (/salud|farmacia|médico|doctor|gym|deporte|vitam|dentista/.test(n))
      return { emoji: '💊', bg: 'background:#E8FFF1' };
    if (/ropa|moda|zapato|tienda|zara|primark/.test(n))
      return { emoji: '👗', bg: 'background:#FFF0F6' };
    if (/tecno|móvil|movil|ordenador|laptop|gadget|electr|amazon/.test(n))
      return { emoji: '💻', bg: 'background:#E8FEFF' };
    if (/casa|hogar|alquiler|hipoteca|mueble|ikea|luz|agua|factura/.test(n))
      return { emoji: '🏠', bg: 'background:#FFFBEA' };
    if (/viaje|hotel|vacacion|airbnb|booking/.test(n))
      return { emoji: '✈️', bg: 'background:#EBF5FF' };
    if (/libro|estudio|curso|formaci|educaci|universid/.test(n))
      return { emoji: '📚', bg: 'background:#EEF2FF' };
    if (/regalo|chuche|dulce|juguete/.test(n))
      return { emoji: '🎁', bg: 'background:#FFF0F0' };
    return { emoji: '💸', bg: 'background:#F5F0FF' };
  }

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
    const btnE = $('btn-mode-expense');
    const btnI = $('btn-mode-income');
    const cat  = $('input-category');
    const btn  = $('btn-register');
    const txt  = $('btn-register-text');

    if (mode === 'income') {
      btnE.classList.remove('seg-active');
      btnI.classList.add('seg-active', 'income-seg');
      cat.placeholder   = 'Concepto: Nómina, Bizum, Regalo…';
      btn.classList.add('income-cta');
      txt.textContent   = 'Añadir ingreso';
    } else {
      btnI.classList.remove('seg-active', 'income-seg');
      btnE.classList.add('seg-active');
      cat.placeholder   = 'Categoría (ej. Comida, Taxi…)';
      btn.classList.remove('income-cta');
      txt.textContent   = 'Añadir gasto';
    }
    updateDisplay();
  }

  /* -----------------------------------------------------------
     5. RENDERIZADO
     ----------------------------------------------------------- */
  function renderBalance() {
    const inp = $('input-balance');
    if (document.activeElement !== inp) {
      inp.value = state.balance ? state.balance.toFixed(2) : '';
    }
    $('summary-balance').textContent = formatMoney(state.balance);
    $('summary-spent').textContent   = formatMoney(getTotalSpent());

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
      const style    = isIncome ? getIncomStyle(mov.concept || '') : getCatStyle(mov.category || '');
      const label    = isIncome ? (mov.concept || 'Ingreso') : mov.category;

      const li = document.createElement('li');
      li.className = 'mov-cell';
      li.innerHTML = `
        <div class="mov-icon" style="${style.bg}">${style.emoji}</div>
        <div class="mov-info">
          <p class="mov-name">${escapeHtml(label)}</p>
          <p class="mov-date">${formatDate(mov.date)}</p>
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

  function renderAll() {
    renderBalance();
    renderMovements();
    renderTip();
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

    $('input-category').value = '';
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
  function handleBalanceChange(e) {
    state.balance = parseFloat(e.target.value) || 0;
    saveBalance();
    renderBalance();
  }

  function handleRegister() {
    const amount   = parseFloat(keypadInput);
    const label    = $('input-category').value.trim();

    if (!keypadInput || isNaN(amount) || amount <= 0) {
      showFeedback('Introduce una cantidad válida.', 'error');
      return;
    }

    if (state.mode === 'expense') {
      if (!label) {
        showFeedback('Indica en qué te lo has gastado.', 'error');
        $('input-category').focus();
        return;
      }
      if (amount > state.balance) {
        showFeedback(`Saldo insuficiente. Tienes ${formatMoney(state.balance)}.`, 'error');
        return;
      }
      state.expenses.push({ id: Date.now(), amount, category: label, date: new Date().toISOString() });
      state.balance -= amount;
      saveExpenses();
      saveBalance();
      showFeedback(`✓ ${formatMoney(amount)} en "${label}" registrado.`, 'ok');

    } else {
      state.incomes.push({ id: Date.now(), amount, concept: label || 'Ingreso', date: new Date().toISOString() });
      state.balance += amount;
      saveIncomes();
      saveBalance();
      showFeedback(`✓ +${formatMoney(amount)} añadido a tu saldo.`, 'ok');
    }

    keypadInput = '';
    updateDisplay();
    $('input-category').value = '';
    renderAll();
  }

  function handleDeleteMovement(id, type) {
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
    renderAll();
  }

  function handleClearAll() {
    if (state.expenses.length + state.incomes.length === 0) return;
    if (!confirm('¿Borrar todos los movimientos? El saldo no se modificará.')) return;
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

      const cats = {};
      mExp.forEach((e) => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
      const sortedCats = Object.entries(cats).sort((a, b) => b[1] - a[1]);

      // 2. Análisis IA (opcional)
      setLoadingText('Analizando con IA…');
      let aiAnalysis = null;
      try { aiAnalysis = await getMonthlyAIAnalysis(monthLabelCap, mExp, mInc, cats, totalSpent, totalIncome); } catch (_) {}

      // 3. Maquetar el informe editorial (HTML) y abrirlo para imprimir / guardar como PDF
      setLoadingText('Maquetando el informe…');
      const reportHtml = buildEditorialReport({
        monthLabel: monthLabelCap,
        totalSpent, totalIncome, netBalance,
        sortedCats, mExp, mInc, aiAnalysis,
      });

      openReport(reportHtml);
      $('btn-download-success').onclick = () => openReport(reportHtml);
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

  // ── Paleta editorial (UI-UX Pro Max · "Banking/Traditional Finance") ──
  const REPORT_PALETTE = ['#0F172A','#1E3A8A','#A16207','#475569','#64748B','#94A3B8','#B45309'];

  // ── Generador del informe editorial (HTML para imprimir / guardar como PDF) ──
  let lastReportHtml = '';

  function openReport(html) {
    lastReportHtml = html;
    const win = window.open('', '_blank');
    if (!win) {
      $('report-error-msg').textContent = 'Permite las ventanas emergentes para abrir el informe.';
      showReportState('error');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function buildEditorialReport({ monthLabel, totalSpent, totalIncome, netBalance, sortedCats, mExp, mInc, aiAnalysis }) {
    const genDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const genTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    // Movimientos del mes (gastos + ingresos) ordenados por fecha
    const movements = [
      ...mExp.map(e => ({ ...e, _t: 'expense' })),
      ...mInc.map(i => ({ ...i, _t: 'income'  })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // ── Desglose por categoría (barras editoriales en CSS) ──
    const catBlock = sortedCats.length === 0
      ? `<p class="muted-note">Sin gastos registrados en ${escapeHtml(monthLabel)}.</p>`
      : sortedCats.slice(0, 8).map(([cat, amt], i) => {
          const pct = totalSpent > 0 ? (amt / totalSpent) * 100 : 0;
          const color = REPORT_PALETTE[i % REPORT_PALETTE.length];
          return `
            <div class="cat-row">
              <div class="cat-row-head">
                <span class="cat-dot" style="background:${color}"></span>
                <span class="cat-label">${escapeHtml(cat)}</span>
                <span class="cat-amt">€${amt.toFixed(2)}</span>
              </div>
              <div class="cat-track">
                <div class="cat-bar" style="width:${pct.toFixed(1)}%;background:${color}"></div>
              </div>
              <span class="cat-pct">${pct.toFixed(0)}% del gasto</span>
            </div>`;
        }).join('');

    // ── Tabla de movimientos ──
    const rows = movements.length === 0
      ? `<tr><td colspan="3" class="empty-row">No hay movimientos en este mes.</td></tr>`
      : movements.map(m => {
          const isIncome = m._t === 'income';
          const label = isIncome ? (m.concept || 'Ingreso') : m.category;
          const d = new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
          return `
            <tr>
              <td class="cell-cat">
                <span class="cat-name">${escapeHtml(label)}</span>
                <span class="cat-type">${isIncome ? 'Ingreso' : 'Gasto'}</span>
              </td>
              <td class="cell-date">${d}</td>
              <td class="cell-amount ${isIncome ? 'amt-pos' : 'amt-neg'}">${isIncome ? '+' : '−'} €${m.amount.toFixed(2)}</td>
            </tr>`;
        }).join('');

    // ── Bloque de análisis IA (POSITIVOS / MEJORAS) ──
    let aiBlock = '';
    const cleanAI = (s) => (s || '').replace(/\*/g, '').trim();
    if (aiAnalysis) {
      const posMatch = aiAnalysis.match(/POSITIVOS:?\s*([\s\S]*?)(?=MEJORAS:|$)/i);
      const mejMatch = aiAnalysis.match(/MEJORAS:?\s*([\s\S]*?)$/i);
      const posText  = posMatch ? cleanAI(posMatch[1]) : '';
      const mejText  = mejMatch ? cleanAI(mejMatch[1]) : '';
      if (posText) {
        aiBlock += `
          <div class="ai-card ai-card-pos">
            <p class="ai-card-cap">Lo mejor de este mes</p>
            <p class="ai-card-text">${escapeHtml(posText)}</p>
          </div>`;
      }
      if (mejText) {
        aiBlock += `
          <div class="ai-card ai-card-mej">
            <p class="ai-card-cap">Áreas de mejora</p>
            <p class="ai-card-text">${escapeHtml(mejText)}</p>
          </div>`;
      }
    }
    if (!aiBlock) {
      // Sin IA disponible → consejo local contextual
      const advice = generateSmartReply('consejo para ahorrar');
      aiBlock = `
        <div class="ai-card ai-card-pos">
          <p class="ai-card-cap">Consejo de ahorro</p>
          <p class="ai-card-text">${escapeHtml(advice)}</p>
        </div>`;
    }

    const netPos = netBalance >= 0;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe Mensual — ${escapeHtml(monthLabel)} — Flux</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --navy:#0F172A; --navy-2:#1E3A8A; --gold:#A16207; --muted:#64748B;
    --muted-2:#94A3B8; --border:#E2E8F0; --bg:#FFFFFF; --bg-soft:#F8FAFC;
    --green:#047857; --red:#B91C1C;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{ size:A4; margin:18mm 16mm 20mm; }
  html{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body{ font-family:'Inter',sans-serif; color:var(--navy); background:var(--bg); font-size:11px; line-height:1.5; }

  .report-head{ display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:20px; border-bottom:2px solid var(--navy); margin-bottom:28px; }
  .brand-row{ display:flex; align-items:center; gap:8px; margin-bottom:14px; }
  .brand-mark{ width:26px; height:26px; border-radius:7px; background:linear-gradient(145deg,#0F172A,#1E3A8A); color:#fff; display:flex; align-items:center; justify-content:center; font-size:13px; }
  .brand-name{ font-size:11px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; color:var(--muted); }
  .report-eyebrow{ font-family:'Inter',sans-serif; font-size:10px; font-weight:600; letter-spacing:0.16em; text-transform:uppercase; color:var(--gold); margin-bottom:4px; }
  .report-title{ font-family:'Playfair Display',serif; font-size:34px; font-weight:700; letter-spacing:-0.5px; line-height:1.05; color:var(--navy); }
  .report-meta{ text-align:right; font-size:10px; color:var(--muted); line-height:1.7; padding-top:4px; }
  .report-meta strong{ display:block; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.1em; color:var(--muted-2); margin-bottom:2px; }

  .summary{ display:flex; gap:14px; margin-bottom:34px; }
  .sum-box{ flex:1; border:1px solid var(--border); border-radius:14px; padding:18px 20px; background:var(--bg-soft); }
  .sum-box.feature{ background:linear-gradient(150deg,#0F172A,#1E3A8A); border:none; color:#fff; }
  .sum-cap{ font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.14em; color:var(--muted); margin-bottom:8px; }
  .sum-box.feature .sum-cap{ color:rgba(255,255,255,0.6); }
  .sum-num{ font-family:'Playfair Display',serif; font-size:24px; font-weight:600; letter-spacing:-0.5px; }
  .sum-box.feature .sum-num{ color:#fff; }
  .sum-sub{ margin-top:4px; font-size:9.5px; color:var(--muted); }
  .sum-box.feature .sum-sub{ color:rgba(255,255,255,0.55); }
  .accent-bar{ height:3px; width:32px; background:var(--gold); border-radius:2px; margin-top:12px; }

  .section-cap{ font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.16em; color:var(--gold); margin-bottom:14px; }
  .section{ margin-bottom:30px; break-inside:avoid; }

  .cat-row{ margin-bottom:13px; break-inside:avoid; }
  .cat-row-head{ display:flex; align-items:center; gap:7px; margin-bottom:5px; }
  .cat-dot{ width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .cat-label{ font-size:11px; font-weight:600; color:var(--navy); flex:1; }
  .cat-amt{ font-size:11px; font-weight:700; color:var(--navy); font-variant-numeric:tabular-nums; }
  .cat-track{ height:4px; background:#EEF2F7; border-radius:3px; overflow:hidden; }
  .cat-bar{ height:100%; border-radius:3px; }
  .cat-pct{ display:block; margin-top:3px; font-size:8.5px; color:var(--muted-2); }
  .muted-note{ font-size:11px; color:var(--muted-2); font-style:italic; padding:8px 0; }

  table{ width:100%; border-collapse:collapse; }
  thead th{ font-size:8.5px; font-weight:600; text-transform:uppercase; letter-spacing:0.12em; color:var(--muted-2); text-align:left; padding:0 0 8px; border-bottom:1px solid var(--border); }
  thead th.th-date,thead th.th-amount{ text-align:right; }
  tbody tr{ break-inside:avoid; }
  tbody td{ padding:10px 0; border-bottom:0.5px solid var(--border); vertical-align:middle; }
  .cell-cat{ display:flex; flex-direction:column; }
  .cat-name{ font-size:11.5px; font-weight:600; color:var(--navy); }
  .cat-type{ font-size:8.5px; font-weight:500; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted-2); margin-top:1px; }
  .cell-date{ text-align:right; font-size:10px; color:var(--muted); white-space:nowrap; padding-right:18px; }
  .cell-amount{ text-align:right; font-size:12px; font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .amt-neg{ color:var(--red); } .amt-pos{ color:var(--green); }
  .empty-row{ padding:24px 0; text-align:center; color:var(--muted-2); font-style:italic; }

  .ai-section{ margin-top:30px; break-inside:avoid; }
  .ai-head{ display:flex; align-items:center; gap:9px; margin-bottom:14px; }
  .ai-badge{ width:26px; height:26px; border-radius:8px; background:linear-gradient(145deg,#0F172A,#1E3A8A); color:#fff; display:flex; align-items:center; justify-content:center; font-size:13px; }
  .ai-title{ font-size:12px; font-weight:700; color:var(--navy); }
  .ai-sub{ font-size:8.5px; font-weight:500; text-transform:uppercase; letter-spacing:0.12em; color:var(--gold); }
  .ai-card{ border:1px solid var(--border); border-radius:14px; background:var(--bg-soft); padding:18px 20px; margin-bottom:12px; break-inside:avoid; position:relative; overflow:hidden; }
  .ai-card::before{ content:''; position:absolute; left:0; top:0; bottom:0; width:4px; }
  .ai-card-pos::before{ background:var(--green); }
  .ai-card-mej::before{ background:var(--gold); }
  .ai-card-cap{ font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:7px; }
  .ai-card-pos .ai-card-cap{ color:var(--green); }
  .ai-card-mej .ai-card-cap{ color:var(--gold); }
  .ai-card-text{ font-size:11px; line-height:1.65; color:var(--navy); white-space:pre-wrap; }

  .report-foot{ margin-top:30px; padding-top:14px; border-top:1px solid var(--border); display:flex; justify-content:space-between; font-size:8.5px; color:var(--muted-2); letter-spacing:0.04em; }
</style>
</head>
<body>

  <header class="report-head">
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
  </header>

  <section class="summary">
    <div class="sum-box feature">
      <p class="sum-cap">Balance Neto</p>
      <p class="sum-num">${netPos ? '+' : '−'}€${Math.abs(netBalance).toFixed(2)}</p>
      <p class="sum-sub">${netPos ? 'Has ahorrado este mes' : 'Has gastado de más'}</p>
    </div>
    <div class="sum-box">
      <p class="sum-cap">Ingresos</p>
      <p class="sum-num" style="color:var(--green)">+€${totalIncome.toFixed(2)}</p>
      <p class="sum-sub">${mInc.length} ingreso${mInc.length !== 1 ? 's' : ''}</p>
      <div class="accent-bar"></div>
    </div>
    <div class="sum-box">
      <p class="sum-cap">Gastos</p>
      <p class="sum-num" style="color:var(--red)">−€${totalSpent.toFixed(2)}</p>
      <p class="sum-sub">${mExp.length} gasto${mExp.length !== 1 ? 's' : ''}</p>
      <div class="accent-bar"></div>
    </div>
  </section>

  <section class="section">
    <p class="section-cap">Gastos por categoría</p>
    ${catBlock}
  </section>

  <section class="section">
    <p class="section-cap">Detalle de movimientos</p>
    <table>
      <thead>
        <tr>
          <th>Concepto</th>
          <th class="th-date">Fecha</th>
          <th class="th-amount">Importe</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>

  <section class="ai-section">
    <div class="ai-head">
      <div class="ai-badge">⚡</div>
      <div>
        <div class="ai-title">Flux AI</div>
        <div class="ai-sub">Análisis inteligente</div>
      </div>
    </div>
    ${aiBlock}
  </section>

  <footer class="report-foot">
    <span>Flux · Generado localmente en tu dispositivo</span>
    <span>Documento confidencial</span>
  </footer>

  <script>
    window.addEventListener('load', function () {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { setTimeout(function(){ window.print(); }, 250); });
      } else {
        setTimeout(function(){ window.print(); }, 600);
      }
    });
  <\/script>
</body>
</html>`;
  }


  /* -----------------------------------------------------------
     9. INICIALIZACIÓN + LISTENERS
     ----------------------------------------------------------- */
  function init() {
    loadState();
    renderAll();
    updateDisplay();

    // Balance input
    $('input-balance').addEventListener('input', handleBalanceChange);

    // Keypad
    document.querySelectorAll('.key').forEach(btn => {
      btn.addEventListener('click', () => handleKeypadPress(btn.dataset.key));
    });

    // Register
    $('btn-register').addEventListener('click', handleRegister);
    $('input-category').addEventListener('keydown', e => {
      if (e.key === 'Enter') handleRegister();
    });

    // Mode toggle
    $('btn-mode-expense').addEventListener('click', () => setMode('expense'));
    $('btn-mode-income').addEventListener('click',  () => setMode('income'));

    // Tab bar
    document.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => showPage(btn.dataset.page));
    });

    // Borrar todo
    $('btn-clear').addEventListener('click', handleClearAll);

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
    $('onboard-balance').addEventListener('keydown', e => {
      if (e.key === 'Enter') finishOnboarding();
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
