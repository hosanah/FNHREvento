/**
 * Teste da função de extração de número do endereço
 * Execute com: node test-extrair-numero-endereco.js
 */

function extrairNumeroDoEndereco(endereco) {
  if (!endereco || typeof endereco !== 'string') {
    return { logradouro: endereco || '', numero: null };
  }

  const enderecoTrim = endereco.trim();

  // Padrão 1: "Endereço, 123" ou "Endereço , 123"
  const pattern1 = /^(.+?)\s*,\s*(\d+[\w-]*)$/;
  const match1 = enderecoTrim.match(pattern1);
  if (match1) {
    return {
      logradouro: match1[1].trim(),
      numero: match1[2].trim()
    };
  }

  // Padrão 2: "Endereço 123" (número no final, sem vírgula)
  const pattern2 = /^(.+?)\s+(\d+[\w-]*)$/;
  const match2 = enderecoTrim.match(pattern2);
  if (match2) {
    return {
      logradouro: match2[1].trim(),
      numero: match2[2].trim()
    };
  }

  // Sem número encontrado
  return { logradouro: enderecoTrim, numero: null };
}

console.log('=== Teste: Extração de Número do Endereço ===\n');

// Casos de teste
const casos = [
  {
    entrada: 'Av Presidente Castelo Branco, 5365',
    esperadoLogradouro: 'Av Presidente Castelo Branco',
    esperadoNumero: '5365'
  },
  {
    entrada: 'Rua das Flores, 123',
    esperadoLogradouro: 'Rua das Flores',
    esperadoNumero: '123'
  },
  {
    entrada: 'Rua das Flores 123',
    esperadoLogradouro: 'Rua das Flores',
    esperadoNumero: '123'
  },
  {
    entrada: 'Avenida Central',
    esperadoLogradouro: 'Avenida Central',
    esperadoNumero: null
  },
  {
    entrada: 'Rua Principal, 100-A',
    esperadoLogradouro: 'Rua Principal',
    esperadoNumero: '100-A'
  },
  {
    entrada: 'Estrada Velha, 0',
    esperadoLogradouro: 'Estrada Velha',
    esperadoNumero: '0'
  },
  {
    entrada: '',
    esperadoLogradouro: '',
    esperadoNumero: null
  },
  {
    entrada: null,
    esperadoLogradouro: '',
    esperadoNumero: null
  },
  {
    entrada: 'Rua A B C 456',
    esperadoLogradouro: 'Rua A B C',
    esperadoNumero: '456'
  },
  {
    entrada: 'Alameda dos Anjos , 789',
    esperadoLogradouro: 'Alameda dos Anjos',
    esperadoNumero: '789'
  }
];

let sucessos = 0;
let falhas = 0;

casos.forEach((caso, index) => {
  const resultado = extrairNumeroDoEndereco(caso.entrada);
  const passou =
    resultado.logradouro === caso.esperadoLogradouro &&
    resultado.numero === caso.esperadoNumero;

  if (passou) {
    sucessos++;
    console.log(`✓ Caso ${index + 1}: PASSOU`);
  } else {
    falhas++;
    console.log(`✗ Caso ${index + 1}: FALHOU`);
  }

  console.log(`  Entrada: "${caso.entrada}"`);
  console.log(`  Esperado: Logradouro="${caso.esperadoLogradouro}", Número="${caso.esperadoNumero}"`);
  console.log(`  Obtido: Logradouro="${resultado.logradouro}", Número="${resultado.numero}"`);
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
