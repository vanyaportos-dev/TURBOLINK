/**
 * ============================================================
 * TURBOLINK VPN — script.js
 * Авторизация Userfront, заказы, тосты, модальные окна
 * ============================================================
 */

/* ============================================================
   РАЗДЕЛ 1 — АВТОРИЗАЦИЯ (USERFRONT)
   ============================================================ */

/**
 * getAccessToken()
 * Ищет токен доступа Userfront в cookie.
 * Userfront хранит токен в куке с именем access.{tenantId}
 * @returns {string|null} токен или null
 */
function getAccessToken() {
  const tenantId = 'wbm75m9b';
  const cookieName = `access.${tenantId}`;
  const cookies = document.cookie.split(';');

  for (let cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === cookieName) {
      return decodeURIComponent(rest.join('='));
    }
  }

  /* Fallback: проверяем localStorage (иногда Userfront сохраняет туда) */
  try {
    const stored = localStorage.getItem(`userfront.${tenantId}.tokens`);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.accessToken || parsed.access || null;
    }
  } catch (e) {
    /* ignore */
  }

  return null;
}

/**
 * getUserData()
 * Извлекает payload из JWT токена (без верификации подписи).
 * @returns {object|null} данные пользователя или null
 */
function getUserData() {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    /* Base64URL → Base64 → JSON */
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '=='.slice(0, (4 - payload.length % 4) % 4);
    const decoded = JSON.parse(atob(padded));

    /* Проверяем, не истёк ли токен */
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    return decoded;
  } catch (e) {
    return null;
  }
}

/**
 * isAuthenticated()
 * Проверяет, авторизован ли пользователь.
 * @returns {boolean}
 */
function isAuthenticated() {
  return getUserData() !== null;
}

/**
 * getUserEmail()
 * Возвращает email текущего пользователя.
 * @returns {string|null}
 */
function getUserEmail() {
  const data = getUserData();
  if (!data) return null;
  return data.email || data.userEmail || null;
}

/* ============================================================
   РАЗДЕЛ 2 — ШАПКА (ДИНАМИЧЕСКОЕ СОСТОЯНИЕ)
   ============================================================ */

/**
 * updateHeader()
 * Обновляет кнопки в шапке в зависимости от авторизации.
 * Ищет элементы с data-атрибутами.
 */
function updateHeader() {
  const authArea = document.getElementById('header-auth');
  if (!authArea) return;

  if (isAuthenticated()) {
    const email = getUserEmail();
    const short = email ? email.split('@')[0] : 'Профиль';

    authArea.innerHTML = `
      <a href="dashboard.html" class="btn btn-ghost btn-sm" title="${email || ''}">
        <span style="font-size:14px;">👤</span>
        ${short}
      </a>
      <button class="btn btn-primary btn-sm" onclick="logout()">Выйти</button>
    `;
  } else {
    authArea.innerHTML = `
      <a href="login.html" class="btn btn-ghost btn-sm">Войти</a>
      <a href="signup.html" class="btn btn-primary btn-sm">Попробовать</a>
    `;
  }
}

/* ============================================================
   РАЗДЕЛ 3 — ЗАКАЗЫ (localStorage)
   ============================================================ */

const ORDERS_KEY = 'turbolink_orders';

/**
 * saveOrder(plan, price)
 * Сохраняет заказ в localStorage.
 * @param {string} plan  — название тарифа
 * @param {number} price — цена в рублях
 * @returns {object} объект заказа
 */
function saveOrder(plan, price) {
  const orders = loadOrders();

  const order = {
    id: 'TL-' + Date.now().toString(36).toUpperCase(),
    plan: plan,
    price: price,
    date: new Date().toISOString(),
    status: 'pending', /* ожидает оплаты в Telegram */
    email: getUserEmail() || 'unknown',
  };

  orders.unshift(order); /* Добавляем в начало */
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

  return order;
}

/**
 * loadOrders()
 * Загружает массив заказов из localStorage.
 * @returns {Array} массив заказов
 */
function loadOrders() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * clearOrders()
 * Очищает историю заказов (используется при выходе).
 */
function clearOrders() {
  localStorage.removeItem(ORDERS_KEY);
}

/* ============================================================
   РАЗДЕЛ 4 — ТОСТ-УВЕДОМЛЕНИЯ
   ============================================================ */

/* Контейнер для тостов создаётся один раз */
function getToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * showToast(title, desc, type, duration)
 * Показывает всплывающее уведомление.
 * @param {string} title     — заголовок тоста
 * @param {string} desc      — описание (опционально)
 * @param {string} type      — 'success' | 'error' | 'info'
 * @param {number} duration  — время в мс (по умолчанию 4000)
 */
function showToast(title, desc = '', type = 'success', duration = 4000) {
  const container = getToastContainer();

  const icons = {
    success: '✅',
    error:   '❌',
    info:    'ℹ️',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.info}</span>
    <div class="toast__body">
      <div class="toast__title">${title}</div>
      ${desc ? `<div class="toast__desc">${desc}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);

  /* Trigger animation on next frame */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  });

  /* Авто-скрытие */
  setTimeout(() => {
    toast.classList.add('hide');
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 400);
  }, duration);
}

/* ============================================================
   РАЗДЕЛ 5 — МОДАЛЬНОЕ ОКНО ДЛЯ НЕАВТОРИЗОВАННЫХ
   ============================================================ */

/**
 * showAuthModal(planName, planPrice)
 * Показывает модальное окно с предложением войти / зарегистрироваться.
 * @param {string} planName  — название тарифа (для отображения)
 * @param {number} planPrice — цена тарифа
 */
function showAuthModal(planName, planPrice) {
  /* Удаляем старый модал, если есть */
  const old = document.getElementById('auth-modal-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'auth-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Авторизация требуется');

  overlay.innerHTML = `
    <div class="modal">
      <button class="modal__close" onclick="closeAuthModal()" aria-label="Закрыть">&times;</button>
      <div class="modal__icon">🔐</div>
      <h2 class="modal__title">Войдите в аккаунт</h2>
      <p class="modal__text">
        Для покупки тарифа <strong style="color:var(--accent)">${planName}</strong> за 
        <strong style="color:var(--accent)">${planPrice}₽</strong> необходимо войти 
        или создать аккаунт. Это займёт меньше минуты.
      </p>
      <div class="modal__actions">
        <a href="login.html" class="btn btn-primary btn-full btn-lg">
          Войти в аккаунт
        </a>
        <a href="signup.html" class="btn btn-outline btn-full btn-lg">
          Зарегистрироваться
        </a>
      </div>
    </div>
  `;

  /* Клик по фону — закрыть */
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAuthModal();
  });

  /* ESC — закрыть */
  document.addEventListener('keydown', handleModalEsc);

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });
  });
}

/**
 * closeAuthModal()
 * Закрывает модальное окно авторизации.
 */
function closeAuthModal() {
  const overlay = document.getElementById('auth-modal-overlay');
  if (!overlay) return;

  overlay.classList.remove('active');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', handleModalEsc);

  setTimeout(() => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }, 300);
}

/**
 * handleModalEsc(e)
 * Закрывает модал по клавише Escape.
 */
function handleModalEsc(e) {
  if (e.key === 'Escape') closeAuthModal();
}

/* ============================================================
   РАЗДЕЛ 6 — КНОПКИ "КУПИТЬ"
   ============================================================ */

/* Данные тарифов */
const PLANS = [
  { id: 'plan-14',  label: '14 дней',   price: 32,  features: ['Безлимитный трафик', 'Все серверы', 'Поддержка 24/7'] },
  { id: 'plan-1m',  label: '1 месяц',   price: 53,  features: ['Безлимитный трафик', 'Все серверы', 'Поддержка 24/7'] },
  { id: 'plan-3m',  label: '3 месяца',  price: 174, features: ['Безлимитный трафик', 'Все серверы', 'Поддержка 24/7', 'Приоритетная очередь'] },
  { id: 'plan-6m',  label: '6 месяцев', price: 327, features: ['Безлимитный трафик', 'Все серверы', 'Поддержка 24/7', 'Приоритетная очередь'] },
  { id: 'plan-12m', label: '12 месяцев', price: 601, features: ['Безлимитный трафик', 'Все серверы', 'Поддержка 24/7', 'Приоритетная очередь', 'Семейный аккаунт'] },
];

/**
 * handleBuyClick(planId)
 * Обрабатывает нажатие кнопки "Купить".
 * Если не авторизован — показывает модал.
 * Если авторизован — сохраняет заказ и показывает тост.
 * @param {string} planId — идентификатор тарифа
 */
function handleBuyClick(planId) {
  const plan = PLANS.find(p => p.id === planId);
  if (!plan) {
    console.warn('Тариф не найден:', planId);
    return;
  }

  if (!isAuthenticated()) {
    /* Пользователь не авторизован — показать модал */
    showAuthModal(plan.label, plan.price);
    return;
  }

  /* Авторизован — сохраняем заказ */
  const order = saveOrder(plan.label, plan.price);

  /* Показываем тост */
  showToast(
    '🎉 Заказ оформлен!',
    `${plan.label} за ${plan.price}₽ · ID: ${order.id} · Оплатите в Telegram-боте`,
    'success',
    5000
  );
}

/* ============================================================
   РАЗДЕЛ 7 — ВЫХОД ИЗ АККАУНТА
   ============================================================ */

/**
 * logout()
 * Выходит из аккаунта:
 * — вызывает Userfront.logout() если доступен
 * — удаляет cookie токена
 * — перенаправляет на главную
 */
async function logout() {
  try {
    /* Пробуем использовать Userfront SDK если подключён */
    if (typeof Userfront !== 'undefined' && Userfront.logout) {
      await Userfront.logout();
      return; /* Userfront сам делает редирект */
    }
  } catch (e) {
    console.warn('Userfront.logout() failed:', e);
  }

  /* Фолбэк: удаляем куки и localStorage */
  const tenantId = 'wbm75m9b';
  const cookieName = `access.${tenantId}`;

  /* Удаляем cookie для всех возможных путей */
  document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${location.hostname}`;

  /* Удаляем localStorage записи */
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('userfront.') || key.startsWith('access.'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  /* Редирект */
  window.location.href = 'index.html';
}

/* ============================================================
   РАЗДЕЛ 8 — ИСТОРИЯ ЗАКАЗОВ (РЕНДЕР)
   ============================================================ */

/**
 * renderOrders(containerId)
 * Отрисовывает историю заказов в указанном контейнере.
 * @param {string} containerId — id DOM-элемента
 */
function renderOrders(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const orders = loadOrders();

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📦</div>
        <p>У вас пока нет заказов</p>
        <p style="font-size:13px; margin-top:6px; color:var(--text-dim)">
          Выберите тариф на <a href="index.html#plans" style="color:var(--accent)">главной странице</a>
        </p>
      </div>
    `;
    return;
  }

  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

  const html = orders.map(order => {
    const date = new Date(order.date);
    const dateStr = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;

    return `
      <div class="order-item">
        <div class="order-item__info">
          <div class="order-item__plan">TurboLink ${order.plan}</div>
          <div class="order-item__date">${dateStr} · ID: ${order.id}</div>
        </div>
        <div class="order-item__price">${order.price}₽</div>
        <div class="order-item__status">Ожидает оплаты</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `<div class="order-list">${html}</div>`;
}

/* ============================================================
   РАЗДЕЛ 9 — NAVBAR SCROLL EFFECT
   ============================================================ */

/**
 * initScrollNavbar()
 * Добавляет класс .scrolled к навбару при прокрутке.
 */
function initScrollNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const onScroll = () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); /* Начальное состояние */
}

/* ============================================================
   РАЗДЕЛ 10 — SCROLL ANIMATIONS (IntersectionObserver)
   ============================================================ */

/**
 * initScrollAnimations()
 * Активирует анимации при появлении элементов во вьюпорте.
 */
function initScrollAnimations() {
  const elements = document.querySelectorAll('.animate-on-scroll, .stagger-children');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    elements.forEach(el => observer.observe(el));
  } else {
    /* Фолбэк для старых браузеров */
    elements.forEach(el => el.classList.add('visible'));
  }
}

/* ============================================================
   РАЗДЕЛ 11 — DASHBOARD INIT
   ============================================================ */

/**
 * initDashboard()
 * Инициализирует личный кабинет:
 * — проверяет авторизацию
 * — показывает email
 * — загружает заказы
 */
function initDashboard() {
  /* Редирект если не авторизован */
  if (!isAuthenticated()) {
    /* Небольшая задержка, чтобы Userfront успел подгрузить состояние */
    setTimeout(() => {
      if (!isAuthenticated()) {
        window.location.href = 'login.html';
      }
    }, 800);
    return;
  }

  /* Показываем email */
  const emailEl = document.getElementById('dashboard-email');
  if (emailEl) {
    const email = getUserEmail();
    emailEl.textContent = email ? email.split('@')[0] : 'Пользователь';
  }

  const fullEmailEl = document.getElementById('dashboard-full-email');
  if (fullEmailEl) {
    fullEmailEl.textContent = getUserEmail() || '';
  }

  /* Загружаем историю заказов */
  renderOrders('orders-container');
}

/* ============================================================
   РАЗДЕЛ 12 — ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

/**
 * init()
 * Точка входа — запускается когда DOM готов.
 */
function init() {
  /* Навбар */
  updateHeader();
  initScrollNavbar();

  /* Анимации */
  initScrollAnimations();

  /* Если на странице дашборда */
  if (document.body.dataset.page === 'dashboard') {
    initDashboard();
  }

  /* Привязываем кнопки "Купить" */
  const buyButtons = document.querySelectorAll('[data-buy-plan]');
  buyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const planId = btn.dataset.buyPlan;
      handleBuyClick(planId);
    });
  });

  /* Кнопка выхода */
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

/* Запуск после загрузки DOM */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* Экспортируем функции в глобальный скоп (для onclick атрибутов) */
window.handleBuyClick  = handleBuyClick;
window.logout          = logout;
window.closeAuthModal  = closeAuthModal;
window.showToast       = showToast;
window.isAuthenticated = isAuthenticated;
