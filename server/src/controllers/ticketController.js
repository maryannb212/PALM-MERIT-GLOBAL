import { query } from '../config/db.js';

export const createTicket = async (req, res) => {
  try {
    const { title, description, priority } = req.body;
    const userId = req.user.id;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    const sql = `
      INSERT INTO tickets (user_id, title, description, priority)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const { rows } = await query(sql, [userId, title, description, priority || 'medium']);

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error in createTicket:', error);
    res.status(500).json({ message: 'Server error creating ticket' });
  }
};

export const getMyTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = `SELECT * FROM tickets WHERE user_id = $1 ORDER BY created_at DESC;`;
    const { rows } = await query(sql, [userId]);
    res.json(rows);
  } catch (error) {
    console.error('Error in getMyTickets:', error);
    res.status(500).json({ message: 'Server error fetching tickets' });
  }
};

export const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const sql = `SELECT * FROM tickets WHERE id = $1 AND user_id = $2;`;
    const { rows } = await query(sql, [id, userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error in getTicketById:', error);
    res.status(500).json({ message: 'Server error fetching ticket' });
  }
};
