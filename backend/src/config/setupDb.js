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

    if (existingAdmin.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await client.query(
        `INSERT INTO users (username, email, password, role, full_name)
         VALUES ($1, $2, $3, 'admin', 'Administrador Coomotor')`,
        [adminUsername, adminEmail, hashedPassword]
      );
      console.log('✅ Default admin created');
      console.log(`   Username: ${adminUsername}`);
      console.log(`   Password: ${adminPassword}`);
    } else {
      console.log('ℹ️  Admin already exists');
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
