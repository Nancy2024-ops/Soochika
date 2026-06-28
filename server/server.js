const express = require('express');
const cors = require('cors');
const { initDb, all, run, get } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Database on startup
initDb();

// ── AUTHENTICATION ENDPOINTS ────────────────────────────────────────
const MOCK_OFFICER = {
  username: 'anitha.ward7',
  password: 'password123',
  name: 'Anitha Oommen',
  role: 'Ward Officer'
};

// Store active OTPs in memory for verification
const activeOtps = {};

// 1. Password Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (username === MOCK_OFFICER.username && password === MOCK_OFFICER.password) {
    res.json({
      success: true,
      user: { name: MOCK_OFFICER.name, role: MOCK_OFFICER.role }
    });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

// 2. Send Aadhaar OTP (Simulated)
app.post('/api/auth/aadhaar-send', (req, res) => {
  const { aadhaar } = req.body;
  if (!aadhaar || aadhaar.replace(/-/g, '').length !== 12) {
    return res.status(400).json({ error: 'Please enter a valid 12-digit Aadhaar number' });
  }

  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  activeOtps[aadhaar] = otp;

  console.log(`[AUTH] Simulated SMS sent to mobile linked with Aadhaar ${aadhaar}. OTP is: ${otp}`);

  res.json({
    success: true,
    message: 'OTP sent successfully to registered mobile number',
    otp: otp // Returning it in the response so the frontend can display/auto-fill it for easy testing!
  });
});

// 3. Verify Aadhaar OTP
app.post('/api/auth/aadhaar-verify', (req, res) => {
  const { aadhaar, otp } = req.body;
  if (!aadhaar || !otp) {
    return res.status(400).json({ error: 'Aadhaar number and OTP are required' });
  }

  if (activeOtps[aadhaar] === otp) {
    delete activeOtps[aadhaar]; // Consume the OTP
    res.json({
      success: true,
      user: { name: MOCK_OFFICER.name, role: MOCK_OFFICER.role }
    });
  } else {
    res.status(401).json({ error: 'Invalid OTP. Please try again.' });
  }
});

// ── 1. GET DASHBOARD STATS ───────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const totalRow = await get("SELECT COUNT(*) as count FROM beneficiaries");
    const pendingRow = await get("SELECT COUNT(*) as count FROM beneficiaries WHERE status = 'Pending'");
    
    // Count of PwD
    const pwdRow = await get(`
      SELECT COUNT(DISTINCT beneficiary_id) as count 
      FROM beneficiary_categories 
      WHERE category = 'PwD'
    `);
    
    // Count of Elderly
    const elderlyRow = await get(`
      SELECT COUNT(DISTINCT beneficiary_id) as count 
      FROM beneficiary_categories 
      WHERE category = 'Elderly'
    `);

    // Ward distribution
    const wardStats = await all(`
      SELECT ward, COUNT(*) as count 
      FROM beneficiaries 
      GROUP BY ward
    `);

    // Scheme coverage summary
    const schemeStats = await all(`
      SELECT scheme_name, 
             SUM(case when is_enrolled = 1 then 1 else 0 end) as enrolled,
             SUM(case when is_enrolled = 0 then 1 else 0 end) as missing
      FROM beneficiary_schemes
      GROUP BY scheme_name
    `);

    res.json({
      total: totalRow.count,
      pwd: pwdRow.count,
      elderly: elderlyRow.count,
      pending: pendingRow.count,
      wardStats,
      schemeStats
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ── 2. GET BENEFICIARIES WITH FILTERS ───────────────────────────────
app.get('/api/beneficiaries', async (req, res) => {
  try {
    const { ward, category, scheme, status, search } = req.query;
    
    let query = `
      SELECT b.* FROM beneficiaries b
      WHERE 1=1
    `;
    const params = [];

    if (ward && ward !== 'All Wards') {
      query += ` AND b.ward = ?`;
      params.push(ward);
    }

    if (status && status !== 'All Status') {
      query += ` AND b.status = ?`;
      params.push(status);
    }

    if (search) {
      query += ` AND (b.name LIKE ? OR b.uid LIKE ? OR b.mobile LIKE ? OR b.aadhaar LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (category && category !== 'All Categories') {
      // Resolve standard category labels to codes
      let catFilter = category;
      if (category.includes('Elderly')) catFilter = 'Elderly';
      else if (category.includes('Disability') || category.includes('PwD')) catFilter = 'PwD';
      else if (category.includes('Bedridden') || category.includes('Homebound')) catFilter = 'Bedridden';
      else if (category.includes('Widow')) catFilter = 'Widow';

      query += ` AND b.id IN (SELECT beneficiary_id FROM beneficiary_categories WHERE category = ?)`;
      params.push(catFilter);
    }

    if (scheme && scheme !== 'All Schemes') {
      query += ` AND b.id IN (SELECT beneficiary_id FROM beneficiary_schemes WHERE scheme_name = ? AND is_enrolled = 1)`;
      params.push(scheme);
    }

    if (req.query.missing_scheme) {
      query += ` AND b.id IN (SELECT beneficiary_id FROM beneficiary_schemes WHERE scheme_name = ? AND is_enrolled = 0)`;
      params.push(req.query.missing_scheme);
    }

    query += ` ORDER BY b.id DESC LIMIT 60`;
    const beneficiaries = await all(query, params);

    // Fetch categories and schemes for each beneficiary
    for (let b of beneficiaries) {
      const categories = await all("SELECT category FROM beneficiary_categories WHERE beneficiary_id = ?", [b.id]);
      b.categories = categories.map(c => c.category);

      const schemes = await all("SELECT scheme_name, is_enrolled FROM beneficiary_schemes WHERE beneficiary_id = ?", [b.id]);
      b.schemes = schemes;
    }

    res.json(beneficiaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch beneficiaries' });
  }
});

// ── 3. GET SINGLE BENEFICIARY BY ID OR UID ─────────────────────────
app.get('/api/beneficiaries/:id', async (req, res) => {
  try {
    const idOrUid = req.params.id;
    let beneficiary;
    
    if (idOrUid.startsWith('JR-')) {
      beneficiary = await get("SELECT * FROM beneficiaries WHERE uid = ?", [idOrUid]);
    } else {
      beneficiary = await get("SELECT * FROM beneficiaries WHERE id = ?", [idOrUid]);
    }

    if (!beneficiary) {
      return res.status(404).json({ error: 'Beneficiary not found' });
    }

    const categories = await all("SELECT category FROM beneficiary_categories WHERE beneficiary_id = ?", [beneficiary.id]);
    beneficiary.categories = categories.map(c => c.category);

    const schemes = await all("SELECT scheme_name, is_enrolled FROM beneficiary_schemes WHERE beneficiary_id = ?", [beneficiary.id]);
    beneficiary.schemes = schemes;

    res.json(beneficiary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch beneficiary' });
  }
});

// ── 4. REGISTER NEW BENEFICIARY ────────────────────────────────────
app.post('/api/beneficiaries', async (req, res) => {
  try {
    const {
      name, age, gender, aadhaar, mobile, ward, address,
      caregiver_name, caregiver_mobile, notes, categories, schemes
    } = req.body;

    if (!name || !age || !gender || !aadhaar || !ward || !address) {
      return res.status(400).json({ error: 'Required fields are missing' });
    }

    // Generate unique UID (e.g. JR-2026-0005)
    const year = new Date().getFullYear();
    const countRow = await get("SELECT COUNT(*) as count FROM beneficiaries");
    const nextNum = String(countRow.count + 1).padStart(4, '0');
    const uid = `JR-${year}-${nextNum}`;

    // Insert beneficiary
    const result = await run(`
      INSERT INTO beneficiaries (uid, name, age, gender, aadhaar, mobile, ward, address, caregiver_name, caregiver_mobile, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
    `, [uid, name, parseInt(age, 10), gender, aadhaar, mobile, ward, address, caregiver_name, caregiver_mobile, notes]);

    const beneficiaryId = result.lastID;

    // Insert categories if provided
    if (categories && Array.isArray(categories)) {
      for (let cat of categories) {
        await run("INSERT INTO beneficiary_categories (beneficiary_id, category) VALUES (?, ?)", [beneficiaryId, cat]);
      }
    }

    // Insert schemes with enrollment status
    // Schemes available: IGNOAPS, Karunya, Disability Allowance, FSC
    const defaultSchemes = ['IGNOAPS', 'Karunya', 'Disability Allowance', 'FSC'];
    if (schemes && typeof schemes === 'object') {
      for (let sName of defaultSchemes) {
        const isEnrolled = schemes[sName] ? 1 : 0;
        await run("INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (?, ?, ?)", [
          beneficiaryId, sName, isEnrolled
        ]);
      }
    } else {
      // Insert defaults as not enrolled
      for (let sName of defaultSchemes) {
        await run("INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (?, ?, 0)", [
          beneficiaryId, sName
        ]);
      }
    }

    res.status(201).json({ success: true, id: beneficiaryId, uid });
  } catch (err) {
    console.error(err);
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Aadhaar number or UID already exists' });
    } else {
      res.status(500).json({ error: 'Failed to register beneficiary' });
    }
  }
});

// ── 5. UPDATE BENEFICIARY ──────────────────────────────────────────
app.put('/api/beneficiaries/:id', async (req, res) => {
  try {
    const beneficiaryId = req.params.id;
    const {
      name, age, gender, aadhaar, mobile, ward, address,
      caregiver_name, caregiver_mobile, status, notes, categories, schemes
    } = req.body;

    const existing = await get("SELECT id FROM beneficiaries WHERE id = ?", [beneficiaryId]);
    if (!existing) {
      return res.status(404).json({ error: 'Beneficiary not found' });
    }

    // Update main fields
    await run(`
      UPDATE beneficiaries 
      SET name = ?, age = ?, gender = ?, aadhaar = ?, mobile = ?, ward = ?, address = ?,
          caregiver_name = ?, caregiver_mobile = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, parseInt(age, 10), gender, aadhaar, mobile, ward, address, caregiver_name, caregiver_mobile, status, notes, beneficiaryId]);

    // Update categories
    if (categories && Array.isArray(categories)) {
      await run("DELETE FROM beneficiary_categories WHERE beneficiary_id = ?", [beneficiaryId]);
      for (let cat of categories) {
        await run("INSERT INTO beneficiary_categories (beneficiary_id, category) VALUES (?, ?)", [beneficiaryId, cat]);
      }
    }

    // Update schemes
    if (schemes && typeof schemes === 'object') {
      await run("DELETE FROM beneficiary_schemes WHERE beneficiary_id = ?", [beneficiaryId]);
      for (let [sName, isEnrolled] of Object.entries(schemes)) {
        await run("INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (?, ?, ?)", [
          beneficiaryId, sName, isEnrolled ? 1 : 0
        ]);
      }
    }

    res.json({ success: true, message: 'Beneficiary updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update beneficiary' });
  }
});

// ── 6. GET HEALTH CAMPS ─────────────────────────────────────────────
app.get('/api/camps', async (req, res) => {
  try {
    const camps = await all("SELECT * FROM health_camps ORDER BY id DESC");
    // Parse tags back into array
    camps.forEach(c => {
      c.tags = c.tags ? c.tags.split(',') : [];
    });
    res.json(camps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch health camps' });
  }
});

// ── 7. SCHEDULE HEALTH CAMP ────────────────────────────────────────
app.post('/api/camps', async (req, res) => {
  try {
    const { title, month, day, location, invited, time, tags, status } = req.body;
    
    if (!title || !month || !day || !location || !time) {
      return res.status(400).json({ error: 'Required fields are missing' });
    }

    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');

    const result = await run(`
      INSERT INTO health_camps (title, month, day, location, invited, time, tags, status, attended)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [title, month, day, location, parseInt(invited, 10) || 0, time, tagsStr, status || 'planned']);

    res.status(201).json({ success: true, id: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to schedule health camp' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
