/* ===========================================================
   APP.JS — Flux · Finanzas Personales
   =========================================================== */

(function () {
  'use strict';

  /* -----------------------------------------------------------
     1. ESTADO + PERSISTENCIA
     ----------------------------------------------------------- */
  const STORAGE_KEYS = {
    balance:  'fx_balance',
    expenses: 'fx_expenses',
    incomes:  'fx_incomes',
  };

  const state = {
    balance:  0,
    expenses: [],
    incomes:  [],
    mode:     'expense', // 'expense' | 'income'
  };

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEYS.balance);
    state.balance = raw !== null ? parseFloat(raw) : 0;
    try { state.expenses = JSON.parse(localStorage.getItem(STORAGE_KEYS.expenses) || '[]'); } catch { state.expenses = []; }
    try { state.incomes  = JSON.parse(localStorage.getItem(STORAGE_KEYS.incomes)  || '[]'); } catch { state.incomes  = []; }
  }

  function saveBalance()  { localStorage.setItem(STORAGE_KEYS.balance,  String(state.balance)); }
  function saveExpenses() { localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(state.expenses)); }
  function saveIncomes()  { localStorage.setItem(STORAGE_KEYS.incomes,  JSON.stringify(state.incomes)); }

  /* -----------------------------------------------------------
     2. UTILIDADES
     ----------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);

  function formatMoney(value) {
    const n = Number(value) || 0;
    return '€' + n.toFixed(2);
  }

  function getTotalSpent() {
    return state.expenses.reduce((acc, e) => acc + e.amount, 0);
  }

  function getTotalIncomes() {
    return state.incomes.reduce((acc, i) => acc + i.amount, 0);
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function showFeedback(message, type) {
    const el = $('feedback-msg');
    el.textContent = message;
    el.classList.remove('hidden', 'text-emerald-600', 'text-rose-600');
    el.classList.add(type === 'error' ? 'text-rose-600' : 'text-emerald-600');
    clearTimeout(showFeedback._t);
    showFeedback._t = setTimeout(() => el.classList.add('hidden'), 2500);
  }

  function getCategoryStyle(name) {
    const n = (name || '').toLowerCase();
    if (/comida|restaur|cafe|café|super|merce|hambur|pizza|kebab|sushi|cena|almuerzo|desayuno|menú|bar/.test(n))
      return { emoji: '🍔', bg: 'bg-orange-50' };
    if (/trans|bus|metro|taxi|coche|gasolina|tren|uber|cabify|moto|bici|parking|avión|vuelo/.test(n))
      return { emoji: '🚗', bg: 'bg-sky-50' };
    if (/ocio|cine|fiesta|discoteca|entretenimiento|juego|netflix|spotify|suscripci/.test(n))
      return { emoji: '🎉', bg: 'bg-purple-50' };
    if (/salud|farmacia|médico|doctor|gym|deporte|sport|vitam|clínica|dentista/.test(n))
      return { emoji: '💊', bg: 'bg-emerald-50' };
    if (/ropa|moda|zapato|tienda|zara|primark|fashion/.test(n))
      return { emoji: '👗', bg: 'bg-pink-50' };
    if (/tecno|móvil|movil|ordenador|laptop|gadget|electr|amazon/.test(n))
      return { emoji: '💻', bg: 'bg-cyan-50' };
    if (/casa|hogar|alquiler|hipoteca|mueble|ikea|luz|agua|factura/.test(n))
      return { emoji: '🏠', bg: 'bg-amber-50' };
    if (/viaje|hotel|vacacion|airbnb|booking|turismo/.test(n))
      return { emoji: '✈️', bg: 'bg-blue-50' };
    if (/libro|estudio|curso|formaci|educaci|universid|colegio/.test(n))
      return { emoji: '📚', bg: 'bg-indigo-50' };
    if (/regalo|chuche|dulce|juguete|golosin/.test(n))
      return { emoji: '🎁', bg: 'bg-rose-50' };
    return { emoji: '💸', bg: 'bg-violet-50' };
  }

  function getIncomeStyle(concept) {
    const n = (concept || '').toLowerCase();
    if (/nómin|nomina|sueldo|salario/.test(n))  return { emoji: '💼', bg: 'bg-emerald-50' };
    if (/bizum|transferencia|ingreso/.test(n))   return { emoji: '📲', bg: 'bg-emerald-50' };
    if (/regalo|propina/.test(n))                return { emoji: '🎁', bg: 'bg-teal-50' };
    if (/venta|vendido/.test(n))                 return { emoji: '🛒', bg: 'bg-teal-50' };
    if (/devolución|devolucion|reembolso/.test(n)) return { emoji: '↩️', bg: 'bg-teal-50' };
    return { emoji: '💰', bg: 'bg-emerald-50' };
  }

  /* -----------------------------------------------------------
     3. MODO (Gasto / Ingreso)
     ----------------------------------------------------------- */
  function setMode(mode) {
    state.mode = mode;

    const btnExpense  = $('btn-mode-expense');
    const btnIncome   = $('btn-mode-income');
    const labelCat    = $('label-category');
    const inputCat    = $('input-category');
    const btnReg      = $('btn-register');
    const btnRegText  = $('btn-register-text');

    if (mode === 'income') {
      btnExpense.classList.remove('is-active');
      btnIncome.classList.add('is-active', 'income-active');
      labelCat.textContent   = 'Concepto (opcional)';
      inputCat.placeholder   = 'Nómina, Bizum, Regalo, Venta…';
      btnReg.classList.add('is-income');
      btnRegText.textContent = 'Añadir ingreso';
    } else {
      btnIncome.classList.remove('is-active', 'income-active');
      btnExpense.classList.add('is-active');
      labelCat.textContent   = '¿En qué lo has gastado?';
      inputCat.placeholder   = 'Comida, Taxi, Ocio, Ropa…';
      btnReg.classList.remove('is-income');
      btnRegText.textContent = 'Añadir gasto';
    }
  }

  /* -----------------------------------------------------------
     4. RENDERIZADO
     ----------------------------------------------------------- */
  function renderBalance() {
    const input = $('input-balance');
    if (document.activeElement !== input) {
      input.value = state.balance ? state.balance.toFixed(2) : '';
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
      if (pct > 80)      bar.style.background = 'linear-gradient(90deg,#be123c,#f43f5e)';
      else if (pct > 50) bar.style.background = 'linear-gradient(90deg,#f59e0b,#f97316)';
      else               bar.style.background = 'linear-gradient(90deg,#10b981,#06b6d4)';
    }
    if (pctEl) pctEl.textContent = pct.toFixed(0) + '%';
  }

  function renderExpenses() {
    const list    = $('expense-list');
    const empty   = $('empty-state');
    const countEl = $('expense-count');
    list.innerHTML = '';

    // Unir gastos e ingresos en una sola lista ordenada por fecha
    const movements = [
      ...state.expenses.map((e) => ({ ...e, _type: 'expense' })),
      ...state.incomes.map((i)  => ({ ...i, _type: 'income'  })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const n = movements.length;
    if (countEl) countEl.textContent = `${n} movimiento${n !== 1 ? 's' : ''}`;

    if (n === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    movements.forEach((mov) => {
      const isIncome = mov._type === 'income';
      const style    = isIncome
        ? getIncomeStyle(mov.concept || mov.category)
        : getCategoryStyle(mov.category);

      const label = isIncome
        ? (mov.concept || 'Ingreso')
        : mov.category;

      const amountHtml = isIncome
        ? `<span class="income-chip">+€${mov.amount.toFixed(2)}</span>`
        : `<span class="font-black text-rose-500 text-sm">−€${mov.amount.toFixed(2)}</span>`;

      const li = document.createElement('li');
      li.className = 'expense-item';
      li.innerHTML = `
        <div class="expense-icon ${style.bg}">
          <span>${style.emoji}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-gray-900 truncate text-sm leading-tight">${escapeHtml(label)}</p>
          <p class="text-xs text-gray-400 mt-0.5 font-medium">${formatDate(mov.date)}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          ${amountHtml}
          <button
            data-id="${mov.id}"
            data-type="${mov._type}"
            class="btn-delete flex h-7 w-7 items-center justify-center rounded-full text-gray-300 transition active:bg-rose-50 active:text-rose-400"
            aria-label="Eliminar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  function renderAll() {
    renderBalance();
    renderExpenses();
  }

  /* -----------------------------------------------------------
     5. ACCIONES
     ----------------------------------------------------------- */
  function handleBalanceChange(e) {
    const value = parseFloat(e.target.value);
    state.balance = isNaN(value) ? 0 : value;
    saveBalance();
    renderBalance();
  }

  function handleRegister() {
    const amountInput   = $('input-amount');
    const categoryInput = $('input-category');
    const amount        = parseFloat(amountInput.value);
    const label         = categoryInput.value.trim();

    if (isNaN(amount) || amount <= 0) {
      showFeedback('Introduce una cantidad válida mayor que 0.', 'error');
      amountInput.focus();
      return;
    }

    if (state.mode === 'income') {
      // ── INGRESO: suma al saldo ──
      const income = {
        id:      Date.now(),
        amount,
        concept: label || 'Ingreso',
        date:    new Date().toISOString(),
      };
      state.incomes.push(income);
      state.balance += amount;

      saveIncomes();
      saveBalance();
      renderAll();

      amountInput.value   = '';
      categoryInput.value = '';
      amountInput.focus();
      showFeedback(`✓ +${formatMoney(amount)} añadido a tu saldo.`, 'ok');

    } else {
      // ── GASTO: resta del saldo ──
      if (!label) {
        showFeedback('Indica en qué te lo has gastado.', 'error');
        categoryInput.focus();
        return;
      }
      if (amount > state.balance) {
        showFeedback(`Saldo insuficiente. Solo tienes ${formatMoney(state.balance)}.`, 'error');
        amountInput.focus();
        return;
      }

      const expense = {
        id:       Date.now(),
        amount,
        category: label,
        date:     new Date().toISOString(),
      };
      state.expenses.push(expense);
      state.balance -= amount;

      saveExpenses();
      saveBalance();
      renderAll();

      amountInput.value   = '';
      categoryInput.value = '';
      amountInput.focus();
      showFeedback(`✓ ${formatMoney(amount)} en "${label}" registrado.`, 'ok');
    }
  }

  function handleDeleteMovement(id, type) {
    if (type === 'income') {
      const income = state.incomes.find((i) => i.id === id);
      if (!income) return;
      state.balance -= income.amount;
      state.incomes = state.incomes.filter((i) => i.id !== id);
      saveIncomes();
    } else {
      const expense = state.expenses.find((e) => e.id === id);
      if (!expense) return;
      state.balance += expense.amount;
      state.expenses = state.expenses.filter((e) => e.id !== id);
      saveExpenses();
    }
    saveBalance();
    renderAll();
  }

  function handleClearAll() {
    const total = state.expenses.length + state.incomes.length;
    if (total === 0) return;
    if (!confirm('¿Borrar todos los movimientos? El saldo no se modificará.')) return;
    state.expenses = [];
    state.incomes  = [];
    saveExpenses();
    saveIncomes();
    renderAll();
  }

  /* -----------------------------------------------------------
     6. NAVEGACIÓN (SPA)
     ----------------------------------------------------------- */
  function showPage(pageId) {
    document.querySelectorAll('.page').forEach((p) => {
      p.classList.add('hidden');
      p.classList.remove('flex');
    });
    const page = $(pageId);
    page.classList.remove('hidden');
    page.classList.add('flex');
    window.scrollTo(0, 0);
  }

  /* -----------------------------------------------------------
     7. CHAT
     ----------------------------------------------------------- */
  function addChatMessage(text, isUser = false) {
    const li = document.createElement('li');
    if (isUser) {
      li.className = 'chat-row-user';
      li.innerHTML = `<div class="bubble-user">${escapeHtml(text)}</div>`;
    } else {
      li.className = 'chat-row-bot';
      li.innerHTML = `
        <div class="bot-avatar-sm">⚡</div>
        <div class="bubble-bot">${escapeHtml(text)}</div>
      `;
    }
    $('chat-messages').appendChild(li);
    setTimeout(() => {
      const main = $('chat-messages').parentElement;
      main.scrollTop = main.scrollHeight;
    }, 80);
  }

  function showTypingIndicator() {
    const li = document.createElement('li');
    li.id = 'typing-indicator';
    li.className = 'chat-row-bot';
    li.innerHTML = `
      <div class="bot-avatar-sm">⚡</div>
      <div class="bubble-bot" style="padding:0.625rem 0.875rem">
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div>
    `;
    $('chat-messages').appendChild(li);
    setTimeout(() => {
      const main = $('chat-messages').parentElement;
      main.scrollTop = main.scrollHeight;
    }, 50);
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
      await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
      removeTypingIndicator();
      addChatMessage(generateSmartReply(message));
    } catch (err) {
      removeTypingIndicator();
      addChatMessage('⚠️ Algo salió mal. Vuelve a intentarlo.');
    } finally {
      $('btn-send-message').disabled = false;
      input.focus();
    }
  }

  function generateSmartReply(userMessage) {
    const msg     = userMessage.toLowerCase();
    const balance = state.balance;
    const spent   = getTotalSpent();
    const earned  = getTotalIncomes();
    const n       = state.expenses.length;
    const total   = balance + spent;
    const pct     = total > 0 ? (spent / total) * 100 : 0;

    const cats = {};
    state.expenses.forEach((e) => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    const sorted   = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const topCat   = sorted[0];
    const avgSpend = n > 0 ? spent / n : 0;

    if (/^(hola|buenas|hey|ola)/.test(msg) || msg === 'hola' || msg.includes('ayuda')) {
      return '👋 ¡Hola! Soy Flux AI. Puedo ayudarte con:\n• Resumen de gastos e ingresos\n• Consejos para ahorrar\n• Análisis por categoría\n• Estado de tu presupuesto\n\n¿Por dónde empezamos?';
    }

    if (msg.includes('gracias') || msg.includes('genial') || msg.includes('perfecto')) {
      return '😊 ¡De nada! Seguir así de consciente con tus finanzas es el primer paso para ahorrar más.';
    }

    if (msg.includes('qué puedes') || msg.includes('que puedes') || msg.includes('para qué')) {
      return '🤖 Soy tu asistente financiero. Puedo:\n\n• Analizar tus gastos e ingresos\n• Decirte dónde gastas más\n• Darte consejos personalizados\n• Calcular tu % de ahorro\n• Revisar tu presupuesto\n\nPrueba: "¿Cómo voy este mes?"';
    }

    if (msg.includes('ingreso') || msg.includes('he ganado') || msg.includes('he cobrado') || msg.includes('cuánto he ingresado')) {
      if (state.incomes.length === 0) return '📥 Aún no has registrado ningún ingreso. Usa el botón "💰 Ingreso" en la pantalla principal para añadirlos.';
      const conceptos = state.incomes.map((i) => `• ${i.concept}: +€${i.amount.toFixed(2)}`).join('\n');
      return `📥 Has registrado ${state.incomes.length} ingreso${state.incomes.length !== 1 ? 's' : ''} por un total de €${earned.toFixed(2)}:\n\n${conceptos}`;
    }

    if (msg.includes('consejo') || msg.includes('ahorrar') || msg.includes('mejorar')) {
      if (n === 0) return '💡 Sin gastos registrados aún.\n\nMi consejo: registra TODO lo que gastes esta semana. La conciencia es el primer paso para ahorrar.';
      let advice = pct > 75
        ? `⚠️ Llevas gastado el ${pct.toFixed(0)}% de tu presupuesto.\n\n`
        : `✅ Vas bien: ${pct.toFixed(0)}% del presupuesto consumido.\n\n`;
      advice += '💡 Mis consejos:\n';
      if (topCat) advice += `• "${topCat[0]}" es tu mayor gasto (€${topCat[1].toFixed(2)}). Reducirlo un 15% marcaría la diferencia.\n`;
      advice += `• Gasto medio por movimiento: €${avgSpend.toFixed(2)}.\n`;
      advice += pct > 75 ? '• Frena los gastos no esenciales hasta fin de mes.' : '• Mantén este ritmo y transfiere lo sobrante a ahorro.';
      return advice;
    }

    if (msg.includes('categoría') || msg.includes('categoria') || msg.includes('gasto') || msg.includes('resumen')) {
      if (n === 0) return '📊 Aún no hay gastos. ¡Añade el primero!';
      let report = `📊 Resumen de ${n} gasto${n !== 1 ? 's' : ''}:\n\n`;
      sorted.forEach(([cat, amt]) => {
        report += `• ${cat}: €${amt.toFixed(2)} (${((amt / spent) * 100).toFixed(0)}%)\n`;
      });
      report += `\nTotal gastado: €${spent.toFixed(2)}`;
      if (earned > 0) report += `\nTotal ingresos: +€${earned.toFixed(2)}`;
      return report;
    }

    if (msg.includes('saldo') || msg.includes('dinero') || msg.includes('balance') || msg.includes('cómo voy') || msg.includes('como voy')) {
      if (total === 0 && earned === 0) return '💰 Configura tu saldo en la pantalla principal para que pueda ayudarte mejor.';
      let reply = `💰 Tu situación financiera:\n\n• Disponible ahora: €${balance.toFixed(2)}\n• Total gastado: €${spent.toFixed(2)}\n`;
      if (earned > 0) reply += `• Total ingresos: +€${earned.toFixed(2)}\n`;
      reply += `• Presupuesto consumido: ${pct.toFixed(1)}%\n\n`;
      reply += pct > 80 ? '⚠️ Estás usando mucho presupuesto. Ten cuidado.' : pct > 50 ? '🟡 A mitad de presupuesto. Modera los gastos.' : '🟢 Buen ritmo. Sigues con margen.';
      return reply;
    }

    if (msg.includes('mayor') || msg.includes('más gasto') || msg.includes('top')) {
      if (!topCat) return '📈 Sin datos suficientes aún. ¡Registra tus gastos!';
      return `🏆 Tu mayor gasto es "${topCat[0]}" con €${topCat[1].toFixed(2)}.\n\n${sorted.length > 1 ? `El segundo es "${sorted[1][0]}" con €${sorted[1][1].toFixed(2)}.` : ''}\n\nAhí es donde más puedes ahorrar.`;
    }

    if (msg.includes('tendencia') || msg.includes('patrón') || msg.includes('promedio')) {
      if (n < 2) return '📈 Necesito al menos 2 gastos para analizar tendencias.';
      return `📈 Análisis:\n\n• ${n} gastos registrados\n• Promedio por movimiento: €${avgSpend.toFixed(2)}\n• Total gastado: €${spent.toFixed(2)}\n• Categorías distintas: ${sorted.length}`;
    }

    return '🤔 No he entendido bien. Puedes preguntarme:\n\n• "¿Cómo voy este mes?"\n• "Consejos para ahorrar"\n• "Resumen de gastos"\n• "¿Cuánto he ingresado?"\n• "¿Cuál es mi mayor gasto?"';
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
    setTimeout(() => $('report-email').focus(), 120);
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
    const emailInput = $('report-email');
    const email = emailInput.value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailInput.style.borderColor = '#f43f5e';
      emailInput.focus();
      setTimeout(() => { emailInput.style.borderColor = ''; }, 2000);
      return;
    }

    const [year, month] = $('report-month').value.split('-').map(Number);
    const monthLabel = new Date(year, month, 1)
      .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

    showReportState('loading');
    setLoadingText('Filtrando datos del mes…');

    try {
      // 1. Filter data
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

      // 2. AI analysis
      setLoadingText('Analizando con IA…');
      let aiAnalysis = null;
      try {
        aiAnalysis = await getMonthlyAIAnalysis(monthLabelCap, mExp, mInc, cats, totalSpent, totalIncome);
      } catch (_) { /* AI optional */ }

      // 3. Charts
      setLoadingText('Generando gráficos…');
      let catChartImg  = null;
      let dailyChartImg = null;
      if (sortedCats.length > 0) {
        try { catChartImg  = await renderCategoryChart(sortedCats); } catch (_) {}
        try { dailyChartImg = await renderDailyChart(mExp, month, year); } catch (_) {}
      }

      // 4. Build PDF
      setLoadingText('Creando PDF…');
      const pdfBase64 = buildReportPDF({
        monthLabel: monthLabelCap,
        totalSpent, totalIncome, netBalance,
        sortedCats, mExp, mInc,
        catChartImg, dailyChartImg, aiAnalysis,
      });

      // 5. Send email
      setLoadingText('Enviando a ' + email + '…');
      const resp = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pdfBase64, monthLabel: monthLabelCap }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al enviar el email');
      }

      $('report-success-email').textContent = email;
      showReportState('success');

    } catch (err) {
      console.error('Report error:', err);
      $('report-error-msg').textContent = err.message || 'Error desconocido. Inténtalo de nuevo.';
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

  // ── Chart helpers ─────────────────────────────────────────────
  const PALETTE = [
    '#6366f1','#8b5cf6','#ec4899','#f43f5e',
    '#f97316','#f59e0b','#10b981','#06b6d4',
    '#3b82f6','#a855f7',
  ];

  function hexToRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }

  function renderChartToImage(config, width, height) {
    return new Promise((resolve, reject) => {
      if (typeof Chart === 'undefined') { reject(new Error('Chart.js no cargado')); return; }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
      document.body.appendChild(canvas);

      const chart = new Chart(canvas.getContext('2d'), {
        ...config,
        options: {
          ...(config.options || {}),
          animation:       false,
          responsive:      false,
          devicePixelRatio: 2,
        },
      });

      setTimeout(() => {
        try {
          const img = canvas.toDataURL('image/png');
          chart.destroy();
          document.body.removeChild(canvas);
          resolve(img);
        } catch (e) {
          chart.destroy();
          document.body.removeChild(canvas);
          reject(e);
        }
      }, 150);
    });
  }

  function renderCategoryChart(sortedCats) {
    const top    = sortedCats.slice(0, 7);
    const labels = top.map(([cat]) => cat.length > 14 ? cat.slice(0, 13) + '…' : cat);
    const data   = top.map(([, amt]) => amt);
    const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

    return renderChartToImage({
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#fff',
          hoverOffset: 6,
        }],
      },
      options: {
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { size: 13 },
              padding: 14,
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
        },
        cutout: '58%',
      },
    }, 480, 340);
  }

  function renderDailyChart(expenses, month, year) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
    const data   = new Array(daysInMonth).fill(0);
    expenses.forEach((e) => { data[new Date(e.date).getDate() - 1] += e.amount; });

    return renderChartToImage({
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Gasto (€)',
          data,
          backgroundColor: data.map((v) => v > 0 ? 'rgba(99,102,241,0.85)' : 'rgba(99,102,241,0.12)'),
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, maxRotation: 0 },
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.06)' },
            ticks: { font: { size: 10 }, callback: (v) => '€' + v },
          },
        },
      },
    }, 700, 260);
  }

  // ── PDF builder ───────────────────────────────────────────────
  function buildReportPDF({ monthLabel, totalSpent, totalIncome, netBalance, sortedCats, mExp, mInc, catChartImg, dailyChartImg, aiAnalysis }) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    const W   = 210;
    const mg  = 14;
    const cW  = W - 2 * mg;
    let   y   = 0;

    // ── helpers ────────────────────────────
    function fill(x, yy, w, h, r, ...rgb) {
      doc.setFillColor(...rgb);
      r > 0 ? doc.roundedRect(x, yy, w, h, r, r, 'F') : doc.rect(x, yy, w, h, 'F');
    }

    function txt(t, x, yy, { size = 10, rgb = [31, 41, 55], align = 'left', bold = false } = {}) {
      doc.setFontSize(size);
      doc.setTextColor(...rgb);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const str = String(t).replace(/[-￿]/g, (c) => {
        const code = c.charCodeAt(0);
        if (code <= 0xFF) return c;
        const map = { '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '•': '-', '…': '...' };
        return map[c] || '';
      });
      doc.text(str, x, yy, { align });
    }

    function newPageIfNeeded(needed = 20) {
      if (y + needed > 282) {
        doc.addPage();
        y = 16;
      }
    }

    // ── HEADER ────────────────────────────────────────────────
    fill(0, 0, W, 52, 0, 55, 48, 163);
    fill(0, 0, W, 52, 0, 79, 70, 229);
    // decorative orb
    doc.setFillColor(255, 255, 255);
    doc.setGState(doc.GState({ opacity: 0.06 }));
    doc.circle(W - 20, -10, 55, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));

    txt('Flux', mg, 19, { size: 22, rgb: [255, 255, 255], bold: true });
    txt('Finanzas Personales', mg, 26, { size: 8, rgb: [196, 198, 255] });
    txt('Informe Mensual', mg, 37, { size: 16, rgb: [255, 255, 255], bold: true });
    txt(monthLabel, mg, 45, { size: 10, rgb: [196, 198, 255] });

    const genDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    txt('Generado el ' + genDate, W - mg, 45, { size: 7.5, rgb: [196, 198, 255], align: 'right' });

    y = 60;

    // ── SUMMARY CARDS ─────────────────────────────────────────
    const crdW = (cW - 4) / 3;

    // Ingresos (verde)
    fill(mg, y, crdW, 24, 4, 4, 120, 87);
    txt('INGRESOS', mg + crdW / 2, y + 7.5, { size: 6.5, rgb: [200, 255, 230], align: 'center', bold: true });
    txt('+€' + totalIncome.toFixed(2), mg + crdW / 2, y + 16, { size: 12, rgb: [255, 255, 255], align: 'center', bold: true });

    // Gastos (rojo)
    const x2 = mg + crdW + 2;
    fill(x2, y, crdW, 24, 4, 190, 18, 60);
    txt('GASTOS', x2 + crdW / 2, y + 7.5, { size: 6.5, rgb: [255, 210, 218], align: 'center', bold: true });
    txt('-€' + totalSpent.toFixed(2), x2 + crdW / 2, y + 16, { size: 12, rgb: [255, 255, 255], align: 'center', bold: true });

    // Balance neto
    const x3 = mg + 2 * (crdW + 2);
    const isPos = netBalance >= 0;
    fill(x3, y, crdW, 24, 4, ...(isPos ? [4, 120, 87] : [190, 18, 60]));
    txt('BALANCE NETO', x3 + crdW / 2, y + 7.5, { size: 6.5, rgb: isPos ? [200, 255, 230] : [255, 210, 218], align: 'center', bold: true });
    txt((isPos ? '+' : '') + '€' + netBalance.toFixed(2), x3 + crdW / 2, y + 16, { size: 12, rgb: [255, 255, 255], align: 'center', bold: true });

    y += 32;

    // ── CATEGORY CHART + LIST ─────────────────────────────────
    if (catChartImg && sortedCats.length > 0) {
      txt('GASTOS POR CATEGORIA', mg, y, { size: 7.5, rgb: [156, 163, 175], bold: true });
      y += 4;

      const chartW = 78;
      const chartH = 66;
      doc.addImage(catChartImg, 'PNG', mg, y, chartW, chartH);

      // Category list right side
      const lx = mg + chartW + 6;
      const lW = cW - chartW - 6;
      let   ly = y + 4;

      sortedCats.slice(0, 7).forEach(([cat, amt], i) => {
        const pct    = totalSpent > 0 ? (amt / totalSpent) * 100 : 0;
        const rgb    = hexToRgb(PALETTE[i % PALETTE.length]);

        doc.setFillColor(...rgb);
        doc.circle(lx + 2, ly - 1, 1.5, 'F');

        const catLabel = cat.length > 20 ? cat.slice(0, 19) + '…' : cat;
        txt(catLabel, lx + 5.5, ly, { size: 8 });
        txt('€' + amt.toFixed(2), lx + lW, ly, { size: 8, bold: true, align: 'right' });

        const barY = ly + 1.8;
        const barH = 2.4;
        fill(lx, barY, lW, barH, 1.2, 243, 244, 246);
        fill(lx, barY, Math.max(lW * pct / 100, 0.5), barH, 1.2, ...rgb);

        txt(pct.toFixed(0) + '%', lx + lW, ly + 6.5, { size: 6.5, rgb: [156, 163, 175], align: 'right' });
        ly += 10;
      });

      y += chartH + 6;
    } else if (mExp.length === 0) {
      fill(mg, y, cW, 18, 4, 243, 244, 246);
      txt('Sin gastos registrados en ' + monthLabel, W / 2, y + 11, { size: 9, rgb: [156, 163, 175], align: 'center' });
      y += 24;
    }

    // ── DAILY CHART ───────────────────────────────────────────
    if (dailyChartImg && mExp.length > 0) {
      newPageIfNeeded(55);
      txt('EVOLUCION DIARIA DE GASTOS', mg, y, { size: 7.5, rgb: [156, 163, 175], bold: true });
      y += 4;
      const dailyH = 46;
      doc.addImage(dailyChartImg, 'PNG', mg, y, cW, dailyH);
      y += dailyH + 7;
    }

    // ── TOP TRANSACTIONS ──────────────────────────────────────
    if (mExp.length > 0) {
      newPageIfNeeded(40);
      txt('TOP GASTOS DEL MES', mg, y, { size: 7.5, rgb: [156, 163, 175], bold: true });
      y += 5;

      const topExp = [...mExp].sort((a, b) => b.amount - a.amount).slice(0, 5);
      topExp.forEach((e, i) => {
        const rowY = y + i * 9;
        newPageIfNeeded(12);
        if (i % 2 === 0) fill(mg, rowY - 3.5, cW, 9, 2, 249, 250, 251);
        txt((i + 1) + '.', mg + 2, rowY + 2, { size: 7, rgb: [156, 163, 175] });
        const catLabel = e.category.length > 35 ? e.category.slice(0, 34) + '…' : e.category;
        txt(catLabel, mg + 10, rowY + 2, { size: 8.5 });
        const dateStr = new Date(e.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        txt(dateStr, W - mg - 28, rowY + 2, { size: 7.5, rgb: [156, 163, 175] });
        txt('€' + e.amount.toFixed(2), W - mg, rowY + 2, { size: 9, bold: true, rgb: [244, 63, 94], align: 'right' });
      });
      y += topExp.length * 9 + 6;
    }

    // ── AI ANALYSIS ───────────────────────────────────────────
    if (aiAnalysis) {
      const cleanAI = (s) => s.replace(/[Ā-￿]/g, (c) => {
        const map = { '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '•': '-', '…': '...' };
        return map[c] || '';
      }).replace(/\*/g, '').trim();

      const posMatch = aiAnalysis.match(/POSITIVOS:?\s*([\s\S]*?)(?=MEJORAS:|$)/i);
      const mejMatch = aiAnalysis.match(/MEJORAS:?\s*([\s\S]*?)$/i);
      const posText  = posMatch ? cleanAI(posMatch[1]) : '';
      const mejText  = mejMatch ? cleanAI(mejMatch[1]) : '';

      if (posText || mejText) {
        newPageIfNeeded(20);
        txt('ANALISIS INTELIGENTE — FLUX AI', mg, y, { size: 7.5, rgb: [156, 163, 175], bold: true });
        y += 5;

        if (posText) {
          const lines = doc.splitTextToSize(posText, cW - 12);
          const bH    = lines.length * 4.6 + 14;
          newPageIfNeeded(bH + 4);
          fill(mg, y, cW, bH, 4, 236, 253, 245);
          fill(mg, y, 3.5, bH, 2, 16, 185, 129);
          txt('Lo mejor de este mes', mg + 8, y + 8, { size: 9, rgb: [5, 150, 105], bold: true });
          const subLines = doc.splitTextToSize(posText, cW - 12);
          subLines.forEach((line, i) => {
            txt(line, mg + 8, y + 14.5 + i * 4.6, { size: 8.5, rgb: [55, 65, 81] });
          });
          y += bH + 5;
        }

        if (mejText) {
          const lines = doc.splitTextToSize(mejText, cW - 12);
          const bH    = lines.length * 4.6 + 14;
          newPageIfNeeded(bH + 4);
          fill(mg, y, cW, bH, 4, 255, 247, 237);
          fill(mg, y, 3.5, bH, 2, 245, 158, 11);
          txt('Areas de mejora', mg + 8, y + 8, { size: 9, rgb: [180, 83, 9], bold: true });
          const subLines = doc.splitTextToSize(mejText, cW - 12);
          subLines.forEach((line, i) => {
            txt(line, mg + 8, y + 14.5 + i * 4.6, { size: 8.5, rgb: [55, 65, 81] });
          });
          y += bH + 5;
        }
      }
    }

    // ── FOOTER ────────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.3);
      doc.line(mg, 287, W - mg, 287);
      txt(
        'Flux Finanzas Personales  ·  Informe generado automaticamente  ·  Pagina ' + p + ' de ' + totalPages,
        W / 2, 293,
        { size: 7, rgb: [156, 163, 175], align: 'center' },
      );
    }

    // Return base64 string (strip data URI prefix)
    return doc.output('datauristring').replace(/^data:[^;]+;base64,/, '');
  }

  /* -----------------------------------------------------------
     9. INICIALIZACIÓN + LISTENERS
     ----------------------------------------------------------- */
  function init() {
    loadState();
    renderAll();

    $('input-balance').addEventListener('input', handleBalanceChange);
    $('btn-register').addEventListener('click', handleRegister);
    $('input-category').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleRegister();
    });

    // Toggle de modo
    $('btn-mode-expense').addEventListener('click', () => setMode('expense'));
    $('btn-mode-income').addEventListener('click',  () => setMode('income'));

    $('btn-go-expenses').addEventListener('click', () => showPage('page-expenses'));
    $('btn-back').addEventListener('click',        () => showPage('page-home'));
    $('btn-go-home').addEventListener('click',     () => showPage('page-home'));
    $('btn-clear').addEventListener('click', handleClearAll);

    // Eliminar movimiento (gasto o ingreso)
    $('expense-list').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-delete');
      if (btn) handleDeleteMovement(Number(btn.dataset.id), btn.dataset.type);
    });

    $('btn-go-chat').addEventListener('click',    () => showPage('page-chat'));
    $('btn-back-chat').addEventListener('click',  () => showPage('page-expenses'));
    $('btn-send-message').addEventListener('click', handleSendMessage);
    $('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    // ── Informe mensual ──
    $('btn-open-report').addEventListener('click',    openReportModal);
    $('btn-close-modal').addEventListener('click',    closeReportModal);
    $('modal-backdrop').addEventListener('click',     closeReportModal);
    $('btn-generate-report').addEventListener('click', handleGenerateReport);
    $('btn-close-success').addEventListener('click',  closeReportModal);
    $('btn-retry-report').addEventListener('click',   () => showReportState('form'));
    $('btn-cancel-report').addEventListener('click',  closeReportModal);

    $('report-email').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleGenerateReport();
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
