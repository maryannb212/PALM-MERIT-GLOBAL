import { query, getClient } from '../config/db.js';
import { createPaystackVirtualAccount } from '../services/virtualAccountService.js';

export const submitKYC = async (req, res) => {
  try {
    const { 
      firstName, lastName, middleName, phone, email, 
      address, gender, date_of_birth, bvn, bankName, bankCode, accountNumber,
      id_type, id_number
    } = req.body;
    const userId = req.user.id;

    // Get file paths
    const getFilePath = (field) => {
      if (!req.files || !req.files[field] || !req.files[field][0]) return null;
      // In production (Cloudinary), 'path' is the full URL.
      // In development (local), 'filename' needs the '/uploads/' prefix.
      return process.env.NODE_ENV === 'production' 
        ? req.files[field][0].path 
        : `/uploads/${req.files[field][0].filename}`;
    };

    const idFrontUrl = getFilePath('id_image');
    const idBackUrl = getFilePath('idBack');
    const selfieUrl = getFilePath('selfie');
    const profileImageUrl = getFilePath('profile_image');

    // Basic validation
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
          id_type, id_number, document_url, document_back_url, selfie_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
          document_url = COALESCE(EXCLUDED.document_url, kyc_details.document_url),
          document_back_url = COALESCE(EXCLUDED.document_back_url, kyc_details.document_back_url),
          selfie_url = COALESCE(EXCLUDED.selfie_url, kyc_details.selfie_url),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      
      await client.query(kycSql, [
        userId, firstName, lastName, middleName, phone, email, 
        address, gender, formattedDob, bvn, bankName, bankCode, accountNumber,
        id_type, id_number, idFrontUrl, idBackUrl, selfieUrl
      ]);

      // Check current kyc_status of user
      const { rows: currentUsers } = await client.query('SELECT kyc_status FROM users WHERE id = $1', [userId]);
      const currentKycStatus = currentUsers[0]?.kyc_status || 'unverified';
      const targetKycStatus = currentKycStatus === 'verified' ? 'verified' : 'pending';

      let userSql = `UPDATE users SET kyc_status = $2`;
      const userValues = [userId, targetKycStatus];
      
      if (profileImageUrl) {
        userSql += `, profile_image = $3`;
        userValues.push(profileImageUrl);
      }
      userSql += ` WHERE id = $1 RETURNING kyc_status;`;

      const { rows: userRows } = await client.query(userSql, userValues);

      // Sync name and phone to users table immediately if already verified
      if (targetKycStatus === 'verified') {
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
      res.status(500).json({ message: 'Server error updating KYC. Please check server logs.' });
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
        const kycResult = await client.query('SELECT first_name, last_name, phone FROM kyc_details WHERE user_id = $1', [userId]);
        if (kycResult.rows.length > 0) {
          const kyc = kycResult.rows[0];
          await client.query(
            'UPDATE users SET first_name = $1, last_name = $2, phone = $3 WHERE id = $4',
            [kyc.first_name, kyc.last_name, kyc.phone, userId]
          );
        }

        try {
          await createPaystackVirtualAccount(userId);
          console.log(`Virtual account created for user ${userId}`);
        } catch (vaError) {
          console.error(`Failed to create virtual account for user ${userId}:`, vaError.message);
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
    res.status(500).json({ message: 'Server error updating KYC status' });
  }
};
