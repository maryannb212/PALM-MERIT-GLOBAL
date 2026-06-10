import { getClient, query } from './src/config/db.js';
import { createReferralCodeForPlan } from './src/models/referralModel.js';

const generateSilverReferrals = async () => {
  console.log('--- Starting Backfill for Existing Silver Plans ---');
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    // Find all active SILVER plans that do NOT have a referral code yet
    const sql = `
      SELECT sp.id, sp.user_id, sp.plan_name 
      FROM savings_plans sp
      LEFT JOIN referral_codes rc ON sp.id = rc.plan_id
      WHERE sp.plan_name = 'SILVER' 
        AND sp.status = 'active'
        AND rc.id IS NULL
    `;
    const { rows: missingPlans } = await client.query(sql);
    
    console.log(`Found ${missingPlans.length} active Silver plans missing referral codes.`);
    
    let generatedCount = 0;
    for (const plan of missingPlans) {
      await createReferralCodeForPlan(client, plan.user_id, plan.id, plan.plan_name);
      generatedCount++;
    }
    
    await client.query('COMMIT');
    console.log(`Successfully generated ${generatedCount} referral codes.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error generating referral codes:', err);
  } finally {
    client.release();
    process.exit(0);
  }
};

generateSilverReferrals();
