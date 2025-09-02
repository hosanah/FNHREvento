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

