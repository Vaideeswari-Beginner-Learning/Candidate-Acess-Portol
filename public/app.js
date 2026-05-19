/**
 * FIC Candidate Access Portal - Client-Side Controller
 * Interfaces with the Express REST API backend on the hosted localhost server.
 */

// ----------------------------------------------------
// 1. Global State & Fetch Synchronizers
// ----------------------------------------------------
const STATE_KEYS = {
  CURRENT_USER: 'fic_current_user'
};

let currentUser = null;
let candidates = [];
let globalSettings = {
  defaultLink: 'https://forgeindiaconnect.com/training-access',
  linkName: 'Candidate Onboarding Link'
};

// Central sync manager: pulls latest details from Express database
async function syncState() {
  try {
    // 1. Fetch Candidates List
    const res = await fetch('/api/candidates');
    if (res.ok) {
      candidates = await res.json();
      
      // Keep local session user in sync with updated DB record
      if (currentUser && currentUser.role === 'candidate') {
        const freshRecord = candidates.find(c => c.id === currentUser.id);
        if (freshRecord) {
          currentUser = { ...freshRecord, role: 'candidate' };
          localStorage.setItem(STATE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
        }
      }
    }

    // 2. Fetch Global settings
    const settingsRes = await fetch('/api/settings');
    if (settingsRes.ok) {
      globalSettings = await settingsRes.json();
    }
  } catch (err) {
    console.error('Error syncing state with Express API:', err);
  }
}

// ----------------------------------------------------
// 2. Dynamic UI View Management
// ----------------------------------------------------
let activeUserTab = 'dashboard';
let activeAdminTab = 'dashboard';

async function renderApp() {
  // Sync state first to ensure fresh data
  await syncState();

  const authContainer = document.getElementById('auth-container');
  const userContainer = document.getElementById('user-dashboard-container');
  const adminContainer = document.getElementById('admin-dashboard-container');

  if (!currentUser) {
    authContainer.style.display = 'flex';
    userContainer.style.display = 'none';
    adminContainer.style.display = 'none';
  } else if (currentUser.role === 'admin') {
    authContainer.style.display = 'none';
    userContainer.style.display = 'none';
    adminContainer.style.display = 'flex';
    setupAdminDashboard();
  } else {
    authContainer.style.display = 'none';
    userContainer.style.display = 'flex';
    adminContainer.style.display = 'none';
    setupUserDashboard();
  }
}

// Demo Bar Role Switcher (Simulates login flows via standard API routes!)


// ----------------------------------------------------
// 3. Float Toasts Alert Manager
// ----------------------------------------------------
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'danger') icon = 'fa-triangle-exclamation';
  if (type === 'warning') icon = 'fa-bell';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  // Remove toast after slideout
  setTimeout(() => {
    toast.style.animation = 'slide-in 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// ----------------------------------------------------
// 4. Auth Tab Controller
// ----------------------------------------------------
window.switchAuthTab = function(tab) {
  const tabLogin = document.getElementById('tab-login-btn');
  const tabRegister = document.getElementById('tab-register-btn');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  } else {
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  }
};

// ----------------------------------------------------
// 5. Auth Action Dispatches (APIs)
// ----------------------------------------------------
let regFiles = { payment: null, aadhaar: null };

window.handleFileSelected = function(input, type) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    regFiles[type] = e.target.result; // Save base64 string
    document.getElementById(`badge-${type}`).style.display = 'flex';
    document.getElementById(`zone-${type}`).style.borderColor = 'var(--success)';
    showToast('Aadhaar Card loaded successfully', 'success');
  };
  reader.readAsDataURL(file);
};

window.handleRegister = async function(event) {
  event.preventDefault();
  
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;
  const mobile = document.getElementById('reg-mobile').value.trim();
  const appliedFIC = document.getElementById('reg-applied').value;

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        mobile,
        appliedFIC,
        aadhaarDoc: regFiles.aadhaar   // base64 string
      })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Registration failed', 'danger');
      return;
    }

    // Reset Form
    document.getElementById('register-form').reset();
    regFiles = { payment: null, aadhaar: null };
    document.getElementById('badge-aadhaar').style.display = 'none';
    document.getElementById('zone-aadhaar').style.borderColor = 'var(--border-color)';

    showToast('Registration submitted successfully!', 'success');

    // Auto Login as new user
    currentUser = data.user;
    currentUser.role = 'candidate';
    localStorage.setItem(STATE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    activeUserTab = 'dashboard';
    setTimeout(() => renderApp(), 800);

  } catch (err) {
    showToast('Network request to register failed.', 'danger');
  }
};

window.handleLogin = async function(event) {
  event.preventDefault();

  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Access Denied', 'danger');
      return;
    }

    currentUser = data.user;
    currentUser.role = data.role;
    localStorage.setItem(STATE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    
    if (data.role === 'admin') {
      activeAdminTab = 'dashboard';
      showToast('System Admin logged in successfully', 'success');
    } else {
      activeUserTab = 'dashboard';
      showToast(`Welcome back, ${currentUser.name}!`, 'success');
    }
    
    renderApp();

  } catch (err) {
    showToast('Network request to login failed.', 'danger');
  }
};

window.handleLogout = function() {
  currentUser = null;
  localStorage.removeItem(STATE_KEYS.CURRENT_USER);
  showToast('Logged out of session', 'info');
  renderApp();
};

// ----------------------------------------------------
// 6. Candidate / User Dashboard Core Logic
// ----------------------------------------------------
window.switchUserTab = async function(tab) {
  activeUserTab = tab;
  
  // Collapse mobile sidebar if open
  const sidebar = document.querySelector('#user-dashboard-container .sidebar');
  if (sidebar) sidebar.classList.remove('active');

  // Toggle sidebar items active classes
  const tabItems = document.querySelectorAll('#user-dashboard-container .sidebar-item');
  tabItems.forEach(item => item.classList.remove('active'));
  document.getElementById(`user-tab-${tab}`).classList.add('active');

  // Toggle view panels
  const panels = document.querySelectorAll('.user-view-panel');
  panels.forEach(p => p.style.display = 'none');
  document.getElementById(`user-panel-${tab}`).style.display = 'block';

  // Sync state with server before displaying each panel
  await syncState();

  // Update titles
  const title = document.getElementById('user-view-title');
  const subtitle = document.getElementById('user-view-subtitle');

  switch(tab) {
    case 'dashboard':
      title.innerText = 'Dashboard Overview';
      subtitle.innerText = 'Quickly review your portal status and alerts';
      setupUserDashboard();
      break;
    case 'application':
      title.innerText = 'My Application Details';
      subtitle.innerText = 'Detailed record of your Forge India Connect profile';
      renderUserApplication();
      break;
    case 'upload':
      title.innerText = 'Manage Documents';
      subtitle.innerText = 'Upload or replace verification credentials';
      renderUserUploadZone();
      break;
    case 'status':
      title.innerText = 'Verification Status';
      subtitle.innerText = 'Check application verification progress';
      renderUserDetailedStatus();
      break;
    case 'link':
      title.innerText = 'Secure Onboarding Link';
      subtitle.innerText = 'Access training materials and job portals';
      renderUserAccessLink();
      break;
    case 'notifications':
      title.innerText = 'Notifications Inbox';
      subtitle.innerText = 'History of portal events and status alerts';
      renderUserNotifications();
      break;
    case 'profile':
      title.innerText = 'Candidate Profile Settings';
      subtitle.innerText = 'Keep your personal details up-to-date';
      renderUserProfile();
      break;
  }
};

function setupUserDashboard() {
  const matchedUser = candidates.find(c => c.id === currentUser.id) || currentUser;
  if (!matchedUser) return;

  // Header quick badge
  const quickStatusBadge = document.getElementById('user-quick-status-badge');
  const badgeClass = (matchedUser.status || 'Pending').toLowerCase();
  quickStatusBadge.innerHTML = `<span class="status-pill ${badgeClass}"><i class="fa-solid fa-circle"></i> ${matchedUser.status || 'Pending'}</span>`;

  // Mini statistic widgets
  document.getElementById('dashboard-status-text').innerText = matchedUser.status || 'Pending';
  document.getElementById('dashboard-status-text').className = `stat-value status-pill ${badgeClass}`;
  document.getElementById('dashboard-fic-applied').innerText = matchedUser.appliedFIC || 'Yes';
  document.getElementById('dashboard-notifications-count').innerText = matchedUser.notifications ? matchedUser.notifications.length : 1;

  // Sync avatar characters
  document.getElementById('user-avatar-char').innerText = matchedUser.name ? matchedUser.name.charAt(0).toUpperCase() : 'C';
  document.getElementById('user-badge-name').innerText = matchedUser.name || 'Candidate';
  const roleEl = document.getElementById('user-badge-role');
  if (roleEl) {
    roleEl.innerText = matchedUser.status === 'Approved' ? 'FIC Trainee' : 'Candidate';
  }

  // Next steps interactive card hero inside Overview
  const heroContainer = document.getElementById('user-dashboard-hero-container');
  if (matchedUser.status === 'Pending') {
    heroContainer.innerHTML = `
      <div class="flex-column" style="gap: 0.5rem;">
        <h4 style="color: var(--warning);"><i class="fa-solid fa-hourglass-half"></i> Verification is Currently Pending</h4>
        <p style="font-size: 0.9rem; color: var(--text-muted);">
          Our compliance team is currently verifying your Aadhaar details on the Node server. 
          Once approved, your access link will unlock instantly.
        </p>
        <button onclick="switchUserTab('status')" class="btn-secondary mt-4" style="max-width: 200px;">
          View Live Track Status
        </button>
      </div>
    `;
  } else if (matchedUser.status === 'Rejected') {
    heroContainer.innerHTML = `
      <div class="flex-column" style="gap: 0.5rem;">
        <h4 style="color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Documents Verification Declined</h4>
        <p style="font-size: 0.9rem; color: var(--danger-light); padding: 0.75rem; border-radius: 6px; background: hsla(346, 77%, 49%, 0.05); border: 1px solid rgba(239, 68, 68, 0.2);">
          <strong>Reason:</strong> ${matchedUser.rejectionReason || 'Documents uploaded are invalid.'}
        </p>
        <button onclick="switchUserTab('upload')" class="btn-primary mt-4" style="max-width: 220px;">
          <i class="fa-solid fa-cloud-arrow-up"></i> Upload Valid Documents
        </button>
      </div>
    `;
  } else {
    // Approved state
    heroContainer.innerHTML = `
      <div class="flex-column" style="gap: 0.5rem;">
        <h4 style="color: var(--success);"><i class="fa-solid fa-circle-check"></i> Verification Success! Application Approved</h4>
        <p style="font-size: 0.9rem; color: var(--text-muted);">
          Welcome to Forge India Connect! Your documents have been authenticated on the backend database. 
          Your secure onboarding next step link is ready.
        </p>
        <div class="mt-4" id="access-link-action-container">
          <!-- Dynamic Content based on link status -->
        </div>
      </div>
    `;

    const actionContainer = document.getElementById('access-link-action-container');
    
    if (matchedUser.linkStatus === 'Active') {
      actionContainer.innerHTML = `
        <label class="stat-label">Onboarding Access Link (One-Time Use Only)</label>
        <button onclick="handleAccessLinkClick('${matchedUser.id}')" class="btn-primary access-link-btn" style="max-width: 250px; margin-top:0.5rem;">
          <i class="fa-solid fa-rocket"></i> Reveal & Open Link
        </button>
      `;
    } else if (matchedUser.linkStatus === 'Used') {
      actionContainer.innerHTML = `
        <div style="padding: 1rem; background: hsla(346, 77%, 49%, 0.15); border: 1px solid var(--danger); border-radius: 8px; margin-bottom: 1rem;">
          <i class="fa-solid fa-lock" style="color: var(--danger); margin-bottom: 0.5rem; font-size: 1.5rem;"></i>
          <p style="color: var(--danger); font-weight: 500;">This access link has already been used.</p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">For security purposes, access links can only be used once. Please request admin approval again to generate a new link.</p>
        </div>
        <button onclick="handleRequestReapproval('${matchedUser.id}')" class="btn-secondary" style="border-color: var(--warning); color: var(--warning);">
          <i class="fa-solid fa-hand-paper"></i> Request Re-Approval
        </button>
      `;
    } else if (matchedUser.linkStatus === 'Pending Re-Approval') {
      actionContainer.innerHTML = `
        <div style="padding: 1rem; background: hsla(37, 90%, 51%, 0.15); border: 1px solid var(--warning); border-radius: 8px;">
          <i class="fa-solid fa-hourglass-half" style="color: var(--warning); margin-bottom: 0.5rem; font-size: 1.5rem;"></i>
          <p style="color: var(--warning); font-weight: 500;">Waiting for Admin Approval.</p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">Your request for a new access link is currently under review by the admin team.</p>
        </div>
      `;
    }
  }
}

function renderUserApplication() {
  const matchedUser = candidates.find(c => c.id === currentUser.id);
  if (!matchedUser) return;
  document.getElementById('app-info-name').innerText = matchedUser.name;
  document.getElementById('app-info-email').innerText = matchedUser.email;
  document.getElementById('app-info-mobile').innerText = matchedUser.mobile;
  document.getElementById('app-info-fic').innerText = matchedUser.appliedFIC;
}

function renderUserUploadZone() {
  const matchedUser = candidates.find(c => c.id === currentUser.id);
  if (!matchedUser) return;

  const aadhaarArea = document.getElementById('aadhaar-file-preview-area');

  aadhaarArea.innerHTML = matchedUser.aadhaarDoc ? `
    <div class="file-preview-card">
      <div class="file-preview-info">
        <i class="fa-solid fa-id-card"></i>
        <div class="file-preview-details">
          <span class="file-preview-name">Aadhaar_Card.png</span>
          <span class="file-preview-size">Server Hosted Image</span>
        </div>
      </div>
      <span class="file-preview-action" onclick="viewUserUploadedDoc('aadhaar')"><i class="fa-solid fa-eye"></i> View</span>
    </div>
  ` : `<p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">No document uploaded</p>`;
}

window.viewUserUploadedDoc = function(type) {
  const matchedUser = candidates.find(c => c.id === currentUser.id);
  if (!matchedUser) return;

  const docSrc = matchedUser.aadhaarDoc;
  const title = 'Government Issued Aadhaar Card';

  if (!docSrc) {
    openModal(title, `<p style="color: var(--text-muted); text-align:center; padding: 2rem;">No Aadhaar document uploaded yet.</p>`, `<button class="btn-secondary" onclick="closeModal()">Close</button>`);
    return;
  }

  openModal(title, `
    <div class="text-center">
      <img src="${docSrc}" class="modal-preview-img" alt="${title}" style="width:100%; max-width:560px; border-radius:8px; border:1px solid var(--border-color);">
    </div>
  `, `
    <button class="btn-secondary" onclick="closeModal()">Close Panel</button>
  `);
};

window.handleReplaceFile = function(input, type) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const res = await fetch(`/api/candidates/${currentUser.id}/replace-doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, file: e.target.result })
      });
      if (res.ok) {
        showToast('Document replaced on backend and queued for review', 'success');
        await switchUserTab('upload');
      }
    } catch (err) {
      showToast('Document replacement upload failed', 'danger');
    }
  };
  reader.readAsDataURL(file);
};

function renderUserDetailedStatus() {
  const matchedUser = candidates.find(c => c.id === currentUser.id);
  if (!matchedUser) return;

  const iconBox = document.getElementById('status-detailed-icon-container');
  const titleBox = document.getElementById('status-detailed-title');
  const descBox = document.getElementById('status-detailed-description');
  const linkBox = document.getElementById('status-detailed-onboarding-link-box');

  linkBox.innerHTML = '';

  if (matchedUser.status === 'Pending') {
    iconBox.innerHTML = '<i class="fa-solid fa-shield-halved" style="font-size: 5rem; color: var(--warning); filter: drop-shadow(0 0 20px rgba(245, 158, 11, 0.3));"></i>';
    titleBox.innerText = 'Application Status: Pending Verification';
    descBox.innerText = 'Our administrative experts are cross-referencing your transaction receipts on our Node server against banking databases. Rest assured, you will be notified immediately upon approval.';
  } else if (matchedUser.status === 'Rejected') {
    iconBox.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="font-size: 5rem; color: var(--danger); filter: drop-shadow(0 0 20px rgba(239, 68, 68, 0.3));"></i>';
    titleBox.innerText = 'Application Status: Document Verification Rejected';
    descBox.innerHTML = `Unfortunately, your verification was rejected due to: <br><strong style="color: var(--text-main);">${matchedUser.rejectionReason || 'Incomplete files.'}</strong> <br>Please replace the file in the "Document Upload" tab.`;
  } else {
    // Approved
    iconBox.innerHTML = '<i class="fa-solid fa-circle-check" style="font-size: 5rem; color: var(--success); filter: drop-shadow(0 0 20px rgba(16, 185, 129, 0.3));"></i>';
    titleBox.innerText = 'Application Status: Verification Approved!';
    descBox.innerText = 'FIC verification success! Your payment credentials match our parameters. Click on the onboarding link below to access your next step.';
    linkBox.innerHTML = `
      <div style="padding: 1.5rem; background: var(--success-light); border: 1px solid var(--success); border-radius: 8px; max-width: 400px; margin: 0 auto;" class="flex-column text-center">
        <span class="stat-label" style="color: var(--success); font-weight: 700;">Status: Approved</span>
        <h4 style="margin: 0.5rem 0 1rem;">Your Onboarding Access Link is Ready</h4>
        <button onclick="switchUserTab('access')" class="btn-primary access-link-btn" style="margin: 0 auto; max-width: 250px;">
          Go To Secure Access Page
        </button>
      </div>
    `;
  }
}

function renderUserAccessLink() {
  const matchedUser = candidates.find(c => c.id === currentUser.id);
  if (!matchedUser) return;

  const accessScreen = document.getElementById('user-access-link-screen');

  if (matchedUser.status === 'Approved') {
    accessScreen.innerHTML = `
      <div class="access-link-hero glass-card text-center">
        <i class="fa-solid fa-shield-halved shield"></i>
        <h2 style="font-size: 1.75rem;">Identity & Payments Fully Verified</h2>
        <p style="color: var(--text-muted); max-width: 500px; margin: 0.5rem auto 1.5rem;">
          Your credentials have been successfully authenticated by the FIC Verification Team. 
          Use the secure professional portal link below to enter onboarding.
        </p>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem;">
          🔑 Authorized Role: <strong>FIC Active Trainee</strong>
        </div>
        <div id="access-link-tab-action-container" class="mt-4">
          <!-- Dynamic Content -->
        </div>
      </div>
    `;

    const tabActionContainer = document.getElementById('access-link-tab-action-container');
    
    if (matchedUser.linkStatus === 'Active') {
      tabActionContainer.innerHTML = `
        <label class="stat-label">Onboarding Access Link (One-Time Use Only)</label>
        <button onclick="handleAccessLinkClick('${matchedUser.id}')" class="btn-primary access-link-btn" style="max-width: 250px; margin: 0.5rem auto 0;">
          <i class="fa-solid fa-rocket"></i> Reveal & Open Link
        </button>
      `;
    } else if (matchedUser.linkStatus === 'Used') {
      tabActionContainer.innerHTML = `
        <div style="padding: 1rem; background: hsla(346, 77%, 49%, 0.15); border: 1px solid var(--danger); border-radius: 8px; margin-bottom: 1rem;">
          <i class="fa-solid fa-lock" style="color: var(--danger); margin-bottom: 0.5rem; font-size: 1.5rem;"></i>
          <p style="color: var(--danger); font-weight: 500;">This access link has already been used.</p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">For security purposes, access links can only be used once. Please request admin approval again to generate a new link.</p>
        </div>
        <button onclick="handleRequestReapproval('${matchedUser.id}')" class="btn-secondary" style="border-color: var(--warning); color: var(--warning); margin: 0 auto;">
          <i class="fa-solid fa-hand-paper"></i> Request Re-Approval
        </button>
      `;
    } else if (matchedUser.linkStatus === 'Pending Re-Approval') {
      tabActionContainer.innerHTML = `
        <div style="padding: 1rem; background: hsla(37, 90%, 51%, 0.15); border: 1px solid var(--warning); border-radius: 8px;">
          <i class="fa-solid fa-hourglass-half" style="color: var(--warning); margin-bottom: 0.5rem; font-size: 1.5rem;"></i>
          <p style="color: var(--warning); font-weight: 500;">Waiting for Admin Approval.</p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">Your request for a new access link is currently under review by the admin team.</p>
        </div>
      `;
    }
  } else {
    accessScreen.innerHTML = `
      <div class="glass-card text-center" style="padding: 4rem 2rem; border-color: var(--border-color);">
        <i class="fa-solid fa-link-slash" style="font-size: 4rem; color: var(--text-muted); margin-bottom: 1.5rem;"></i>
        <h3>Secure Link is Currently Locked</h3>
        <p style="color: var(--text-muted); max-width: 480px; margin: 0.5rem auto 1.5rem;">
          The secure onboarding URL will be unlocked here immediately after administrative agents review and Approve your document uploads on the Node server.
        </p>
        <button onclick="switchUserTab('status')" class="btn-secondary">Check Current Queue Status</button>
      </div>
    `;
  }
}

// Handle One-Time Access Link Click
window.handleAccessLinkClick = async function(id) {
  try {
    const res = await fetch(`/api/candidates/${id}/access-link`, {
      method: 'POST'
    });
    const data = await res.json();
    if (res.ok) {
      // Open the link in a new tab
      const finalUrl = data.link.startsWith('http') ? data.link : 'https://' + data.link;
      window.open(finalUrl, '_blank');
      // Sync state to update UI to 'Used'
      await syncState();
      renderUserAccessScreen();
      showToast('Secure link accessed successfully. Link is now locked.', 'success');
    } else {
      showToast(data.error || 'Failed to access secure link', 'danger');
    }
  } catch (err) {
    showToast('Network error accessing link', 'danger');
  }
};

// Handle Request Re-Approval
window.handleRequestReapproval = async function(id) {
  try {
    const res = await fetch(`/api/candidates/${id}/request-reapproval`, {
      method: 'POST'
    });
    if (res.ok) {
      await syncState();
      renderUserAccessScreen();
      showToast('Re-approval request sent to admin team.', 'success');
    } else {
      showToast('Failed to send re-approval request', 'danger');
    }
  } catch (err) {
    showToast('Network error requesting re-approval', 'danger');
  }
};

function renderUserNotifications() {
  const matchedUser = candidates.find(c => c.id === currentUser.id);
  if (!matchedUser) return;

  const notifBox = document.getElementById('user-notifications-list');
  if (matchedUser.notifications.length === 0) {
    notifBox.innerHTML = `<p style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No messages in your notifications archive.</p>`;
    return;
  }

  notifBox.innerHTML = matchedUser.notifications.map(n => {
    let icon = 'fa-info';
    let badgeClass = 'info';
    if (n.type === 'success') { icon = 'fa-check'; badgeClass = 'success'; }
    if (n.type === 'danger') { icon = 'fa-triangle-exclamation'; badgeClass = 'danger'; }
    if (n.type === 'warning') { icon = 'fa-bell'; badgeClass = 'warning'; }

    return `
      <div class="notification-item">
        <div class="notification-badge ${badgeClass}">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="notification-content">
          <span class="notification-title">${n.title}</span>
          <span style="font-size: 0.85rem; color: var(--text-muted);">${n.desc}</span>
          <span class="notification-time">${n.time}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderUserProfile() {
  const matchedUser = candidates.find(c => c.id === currentUser.id);
  if (!matchedUser) return;

  document.getElementById('profile-avatar-large').innerText = matchedUser.name.charAt(0).toUpperCase();
  document.getElementById('profile-avatar-name').innerText = matchedUser.name;
  
  const statusPill = document.getElementById('profile-status-pill');
  statusPill.className = `status-pill ${matchedUser.status.toLowerCase()}`;
  statusPill.innerText = matchedUser.status;

  document.getElementById('profile-name').value = matchedUser.name;
  document.getElementById('profile-mobile').value = matchedUser.mobile;
}

window.handleUpdateProfile = async function(event) {
  event.preventDefault();
  
  const name = document.getElementById('profile-name').value.trim();
  const mobile = document.getElementById('profile-mobile').value.trim();

  try {
    const res = await fetch(`/api/candidates/${currentUser.id}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mobile })
    });
    if (res.ok) {
      showToast('Profile updated on backend successfully', 'success');
      await switchUserTab('profile');
    }
  } catch (err) {
    showToast('Failed to update profile', 'danger');
  }
};

// ----------------------------------------------------
// 7. Administrative Dashboard Core Logic
// ----------------------------------------------------
window.switchAdminTab = async function(tab) {
  activeAdminTab = tab;

  // Collapse mobile sidebar if open
  const sidebar = document.querySelector('#admin-dashboard-container .sidebar');
  if (sidebar) sidebar.classList.remove('active');

  // Toggle active sidebar highlight
  const tabItems = document.querySelectorAll('#admin-dashboard-container .sidebar-item');
  tabItems.forEach(item => item.classList.remove('active'));
  document.getElementById(`admin-tab-${tab}`).classList.add('active');

  // Hide/Show correct panels
  const panels = document.querySelectorAll('.admin-view-panel');
  panels.forEach(p => p.style.display = 'none');
  document.getElementById(`admin-panel-${tab}`).style.display = 'block';

  // Fetch updated data from API first
  await syncState();

  const title = document.getElementById('admin-view-title');
  const subtitle = document.getElementById('admin-view-subtitle');

  switch (tab) {
    case 'dashboard':
      title.innerText = 'Admin Overview Console';
      subtitle.innerText = 'Quick-view stats, recent trends, and server logs';
      setupAdminDashboard();
      break;
    case 'requests':
      title.innerText = 'Pending Review Candidates';
      subtitle.innerText = 'Examine uploaded materials, view Aadhaar details, and take action';
      renderAdminRequests();
      break;
    case 'verification':
      title.innerText = 'Document Verification Queue';
      subtitle.innerText = 'Verify applicant credentials side-by-side';
      renderAdminVerificationQueue();
      break;
    case 'rejected':
      title.innerText = 'Rejected Candidates Archive';
      subtitle.innerText = 'Database of declined applicants. Options to re-review exist';
      renderAdminRejected();
      break;
    case 'approved':
      title.innerText = 'Approved Candidates Specific Links';
      subtitle.innerText = 'Below are candidates whose documents have been approved. You can assign, view, or update their specific onboarding link.';
      renderAdminApproved();
      break;
    case 'reapproval':
      title.innerText = 'Re-Approval Requests';
      subtitle.innerText = 'Candidates who have used their one-time link and are requesting a new access link from admin.';
      renderAdminReApprovalRequests();
      break;
    case 'link-mgmt':
      title.innerText = 'Onboarding Link Manager';
      subtitle.innerText = 'Update default URL pathways and link labeling schemas';
      document.getElementById('global-default-link').value = globalSettings.defaultLink;
      break;
    case 'settings':
      title.innerText = 'System Configuration';
      subtitle.innerText = 'Fine-tune dashboard behaviors and automation variables';
      break;
  }
};

function setupAdminDashboard() {
  const total = candidates.length;
  const pending = candidates.filter(c => c.status === 'Pending').length;
  const approved = candidates.filter(c => c.status === 'Approved').length;
  const rejected = candidates.filter(c => c.status === 'Rejected').length;

  document.getElementById('admin-stat-total').innerText = total;
  document.getElementById('admin-stat-pending').innerText = pending;
  document.getElementById('admin-stat-approved').innerText = approved;
  document.getElementById('admin-stat-rejected').innerText = rejected;

  // Render quick summary alert box
  const summaryBox = document.getElementById('admin-quick-summary-box');
  if (pending > 0) {
    summaryBox.innerHTML = `
      <div class="glass-card" style="background: var(--warning-light); border-color: var(--warning); display: flex; align-items: center; justify-content: space-between; padding: 1.25rem;">
        <div class="flex-row">
          <i class="fa-solid fa-hourglass-half" style="font-size: 1.5rem; color: var(--warning);"></i>
          <div>
            <h4 style="color: var(--warning);">Attention: ${pending} Verification Requests Pending</h4>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Please review these submissions immediately to keep candidate onboarding pipelines smooth.</p>
          </div>
        </div>
        <button onclick="switchAdminTab('requests')" class="btn-primary" style="max-width: 200px; box-shadow: none; background: var(--warning); color: #000;">
          Inspect Queue Now
        </button>
      </div>
    `;
  } else {
    summaryBox.innerHTML = `
      <div class="glass-card" style="background: var(--success-light); border-color: var(--success); display: flex; align-items: center; justify-content: space-between; padding: 1.25rem;">
        <div class="flex-row">
          <i class="fa-solid fa-circle-check" style="font-size: 1.5rem; color: var(--success);"></i>
          <div>
            <h4 style="color: var(--success);">Verification Queue Cleared!</h4>
            <p style="font-size: 0.85rem; color: var(--text-muted);">All uploaded payment documents and credentials have been verified on the backend server.</p>
          </div>
        </div>
      </div>
    `;
  }
}

function renderAdminRequests() {
  const pendingCandidates = candidates.filter(c => c.status === 'Pending');
  const tbody = document.getElementById('admin-requests-table-body');

  if (pendingCandidates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--text-muted); padding: 2rem;">No pending applicant requests on server.</td></tr>`;
    return;
  }

  tbody.innerHTML = pendingCandidates.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>
        <div><i class="fa-solid fa-envelope" style="color: var(--primary); font-size: 0.8rem;"></i> ${c.email}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;"><i class="fa-solid fa-phone" style="font-size: 0.75rem;"></i> ${c.mobile}</div>
      </td>
      <td>
        <span style="font-weight:600; color: ${c.appliedFIC === 'Yes' ? 'var(--success)' : 'var(--text-muted)'}">${c.appliedFIC}</span>
      </td>
      <td>
        <div class="flex-row" style="gap: 0.4rem;">
          <button class="table-doc-btn" onclick="inspectDocument('${c.id}', 'aadhaar')"><i class="fa-solid fa-id-card"></i> Aadhaar</button>
        </div>
      </td>
      <td>
        <span class="status-pill pending"><i class="fa-solid fa-circle-notch fa-spin"></i> Pending</span>
      </td>
      <td>
        <div class="action-btns">
          <button class="btn-action approve" onclick="promptApproveCandidate('${c.id}')" title="Approve Request"><i class="fa-solid fa-check"></i></button>
          <button class="btn-action reject" onclick="promptRejectCandidate('${c.id}')" title="Reject Request"><i class="fa-solid fa-xmark"></i></button>
          <button class="btn-action delete" onclick="deleteCandidate('${c.id}')" title="Delete Candidate" style="background: var(--danger); border-color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderAdminVerificationQueue() {
  const tbody = document.getElementById('admin-verification-table-body');
  if (candidates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--text-muted); padding: 2rem;">No documents to inspect.</td></tr>`;
    return;
  }

  tbody.innerHTML = candidates.map(c => `
    <tr>
      <td>
        <strong>${c.name}</strong><br>
        <span style="font-size: 0.8rem; color: var(--text-muted);">${c.email}</span>
      </td>
      <td>
        <button class="table-doc-btn" onclick="inspectDocument('${c.id}', 'aadhaar')"><i class="fa-solid fa-id-card"></i> Inspect Aadhaar</button>
      </td>
      <td>
        <span class="status-pill ${c.status.toLowerCase()}">${c.status}</span>
      </td>
      <td>
        ${c.status === 'Pending' ? `
          <button class="btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="promptApproveCandidate('${c.id}')">
            Approve Now
          </button>
        ` : `<span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-solid fa-check-double"></i> Evaluated</span>`}
      </td>
    </tr>
  `).join('');
}

function renderAdminApproved() {
  const approved = candidates.filter(c => c.status === 'Approved');
  const tbody = document.getElementById('admin-approved-table-body');

  if (approved.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: var(--text-muted); padding: 2rem;">No approved candidates in database.</td></tr>`;
    return;
  }

  tbody.innerHTML = approved.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.email}</td>
      <td>
        <div class="flex-row">
          <i class="fa-solid fa-link" style="color: var(--success); font-size: 0.85rem;"></i>
          <span style="font-size: 0.8rem; font-family: monospace; overflow: hidden; text-overflow: ellipsis; max-width: 200px; white-space: nowrap;">${c.onboardingLink}</span>
          <button onclick="window.open('${c.onboardingLink}', '_blank')" class="table-doc-btn" style="padding: 0.15rem 0.4rem; font-size:0.75rem;"><i class="fa-solid fa-up-right-from-square"></i> Open</button>
        </div>
      </td>
      <td>
        ${c.linkStatus === 'Active' ? `<span class="status-pill success"><i class="fa-solid fa-bolt"></i> Active</span>` : ''}
        ${c.linkStatus === 'Used' ? `<span class="status-pill danger"><i class="fa-solid fa-lock"></i> Used</span>` : ''}
        ${c.linkStatus === 'Pending Re-Approval' ? `<span class="status-pill warning"><i class="fa-solid fa-clock"></i> Re-Req</span>` : ''}
      </td>
      <td style="font-size: 0.85rem; font-weight: bold;">
        ${c.linkClickCount} / 1
        ${c.linkLastAccessed ? `<br><span style="font-size: 0.7rem; color: var(--text-muted); font-weight: normal;">${new Date(c.linkLastAccessed).toLocaleString()}</span>` : ''}
      </td>
      <td>
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
          ${c.linkStatus === 'Pending Re-Approval' ? `
            <button class="btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="promptApproveCandidate('${c.id}', true)">
              Grant New Link
            </button>
          ` : `
            <button onclick="promptApproveCandidate('${c.id}', true)" class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">
              <i class="fa-solid fa-pen"></i> Edit Link
            </button>
          `}
          <button onclick="deleteCandidate('${c.id}')" class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: var(--danger); color: var(--danger);">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderAdminReApprovalRequests() {
  const reApprovalList = candidates.filter(c => c.linkStatus === 'Pending Re-Approval');
  const tbody = document.getElementById('admin-reapproval-table-body');
  const countText = document.getElementById('reapproval-count-text');

  if (countText) {
    countText.innerText = `${reApprovalList.length} Pending Request${reApprovalList.length !== 1 ? 's' : ''}`;
  }

  if (reApprovalList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 3rem; color: var(--text-muted);">
          <i class="fa-solid fa-circle-check" style="font-size: 2rem; color: var(--success); display: block; margin-bottom: 1rem;"></i>
          No pending re-approval requests. All candidates are up to date!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = reApprovalList.map(c => `
    <tr style="background: hsla(37, 90%, 51%, 0.05); border-left: 3px solid var(--warning);">
      <td>
        <strong>${c.name}</strong><br>
        <span class="status-pill warning" style="margin-top: 0.3rem; display: inline-block;">
          <i class="fa-solid fa-rotate-right"></i> Re-Approval Requested
        </span>
      </td>
      <td style="color: var(--text-muted);">${c.email}</td>
      <td>
        <span style="font-size: 0.78rem; font-family: monospace; color: var(--text-muted); word-break: break-all;">${c.onboardingLink || 'No previous link'}</span>
      </td>
      <td style="font-weight: bold; color: var(--danger); text-align: center;">
        ${c.linkClickCount} / 1
      </td>
      <td style="font-size: 0.8rem; color: var(--text-muted);">
        ${c.linkLastAccessed ? new Date(c.linkLastAccessed).toLocaleString('en-IN') : '—'}
      </td>
      <td>
        <div class="action-btns" style="gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; box-shadow: none;" onclick="promptApproveCandidate('${c.id}', true)">
            <i class="fa-solid fa-link"></i> Grant New Link
          </button>
          <button class="btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; border-color: var(--danger); color: var(--danger);" onclick="promptRejectCandidate('${c.id}')">
            <i class="fa-solid fa-xmark"></i> Reject
          </button>
          <button class="btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; border-color: var(--danger); color: var(--danger);" onclick="deleteCandidate('${c.id}')">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderAdminRejected() {
  const rejected = candidates.filter(c => c.status === 'Rejected');
  const tbody = document.getElementById('admin-rejected-table-body');

  if (rejected.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--text-muted); padding: 2rem;">No rejected candidates in archive.</td></tr>`;
    return;
  }

  tbody.innerHTML = rejected.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.email}</td>
      <td style="color: var(--danger); font-size: 0.85rem; max-width: 250px;">
        <i class="fa-solid fa-triangle-exclamation"></i> ${c.rejectionReason || 'Uploaded materials were illegible.'}
      </td>
      <td>
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
          <button onclick="promptApproveCandidate('${c.id}')" class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: var(--success); color: var(--success);">
            Re-evaluate & Approve
          </button>
          <button onclick="deleteCandidate('${c.id}')" class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: var(--danger); color: var(--danger);">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ----------------------------------------------------
// 8. Document Inspector & Action Trigger Modals
// ----------------------------------------------------
window.inspectDocument = function(candidateId, type) {
  const c = candidates.find(item => item.id === candidateId);
  if (!c) return;

  const docSrc = c.aadhaarDoc;
  const title = `Aadhaar Card: ${c.name}`;

  if (!docSrc) {
    openModal(title, `<p style="color: var(--text-muted); text-align:center; padding: 2rem;">No Aadhaar document uploaded yet.</p>`, `<button class="btn-secondary" onclick="closeModal()">Close</button>`);
    return;
  }

  openModal(title, `
    <div class="text-center">
      <img src="${docSrc}" class="modal-preview-img" alt="${title}" style="width:100%; max-width:560px; border-radius:8px; border:1px solid var(--border-color);">
    </div>
  `, `
    <button class="btn-secondary" onclick="closeModal()">Close Document</button>
  `);
};

window.promptApproveCandidate = function(id, isEdit = false) {
  const c = candidates.find(item => item.id === id);
  if (!c) return;

  const preFilledLink = c.onboardingLink || globalSettings.defaultLink;

  openModal(isEdit ? 'Update Onboarding Link' : 'Accept Registration Request', `
    <div class="flex-column" style="gap: 1rem;">
      <p style="font-size: 0.9rem; color: var(--text-muted);">
        Assign the destination link for <strong>${c.name}</strong>. 
        Upon clicking "Complete Verification", the user's status will update to <strong>Approved</strong> and the link will render inside their user panel.
      </p>
      
      <div class="form-group">
        <label class="form-label" for="modal-onboarding-link">Onboarding / Training Access Link</label>
        <div class="input-container">
          <i class="fa-solid fa-link"></i>
          <input type="url" id="modal-onboarding-link" class="form-control" value="${preFilledLink}" required placeholder="https://">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Professional Label Display</label>
        <div class="form-control no-icon" style="background: hsla(217, 30%, 8%, 0.8); cursor: not-allowed;">
          Candidate Onboarding Link
        </div>
        <span style="font-size: 0.75rem; color: var(--text-muted);">Standardized professional label will be shown to the candidate.</span>
      </div>
    </div>
  `, `
    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="submitApproveCandidate('${id}')" style="box-shadow: none;">
      <i class="fa-solid fa-circle-check"></i> Complete Verification
    </button>
  `);
};

window.submitApproveCandidate = async function(id) {
  const inputLink = document.getElementById('modal-onboarding-link').value.trim();
  if (!inputLink) {
    showToast('Please specify a valid URL link', 'danger');
    return;
  }

  try {
    const res = await fetch(`/api/candidates/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingLink: inputLink })
    });
    if (res.ok) {
      closeModal();
      showToast('Candidate approved and link assigned successfully', 'success');
      await switchAdminTab(activeAdminTab);
    }
  } catch (err) {
    showToast('Failed to approve candidate on backend', 'danger');
  }
};

window.promptRejectCandidate = function(id) {
  const c = candidates.find(item => item.id === id);
  if (!c) return;

  openModal('Decline Registration Request', `
    <div class="flex-column" style="gap: 1rem;">
      <p style="font-size: 0.9rem; color: var(--text-muted);">
        Please specify the reason for declining <strong>${c.name}</strong>'s request. 
        This message will display in their verification tab so they can fix their uploads.
      </p>
      
      <div class="form-group">
        <label class="form-label" for="modal-rejection-reason">Reason for Rejection</label>
        <textarea id="modal-rejection-reason" class="form-control no-icon" style="min-height: 80px;" placeholder="e.g. Uploaded Payment Proof is blurry, please upload full banking slip."></textarea>
      </div>
    </div>
  `, `
    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="submitRejectCandidate('${id}')" style="background: var(--danger); box-shadow: none;">
      Decline Candidate
    </button>
  `);
};

window.submitRejectCandidate = async function(id) {
  const reason = document.getElementById('modal-rejection-reason').value.trim() || 'Uploaded documents were incomplete or blurry.';
  
  try {
    const res = await fetch(`/api/candidates/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (res.ok) {
      closeModal();
      showToast('Candidate status updated to Rejected', 'danger');
      await switchAdminTab(activeAdminTab);
    }
  } catch (err) {
    showToast('Failed to reject candidate on backend', 'danger');
  }
};

window.saveGlobalLinks = async function() {
  const link = document.getElementById('global-default-link').value.trim();
  if (!link) return;

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultLink: link })
    });
    if (res.ok) {
      showToast('Global settings and link presets successfully saved', 'success');
      await syncState();
    }
  } catch (err) {
    showToast('Failed to save settings on server', 'danger');
  }
};

// ----------------------------------------------------
// 9. Floating Modal Dialog Controls
// ----------------------------------------------------
function openModal(title, bodyHtml, footerHtml) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').innerText = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml;
  overlay.classList.add('active');
}

window.closeModal = function() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('active');
};

document.getElementById('modal-close-btn').addEventListener('click', closeModal);

// Close modal when clicking dark backdrop
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

window.toggleSidebar = function(btn) {
  const sidebar = btn.closest('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('active');
  }
};

window.openSidebar = function(btn) {
  const container = btn.closest('.dashboard-shell');
  if (container) {
    const sidebar = container.querySelector('.sidebar');
    if (sidebar) sidebar.classList.add('active');
  }
};

window.closeSidebar = function(overlay) {
  const container = overlay.closest('.dashboard-shell');
  if (container) {
    const sidebar = container.querySelector('.sidebar');
    if (sidebar) sidebar.classList.remove('active');
  }
};

window.deleteCandidate = async function(id) {
  if (!confirm('Are you absolutely sure you want to delete this candidate from the database? This action is permanent.')) {
    return;
  }
  try {
    const res = await fetch(`/api/candidates/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast('Candidate deleted successfully', 'success');
      await syncState();
      await switchAdminTab(activeAdminTab);
    } else {
      const errData = await res.json();
      showToast(errData.error || 'Failed to delete candidate', 'danger');
    }
  } catch (err) {
    showToast('Network error deleting candidate', 'danger');
  }
};

// ----------------------------------------------------
// 10. Initializer Bootstrapper
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Load session from local storage if preset
  const sessionUser = localStorage.getItem(STATE_KEYS.CURRENT_USER);
  if (sessionUser) {
    currentUser = JSON.parse(sessionUser);
  }
  renderApp();
});
