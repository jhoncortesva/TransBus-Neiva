const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const path = require('path');

// Create a new driver (admin only)
const createDriver = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      full_name,
      document_type,
      document_number,
      email,
      phone,
      bus_plate,
      username,
      password,
      assigned_route,
    } = req.body;

    // Validate required fields
    if (!full_name || !document_type || !document_number || !email || !phone || !bus_plate || !username || !password || !assigned_route) {
      return res.status(400).json({
        error: 'Todos los campos son requeridos: nombre completo, tipo documento, número documento, email, celular, placa, ruta asignada, usuario y contraseña',
      });
    }

    const validDocTypes = ['CC', 'CE', 'TI', 'PASAPORTE'];
    if (!validDocTypes.includes(document_type)) {
      return res.status(400).json({ error: 'Tipo de documento inválido' });
    }

    // Check duplicates
    const existing = await client.query(
      `SELECT id FROM users WHERE username = $1 OR email = $2
       UNION
       SELECT id FROM drivers WHERE document_number = $3 OR bus_plate = $4 OR email = $2`,
      [username, email, document_number, bus_plate]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Ya existe un conductor con ese usuario, email, documento o placa',
      });
    }

    const licensePdfPath = req.file ? req.file.path : null;

    await client.query('BEGIN');

    // Create user account for driver
    const hashedPassword = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `INSERT INTO users (username, email, password, role, full_name, document_type, document_number, phone)
       VALUES ($1, $2, $3, 'driver', $4, $5, $6, $7)
       RETURNING id`,
      [username, email, hashedPassword, full_name, document_type, document_number, phone]
    );

    const userId = userResult.rows[0].id;

    // Create driver record
    const driverResult = await client.query(
      `INSERT INTO drivers (user_id, full_name, document_type, document_number, email, phone, bus_plate, license_pdf_path, created_by, assigned_route)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, full_name, document_type, document_number, email, phone, bus_plate, assigned_route, created_at`,
      [userId, full_name, document_type, document_number, email, phone, bus_plate, licensePdfPath, req.user.id, assigned_route]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Conductor registrado exitosamente',
      driver: driverResult.rows[0],
      credentials: {
        username,
        password,
        note: 'Comparte estas credenciales con el conductor',
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create driver error:', error);
    res.status(500).json({ error: 'Error al registrar conductor' });
  } finally {
    client.release();
  }
};

// Get all drivers (admin only)
const getDrivers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.full_name, d.document_type, d.document_number, d.email,
              d.phone, d.bus_plate, d.assigned_route, d.is_active, d.created_at,
              u.username, u.is_active as user_active
       FROM drivers d
       JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC`
    );

    res.json({ drivers: result.rows });
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({ error: 'Error al obtener conductores' });
  }
};

// Get single driver
const getDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT d.id, d.full_name, d.document_type, d.document_number, d.email,
              d.phone, d.bus_plate, d.assigned_route, d.license_pdf_path, d.is_active, d.created_at,
              u.username
       FROM drivers d
       JOIN users u ON d.user_id = u.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conductor no encontrado' });
    }

    res.json({ driver: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener conductor' });
  }
};

// Update driver data (admin only)
const updateDriver = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { full_name, document_type, document_number, email, phone, bus_plate, assigned_route, new_password } = req.body;

    if (!full_name || !document_type || !document_number || !email || !phone || !bus_plate || !assigned_route) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    const validDocTypes = ['CC', 'CE', 'TI', 'PASAPORTE'];
    if (!validDocTypes.includes(document_type)) {
      return res.status(400).json({ error: 'Tipo de documento inválido' });
    }

    const driverRow = await client.query('SELECT user_id FROM drivers WHERE id = $1', [id]);
    if (driverRow.rows.length === 0) {
      return res.status(404).json({ error: 'Conductor no encontrado' });
    }
    const userId = driverRow.rows[0].user_id;

    // Check uniqueness conflicts excluding this driver
    const conflicts = await client.query(
      `SELECT 1 FROM users WHERE email = $1 AND id != $2
       UNION
       SELECT 1 FROM drivers WHERE email = $1 AND id != $3
       UNION
       SELECT 1 FROM drivers WHERE document_number = $4 AND id != $3
       UNION
       SELECT 1 FROM drivers WHERE bus_plate = $5 AND id != $3`,
      [email, userId, id, document_number, bus_plate]
    );
    if (conflicts.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe un conductor con ese email, documento o placa' });
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE drivers SET full_name=$1, document_type=$2, document_number=$3, email=$4,
       phone=$5, bus_plate=$6, assigned_route=$7, updated_at=CURRENT_TIMESTAMP WHERE id=$8`,
      [full_name, document_type, document_number, email, phone, bus_plate, assigned_route, id]
    );

    if (new_password && new_password.trim().length >= 6) {
      const hashed = await bcrypt.hash(new_password, 12);
      await client.query(
        `UPDATE users SET full_name=$1, document_type=$2, document_number=$3, email=$4,
         phone=$5, password=$6, updated_at=CURRENT_TIMESTAMP WHERE id=$7`,
        [full_name, document_type, document_number, email, phone, hashed, userId]
      );
    } else {
      await client.query(
        `UPDATE users SET full_name=$1, document_type=$2, document_number=$3, email=$4,
         phone=$5, updated_at=CURRENT_TIMESTAMP WHERE id=$6`,
        [full_name, document_type, document_number, email, phone, userId]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Conductor actualizado exitosamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update driver error:', error);
    res.status(500).json({ error: 'Error al actualizar conductor' });
  } finally {
    client.release();
  }
};

// Toggle driver active status
const toggleDriverStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const driver = await client.query('SELECT user_id, is_active FROM drivers WHERE id = $1', [id]);
    if (driver.rows.length === 0) {
      return res.status(404).json({ error: 'Conductor no encontrado' });
    }

    const newStatus = !driver.rows[0].is_active;
    const userId = driver.rows[0].user_id;

    await client.query('BEGIN');
    await client.query('UPDATE drivers SET is_active = $1 WHERE id = $2', [newStatus, id]);
    await client.query('UPDATE users SET is_active = $1 WHERE id = $2', [newStatus, userId]);
    await client.query('COMMIT');

    res.json({
      message: `Conductor ${newStatus ? 'activado' : 'desactivado'} exitosamente`,
      is_active: newStatus,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al cambiar estado del conductor' });
  } finally {
    client.release();
  }
};

module.exports = { createDriver, getDrivers, getDriver, updateDriver, toggleDriverStatus };
