/**
 * Teste da função de conversão de datas do Excel
 * Execute com: node test-conversao-datas.js
 */

function converterDataExcel(valor) {
  if (!valor) return null;

  // Se já for uma string de data válida (DD/MM/YYYY), retornar
  if (typeof valor === 'string') {
    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
    if (datePattern.test(valor.trim())) {
      return valor.trim();
    }
  }

  // Se for número serial do Excel
  if (typeof valor === 'number') {
    // Excel data serial: dias desde 30/12/1899
    const excelEpoch = new Date(1899, 11, 30);
    const days = Math.floor(valor);
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  // Tentar converter string para data
  if (typeof valor === 'string') {
    const cleaned = valor.trim();

    // Tentar formato ISO (YYYY-MM-DD)
    const isoPattern = /^(\d{4})-(\d{2})-(\d{2})/;
    const isoMatch = cleaned.match(isoPattern);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }
  }

  console.warn(`⚠️ Não foi possível converter data: ${valor} (tipo: ${typeof valor})`);
  return null;
}

console.log('=== Teste: Conversão de Datas do Excel ===\n');

// Casos de teste
const casos = [
  {
    descricao: 'Número serial do Excel (18/10/2025)',
    entrada: 45952,
    esperado: '18/10/2025'
  },
  {
    descricao: 'Número serial do Excel (13/04/1983)',
    entrada: 30412,
    esperado: '13/04/1983'
  },
  {
    descricao: 'String já formatada DD/MM/YYYY',
    entrada: '18/10/2025',
    esperado: '18/10/2025'
  },
  {
    descricao: 'String formato ISO (YYYY-MM-DD)',
    entrada: '2025-10-18',
    esperado: '18/10/2025'
  },
  {
    descricao: 'String formato ISO com hora',
    entrada: '1983-04-13T00:00:00',
    esperado: '13/04/1983'
  },
  {
    descricao: 'Valor vazio',
    entrada: '',
    esperado: null
  },
  {
    descricao: 'Valor null',
    entrada: null,
    esperado: null
  },
  {
    descricao: 'Número serial do Excel (01/01/2000)',
    entrada: 36526,
    esperado: '01/01/2000'
  },
  {
    descricao: 'Número serial do Excel (31/12/2024)',
    entrada: 45657,
    esperado: '31/12/2024'
  }
];

let sucessos = 0;
let falhas = 0;

casos.forEach((caso, index) => {
  const resultado = converterDataExcel(caso.entrada);
  const passou = resultado === caso.esperado;

  if (passou) {
    sucessos++;
    console.log(`✓ Caso ${index + 1}: PASSOU - ${caso.descricao}`);
  } else {
    falhas++;
    console.log(`✗ Caso ${index + 1}: FALHOU - ${caso.descricao}`);
  }

  console.log(`  Entrada: ${JSON.stringify(caso.entrada)} (tipo: ${typeof caso.entrada})`);
  console.log(`  Esperado: ${JSON.stringify(caso.esperado)}`);
  console.log(`  Obtido: ${JSON.stringify(resultado)}`);
  console.log('');
});

console.log('===========================================');
console.log(`Total: ${casos.length} casos`);
console.log(`✓ Sucessos: ${sucessos}`);
console.log(`✗ Falhas: ${falhas}`);
console.log('===========================================\n');

if (falhas === 0) {
  console.log('🎉 Todos os testes passaram!');
  process.exit(0);
} else {
  console.log('❌ Alguns testes falharam!');
  process.exit(1);
}
