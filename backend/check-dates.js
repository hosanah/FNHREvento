const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database/database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Verificando datas no banco de dados...\n');

db.all('SELECT id, nome_completo, data_nascimento, entrada, saida FROM hospedes LIMIT 10', (err, rows) => {
  if (err) {
    console.error('❌ Erro ao consultar:', err);
    db.close();
    return;
  }

  if (!rows || rows.length === 0) {
    console.log('⚠️ Nenhum hóspede encontrado no banco de dados');
    db.close();
    return;
  }

  console.log(`📊 Total de registros encontrados: ${rows.length}\n`);

  rows.forEach((row, index) => {
    console.log(`--- Hóspede ${index + 1} ---`);
    console.log(`ID: ${row.id}`);
    console.log(`Nome: ${row.nome_completo}`);
    console.log(`Data Nascimento: ${row.data_nascimento} (tipo: ${typeof row.data_nascimento})`);
    console.log(`Data Entrada: ${row.entrada} (tipo: ${typeof row.entrada})`);
    console.log(`Data Saída: ${row.saida} (tipo: ${typeof row.saida})`);
    console.log('');
  });

  db.close();
});
