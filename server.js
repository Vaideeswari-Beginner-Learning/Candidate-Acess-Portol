/**
 * FIC Candidate Access Portal - Backend Express Server
 * Implements REST APIs and persistent database file storage using database.json.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8282;
const DB_PATH = path.join(__dirname, 'database.json');

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Configure body-parsers with 50MB limit to handle Base64 image uploads smoothly
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static client assets from the /public folder
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// 1. Dynamic SVG Document Seeders
// ----------------------------------------------------
function createMockDocumentSVG(name) {
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">
      <rect width="600" height="380" fill="#f4f7f6" stroke="#006699" stroke-width="8"/>
      <rect x="4" y="4" width="592" height="25" fill="#ff9933"/>
      <rect x="4" y="29" width="592" height="25" fill="#ffffff"/>
      <rect x="4" y="54" width="592" height="25" fill="#128807"/>
      <circle cx="60" cy="130" r="25" fill="#000088"/>
      <text x="60" y="134" fill="#ffffff" font-size="10" font-family="sans-serif" font-weight="bold" text-anchor="middle">SEAL</text>
      <text x="120" y="125" fill="#333333" font-size="20" font-family="sans-serif" font-weight="bold">Government of India</text>
      <text x="120" y="145" fill="#666666" font-size="12" font-family="sans-serif">Unique Identification Authority of India</text>
      <rect x="50" y="190" width="110" height="130" fill="#cccccc"/>
      <text x="105" y="260" fill="#555555" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle">PHOTO</text>
      <text x="180" y="210" fill="#222222" font-size="16" font-family="sans-serif" font-weight="bold">Name: ${name}</text>
      <text x="180" y="235" fill="#444444" font-size="13" font-family="sans-serif">DOB: 15/08/2001</text>
      <text x="180" y="255" fill="#444444" font-size="13" font-family="sans-serif">Gender: Male / M</text>
      <text x="180" y="275" fill="#444444" font-size="13" font-family="sans-serif">Address: 12, Tech Park Avenue, Bengaluru</text>
      <text x="180" y="325" fill="#aa0000" font-size="26" font-family="sans-serif" font-weight="bold">5489 8721 0041</text>
      <text x="180" y="350" fill="#666666" font-size="11" font-family="sans-serif">Aadhaar is a proof of identity, not of citizenship.</text>
    </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`;
}

// Get raw initial seed database structure
function getInitialSeedData() {
  return {
    globalSettings: {
      defaultLink: 'https://forgeindiaconnect.com/training-access',
      linkName: 'Candidate Onboarding Link'
    },
    candidates: [
      {
        id: 'user_1',
        name: 'Rajesh Kumar',
        email: 'candidate@fic.com',
        password: 'password123',
        mobile: '9876543210',
        appliedFIC: 'Yes',
        aadhaarDoc: createMockDocumentSVG('Rajesh Kumar'),
        status: 'Pending',
        onboardingLink: '',
        linkStatus: 'Active',
        linkClickCount: 0,
        linkLastAccessed: null,
        rejectionReason: '',
        notifications: [
          { id: 'n1', title: 'Welcome to Forge India Connect!', desc: 'Your candidate portal account is set up successfully.', time: 'Just now', type: 'info' },
          { id: 'n2', title: 'Application Submitted', desc: 'Aadhaar Card upload is queued for approval.', time: '1 minute ago', type: 'warning' }
        ]
      },
      {
        id: 'user_2',
        name: 'Anjali Sharma',
        email: 'anjali@example.com',
        password: 'password123',
        mobile: '9988776655',
        appliedFIC: 'Yes',
        aadhaarDoc: createMockDocumentSVG('Anjali Sharma'),
        status: 'Approved',
        onboardingLink: 'https://forgeindiaconnect.com/onboarding-batch-a',
        linkStatus: 'Active',
        linkClickCount: 0,
        linkLastAccessed: null,
        rejectionReason: '',
        notifications: [
          { id: 'n3', title: 'Application Approved! 🎉', desc: 'Admin has verified your details and generated your onboarding link.', time: '1 hour ago', type: 'success' }
        ]
      },
      {
        id: 'user_3',
        name: 'Vikram Singh',
        email: 'vikram@example.com',
        password: 'password123',
        mobile: '9123456789',
        appliedFIC: 'No',
        aadhaarDoc: createMockDocumentSVG('Vikram Singh'),
        status: 'Rejected',
        onboardingLink: '',
        linkStatus: 'Active',
        linkClickCount: 0,
        linkLastAccessed: null,
        rejectionReason: 'The uploaded Aadhaar Card document was illegible. Please re-upload.',
        notifications: [
          { id: 'n4', title: 'Document Verification Rejected ⚠️', desc: 'Aadhaar Card photo is blurry. Please replace your document.', time: '2 hours ago', type: 'danger' }
        ]
      }
    ]
  };
}

// ----------------------------------------------------
// 2. Database Read / Writes Controllers
// ----------------------------------------------------
function readDatabase() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initialData = getInitialSeedData();
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf8');
      return initialData;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading JSON database file:', err);
    return getInitialSeedData();
  }
}

function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to JSON database file:', err);
  }
}

// Initialize on start
readDatabase();

// ----------------------------------------------------
// 3. REST API Routes
// ----------------------------------------------------

// API: Register Candidate
app.post('/api/register', (req, res) => {
  const { name, email, password, mobile, appliedFIC, aadhaarDoc } = req.body;
  const db = readDatabase();

  if (email === 'admin@fic.com' || db.candidates.some(c => c.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'A candidate account already exists with this email address.' });
  }

  // Generate dynamic SVGs if attachments were somehow not loaded on client
  const finalAadhaar = aadhaarDoc || createMockDocumentSVG(name);

  const newCandidate = {
    id: 'user_' + Date.now(),
    name,
    email: email.toLowerCase(),
    password,
    mobile,
    appliedFIC,
    aadhaarDoc: finalAadhaar,
    status: 'Pending',
    onboardingLink: '',
    linkStatus: 'Active',
    linkClickCount: 0,
    linkLastAccessed: null,
    rejectionReason: '',
    notifications: [
      { id: 'n_reg_' + Date.now(), title: 'Welcome to Forge India Connect!', desc: 'Your account is active. Documents verification is pending.', time: 'Just now', type: 'info' }
    ]
  };

  db.candidates.push(newCandidate);
  writeDatabase(db);

  res.status(201).json({ success: true, user: newCandidate });
});

// API: Login Credentials Validation
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDatabase();

  const lowerEmail = email.toLowerCase();

  // Admin authentication check
  if (lowerEmail === 'admin@fic.com' && password === 'admin123') {
    return res.json({ success: true, role: 'admin', user: { email: 'admin@fic.com', name: 'FIC Admin Team' } });
  }

  // Candidate authentication check
  const candidate = db.candidates.find(c => c.email === lowerEmail && c.password === password);
  if (candidate) {
    return res.json({ success: true, role: 'candidate', user: candidate });
  }

  res.status(401).json({ error: 'Invalid email address or secure password.' });
});

// API: Get Candidates list (Admin-only)
app.get('/api/candidates', (req, res) => {
  const db = readDatabase();
  res.json(db.candidates);
});

// API: Approve Candidate and Assign Onboarding Link
app.post('/api/candidates/:id/approve', (req, res) => {
  const { onboardingLink } = req.body;
  const { id } = req.params;
  const db = readDatabase();

  const cIndex = db.candidates.findIndex(item => item.id === id);
  if (cIndex === -1) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  db.candidates[cIndex].status = 'Approved';
  db.candidates[cIndex].onboardingLink = onboardingLink;
  db.candidates[cIndex].linkStatus = 'Active';
  db.candidates[cIndex].linkClickCount = 0;
  db.candidates[cIndex].rejectionReason = '';

  // Add notification to candidate feed
  db.candidates[cIndex].notifications.unshift({
    id: 'n_app_' + Date.now(),
    title: 'Application Approved! 🎉',
    desc: `Your Aadhaar validation was successful. Your "Candidate Onboarding Link" is now active.`,
    time: 'Just now',
    type: 'success'
  });

  writeDatabase(db);
  res.json({ success: true, user: db.candidates[cIndex] });
});

// API: Access Link (One-Time Logic)
app.post('/api/candidates/:id/access-link', (req, res) => {
  const { id } = req.params;
  const db = readDatabase();

  const cIndex = db.candidates.findIndex(item => item.id === id);
  if (cIndex === -1) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  const candidate = db.candidates[cIndex];

  if (candidate.linkStatus === 'Active') {
    db.candidates[cIndex].linkStatus = 'Used';
    db.candidates[cIndex].linkClickCount += 1;
    db.candidates[cIndex].linkLastAccessed = new Date().toISOString();
    
    writeDatabase(db);
    return res.json({ success: true, link: candidate.onboardingLink, status: 'Used' });
  } else {
    return res.status(403).json({ error: 'This access link has already been used. Please request admin approval again.' });
  }
});

// API: Request Re-Approval for Link
app.post('/api/candidates/:id/request-reapproval', (req, res) => {
  const { id } = req.params;
  const db = readDatabase();

  const cIndex = db.candidates.findIndex(item => item.id === id);
  if (cIndex === -1) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  db.candidates[cIndex].linkStatus = 'Pending Re-Approval';
  db.candidates[cIndex].notifications.unshift({
    id: 'n_req_' + Date.now(),
    title: 'Re-Approval Requested',
    desc: `You have requested a new onboarding access link from the admin.`,
    time: 'Just now',
    type: 'info'
  });

  writeDatabase(db);
  res.json({ success: true, user: db.candidates[cIndex] });
});

// API: Reject Candidate and Record Reason
app.post('/api/candidates/:id/reject', (req, res) => {
  const { reason } = req.body;
  const { id } = req.params;
  const db = readDatabase();

  const cIndex = db.candidates.findIndex(item => item.id === id);
  if (cIndex === -1) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  db.candidates[cIndex].status = 'Rejected';
  db.candidates[cIndex].rejectionReason = reason || 'Uploaded documents were blurry or incomplete.';
  db.candidates[cIndex].onboardingLink = '';

  db.candidates[cIndex].notifications.unshift({
    id: 'n_rej_' + Date.now(),
    title: 'Verification Declined ⚠️',
    desc: `Reason: ${reason}`,
    time: 'Just now',
    type: 'danger'
  });

  writeDatabase(db);
  res.json({ success: true, user: db.candidates[cIndex] });
});

// API: Replace blur document (resets status back to Pending)
app.post('/api/candidates/:id/replace-doc', (req, res) => {
  const { type, file } = req.body;
  const { id } = req.params;
  const db = readDatabase();

  const cIndex = db.candidates.findIndex(item => item.id === id);
  if (cIndex === -1) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  if (type === 'aadhaar') db.candidates[cIndex].aadhaarDoc = file;

  db.candidates[cIndex].status = 'Pending';
  db.candidates[cIndex].rejectionReason = '';

  db.candidates[cIndex].notifications.unshift({
    id: 'n_rep_' + Date.now(),
    title: 'Document Replaced',
    desc: `You updated your Aadhaar Card. Status has reset to Pending.`,
    time: 'Just now',
    type: 'warning'
  });

  writeDatabase(db);
  res.json({ success: true, user: db.candidates[cIndex] });
});

// API: Update profile variables
app.post('/api/candidates/:id/profile', (req, res) => {
  const { name, mobile } = req.body;
  const { id } = req.params;
  const db = readDatabase();

  const cIndex = db.candidates.findIndex(item => item.id === id);
  if (cIndex === -1) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  db.candidates[cIndex].name = name;
  db.candidates[cIndex].mobile = mobile;

  writeDatabase(db);
  res.json({ success: true, user: db.candidates[cIndex] });
});

// API: Delete Candidate
app.delete('/api/candidates/:id', (req, res) => {
  const { id } = req.params;
  const db = readDatabase();
  const originalLength = db.candidates.length;
  db.candidates = db.candidates.filter(c => c.id !== id);
  if (db.candidates.length === originalLength) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }
  writeDatabase(db);
  res.json({ success: true, message: 'Candidate deleted successfully.' });
});

// API: Reset DB to default seed data
app.post('/api/reset-db', (req, res) => {
  const seed = getInitialSeedData();
  writeDatabase(seed);
  res.json({ success: true, message: 'Database reset to initial configurations successfully.' });
});

// GET: Current global settings parameters
app.get('/api/settings', (req, res) => {
  const db = readDatabase();
  res.json(db.globalSettings);
});

// POST: Save global default link
app.post('/api/settings', (req, res) => {
  const { defaultLink } = req.body;
  const db = readDatabase();
  db.globalSettings.defaultLink = defaultLink;
  writeDatabase(db);
  res.json({ success: true, settings: db.globalSettings });
});

// Catch-all: Route all other requests directly to index.html for smooth client SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server execution
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 FORGE INDIA CONNECT PORTAL IS RUNNING!`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`📁 Static Directory: ${path.join(__dirname, 'public')}`);
  console.log(`💾 JSON Database Path: ${DB_PATH}`);
  console.log(`==================================================`);
});
