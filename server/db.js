const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../welfare.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Helper to run SQL with Promises
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

// Helper to get all rows with Promises
const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Helper to get single row with Promises
const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

async function initDb() {
  db.serialize(async () => {
    // 1. Create Beneficiaries Table
    db.run(`CREATE TABLE IF NOT EXISTS beneficiaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      aadhaar TEXT UNIQUE,
      mobile TEXT,
      ward TEXT NOT NULL,
      address TEXT NOT NULL,
      caregiver_name TEXT,
      caregiver_mobile TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      notes TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2. Create Categories Table (for multi-category support)
    db.run(`CREATE TABLE IF NOT EXISTS beneficiary_categories (
      beneficiary_id INTEGER,
      category TEXT NOT NULL,
      FOREIGN KEY(beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE,
      PRIMARY KEY (beneficiary_id, category)
    )`);

    // 3. Create Schemes Table
    db.run(`CREATE TABLE IF NOT EXISTS beneficiary_schemes (
      beneficiary_id INTEGER,
      scheme_name TEXT NOT NULL,
      is_enrolled INTEGER NOT NULL DEFAULT 0, -- 1 = enrolled, 0 = eligible but missing
      FOREIGN KEY(beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE,
      PRIMARY KEY (beneficiary_id, scheme_name)
    )`);

    // 4. Create Health Camps Table
    db.run(`CREATE TABLE IF NOT EXISTS health_camps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      month TEXT NOT NULL,
      day TEXT NOT NULL,
      location TEXT NOT NULL,
      invited INTEGER DEFAULT 0,
      time TEXT NOT NULL,
      tags TEXT NOT NULL, -- Comma-separated list
      status TEXT NOT NULL DEFAULT 'planned', -- 'upcoming', 'completed', 'planned'
      attended INTEGER DEFAULT 0
    )`);

    console.log('Database tables verified/created.');

    // Check if database needs seeding
    db.get("SELECT COUNT(*) as count FROM beneficiaries", async (err, row) => {
      if (err) {
        console.error('Error checking table count:', err);
        return;
      }
      if (row.count === 0) {
        console.log('Seeding initial mock data...');
        try {
          await seedData();
          console.log('Database seeded successfully.');
        } catch (seedErr) {
          console.error('Error seeding database:', seedErr);
        }
      } else {
        console.log('Database already has data. Skipping seed.');
      }
    });
  });
}

async function seedData() {
  console.log('Generating 1,248 realistic beneficiary records...');
  
  const firstNamesMale = ['Sreedharan', 'Gopalan', 'Raghavan', 'Baskaran', 'Raman', 'Krishnan', 'Madhavan', 'Kesavan', 'Karthikeyan', 'Sukumaran', 'Narayanan', 'Damodaran', 'Sankaran', 'Velayudhan', 'Janardhanan', 'Padmanabhan', 'Rajan', 'Vijayan', 'Gopikrishnan', 'Ramesh', 'Suresh', 'Murugan', 'Unnikrishnan', 'Haridas'];
  const firstNamesFemale = ['Kalyani', 'Radhamani', 'Devaki', 'Saraswathi', 'Lakshmi', 'Parvathi', 'Ammini', 'Gouri', 'Bhargavi', 'Karthyayani', 'Sumathi', 'Leela', 'Kamala', 'Sreedevi', 'Vilashini', 'Savithri', 'Omana', 'Sarada', 'Padmini', 'Anitha', 'Sobhana', 'Girija', 'Latha', 'Shyamala'];
  const surnames = ['Pillai', 'Nair', 'Kurup', 'Panicker', 'Nambiar', 'Menon', 'Achari', 'Asari', 'Karan', 'Das', 'Prasad', 'Shekhar', 'Varghese', 'Joseph', 'Thomas'];

  const wards = ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5', 'Ward 6', 'Ward 7', 'Ward 8'];
  const statuses = ['Verified', 'Pending', 'Urgent', 'Flagged'];

  // Start transaction for high-speed inserts (takes <100ms instead of 15 seconds)
  await run("BEGIN TRANSACTION");

  try {
    // 1. Insert our 4 main featured beneficiaries first so they have IDs 1 to 4
    await run(`INSERT INTO beneficiaries (id, uid, name, age, gender, aadhaar, mobile, ward, address, caregiver_name, caregiver_mobile, status, notes) 
      VALUES (1, 'JR-2024-0041', 'Omana Pillai', 78, 'Female', '4821-3921-9304', '9447XXXXXX', 'Ward 4', 'Krishnavilasam, Near Temple Rd, Ward 4', 'Sindhu (daughter)', '9847XXXXXX', 'Urgent', 'No pension disbursement for 2 months. Immediate follow-up required.')`);

    await run(`INSERT INTO beneficiaries (id, uid, name, age, gender, aadhaar, mobile, ward, address, caregiver_name, caregiver_mobile, status, notes) 
      VALUES (2, 'JR-2024-0089', 'Rajan Krishnan', 63, 'Male', '3892-4821-0294', '9496XXXXXX', 'Ward 7', 'Sopanam, Ward 7, Kazhakuttam', 'Remesh (son)', '9496YYYYYY', 'Verified', 'Medical certificate expiring in 14 days. Renewal needed.')`);

    await run(`INSERT INTO beneficiaries (id, uid, name, age, gender, aadhaar, mobile, ward, address, caregiver_name, caregiver_mobile, status, notes) 
      VALUES (3, 'JR-2025-0112', 'Sarada Chandran', 81, 'Female', '9204-1829-4820', '', 'Ward 1', 'Sreevalsam, Ward 1, Kazhakuttam', 'Unni (nephew)', '9020XXXXXX', 'Pending', 'Added today. Needs income certificate verification.')`);

    await run(`INSERT INTO beneficiaries (id, uid, name, age, gender, aadhaar, mobile, ward, address, caregiver_name, caregiver_mobile, status, notes) 
      VALUES (4, 'JR-2024-0055', 'Mathew Jose', 69, 'Male', '1920-4829-1029', '9847XXXXXX', 'Ward 2', 'Grace Villa, Ward 2, Kazhakuttam', '', '', 'Verified', 'Enrolled in all major schemes.')`);

    // Add categories for featured
    await run(`INSERT INTO beneficiary_categories (beneficiary_id, category) VALUES (1, 'Elderly')`);
    await run(`INSERT INTO beneficiary_categories (beneficiary_id, category) VALUES (1, 'Bedridden')`);
    await run(`INSERT INTO beneficiary_categories (beneficiary_id, category) VALUES (2, 'PwD')`);
    await run(`INSERT INTO beneficiary_categories (beneficiary_id, category) VALUES (3, 'Elderly')`);
    await run(`INSERT INTO beneficiary_categories (beneficiary_id, category) VALUES (3, 'Widow')`);
    await run(`INSERT INTO beneficiary_categories (beneficiary_id, category) VALUES (4, 'Elderly')`);
    await run(`INSERT INTO beneficiary_categories (beneficiary_id, category) VALUES (4, 'PwD')`);

    // Add schemes for featured
    await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (1, 'IGNOAPS', 1)`);
    await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (1, 'FSC', 1)`);
    await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (1, 'Karunya', 0)`);
    await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (2, 'Disability Allowance', 1)`);
    await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (2, 'Karunya', 1)`);
    await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (2, 'FSC', 1)`);
    await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (3, 'IGNOAPS', 1)`);
    await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (3, 'Karunya', 0)`);
    await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (3, 'FSC', 0)`);
    await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (4, 'IGNOAPS', 1)`);
    await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (4, 'Disability Allowance', 1)`);
    await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (4, 'Karunya', 1)`);

    // 2. Generate 1,244 more records
    const targetCount = 1248;
    for (let i = 5; i <= targetCount; i++) {
      const gender = Math.random() > 0.5 ? 'Male' : 'Female';
      const firstName = gender === 'Male' 
        ? firstNamesMale[Math.floor(Math.random() * firstNamesMale.length)]
        : firstNamesFemale[Math.floor(Math.random() * firstNamesFemale.length)];
      const surname = surnames[Math.floor(Math.random() * surnames.length)];
      const name = `${firstName} ${surname}`;

      // Distribute age: 60 to 95 (ensures they are mostly elderly)
      // To match the 861/1248 ratio (approx 69%), we make 69% of them 60+ and 31% under 60
      const isElderly = Math.random() < 0.69;
      const age = isElderly 
        ? Math.floor(60 + Math.random() * 36) // 60 to 95
        : Math.floor(18 + Math.random() * 42); // 18 to 59

      const ward = wards[Math.floor(Math.random() * wards.length)];
      
      // Match status ratio: ~94 pending (approx 7.5%), ~2% urgent, ~1% flagged, rest verified
      const randStatus = Math.random();
      let status = 'Verified';
      if (randStatus < 0.075) status = 'Pending';
      else if (randStatus < 0.095) status = 'Urgent';
      else if (randStatus < 0.105) status = 'Flagged';

      const aadhaar = `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const mobile = `9447${Math.floor(100000 + Math.random() * 900000)}`;
      const address = `House No. ${Math.floor(10 + Math.random() * 200)}, Near Junction, ${ward}, Kazhakuttam`;
      
      const uid = `JR-2024-${String(i + 1000).padStart(4, '0')}`;

      // Insert beneficiary
      await run(`INSERT INTO beneficiaries (id, uid, name, age, gender, aadhaar, mobile, ward, address, status, notes) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        i, uid, name, age, gender, aadhaar, mobile, ward, address, status, ''
      ]);

      // Categories
      const categories = [];
      if (age >= 60) categories.push('Elderly');
      
      // Assign PwD status to approx 31% of beneficiaries to match the ~387 count
      const isPwD = Math.random() < 0.31;
      if (isPwD) categories.push('PwD');

      if (gender === 'Female' && Math.random() < 0.25) categories.push('Widow');
      if (isPwD && Math.random() < 0.15) categories.push('Bedridden');

      // Fallback: make sure everyone has at least one category
      if (categories.length === 0) {
        categories.push(Math.random() > 0.5 ? 'Elderly' : 'PwD');
      }

      for (let cat of categories) {
        await run(`INSERT INTO beneficiary_categories (beneficiary_id, category) VALUES (?, ?)`, [i, cat]);
      }

      // Schemes
      // IGNOAPS: Eligible if age >= 60. Let's enroll 82% of eligible ones.
      if (age >= 60) {
        await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (?, 'IGNOAPS', ?)`, [
          i, Math.random() < 0.82 ? 1 : 0
        ]);
      }

      // Disability Allowance: Eligible if PwD. Let's enroll 61% of eligible ones.
      if (isPwD) {
        await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (?, 'Disability Allowance', ?)`, [
          i, Math.random() < 0.61 ? 1 : 0
        ]);
      }

      // Karunya Health: Let's enroll 74% of all beneficiaries.
      await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (?, 'Karunya', ?)`, [
        i, Math.random() < 0.74 ? 1 : 0
      ]);

      // Food Security Card (FSC): Let's enroll 91% of all beneficiaries.
      await run(`INSERT INTO beneficiary_schemes (beneficiary_id, scheme_name, is_enrolled) VALUES (?, 'FSC', ?)`, [
        i, Math.random() < 0.91 ? 1 : 0
      ]);
    }

    // Insert health camps
    await run(`INSERT INTO health_camps (title, month, day, location, invited, time, tags, status, attended) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'General Health Screening', 'JUL', '05', 'Ward 5 Community Hall', 48, '9:00 AM – 1:00 PM', 'Blood Pressure,Diabetes,Eye Check', 'upcoming', 0
    ]);

    await run(`INSERT INTO health_camps (title, month, day, location, invited, time, tags, status, attended) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'Physiotherapy Outreach', 'JUN', '12', 'Ward 3 Anganwadi Centre', 36, '9:00 AM – 1:00 PM', 'Physiotherapy,Mobility', 'completed', 31
    ]);

    await run(`INSERT INTO health_camps (title, month, day, location, invited, time, tags, status, attended) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'Mental Wellness Session', 'AUG', '22', 'Ward 7 Panchayat Office', 0, '10:00 AM – 12:30 PM', 'Mental Health,Counselling', 'planned', 0
    ]);

    await run("COMMIT");
  } catch (err) {
    await run("ROLLBACK");
    throw err;
  }
}

module.exports = {
  db,
  initDb,
  run,
  all,
  get
};
