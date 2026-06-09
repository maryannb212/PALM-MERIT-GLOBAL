import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { sendTermiiSMS } from '../utils/termiiService.js';

const testSMS = async () => {
  console.log('Sending test SMS to +2349113649045...');
  try {
    const response = await sendTermiiSMS('+2349113649045', 'Your test code is 123456');
    console.log('SMS test completed. Response:', response);
    process.exit(0);
  } catch (err) {
    console.error('SMS test failed:', err);
    process.exit(1);
  }
};

testSMS();
