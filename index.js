document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.location.protocol === 'file:'
    ? 'http://localhost/Xorvian%20backend/api'
    : `${window.location.origin}/xorvian/backend/api`;

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
    const setupStatus = document.getElementById('setup-status');
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
        setupStatus.textContent = summary.profileComplete ? 'Profile ready' : 'Profile pending';
        fillProfile(payload.profile);
        fillAgentSettings(payload.agent, payload.workflow);
        loadMenu();
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
        }
      } catch (error) {
        // Menu is optional during early onboarding.
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
          setMenuConverterStatus(`Converted ${categories.length} categories to workflow JSON.`, 'success');
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
        payload.openaiTemperature = 0.3;
        payload.voiceProvider = 'elevenlabs';
        payload.twilioLanguage = payload.languageCode || 'en-US';
        payload.outputFormat = 'mp3_44100_128';
        payload.orderSheetName = 'Sheet1';
        payload.reservationSheetName = 'Sheet1';
        payload.cloudinaryFolder = 'xorvian-audio';

        try {
          if (agentSettingsMessage) {
            agentSettingsMessage.textContent = 'Saving agent settings...';
            agentSettingsMessage.className = 'auth-message';
          }
          if (workflowSettingsMessage) {
            workflowSettingsMessage.textContent = 'Saving workflow settings...';
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
            workflowSettingsMessage.textContent = 'Workflow settings saved.';
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
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const adminUserEmail = document.getElementById('admin-user-email');
    const customersTable = document.getElementById('admin-customers-table');

    function setText(id, value) {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
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
        const summary = payload.summary || {};

        setText('admin-total-customers', summary.totalCustomers || 0);
        setText('admin-active-users', summary.activeUsers || 0);
        setText('admin-monthly-revenue', `$${summary.monthlyRevenue || 0}`);
        setText('admin-configured-agents', summary.configuredAgents || 0);

        if (customersTable) {
          const customers = payload.customers || [];

          if (!customers.length) {
            customersTable.innerHTML = '<tr><td colspan="6">No customers yet.</td></tr>';
            return;
          }

          customersTable.innerHTML = customers.map(customer => `
            <tr>
              <td>${escapeHtml(customer.first_name)} ${escapeHtml(customer.second_name)}</td>
              <td>${escapeHtml(customer.restaurant_name || 'Profile pending')}</td>
              <td>${escapeHtml(customer.email)}</td>
              <td>${escapeHtml(customer.voice_model || 'eleven_flash_v2')}</td>
              <td>${escapeHtml(customer.n8n_webhook_path || 'Not set')}</td>
              <td><span class="status-pill">${escapeHtml(customer.status || 'active')}</span></td>
            </tr>
          `).join('');
        }
      } catch (error) {
        if (String(error.message).includes('Admin access')) {
          window.location.href = 'dashboard.html';
          return;
        }
        clearAuthSession();
        window.location.href = 'login.html';
      }
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
