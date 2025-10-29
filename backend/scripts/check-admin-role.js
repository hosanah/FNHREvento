const { getSqliteDb, initSqliteDatabase } = require('../config/database');

async function checkAdminRole() {
  try {
    await initSqliteDatabase();
    const db = getSqliteDb();

    const result = await db.query(
      'SELECT id, username, email, role FROM users WHERE username = ?',
      ['admin']
    );

    if (result.rows.length === 0) {
      console.log('❌ Usuário admin não encontrado');
      process.exit(1);
    }

    const admin = result.rows[0];
    console.log('✅ Usuário admin encontrado:');
    console.log('  ID:', admin.id);
    console.log('  Username:', admin.username);
    console.log('  Email:', admin.email);
    console.log('  Role:', admin.role);

    if (admin.role !== 'administrador') {
      console.log('\n⚠️ Role incorreta! Corrigindo...');

      await db.query(
        'UPDATE users SET role = ? WHERE id = ?',
        ['administrador', admin.id]
      );

      console.log('✅ Role atualizada para "administrador"');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

checkAdminRole();
