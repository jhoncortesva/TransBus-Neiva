require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'coomotor_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    });

async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔧 Setting up database...');

    // Create roles enum
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'user', 'driver');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create document_type enum
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE document_type AS ENUM ('CC', 'CE', 'TI', 'PASAPORTE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role user_role NOT NULL DEFAULT 'user',
        full_name VARCHAR(255),
        document_type document_type,
        document_number VARCHAR(50),
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create drivers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        full_name VARCHAR(255) NOT NULL,
        document_type document_type NOT NULL,
        document_number VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20) NOT NULL,
        bus_plate VARCHAR(20) NOT NULL UNIQUE,
        license_pdf_path VARCHAR(500),
        created_by UUID REFERENCES users(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create default admin user
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@Coomotor2024';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@coomotor.com';

    const existingAdmin = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [adminUsername]
    );

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    if (existingAdmin.rows.length === 0) {
      await client.query(
        `INSERT INTO users (username, email, password, role, full_name)
         VALUES ($1, $2, $3, 'admin', 'Administrador Coomotor')`,
        [adminUsername, adminEmail, hashedPassword]
      );
      console.log('✅ Admin creado');
    } else if (process.env.ADMIN_PASSWORD) {
      await client.query(
        'UPDATE users SET password = $1 WHERE username = $2',
        [hashedPassword, adminUsername]
      );
      console.log('✅ Contraseña de admin actualizada');
    }

    // Add profile_photo column if it doesn't exist
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
    `);

    // Push notification columns
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_subs JSONB DEFAULT '[]';
    `);

    // Add assigned_route column to drivers if it doesn't exist
    await client.query(`
      ALTER TABLE drivers ADD COLUMN IF NOT EXISTS assigned_route TEXT;
    `);

    // Create routes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS routes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(500),
        stops TEXT,
        color VARCHAR(20) DEFAULT '#1565C0',
        ida_coords JSONB DEFAULT '[]',
        vuelta_coords JSONB DEFAULT '[]',
        pois JSONB DEFAULT '[]',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed initial routes if table is empty
    const { rows: routeCount } = await client.query('SELECT COUNT(*) FROM routes');
    if (parseInt(routeCount[0].count) === 0) {
      const INITIAL_ROUTES = require('./routeSeeds');
      for (const r of INITIAL_ROUTES) {
        await client.query(
          `INSERT INTO routes (name, description, stops, color, ida_coords, vuelta_coords, pois)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
          [r.name, r.description, r.stops, r.color,
           JSON.stringify(r.ida_coords), JSON.stringify(r.vuelta_coords), JSON.stringify(r.pois)]
        );
      }
      console.log('✅ Rutas iniciales sembradas');
    }

    console.log('✅ Database setup complete!');
  } catch (error) {
    console.error('❌ Setup error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports = setupDatabase;
