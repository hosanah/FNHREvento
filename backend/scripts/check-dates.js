const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'database', 'database.sqlite'));

db.all('SELECT id, nome_completo, codigo, status, idhospede, idreservasfront FROM hospedes WHERE codigo IN ("002", "001") OR id IN (26, 27)', (err, rows) => {
  if (err) {
    console.error('Erro:', err);
  } else {
    console.log('Dados dos hóspedes:');
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});
