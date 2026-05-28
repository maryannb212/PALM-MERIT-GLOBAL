import { createUser } from '../server/src/models/userModel.js';
import bcrypt from 'bcryptjs';

(async () => {
  const firstName = 'Daniella';
  const lastName = 'Emeribe';
  const email = 'daniellagwennie@gmail.com';
  const phone = '+2347040455876';
  const password = 'TempPass123!'; // temporary password
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await createUser(firstName, lastName, email, passwordHash, phone);
    console.log('User created:', user);
  } catch (err) {
    console.error('Error creating user:', err);
  }
})();
