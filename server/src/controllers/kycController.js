import { query, getClient } from '../config/db.js';
import { createVirtualAccount } from '../services/virtualAccountService.js';


export const submitKYC = async (req, res) => {
  try {
    const { 
      firstName, lastName, middleName, phone, email, 
      address, gender, date_of_birth, bvn, bankName, bankCode, accountNumber,
      id_type, id_number
    } = req.body;
    const userId = req.user.id;

      if (!bvn || !id_type || !id_number) {
        return res.status(400).json({ message: 'BVN, ID Type, and ID Number are required' });
      }


    const formattedDob = date_of_birth === "" ? null : date_of_birth;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const kycSql = `
        INSERT INTO kyc_details (
          user_id, first_name, last_name, middle_name, phone, email, 
          address, gender, dob, bvn, bank_name, bank_code, account_number,
          id_type, id_number
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (user_id) DO UPDATE SET 
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          middle_name = EXCLUDED.middle_name,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address = EXCLUDED.address,
          gender = EXCLUDED.gender,
          dob = EXCLUDED.dob,
          bvn = EXCLUDED.bvn,
          bank_name = EXCLUDED.bank_name,
          bank_code = EXCLUDED.bank_code,
          account_number = EXCLUDED.account_number,
          id_type = EXCLUDED.id_type,
          id_number = EXCLUDED.id_number,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      
      await client.query(kycSql, [
        userId, firstName, lastName, middleName, phone, email, 
        address, gender, formattedDob, bvn, bankName, bankCode, accountNumber,
        id_type, id_number
      ]);

      // Check current kyc_status of user
      const { rows: currentUsers } = await client.query('SELECT kyc_status FROM users WHERE id = $1', [userId]);
      const currentKycStatus = currentUsers[0]?.kyc_status || 'unverified';
      const targetKycStatus = currentKycStatus === 'verified' ? 'verified' : 'pending';

      let userSql = `UPDATE users SET kyc_status = $2`;
      const userValues = [userId, targetKycStatus];
      userSql += ` WHERE id = $1 RETURNING kyc_status;`;

      const { rows: userRows } = await client.query(userSql, userValues);

      // Sync name and phone to users table immediately if already verified
      if (targetKycStatus === 'verified') {
        if (phone) {
          const phoneCheck = await client.query('SELECT id FROM users WHERE phone = $1 AND id != $2', [phone, userId]);
          if (phoneCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'The phone number provided is already associated with another user account.' });
          }
        }

        await client.query(
          'UPDATE users SET first_name = $1, last_name = $2, phone = $3 WHERE id = $4',
          [firstName, lastName, phone, userId]
        );
      }

      await client.query('COMMIT');

      res.status(200).json({
        message: targetKycStatus === 'verified' ? 'Profile updated successfully!' : 'KYC submitted successfully and is now pending review',
        kycStatus: userRows[0].kyc_status
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('SERVER KYC ERROR:', error);
    
    // Check if error is due to missing columns
    if (error.message.includes('column') || error.message.includes('relation')) {
      res.status(500).json({ message: 'Database structure needs update. Please run the ALTER TABLE command provided.' });
    } else {
      res.status(500).json({ message: `Server error updating KYC: ${error.message}` });
    }
  }
};

export const getKYCStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = `SELECT kyc_status FROM users WHERE id = $1;`;
    const { rows } = await query(sql, [userId]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error in getKYCStatus:', error);
    res.status(500).json({ message: 'Server error fetching KYC status' });
  }
};

// Admin: Get all pending KYC submissions
export const getPendingKYC = async (req, res) => {
  try {
    const sql = `
      SELECT k.*, u.email as user_email, u.kyc_status 
      FROM kyc_details k
      JOIN users u ON k.user_id = u.id
      WHERE u.kyc_status = 'pending'
      ORDER BY k.submitted_at ASC;
    `;
    const { rows } = await query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Admin Fetch Pending KYC Error:', error);
    res.status(500).json({ message: 'Server error fetching pending KYC' });
  }
};

// Admin: Verify or Reject KYC
export const verifyUserKYC = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // 'verified' or 'rejected'

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const sql = `UPDATE users SET kyc_status = $1 WHERE id = $2 RETURNING *;`;
      const { rows } = await client.query(sql, [status, userId]);

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'User not found' });
      }

      const user = rows[0];

      // Trigger virtual account creation and sync data if verified
      if (status === 'verified') {
        // Fetch KYC details to sync to user record
        const kycResult = await client.query('SELECT first_name, last_name, phone, bvn FROM kyc_details WHERE user_id = $1', [userId]);
        const kyc = kycResult.rows[0] || {};
        if (kyc.first_name) {
          if (kyc.phone) {
            const phoneCheck = await client.query('SELECT id FROM users WHERE phone = $1 AND id != $2', [kyc.phone, userId]);
            if (phoneCheck.rows.length > 0) {
              await client.query('ROLLBACK');
              return res.status(400).json({ message: 'Cannot verify: The phone number provided in the KYC application is already associated with another user account.' });
            }
          }

          await client.query(
            'UPDATE users SET first_name = $1, last_name = $2, phone = $3 WHERE id = $4',
            [kyc.first_name, kyc.last_name, kyc.phone, userId]
          );
        }

        if (!user.virtual_account_number) {
          try {
            const vaData = await createVirtualAccount({
              id: userId,
              first_name: kyc.first_name || user.first_name,
              last_name: kyc.last_name || user.last_name,
              email: user.email,
              phone: kyc.phone || user.phone,
              bvn: kyc.bvn
            });

            await client.query(
              `UPDATE users SET
                virtual_account_number = $1,
                virtual_account_name = $2,
                virtual_bank_name = $3,
                virtual_provider = 'lotus',
                virtual_account_slug = $4
              WHERE id = $5
                AND (virtual_account_number IS NULL OR virtual_account_number = '')`,
              [vaData.account_number, vaData.account_name, vaData.bank_name, vaData.reference, userId]
            );
          } catch (vaErr) {
            console.error(`KYC approved for user ${userId} but VA creation failed:`, vaErr.message);
          }
        }
      }

      await client.query('COMMIT');
      res.json({ message: `User KYC ${status}`, user });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin Verify KYC Error:', error);
    res.status(500).json({ message: `Server error updating KYC status: ${error.message}` });
  }
};
