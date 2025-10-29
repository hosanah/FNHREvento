const Database = require('./config/database');

async function checkStatus() {
  const db = new Database();
  try {
    const hospedes = await db.query('SELECT id, nome_completo, status FROM hospedes ORDER BY id LIMIT 50');
    console.log('Total de hóspedes:', hospedes.length);
    console.log('\nDistribuição por status:');

    const statusCount = {};
    hospedes.forEach(h => {
      statusCount[h.status] = (statusCount[h.status] || 0) + 1;
    });

    console.log('Status 1 (Importado):', statusCount[1] || 0);
    console.log('Status 2 (Compatível):', statusCount[2] || 0);
    console.log('Status 3 (Integrado):', statusCount[3] || 0);
    console.log('\nPrimeiros 10 registros:');
    console.log(JSON.stringify(hospedes.slice(0, 10), null, 2));
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    process.exit();
  }
}

checkStatus();
