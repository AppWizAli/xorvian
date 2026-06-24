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

  function pagePath(page) {
    if (window.location.protocol === 'file:') {
      return `${page}.html`;
    }

    return page === 'index' ? './' : page;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function initLiveDemoPage() {
    const root = document.getElementById('live-demo-root');
    if (!root) return;

    const scenarioSelect = document.getElementById('demo-scenario');
    const languageSelect = document.getElementById('demo-language');
    const startBtn = document.getElementById('demo-start');
    const resetBtn = document.getElementById('demo-reset');
    const statusPill = document.getElementById('demo-status');
    const stageLabel = document.getElementById('demo-stage');
    const timerLabel = document.getElementById('demo-timer');
    const restaurantLabel = document.getElementById('demo-restaurant-name');
    const callerLabel = document.getElementById('demo-caller-number');
    const routeLabel = document.getElementById('demo-route');
    const scenarioLabel = document.getElementById('demo-call-type');
    const languageLabel = document.getElementById('demo-language-label');
    const transcriptFeed = document.getElementById('demo-transcript');
    const orderCard = document.getElementById('demo-order-card');
    const reservationCard = document.getElementById('demo-reservation-card');
    const handoffCard = document.getElementById('demo-handoff-card');
    const outcomeCard = document.getElementById('demo-outcome-card');
    const answerRateLabel = document.getElementById('demo-answer-rate');
    const latencyLabel = document.getElementById('demo-latency');
    const syncLabel = document.getElementById('demo-sync');

    const audioContextClass = window.AudioContext || window.webkitAudioContext;
    const languageProfiles = {
      en: {
        label: 'English',
        locale: 'en-US',
        opening: 'Hi, I want to place a pickup order.',
        greeting: 'Absolutely. I can help with that.',
      },
      es: {
        label: 'Spanish',
        locale: 'es-ES',
        opening: 'Hola, quiero hacer un pedido para recoger.',
        greeting: 'Claro, con gusto le ayudo.',
      },
      hi: {
        label: 'Hindi',
        locale: 'hi-IN',
        opening: 'Namaste, mujhe ek pickup order dena hai.',
        greeting: 'Bilkul, main madad karta hoon.',
      },
      zh: {
        label: 'Mandarin',
        locale: 'zh-CN',
        opening: 'Ni hao, wo xiang dian yi ge wai dai ding dan.',
        greeting: 'Dang ran, wo lai bang nin.',
      },
    };

    function makeScenario(languageKey) {
      const lang = languageProfiles[languageKey] || languageProfiles.en;

      return {
        order: {
          title: 'Pickup order',
          restaurant: "DePietro's Pizza",
          caller: '+1 (415) 555-0123',
          city: 'San Francisco, CA',
          route: 'Existing number -> Xorvian live gateway -> POS',
          callType: 'Order capture',
          statusHint: 'Order sent',
          outcome: 'Ticket #8210 synchronized to kitchen POS.',
          order: {
            title: 'Order ticket',
            items: ['2x Pepperoni Pizza', '1x Pesto Pasta', '1x Coke'],
            total: '$62.50',
            footer: 'Ready for pickup in about 25 minutes.',
            note: 'Includes dynamic upsell and special instructions.',
          },
          reservation: null,
          handoff: null,
          transcript: [
            { speaker: 'customer', text: lang.opening },
            { speaker: 'agent', text: lang.greeting },
            { speaker: 'customer', text: 'Can you make the pizzas large and add garlic bread?' },
            { speaker: 'agent', text: 'Absolutely. I have the full ticket at $62.50 and I am sending it to the POS now.' },
            { speaker: 'customer', text: 'Perfect. See you soon.' },
            { speaker: 'agent', text: 'You are all set. Your pickup order is confirmed.' },
          ],
          updates: [
            { delay: 6500, type: 'order' },
          ],
        },
        reservation: {
          title: 'Dinner reservation',
          restaurant: 'Island Grill & Pub',
          caller: '+1 (803) 555-0172',
          city: 'Rock Hill, SC',
          route: 'Existing number -> Xorvian live gateway -> reservation log',
          callType: 'Reservation',
          statusHint: 'Reservation booked',
          outcome: 'Confirmation written to the reservation queue.',
          order: null,
          reservation: {
            title: 'Reservation card',
            guest: 'Jordan Lee',
            date: 'Friday, June 21',
            time: '7:00 PM',
            party: '4 guests',
            footer: 'Table request: window booth, if available.',
            note: 'Confirmation can be modified or cancelled later.',
          },
          handoff: null,
          transcript: [
            { speaker: 'customer', text: 'Hi, do you have a table for four at 7:00 tonight?' },
            { speaker: 'agent', text: 'Let me check availability for you right now.' },
            { speaker: 'customer', text: 'It is for my family, and we need a booth if possible.' },
            { speaker: 'agent', text: 'You are booked for 7:00 PM. I am saving the reservation and noting the booth request.' },
            { speaker: 'customer', text: 'Perfect, thank you.' },
            { speaker: 'agent', text: 'Your table is confirmed and the details are saved.' },
          ],
          updates: [
            { delay: 6500, type: 'reservation' },
          ],
        },
        handoff: {
          title: 'Manager handoff',
          restaurant: 'Fiery Nashville Hot Chicken',
          caller: '+1 (615) 555-0198',
          city: 'Nashville, TN',
          route: 'Existing number -> Xorvian live gateway -> SMS / dashboard handoff',
          callType: 'Handoff',
          statusHint: 'Manager notified',
          outcome: 'Urgent callback request created with caller context.',
          order: null,
          reservation: null,
          handoff: {
            title: 'Handoff request',
            customer: 'Chris Walker',
            urgency: 'Urgent',
            reason: 'Wrong item in the bag',
            target: 'Manager SMS and dashboard queue',
            footer: 'Best callback time: as soon as possible.',
            note: 'The caller summary stays attached to the request.',
          },
          transcript: [
            { speaker: 'customer', text: 'I need to talk to the manager about my order.' },
            { speaker: 'agent', text: 'I am sorry about that. I can document everything and alert the manager right now.' },
            { speaker: 'customer', text: 'The order had the wrong items and I need a callback.' },
            { speaker: 'agent', text: 'Understood. I have created an urgent handoff with the full summary and sent the notification.' },
            { speaker: 'customer', text: 'Thank you.' },
            { speaker: 'agent', text: 'You will hear back from the team shortly.' },
          ],
          updates: [
            { delay: 6500, type: 'handoff' },
          ],
        },
      };
    }

    let timerHandle = null;
    let timerStart = 0;
    let scheduledHandles = [];
    let isRunning = false;

    function currentLanguage() {
      return languageProfiles[languageSelect?.value || 'en'] || languageProfiles.en;
    }

    function currentScenario() {
      const scenarios = makeScenario(languageSelect?.value || 'en');
      return scenarios[scenarioSelect?.value || 'order'] || scenarios.order;
    }

    function clearScheduledHandles() {
      scheduledHandles.forEach(handle => clearTimeout(handle));
      scheduledHandles = [];
      if (timerHandle) {
        clearInterval(timerHandle);
        timerHandle = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }

    function formatDuration(totalSeconds) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.floor(totalSeconds % 60);
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function setStatus(text, tone = 'idle') {
      if (!statusPill) return;
      statusPill.textContent = text;
      statusPill.className = `demo-pill demo-pill-${tone}`.trim();
    }

    function setStartButtonState(text, disabled) {
      document.querySelectorAll('[data-demo-action="start"]').forEach(button => {
        button.disabled = disabled;
        button.textContent = text;
      });
    }

    function appendTranscript(speaker, text, meta = '') {
      if (!transcriptFeed) return;
      const roleClass = speaker === 'agent' ? 'demo-message-agent' : speaker === 'system' ? 'demo-message-system' : 'demo-message-customer';
      const name = speaker === 'agent' ? 'Xorvian' : speaker === 'system' ? 'System' : 'Caller';
      const message = document.createElement('div');
      message.className = `demo-message ${roleClass}`;
      message.innerHTML = `
        <div class="demo-message-meta">${escapeHtml(name)}${meta ? ` <span>${escapeHtml(meta)}</span>` : ''}</div>
        <p>${escapeHtml(text)}</p>
      `;
      transcriptFeed.appendChild(message);
      transcriptFeed.scrollTop = transcriptFeed.scrollHeight;
    }

    function speakLine(text, locale) {
      if (!window.speechSynthesis || !text) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale;
      utterance.rate = 1.02;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    }

    function playStartChime() {
      if (!audioContextClass) return;
      try {
        const audioCtx = new audioContextClass();
        const now = audioCtx.currentTime;
        const playTone = (freq, duration, startTime) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          gainNode.gain.setValueAtTime(0.12, startTime);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          osc.start(startTime);
          osc.stop(startTime + duration);
        };

        playTone(392, 0.14, now);
        playTone(523.25, 0.16, now + 0.12);
        playTone(659.25, 0.18, now + 0.24);
      } catch (error) {
        console.warn('Audio preview unavailable.', error);
      }
    }

    function renderScenarioCards(scenario) {
      if (restaurantLabel) {
        restaurantLabel.textContent = scenario.restaurant;
      }
      if (callerLabel) {
        callerLabel.textContent = `${scenario.caller} - ${scenario.city}`;
      }
      if (routeLabel) {
        routeLabel.textContent = scenario.route;
      }
      if (scenarioLabel) {
        scenarioLabel.textContent = scenario.callType;
      }
      if (languageLabel) {
        languageLabel.textContent = currentLanguage().label;
      }
      if (answerRateLabel) {
        answerRateLabel.textContent = '100%';
      }
      if (latencyLabel) {
        latencyLabel.textContent = '<800ms';
      }
      if (syncLabel) {
        syncLabel.textContent = 'Live';
      }

      if (orderCard) {
        orderCard.innerHTML = scenario.order
          ? `
            <div class="demo-card-head">
              <span>Orders</span>
              <strong>${escapeHtml(scenario.statusHint)}</strong>
            </div>
            <h3>${escapeHtml(scenario.order.title)}</h3>
            <ul class="demo-list">
              ${scenario.order.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
            <div class="demo-total-row">
              <span>Total</span>
              <strong>${escapeHtml(scenario.order.total)}</strong>
            </div>
            <p>${escapeHtml(scenario.order.footer)}</p>
            <small>${escapeHtml(scenario.order.note)}</small>
          `
          : `
            <div class="demo-card-head">
              <span>Orders</span>
              <strong>Waiting</strong>
            </div>
            <h3>No ticket created</h3>
            <p>This scenario will not create an order ticket.</p>
            <small>Useful for reservation and handoff calls.</small>
          `;
      }

      if (reservationCard) {
        reservationCard.innerHTML = scenario.reservation
          ? `
            <div class="demo-card-head">
              <span>Reservations</span>
              <strong>${escapeHtml(scenario.statusHint)}</strong>
            </div>
            <h3>${escapeHtml(scenario.reservation.title)}</h3>
            <ul class="demo-list">
              <li>Guest: ${escapeHtml(scenario.reservation.guest)}</li>
              <li>Date: ${escapeHtml(scenario.reservation.date)}</li>
              <li>Time: ${escapeHtml(scenario.reservation.time)}</li>
              <li>Party: ${escapeHtml(scenario.reservation.party)}</li>
            </ul>
            <p>${escapeHtml(scenario.reservation.footer)}</p>
            <small>${escapeHtml(scenario.reservation.note)}</small>
          `
          : `
            <div class="demo-card-head">
              <span>Reservations</span>
              <strong>Standing by</strong>
            </div>
            <h3>No table booked</h3>
            <p>This scenario does not need a booking card.</p>
            <small>Reservation calls will populate this panel live.</small>
          `;
      }

      if (handoffCard) {
        handoffCard.innerHTML = scenario.handoff
          ? `
            <div class="demo-card-head">
              <span>Handoffs</span>
              <strong>${escapeHtml(scenario.statusHint)}</strong>
            </div>
            <h3>${escapeHtml(scenario.handoff.title)}</h3>
            <ul class="demo-list">
              <li>Customer: ${escapeHtml(scenario.handoff.customer)}</li>
              <li>Urgency: ${escapeHtml(scenario.handoff.urgency)}</li>
              <li>Reason: ${escapeHtml(scenario.handoff.reason)}</li>
              <li>Target: ${escapeHtml(scenario.handoff.target)}</li>
            </ul>
            <p>${escapeHtml(scenario.handoff.footer)}</p>
            <small>${escapeHtml(scenario.handoff.note)}</small>
          `
          : `
            <div class="demo-card-head">
              <span>Handoffs</span>
              <strong>Idle</strong>
            </div>
            <h3>No escalation needed</h3>
            <p>This scenario resolves without a manager callback.</p>
            <small>Urgent issues can be routed to SMS or dashboard.</small>
          `;
      }

      if (outcomeCard) {
        outcomeCard.innerHTML = `
          <div class="demo-card-head">
            <span>Call outcome</span>
            <strong>${escapeHtml(scenario.callType)}</strong>
          </div>
          <h3>${escapeHtml(scenario.title)}</h3>
          <p>${escapeHtml(scenario.outcome)}</p>
          <small>${escapeHtml(scenario.route)}</small>
        `;
      }
    }

    function resetDemo({ preserveSelection = true } = {}) {
      clearScheduledHandles();
      isRunning = false;
      root.classList.remove('is-running');
      setStartButtonState('Start live demo', false);
      if (timerLabel) {
        timerLabel.textContent = '00:00';
      }
      if (stageLabel) {
        stageLabel.textContent = 'Ready to start';
      }
      setStatus('Idle', 'idle');
      if (transcriptFeed) {
        transcriptFeed.innerHTML = '';
      }
      renderScenarioCards(currentScenario());
      if (!preserveSelection) {
        if (scenarioSelect) scenarioSelect.value = 'order';
        if (languageSelect) languageSelect.value = 'en';
      }
    }

    function startDemo() {
      if (isRunning) return;
      const scenario = currentScenario();
      const language = currentLanguage();
      const locale = language.locale;
      clearScheduledHandles();
      isRunning = true;
      root.classList.add('is-running');
      setStartButtonState('Live demo running', true);
      if (stageLabel) {
        stageLabel.textContent = `${scenario.callType} connecting`;
      }
      if (statusPill) {
        setStatus('Ringing', 'ringing');
      }
      if (transcriptFeed) {
        transcriptFeed.innerHTML = '';
      }
      renderScenarioCards(scenario);
      playStartChime();
      appendTranscript('system', 'Incoming call routed through the live gateway.');

      timerStart = Date.now();
      timerHandle = setInterval(() => {
        if (!timerLabel) return;
        timerLabel.textContent = formatDuration((Date.now() - timerStart) / 1000);
      }, 1000);
      if (timerLabel) {
        timerLabel.textContent = '00:00';
      }

      const setUpdate = (type) => {
        if (!type) return;
        setStatus(type === 'order' ? 'POS syncing' : type === 'reservation' ? 'Booking live' : 'Handoff sent', type);
      };

      scenario.transcript.forEach((line, index) => {
        const delay = 600 + (index * 2200);
        const handle = setTimeout(() => {
          if (!isRunning) return;
          const speaker = line.speaker || 'customer';
          const text = typeof line.text === 'function' ? line.text(language) : line.text;
          appendTranscript(speaker, text, speaker === 'agent' ? 'Xorvian' : '');
          if (speaker === 'agent') {
            speakLine(text, locale);
          }
          if (index === 0 && stageLabel) {
            stageLabel.textContent = 'Live conversation in progress';
            setStatus('Connected', 'live');
          }
          if (index === scenario.transcript.length - 1) {
            if (stageLabel) {
              stageLabel.textContent = 'Call completed';
            }
            setStatus('Complete', 'complete');
            if (timerHandle) {
              clearInterval(timerHandle);
              timerHandle = null;
            }
            setStartButtonState('Replay live demo', false);
            root.classList.remove('is-running');
            isRunning = false;
          }
        }, delay);
        scheduledHandles.push(handle);
      });

      scenario.updates.forEach(update => {
        const handle = setTimeout(() => {
          if (!isRunning) return;
          setUpdate(update.type);
          renderScenarioCards(scenario);
        }, update.delay);
        scheduledHandles.push(handle);
      });
    }

    if (scenarioSelect) {
      scenarioSelect.addEventListener('change', () => resetDemo());
    }

    if (languageSelect) {
      languageSelect.addEventListener('change', () => resetDemo());
    }

    document.querySelectorAll('[data-demo-action="start"]').forEach(button => {
      button.addEventListener('click', startDemo);
    });

    document.querySelectorAll('[data-demo-action="reset"]').forEach(button => {
      button.addEventListener('click', () => resetDemo({ preserveSelection: true }));
    });

    resetDemo();
  }

  initLiveDemoPage();

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

  // --- Live Demo Launch ---
  const experienceButtons = document.querySelectorAll('.btn-experience');
  experienceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = 'live-demo.html';
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
          window.location.href = pagePath('dashboard');
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
        const nextPage = payload.user?.role === 'admin' ? pagePath('admin') : pagePath('dashboard');
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
    const profileSummaryGrid = document.getElementById('profile-summary-grid');
    const assistantSummaryGrid = document.getElementById('assistant-summary-grid');
    const menuSummaryGrid = document.getElementById('menu-summary-grid');
    const workflowSummaryGrid = document.getElementById('workflow-summary-grid');
    const forwardingAssignedNumber = document.getElementById('forwarding-assigned-number');
    const forwardingChecklist = document.getElementById('forwarding-checklist');
    const copyForwardingNumberButton = document.querySelector('[data-copy-forwarding-number]');
    const editSectionButtons = document.querySelectorAll('[data-edit-section]');
    const cancelEditButtons = document.querySelectorAll('[data-cancel-edit]');
    const ordersTableBody = document.getElementById('orders-table-body');
    const customersList = document.getElementById('customers-list');
    const customerDetailPanel = document.getElementById('customer-detail-panel');
    const reservationsTableBody = document.getElementById('reservations-table-body');
    const callsTableBody = document.getElementById('calls-table-body');
    const handoffsTableBody = document.getElementById('handoffs-table-body');
    const operationalRefreshButtons = document.querySelectorAll('[data-refresh-operational]');
    const apiEnvironment = document.getElementById('api-environment');
    const ORDER_STATUSES = ['new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];
    const RESERVATION_STATUSES = ['requested', 'confirmed', 'modified', 'cancelled', 'completed'];
    let activeCustomerPhone = '';
    let latestCustomers = [];
    let latestDashboardSummary = {};

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

    function openEditableSection(formId) {
      const form = document.getElementById(formId);
      if (!form) return;
      form.classList.remove('is-hidden');
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeEditableSection(formId) {
      const form = document.getElementById(formId);
      if (!form) return;
      form.classList.add('is-hidden');
    }

    editSectionButtons.forEach(button => {
      button.addEventListener('click', () => {
        openEditableSection(button.getAttribute('data-edit-section'));
      });
    });

    cancelEditButtons.forEach(button => {
      button.addEventListener('click', () => {
        closeEditableSection(button.getAttribute('data-cancel-edit'));
      });
    });

    function formValue(form, fieldName, fallback = 'Not set') {
      const value = form?.elements?.[fieldName]?.value;
      const text = String(value || '').trim();
      return text || fallback;
    }

    function checkedText(form, fieldName) {
      return form?.elements?.[fieldName]?.checked ? 'Enabled' : 'Disabled';
    }

    function renderSummaryGrid(container, items) {
      if (!container) return;
      container.innerHTML = items.map(item => `
        <div class="config-summary-item ${item.wide ? 'wide' : ''}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value || 'Not set')}</strong>
        </div>
      `).join('');
    }

    function renderProfileSummary() {
      renderSummaryGrid(profileSummaryGrid, [
        { label: 'Restaurant', value: formValue(profileForm, 'restaurantName') },
        { label: 'Business Phone', value: formValue(profileForm, 'businessPhone') },
        { label: 'Cuisine', value: formValue(profileForm, 'cuisineType') },
        { label: 'Timezone', value: formValue(profileForm, 'timezone') },
        { label: 'Address', value: [formValue(profileForm, 'address', ''), formValue(profileForm, 'city', ''), formValue(profileForm, 'country', '')].filter(Boolean).join(', ') || 'Not set', wide: true },
        { label: 'Opening Hours', value: formValue(profileForm, 'openingHours'), wide: true },
        { label: 'Delivery Zones', value: formValue(profileForm, 'deliveryZones'), wide: true },
        { label: 'Reservation Policy', value: formValue(profileForm, 'reservationPolicy'), wide: true }
      ]);
    }

    function renderAssistantSummary() {
      renderSummaryGrid(assistantSummaryGrid, [
        { label: 'Agent Name', value: formValue(agentSettingsForm, 'agentName') },
        { label: 'Language', value: formValue(agentSettingsForm, 'languageCode') },
        { label: 'OpenAI Model', value: formValue(agentSettingsForm, 'openaiModel') },
        { label: 'Backup Model', value: formValue(agentSettingsForm, 'backupOpenaiModel') },
        { label: 'Max Tokens', value: formValue(agentSettingsForm, 'openaiMaxTokens') },
        { label: 'Voice ID', value: formValue(agentSettingsForm, 'voiceId') },
        { label: 'Voice Model', value: formValue(agentSettingsForm, 'voiceModel') },
        { label: 'Orders', value: checkedText(agentSettingsForm, 'orderEnabled') },
        { label: 'Reservations', value: checkedText(agentSettingsForm, 'reservationEnabled') },
        { label: 'Call Mode', value: formValue(agentSettingsForm, 'callMode') },
        { label: 'Manager Notifications', value: `${checkedText(agentSettingsForm, 'notificationEnabled')} / ${formValue(agentSettingsForm, 'notificationChannel')}` },
        { label: 'Escalation Phone', value: formValue(agentSettingsForm, 'escalationPhone') },
        { label: 'Notification Target', value: formValue(agentSettingsForm, 'notificationPhone', formValue(agentSettingsForm, 'notificationEmail')) },
        { label: 'Handoff Urgency', value: formValue(agentSettingsForm, 'notificationMinUrgency') },
        { label: 'Silence Prompt', value: `${formValue(agentSettingsForm, 'silencePromptSeconds')}s` },
        { label: 'Silence Hangup', value: `${formValue(agentSettingsForm, 'silenceHangupSeconds')}s` },
        { label: 'Repeat Caller Greeting', value: formValue(agentSettingsForm, 'repeatCallerGreeting'), wide: true },
        { label: 'Closed Message', value: formValue(agentSettingsForm, 'closedMessage'), wide: true },
        { label: 'Holiday Message', value: formValue(agentSettingsForm, 'holidayMessage'), wide: true },
        { label: 'Private Event Message', value: formValue(agentSettingsForm, 'privateEventMessage'), wide: true },
        { label: 'Prompt Notes', value: formValue(agentSettingsForm, 'systemPrompt'), wide: true }
      ]);
    }

    function renderWorkflowSummary() {
      const assignedNumber = formValue(agentSettingsForm, 'twilioPhone', '');
      const businessPhone = formValue(profileForm, 'businessPhone', '');
      const hasAssignedNumber = Boolean(assignedNumber);
      const hasBusinessPhone = Boolean(businessPhone);
      const hasTestCall = Number(latestDashboardSummary.calls || 0) > 0;

      renderSummaryGrid(workflowSummaryGrid, [
        { label: 'Twilio Phone', value: assignedNumber || 'Not set' },
        { label: 'Gateway Webhook Path', value: formValue(agentSettingsForm, 'n8nWebhookPath') },
        { label: 'Optional n8n URL', value: formValue(agentSettingsForm, 'n8nWebhookUrl') },
        { label: 'Order Sheet ID', value: formValue(agentSettingsForm, 'orderSheetId') },
        { label: 'Reservation Sheet ID', value: formValue(agentSettingsForm, 'reservationSheetId') }
      ]);

      if (forwardingAssignedNumber) {
        forwardingAssignedNumber.textContent = assignedNumber || 'Not set';
      }

      if (copyForwardingNumberButton) {
        copyForwardingNumberButton.disabled = !assignedNumber;
      }

      if (forwardingChecklist) {
        const items = [
          {
            ok: hasBusinessPhone,
            label: 'Restaurant number saved',
            value: businessPhone || 'Add business phone in Restaurant Profile'
          },
          {
            ok: hasAssignedNumber,
            label: 'Xorvian forwarding number assigned',
            value: assignedNumber || 'Add Twilio phone in AI Assistant'
          },
          {
            ok: hasAssignedNumber,
            label: 'Gateway call matching ready',
            value: hasAssignedNumber ? 'Calls match by Twilio To number' : 'Waiting for assigned number'
          },
          {
            ok: hasTestCall,
            label: 'Test call completed',
            value: hasTestCall ? `${latestDashboardSummary.calls} call${Number(latestDashboardSummary.calls) === 1 ? '' : 's'} logged` : 'Place one test call after forwarding'
          }
        ];

        forwardingChecklist.innerHTML = items.map(item => `
          <div class="forwarding-check-item ${item.ok ? 'is-ready' : 'is-pending'}">
            <span>${item.ok ? 'Ready' : 'Todo'}</span>
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.value)}</small>
          </div>
        `).join('');
      }
    }

    function renderMenuSummary() {
      if (!menuSummaryGrid || !menuForm) return;
      let categories = [];
      try {
        categories = JSON.parse(menuForm.elements.menuJson.value || '[]');
      } catch (error) {
        categories = [];
      }

      const itemCount = categories.reduce((total, category) => total + (Array.isArray(category.items) ? category.items.length : 0), 0);
      const categoryNames = categories.map(category => category.name).filter(Boolean).slice(0, 6).join(', ');
      renderSummaryGrid(menuSummaryGrid, [
        { label: 'Categories', value: String(categories.length || 0) },
        { label: 'Menu Items', value: String(itemCount || 0) },
        { label: 'Category Names', value: categoryNames || 'Not set', wide: true },
        { label: 'Menu Notes', value: formValue(menuForm, 'menuNotes'), wide: true },
        { label: 'Knowledge Base', value: formValue(menuForm, 'knowledgeBase'), wide: true }
      ]);
    }

    function fillProfile(profile) {
      if (!profileForm) return;
      const source = profile || {};

      const map = {
        restaurantName: source.restaurant_name,
        businessPhone: source.business_phone,
        address: source.address,
        city: source.city,
        country: source.country,
        cuisineType: source.cuisine_type,
        timezone: source.timezone,
        openingHours: source.opening_hours,
        deliveryZones: source.delivery_zones,
        reservationPolicy: source.reservation_policy,
        menuNotes: source.menu_notes,
        knowledgeBase: source.knowledge_base
      };

      Object.entries(map).forEach(([fieldName, value]) => {
        const field = profileForm.elements[fieldName] || document.querySelector(`[name="${fieldName}"]`);
        if (field) field.value = value || '';
      });

      renderProfileSummary();
      renderMenuSummary();
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
        callMode: agent?.call_mode,
        closedMessage: agent?.closed_message,
        holidayMessage: agent?.holiday_message,
        privateEventMessage: agent?.private_event_message,
        repeatCallerGreeting: agent?.repeat_caller_greeting,
        silencePromptSeconds: agent?.silence_prompt_seconds,
        silenceHangupSeconds: agent?.silence_hangup_seconds,
        backupOpenaiModel: agent?.backup_openai_model,
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

      renderAssistantSummary();
      renderWorkflowSummary();
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

    function renderStatusSelect(type, id, currentStatus) {
      const statuses = type === 'reservation' ? RESERVATION_STATUSES : ORDER_STATUSES;
      const className = type === 'reservation' ? 'reservation-status-action' : 'order-status-action';
      const options = statuses.map(status => `
        <option value="${escapeHtml(status)}" ${status === currentStatus ? 'selected' : ''}>${escapeHtml(prettyStatus(status))}</option>
      `).join('');

      return `
        <select class="status-select ${className}" data-record-id="${escapeHtml(id)}" data-current-status="${escapeHtml(currentStatus || '')}">
          ${options}
          <option value="__custom">Custom note...</option>
        </select>
      `;
    }

    function compactText(value, fallback = '-') {
      const text = String(value || '').trim();
      return text || fallback;
    }

    function renderMoney(value) {
      if (value === null || value === undefined || value === '') return '-';
      const amount = Number(value);
      if (!Number.isFinite(amount)) return String(value);
      return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 2,
        minimumFractionDigits: amount % 1 ? 2 : 0
      }).format(amount);
    }

    function renderMetricPills(customer) {
      return `
        <div class="customer-metric-row">
          <span>${escapeHtml(customer.ordersCount || 0)} orders</span>
          <span>${escapeHtml(customer.reservationsCount || 0)} reservations</span>
          <span>${escapeHtml(customer.callsCount || 0)} calls</span>
          <span>${escapeHtml(customer.handoffsCount || 0)} handoffs</span>
        </div>
      `;
    }

    function renderHistoryList(title, items, formatter) {
      if (!items || !items.length) {
        return `
          <div class="customer-history-block">
            <strong>${escapeHtml(title)}</strong>
            <span>No records yet.</span>
          </div>
        `;
      }

      return `
        <div class="customer-history-block">
          <strong>${escapeHtml(title)}</strong>
          <div class="customer-history-list">
            ${items.slice(0, 5).map(formatter).join('')}
          </div>
        </div>
      `;
    }

    function renderCustomerDetailPanel(customer) {
      if (!customerDetailPanel) return;

      if (!customer) {
        customerDetailPanel.innerHTML = '<div class="config-empty">Select a customer to view history.</div>';
        return;
      }

      const latestOrder = customer.latestOrder;
      const latestReservation = customer.latestReservation;
      const latestHandoff = customer.latestHandoff;

      customerDetailPanel.innerHTML = `
        <div class="customer-detail-head">
          <div>
            <span>Customer Profile</span>
            <h3>${escapeHtml(customer.name || 'Guest')}</h3>
            <p>${escapeHtml(customer.phone || 'No phone captured')}</p>
          </div>
          <div class="customer-detail-stats">
            ${renderMetricPills(customer)}
          </div>
        </div>
        <div class="customer-latest-grid">
          <div>
            <span>Latest Order</span>
            <strong>${latestOrder ? escapeHtml(compactText(latestOrder.order_items)) : 'No orders yet'}</strong>
            ${latestOrder ? renderStatus(latestOrder.order_status || 'new') : ''}
          </div>
          <div>
            <span>Latest Reservation</span>
            <strong>${latestReservation ? `${escapeHtml(latestReservation.reservation_date || '-')} ${escapeHtml(latestReservation.reservation_time || '')}` : 'No reservations yet'}</strong>
            ${latestReservation ? renderStatus(latestReservation.status || 'requested') : ''}
          </div>
          <div>
            <span>Manager Follow-up</span>
            <strong>${latestHandoff ? escapeHtml(latestHandoff.reason || latestHandoff.conversation_summary || 'Callback requested') : 'No handoffs'}</strong>
            ${latestHandoff ? `${renderStatus(latestHandoff.urgency || 'normal')} ${renderStatus(latestHandoff.status || 'new')}` : ''}
          </div>
        </div>
        <div class="customer-history-grid">
          ${renderHistoryList('Orders', customer.orders, order => `
            <div>
              <span>${renderStatus(order.order_status || 'new')} ${escapeHtml(formatDateTime(order.created_at))}</span>
              <small>${escapeHtml(compactText(order.order_items))}</small>
              <small>${escapeHtml(order.special_notes || '')}</small>
            </div>
          `)}
          ${renderHistoryList('Reservations', customer.reservations, reservation => `
            <div>
              <span>${renderStatus(reservation.status || 'requested')} ${escapeHtml(reservation.reservation_date || '-')} ${escapeHtml(reservation.reservation_time || '')}</span>
              <small>${escapeHtml(reservation.party_size || '-')} guests</small>
              <small>${escapeHtml(reservation.notes || '')}</small>
            </div>
          `)}
          ${renderHistoryList('Calls', customer.calls, call => `
            <div>
              <span>${renderStatus(call.call_status || 'answered')} ${escapeHtml(formatDateTime(call.created_at))}</span>
              <small>${escapeHtml(prettyStatus(call.call_type || 'unknown'))} / ${escapeHtml(formatDuration(call.duration_seconds))}</small>
              <small>${escapeHtml(call.ai_summary || call.call_sid || '')}</small>
            </div>
          `)}
          ${renderHistoryList('Handoffs', customer.handoffs, handoff => `
            <div>
              <span>${renderStatus(handoff.urgency || 'normal')} ${renderStatus(handoff.status || 'new')}</span>
              <small>${escapeHtml(handoff.reason || handoff.conversation_summary || 'Manager callback')}</small>
              <small>${escapeHtml(handoff.best_callback_time || '')}</small>
            </div>
          `)}
        </div>
      `;
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
        setTableMessage(ordersTableBody, 7, 'No orders yet for this customer account.');
        return;
      }

      ordersTableBody.innerHTML = orders.map(order => `
        <tr>
          <td data-label="Name">
            <strong>${escapeHtml(order.customer_name || 'Guest')}</strong>
            <small>${escapeHtml(order.source || 'voice_ai')}</small>
          </td>
          <td data-label="Phone">${escapeHtml(order.customer_phone || '-')}</td>
          <td data-label="Order" class="table-main-cell">${escapeHtml(order.order_items || '-')}</td>
          <td data-label="Details">
            <small>Total: ${escapeHtml(renderMoney(order.order_total))}</small>
            <small>${escapeHtml(order.special_notes || 'No notes')}</small>
          </td>
          <td data-label="Status">${renderStatus(order.order_status)}</td>
          <td data-label="Time">${escapeHtml(formatDateTime(order.created_at))}</td>
          <td data-label="Action">${renderStatusSelect('order', order.id, order.order_status || 'new')}</td>
        </tr>
      `).join('');
    }

    function renderCustomers(customers) {
      if (!customersList) return;

      if (!customers.length) {
        customersList.innerHTML = '<div class="config-empty">No customer history yet.</div>';
        renderCustomerDetailPanel(null);
        return;
      }

      latestCustomers = customers;
      const activeIndex = Math.max(customers.findIndex(customer => (customer.phone || customer.name || '') === activeCustomerPhone), 0);
      activeCustomerPhone = customers[activeIndex]?.phone || customers[activeIndex]?.name || '';

      customersList.innerHTML = customers.map((customer, index) => {
        const latestOrder = customer.latestOrder;
        const latestReservation = customer.latestReservation;
        const latestHandoff = customer.latestHandoff;
        const isActive = index === activeIndex;

        return `
          <button class="customer-list-item ${isActive ? 'active' : ''}" type="button" data-customer-index="${index}">
            <span>
              <strong>${escapeHtml(customer.name || 'Guest')}</strong>
              <small>${escapeHtml(customer.phone || 'No phone captured')}</small>
            </span>
            ${renderMetricPills(customer)}
            <small>${escapeHtml(formatDateTime(customer.lastActivity))}</small>
            <small>${escapeHtml(latestOrder ? compactText(latestOrder.order_items) : latestReservation ? `${latestReservation.reservation_date || '-'} ${latestReservation.reservation_time || ''}` : latestHandoff ? latestHandoff.reason || 'Manager handoff' : 'No recent action')}</small>
          </button>
        `;
      }).join('');

      renderCustomerDetailPanel(customers[activeIndex]);
    }

    function renderReservations(reservations) {
      if (!reservationsTableBody) return;

      if (!reservations.length) {
        setTableMessage(reservationsTableBody, 8, 'No reservations yet for this customer account.');
        return;
      }

      reservationsTableBody.innerHTML = reservations.map(reservation => `
        <tr>
          <td data-label="Guest">
            <strong>${escapeHtml(reservation.guest_name || 'Guest')}</strong>
            <small>${escapeHtml(reservation.source || 'voice_ai')}</small>
          </td>
          <td data-label="Phone">${escapeHtml(reservation.guest_phone || '-')}</td>
          <td data-label="Date">${escapeHtml(reservation.reservation_date || '-')}</td>
          <td data-label="Time">${escapeHtml(reservation.reservation_time || '-')}</td>
          <td data-label="Guests">${escapeHtml(reservation.party_size || '-')}</td>
          <td data-label="Notes" class="table-main-cell">${escapeHtml(reservation.notes || 'No notes')}</td>
          <td data-label="Status">${renderStatus(reservation.status)}</td>
          <td data-label="Action">${renderStatusSelect('reservation', reservation.id, reservation.status || 'requested')}</td>
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
          <td data-label="Caller">${escapeHtml(call.caller_phone || '-')}</td>
          <td data-label="Type">${escapeHtml(prettyStatus(call.call_type || 'unknown'))}</td>
          <td data-label="Status">${renderStatus(call.call_status)}</td>
          <td data-label="Duration">${escapeHtml(formatDuration(call.duration_seconds))}</td>
          <td data-label="Summary" class="table-main-cell">${escapeHtml(call.ai_summary || call.call_sid || '-')}</td>
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
            <td data-label="Customer">
              <strong>${escapeHtml(handoff.customer_name || 'Customer')}</strong>
              <small>${escapeHtml(handoff.customer_phone || '-')}</small>
            </td>
            <td data-label="Urgency">${renderStatus(handoff.urgency || 'normal')}</td>
            <td data-label="Reason" class="table-main-cell">${escapeHtml(handoffSummary(handoff) || '-')}</td>
            <td data-label="Notification">${escapeHtml(notification)}</td>
            <td data-label="Status">${renderStatus(handoff.status || 'new')}</td>
            <td data-label="Action">
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

    function renderOverviewAnalytics({ orders = [], reservations = [], calls = [], handoffs = [], customers = [] }) {
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
          { label: 'Known customers', value: customers.length, className: 'customers' },
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
        setTableMessage(ordersTableBody, 7, 'Loading orders...');
        if (customersList) customersList.innerHTML = '<div class="config-empty">Loading customers...</div>';
        renderCustomerDetailPanel(null);
        setTableMessage(reservationsTableBody, 8, 'Loading reservations...');
        setTableMessage(callsTableBody, 5, 'Loading call logs...');
        setTableMessage(handoffsTableBody, 6, 'Loading handoff requests...');

        const [ordersResult, customersResult, reservationsResult, callsResult, handoffsResult] = await Promise.allSettled([
          apiRequest('orders.php'),
          apiRequest('customer_history.php'),
          apiRequest('reservations.php'),
          apiRequest('call_logs.php'),
          apiRequest('handoff_requests.php')
        ]);

        if (ordersResult.status === 'fulfilled') {
          renderOrders(ordersResult.value.orders || []);
        } else {
          setTableMessage(ordersTableBody, 7, ordersResult.reason.message || 'Could not load orders.', 'error');
        }

        if (customersResult.status === 'fulfilled') {
          renderCustomers(customersResult.value.customers || []);
        } else {
          if (customersList) customersList.innerHTML = `<div class="config-empty error">${escapeHtml(customersResult.reason.message || 'Could not load customers.')}</div>`;
          renderCustomerDetailPanel(null);
        }

        if (reservationsResult.status === 'fulfilled') {
          renderReservations(reservationsResult.value.reservations || []);
        } else {
          setTableMessage(reservationsTableBody, 8, reservationsResult.reason.message || 'Could not load reservations.', 'error');
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
          customers: customersResult.status === 'fulfilled' ? customersResult.value.customers || [] : [],
        });
      } catch (error) {
        const message = error.message || 'Could not load operational data.';
        setTableMessage(ordersTableBody, 7, message, 'error');
        if (customersList) customersList.innerHTML = `<div class="config-empty error">${escapeHtml(message)}</div>`;
        renderCustomerDetailPanel(null);
        setTableMessage(reservationsTableBody, 8, message, 'error');
        setTableMessage(callsTableBody, 5, message, 'error');
        setTableMessage(handoffsTableBody, 6, message, 'error');
        renderOverviewAnalytics({});
      }
    }

    async function loadDashboard() {
      if (!getAuthToken()) {
        window.location.href = pagePath('login');
        return;
      }

      try {
        const payload = await apiRequest('dashboard_summary.php');
        const user = payload.user || JSON.parse(localStorage.getItem('xorvianUser') || 'null');
        const summary = payload.summary || {};
        latestDashboardSummary = summary;

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
        window.location.href = pagePath('login');
      }
    }

    if (copyForwardingNumberButton) {
      copyForwardingNumberButton.addEventListener('click', async () => {
        const number = formValue(agentSettingsForm, 'twilioPhone', '');
        if (!number) return;

        try {
          await navigator.clipboard.writeText(number);
          const original = copyForwardingNumberButton.textContent;
          copyForwardingNumberButton.textContent = 'Copied';
          setTimeout(() => {
            copyForwardingNumberButton.textContent = original;
          }, 1200);
        } catch (error) {
          copyForwardingNumberButton.textContent = 'Copy failed';
          setTimeout(() => {
            copyForwardingNumberButton.textContent = 'Copy number';
          }, 1200);
        }
      });
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
          renderMenuSummary();
        } else if (menuMessage) {
          menuMessage.textContent = 'No menu saved yet. Add menu items and save them here.';
          menuMessage.className = 'auth-message';
          renderMenuSummary();
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
          renderMenuSummary();
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
          renderAssistantSummary();
          renderWorkflowSummary();
          closeEditableSection('agent-settings-form');
          closeEditableSection('workflow-shortcut-form');
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
          renderMenuSummary();
          closeEditableSection('menu-form');
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

    async function updateOperationalStatus(select, endpoint, tableBody, colspan) {
      const recordId = select.getAttribute('data-record-id');
      const currentStatus = select.getAttribute('data-current-status') || select.value;
      let status = select.value;
      let customStatus = '';

      if (status === '__custom') {
        customStatus = window.prompt('Add a custom manager note for this customer record:') || '';
        if (!customStatus.trim()) {
          select.value = currentStatus;
          return;
        }
        status = currentStatus;
      }

      select.disabled = true;
      try {
        await apiRequest(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            id: recordId,
            status,
            customStatus
          })
        });
        loadOperationalTables();
      } catch (error) {
        select.disabled = false;
        select.value = currentStatus;
        setTableMessage(tableBody, colspan, error.message, 'error');
      }
    }

    if (ordersTableBody) {
      ordersTableBody.addEventListener('change', async (event) => {
        const select = event.target.closest('.order-status-action');
        if (!select) return;
        updateOperationalStatus(select, 'orders.php', ordersTableBody, 7);
      });
    }

    if (reservationsTableBody) {
      reservationsTableBody.addEventListener('change', async (event) => {
        const select = event.target.closest('.reservation-status-action');
        if (!select) return;
        updateOperationalStatus(select, 'reservations.php', reservationsTableBody, 8);
      });
    }

    if (customersList) {
      customersList.addEventListener('click', (event) => {
        const item = event.target.closest('.customer-list-item');
        if (!item) return;
        const index = Number(item.getAttribute('data-customer-index'));
        const customer = latestCustomers[index];
        if (!customer) return;

        activeCustomerPhone = customer.phone || customer.name || '';
        customersList.querySelectorAll('.customer-list-item').forEach(button => button.classList.remove('active'));
        item.classList.add('active');
        renderCustomerDetailPanel(customer);
      });
    }

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
          renderProfileSummary();
          renderMenuSummary();
          renderWorkflowSummary();
          closeEditableSection('restaurant-profile-form');
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
        window.location.href = pagePath('login');
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
        window.location.href = pagePath('login');
        return;
      }

      try {
        const user = JSON.parse(localStorage.getItem('xorvianUser') || 'null');
        if (user && user.role !== 'admin') {
          window.location.href = pagePath('dashboard');
          return;
        }

        if (user && adminUserEmail) adminUserEmail.textContent = user.email;

        const payload = await apiRequest('admin_summary.php');
        adminPayloadCache = payload;
        renderAdminDashboard(payload);
        showAdminMessage('', '');
      } catch (error) {
        if (String(error.message).includes('Admin access')) {
          window.location.href = pagePath('dashboard');
          return;
        }

        if (String(error.message).includes('Invalid or expired token') || String(error.message).includes('Missing bearer token')) {
          clearAuthSession();
          window.location.href = pagePath('login');
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
        window.location.href = pagePath('login');
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
