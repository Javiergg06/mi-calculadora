/* ===========================================================
   APP.JS — Flux · Finanzas Personales
   =========================================================== */

(function () {
  'use strict';

  /* -----------------------------------------------------------
     1. ESTADO + PERSISTENCIA
     ----------------------------------------------------------- */
  const KEYS = {
    accounts:  'fx_accounts',   // [{id, name}]
    active:    'fx_active',      // id de la cuenta activa
    // Claves antiguas (solo para migrar datos de una sola cuenta) ──
    balance:   'fx_balance',
    expenses:  'fx_expenses',
    incomes:   'fx_incomes',
    onboarded: 'fx_onboarded',
  };

  /* Cuentas (multicuenta) */
  let accounts = [];          // [{id, name}]
  let activeAccountId = null;

  // Clave de almacenamiento por cuenta: fx_<base>_<id>
  function accKey(base) { return 'fx_' + base + '_' + activeAccountId; }

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
    concept:  '',        // concepto/subcategoría elegido para el nuevo gasto
  };

  let keypadInput = ''; // cadena construida por el teclado numérico

  /* Subcategorías guardadas por el usuario, por categoría y POR CUENTA */
  let SUBCATS = {}; // { comida: ['Burger King', ...], ocio: [...], ... }
  function loadSubcats() {
    // Migración: subcategorías globales antiguas → cuenta activa (una sola vez)
    const legacy = localStorage.getItem('fx_subcats');
    if (legacy !== null && localStorage.getItem(accKey('subcats')) === null) {
      localStorage.setItem(accKey('subcats'), legacy);
      localStorage.removeItem('fx_subcats');
    }
    try { SUBCATS = JSON.parse(localStorage.getItem(accKey('subcats')) || '{}') || {}; }
    catch { SUBCATS = {}; }
  }
  function saveSubcats() { localStorage.setItem(accKey('subcats'), JSON.stringify(SUBCATS)); }
  function subcatsFor(key) { return Array.isArray(SUBCATS[key]) ? SUBCATS[key] : []; }

  /* Carga la lista de cuentas; migra datos antiguos la primera vez */
  function loadAccounts() {
    let list = null;
    try { list = JSON.parse(localStorage.getItem(KEYS.accounts) || 'null'); } catch { list = null; }

    if (!Array.isArray(list) || list.length === 0) {
      // Primera vez (o app vieja de una sola cuenta) → crea "Principal"
      const defId = 'main';
      accounts = [{ id: defId, name: 'Principal' }];
      localStorage.setItem(KEYS.accounts, JSON.stringify(accounts));
      activeAccountId = defId;
      localStorage.setItem(KEYS.active, defId);

      // Migrar datos antiguos (si existían) a la cuenta Principal
      const oldBalance = localStorage.getItem(KEYS.balance);
      if (oldBalance !== null) {
        localStorage.setItem('fx_balance_' + defId,  oldBalance);
        localStorage.setItem('fx_expenses_' + defId, localStorage.getItem(KEYS.expenses) || '[]');
        localStorage.setItem('fx_incomes_' + defId,  localStorage.getItem(KEYS.incomes)  || '[]');
        if (localStorage.getItem(KEYS.onboarded)) localStorage.setItem('fx_onboarded_' + defId, '1');
        localStorage.removeItem(KEYS.balance);
        localStorage.removeItem(KEYS.expenses);
        localStorage.removeItem(KEYS.incomes);
        localStorage.removeItem(KEYS.onboarded);
      }
    } else {
      accounts = list;
      activeAccountId = localStorage.getItem(KEYS.active) || accounts[0].id;
      if (!accounts.find(a => a.id === activeAccountId)) activeAccountId = accounts[0].id;
    }
  }

  function saveAccounts()        { localStorage.setItem(KEYS.accounts, JSON.stringify(accounts)); }
  function setActiveAccount(id)  { activeAccountId = id; localStorage.setItem(KEYS.active, id); }
  function activeAccount()       { return accounts.find(a => a.id === activeAccountId) || null; }

  function loadState() {
    const raw = localStorage.getItem(accKey('balance'));
    state.balance = raw !== null ? parseFloat(raw) : 0;
    try { state.expenses = JSON.parse(localStorage.getItem(accKey('expenses')) || '[]'); } catch { state.expenses = []; }
    try { state.incomes  = JSON.parse(localStorage.getItem(accKey('incomes'))  || '[]'); } catch { state.incomes  = []; }
  }

  function saveBalance()  { localStorage.setItem(accKey('balance'),  String(state.balance)); }
  function saveExpenses() { localStorage.setItem(accKey('expenses'), JSON.stringify(state.expenses)); }
  function saveIncomes()  { localStorage.setItem(accKey('incomes'),  JSON.stringify(state.incomes)); }

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
    const btnE      = $('btn-mode-expense');
    const btnI      = $('btn-mode-income');
    const catSel    = $('btn-category');
    const conceptPill = $('btn-concept');
    const conceptWrap = $('concept-input-wrap');
    const btn       = $('btn-register');
    const txt       = $('btn-register-text');

    if (mode === 'income') {
      btnE.classList.remove('seg-active');
      btnI.classList.add('seg-active', 'income-seg');
      catSel.classList.add('hidden');            // sin categoría en ingresos
      conceptPill.classList.add('hidden');       // sin subcategorías en ingresos
      conceptWrap.classList.remove('hidden');    // texto libre para el ingreso
      btn.classList.add('income-cta');
      txt.textContent     = 'Añadir ingreso';
    } else {
      btnI.classList.remove('seg-active', 'income-seg');
      btnE.classList.add('seg-active');
      catSel.classList.remove('hidden');
      conceptPill.classList.remove('hidden');    // pill de concepto/subcategoría
      conceptWrap.classList.add('hidden');
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
    // El concepto/subcategoría pertenece a la categoría anterior → se limpia
    state.concept = '';
    renderCategoryButton();
    renderConceptButton();
    closeCategorySheet();
  }

  /* -----------------------------------------------------------
     4c. CONCEPTO / SUBCATEGORÍAS (bottom sheet)
     ----------------------------------------------------------- */
  function renderConceptButton() {
    const el = $('concept-value');
    if (el) el.textContent = state.concept || 'Opcional';
  }

  function renderSubcatList() {
    const cat  = catByKey(state.category);
    const list = subcatsFor(cat.key);
    const ul   = $('subcat-list');
    if (list.length === 0) {
      ul.innerHTML = '<li class="subcat-empty">Aún no tienes subcategorías en ' + escapeHtml(cat.label) + '. Crea una arriba ☝️</li>';
      return;
    }
    ul.innerHTML = list.map((s) => `
      <li class="subcat-chip ${s === state.concept ? 'is-selected' : ''}" data-name="${escapeHtml(s)}">
        <span class="subcat-chip-label" data-pick="${escapeHtml(s)}">${escapeHtml(s)}</span>
        <button class="subcat-chip-del" data-del="${escapeHtml(s)}" aria-label="Eliminar subcategoría">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:13px;height:13px;pointer-events:none">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </li>`).join('');
  }

  function openConceptSheet() {
    const cat = catByKey(state.category);
    $('concept-sheet-title').textContent = 'Concepto · ' + cat.label;
    $('subcat-input').value = '';
    renderSubcatList();
    $('concept-sheet').classList.remove('hidden');
  }
  function closeConceptSheet() { $('concept-sheet').classList.add('hidden'); }

  function selectConcept(text) {
    state.concept = text;
    renderConceptButton();
    closeConceptSheet();
  }

  function addSubcat(name) {
    name = (name || '').trim();
    if (!name) { $('subcat-input').focus(); return; }
    const cat = catByKey(state.category);
    if (!Array.isArray(SUBCATS[cat.key])) SUBCATS[cat.key] = [];
    // Evitar duplicados (sin distinguir mayúsculas)
    const exists = SUBCATS[cat.key].find((s) => s.toLowerCase() === name.toLowerCase());
    if (!exists) { SUBCATS[cat.key].push(name); saveSubcats(); }
    selectConcept(exists || name); // selecciona y cierra
  }

  function deleteSubcat(name) {
    const cat = catByKey(state.category);
    SUBCATS[cat.key] = subcatsFor(cat.key).filter((s) => s !== name);
    saveSubcats();
    if (state.concept === name) { state.concept = ''; renderConceptButton(); }
    renderSubcatList();
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

  /* Controla si el historial está expandido o no */
  let listExpanded = false;
  let statsFilter  = 'all'; // 'all' | clave de categoría

  // Estado del calendario
  const calState = {
    year:  new Date().getFullYear(),
    month: new Date().getMonth(), // 0-indexado
    mode:  'active',              // 'active' | 'all'
    selectedDay: null,
  };
  let daySelToken   = 0;   // evita carreras al pedir consejos IA por día
  const dayTipCache = {};  // cachea el consejo de IA por día/modo

  /* Formatea la etiqueta del día (Hoy / Ayer / lun. 9 jun.) */
  function formatDayLabel(iso) {
    const d   = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString())       return 'Hoy';
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString('es-ES', sameYear
      ? { weekday: 'short', day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* Construye un <li> de movimiento */
  function buildMovCell(mov) {
    const isIncome = mov._t === 'income';
    let emoji, bg, name, sub;
    const time = new Date(mov.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (isIncome) {
      const s = getIncomStyle(mov.concept || '');
      emoji = s.emoji; bg = s.bg;
      name = mov.concept || 'Ingreso';
      sub  = time;
    } else {
      const { cat, concept } = resolveExpense(mov);
      emoji = cat.emoji; bg = catBg(cat.key);
      name  = concept || cat.label;
      sub   = (concept ? cat.label + ' · ' : '') + time;
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
        <button class="mov-delete" data-id="${mov.id}" data-type="${mov._t}" aria-label="Eliminar">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:16px;height:16px;pointer-events:none">
            <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>`;
    return li;
  }

  function renderMovements() {
    const list    = $('expense-list');
    const footer  = $('movements-footer');
    const empty   = $('empty-state');
    const countEl = $('expense-count');
    list.innerHTML   = '';
    if (footer) footer.innerHTML = '';

    const all = [
      ...state.expenses.map(e => ({ ...e, _t: 'expense' })),
      ...state.incomes.map(i  => ({ ...i, _t: 'income'  })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const n = all.length;
    if (countEl) countEl.textContent = `${n} movimiento${n !== 1 ? 's' : ''}`;

    if (n === 0) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    const toShow = listExpanded ? all : all.slice(0, 3);

    // Agrupar por día
    const dayMap = new Map();
    toShow.forEach(m => {
      const key = new Date(m.date).toDateString();
      if (!dayMap.has(key)) dayMap.set(key, { label: formatDayLabel(m.date), items: [] });
      dayMap.get(key).items.push(m);
    });

    // Renderizar grupos
    dayMap.forEach(({ label, items }) => {
      // Cabecera del día
      const headerLi = document.createElement('li');
      headerLi.className = 'mov-day-header';
      headerLi.textContent = label;
      list.appendChild(headerLi);

      // Tarjeta de items del día
      const groupLi = document.createElement('li');
      groupLi.className = 'mov-group';
      const inner = document.createElement('ul');
      inner.className = 'mov-group-inner';
      items.forEach(m => inner.appendChild(buildMovCell(m)));
      groupLi.appendChild(inner);
      list.appendChild(groupLi);
    });

    // Botón ver más / ver menos
    if (!footer) return;
    if (n > 3) {
      const btn = document.createElement('button');
      if (!listExpanded) {
        btn.className   = 'see-more-btn';
        btn.textContent = `Ver todos los movimientos · ${n - 3} más`;
        btn.addEventListener('click', () => { listExpanded = true;  renderMovements(); });
      } else {
        btn.className   = 'see-more-btn see-less-btn';
        btn.textContent = 'Ver menos';
        btn.addEventListener('click', () => { listExpanded = false; renderMovements(); });
      }
      footer.appendChild(btn);
    }
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

  /* -----------------------------------------------------------
     5a-ter. ESTADÍSTICAS (gráfico de barras + filtro)
     ----------------------------------------------------------- */
  function setStatsFilter(key) {
    // Volver a tocar la categoría activa la deselecciona
    statsFilter = (key === statsFilter && key !== 'all') ? 'all' : key;
    renderStats();
  }

  function renderStats() {
    const totalEl = $('stats-total');
    if (!totalEl) return; // la página no está en el DOM

    const total  = getTotalSpent();
    const groups = groupByCategory(state.expenses);
    const nGastos = state.expenses.length;

    totalEl.textContent = formatMoney(total);
    $('stats-count').textContent = `${nGastos} gasto${nGastos !== 1 ? 's' : ''}`;

    const emptyEl = $('stats-empty');
    const bodyEl  = $('stats-body');
    if (groups.length === 0) {
      emptyEl.classList.remove('hidden');
      bodyEl.classList.add('hidden');
      return;
    }
    emptyEl.classList.add('hidden');
    bodyEl.classList.remove('hidden');

    // Gráfico de barras (todas las categorías)
    $('stats-chart').innerHTML = groups.map(g => {
      const pct    = total > 0 ? (g.total / total) * 100 : 0;
      const color  = barColorFor(g.cat.key);
      const active = statsFilter === g.cat.key ? ' is-active' : '';
      return `
        <button class="stat-bar-row${active}" data-key="${g.cat.key}">
          <div class="stat-bar-head">
            <span class="stat-bar-emoji">${g.cat.emoji}</span>
            <span class="stat-bar-label">${g.cat.label}</span>
            <span class="stat-bar-pct">${pct.toFixed(0)}%</span>
            <span class="stat-bar-amt">€${g.total.toFixed(2)}</span>
          </div>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
        </button>`;
    }).join('');

    // Chips de filtro
    $('stats-chips').innerHTML =
      `<button class="stat-chip ${statsFilter === 'all' ? 'is-active' : ''}" data-key="all">Todas</button>` +
      groups.map(g => `<button class="stat-chip ${statsFilter === g.cat.key ? 'is-active' : ''}" data-key="${g.cat.key}">${g.cat.emoji} ${g.cat.label}</button>`).join('');

    // Detalle: gastos de la categoría seleccionada
    const detail = $('stats-detail');
    if (statsFilter === 'all') {
      detail.innerHTML = '<p class="stats-hint">Toca una categoría para ver sus gastos.</p>';
    } else {
      const g = groups.find(x => x.cat.key === statsFilter);
      if (!g) { statsFilter = 'all'; renderStats(); return; }
      const items = g.items.map(it => `
        <li class="mov-cell">
          <div class="mov-icon" style="${catBg(g.cat.key)}">${g.cat.emoji}</div>
          <div class="mov-info">
            <p class="mov-name">${escapeHtml(it.concept || g.cat.label)}</p>
            <p class="mov-date">${escapeHtml(formatDate(it.date))}</p>
          </div>
          <div class="mov-right"><span class="mov-amount-neg">−€${it.amount.toFixed(2)}</span></div>
        </li>`).join('');
      detail.innerHTML = `
        <div class="list-section-header"><span class="list-section-title">${g.cat.emoji} ${escapeHtml(g.cat.label)} · €${g.total.toFixed(2)}</span></div>
        <ul class="movements-list"><li class="mov-group"><ul class="mov-group-inner">${items}</ul></li></ul>`;
    }
  }

  function renderAll() {
    renderBalance();
    renderMovements();
    renderCategoryStats();
    renderStats();
    renderTip();
  }

  /* -----------------------------------------------------------
     5a-quater. CALENDARIO (gastos/ingresos por día + total multicuenta)
     ----------------------------------------------------------- */
  function readAccArray(base, id) {
    try { return JSON.parse(localStorage.getItem('fx_' + base + '_' + id) || '[]'); } catch { return []; }
  }

  // Saldo de una cuenta (la activa se lee del estado en memoria)
  function balanceOfAccount(id) {
    if (id === activeAccountId) return state.balance;
    return parseFloat(localStorage.getItem('fx_balance_' + id) || '0') || 0;
  }

  // Saldo total según el modo del calendario
  function calTotalBalance() {
    if (calState.mode === 'all') {
      return accounts.reduce((s, a) => s + balanceOfAccount(a.id), 0);
    }
    return state.balance;
  }

  // Movimientos (gastos + ingresos) según el modo del calendario
  function calMovements() {
    const accs = calState.mode === 'all' ? accounts : accounts.filter(a => a.id === activeAccountId);
    const out = [];
    accs.forEach((a) => {
      if (!a) return;
      // Para la cuenta activa usamos el estado en memoria (siempre fresco)
      const exp = a.id === activeAccountId ? state.expenses : readAccArray('expenses', a.id);
      const inc = a.id === activeAccountId ? state.incomes  : readAccArray('incomes',  a.id);
      exp.forEach(e => out.push({ ...e, _t: 'expense', _acc: a.name }));
      inc.forEach(i => out.push({ ...i, _t: 'income',  _acc: a.name }));
    });
    return out;
  }

  function changeMonth(delta) {
    let m = calState.month + delta, y = calState.year;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    calState.month = m; calState.year = y; calState.selectedDay = null;
    renderCalendar();
  }

  function setCalMode(mode) {
    calState.mode = mode;
    renderCalendar();
  }

  function selectCalDay(day) {
    calState.selectedDay = day;
    document.querySelectorAll('#cal-grid .cal-cell').forEach(c => {
      c.classList.toggle('selected', Number(c.dataset.day) === day);
    });
    renderDayDetail(day);
  }

  function renderCalendar() {
    if (!$('cal-grid')) return;

    // ── Tarjeta de saldo ──
    $('cal-mode-active').classList.toggle('seg-active', calState.mode === 'active');
    $('cal-mode-all').classList.toggle('seg-active', calState.mode === 'all');
    const bd = $('cal-total-breakdown');
    if (calState.mode === 'all') {
      $('cal-total-label').textContent = `Saldo total · ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''}`;
      $('cal-total-value').textContent = formatMoney(calTotalBalance());
      bd.classList.remove('hidden');
      bd.innerHTML = accounts.map(a => `
        <div class="cal-bd-row">
          <span class="cal-bd-name">${escapeHtml(a.name)}</span>
          <span class="cal-bd-amt">${formatMoney(balanceOfAccount(a.id))}</span>
        </div>`).join('');
    } else {
      const acc = activeAccount();
      $('cal-total-label').textContent = `Saldo · ${acc ? acc.name : ''}`;
      $('cal-total-value').textContent = formatMoney(state.balance);
      bd.classList.add('hidden');
      bd.innerHTML = '';
    }

    // ── Etiqueta del mes ──
    const monthName = new Date(calState.year, calState.month, 1)
      .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    $('cal-month-label').textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    // ── Sumas por día del mes ──
    const movs = calMovements().filter(m => {
      const d = new Date(m.date);
      return d.getMonth() === calState.month && d.getFullYear() === calState.year;
    });
    const byDay = {};
    movs.forEach(m => {
      const d = new Date(m.date).getDate();
      if (!byDay[d]) byDay[d] = { inc: 0, exp: 0 };
      if (m._t === 'income') byDay[d].inc += m.amount; else byDay[d].exp += m.amount;
    });

    // ── Construir la rejilla (semana empieza en lunes) ──
    const firstDow     = (new Date(calState.year, calState.month, 1).getDay() + 6) % 7;
    const daysInMonth  = new Date(calState.year, calState.month + 1, 0).getDate();
    const today        = new Date();
    const isThisMonth  = today.getMonth() === calState.month && today.getFullYear() === calState.year;

    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const info = byDay[d];
      const dots = `<div class="cal-dots">${info && info.inc > 0 ? '<span class="cal-dot inc"></span>' : ''}${info && info.exp > 0 ? '<span class="cal-dot exp"></span>' : ''}</div>`;
      const cls = ['cal-cell'];
      if (info) cls.push('has');
      if (isThisMonth && d === today.getDate()) cls.push('today');
      if (calState.selectedDay === d) cls.push('selected');
      cells += `<button class="${cls.join(' ')}" data-day="${d}"><span class="cal-cell-num">${d}</span>${dots}</button>`;
    }
    $('cal-grid').innerHTML = cells;

    // ── Detalle del día ──
    if (calState.selectedDay) renderDayDetail(calState.selectedDay);
    else { $('cal-day-detail').classList.add('hidden'); $('cal-day-detail').innerHTML = ''; }
  }

  function renderDayDetail(day) {
    const wrap = $('cal-day-detail');
    if (!wrap) return;

    const dateObj = new Date(calState.year, calState.month, day);
    const label   = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const labelCap = label.charAt(0).toUpperCase() + label.slice(1);

    const movs = calMovements().filter(m => {
      const d = new Date(m.date);
      return d.getDate() === day && d.getMonth() === calState.month && d.getFullYear() === calState.year;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const dayInc = movs.filter(m => m._t === 'income').reduce((s, m) => s + m.amount, 0);
    const dayExp = movs.filter(m => m._t === 'expense').reduce((s, m) => s + m.amount, 0);

    const list = movs.map(m => {
      const isInc = m._t === 'income';
      let emoji, bg, name;
      if (isInc) {
        const s = getIncomStyle(m.concept || ''); emoji = s.emoji; bg = s.bg; name = m.concept || 'Ingreso';
      } else {
        const r = resolveExpense(m); emoji = r.cat.emoji; bg = catBg(r.cat.key); name = r.concept || r.cat.label;
      }
      const time   = new Date(m.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const accTag = calState.mode === 'all' ? `<span class="cal-mv-acc">${escapeHtml(m._acc || '')}</span>` : '';
      return `
        <li class="mov-cell">
          <div class="mov-icon" style="${bg}">${emoji}</div>
          <div class="mov-info">
            <p class="mov-name">${escapeHtml(name)}</p>
            <p class="mov-date">${time}${accTag}</p>
          </div>
          <div class="mov-right">
            <span class="${isInc ? 'mov-amount-pos' : 'mov-amount-neg'}">${isInc ? '+' : '−'}€${m.amount.toFixed(2)}</span>
          </div>
        </li>`;
    }).join('');

    let sums = '';
    if (dayInc > 0) sums += `<span class="cal-sum-inc">+€${dayInc.toFixed(2)}</span>`;
    if (dayExp > 0) sums += `<span class="cal-sum-exp">−€${dayExp.toFixed(2)}</span>`;
    if (!sums)      sums  = `<span class="cal-sum-none">Sin movimientos</span>`;

    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="cal-detail-head">
        <p class="cal-detail-date">${escapeHtml(labelCap)}</p>
        <div class="cal-detail-sums">${sums}</div>
      </div>
      ${list ? `<ul class="movements-list cal-mv-list">${list}</ul>` : ''}
      <div class="cal-tip" id="cal-tip">
        <span class="cal-tip-icon">💡</span>
        <div class="cal-tip-body">
          <p class="cal-tip-label">Consejo de Flux AI</p>
          <p class="cal-tip-text loading" id="cal-tip-text">Pensando un consejo…</p>
        </div>
        <button class="cal-tip-close" id="cal-tip-close" aria-label="Cerrar consejo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:13px;height:13px">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>`;

    // Consejo de IA para el día (con fallback local)
    const token = ++daySelToken;
    const key   = `${calState.mode}-${calState.year}-${calState.month}-${day}`;
    fetchDayTip(key, labelCap, dayInc, dayExp, movs).then(tip => {
      if (token !== daySelToken) return; // el usuario ya tocó otro día
      const el = $('cal-tip-text');
      if (el) { el.textContent = tip; el.classList.remove('loading'); }
    });
  }

  async function fetchDayTip(key, label, inc, exp, movs) {
    if (dayTipCache[key]) return dayTipCache[key];
    try {
      const conceptos = movs.filter(m => m._t === 'expense')
        .map(m => `${m.concept || 'gasto'} €${m.amount.toFixed(2)}`).join(', ') || 'sin gastos';
      const message =
        `Dame UN consejo breve (máximo 2 frases, en español, cercano y motivador) sobre mis finanzas del día ${label}. ` +
        `Ese día ingresé €${inc.toFixed(2)} y gasté €${exp.toFixed(2)}. Gastos: ${conceptos}. ` +
        `Responde solo con el consejo, sin encabezados ni emojis.`;
      const context = {
        balance: state.balance, totalSpent: exp,
        numExpenses: movs.filter(m => m._t === 'expense').length, categories: {},
      };
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context }),
      });
      if (res.ok) {
        const data = await res.json();
        const tip = (data.reply || '').replace(/\*/g, '').trim();
        if (tip) { dayTipCache[key] = tip; return tip; }
      }
    } catch (_) { /* sin conexión → fallback local */ }

    // Fallback local
    let tip;
    if (inc === 0 && exp === 0)      tip = 'No registraste movimientos este día. Un día sin gastos también suma para tu ahorro. 💚';
    else if (exp > inc && exp > 0)   tip = `Gastaste €${exp.toFixed(2)} este día. Revisa si todo era necesario y prueba a fijarte un pequeño límite diario.`;
    else if (inc > 0)                tip = `Buen día: ingresaste €${inc.toFixed(2)}. Aparta una parte para ahorro antes de gastarla.`;
    else                             tip = 'Pequeños gastos controlados hoy. ¡Sigue así!';
    dayTipCache[key] = tip;
    return tip;
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
    const done = localStorage.getItem(accKey('onboarded'));
    if (!done) {
      $('onboard-balance').value = '';
      $('btn-onboard-start').disabled = true;
      $('onboarding').classList.remove('hidden');
      setTimeout(() => $('onboard-balance').focus(), 350);
    }
  }

  function finishOnboarding() {
    const value = parseFloat($('onboard-balance').value);
    state.balance = isNaN(value) || value < 0 ? 0 : value;
    saveBalance();
    localStorage.setItem(accKey('onboarded'), '1');
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
    // Solo reinicia la cuenta activa (las demás cuentas se conservan)
    localStorage.removeItem(accKey('balance'));
    localStorage.removeItem(accKey('expenses'));
    localStorage.removeItem(accKey('incomes'));
    localStorage.removeItem(accKey('onboarded'));

    listExpanded = false;
    $('input-concept').value = '';
    state.category = 'comida';
    state.concept = '';
    renderCategoryButton();
    renderConceptButton();
    setMode('expense');
    closeResetModal();
    renderAll();
    renderTip();
    showPage('page-home');
    // Vuelve a pedir el saldo inicial
    maybeShowOnboarding();
  }

  /* -----------------------------------------------------------
     5e. MULTICUENTA
     ----------------------------------------------------------- */
  function renderAccountName() {
    const acc = activeAccount();
    const el = $('account-name');
    if (el) el.textContent = acc ? acc.name : 'Cuenta';
  }

  // Resetea el estado en memoria + UI al cambiar/crear cuenta
  function resetVolatileUI() {
    keypadInput  = '';
    listExpanded = false;
    statsFilter  = 'all';
    state.category = 'comida';
    state.mode   = 'expense';
    state.concept = '';
    $('input-concept').value = '';
    renderCategoryButton();
    renderConceptButton();
    setMode('expense');
    updateDisplay();
  }

  function openAccountSheet() {
    const list = $('account-sheet-list');
    list.innerHTML = accounts.map(a => `
      <li class="cat-opt ${a.id === activeAccountId ? 'is-selected' : ''}" data-id="${a.id}">
        <span class="cat-opt-emoji">🏦</span>
        <span class="cat-opt-label">${escapeHtml(a.name)}</span>
        <svg class="cat-opt-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
        </svg>
      </li>`).join('');
    $('account-sheet').classList.remove('hidden');
  }
  function closeAccountSheet() { $('account-sheet').classList.add('hidden'); }

  function switchAccount(id) {
    closeAccountSheet();
    if (id === activeAccountId) return;
    setActiveAccount(id);
    loadState();
    loadSubcats();          // subcategorías propias de esta cuenta
    resetVolatileUI();
    renderAccountName();
    renderAll();
    renderTip();
    showPage('page-home');
    maybeShowOnboarding(); // por si la cuenta aún no tiene saldo inicial
  }

  function openAccountModal() {
    closeAccountSheet();
    $('account-name-input').value = '';
    $('account-modal').classList.remove('hidden');
    setTimeout(() => $('account-name-input').focus(), 300);
  }
  function closeAccountModal() { $('account-modal').classList.add('hidden'); }

  function confirmCreateAccount() {
    const name = $('account-name-input').value.trim();
    if (!name) { $('account-name-input').focus(); return; }
    const id = 'acc_' + Date.now();
    accounts.push({ id, name });
    saveAccounts();
    setActiveAccount(id);

    // Cuenta nueva → estado y subcategorías vacíos
    state.balance = 0; state.expenses = []; state.incomes = [];
    loadSubcats();
    resetVolatileUI();
    renderAccountName();
    closeAccountModal();
    renderAll();
    renderTip();
    showPage('page-home');
    maybeShowOnboarding(); // pedirá el saldo inicial de la nueva cuenta
  }

  /* -----------------------------------------------------------
     6. ACCIONES
     ----------------------------------------------------------- */
  function handleRegister() {
    const amount  = parseFloat(keypadInput);
    // Gasto → concepto/subcategoría elegido en el pill; Ingreso → texto libre
    const concept = state.mode === 'income'
      ? $('input-concept').value.trim()
      : state.concept.trim();
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
    state.concept = '';
    renderConceptButton();
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
    listExpanded   = false;
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

    // Al abrir el calendario: si es el mes actual, selecciona hoy por defecto
    if (pageId === 'page-calendar') {
      if (calState.selectedDay == null) {
        const t = new Date();
        if (t.getMonth() === calState.month && t.getFullYear() === calState.year) {
          calState.selectedDay = t.getDate();
        }
      }
      renderCalendar();
    }
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
      //    Se adapta al dispositivo: A4 en escritorio, A5 (vertical y legible) en móvil
      setLoadingText('Maquetando el informe…');
      const mobile   = isMobileViewport();
      const docWidth = mobile ? 420 : 794;
      const reportHtml = buildReportDoc({
        monthLabel: monthLabelCap,
        totalSpent, totalIncome, netBalance,
        groups, mExp, mInc, aiAnalysis,
        mobile, docWidth,
      });

      setLoadingText('Generando PDF…');
      await generatePDF(reportHtml, monthLabelCap, mobile, docWidth);

      $('btn-download-success').onclick = () => generatePDF(reportHtml, monthLabelCap, mobile, docWidth);
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
      comida: '#E8743B', ocio: '#6E56CF', supermercado: '#2FA86A',
      transporte: '#2D7FF9', otros: '#9AA0A6',
    })[key] || '#9AA0A6';
  }

  function isMobileViewport() {
    return window.matchMedia('(max-width: 600px)').matches;
  }

  // Gráfico de donut (SVG) con la distribución del gasto por categoría
  function donutSVG(groups, total) {
    const cx = 80, cy = 80, r = 58, sw = 22, circ = 2 * Math.PI * r;
    let offset = 0;
    const arcs = groups.map((g) => {
      const frac = total > 0 ? g.total / total : 0;
      const len  = Math.max(frac * circ - 1.2, 0); // -1.2 → pequeño hueco entre arcos
      const dash = len.toFixed(2) + ' ' + (circ - len).toFixed(2);
      const c = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${barColorFor(g.cat.key)}" stroke-width="${sw}" stroke-linecap="butt" stroke-dasharray="${dash}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += frac * circ;
      return c;
    }).join('');
    return `<svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F1EEE8" stroke-width="${sw}"/>
      ${arcs}
    </svg>`;
  }

  async function generatePDF(html, monthLabel, mobile, docWidth) {
    if (typeof html2pdf === 'undefined') {
      throw new Error('El generador de PDF aún se está cargando. Espera unos segundos e inténtalo de nuevo.');
    }
    const w = docWidth || (mobile ? 420 : 794);
    const stage = $('pdf-stage');
    stage.style.width = w + 'px';
    stage.innerHTML = html;
    const target = stage.querySelector('.pdfdoc');

    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }

    const safe = monthLabel.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');
    try {
      await html2pdf().set({
        margin:      mobile ? [7, 7, 9, 7] : [12, 12, 14, 12],
        filename:    'flux-informe-' + safe + '.pdf',
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: w },
        jsPDF:       { unit: 'mm', format: mobile ? 'a5' : 'a4', orientation: 'portrait' },
        pagebreak:   { mode: ['css', 'legacy'], avoid: ['.cat-block', '.ai-card', '.hero', '.chart-card', '.lg-row', '.cb-item'] },
      }).from(target).save();
    } finally {
      stage.innerHTML = '';
      stage.style.width = '';
    }
  }

  // ── Documento del informe (diseño editorial minimalista) ──
  function buildReportDoc({ monthLabel, totalSpent, totalIncome, netBalance, groups, mExp, mInc, aiAnalysis, mobile, docWidth }) {
    const w = docWidth || (mobile ? 420 : 794);
    const pad = mobile ? 22 : 40;
    const genDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const genTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const netPos  = netBalance >= 0;
    const fmt = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // ── Leyenda + donut ──
    let chartCard = '';
    if (groups.length > 0 && totalSpent > 0) {
      const legend = groups.map((g) => {
        const pct = (g.total / totalSpent) * 100;
        return `
          <div class="lg-row">
            <span class="lg-dot" style="background:${barColorFor(g.cat.key)}"></span>
            <span class="lg-label">${escapeHtml(g.cat.label)}</span>
            <span class="lg-pct">${pct.toFixed(0)}%</span>
            <span class="lg-amt">€${fmt(g.total)}</span>
          </div>`;
      }).join('');
      chartCard = `
        <p class="cap">Distribución del gasto</p>
        <div class="chart-card">
          <div class="donut-wrap">
            ${donutSVG(groups, totalSpent)}
            <div class="donut-center">
              <span class="donut-total">€${fmt(totalSpent)}</span>
              <span class="donut-cap">GASTADO</span>
            </div>
          </div>
          <div class="legend">${legend}</div>
        </div>`;
    }

    // ── Detalle por categoría ──
    const catBlocks = groups.length === 0
      ? `<p class="empty-note">Sin gastos registrados en ${escapeHtml(monthLabel)}.</p>`
      : groups.map((g) => {
          const pct = totalSpent > 0 ? (g.total / totalSpent) * 100 : 0;
          const color = barColorFor(g.cat.key);
          const items = g.items.map((it) => {
            const d = new Date(it.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            return `
              <li class="cb-item">
                <span class="cb-item-name">${escapeHtml(it.concept || g.cat.label)}</span>
                <span class="cb-item-date">${d}</span>
                <span class="cb-item-amt">€${fmt(it.amount)}</span>
              </li>`;
          }).join('');
          return `
            <div class="cat-block">
              <div class="cb-head">
                <span class="cb-emoji" style="${catBg(g.cat.key)}">${g.cat.emoji}</span>
                <span class="cb-label">${escapeHtml(g.cat.label)}</span>
                <span class="cb-total">€${fmt(g.total)}</span>
              </div>
              <div class="cb-track"><div class="cb-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
              <p class="cb-meta">${pct.toFixed(0)}% del gasto · ${g.items.length} movimiento${g.items.length !== 1 ? 's' : ''}</p>
              <ul class="cb-items">${items}</ul>
            </div>`;
        }).join('');

    // ── Ingresos ──
    let incomeBlock = '';
    if (mInc.length > 0) {
      const incItems = [...mInc].sort((a, b) => b.amount - a.amount).map((i) => {
        const d = new Date(i.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        return `
          <li class="cb-item">
            <span class="cb-item-name">${escapeHtml(i.concept || 'Ingreso')}</span>
            <span class="cb-item-date">${d}</span>
            <span class="cb-item-amt" style="color:#1E874B">+€${fmt(i.amount)}</span>
          </li>`;
      }).join('');
      incomeBlock = `
        <p class="cap">Ingresos</p>
        <div class="cat-block">
          <div class="cb-head">
            <span class="cb-emoji" style="background:#E7F6EC">💰</span>
            <span class="cb-label">Total ingresado</span>
            <span class="cb-total" style="color:#1E874B">+€${fmt(totalIncome)}</span>
          </div>
          <ul class="cb-items">${incItems}</ul>
        </div>`;
    }

    // ── Análisis IA ──
    let aiBlock = '';
    const cleanAI = (s) => (s || '').replace(/\*/g, '').trim();
    if (aiAnalysis) {
      const posMatch = aiAnalysis.match(/POSITIVOS:?\s*([\s\S]*?)(?=MEJORAS:|$)/i);
      const mejMatch = aiAnalysis.match(/MEJORAS:?\s*([\s\S]*?)$/i);
      const posText  = posMatch ? cleanAI(posMatch[1]) : '';
      const mejText  = mejMatch ? cleanAI(mejMatch[1]) : '';
      if (posText) aiBlock += `<div class="ai-card"><p class="ai-cap">Lo mejor de este mes</p><p class="ai-text">${escapeHtml(posText)}</p></div>`;
      if (mejText) aiBlock += `<div class="ai-card mej"><p class="ai-cap">Áreas de mejora</p><p class="ai-text">${escapeHtml(mejText)}</p></div>`;
    }
    if (!aiBlock) {
      const advice = generateSmartReply('consejo para ahorrar');
      aiBlock = `<div class="ai-card"><p class="ai-cap">Consejo de ahorro</p><p class="ai-text">${escapeHtml(advice)}</p></div>`;
    }

    return `<div class="pdfdoc${mobile ? ' mob' : ''}">
<style>
  .pdfdoc{ font-family:'Inter',sans-serif; color:#1A1714; background:#FFFFFF; width:${w}px; padding:${pad}px; font-size:12px; line-height:1.55; -webkit-font-smoothing:antialiased; }
  .pdfdoc *{ margin:0; padding:0; box-sizing:border-box; }

  .pdfdoc .mast{ display:flex; justify-content:space-between; align-items:flex-end; padding-bottom:13px; border-bottom:1.5px solid #1A1714; margin-bottom:28px; }
  .pdfdoc .mast-brand{ display:flex; align-items:center; gap:7px; }
  .pdfdoc .mast-mark{ width:26px; height:26px; border-radius:8px; background:#1A1714; color:#fff; display:flex; align-items:center; justify-content:center; font-size:14px; }
  .pdfdoc .mast-word{ font-size:18px; font-weight:800; letter-spacing:4px; }
  .pdfdoc .mast-meta{ text-align:right; }
  .pdfdoc .mast-eyebrow{ font-size:8.5px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:#A8A29B; }
  .pdfdoc .mast-month{ font-family:'Fraunces',Georgia,serif; font-size:15px; font-weight:600; margin-top:2px; }

  .pdfdoc .hero{ display:flex; justify-content:space-between; align-items:flex-end; gap:24px; margin-bottom:32px; }
  .pdfdoc .hero-eyebrow{ font-size:9.5px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#A8A29B; margin-bottom:8px; }
  .pdfdoc .hero-num{ font-family:'Fraunces',Georgia,serif; font-size:56px; font-weight:600; letter-spacing:-1.5px; line-height:0.92; }
  .pdfdoc .hero-num.pos{ color:#1E874B; } .pdfdoc .hero-num.neg{ color:#C0392B; }
  .pdfdoc .hero-sub{ font-size:12px; color:#6B6560; margin-top:10px; }
  .pdfdoc .hero-stats{ display:flex; flex-direction:column; gap:10px; flex-shrink:0; width:172px; }
  .pdfdoc .hstat{ border:1px solid #ECE8E1; border-radius:13px; padding:12px 15px; }
  .pdfdoc .hstat-cap{ font-size:8.5px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#A8A29B; }
  .pdfdoc .hstat-num{ font-family:'Fraunces',Georgia,serif; font-size:21px; font-weight:600; margin-top:3px; }
  .pdfdoc .hstat-num.pos{ color:#1E874B; } .pdfdoc .hstat-num.neg{ color:#C0392B; }

  .pdfdoc .cap{ font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#1A1714; margin-bottom:14px; display:flex; align-items:center; gap:12px; }
  .pdfdoc .cap::after{ content:''; flex:1; height:1px; background:#ECE8E1; }
  .pdfdoc .empty-note{ font-size:12px; color:#A8A29B; font-style:italic; padding:6px 0 18px; }

  .pdfdoc .chart-card{ border:1px solid #ECE8E1; border-radius:18px; padding:22px 24px; margin-bottom:30px; display:flex; align-items:center; gap:28px; }
  .pdfdoc .donut-wrap{ position:relative; width:160px; height:160px; flex-shrink:0; }
  .pdfdoc .donut-center{ position:absolute; left:0; top:0; right:0; bottom:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .pdfdoc .donut-total{ font-family:'Fraunces',Georgia,serif; font-size:23px; font-weight:600; }
  .pdfdoc .donut-cap{ font-size:8px; font-weight:700; letter-spacing:2px; color:#A8A29B; margin-top:3px; }
  .pdfdoc .legend{ flex:1; }
  .pdfdoc .lg-row{ display:flex; align-items:center; gap:11px; padding:8px 0; border-bottom:1px solid #F4F1EC; }
  .pdfdoc .lg-row:last-child{ border-bottom:none; }
  .pdfdoc .lg-dot{ width:11px; height:11px; border-radius:3px; flex-shrink:0; }
  .pdfdoc .lg-label{ flex:1; font-size:13px; font-weight:500; }
  .pdfdoc .lg-pct{ font-size:11px; color:#A8A29B; min-width:34px; text-align:right; }
  .pdfdoc .lg-amt{ font-size:13px; font-weight:700; min-width:70px; text-align:right; font-variant-numeric:tabular-nums; }

  .pdfdoc .cat-block{ border:1px solid #ECE8E1; border-radius:16px; padding:15px 18px; margin-bottom:11px; page-break-inside:avoid; break-inside:avoid; }
  .pdfdoc .cb-head{ display:flex; align-items:center; gap:11px; margin-bottom:10px; }
  .pdfdoc .cb-emoji{ width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
  .pdfdoc .cb-label{ flex:1; font-size:15px; font-weight:700; }
  .pdfdoc .cb-total{ font-family:'Fraunces',Georgia,serif; font-size:18px; font-weight:600; font-variant-numeric:tabular-nums; }
  .pdfdoc .cb-track{ height:6px; background:#F1EEE8; border-radius:99px; overflow:hidden; margin-bottom:5px; }
  .pdfdoc .cb-fill{ height:100%; border-radius:99px; }
  .pdfdoc .cb-meta{ font-size:9.5px; color:#A8A29B; letter-spacing:0.3px; margin-bottom:9px; }
  .pdfdoc .cb-items{ list-style:none; border-top:1px solid #F4F1EC; padding-top:3px; }
  .pdfdoc .cb-item{ display:flex; align-items:center; gap:10px; padding:5px 0; }
  .pdfdoc .cb-item-name{ flex:1; font-size:12px; font-weight:500; color:#3A3530; }
  .pdfdoc .cb-item-date{ font-size:10px; color:#A8A29B; white-space:nowrap; }
  .pdfdoc .cb-item-amt{ font-size:12px; font-weight:600; font-variant-numeric:tabular-nums; min-width:62px; text-align:right; }

  .pdfdoc .ai-section{ margin-top:30px; }
  .pdfdoc .ai-card{ border:1px solid #ECE8E1; border-left:3px solid #1E874B; border-radius:12px; padding:15px 18px; margin-bottom:10px; page-break-inside:avoid; break-inside:avoid; }
  .pdfdoc .ai-card.mej{ border-left-color:#E8743B; }
  .pdfdoc .ai-cap{ font-size:9.5px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:6px; color:#1E874B; }
  .pdfdoc .ai-card.mej .ai-cap{ color:#E8743B; }
  .pdfdoc .ai-text{ font-size:12px; line-height:1.6; color:#3A3530; white-space:pre-wrap; }

  .pdfdoc .foot{ margin-top:28px; padding-top:13px; border-top:1px solid #ECE8E1; display:flex; justify-content:space-between; font-size:9px; color:#A8A29B; letter-spacing:0.3px; }

  /* Móvil: una sola columna */
  .pdfdoc.mob{ font-size:12.5px; }
  .pdfdoc.mob .hero{ flex-direction:column; align-items:stretch; gap:18px; }
  .pdfdoc.mob .hero-num{ font-size:46px; }
  .pdfdoc.mob .hero-stats{ flex-direction:row; width:auto; }
  .pdfdoc.mob .hstat{ flex:1; }
  .pdfdoc.mob .chart-card{ flex-direction:column; gap:18px; padding:20px; }
  .pdfdoc.mob .legend{ width:100%; }
</style>

  <div class="mast">
    <div class="mast-brand">
      <div class="mast-mark">⚡</div>
      <span class="mast-word">FLUX</span>
    </div>
    <div class="mast-meta">
      <p class="mast-eyebrow">Informe mensual</p>
      <p class="mast-month">${escapeHtml(monthLabel)}</p>
    </div>
  </div>

  <div class="hero">
    <div>
      <p class="hero-eyebrow">Balance neto del mes</p>
      <p class="hero-num ${netPos ? 'pos' : 'neg'}">${netPos ? '+' : '−'}€${fmt(Math.abs(netBalance))}</p>
      <p class="hero-sub">${netPos ? 'Has ahorrado este mes. ¡Buen trabajo! 💪' : 'Este mes has gastado más de lo ingresado.'}</p>
    </div>
    <div class="hero-stats">
      <div class="hstat">
        <p class="hstat-cap">Ingresos</p>
        <p class="hstat-num pos">+€${fmt(totalIncome)}</p>
      </div>
      <div class="hstat">
        <p class="hstat-cap">Gastos</p>
        <p class="hstat-num neg">−€${fmt(totalSpent)}</p>
      </div>
    </div>
  </div>

  ${chartCard}

  <p class="cap">Detalle por categoría</p>
  ${catBlocks}
  ${incomeBlock}

  <div class="ai-section">
    <p class="cap">Análisis Flux AI</p>
    ${aiBlock}
  </div>

  <div class="foot">
    <span>Flux · Generado localmente en tu dispositivo · ${genDate} ${genTime}</span>
    <span>Confidencial</span>
  </div>
</div>`;
  }


  /* -----------------------------------------------------------
     9. INICIALIZACIÓN + LISTENERS
     ----------------------------------------------------------- */
  function init() {
    loadAccounts();
    loadSubcats();
    loadState();
    renderAccountName();
    renderAll();
    updateDisplay();

    // Tip — cerrar banner
    $('btn-tip-close').addEventListener('click', () => {
      $('tip-banner').style.display = 'none';
    });

    // Multicuenta
    $('btn-account').addEventListener('click', openAccountSheet);
    $('account-sheet-backdrop').addEventListener('click', closeAccountSheet);
    $('account-sheet-list').addEventListener('click', e => {
      const li = e.target.closest('.cat-opt');
      if (li) switchAccount(li.dataset.id);
    });
    $('btn-add-account').addEventListener('click', openAccountModal);
    $('btn-add-account-sheet').addEventListener('click', openAccountModal);
    $('btn-account-create').addEventListener('click', confirmCreateAccount);
    $('btn-account-cancel').addEventListener('click', closeAccountModal);
    $('account-modal').addEventListener('click', e => {
      if (e.target === $('account-modal')) closeAccountModal();
    });
    $('account-name-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmCreateAccount();
    });

    // Estadísticas — gráfico y chips
    $('stats-chart').addEventListener('click', e => {
      const row = e.target.closest('.stat-bar-row');
      if (row) setStatsFilter(row.dataset.key);
    });
    $('stats-chips').addEventListener('click', e => {
      const chip = e.target.closest('.stat-chip');
      if (chip) setStatsFilter(chip.dataset.key);
    });

    // Calendario
    $('cal-prev').addEventListener('click', () => changeMonth(-1));
    $('cal-next').addEventListener('click', () => changeMonth(1));
    $('cal-mode-active').addEventListener('click', () => setCalMode('active'));
    $('cal-mode-all').addEventListener('click', () => setCalMode('all'));
    $('cal-grid').addEventListener('click', e => {
      const cell = e.target.closest('.cal-cell');
      if (cell && cell.dataset.day) selectCalDay(Number(cell.dataset.day));
    });
    $('cal-day-detail').addEventListener('click', e => {
      if (e.target.closest('#cal-tip-close')) {
        const tip = $('cal-tip');
        if (tip) tip.style.display = 'none';
      }
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

    // Concepto / subcategorías
    $('btn-concept').addEventListener('click', openConceptSheet);
    $('concept-sheet-backdrop').addEventListener('click', closeConceptSheet);
    $('btn-subcat-add').addEventListener('click', () => addSubcat($('subcat-input').value));
    $('subcat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') addSubcat($('subcat-input').value);
    });
    $('subcat-list').addEventListener('click', e => {
      const del = e.target.closest('.subcat-chip-del');
      if (del) { deleteSubcat(del.dataset.del); return; }
      const pick = e.target.closest('.subcat-chip');
      if (pick) selectConcept(pick.dataset.name);
    });
    $('btn-concept-none').addEventListener('click', () => selectConcept(''));
    renderConceptButton();

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

    // Ocultar tab bar cuando el teclado sube en la pestaña de chat
    const tabBar = document.querySelector('.tab-bar');
    function handleViewportResize() {
      const kbHeight = window.innerHeight - (window.visualViewport ? window.visualViewport.height : window.innerHeight);
      const chatActive = $('page-chat') && $('page-chat').classList.contains('active');
      if (kbHeight > 100 && chatActive) {
        tabBar.style.transform = 'translateY(150%)';
        $('page-chat').style.bottom = '0';
        // Scroll al último mensaje
        const cs = $('chat-scroll');
        if (cs) setTimeout(() => { cs.scrollTop = cs.scrollHeight; }, 100);
      } else {
        tabBar.style.transform = '';
        $('page-chat').style.bottom = '';
      }
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
    }
    // Fallback: focus/blur en el input de chat
    $('chat-input').addEventListener('focus', () => {
      setTimeout(handleViewportResize, 300);
    });
    $('chat-input').addEventListener('blur', () => {
      tabBar.style.transform = '';
      $('page-chat').style.bottom = '';
    });

    // Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
