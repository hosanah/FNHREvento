/**
 * Servidor principal da API FNRHEvento em Node.js com Express
 * Inclui autenticação JWT, CORS e outras configurações de segurança
 * Servidor principal do FNRHEvento
 * API mínima com autenticação JWT e rotas básicas
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const { ApiError, errorHandler } = require('./middleware/errorHandler');

// Importar rotas
const authRoutes = require('./routes/auth');
const hospedeRoutes = require('./routes/hospedes');

// Importar configuração do banco de dados
const { initSqliteDatabase, closeSqliteDatabase } = require('./config/database');
const { initOraclePool, closeOraclePool } = require('./config/oracleDatabase');

const app = express();
// Confiar no primeiro proxy para que o express-rate-limit
// identifique corretamente o IP do cliente quando X-Forwarded-For estiver presente
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Configurações de segurança
app.use(helmet());

// Rate limiting - limita requisições por IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requisições por IP por janela de tempo
  message: {
    error: 'Muitas requisições deste IP, tente novamente em 15 minutos.'
  }
});
app.use(limiter);

// Rate limiting específico para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas de login por IP
  message: {
    error: 'Muitas tentativas de login, tente novamente em 15 minutos.'
  },
  skipSuccessfulRequests: true
});

// Configuração CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - FNRHEvento ${req.method} ${req.path}`);
  next();
});

// Rota de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Documentação Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Rotas de autenticação (aplicar rate limiting específico)
app.use('/auth/login', loginLimiter);
app.use('/auth', authRoutes);
app.use('/hospedes', hospedeRoutes);

// Rota para servir arquivos estáticos (se necessário)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware de tratamento de erros
app.use((req, res, next) => {
  next(new ApiError(404, 'Rota não encontrada'));
});

app.use(errorHandler);

// Inicializar banco de dados e servidor
let serverInstance;
let shuttingDown = false;

async function startServer() {
  try {
    // Inicializar banco de dados SQLite
    await initSqliteDatabase();
    console.log('✅ FNRHEvento: banco SQLite inicializado com sucesso');

    // Inicializar pool Oracle (opcional)
    try {
      const pool = await initOraclePool();
      if (pool) {
        console.log('✅ FNRHEvento: pool Oracle disponível');
      } else {
        console.log('ℹ️ FNRHEvento: Oracle não configurado ou indisponível. Continuando apenas com SQLite.');
      }
    } catch (error) {
      console.warn('⚠️ FNRHEvento: erro inesperado ao verificar o Oracle. Continuando sem recursos Oracle.', error);
    }

    // Iniciar servidor
    serverInstance = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 FNRHEvento rodando na porta ${PORT}`);
      console.log(`📍 FNRHEvento URL: http://localhost:${PORT}`);
      console.log(`🌍 FNRHEvento ambiente: ${process.env.NODE_ENV}`);
      console.log(`🔒 FNRHEvento CORS habilitado para: ${process.env.CORS_ORIGIN}`);
    });
  } catch (error) {
    console.error('❌ FNRHEvento: erro ao iniciar servidor:', error);
    try {
      await closeOraclePool();
    } catch (oracleError) {
      console.error('❌ FNRHEvento: erro ao encerrar pool Oracle durante falha de inicialização:', oracleError);
    }
    try {
      await closeSqliteDatabase();
    } catch (sqliteError) {
      console.error('❌ FNRHEvento: erro ao encerrar SQLite durante falha de inicialização:', sqliteError);
    }
    process.exit(1);
  }
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  console.log(`🛑 FNRHEvento: recebido ${signal}, encerrando servidor...`);

  if (serverInstance) {
    await new Promise(resolve => {
      serverInstance.close(() => {
        console.log('🛑 FNRHEvento: servidor HTTP encerrado');
        resolve();
      });
    });
  }

  const closeOperations = [
    closeSqliteDatabase().catch(error => {
      console.error('❌ FNRHEvento: erro ao encerrar SQLite:', error);
    }),
    closeOraclePool().catch(error => {
      console.error('❌ FNRHEvento: erro ao encerrar pool Oracle:', error);
    })
  ];

  await Promise.all(closeOperations);
  console.log('👋 FNRHEvento: recursos liberados com sucesso');
  process.exit(0);
}

// Tratamento de sinais para encerramento graceful
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

// Iniciar servidor
startServer();

