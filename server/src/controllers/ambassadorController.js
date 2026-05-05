import { query } from '../config/db.js';

/**
 * Get all ambassadors
 * GET /api/ambassadors
 */
export const getAllAmbassadors = async (req, res) => {
  try {
    const sql = `SELECT * FROM ambassadors ORDER BY order_index ASC, name ASC`;
    const result = await query(sql);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ambassadors:', error);
    res.status(500).json({ message: 'Server error fetching ambassadors' });
  }
};

/**
 * Create a new ambassador (Admin only)
 * POST /api/admin/ambassadors
 */
export const createAmbassador = async (req, res) => {
  try {
    const { name, role, bio, image_url, order_index } = req.body;
    
    if (!name || !role) {
      return res.status(400).json({ message: 'Name and role are required' });
    }

    const sql = `
      INSERT INTO ambassadors (name, role, bio, image_url, order_index)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [name, role, bio, image_url, order_index || 0];
    const result = await query(sql, values);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating ambassador:', error);
    res.status(500).json({ message: 'Server error creating ambassador' });
  }
};

/**
 * Update an ambassador (Admin only)
 * PUT /api/admin/ambassadors/:id
 */
export const updateAmbassador = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, bio, image_url, order_index } = req.body;
    
    const sql = `
      UPDATE ambassadors 
      SET name = $1, role = $2, bio = $3, image_url = $4, order_index = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *;
    `;
    const values = [name, role, bio, image_url, order_index, id];
    const result = await query(sql, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ambassador not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating ambassador:', error);
    res.status(500).json({ message: 'Server error updating ambassador' });
  }
};

/**
 * Delete an ambassador (Admin only)
 * DELETE /api/admin/ambassadors/:id
 */
export const deleteAmbassador = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `DELETE FROM ambassadors WHERE id = $1 RETURNING *`;
    const result = await query(sql, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ambassador not found' });
    }
    
    res.json({ message: 'Ambassador deleted successfully' });
  } catch (error) {
    console.error('Error deleting ambassador:', error);
    res.status(500).json({ message: 'Server error deleting ambassador' });
  }
};
