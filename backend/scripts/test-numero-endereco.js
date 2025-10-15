/**
 * Teste da lógica de número obrigatório no endereço
 * Execute com: node test-numero-endereco.js
 */

function testarNumeroEndereco(numero, endereco) {
  // Simula a lógica aplicada no oracleDatabase.js
  if (endereco) {
    const numeroFinal = numero && numero.trim() !== '' ? numero : 'SN';
    return numeroFinal;
  }
  return null;
}

console.log('=== Teste: Número Obrigatório no Endereço Oracle ===\n');

// Casos de teste
const casos = [
  { numero: '123', endereco: 'Rua das Flores', esperado: '123' },
  { numero: '', endereco: 'Rua das Flores', esperado: 'SN' },
  { numero: '   ', endereco: 'Rua das Flores', esperado: 'SN' },
  { numero: null, endereco: 'Rua das Flores', esperado: 'SN' },
  { numero: undefined, endereco: 'Rua das Flores', esperado: 'SN' },
  { numero: '123-A', endereco: 'Rua das Flores', esperado: '123-A' },
  { numero: '0', endereco: 'Rua das Flores', esperado: '0' },
  { numero: 'S/N', endereco: 'Rua das Flores', esperado: 'S/N' },
  { numero: '123', endereco: null, esperado: null }, // Sem endereço, não atualiza
];

let sucessos = 0;
let falhas = 0;

casos.forEach((caso, index) => {
  const resultado = testarNumeroEndereco(caso.numero, caso.endereco);
  const passou = resultado === caso.esperado;

  if (passou) {
    sucessos++;
    console.log(`✓ Caso ${index + 1}: PASSOU`);
  } else {
    falhas++;
    console.log(`✗ Caso ${index + 1}: FALHOU`);
  }

  console.log(`  Entrada: numero="${caso.numero}", endereco="${caso.endereco}"`);
  console.log(`  Esperado: "${caso.esperado}"`);
  console.log(`  Obtido: "${resultado}"`);
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
