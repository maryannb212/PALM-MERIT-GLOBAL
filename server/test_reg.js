import { query } from './src/config/db.js';
import bcrypt from 'bcrypt';

async function test() {
  try {
    const firstName = 'Test';
    const lastName = 'User';
    const email = ''; // Empty email
    const phone = '080' + Math.floor(10000000 + Math.random() * 90000000);
    const password = 'password123';
    const referredByCode = '';

    console.log('Phone number:', phone);

    const normalizedPhone = phone.trim();
    const normalizedEmail = (email && email.trim() !== '') ? email.trim().toLowerCase() : null;

    const validationPromises = [
      query('SELECT id, phone FROM users WHERE phone = $1', [normalizedPhone])
    ];

    if (normalizedEmail) {
      validationPromises.push(query('SELECT id FROM users WHERE email = $1', [normalizedEmail]));
    } else {
      validationPromises.push(Promise.resolve({ rows: [] }));
    }

    if (referredByCode && referredByCode.trim()) {
      validationPromises.push(query('SELECT id, referral_unlock_date FROM users WHERE referral_code = $1', [referredByCode.trim()]));
    } else {
      validationPromises.push(Promise.resolve({ rows: [] }));
    }

    console.log('Running validations...');
    const [phoneMatchRes, emailMatchRes, referrerRes] = await Promise.all(validationPromises);
    console.log('Validations done!');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const role = 'user';
    const newReferralCode = 'TX-' + Math.floor(10000 + Math.random() * 90000);
    const createdDate = new Date();
    const unlockDate = new Date();
    unlockDate.setMonth(unlockDate.getMonth() + 1);

    const sql = `
      INSERT INTO users (first_name, last_name, email, password_hash, phone, role, referral_code, referred_by, referral_unlock_date, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id;
    `;
    const emailToSave = normalizedEmail;

    console.log('Inserting user with email:', emailToSave);
    const result = await query(sql, [
      firstName,
      lastName,
      emailToSave,
      passwordHash,
      normalizedPhone,
      role,
      newReferralCode,
      null,
      unlockDate,
      createdDate
    ]);

    console.log('User created successfully! ID:', result.rows[0].id);
  } catch (err) {
    console.error('Error during registration test:', err);
  } finally {
    process.exit(0);
  }
}

test();
