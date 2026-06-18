document.addEventListener('DOMContentLoaded', () => {
  const LIVE_API_BASE = 'https://aliportfolio.org/xorvian/backend/api';
  const LOCAL_API_BASE = 'http://localhost/Xorvian%20backend/api';
  const API_BASE = localStorage.getItem('xorvianApiBase')
    || (window.location.protocol === 'file:' ? LIVE_API_BASE : '')
    || (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname) ? LOCAL_API_BASE : `${window.location.origin}/xorvian/backend/api`);

  function getAuthToken() {
    return localStorage.getItem('xorvianAuthToken') || '';
  }

  function saveAuthSession(payload) {
    localStorage.setItem('xorvianAuthToken', payload.token);
    localStorage.setItem('xorvianUser', JSON.stringify(payload.user));
  }

  function clearAuthSession() {
    localStorage.removeItem('xorvianAuthToken');
    localStorage.removeItem('xorvianUser');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function apiRequest(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/${endpoint}`, {
      ...options,
      headers
    });

    const payload = await response.json().catch(() => ({
      ok: false,
      message: 'Invalid backend response.'
    }));

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || 'Request failed.');
    }

    return payload;
  }

  // --- Showcase Tabs Switching ---
  const tabMenuItems = document.querySelectorAll('.showcase-menu-item');
  const tabSlides = document.querySelectorAll('.showcase-slide');

  tabMenuItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      // Deactivate all menu items & slides
      tabMenuItems.forEach(btn => btn.classList.remove('active'));
      tabSlides.forEach(slide => slide.classList.remove('active'));

      // Activate clicked one
      item.classList.add('active');
      const targetSlideId = item.getAttribute('data-target');
      const targetSlide = document.getElementById(targetSlideId);
      if (targetSlide) {
        targetSlide.classList.add('active');
      }
    });
  });

  // --- Testimonials Carousel ---
  const testimonials = document.querySelectorAll('.testimonial-card');
  const dotsContainer = document.querySelector('.carousel-dots');
  let currentSlide = 0;
  let autoplayInterval;

  // Dynamically generate dots
  testimonials.forEach((_, index) => {
    const dot = document.createElement('span');
    dot.classList.add('carousel-dot');
    if (index === 0) dot.classList.add('active');
    dot.addEventListener('click', () => {
      goToSlide(index);
      resetAutoplay();
    });
    dotsContainer.appendChild(dot);
  });

  const dots = document.querySelectorAll('.carousel-dot');

  function goToSlide(index) {
    testimonials[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    
    currentSlide = index;
    
    testimonials[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
  }

  function startAutoplay() {
    autoplayInterval = setInterval(() => {
      let nextSlide = (currentSlide + 1) % testimonials.length;
      goToSlide(nextSlide);
    }, 5000);
  }

  function resetAutoplay() {
    clearInterval(autoplayInterval);
    startAutoplay();
  }

  // Start rotation
  if (testimonials.length > 0) {
    startAutoplay();
  }

  // --- FAQ Accordion ---
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const trigger = item.querySelector('.faq-trigger');
    trigger.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all items
      faqItems.forEach(faq => faq.classList.remove('active'));
      
      // Toggle clicked item
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // --- Mobile Menu Toggle ---
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      const isVisible = navLinks.style.display === 'flex';
      navLinks.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = '80px';
        navLinks.style.left = '0';
        navLinks.style.width = '100%';
        navLinks.style.background = 'var(--bg-secondary)';
        navLinks.style.padding = '2rem';
        navLinks.style.borderBottom = '1px solid var(--border-glass)';
      }
    });
  }

  // --- Premium Voice Preview Experience ---
  const experienceButtons = document.querySelectorAll('.btn-experience');
  const audioContextClass = window.AudioContext || window.webkitAudioContext;

  experienceButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Visual Feedback
      const originalText = btn.innerHTML;
      btn.innerHTML = `<span class="logo-dot"></span> Listening / Playing...`;
      btn.style.opacity = '0.7';

      // Play synthesized greeting audio beep as preview
      try {
        const audioCtx = new audioContextClass();
        
        // Synthesizing a short pleasant futuristic sound effect
        const playTone = (freq, type, duration, startTime) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          
          osc.type = type;
          osc.frequency.setValueAtTime(freq, startTime);
          
          gainNode.gain.setValueAtTime(0.15, startTime);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
          
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          osc.start(startTime);
          osc.stop(startTime + duration);
        };

        // Synthesize voice notification chime
        const now = audioCtx.currentTime;
        playTone(392, 'sine', 0.15, now);
        playTone(523.25, 'sine', 0.25, now + 0.12);
        playTone(659.25, 'sine', 0.35, now + 0.24);

      } catch (err) {
        console.warn('Audio Context API not supported or user gesture needed', err);
      }

      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.opacity = '1';
        alert('Voice AI Demo Call simulation successfully triggered! This voice sounds clean and operates at <1s latency.');
      }, 1000);
    });
  });

  // --- Signup / Login Demo Flow ---
  const authTabs = document.querySelectorAll('.auth-tab');
  const authForms = document.querySelectorAll('.auth-form');
  const authLinks = document.querySelectorAll('[data-auth-tab]');
  const authMessage = document.getElementById('auth-message');
  const signupForm = document.getElementById('signup-form');
  const loginForm = document.getElementById('login-form');

  function showAuthMessage(text, type = '') {
    if (!authMessage) return;
    authMessage.textContent = text;
    authMessage.className = `auth-message ${type}`.trim();
  }

  function switchAuthPanel(panelName) {
    authTabs.forEach(tab => {
      const isActive = tab.getAttribute('data-auth-panel') === panelName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    authForms.forEach(form => {
      form.classList.toggle('active', form.getAttribute('data-auth-form') === panelName);
    });

    showAuthMessage('');
  }

  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchAuthPanel(tab.getAttribute('data-auth-panel'));
    });
  });

  authLinks.forEach(link => {
    link.addEventListener('click', () => {
      const panel = link.getAttribute('data-auth-tab');
      if (panel) {
        setTimeout(() => switchAuthPanel(panel), 80);
      }
    });
  });

  if (signupForm) {
    signupForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const firstName = document.getElementById('signup-first-name').value.trim();
      const secondName = document.getElementById('signup-second-name').value.trim();
      const email = document.getElementById('signup-email').value.trim().toLowerCase();
      const password = document.getElementById('signup-password').value;

      if (!firstName || !secondName || !email || password.length < 8) {
        showAuthMessage('Please complete all fields. Password must be at least 8 characters.', 'error');
        return;
      }

      try {
        showAuthMessage('Creating your account...', '');
        const payload = await apiRequest('signup.php', {
          method: 'POST',
          body: JSON.stringify({ firstName, secondName, email, password })
        });

        saveAuthSession(payload);
        signupForm.reset();
        showAuthMessage('Account created. Opening dashboard...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 600);
      } catch (error) {
        showAuthMessage(error.message, 'error');
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const email = document.getElementById('login-email').value.trim().toLowerCase();
      const password = document.getElementById('login-password').value;

      try {
        showAuthMessage('Checking your account...', '');
        const payload = await apiRequest('login.php', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        saveAuthSession(payload);
        loginForm.reset();
        const nextPage = payload.user?.role === 'admin' ? 'admin.html' : 'dashboard.html';
        showAuthMessage('Login successful. Opening dashboard...', 'success');
        setTimeout(() => {
          window.location.href = nextPage;
        }, 600);
      } catch (error) {
        showAuthMessage(error.message, 'error');
      }
    });
  }

  // --- Dashboard ---
  const dashboardRoot = document.getElementById('dashboard-root');

  if (dashboardRoot) {
    const customerShell = document.querySelector('.customer-shell');
    const sidebarToggle = document.getElementById('customer-sidebar-toggle');
    const dashboardViewButtons = document.querySelectorAll('[data-dashboard-view]');
    const dashboardViews = document.querySelectorAll('.customer-view');
    const currentSection = document.getElementById('customer-current-section');
    const dashboardName = document.getElementById('dashboard-name');
    const dashboardEmail = document.getElementById('dashboard-email');
    const dashboardEmailCopy = document.getElementById('dashboard-email-copy');
    const statCalls = document.getElementById('stat-calls');
    const statOrders = document.getElementById('stat-dashboard-orders');
    const statReservations = document.getElementById('stat-reservations');
    const statHandoffs = document.getElementById('stat-handoffs');
    const setupStatus = document.getElementById('setup-status');
    const overviewCallMix = document.getElementById('overview-call-mix');
    const overviewConversionRate = document.getElementById('overview-conversion-rate');
    const overviewActivityChart = document.getElementById('overview-activity-chart');
    const overviewActivityTotal = document.getElementById('overview-activity-total');
    const overviewActionList = document.getElementById('overview-action-list');
    const overviewManagerStatus = document.getElementById('overview-manager-status');
    const profileForm = document.getElementById('restaurant-profile-form');
    const agentSettingsForm = document.getElementById('agent-settings-form');
    const menuForm = document.getElementById('menu-form');
    const menuTextInput = document.getElementById('menu-text');
    const convertMenuBtn = document.getElementById('convert-menu-btn');
    const loadMenuExampleBtn = document.getElementById('load-menu-example-btn');
    const menuConverterStatus = document.getElementById('menu-converter-status');
    const dashboardMessage = document.getElementById('dashboard-message');
    const agentSettingsMessage = document.getElementById('agent-settings-message');
    const workflowSettingsMessage = document.getElementById('workflow-settings-message');
    const menuMessage = document.getElementById('menu-message');
    const logoutBtn = document.getElementById('logout-btn');
    const workflowShortcutForm = document.getElementById('workflow-shortcut-form');
    const ordersTableBody = document.getElementById('orders-table-body');
    const reservationsTableBody = document.getElementById('reservations-table-body');
    const callsTableBody = document.getElementById('calls-table-body');
    const handoffsTableBody = document.getElementById('handoffs-table-body');
    const operationalRefreshButtons = document.querySelectorAll('[data-refresh-operational]');
    const apiEnvironment = document.getElementById('api-environment');

    if (apiEnvironment) {
      const isLiveApi = API_BASE.includes('aliportfolio.org');
      apiEnvironment.textContent = isLiveApi ? 'Live API' : 'Local API';
      apiEnvironment.title = API_BASE;
    }

    function openDashboardView(viewName) {
      dashboardViews.forEach(view => {
        const isActive = view.id === `view-${viewName}`;
        view.classList.toggle('active', isActive);
        if (isActive && currentSection) {
          currentSection.textContent = view.getAttribute('data-view-title') || viewName;
        }
      });

      dashboardViewButtons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-dashboard-view') === viewName);
      });
    }

    dashboardViewButtons.forEach(button => {
      button.addEventListener('click', () => {
        openDashboardView(button.getAttribute('data-dashboard-view'));
      });
    });

    if (sidebarToggle && customerShell) {
      sidebarToggle.addEventListener('click', () => {
        customerShell.classList.toggle('sidebar-collapsed');
      });
    }

    function showDashboardMessage(text, type = '') {
      if (!dashboardMessage) return;
      dashboardMessage.textContent = text;
      dashboardMessage.className = `auth-message ${type}`.trim();
    }

    function fillProfile(profile) {
      if (!profileForm || !profile) return;

      const map = {
        restaurantName: profile.restaurant_name,
        businessPhone: profile.business_phone,
        address: profile.address,
        city: profile.city,
        country: profile.country,
        cuisineType: profile.cuisine_type,
        timezone: profile.timezone,
        openingHours: profile.opening_hours,
        deliveryZones: profile.delivery_zones,
        reservationPolicy: profile.reservation_policy,
        menuNotes: profile.menu_notes,
        knowledgeBase: profile.knowledge_base
      };

      Object.entries(map).forEach(([fieldName, value]) => {
        const field = profileForm.elements[fieldName] || document.querySelector(`[name="${fieldName}"]`);
        if (field) field.value = value || '';
      });
    }

    function fillAgentSettings(agent, workflow) {
      if (!agentSettingsForm) return;

      const map = {
        agentName: agent?.agent_name,
        languageCode: agent?.language_code,
        openaiModel: agent?.openai_model,
        openaiMaxTokens: agent?.openai_max_tokens,
        voiceId: agent?.voice_id,
        voiceModel: agent?.voice_model,
        twilioPhone: agent?.twilio_phone,
        escalationPhone: agent?.escalation_phone,
        notificationChannel: agent?.notification_channel,
        notificationMinUrgency: agent?.notification_min_urgency,
        notificationPhone: agent?.notification_phone,
        notificationEmail: agent?.notification_email,
        n8nWebhookUrl: agent?.n8n_webhook_url,
        n8nWebhookPath: workflow?.n8n_webhook_path,
        orderSheetId: workflow?.order_sheet_id,
        reservationSheetId: workflow?.reservation_sheet_id,
        gatherMessage: agent?.gather_message,
        closingMessage: agent?.closing_message,
        systemPrompt: agent?.system_prompt
      };

      Object.entries(map).forEach(([fieldName, value]) => {
        const field = agentSettingsForm.elements[fieldName];
        if (field) field.value = value || '';
      });

      if (agentSettingsForm.elements.orderEnabled) {
        agentSettingsForm.elements.orderEnabled.checked = String(agent?.order_enabled ?? '1') === '1';
      }

      if (agentSettingsForm.elements.reservationEnabled) {
        agentSettingsForm.elements.reservationEnabled.checked = String(agent?.reservation_enabled ?? '1') === '1';
      }

      if (agentSettingsForm.elements.notificationEnabled) {
        agentSettingsForm.elements.notificationEnabled.checked = String(agent?.notification_enabled ?? '1') === '1';
      }
    }

    function setTableMessage(tableBody, colspan, message, type = '') {
      if (!tableBody) return;
      tableBody.innerHTML = `<tr><td colspan="${colspan}" class="table-message ${type}">${escapeHtml(message)}</td></tr>`;
    }

    function prettyStatus(value) {
      return String(value || 'new')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());
    }

    function statusClass(value) {
      const normalized = String(value || '').toLowerCase();

      if (['completed', 'confirmed', 'ready', 'answered', 'notified', 'resolved'].includes(normalized)) {
        return 'success';
      }

      if (['cancelled', 'failed', 'missed', 'critical'].includes(normalized)) {
        return 'danger';
      }

      if (['preparing', 'out_for_delivery', 'requested', 'modified', 'urgent', 'contacted'].includes(normalized)) {
        return 'warning';
      }

      return 'neutral';
    }

    function renderStatus(value) {
      return `<span class="mini-status ${statusClass(value)}">${escapeHtml(prettyStatus(value))}</span>`;
    }

    function formatDateTime(value) {
      if (!value) return '-';
      const date = new Date(String(value).replace(' ', 'T'));

      if (Number.isNaN(date.getTime())) {
        return String(value);
      }

      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(date);
    }

    function formatDuration(seconds) {
      const totalSeconds = Number(seconds || 0);

      if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
        return '-';
      }

      const minutes = Math.floor(totalSeconds / 60);
      const remainingSeconds = totalSeconds % 60;
      return minutes ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
    }

    function renderOrders(orders) {
      if (!ordersTableBody) return;

      if (!orders.length) {
        setTableMessage(ordersTableBody, 5, 'No orders yet for this customer account.');
        return;
      }

      ordersTableBody.innerHTML = orders.map(order => `
        <tr>
          <td>${escapeHtml(order.customer_name || 'Guest')}</td>
          <td>${escapeHtml(order.customer_phone || '-')}</td>
          <td class="table-main-cell">${escapeHtml(order.order_items || '-')}</td>
          <td>${renderStatus(order.order_status)}</td>
          <td>${escapeHtml(formatDateTime(order.created_at))}</td>
        </tr>
      `).join('');
    }

    function renderReservations(reservations) {
      if (!reservationsTableBody) return;

      if (!reservations.length) {
        setTableMessage(reservationsTableBody, 6, 'No reservations yet for this customer account.');
        return;
      }

      reservationsTableBody.innerHTML = reservations.map(reservation => `
        <tr>
          <td>${escapeHtml(reservation.guest_name || 'Guest')}</td>
          <td>${escapeHtml(reservation.guest_phone || '-')}</td>
          <td>${escapeHtml(reservation.reservation_date || '-')}</td>
          <td>${escapeHtml(reservation.reservation_time || '-')}</td>
          <td>${escapeHtml(reservation.party_size || '-')}</td>
          <td>${renderStatus(reservation.status)}</td>
        </tr>
      `).join('');
    }

    function renderCalls(calls) {
      if (!callsTableBody) return;

      if (!calls.length) {
        setTableMessage(callsTableBody, 5, 'No call logs yet for this customer account.');
        return;
      }

      callsTableBody.innerHTML = calls.map(call => `
        <tr>
          <td>${escapeHtml(call.caller_phone || '-')}</td>
          <td>${escapeHtml(prettyStatus(call.call_type || 'unknown'))}</td>
          <td>${renderStatus(call.call_status)}</td>
          <td>${escapeHtml(formatDuration(call.duration_seconds))}</td>
          <td class="table-main-cell">${escapeHtml(call.ai_summary || call.call_sid || '-')}</td>
        </tr>
      `).join('');
    }

    function handoffSummary(handoff) {
      return [
        handoff.reason,
        handoff.conversation_summary,
        handoff.related_details ? `Details: ${handoff.related_details}` : '',
        handoff.best_callback_time ? `Best callback: ${handoff.best_callback_time}` : ''
      ].filter(Boolean).join(' | ');
    }

    function renderHandoffs(handoffs) {
      if (!handoffsTableBody) return;

      if (!handoffs.length) {
        setTableMessage(handoffsTableBody, 6, 'No handoff requests yet.');
        return;
      }

      handoffsTableBody.innerHTML = handoffs.map(handoff => {
        const notification = [
          handoff.notification_channel || 'dashboard',
          handoff.notification_status || 'saved',
          handoff.notification_target || ''
        ].filter(Boolean).join(' / ');
        const disabled = ['resolved', 'cancelled'].includes(String(handoff.status || '').toLowerCase()) ? 'disabled' : '';

        return `
          <tr>
            <td>
              <strong>${escapeHtml(handoff.customer_name || 'Customer')}</strong>
              <small>${escapeHtml(handoff.customer_phone || '-')}</small>
            </td>
            <td>${renderStatus(handoff.urgency || 'normal')}</td>
            <td class="table-main-cell">${escapeHtml(handoffSummary(handoff) || '-')}</td>
            <td>${escapeHtml(notification)}</td>
            <td>${renderStatus(handoff.status || 'new')}</td>
            <td>
              <button class="compact-button ghost handoff-action" type="button" data-handoff-id="${escapeHtml(handoff.id)}" data-next-status="contacted" ${disabled}>Contacted</button>
              <button class="compact-button ghost handoff-action" type="button" data-handoff-id="${escapeHtml(handoff.id)}" data-next-status="resolved" ${disabled}>Resolved</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function percent(value, total) {
      if (!total) return 0;
      return Math.round((value / total) * 100);
    }

    function eventDate(value) {
      const date = new Date(String(value || '').replace(' ', 'T'));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    function renderOverviewAnalytics({ orders = [], reservations = [], calls = [], handoffs = [] }) {
      const pendingHandoffs = handoffs.filter(handoff => !['resolved', 'cancelled'].includes(String(handoff.status || '').toLowerCase()));
      const callTotal = calls.length;
      const actionTotal = orders.length + reservations.length + handoffs.length;

      if (statHandoffs) {
        statHandoffs.textContent = pendingHandoffs.length;
      }

      if (overviewConversionRate) {
        overviewConversionRate.textContent = `${percent(actionTotal, callTotal)}% action rate`;
      }

      if (overviewCallMix) {
        const rows = [
          { label: 'Orders', value: orders.length, className: 'orders' },
          { label: 'Reservations', value: reservations.length, className: 'reservations' },
          { label: 'Manager handoffs', value: handoffs.length, className: 'handoffs' },
          { label: 'All calls', value: callTotal, className: 'calls' },
        ];
        const max = Math.max(...rows.map(row => row.value), 1);
        overviewCallMix.innerHTML = rows.map(row => `
          <div class="analytics-row">
            <div class="analytics-row-head">
              <span>${escapeHtml(row.label)}</span>
              <strong>${escapeHtml(row.value)}</strong>
            </div>
            <div class="analytics-track"><span class="analytics-fill ${row.className}" style="width: ${Math.max(percent(row.value, max), 4)}%"></span></div>
          </div>
        `).join('');
      }

      if (overviewActivityChart) {
        const now = new Date();
        const days = Array.from({ length: 7 }, (_, index) => {
          const date = new Date(now);
          date.setDate(now.getDate() - (6 - index));
          const key = date.toISOString().slice(0, 10);
          return { date, key, total: 0 };
        });
        const dayMap = new Map(days.map(day => [day.key, day]));
        [...orders, ...reservations, ...calls, ...handoffs].forEach(item => {
          const date = eventDate(item.created_at);
          if (!date) return;
          const key = date.toISOString().slice(0, 10);
          if (dayMap.has(key)) dayMap.get(key).total += 1;
        });
        const max = Math.max(...days.map(day => day.total), 1);
        const total = days.reduce((sum, day) => sum + day.total, 0);
        if (overviewActivityTotal) overviewActivityTotal.textContent = `${total} events`;
        overviewActivityChart.innerHTML = days.map(day => `
          <div class="activity-day">
            <div class="activity-bar"><span style="height: ${Math.max(percent(day.total, max), day.total ? 6 : 0)}%"></span></div>
            <strong>${escapeHtml(day.total)}</strong>
            <small>${escapeHtml(day.date.toLocaleDateString(undefined, { weekday: 'short' }))}</small>
          </div>
        `).join('');
      }

      if (overviewManagerStatus) {
        overviewManagerStatus.textContent = pendingHandoffs.length ? `${pendingHandoffs.length} pending` : 'No pending issues';
      }

      if (overviewActionList) {
        const items = pendingHandoffs.slice(0, 4);
        if (!items.length) {
          overviewActionList.innerHTML = '<div class="analytics-empty">No manager callbacks are waiting right now.</div>';
        } else {
          overviewActionList.innerHTML = items.map(handoff => `
            <div class="overview-action-item">
              <strong>${escapeHtml(handoff.customer_name || 'Customer')}</strong>
              <span>${escapeHtml(handoff.reason || handoff.conversation_summary || 'Manager callback requested')}</span>
              ${renderStatus(handoff.urgency || 'normal')}
              <small>${escapeHtml(handoff.customer_phone || '-')}</small>
              <small>${escapeHtml(formatDateTime(handoff.created_at))}</small>
              <small>${escapeHtml(handoff.status || 'new')}</small>
            </div>
          `).join('');
        }
      }
    }

    async function loadOperationalTables() {
      try {
        setTableMessage(ordersTableBody, 5, 'Loading orders...');
        setTableMessage(reservationsTableBody, 6, 'Loading reservations...');
        setTableMessage(callsTableBody, 5, 'Loading call logs...');
        setTableMessage(handoffsTableBody, 6, 'Loading handoff requests...');

        const [ordersResult, reservationsResult, callsResult, handoffsResult] = await Promise.allSettled([
          apiRequest('orders.php'),
          apiRequest('reservations.php'),
          apiRequest('call_logs.php'),
          apiRequest('handoff_requests.php')
        ]);

        if (ordersResult.status === 'fulfilled') {
          renderOrders(ordersResult.value.orders || []);
        } else {
          setTableMessage(ordersTableBody, 5, ordersResult.reason.message || 'Could not load orders.', 'error');
        }

        if (reservationsResult.status === 'fulfilled') {
          renderReservations(reservationsResult.value.reservations || []);
        } else {
          setTableMessage(reservationsTableBody, 6, reservationsResult.reason.message || 'Could not load reservations.', 'error');
        }

        if (callsResult.status === 'fulfilled') {
          renderCalls(callsResult.value.calls || []);
        } else {
          setTableMessage(callsTableBody, 5, callsResult.reason.message || 'Could not load call logs.', 'error');
        }

        if (handoffsResult.status === 'fulfilled') {
          renderHandoffs(handoffsResult.value.handoffs || []);
        } else {
          setTableMessage(handoffsTableBody, 6, handoffsResult.reason.message || 'Could not load handoff requests.', 'error');
        }

        renderOverviewAnalytics({
          orders: ordersResult.status === 'fulfilled' ? ordersResult.value.orders || [] : [],
          reservations: reservationsResult.status === 'fulfilled' ? reservationsResult.value.reservations || [] : [],
          calls: callsResult.status === 'fulfilled' ? callsResult.value.calls || [] : [],
          handoffs: handoffsResult.status === 'fulfilled' ? handoffsResult.value.handoffs || [] : [],
        });
      } catch (error) {
        const message = error.message || 'Could not load operational data.';
        setTableMessage(ordersTableBody, 5, message, 'error');
        setTableMessage(reservationsTableBody, 6, message, 'error');
        setTableMessage(callsTableBody, 5, message, 'error');
        setTableMessage(handoffsTableBody, 6, message, 'error');
        renderOverviewAnalytics({});
      }
    }

    async function loadDashboard() {
      if (!getAuthToken()) {
        window.location.href = 'login.html';
        return;
      }

      try {
        const payload = await apiRequest('dashboard_summary.php');
        const user = payload.user || JSON.parse(localStorage.getItem('xorvianUser') || 'null');
        const summary = payload.summary || {};

        if (user) {
          dashboardName.textContent = `${user.firstName} ${user.secondName}`;
          dashboardEmail.textContent = user.email;
          if (dashboardEmailCopy) dashboardEmailCopy.textContent = user.email;
        }

        statCalls.textContent = summary.calls ?? '0';
        statOrders.textContent = summary.orders ?? '0';
        statReservations.textContent = summary.reservations ?? '0';
        if (statHandoffs) statHandoffs.textContent = '0';
        setupStatus.textContent = summary.profileComplete ? 'Profile ready' : 'Profile pending';
        fillProfile(payload.profile);
        fillAgentSettings(payload.agent, payload.workflow);
        loadMenu();
        loadOperationalTables();
      } catch (error) {
        clearAuthSession();
        window.location.href = 'login.html';
      }
    }

    async function loadMenu() {
      if (!menuForm) return;

      try {
        const payload = await apiRequest('menu.php');
        if (payload.categories && payload.categories.length) {
          const categories = payload.categories.map(category => ({
            name: category.name,
            items: (category.items || []).map(item => ({
              name: item.name,
              price: item.price,
              sizes: item.sizes_json ? JSON.parse(item.sizes_json) : undefined,
              description: item.description || undefined,
              modifiers: item.modifiers || undefined,
              isAvailable: String(item.is_available) === '1'
            }))
          }));
          menuForm.elements.menuJson.value = JSON.stringify(categories, null, 2);
          if (menuTextInput) {
            menuTextInput.value = categories.map(category => {
              const items = category.items.map(item => {
                if (item.sizes && Object.keys(item.sizes).length) {
                  const sizes = Object.entries(item.sizes)
                    .map(([size, price]) => `${size.replace(/_/g, ' ')} ${price}`)
                    .join(', ');
                  return `- ${item.name} | ${sizes}`;
                }
                return `- ${item.name}${item.price ? ` | ${item.price}` : ''}`;
              }).join('\n');
              return `${category.name}\n${items}`;
            }).join('\n\n');
          }
        } else if (menuMessage) {
          menuMessage.textContent = 'No menu saved yet. Add menu items and save them here.';
          menuMessage.className = 'auth-message';
        }
      } catch (error) {
        if (menuMessage) {
          menuMessage.textContent = `Menu could not load: ${error.message}`;
          menuMessage.className = 'auth-message error';
        }
      }
    }

    function parseMenuText(menuText) {
      const lines = menuText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

      const categories = [];
      let currentCategory = null;

      function ensureCategory(name) {
        currentCategory = {
          name,
          items: []
        };
        categories.push(currentCategory);
      }

      function parsePrice(value) {
        const match = String(value).match(/(\d+(?:\.\d+)?)/);
        return match ? Number(match[1]) : null;
      }

      function parseItem(line) {
        const cleanLine = line.replace(/^[-*•]\s*/, '').trim();
        const parts = cleanLine.split('|').map(part => part.trim()).filter(Boolean);
        const name = parts[0] || '';

        if (!name) return null;

        const item = { name };
        const detail = parts.slice(1).join(' ');

        if (detail) {
          const sizePairs = detail
            .split(',')
            .map(part => part.trim())
            .map(part => {
              const match = part.match(/^([a-zA-Z][a-zA-Z\s-]*)\s*[:=-]?\s*(?:Rs\.?|PKR)?\s*(\d+(?:\.\d+)?)$/i);
              return match ? [match[1].trim().toLowerCase().replace(/\s+/g, '_'), Number(match[2])] : null;
            })
            .filter(Boolean);

          if (sizePairs.length > 1 || /small|medium|large|family|regular/i.test(detail)) {
            item.sizes = Object.fromEntries(sizePairs);
          } else {
            const price = parsePrice(detail);
            if (price !== null) item.price = price;
          }
        } else {
          const inlinePrice = cleanLine.match(/^(.*?)\s+(?:Rs\.?|PKR)?\s*(\d+(?:\.\d+)?)$/i);
          if (inlinePrice) {
            item.name = inlinePrice[1].trim();
            item.price = Number(inlinePrice[2]);
          }
        }

        return item;
      }

      lines.forEach(line => {
        const isItem = /^[-*•]/.test(line);

        if (!isItem) {
          ensureCategory(line.replace(/:$/, '').trim());
          return;
        }

        if (!currentCategory) {
          ensureCategory('Menu');
        }

        const item = parseItem(line);
        if (item) currentCategory.items.push(item);
      });

      return categories.filter(category => category.name && category.items.length);
    }

    function setMenuConverterStatus(text, type = '') {
      if (!menuConverterStatus) return;
      menuConverterStatus.textContent = text;
      menuConverterStatus.className = type;
    }

    const menuExampleText = `Pizza
- Pizza Club Super Supreme | small 450, medium 880, large 1070, family 1600
- Stuff Crust Pizza | small 499, medium 900, large 1100, family 1600

Burger
- Zinger Burger Crispy | 240
- Chicken Burger | 160

Shawarma
- Chicken Shawarma | 130

Fries
- Small Fries | 170
- Large Fries | 300`;

    if (loadMenuExampleBtn && menuTextInput) {
      loadMenuExampleBtn.addEventListener('click', () => {
        menuTextInput.value = menuExampleText;
        setMenuConverterStatus('Example loaded. Click Convert Text to JSON.', 'success');
      });
    }

    if (convertMenuBtn && menuTextInput && menuForm) {
      convertMenuBtn.addEventListener('click', () => {
        try {
          const categories = parseMenuText(menuTextInput.value);

          if (!categories.length) {
            throw new Error('No menu items found. Add category headings and item lines starting with -');
          }

          menuForm.elements.menuJson.value = JSON.stringify(categories, null, 2);
          setMenuConverterStatus(`Converted ${categories.length} categories to gateway menu JSON.`, 'success');
        } catch (error) {
          setMenuConverterStatus(error.message, 'error');
        }
      });
    }

    if (agentSettingsForm) {
      agentSettingsForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(agentSettingsForm);
        const payload = Object.fromEntries(formData.entries());
        payload.orderEnabled = agentSettingsForm.elements.orderEnabled?.checked || false;
        payload.reservationEnabled = agentSettingsForm.elements.reservationEnabled?.checked || false;
        payload.notificationEnabled = agentSettingsForm.elements.notificationEnabled?.checked || false;
        payload.openaiTemperature = 0.3;
        payload.voiceProvider = 'elevenlabs';
        payload.twilioLanguage = payload.languageCode || 'en-CA';
        payload.outputFormat = 'ulaw_8000';
        payload.orderSheetName = 'Sheet1';
        payload.reservationSheetName = 'Sheet1';
        payload.cloudinaryFolder = 'xorvian-audio';

        try {
          if (agentSettingsMessage) {
            agentSettingsMessage.textContent = 'Saving agent settings...';
            agentSettingsMessage.className = 'auth-message';
          }
          if (workflowSettingsMessage) {
            workflowSettingsMessage.textContent = 'Saving gateway settings...';
            workflowSettingsMessage.className = 'auth-message';
          }
          await apiRequest('agent_settings.php', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          if (agentSettingsMessage) {
            agentSettingsMessage.textContent = 'Agent settings saved.';
            agentSettingsMessage.className = 'auth-message success';
          }
          if (workflowSettingsMessage) {
            workflowSettingsMessage.textContent = 'Gateway settings saved.';
            workflowSettingsMessage.className = 'auth-message success';
          }
          loadDashboard();
        } catch (error) {
          if (agentSettingsMessage) {
            agentSettingsMessage.textContent = error.message;
            agentSettingsMessage.className = 'auth-message error';
          }
          if (workflowSettingsMessage) {
            workflowSettingsMessage.textContent = error.message;
            workflowSettingsMessage.className = 'auth-message error';
          }
        }
      });
    }

    if (menuForm) {
      menuForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
          const categories = JSON.parse(menuForm.elements.menuJson.value);
          if (!Array.isArray(categories)) {
            throw new Error('Menu JSON must be an array of categories.');
          }

          if (menuMessage) {
            menuMessage.textContent = 'Saving menu...';
            menuMessage.className = 'auth-message';
          }

          await apiRequest('menu.php', {
            method: 'POST',
            body: JSON.stringify({ categories })
          });

          if (profileForm) {
            const profilePayload = Object.fromEntries(new FormData(profileForm).entries());
            profilePayload.menuNotes = menuForm.elements.menuNotes?.value || '';
            profilePayload.knowledgeBase = menuForm.elements.knowledgeBase?.value || '';
            await apiRequest('restaurant_profile.php', {
              method: 'POST',
              body: JSON.stringify(profilePayload)
            });
          }

          if (menuMessage) {
            menuMessage.textContent = 'Menu saved.';
            menuMessage.className = 'auth-message success';
          }
        } catch (error) {
          if (menuMessage) {
            menuMessage.textContent = error.message;
            menuMessage.className = 'auth-message error';
          }
        }
      });
    }

    if (workflowShortcutForm && agentSettingsForm) {
      workflowShortcutForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (typeof agentSettingsForm.requestSubmit === 'function') {
          agentSettingsForm.requestSubmit();
        } else {
          agentSettingsForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      });
    }

    operationalRefreshButtons.forEach(button => {
      button.addEventListener('click', () => {
        loadOperationalTables();
      });
    });

    if (handoffsTableBody) {
      handoffsTableBody.addEventListener('click', async (event) => {
        const button = event.target.closest('.handoff-action');
        if (!button) return;

        button.disabled = true;
        try {
          await apiRequest('handoff_requests.php', {
            method: 'POST',
            body: JSON.stringify({
              id: button.getAttribute('data-handoff-id'),
              status: button.getAttribute('data-next-status'),
              managerNotes: ''
            })
          });
          loadOperationalTables();
        } catch (error) {
          button.disabled = false;
          setTableMessage(handoffsTableBody, 6, error.message, 'error');
        }
      });
    }

    if (profileForm) {
      profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(profileForm);
        const payload = Object.fromEntries(formData.entries());

        try {
          showDashboardMessage('Saving restaurant profile...', '');
          const response = await apiRequest('restaurant_profile.php', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          fillProfile(response.profile);
          showDashboardMessage('Restaurant profile saved.', 'success');
        } catch (error) {
          showDashboardMessage(error.message, 'error');
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await apiRequest('logout.php', { method: 'POST' });
        } catch (error) {
          // Local logout should still happen if the token has already expired.
        }

        clearAuthSession();
        window.location.href = 'login.html';
      });
    }

    loadDashboard();
  }

  // --- Admin Dashboard ---
  const adminRoot = document.getElementById('admin-root');

  if (adminRoot) {
    const adminShell = document.querySelector('.admin-control-shell');
    const adminSidebarToggle = document.getElementById('admin-sidebar-toggle');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const adminUserEmail = document.getElementById('admin-user-email');
    const adminMessage = document.getElementById('admin-message');
    const adminCurrentSection = document.getElementById('admin-current-section');
    const adminApiEnvironment = document.getElementById('admin-api-environment');
    const adminRefreshBtn = document.getElementById('admin-refresh-btn');
    const adminSearchInput = document.getElementById('admin-search-input');
    const adminStatusFilter = document.getElementById('admin-status-filter');
    const adminViewButtons = document.querySelectorAll('[data-admin-view]');
    const adminViews = document.querySelectorAll('[id^="admin-view-"]');
    const customersTable = document.getElementById('admin-customers-table');
    const adminOrdersTable = document.getElementById('admin-orders-table');
    const adminReservationsTable = document.getElementById('admin-reservations-table');
    const adminCallsTable = document.getElementById('admin-calls-table');
    const adminActivityList = document.getElementById('admin-activity-list');
    const adminWorkflowTemplate = document.getElementById('admin-workflow-template');
    const adminFieldList = document.getElementById('admin-field-list');
    let adminPayloadCache = null;

    function setText(id, value) {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    }

    function showAdminMessage(text, type = '') {
      if (!adminMessage) return;
      adminMessage.textContent = text;
      adminMessage.className = `auth-message ${type}`.trim();
    }

    function openAdminView(viewName) {
      adminViews.forEach(view => {
        const isActive = view.id === `admin-view-${viewName}`;
        view.classList.toggle('active', isActive);
        if (isActive && adminCurrentSection) {
          adminCurrentSection.textContent = view.getAttribute('data-view-title') || viewName;
        }
      });

      adminViewButtons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-admin-view') === viewName);
      });
    }

    function setAdminTableMessage(tableBody, colspan, message, type = '') {
      if (!tableBody) return;
      tableBody.innerHTML = `<tr><td colspan="${colspan}" class="table-message ${type}">${escapeHtml(message)}</td></tr>`;
    }

    function adminStatusClass(value) {
      const normalized = String(value || '').toLowerCase();
      if (['active', 'completed', 'confirmed', 'answered'].includes(normalized)) return 'success';
      if (['disabled', 'failed', 'cancelled', 'missed'].includes(normalized)) return 'danger';
      if (['requested', 'new', 'preparing', 'unknown'].includes(normalized)) return 'warning';
      return 'neutral';
    }

    function adminPretty(value) {
      return String(value || '-').replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    }

    function adminStatus(value) {
      return `<span class="mini-status ${adminStatusClass(value)}">${escapeHtml(adminPretty(value))}</span>`;
    }

    function adminDate(value) {
      if (!value) return '-';
      const date = new Date(String(value).replace(' ', 'T'));
      if (Number.isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
    }

    function renderAdminCustomers(customers) {
      if (!customersTable) return;
      const query = (adminSearchInput?.value || '').trim().toLowerCase();
      const status = adminStatusFilter?.value || '';
      const filtered = customers.filter(customer => {
        const haystack = [
          customer.first_name,
          customer.second_name,
          customer.email,
          customer.restaurant_name,
          customer.business_phone,
          customer.twilio_phone,
          customer.city,
          customer.cuisine_type
        ].join(' ').toLowerCase();
        return (!query || haystack.includes(query)) && (!status || customer.status === status);
      });

      if (!filtered.length) {
        setAdminTableMessage(customersTable, 8, 'No customers match the current filter.');
        return;
      }

      customersTable.innerHTML = filtered.map(customer => {
        const nextStatus = customer.status === 'active' ? 'disabled' : 'active';
        const actionLabel = customer.status === 'active' ? 'Disable' : 'Activate';
        const usage = `${customer.total_calls || 0} calls / ${customer.total_orders || 0} orders / ${customer.total_reservations || 0} bookings`;

        return `
          <tr>
            <td>
              <strong>${escapeHtml(customer.first_name)} ${escapeHtml(customer.second_name)}</strong>
              <small>ID ${escapeHtml(customer.id)}</small>
            </td>
            <td>
              <strong>${escapeHtml(customer.restaurant_name || 'Profile pending')}</strong>
              <small>${escapeHtml([customer.city, customer.country].filter(Boolean).join(', ') || customer.cuisine_type || 'No location')}</small>
            </td>
            <td>
              <strong>${escapeHtml(customer.email)}</strong>
              <small>${escapeHtml(customer.business_phone || 'No business phone')}</small>
            </td>
            <td>${escapeHtml(customer.twilio_phone || 'Not set')}</td>
            <td>
              <strong>${escapeHtml(customer.voice_model || 'eleven_flash_v2')}</strong>
              <small>${escapeHtml(customer.n8n_webhook_path || 'Webhook pending')}</small>
            </td>
            <td>${escapeHtml(usage)}</td>
            <td>${adminStatus(customer.status || 'active')}</td>
            <td><button class="compact-button ghost admin-status-action" type="button" data-customer-id="${escapeHtml(customer.id)}" data-next-status="${escapeHtml(nextStatus)}">${actionLabel}</button></td>
          </tr>
        `;
      }).join('');
    }

    function renderAdminOrders(orders) {
      if (!adminOrdersTable) return;
      if (!orders.length) {
        setAdminTableMessage(adminOrdersTable, 5, 'No orders saved yet.');
        return;
      }
      adminOrdersTable.innerHTML = orders.map(order => `
        <tr>
          <td>${escapeHtml(order.customer_name || order.account_email || 'Guest')}</td>
          <td>${escapeHtml(order.restaurant_name || 'Restaurant')}</td>
          <td class="table-main-cell">${escapeHtml(order.order_items || '-')}</td>
          <td>${adminStatus(order.order_status || 'new')}</td>
          <td>${escapeHtml(adminDate(order.created_at))}</td>
        </tr>
      `).join('');
    }

    function renderAdminReservations(reservations) {
      if (!adminReservationsTable) return;
      if (!reservations.length) {
        setAdminTableMessage(adminReservationsTable, 5, 'No reservations saved yet.');
        return;
      }
      adminReservationsTable.innerHTML = reservations.map(reservation => `
        <tr>
          <td>${escapeHtml(reservation.guest_name || reservation.account_email || 'Guest')}</td>
          <td>${escapeHtml(reservation.restaurant_name || 'Restaurant')}</td>
          <td>${escapeHtml([reservation.reservation_date, reservation.reservation_time].filter(Boolean).join(' ') || '-')}</td>
          <td>${escapeHtml(reservation.party_size || '-')}</td>
          <td>${adminStatus(reservation.status || 'requested')}</td>
        </tr>
      `).join('');
    }

    function renderAdminCalls(calls) {
      if (!adminCallsTable) return;
      if (!calls.length) {
        setAdminTableMessage(adminCallsTable, 7, 'No calls logged yet.');
        return;
      }
      adminCallsTable.innerHTML = calls.map(call => `
        <tr>
          <td>${escapeHtml(call.caller_phone || '-')}</td>
          <td>${escapeHtml(call.restaurant_name || 'Restaurant')}</td>
          <td>${escapeHtml(call.account_email || '-')}</td>
          <td>${escapeHtml(adminPretty(call.call_type || 'unknown'))}</td>
          <td>${adminStatus(call.call_status || 'answered')}</td>
          <td class="table-main-cell">${escapeHtml(call.ai_summary || call.call_sid || '-')}</td>
          <td>${escapeHtml(adminDate(call.created_at))}</td>
        </tr>
      `).join('');
    }

    function renderAdminActivity(payload) {
      if (!adminActivityList) return;
      const activity = [
        ...(payload.calls || []).slice(0, 4).map(item => ({ type: 'Call', text: item.ai_summary || item.caller_phone || 'Incoming call', time: item.created_at })),
        ...(payload.orders || []).slice(0, 4).map(item => ({ type: 'Order', text: item.order_items || item.customer_name || 'New order', time: item.created_at })),
        ...(payload.reservations || []).slice(0, 4).map(item => ({ type: 'Booking', text: item.guest_name || item.reservation_date || 'Reservation request', time: item.created_at }))
      ].sort((a, b) => new Date(String(b.time).replace(' ', 'T')) - new Date(String(a.time).replace(' ', 'T'))).slice(0, 8);

      if (!activity.length) {
        adminActivityList.innerHTML = '<p class="muted-copy">No platform activity yet.</p>';
        return;
      }

      adminActivityList.innerHTML = activity.map(item => `
        <div class="admin-activity-item">
          <span>${escapeHtml(item.type)}</span>
          <strong>${escapeHtml(item.text)}</strong>
          <small>${escapeHtml(adminDate(item.time))}</small>
        </div>
      `).join('');
    }

    function renderWorkflowTemplate(template) {
      if (adminWorkflowTemplate) {
        adminWorkflowTemplate.innerHTML = `
          <div><span>OpenAI</span><strong>${escapeHtml(template.openaiModel || 'gpt-4o-mini')}</strong></div>
          <div><span>Voice Provider</span><strong>${escapeHtml(template.voiceProvider || 'elevenlabs')}</strong></div>
          <div><span>Voice Model</span><strong>${escapeHtml(template.voiceModel || 'eleven_flash_v2')}</strong></div>
          <div><span>Voice ID</span><strong>${escapeHtml(template.voiceId || 'ugPTAEnkrnbtfSNMzaSY')}</strong></div>
          <div><span>Twilio Language</span><strong>${escapeHtml(template.twilioLanguage || 'en-US')}</strong></div>
          <div><span>Output Format</span><strong>${escapeHtml(template.outputFormat || 'mp3_44100_128')}</strong></div>
        `;
      }

      if (adminFieldList) {
        const fields = [...(template.orderFields || []), ...(template.reservationFields || [])];
        adminFieldList.innerHTML = [...new Set(fields)].map(field => `<span>${escapeHtml(field)}</span>`).join('');
      }
    }

    function renderAdminDashboard(payload) {
      const summary = payload.summary || {};
      setText('admin-total-customers', summary.totalCustomers || 0);
      setText('admin-active-users', summary.activeUsers || 0);
      setText('admin-monthly-revenue', `$${summary.monthlyRevenue || 0}`);
      setText('admin-configured-agents', summary.configuredAgents || 0);
      setText('admin-total-orders', summary.orders || 0);
      setText('admin-total-reservations', summary.reservations || 0);
      setText('admin-total-calls', summary.calls || 0);
      setText('admin-pending-profiles', summary.pendingProfiles || 0);
      setText('admin-system-status', 'Online');

      renderAdminCustomers(payload.customers || []);
      renderAdminOrders(payload.orders || []);
      renderAdminReservations(payload.reservations || []);
      renderAdminCalls(payload.calls || []);
      renderAdminActivity(payload);
      renderWorkflowTemplate(payload.workflowTemplate || {});
    }

    async function loadAdminDashboard() {
      if (!getAuthToken()) {
        window.location.href = 'login.html';
        return;
      }

      try {
        const user = JSON.parse(localStorage.getItem('xorvianUser') || 'null');
        if (user && user.role !== 'admin') {
          window.location.href = 'dashboard.html';
          return;
        }

        if (user && adminUserEmail) adminUserEmail.textContent = user.email;

        const payload = await apiRequest('admin_summary.php');
        adminPayloadCache = payload;
        renderAdminDashboard(payload);
        showAdminMessage('', '');
      } catch (error) {
        if (String(error.message).includes('Admin access')) {
          window.location.href = 'dashboard.html';
          return;
        }

        if (String(error.message).includes('Invalid or expired token') || String(error.message).includes('Missing bearer token')) {
          clearAuthSession();
          window.location.href = 'login.html';
          return;
        }

        showAdminMessage(error.message, 'error');
      }
    }

    if (adminApiEnvironment) {
      const isLiveApi = API_BASE.includes('aliportfolio.org');
      adminApiEnvironment.textContent = isLiveApi ? 'Live API' : 'Local API';
      adminApiEnvironment.title = API_BASE;
    }

    adminViewButtons.forEach(button => {
      button.addEventListener('click', () => openAdminView(button.getAttribute('data-admin-view')));
    });

    if (adminSidebarToggle && adminShell) {
      adminSidebarToggle.addEventListener('click', () => {
        adminShell.classList.toggle('sidebar-collapsed');
      });
    }

    if (adminRefreshBtn) {
      adminRefreshBtn.addEventListener('click', () => {
        showAdminMessage('Refreshing admin data...', '');
        loadAdminDashboard();
      });
    }

    if (adminSearchInput) {
      adminSearchInput.addEventListener('input', () => {
        renderAdminCustomers(adminPayloadCache?.customers || []);
      });
    }

    if (adminStatusFilter) {
      adminStatusFilter.addEventListener('change', () => {
        renderAdminCustomers(adminPayloadCache?.customers || []);
      });
    }

    if (customersTable) {
      customersTable.addEventListener('click', async (event) => {
        const button = event.target.closest('.admin-status-action');
        if (!button) return;

        try {
          button.disabled = true;
          button.textContent = 'Saving...';
          await apiRequest('admin_customer_status.php', {
            method: 'POST',
            body: JSON.stringify({
              customerId: Number(button.getAttribute('data-customer-id')),
              status: button.getAttribute('data-next-status')
            })
          });
          showAdminMessage('Customer status updated.', 'success');
          await loadAdminDashboard();
        } catch (error) {
          button.disabled = false;
          showAdminMessage(error.message, 'error');
          renderAdminCustomers(adminPayloadCache?.customers || []);
        }
      });
    }

    if (adminLogoutBtn) {
      adminLogoutBtn.addEventListener('click', async () => {
        try {
          await apiRequest('logout.php', { method: 'POST' });
        } catch (error) {
          // Continue with local logout.
        }
        clearAuthSession();
        window.location.href = 'login.html';
      });
    }

    loadAdminDashboard();
  }

  // --- Static form feedback ---
  const contactForm = document.getElementById('contact-form');
  const newsletterForm = document.querySelector('.footer-newsletter-form');

  if (contactForm) {
    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      alert('Thanks. Your demo request is ready to connect with the backend in the next phase.');
      contactForm.reset();
    });
  }

  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (event) => {
      event.preventDefault();
      alert('Subscribed successfully for the static demo.');
      newsletterForm.reset();
    });
  }
});
