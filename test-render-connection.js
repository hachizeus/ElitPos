const { Pool } = require('pg');
require('dotenv').config();

async function testConnection() {
  console.log('\n🔍 Testing Render PostgreSQL Connection...\n');
  
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in .env file');
    process.exit(1);
  }
  
  // Mask password in URL for display
  const displayUrl = dbUrl.replace(/:([^@]+)@/, ':****@');
  console.log(`📍 Database URL: ${displayUrl}\n`);
  
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('render.com') ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 30000,
  });
  
  try {
    console.log('⏳ Connecting to database...');
    const startTime = Date.now();
    
    const client = await pool.connect();
    const connectTime = Date.now() - startTime;
    
    console.log(`✅ Connected in ${connectTime}ms\n`);
    
    // Test query
    console.log('⏳ Running test query...');
    const queryStart = Date.now();
    const result = await client.query('SELECT version(), current_database(), current_user');
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ Query executed in ${queryTime}ms\n`);
    console.log('📊 Database Info:');
    console.log(`  Database: ${result.rows[0].current_database}`);
    console.log(`  User: ${result.rows[0].current_user}`);
    console.log(`  Version: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}\n`);
    
    // Check if tables exist
    console.log('⏳ Checking for tables...');
    const tableCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tableCount = parseInt(tableCheck.rows[0].count);
    console.log(`✅ Found ${tableCount} tables\n`);
    
    if (tableCount === 0) {
      console.log('⚠️  No tables found. Run migrations:');
      console.log('   npm run db:migrate\n');
    } else if (tableCount < 200) {
      console.log('⚠️  Only ${tableCount} tables. Expected ~212. Run migrations:');
      console.log('   npm run db:migrate\n');
    } else {
      console.log('✅ Database is ready!\n');
    }
    
    // Performance summary
    console.log('⚡ Performance Summary:');
    console.log(`  Connection: ${connectTime}ms ${connectTime < 1000 ? '✅ Good' : '⚠️ Slow'}`);
    console.log(`  Query: ${queryTime}ms ${queryTime < 500 ? '✅ Good' : '⚠️ Slow'}`);
    console.log(`  Total: ${connectTime + queryTime}ms\n`);
    
    if (connectTime + queryTime < 2000) {
      console.log('🎉 Connection is fast! Your app will be much faster now.\n');
    } else {
      console.log('⚠️  Connection is slower than expected. Check:');
      console.log('   1. Your internet connection');
      console.log('   2. Render database region (choose closest)');
      console.log('   3. Render database status (should be "Available")\n');
    }
    
    client.release();
    await pool.end();
    
    console.log('✅ Test completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Connection failed:\n');
    console.error(`   Error: ${error.message}\n`);
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('   Possible causes:');
      console.error('   - Database URL hostname is incorrect');
      console.error('   - Database is not created yet on Render');
      console.error('   - Internet connection issue\n');
    } else if (error.message.includes('authentication failed')) {
      console.error('   Possible causes:');
      console.error('   - Username or password is incorrect');
      console.error('   - Copy the full External Database URL from Render\n');
    } else if (error.message.includes('timeout')) {
      console.error('   Possible causes:');
      console.error('   - Slow internet connection');
      console.error('   - Database is still being created');
      console.error('   - Firewall blocking connection\n');
    } else if (error.message.includes('ssl') || error.message.includes('SSL')) {
      console.error('   Try adding ?sslmode=require to your DATABASE_URL\n');
    }
    
    await pool.end();
    process.exit(1);
  }
}

testConnection();
