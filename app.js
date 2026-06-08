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
  };

  const state = {
    balance:  0,
    expenses: [],
  };

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEYS.balance);
    state.balance = raw !== null ? parseFloat(raw) : 0;
    try {
      state.expenses = JSON.parse(localStorage.getItem(STORAGE_KEYS.expenses) || '[]');
    } catch {
      state.expenses = [];
    }
  }

  function saveBalance()  { localStorage.setItem(STORAGE_KEYS.balance,  String(state.balance)); }
  function saveExpenses() { localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(state.expenses)); }

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

  /* Detecta categoría y devuelve emoji + clase de fondo */
  function getCategoryStyle(name) {
    const n = (name || '').toLowerCase();
    if (/comida|restaur|cafe|café|super|merce|hambur|pizza|kebab|sushi|cena|almuerzo|desayuno|menú|bar/.test(n))
      return { emoji: '🍔', bg: 'bg-orange-50',  text: 'text-orange-500' };
    if (/trans|bus|metro|taxi|coche|gasolina|tren|uber|cabify|moto|bici|parking|avión|vuelo/.test(n))
      return { emoji: '🚗', bg: 'bg-sky-50',     text: 'text-sky-500' };
    if (/ocio|cine|fiesta|discoteca|entretenimiento|juego|netflix|spotify|suscripci/.test(n))
      return { emoji: '🎉', bg: 'bg-purple-50',  text: 'text-purple-500' };
    if (/salud|farmacia|médico|doctor|gym|deporte|sport|vitam|clínica|dentista/.test(n))
      return { emoji: '💊', bg: 'bg-emerald-50', text: 'text-emerald-500' };
    if (/ropa|moda|zapato|tienda|zara|primark|fashion/.test(n))
      return { emoji: '👗', bg: 'bg-pink-50',    text: 'text-pink-500' };
    if (/tecno|móvil|movil|ordenador|laptop|gadget|electr|amazon/.test(n))
      return { emoji: '💻', bg: 'bg-cyan-50',    text: 'text-cyan-500' };
    if (/casa|hogar|alquiler|hipoteca|mueble|ikea|luz|agua|factura/.test(n))
      return { emoji: '🏠', bg: 'bg-amber-50',   text: 'text-amber-500' };
    if (/viaje|hotel|vacacion|airbnb|booking|turismo/.test(n))
      return { emoji: '✈️', bg: 'bg-blue-50',    text: 'text-blue-500' };
    if (/libro|estudio|curso|formaci|educaci|universid|colegio/.test(n))
      return { emoji: '📚', bg: 'bg-indigo-50',  text: 'text-indigo-500' };
    if (/regalo|chuche|dulce|juguete|golosin/.test(n))
      return { emoji: '🎁', bg: 'bg-rose-50',    text: 'text-rose-500' };
    return { emoji: '💸', bg: 'bg-violet-50', text: 'text-violet-500' };
  }

  /* -----------------------------------------------------------
     3. RENDERIZADO
     ----------------------------------------------------------- */
  function renderBalance() {
    const input = $('input-balance');
    if (document.activeElement !== input) {
      input.value = state.balance ? state.balance.toFixed(2) : '';
    }
    $('summary-balance').textContent = formatMoney(state.balance);
    $('summary-spent').textContent   = formatMoney(getTotalSpent());

    // Barra de progreso
    const spent = getTotalSpent();
    const total = state.balance + spent;
    const pct   = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
    const bar   = $('budget-bar');
    const pctEl = $('budget-pct');

    if (bar) {
      bar.style.width = pct.toFixed(1) + '%';
      if (pct > 80) {
        bar.style.background = 'linear-gradient(90deg,#be123c,#f43f5e)';
      } else if (pct > 50) {
        bar.style.background = 'linear-gradient(90deg,#f59e0b,#f97316)';
      } else {
        bar.style.background = 'linear-gradient(90deg,#10b981,#06b6d4)';
      }
    }
    if (pctEl) pctEl.textContent = pct.toFixed(0) + '%';
  }

  function renderExpenses() {
    const list    = $('expense-list');
    const empty   = $('empty-state');
    const countEl = $('expense-count');
    list.innerHTML = '';

    const n = state.expenses.length;
    if (countEl) countEl.textContent = `${n} movimiento${n !== 1 ? 's' : ''}`;

    if (n === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    [...state.expenses].reverse().forEach((expense) => {
      const style = getCategoryStyle(expense.category);
      const li = document.createElement('li');
      li.className = 'expense-item';
      li.innerHTML = `
        <div class="expense-icon ${style.bg}">
          <span>${style.emoji}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-gray-900 truncate text-sm leading-tight">${escapeHtml(expense.category)}</p>
          <p class="text-xs text-gray-400 mt-0.5 font-medium">${formatDate(expense.date)}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="font-black text-rose-500 text-sm">−€${expense.amount.toFixed(2)}</span>
          <button
            data-id="${expense.id}"
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
     4. ACCIONES
     ----------------------------------------------------------- */
  function handleBalanceChange(e) {
    const value = parseFloat(e.target.value);
    state.balance = isNaN(value) ? 0 : value;
    saveBalance();
    renderBalance();
  }

  function handleRegisterExpense() {
    const amountInput   = $('input-amount');
    const categoryInput = $('input-category');
    const amount        = parseFloat(amountInput.value);
    const category      = categoryInput.value.trim();

    if (isNaN(amount) || amount <= 0) {
      showFeedback('Introduce una cantidad válida mayor que 0.', 'error');
      amountInput.focus();
      return;
    }
    if (!category) {
      showFeedback('Indica en qué te lo has gastado.', 'error');
      categoryInput.focus();
      return;
    }

    const expense = { id: Date.now(), amount, category, date: new Date().toISOString() };
    state.expenses.push(expense);
    state.balance -= amount;

    saveExpenses();
    saveBalance();
    renderAll();

    amountInput.value   = '';
    categoryInput.value = '';
    amountInput.focus();

    showFeedback(`✓ ${formatMoney(amount)} en "${category}" registrado.`, 'ok');
  }

  function handleDeleteExpense(id) {
    const expense = state.expenses.find((e) => e.id === id);
    if (!expense) return;
    state.balance += expense.amount;
    state.expenses = state.expenses.filter((e) => e.id !== id);
    saveExpenses();
    saveBalance();
    renderAll();
  }

  function handleClearAll() {
    if (state.expenses.length === 0) return;
    if (!confirm('¿Borrar todos los gastos? El saldo no se modificará.')) return;
    state.expenses = [];
    saveExpenses();
    renderAll();
  }

  /* -----------------------------------------------------------
     5. NAVEGACIÓN (SPA)
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
     6. CHAT
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
      const reply = generateSmartReply(message);
      addChatMessage(reply);
    } catch (err) {
      removeTypingIndicator();
      console.error(err);
      addChatMessage('⚠️ Algo salió mal. Vuelve a intentarlo.');
    } finally {
      $('btn-send-message').disabled = false;
      input.focus();
    }
  }

  function generateSmartReply(userMessage) {
    const msg      = userMessage.toLowerCase();
    const balance  = state.balance;
    const spent    = getTotalSpent();
    const n        = state.expenses.length;
    const total    = balance + spent;
    const pct      = total > 0 ? (spent / total) * 100 : 0;

    // Agrupar por categoría
    const cats = {};
    state.expenses.forEach((e) => {
      cats[e.category] = (cats[e.category] || 0) + e.amount;
    });
    const sorted    = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const topCat    = sorted[0];
    const avgSpend  = n > 0 ? spent / n : 0;

    if (/^(hola|buenas|hey|qué tal|ola)/.test(msg) || msg === 'hola' || msg.includes('ayuda')) {
      return '👋 ¡Hola! Soy Flux AI. Puedo ayudarte con:\n• Resumen de tus gastos\n• Consejos para ahorrar\n• Análisis por categoría\n• Estado de tu presupuesto\n\n¿Por dónde empezamos?';
    }

    if (msg.includes('gracias') || msg.includes('genial') || msg.includes('perfecto')) {
      return '😊 ¡De nada! Estoy aquí cuando me necesites. Seguir así de consciente con tus gastos es el primer paso para ahorrar más.';
    }

    if (msg.includes('qué puedes') || msg.includes('que puedes') || msg.includes('para qué')) {
      return '🤖 Soy tu asistente financiero personal. Puedo:\n\n• Analizar tus patrones de gasto\n• Decirte dónde gastas más\n• Darte consejos personalizados\n• Calcular tu porcentaje de ahorro\n• Alertarte si gastas demasiado\n\nPrueba: "¿Cómo voy este mes?"';
    }

    if (msg.includes('consejo') || msg.includes('ahorrar') || msg.includes('mejorar')) {
      if (n === 0) {
        return '💡 Aún no tienes gastos registrados.\n\nMi consejo: empieza registrando TODO lo que gastes esta semana, por pequeño que sea. La conciencia es el primer paso para ahorrar.';
      }
      let advice = pct > 75
        ? `⚠️ Alerta: llevas gastado el ${pct.toFixed(0)}% de tu presupuesto.\n\n`
        : `✅ Vas bien: llevas el ${pct.toFixed(0)}% gastado.\n\n`;

      advice += '💡 Mis consejos para ti:\n';
      if (topCat) advice += `• "${topCat[0]}" es tu mayor gasto (€${topCat[1].toFixed(2)}). Intenta reducirlo un 15%.\n`;
      advice += `• Tu gasto medio por movimiento es €${avgSpend.toFixed(2)}.\n`;
      advice += pct > 75
        ? '• Pausa los gastos no esenciales hasta final de mes.'
        : '• Mantén este ritmo y transfiere lo sobrante a ahorro.';
      return advice;
    }

    if (msg.includes('categoría') || msg.includes('categoria') || msg.includes('gasto') || msg.includes('resumen')) {
      if (n === 0) return '📊 Aún no hay gastos registrados. ¡Añade el primero!';
      let report = `📊 Resumen de ${n} movimiento${n !== 1 ? 's' : ''}:\n\n`;
      sorted.forEach(([cat, amt]) => {
        const pctCat = ((amt / spent) * 100).toFixed(0);
        report += `• ${cat}: €${amt.toFixed(2)} (${pctCat}%)\n`;
      });
      report += `\nTotal gastado: €${spent.toFixed(2)}`;
      return report;
    }

    if (msg.includes('saldo') || msg.includes('dinero') || msg.includes('balance') || msg.includes('cómo voy') || msg.includes('como voy')) {
      if (total === 0) return '💰 Aún no has configurado tu saldo. Ve a la pantalla principal y escribe cuánto dinero tienes disponible.';
      return `💰 Tu situación financiera:\n\n• Disponible: €${balance.toFixed(2)}\n• Gastado: €${spent.toFixed(2)}\n• Total inicial: €${total.toFixed(2)}\n• Consumido: ${pct.toFixed(1)}%\n\n${pct > 80 ? '⚠️ Estás usando mucho presupuesto. Cuidado.' : pct > 50 ? '🟡 A mitad del presupuesto. Ve con cuidado.' : '🟢 Buen ritmo. Sigues con margen suficiente.'}`;
    }

    if (msg.includes('mayor') || msg.includes('más gasto') || msg.includes('mas gasto') || msg.includes('categoría mayor') || msg.includes('top')) {
      if (!topCat) return '📈 Sin datos suficientes aún. ¡Registra tus gastos!';
      return `🏆 Tu mayor gasto es "${topCat[0]}" con €${topCat[1].toFixed(2)}.\n\n${sorted.length > 1 ? `El segundo es "${sorted[1][0]}" con €${sorted[1][1].toFixed(2)}.` : ''}\n\nConcentrar el ahorro aquí tiene el mayor impacto.`;
    }

    if (msg.includes('tendencia') || msg.includes('patrón') || msg.includes('patron') || msg.includes('promedio')) {
      if (n < 2) return '📈 Necesito al menos 2 gastos para analizar tendencias. ¡Sigue registrando!';
      return `📈 Análisis de tendencias:\n\n• ${n} movimientos registrados\n• Gasto promedio: €${avgSpend.toFixed(2)} por movimiento\n• Total gastado: €${spent.toFixed(2)}\n• Categorías distintas: ${sorted.length}\n\n${sorted.length > 1 ? `Gastas en ${sorted.length} categorías. Diversificar está bien, pero controla "${topCat[0]}".` : 'Todos tus gastos van a una sola categoría.'}`;
    }

    return '🤔 No he entendido bien. Puedes preguntarme:\n\n• "¿Cómo voy este mes?"\n• "Consejos para ahorrar"\n• "Resumen de gastos"\n• "¿Cuál es mi mayor gasto?"\n• "¿Cuánto me queda?"';
  }

  /* -----------------------------------------------------------
     7. INICIALIZACIÓN + LISTENERS
     ----------------------------------------------------------- */
  function init() {
    loadState();
    renderAll();

    $('input-balance').addEventListener('input', handleBalanceChange);
    $('btn-register').addEventListener('click', handleRegisterExpense);
    $('input-category').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleRegisterExpense();
    });

    $('btn-go-expenses').addEventListener('click', () => showPage('page-expenses'));
    $('btn-back').addEventListener('click',        () => showPage('page-home'));
    $('btn-go-home').addEventListener('click',     () => showPage('page-home'));
    $('btn-clear').addEventListener('click', handleClearAll);

    $('expense-list').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-delete');
      if (btn) handleDeleteExpense(Number(btn.dataset.id));
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

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
