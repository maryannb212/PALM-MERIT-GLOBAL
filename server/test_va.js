import { createVirtualAccount } from './src/services/virtualAccountService.js';
import dotenv from 'dotenv';
dotenv.config();

async function testVA() {
  try {
    const res = await createVirtualAccount('f6ec5f65-7bdb-497c-b1f2-b3ad4a981dc4');
    console.log("SUCCESS:", res);
  } catch (e) {
    console.error("FAILED:", e.message);
  }
  process.exit(0);
}

testVA();
