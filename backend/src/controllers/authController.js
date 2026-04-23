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

    // Find user by username or email (join drivers to get assigned_route if driver)
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.password, u.role, u.full_name, u.is_active, u.profile_photo,
              d.assigned_route
       FROM users u
       LEFT JOIN drivers d ON d.user_id = u.id
       WHERE u.username = $1 OR u.email = $1`,
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
        profilePhoto: user.profile_photo || null,
        assignedRoute: user.assigned_route || null,
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

    // Check duplicates individually for specific messages
    const existingUsername = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUsername.rows.length > 0) {
      return res.status(409).json({ error: 'Este nombre de usuario ya está en uso. ¿Ya tienes una cuenta? Intenta iniciar sesión.' });
    }

    const existingEmail = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingEmail.rows.length > 0) {
      return res.status(409).json({ error: 'Este correo electrónico ya está registrado. ¿Ya tienes una cuenta? Intenta iniciar sesión.' });
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
        profilePhoto: req.user.profile_photo || null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const isValid = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!isValid) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
};

// Update profile photo (base64)
const updatePhoto = async (req, res) => {
  try {
    const { photo } = req.body;
    if (!photo) {
      return res.status(400).json({ error: 'No se recibió ninguna foto' });
    }
    await pool.query('UPDATE users SET profile_photo = $1 WHERE id = $2', [photo, req.user.id]);
    res.json({ message: 'Foto actualizada correctamente', profilePhoto: photo });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar la foto' });
  }
};

module.exports = { login, register, getProfile, changePassword, updatePhoto };
