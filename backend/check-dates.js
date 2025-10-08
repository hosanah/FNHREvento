const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'database', 'database.sqlite'));

db.get('SELECT id, nome_completo, entrada, saida FROM hospedes WHERE id = 26', (err, row) => {
  if (err) {
    console.error('Erro:', err);
  } else {
    console.log('Dados do hóspede 26:');
    console.log(JSON.stringify(row, null, 2));
    console.log('\nTipos:');
    console.log('entrada:', typeof row?.entrada, '|', row?.entrada);
    console.log('saida:', typeof row?.saida, '|', row?.saida);
  }
  db.close();
});
