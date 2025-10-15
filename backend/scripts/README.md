# Scripts e Utilitários do Backend

Esta pasta contém scripts de teste, documentação e utilitários para o backend do FNRHEvento.

## Scripts de Teste

### Testes de Conversão de Dados

#### `test-conversao-datas.js`
**Propósito**: Testa a função de conversão de datas do Excel para o formato DD/MM/YYYY.

**Como executar**:
```bash
node scripts/test-conversao-datas.js
```

**O que testa**:
- Conversão de números seriais do Excel
- Strings no formato DD/MM/YYYY
- Strings no formato ISO (YYYY-MM-DD)
- Objetos Date do JavaScript
- Valores nulos e vazios

---

#### `test-extrair-numero-endereco.js`
**Propósito**: Testa a função de extração de números de endereços.

**Como executar**:
```bash
node scripts/test-extrair-numero-endereco.js
```

**O que testa**:
- Endereços com vírgula: "Rua das Flores, 123"
- Endereços sem vírgula: "Rua das Flores 123"
- Endereços sem número: "Avenida Central"
- Números alfanuméricos: "100-A"
- Valores nulos e vazios

---

#### `test-numero-endereco.js`
**Propósito**: Testa a lógica de número obrigatório no endereço Oracle (default para "SN").

**Como executar**:
```bash
node scripts/test-numero-endereco.js
```

**O que testa**:
- Números válidos
- Strings vazias ou com espaços
- Valores nulos/undefined
- Comportamento quando não há endereço

---

### Utilitários de Verificação

#### `check-dates.js`
**Propósito**: Script utilitário para verificar formatos de data no sistema.

**Como executar**:
```bash
node scripts/check-dates.js
```

---

## Configuração do Oracle

#### `test-oracle-client.ps1`
**Propósito**: Script PowerShell para verificar a instalação e configuração do Oracle Instant Client.

**Como executar** (PowerShell como Administrador):
```powershell
.\scripts\test-oracle-client.ps1
```

**O que verifica**:
- Instalação do Oracle Instant Client
- Variáveis de ambiente configuradas
- Conectividade com o banco de dados Oracle

---

#### `ORACLE_INSTANT_CLIENT_SETUP.md`
**Propósito**: Guia completo de instalação e configuração do Oracle Instant Client para resolver o erro NJS-116.

**Conteúdo**:
- Instruções passo a passo de instalação
- Configuração de variáveis de ambiente
- Configuração do projeto Node.js
- Troubleshooting comum

---

## Estrutura de Pastas

```
backend/
├── scripts/               # Esta pasta
│   ├── README.md         # Este arquivo
│   ├── test-*.js         # Scripts de teste
│   ├── test-*.ps1        # Scripts PowerShell
│   └── *.md              # Documentação
├── config/               # Configurações
├── routes/               # Rotas da API
└── server.js            # Arquivo principal
```

---

## Executando Todos os Testes

Para executar todos os testes de uma vez:

```bash
node scripts/test-conversao-datas.js && node scripts/test-extrair-numero-endereco.js && node scripts/test-numero-endereco.js
```

---

## Notas

- Todos os scripts de teste retornam exit code 0 em caso de sucesso e 1 em caso de falha
- Os testes são independentes e podem ser executados em qualquer ordem
- Nenhum teste modifica dados no banco de dados
