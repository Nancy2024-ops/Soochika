// ── PAGE NAVIGATION ──────────────────────────────
const pages = ['dashboard','beneficiaries','add','schemes','camps','alerts','analytics','export'];

function showPage(name) {
  pages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.classList.remove('active');
  });
  const target = document.getElementById('page-' + name);
  if (target) target.classList.add('active');

  // Update sidebar active link
  document.querySelectorAll('#sidebar .nav-link').forEach(a => a.classList.remove('active'));
  const links = document.querySelectorAll('#sidebar .nav-link');
  links.forEach(a => {
    const onclick = a.getAttribute('onclick') || '';
    if (onclick.includes("'" + name + "'")) a.classList.add('active');
  });

  // Update topbar title
  const titles = {
    dashboard: 'Dashboard',
    beneficiaries: 'Beneficiaries',
    add: 'Register Beneficiary',
    schemes: 'Welfare Schemes',
    camps: 'Health Camps',
    alerts: 'Alerts',
    analytics: 'Analytics',
    export: 'Export Data'
  };
  document.getElementById('page-title').textContent = titles[name] || name;

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');

  // Scroll main to top
  document.getElementById('main-content').scrollTo(0, 0);

  // Trigger page-specific data reload
  if (name === 'dashboard') {
    loadStats();
  } else if (name === 'beneficiaries') {
    loadBeneficiaries();
  } else if (name === 'camps') {
    loadCamps();
  } else if (name === 'add') {
    // Reset edit mode when clicking "Register Beneficiary"
    editingBeneficiaryId = null;
    editingBeneficiaryStatus = 'Pending';
    document.getElementById('page-title').textContent = 'Register Beneficiary';
    const submitBtn = document.querySelector('#page-add .btn-primary-custom');
    if (submitBtn) {
      submitBtn.innerHTML = 'Register Beneficiary <i class="bi bi-check-lg ms-1"></i>';
    }
    clearRegisterForm();
  }
}

// ── SIDEBAR TOGGLE (mobile) ──────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── CATEGORY CHIPS TOGGLE ────────────────────────
function toggleChip(el) {
  el.classList.toggle('selected');
}

// ── BENEFICIARY PROFILE MODAL ────────────────────
async function openProfile(id) {
  const modal = document.getElementById('profileModal');
  
  try {
    const res = await fetch(`/api/beneficiaries/${id}`);
    if (!res.ok) throw new Error('Beneficiary not found');
    const b = await res.json();

    // Populate modal
    modal.querySelector('.pm-avatar').textContent = b.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    modal.querySelector('.pm-name').textContent = b.name;
    modal.querySelector('.pm-id').textContent = `${b.uid} · Kazhakuttam GP`;
    
    // Status badge inside modal
    const statusEl = modal.querySelector('.wc-status');
    statusEl.className = 'wc-status mt-1 d-inline-flex';
    if (b.status === 'Verified') statusEl.classList.add('ok-status');
    else if (b.status === 'Urgent') statusEl.classList.add('urgent-status');
    else if (b.status === 'Flagged') statusEl.classList.add('urgent-status');
    else statusEl.classList.add('pending-status');
    statusEl.innerHTML = `<i class="bi bi-exclamation-circle-fill me-1"></i> ${b.status} Status`;

    modal.querySelector('.pm-field-val').parentElement.parentElement.innerHTML = `
      <div class="col-6"><div class="pm-field-label">Age</div><div class="pm-field-val">${b.age} years</div></div>
      <div class="col-6"><div class="pm-field-label">Gender</div><div class="pm-field-val">${b.gender}</div></div>
      <div class="col-6"><div class="pm-field-label">Ward</div><div class="pm-field-val">${b.ward}</div></div>
      <div class="col-6"><div class="pm-field-label">Mobile</div><div class="pm-field-val">${b.mobile || '—'}</div></div>
      <div class="col-12"><div class="pm-field-label">Address</div><div class="pm-field-val">${b.address}</div></div>
      <div class="col-6"><div class="pm-field-label">Caregiver</div><div class="pm-field-val">${b.caregiver_name || '—'}</div></div>
      <div class="col-6"><div class="pm-field-label">Caregiver Mobile</div><div class="pm-field-val">${b.caregiver_mobile || '—'}</div></div>
    `;

    // Render Schemes chips
    const schemesContainer = modal.querySelector('.pm-section-label').nextElementSibling;
    schemesContainer.innerHTML = b.schemes.map(s => {
      const chipClass = s.is_enrolled === 1 ? 'active-scheme' : 'missing-scheme';
      const chipIcon = s.is_enrolled === 1 ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
      return `<div class="scheme-chip ${chipClass}"><i class="bi ${chipIcon}"></i> ${s.scheme_name} ${s.is_enrolled === 1 ? '' : '(not enrolled)'}</div>`;
    }).join(' ');

    // Notes
    modal.querySelector('.pm-alert-box').innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2"></i> ${b.notes || 'No special notes recorded.'}`;

    modal.style.display = 'block';
    modal.classList.add('open');
  } catch (err) {
    console.error(err);
    alert('Failed to load beneficiary details. Ensure backend server is running.');
  }
}

function closeModal(event) {
  const modal = document.getElementById('profileModal');
  if (event.target === modal || event.target.closest('.modal-close')) {
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('profileModal');
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
});

// ── LIVE SEARCH (client-side triggers API reload) ───────────────
let searchTimeout;
document.querySelector('.search-input').addEventListener('input', function () {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    // If on another page, switch to beneficiaries
    const activePage = document.querySelector('.page-content.active').id;
    if (activePage !== 'page-beneficiaries') {
      showPage('beneficiaries');
    } else {
      loadBeneficiaries();
    }
  }, 300);
});

// ── ANIMATED COUNT-UP ────────────────────────────
function countUp(el, target, duration = 900) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = Math.round(start).toLocaleString('en-IN');
    if (start >= target) clearInterval(timer);
  }, 16);
}

// ── BACKEND INTEGRATION: LOAD STATS ──────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('Server error');
    const data = await res.json();

    // Update stats cards
    const totalEl = document.querySelector('.stat-card:nth-child(1) .stat-value');
    const pwdEl = document.querySelector('.stat-card:nth-child(2) .stat-value');
    const elderlyEl = document.querySelector('.stat-card:nth-child(3) .stat-value');
    const pendingEl = document.querySelector('.stat-card:nth-child(4) .stat-value');

    if (totalEl) countUp(totalEl, data.total);
    if (pwdEl) countUp(pwdEl, data.pwd);
    if (elderlyEl) countUp(elderlyEl, data.elderly);
    if (pendingEl) countUp(pendingEl, data.pending);

    // Update Scheme Coverage bars on dashboard
    data.schemeStats.forEach(s => {
      const schemeRows = document.querySelectorAll('.scheme-row');
      schemeRows.forEach(row => {
        const nameEl = row.querySelector('.scheme-name');
        if (nameEl && nameEl.textContent.toLowerCase().includes(s.scheme_name.toLowerCase().substring(0, 8))) {
          const totalScheme = s.enrolled + s.missing;
          const pct = totalScheme > 0 ? Math.round((s.enrolled / totalScheme) * 100) : 0;
          row.querySelector('.scheme-bar').style.width = `${pct}%`;
          row.querySelector('.scheme-pct').textContent = `${pct}%`;
        }
      });
    });

  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ── BACKEND INTEGRATION: LOAD BENEFICIARIES ──────────────────────────
async function loadBeneficiaries() {
  const grid = document.getElementById('beneficiary-grid');
  if (!grid) return;

  const ward = document.getElementById('filter-ward').value;
  const category = document.getElementById('filter-category').value;
  const scheme = document.getElementById('filter-scheme').value;
  const status = document.getElementById('filter-status').value;
  const search = document.querySelector('.search-input').value;

  // If the user manually changes the scheme dropdown, clear the missing scheme filter
  if (scheme !== 'All Schemes' && filterMissingScheme) {
    filterMissingScheme = null;
  }

  const params = new URLSearchParams();
  if (ward) params.append('ward', ward);
  if (category) params.append('category', category);
  if (scheme) params.append('scheme', scheme);
  if (status) params.append('status', status);
  if (search) params.append('search', search);

  if (filterMissingScheme) {
    params.append('missing_scheme', filterMissingScheme);
  }

  // Render active filters bar
  const filterBar = document.getElementById('active-filters-bar');
  if (filterBar) {
    if (filterMissingScheme) {
      filterBar.innerHTML = `
        <span class="badge bg-danger p-2 d-inline-flex align-items-center gap-2" style="border-radius: 20px; font-size: 11.5px; font-weight: 600;">
          <i class="bi bi-exclamation-triangle-fill text-white"></i> Missing: ${filterMissingScheme}
          <i class="bi bi-x-circle-fill ms-1" style="cursor: pointer; font-size: 13px;" onclick="clearMissingFilter()"></i>
        </span>
      `;
      filterBar.classList.remove('d-none');
    } else {
      filterBar.classList.add('d-none');
      filterBar.innerHTML = '';
    }
  }

  try {
    const res = await fetch(`/api/beneficiaries?${params.toString()}`);
    if (!res.ok) throw new Error('Server error');
    const list = await res.json();

    if (list.length === 0) {
      grid.innerHTML = '<div class="text-center w-100 p-5 text-muted">No beneficiaries found matching the filters.</div>';
      return;
    }

    grid.innerHTML = list.map(b => {
      const initials = b.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const avatarClass = b.gender === 'Female' ? 'female-av' : 'male-av';
      
      let statusClass = 'pending-status';
      let statusIcon = 'bi-hourglass-split';
      if (b.status === 'Verified') {
        statusClass = 'ok-status';
        statusIcon = 'bi-patch-check-fill';
      } else if (b.status === 'Urgent') {
        statusClass = 'urgent-status';
        statusIcon = 'bi-exclamation-circle-fill';
      } else if (b.status === 'Flagged') {
        statusClass = 'urgent-status';
        statusIcon = 'bi-flag-fill';
      }

      const tagsHtml = b.categories.map(c => {
        const tagClass = c === 'Elderly' ? 'elderly-tag' : (c === 'PwD' ? 'pwd-tag' : (c === 'Bedridden' ? 'bedridden-tag' : 'widow-tag'));
        return `<span class="tag ${tagClass}">${c}</span>`;
      }).join(' ');

      const schemesHtml = b.schemes.map(s => {
        const chipClass = s.is_enrolled === 1 ? 'active-scheme' : 'missing-scheme';
        const chipIcon = s.is_enrolled === 1 ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
        return `<div class="scheme-chip ${chipClass}"><i class="bi ${chipIcon}"></i> ${s.scheme_name}</div>`;
      }).join(' ');

      return `
        <div class="welfare-card" onclick="openProfile('${b.uid}')">
          <div class="wc-header">
            <div class="wc-avatar ${avatarClass}">${initials}</div>
            <div class="wc-id-area">
              <div class="wc-id">${b.uid}</div>
              <div class="wc-panchayat">Kazhakuttam GP</div>
            </div>
            <span class="wc-status ${statusClass}"><i class="bi ${statusIcon}"></i> ${b.status}</span>
          </div>
          <div class="wc-name">${b.name}</div>
          <div class="wc-meta d-flex gap-3 flex-wrap">
            <span><i class="bi bi-cake2-fill text-muted me-1"></i>${b.age} years</span>
            <span><i class="bi bi-geo-fill text-muted me-1"></i>${b.ward}</span>
            <span><i class="bi bi-telephone-fill text-muted me-1"></i>${b.mobile || '—'}</span>
          </div>
          <div class="wc-tags d-flex flex-wrap gap-1 my-2">
            ${tagsHtml}
          </div>
          <div class="wc-schemes">
            ${schemesHtml}
          </div>
          <div class="wc-footer d-flex justify-content-between align-items-center mt-2">
            <span class="last-updated"><i class="bi bi-clock-history me-1"></i>Updated recently</span>
            <div class="d-flex gap-2">
              <button class="wc-btn" title="Call" onclick="event.stopPropagation(); alert('Calling ${b.mobile || 'caregiver'}...')"><i class="bi bi-telephone"></i></button>
              <button class="wc-btn" title="Edit" onclick="event.stopPropagation(); editBeneficiary('${b.id}')"><i class="bi bi-pencil"></i></button>
              <button class="wc-btn accent" title="View"><i class="bi bi-eye-fill"></i></button>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load beneficiaries:', err);
    grid.innerHTML = '<div class="text-center w-100 p-5 text-danger"><i class="bi bi-exclamation-triangle me-2"></i>Failed to load beneficiaries. Please ensure the backend server is running.</div>';
  }
}

// ── BACKEND INTEGRATION: LOAD HEALTH CAMPS ───────────────────────────
async function loadCamps() {
  const container = document.querySelector('#page-camps .d-flex.flex-wrap.gap-3');
  if (!container) return;

  try {
    const res = await fetch('/api/camps');
    if (!res.ok) throw new Error('Server error');
    const list = await res.json();

    container.innerHTML = list.map(c => {
      let cardClass = 'planned-camp';
      let badgeClass = 'planned-badge';
      let metaIconClass = 'bi-pencil-square';
      let statusText = 'Draft';
      
      if (c.status === 'upcoming') {
        cardClass = 'upcoming-camp';
        badgeClass = '';
        metaIconClass = 'bi-clock';
        statusText = c.time;
      } else if (c.status === 'completed') {
        cardClass = 'completed-camp';
        badgeClass = 'completed-badge';
        metaIconClass = 'bi-check-circle-fill text-success';
        statusText = 'Completed';
      }

      const tagsHtml = c.tags.map(t => {
        const tagClass = t.toLowerCase().replace(/\s+/g, '-');
        return `<span class="camp-tag ${tagClass}">${t}</span>`;
      }).join(' ');

      return `
        <div class="camp-card ${cardClass} flex-fill" style="min-width:280px">
          <div class="camp-date-badge ${badgeClass}">
            <div class="camp-month">${c.month}</div>
            <div class="camp-day">${c.day}</div>
          </div>
          <div class="camp-body">
            <div class="camp-title">${c.title}</div>
            <div class="camp-location"><i class="bi bi-geo-alt-fill me-1"></i>${c.location}</div>
            <div class="camp-meta d-flex gap-3 flex-wrap mt-2">
              <span><i class="bi bi-people me-1"></i>${c.invited} invited</span>
              <span><i class="bi ${metaIconClass} me-1"></i>${statusText}</span>
            </div>
            <div class="d-flex gap-2 mt-3">
              ${tagsHtml}
            </div>
            <div class="camp-actions d-flex gap-2 mt-3">
              <button class="btn-camp-action" onclick="alert('Notification sent to ${c.invited} beneficiaries.')"><i class="bi bi-bell me-1"></i>Send Reminders</button>
              <button class="btn-camp-action"><i class="bi bi-pencil me-1"></i>Edit</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load camps:', err);
    container.innerHTML = '<div class="text-center w-100 p-5 text-danger">Failed to load health camps.</div>';
  }
}

// ── BACKEND INTEGRATION: SUBMIT NEW / EDIT BENEFICIARY ──────────────
let editingBeneficiaryId = null;
let editingBeneficiaryStatus = 'Pending';
let filterMissingScheme = null;

function identifyMissing(schemeName) {
  filterMissingScheme = schemeName;
  
  // Reset the scheme dropdown in UI to prevent conflict
  const schemeSelect = document.getElementById('filter-scheme');
  if (schemeSelect) schemeSelect.value = 'All Schemes';

  showPage('beneficiaries');
}

function clearMissingFilter() {
  filterMissingScheme = null;
  loadBeneficiaries();
}

function clearRegisterForm() {
  document.getElementById('add-name').value = '';
  document.getElementById('add-age').value = '';
  document.getElementById('add-gender').value = 'Select';
  document.getElementById('add-aadhaar').value = '';
  document.getElementById('add-mobile').value = '';
  document.getElementById('add-ward').value = 'Select Ward';
  document.getElementById('add-address').value = '';
  document.getElementById('add-caregiver-name').value = '';
  document.getElementById('add-caregiver-mobile').value = '';
  document.getElementById('add-notes').value = '';
  document.querySelectorAll('#add-categories .category-chip').forEach(chip => chip.classList.remove('selected'));
}

async function editBeneficiary(id) {
  try {
    const res = await fetch(`/api/beneficiaries/${id}`);
    if (!res.ok) throw new Error('Beneficiary not found');
    const b = await res.json();

    editingBeneficiaryId = b.id;
    editingBeneficiaryStatus = b.status;

    // Change title and button text
    document.getElementById('page-title').textContent = 'Edit Beneficiary';
    const submitBtn = document.querySelector('#page-add .btn-primary-custom');
    if (submitBtn) {
      submitBtn.innerHTML = 'Save Changes <i class="bi bi-check-lg ms-1"></i>';
    }

    // Populate fields
    document.getElementById('add-name').value = b.name;
    document.getElementById('add-age').value = b.age;
    document.getElementById('add-gender').value = b.gender;
    document.getElementById('add-aadhaar').value = b.aadhaar;
    document.getElementById('add-mobile').value = b.mobile || '';
    document.getElementById('add-ward').value = b.ward;
    document.getElementById('add-address').value = b.address;
    document.getElementById('add-caregiver-name').value = b.caregiver_name || '';
    document.getElementById('add-caregiver-mobile').value = b.caregiver_mobile || '';
    document.getElementById('add-notes').value = b.notes || '';

    // Clear and set category chips
    document.querySelectorAll('#add-categories .category-chip').forEach(chip => {
      const val = chip.getAttribute('data-val');
      if (b.categories.includes(val)) {
        chip.classList.add('selected');
      } else {
        chip.classList.remove('selected');
      }
    });

    // Switch to form page
    pages.forEach(p => {
      const el = document.getElementById('page-' + p);
      if (el) el.classList.remove('active');
    });
    document.getElementById('page-add').classList.add('active');

  } catch (err) {
    console.error(err);
    alert('Failed to load beneficiary details for editing.');
  }
}

async function submitBeneficiary() {
  const name = document.getElementById('add-name').value.trim();
  const age = document.getElementById('add-age').value.trim();
  const gender = document.getElementById('add-gender').value;
  const aadhaar = document.getElementById('add-aadhaar').value.trim();
  const mobile = document.getElementById('add-mobile').value.trim();
  const ward = document.getElementById('add-ward').value;
  const address = document.getElementById('add-address').value.trim();
  const caregiverName = document.getElementById('add-caregiver-name').value.trim();
  const caregiverMobile = document.getElementById('add-caregiver-mobile').value.trim();
  const notes = document.getElementById('add-notes').value.trim();

  // Validate required fields
  if (!name || !age || !gender || gender === 'Select' || !aadhaar || !ward || ward === 'Select Ward' || !address) {
    alert('Please fill in all required fields marked with *');
    return;
  }

  // Collect selected category chips
  const categoryChips = document.querySelectorAll('#add-categories .category-chip.selected');
  const categories = Array.from(categoryChips).map(chip => chip.getAttribute('data-val'));

  if (categories.length === 0) {
    alert('Please select at least one Category chip.');
    return;
  }

  const payload = {
    name,
    age: parseInt(age, 10),
    gender,
    aadhaar,
    mobile,
    ward,
    address,
    caregiver_name: caregiverName,
    caregiver_mobile: caregiverMobile,
    notes,
    categories,
    status: editingBeneficiaryStatus,
    schemes: {
      'IGNOAPS': age >= 60,
      'Karunya': true,
      'Disability Allowance': categories.includes('PwD'),
      'FSC': true
    }
  };

  try {
    const url = editingBeneficiaryId ? `/api/beneficiaries/${editingBeneficiaryId}` : '/api/beneficiaries';
    const method = editingBeneficiaryId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to save beneficiary');
    }

    if (editingBeneficiaryId) {
      alert('Beneficiary details updated successfully!');
    } else {
      alert(`Beneficiary registered successfully! Assigned UID: ${data.uid}`);
    }
    
    // Reset form and edit state
    clearRegisterForm();
    editingBeneficiaryId = null;
    editingBeneficiaryStatus = 'Pending';

    // Go back to beneficiaries list
    showPage('beneficiaries');

  } catch (err) {
    console.error(err);
    alert(`Error: ${err.message}`);
  }
}

// ── LOGIN SCREEN CONTROLLER ──────────────────────────────────────────
function switchAuthTab(el) {
  const targetId = el.getAttribute('data-target');
  
  // Update tab buttons
  document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
  el.classList.add('active');

  // Update tab content panels
  document.querySelectorAll('.auth-tab-content').forEach(panel => panel.classList.remove('active'));
  document.getElementById(targetId).classList.add('active');
}

// 1. Password Login
async function loginWithPassword() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!username || !password) {
    alert('Please enter both username and password.');
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid credentials');

    handleLoginSuccess(data.user);
  } catch (err) {
    alert(err.message);
  }
}

// 2. Aadhaar OTP Login
async function sendAadhaarOtp() {
  const aadhaar = document.getElementById('login-aadhaar').value.trim();
  if (!aadhaar) {
    alert('Please enter your Aadhaar number.');
    return;
  }

  try {
    const res = await fetch('/api/auth/aadhaar-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadhaar })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

    // Show OTP verification inputs
    document.getElementById('aadhaar-input-group').classList.add('d-none');
    document.getElementById('otp-input-group').classList.remove('d-none');

    // Auto-fill OTP in [TEST MODE]
    if (data.otp) {
      alert(`[TEST MODE] OTP sent to registered mobile: ${data.otp}`);
      document.getElementById('login-otp').value = data.otp;
    }

    // Start 60s countdown
    let timeLeft = 60;
    const timerEl = document.getElementById('otp-timer');
    const resendBtn = document.getElementById('btn-resend-otp');
    resendBtn.classList.add('d-none');

    const timerInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        timerEl.textContent = '';
        resendBtn.classList.remove('d-none');
      } else {
        timerEl.textContent = `Resend OTP in ${timeLeft}s`;
      }
    }, 1000);

  } catch (err) {
    alert(err.message);
  }
}

async function verifyAadhaarOtp() {
  const aadhaar = document.getElementById('login-aadhaar').value.trim();
  const otp = document.getElementById('login-otp').value.trim();

  if (!otp) {
    alert('Please enter the 6-digit OTP.');
    return;
  }

  try {
    const res = await fetch('/api/auth/aadhaar-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadhaar, otp })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid OTP');

    handleLoginSuccess(data.user);
  } catch (err) {
    alert(err.message);
  }
}

// 3. Biometric Scan Simulation
function triggerBiometric() {
  const scanner = document.querySelector('.biometric-trigger-wrap');
  const status = document.getElementById('biometric-status');

  if (scanner.classList.contains('scanning')) return;

  scanner.classList.add('scanning');
  status.textContent = 'Scanning fingerprint...';

  // Simulate a 2-second scan
  setTimeout(() => {
    scanner.classList.remove('scanning');
    status.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill"></i> Fingerprint Verified!</span>';

    // Transition to dashboard
    setTimeout(() => {
      handleLoginSuccess({ name: 'Anitha Oommen', role: 'Ward Officer' });
    }, 600);
  }, 2000);
}

// Handle Successful Login
function handleLoginSuccess(user) {
  // Store session in localStorage
  localStorage.setItem('soochika_session', JSON.stringify(user));

  const loginScreen = document.getElementById('login-screen');
  loginScreen.classList.add('fade-out');

  setTimeout(() => {
    loginScreen.style.display = 'none';
    
    const appWrapper = document.getElementById('app-wrapper');
    appWrapper.style.display = 'flex';

    // Update user details in the sidebar footer
    const nameEl = document.querySelector('.sidebar-footer .user-name');
    if (nameEl) nameEl.textContent = user.name;
    const roleEl = document.querySelector('.sidebar-footer .user-role');
    if (roleEl) roleEl.textContent = user.role;

    // Load fresh stats on login
    loadStats();
  }, 500);
}

// Handle Logout
function logout() {
  localStorage.removeItem('soochika_session');
  location.reload(); // Reload the page to clear states and show login screen
}

// ── DOM LOAD INITIALIZATION ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Bind the logout icon click listener
  const logoutIcon = document.querySelector('.logout-icon');
  if (logoutIcon) {
    logoutIcon.style.cursor = 'pointer';
    logoutIcon.addEventListener('click', logout);
  }

  // Check if session already exists
  const sessionData = localStorage.getItem('soochika_session');
  if (sessionData) {
    try {
      const user = JSON.parse(sessionData);
      // Hide login, show dashboard
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app-wrapper').style.display = 'flex';
      
      const nameEl = document.querySelector('.sidebar-footer .user-name');
      if (nameEl) nameEl.textContent = user.name;
      const roleEl = document.querySelector('.sidebar-footer .user-role');
      if (roleEl) roleEl.textContent = user.role;

      loadStats();
    } catch (e) {
      console.error('Session parse error:', e);
      localStorage.removeItem('soochika_session');
    }
  } else {
    // Show login, hide dashboard
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-wrapper').style.display = 'none';
  }
});

// Expose functions to window for inline HTML onclick handlers
window.showPage = showPage;
window.toggleSidebar = toggleSidebar;
window.toggleChip = toggleChip;
window.openProfile = openProfile;
window.closeModal = closeModal;
window.submitBeneficiary = submitBeneficiary;
window.loadBeneficiaries = loadBeneficiaries;
window.switchAuthTab = switchAuthTab;
window.loginWithPassword = loginWithPassword;
window.sendAadhaarOtp = sendAadhaarOtp;
window.verifyAadhaarOtp = verifyAadhaarOtp;
window.triggerBiometric = triggerBiometric;
window.logout = logout;
window.editBeneficiary = editBeneficiary;
window.identifyMissing = identifyMissing;
window.clearMissingFilter = clearMissingFilter;
