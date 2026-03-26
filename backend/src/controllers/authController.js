const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendWelcomeEmail } = require('../services/email');

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Login - for users and drivers (admin uses same endpoint)
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    // Find user by username or email
    const result = await pool.query(
      `SELECT id, username, email, password, role, full_name, is_active 
       FROM users WHERE username = $1 OR email = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Cuenta desactivada. Contacta al administrador' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generateToken(user.id, user.role);

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Register - only for regular users
const register = async (req, res) => {
  try {
    const { username, email, password, full_name, document_type, document_number, phone } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Usuario, email y contraseña son requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Check if username or email already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'El usuario o email ya está registrado' });
    }

    // Check duplicate document number
    if (document_number) {
      const existingDoc = await pool.query(
        'SELECT id FROM users WHERE document_number = $1',
        [document_number]
      );
      if (existingDoc.rows.length > 0) {
        return res.status(409).json({ error: 'Este número de documento ya está registrado. ¿Ya tienes una cuenta? Intenta iniciar sesión.' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (username, email, password, role, full_name, document_type, document_number, phone)
       VALUES ($1, $2, $3, 'user', $4, $5, $6, $7)
       RETURNING id, username, email, role, full_name`,
      [username, email, hashedPassword, full_name || null, document_type || null, document_number || null, phone || null]
    );

    const newUser = result.rows[0];
    const token = generateToken(newUser.id, newUser.role);

    sendWelcomeEmail({
      to: email,
      fullName: full_name,
      username,
      password,
    }).catch(err => console.error('Email error:', err.message));

    res.status(201).json({
      message: 'Registro exitoso',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        fullName: newUser.full_name,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        fullName: req.user.full_name,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

module.exports = { login, register, getProfile };
