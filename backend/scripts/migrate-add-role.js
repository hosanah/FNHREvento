const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Iniciando migração: adicionar campo role à tabela users...');

db.serialize(() => {
  // Verificar se a coluna role já existe
  db.all("PRAGMA table_info(users)", (err, columns) => {
    if (err) {
      console.error('❌ Erro ao verificar estrutura da tabela:', err);
      db.close();
      process.exit(1);
    }

    const roleColumnExists = columns.some(col => col.name === 'role');

    if (roleColumnExists) {
      console.log('✅ Coluna role já existe na tabela users');
      db.close();
      return;
    }

    console.log('➕ Adicionando coluna role à tabela users...');

    db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'usuario' CHECK(role IN ('administrador', 'usuario'))", (err) => {
      if (err) {
        console.error('❌ Erro ao adicionar coluna role:', err);
        db.close();
        process.exit(1);
      }

      console.log('✅ Coluna role adicionada com sucesso');

      // Atualizar usuário admin existente para role='administrador'
      db.run("UPDATE users SET role = 'administrador' WHERE username = 'admin'", (err) => {
        if (err) {
          console.error('❌ Erro ao atualizar role do admin:', err);
        } else {
          console.log('✅ Usuário admin atualizado para role=administrador');
        }

        db.close();
        console.log('🎉 Migração concluída com sucesso!');
      });
    });
  });
});
