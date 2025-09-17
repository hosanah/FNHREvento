# FNRHEvento

Projeto mínimo com backend Node.js + Express e frontend Angular para demonstrar um fluxo básico de autenticação JWT.
O foco está em fornecer uma base simples com login e integração entre front e back.

## 🚀 Tecnologias

### Backend
- Node.js
- Express
- JWT para autenticação
- PostgreSQL

### Frontend
- Angular
- PrimeNG
- TypeScript

## 📁 Estrutura do Projeto

```
FNRHEvento/
├── backend/      # API Node.js com rotas de autenticação
├── frontend/     # Aplicação Angular com tela de login e dashboard simples
└── README.md
```

## 🛠️ Instalação

```bash
git clone <url-do-repositorio>
cd FNRHEvento
npm install
npm run install:backend
npm run install:frontend
```

## ▶️ Execução

Para iniciar frontend e backend juntos:

# Configurações do banco de dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fnhrevento
DB_USER=postgres
DB_PASSWORD=postgres

# CORS
CORS_ORIGIN=http://localhost:4200

# Oracle Database (opcional)
ORACLE_HOST=localhost
ORACLE_PORT=1521
ORACLE_SERVICE_NAME=orclpdb1
ORACLE_USER=meu_usuario
ORACLE_PASSWORD=minha_senha
# Ajustes opcionais do pool Oracle
ORACLE_POOL_MIN=0
ORACLE_POOL_MAX=4
ORACLE_POOL_INCREMENT=1
ORACLE_POOL_TIMEOUT=60
# Oracle Client (opcional)
ORACLE_CLIENT_LIB_DIR=C:\\oracle\\instantclient_19_23
ORACLE_DRIVER_MODE=thick
```

Para o frontend em produção, defina a variável de ambiente `NG_APP_API_URL` com a URL da API antes de executar o build.
Em desenvolvimento, o arquivo `src/environments/environment.ts` já utiliza `http://localhost:3000` por padrão.

> ℹ️ As variáveis `ORACLE_HOST`, `ORACLE_PORT`, `ORACLE_SERVICE_NAME`, `ORACLE_USER` e `ORACLE_PASSWORD` são obrigatórias apenas quando a integração Oracle estiver habilitada. As variáveis de pool são opcionais e permitem ajustar o comportamento do `oracledb.createPool`.
>
> Para bancos Oracle 12c ou superiores, como o 19c, recomenda-se instalar o [Oracle Instant Client](https://www.oracle.com/database/technologies/instant-client.html) na máquina onde a API será executada e definir `ORACLE_CLIENT_LIB_DIR` apontando para a pasta de instalação. Isso habilita o modo Thick do driver Node-oracledb, necessário para autenticar usuários com password verifiers modernos. Caso queira forçar o modo Thin (por exemplo, após ajustar o usuário para um password verifier compatível), defina `ORACLE_DRIVER_MODE=thin`.

## 🚀 Executando o Projeto

### Opção 1: Executar frontend e backend juntos (Recomendado)
```bash
npm start
```

Ou execute separadamente:

```bash
npm run start:backend   # porta 3000
npm run start:frontend  # porta 4200
```

## 📜 Scripts Principais

- `npm start` – executa frontend e backend
- `npm run build` – build do frontend

## 🌐 URLs

- Frontend: http://localhost:4200
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/health

## 🤝 Contribuição

Sinta‑se à vontade para abrir issues e enviar pull requests.

## 📄 Licença

MIT

