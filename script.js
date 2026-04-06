/* ========================================
   TURBOLINK VPN — MAIN SCRIPTS
   ======================================== */

'use strict';

/* ── Cookie helpers ── */
function getCookie(name) {
  const val = document.cookie.split(';').map(c => c.trim());
  for (const c of val) {
    if (c.startsWith(name + '=')) return decodeURIComponent(c.slice(name.length + 1));
  }
  return null;
}

/* ── Auth token from Userfront cookie ── */
function getAccessToken() {
  return getCookie('access.wbm75m9b');
}

/* ── Check auth status ── */
function isAuthenticated() {
  const token = getAccessToken();
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

/* ── Get user email from token ── */
function getUserEmail() {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.email || payload.userEmail || null;
  } catch {
    return null;
  }
}

/* ── Update nav header based on auth state ── */
function updateHeader() {
  const auth = isAuthenticated();
  const loginBtn   = document.getElementById('nav-login');
  const signupBtn  = document.getElementById('nav-signup');
  const profileBtn = document.getElementById('nav-profile');
  const logoutBtn  = document.getElementById('nav-logout');

  if (loginBtn)  loginBtn.style.display  = auth ? 'none' : '';
  if (signupBtn) signupBtn.style.display = auth ? 'none' : '';
  if (profileBtn) profileBtn.style.display = auth ? '' : 'none';
  if (logoutBtn)  logoutBtn.style.display  = auth ? '' : 'none';

  // Drawer too
  const dLogin   = document.getElementById('drawer-login');
  const dSignup  = document.getElementById('drawer-signup');
  const dProfile = document.getElementById('drawer-profile');
  const dLogout  = document.getElementById('drawer-logout');
  if (dLogin)   dLogin.style.display   = auth ? 'none' : '';
  if (dSignup)  dSignup.style.display  = auth ? 'none' : '';
  if (dProfile) dProfile.style.display = auth ? '' : 'none';
  if (dLogout)  dLogout.style.display  = auth ? '' : 'none';
}

/* ── Logout ── */
function logout() {
  // Clear Userfront cookie
  document.cookie = 'access.wbm75m9b=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'id.wbm75m9b=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'refresh.wbm75m9b=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  showToast('Вы вышли из аккаунта', 'info');
  setTimeout(() => { window.location.href = '/index.html'; }, 900);
}

/* ── Orders (localStorage) ── */
function saveOrder(plan, price) {
  const orders = JSON.parse(localStorage.getItem('tl_orders') || '[]');
  orders.unshift({
    id: Date.now(),
    plan,
    price,
    date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }),
    status: 'оплачено'
  });
  localStorage.setItem('tl_orders', JSON.stringify(orders));
}

function loadOrders() {
  return JSON.parse(localStorage.getItem('tl_orders') || '[]');
}

/* ── Toast Notifications ── */
let toastContainer;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function showToast(message, type = 'info', duration = 3500) {
  const container = getToastContainer();
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut .3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ── Handle buy button (auth check) ── */
function handleBuy(plan, price) {
  if (!isAuthenticated()) {
    showToast('Войдите в аккаунт, чтобы купить тариф', 'info');
    setTimeout(() => { window.location.href = '/login.html'; }, 1200);
    return;
  }
  saveOrder(plan, price);
  showToast(`Тариф "${plan}" оформлен! Переходим в бот...`, 'success');
  setTimeout(() => {
    window.open('https://t.me/turbovpnlink_bot', '_blank');
  }, 1200);
}

/* ── Scroll nav state ── */
function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

/* ── Mobile drawer ── */
function initDrawer() {
  const toggle = document.getElementById('nav-toggle');
  const drawer = document.getElementById('nav-drawer');
  if (!toggle || !drawer) return;

  toggle.addEventListener('click', () => {
    const open = drawer.classList.toggle('open');
    toggle.innerHTML = open
      ? '<i class="fa-solid fa-xmark"></i>'
      : '<i class="fa-solid fa-bars"></i>';
  });

  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !drawer.contains(e.target)) {
      drawer.classList.remove('open');
      toggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }
  });
}

/* ── Reveal on scroll ── */
function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach(el => io.observe(el));
}

/* ── FAQ Accordion ── */
function initFAQ() {
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      // Close all
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
}

/* ── IP Checker ── */
async function checkIP() {
  const resultEl = document.getElementById('ip-result');
  if (!resultEl) return;
  resultEl.innerHTML = `<span style="color:var(--text-3);font-size:.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> Определяем ваш IP...</span>`;

  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    resultEl.innerHTML = `
      <div class="ip-val">${data.ip}</div>
      <div class="ip-meta"><i class="fa-solid fa-location-dot"></i> ${data.city || '—'}, ${data.country_name || '—'} &nbsp;·&nbsp; <i class="fa-solid fa-wifi"></i> ${data.org || '—'}</div>
    `;
    showToast('IP-адрес определён', 'success');
  } catch {
    resultEl.innerHTML = `<span style="color:#EF4444;font-size:.85rem;"><i class="fa-solid fa-triangle-exclamation"></i> Не удалось получить IP</span>`;
    showToast('Ошибка при проверке IP', 'error');
  }
}

/* ── Card hover glow (mouse tracking) ── */
function initCardGlow() {
  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1) + '%';
      const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1) + '%';
      card.style.setProperty('--mx', x);
      card.style.setProperty('--my', y);
    });
  });
}

/* ── Dashboard init ── */
function initDashboard() {
  if (!document.querySelector('.dashboard-page')) return;

  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return;
  }

  const email = getUserEmail() || 'пользователь';
  const greetEl = document.getElementById('dash-email');
  if (greetEl) greetEl.textContent = email;

  const avatarEl = document.getElementById('dash-avatar');
  if (avatarEl) avatarEl.textContent = email.charAt(0).toUpperCase();

  const emailInfoEl = document.getElementById('dash-email-info');
  if (emailInfoEl) emailInfoEl.textContent = email;

  renderOrders();
}

function renderOrders() {
  const container = document.getElementById('orders-container');
  if (!container) return;
  const orders = loadOrders();

  if (!orders.length) {
    container.innerHTML = `
      <div class="orders-empty">
        <i class="fa-solid fa-box-open"></i>
        <p>Заказов пока нет</p>
        <p style="font-size:.8rem;margin-top:4px;">Купите тариф, и он появится здесь</p>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="orders-list">${orders.map(o => `
    <div class="order-item">
      <div>
        <div class="order-plan">${o.plan}</div>
        <div class="order-date">${o.date}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="order-price">${o.price}₽</div>
        <div class="order-badge"><i class="fa-solid fa-check"></i> ${o.status}</div>
      </div>
    </div>`).join('')}
  </div>`;
}

/* ── Init all on DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', () => {
  updateHeader();
  initNav();
  initDrawer();
  initReveal();
  initFAQ();
  initCardGlow();
  initDashboard();
});
