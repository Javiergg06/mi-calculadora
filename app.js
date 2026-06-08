/* ===========================================================
   APP.JS — Calculadora de gastos simple
   Estructura:
     1. Estado + persistencia (localStorage)
     2. Utilidades
     3. Renderizado
     4. Acciones (registrar gasto, borrar, etc.)
     5. Navegación entre vistas (SPA)
     6. Inicialización + listeners
   =========================================================== */

(function () {
  'use strict';

  /* -----------------------------------------------------------
     1. ESTADO + PERSISTENCIA
     ----------------------------------------------------------- */
  const STORAGE_KEYS = {
    balance: 'cg_balance',
    expenses: 'cg_expenses',
  };

  const state = {
    balance: 0, // dinero disponible
    expenses: [], // [{ id, amount, category, date }]
  };

  function loadState() {
    const rawBalance = localStorage.getItem(STORAGE_KEYS.balance);
    const rawExpenses = localStorage.getItem(STORAGE_KEYS.expenses);

    state.balance = rawBalance !== null ? parseFloat(rawBalance) : 0;

    try {
      state.expenses = rawExpenses ? JSON.parse(rawExpenses) : [];
    } catch (e) {
      console.warn('No se pudo leer el historial de gastos:', e);
      state.expenses = [];
    }
  }

  function saveBalance() {
    localStorage.setItem(STORAGE_KEYS.balance, String(state.balance));
  }

  function saveExpenses() {
    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(state.expenses));
  }

  /* -----------------------------------------------------------
     2. UTILIDADES
     ----------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);

  function formatMoney(value) {
    const num = Number(value) || 0;
    return '€' + num.toFixed(2);
  }

  function getTotalSpent() {
    return state.expenses.reduce((acc, e) => acc + e.amount, 0);
  }

  function showFeedback(message, type) {
    const el = $('feedback-msg');
    el.textContent = message;
    el.classList.remove('hidden', 'text-emerald-600', 'text-rose-600');
    el.classList.add(type === 'error' ? 'text-rose-600' : 'text-emerald-600');
    clearTimeout(showFeedback._t);
    showFeedback._t = setTimeout(() => el.classList.add('hidden'), 2500);
  }

  /* -----------------------------------------------------------
     3. RENDERIZADO
     ----------------------------------------------------------- */
  function renderBalance() {
    // Sincroniza el input de saldo (sólo si el usuario no lo está editando)
    const input = $('input-balance');
    if (document.activeElement !== input) {
      input.value = state.balance ? state.balance.toFixed(2) : '';
    }
    // Resumen de la página 2
    $('summary-balance').textContent = formatMoney(state.balance);
    $('summary-spent').textContent = formatMoney(getTotalSpent());
  }

  function renderExpenses() {
    const list = $('expense-list');
    const empty = $('empty-state');
    list.innerHTML = '';

    if (state.expenses.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    // Mostramos del más reciente al más antiguo
    [...state.expenses].reverse().forEach((expense) => {
      const li = document.createElement('li');
      li.className =
        'expense-item flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm';

      li.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg">🛍️</span>
          <div class="min-w-0">
            <p class="truncate font-semibold text-slate-800">${escapeHtml(expense.category)}</p>
            <p class="text-xs text-slate-400">${formatDate(expense.date)}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-rose-600">-${formatMoney(expense.amount)}</span>
          <button data-id="${expense.id}" class="btn-delete rounded-full p-1.5 text-slate-300 transition active:bg-slate-100 active:text-rose-500" aria-label="Eliminar">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
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
    const amountInput = $('input-amount');
    const categoryInput = $('input-category');

    const amount = parseFloat(amountInput.value);
    const category = categoryInput.value.trim();

    // Validaciones
    if (isNaN(amount) || amount <= 0) {
      showFeedback('Introduce una cantidad válida mayor que 0.', 'error');
      amountInput.focus();
      return;
    }
    if (!category) {
      showFeedback('Escribe en qué te lo has gastado.', 'error');
      categoryInput.focus();
      return;
    }

    // Crear y guardar el gasto
    const expense = {
      id: Date.now(),
      amount: amount,
      category: category,
      date: new Date().toISOString(),
    };
    state.expenses.push(expense);
    state.balance -= amount; // resta del saldo disponible

    saveExpenses();
    saveBalance();
    renderAll();

    // Limpiar formulario
    amountInput.value = '';
    categoryInput.value = '';
    amountInput.focus();

    showFeedback(`Gasto de ${formatMoney(amount)} registrado en "${category}".`, 'ok');
  }

  function handleDeleteExpense(id) {
    const expense = state.expenses.find((e) => e.id === id);
    if (!expense) return;
    // Devolvemos el importe al saldo al eliminar
    state.balance += expense.amount;
    state.expenses = state.expenses.filter((e) => e.id !== id);
    saveExpenses();
    saveBalance();
    renderAll();
  }

  function handleClearAll() {
    if (state.expenses.length === 0) return;
    const ok = confirm('¿Seguro que quieres borrar TODOS los gastos? El saldo no se modificará.');
    if (!ok) return;
    state.expenses = [];
    saveExpenses();
    renderAll();
  }

  /* -----------------------------------------------------------
     5. NAVEGACIÓN ENTRE VISTAS (SPA)
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
     6. INICIALIZACIÓN + LISTENERS
     ----------------------------------------------------------- */
  function init() {
    loadState();
    renderAll();

    // Saldo disponible (se guarda al escribir)
    $('input-balance').addEventListener('input', handleBalanceChange);

    // Registrar gasto
    $('btn-register').addEventListener('click', handleRegisterExpense);

    // Permitir registrar con "Enter" desde la categoría
    $('input-category').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleRegisterExpense();
    });

    // Navegación
    $('btn-go-expenses').addEventListener('click', () => showPage('page-expenses'));
    $('btn-go-home').addEventListener('click', () => showPage('page-home'));
    $('btn-back').addEventListener('click', () => showPage('page-home'));

    // Borrar todo
    $('btn-clear').addEventListener('click', handleClearAll);

    // Eliminar un gasto (delegación de eventos sobre la lista)
    $('expense-list').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-delete');
      if (btn) handleDeleteExpense(Number(btn.dataset.id));
    });

    // Registrar service worker para offline
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // Service worker no disponible, la app sigue funcionando sin offline
      });
    }

    // Chat
    $('btn-go-chat').addEventListener('click', () => showPage('page-chat'));
    $('btn-back-chat').addEventListener('click', () => showPage('page-expenses'));
    $('btn-send-message').addEventListener('click', handleSendMessage);
    $('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });
  }

  /* -----------------------------------------------------------
     7b. CHATBOT
     ----------------------------------------------------------- */
  function addChatMessage(text, isUser = false) {
    const li = document.createElement('li');
    li.className = `flex ${isUser ? 'justify-end' : 'justify-start'}`;

    const div = document.createElement('div');
    div.className = `max-w-xs rounded-2xl px-4 py-3 text-sm ${
      isUser ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-800'
    }`;
    div.textContent = text;

    li.appendChild(div);
    $('chat-messages').appendChild(li);

    // Auto scroll al final
    setTimeout(() => {
      const main = $('chat-messages').parentElement;
      main.scrollTop = main.scrollHeight;
    }, 100);
  }

  async function handleSendMessage() {
    const input = $('chat-input');
    const message = input.value.trim();

    if (!message) return;

    // Agregar mensaje del usuario
    addChatMessage(message, true);
    input.value = '';
    $('btn-send-message').disabled = true;

    try {
      // Preparar contexto de gastos
      const context = {
        balance: state.balance,
        totalSpent: getTotalSpent(),
        numExpenses: state.expenses.length,
        categories: {},
        expenses: state.expenses.slice(-10), // últimos 10 gastos
      };

      state.expenses.forEach((e) => {
        context.categories[e.category] = (context.categories[e.category] || 0) + e.amount;
      });

      // Llamar al endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          context: context,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      const data = await response.json();
      addChatMessage(data.reply || 'No pude procesar tu pregunta.');
    } catch (err) {
      console.error(err);
      addChatMessage('⚠️ Error al conectar con el asistente. Intenta más tarde.');
    } finally {
      $('btn-send-message').disabled = false;
      input.focus();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
