import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

// Load .env.local first, then .env as fallback
dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;

async function createSuperAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('Creating super admin...');

  try {
    const passwordHash = await bcrypt.hash('0a0b0c0D.', 10);

    const result = await pool.query(`
      INSERT INTO super_admins (email, password_hash, full_name, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, ['admin@elitjohnsdigital.co.ke', passwordHash, 'Elitjohns Super Admin']);

    if (result.rowCount && result.rowCount > 0) {
      console.log('Super admin created successfully!');
      console.log('Email: admin@elitjohnsdigital.co.ke');
      console.log('Password: 0a0b0c0D.');
    } else {
      console.log('Super admin already exists, skipping.');
    }
  } finally {
    await pool.end();
  }
}

createSuperAdmin().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
