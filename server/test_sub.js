import { query } from './src/config/db.js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { subscribeToPlan } from './src/controllers/savingsController.js';

dotenv.config();

async function testSub() {
  const { rows } = await query("SELECT id FROM users WHERE email = 'cliffkingsley09@gmail.com'");
  const user = rows[0];
  if (!user) return console.log('User not found');
  
  // mock req, res
  const req = {
    user: { id: user.id },
    body: {
      planName: 'CREST',
      targetAmount: 48000,
      numberOfAccounts: 1,
      preferredDay: 'Friday'
    }
  };
  
  const res = {
    status: (code) => ({
      json: (data) => console.log('STATUS', code, 'DATA', data)
    }),
    json: (data) => console.log('SUCCESS', data)
  };
  
  await subscribeToPlan(req, res);
  process.exit(0);
}
testSub();
