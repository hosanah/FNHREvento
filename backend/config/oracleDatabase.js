'use strict';

/**
 * Configuração de conexão com Oracle Database usando pools
 */

const oracledb = require('oracledb');

let oraclePool = null;

function getOracleConfig() {
  return {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
    poolMin: parseInt(process.env.ORACLE_POOL_MIN || '0', 10),
    poolMax: parseInt(process.env.ORACLE_POOL_MAX || '4', 10),
    poolIncrement: parseInt(process.env.ORACLE_POOL_INCREMENT || '1', 10),
    poolTimeout: parseInt(process.env.ORACLE_POOL_TIMEOUT || '60', 10)
  };
}

function isOracleConfigured(config) {
  return Boolean(config.user && config.password && config.connectString);
}

async function initOraclePool() {
  if (oraclePool) {
    return oraclePool;
  }

  const config = getOracleConfig();
  if (!isOracleConfigured(config)) {
    console.warn('⚠️  Oracle Database não configurado. Defina ORACLE_CONNECT_STRING, ORACLE_USER e ORACLE_PASSWORD para habilitar.');
    return null;
  }

  try {
    oraclePool = await oracledb.createPool({
      user: config.user,
      password: config.password,
      connectString: config.connectString,
      poolMin: config.poolMin,
      poolMax: config.poolMax,
      poolIncrement: config.poolIncrement,
      poolTimeout: config.poolTimeout,
      homogeneous: true
    });
    console.log('✅ Pool de conexões Oracle inicializado');
    return oraclePool;
  } catch (error) {
    oraclePool = null;
    console.warn('⚠️  Falha ao inicializar pool Oracle. Recursos dependentes do Oracle ficarão indisponíveis. Detalhes:', error.message);
    return null;
  }
}

async function getOracleConnection() {
  if (!oraclePool) {
    await initOraclePool();
  }

  if (!oraclePool) {
    throw new Error('Oracle Database indisponível. Verifique a configuração e o status do pool.');
  }

  try {
    return await oraclePool.getConnection();
  } catch (error) {
    console.error('❌ Erro ao obter conexão Oracle:', error.message);
    throw error;
  }
}

async function closeOraclePool() {
  if (!oraclePool) {
    return;
  }

  try {
    await oraclePool.close(10);
    oraclePool = null;
    console.log('✅ Pool de conexões Oracle encerrado');
  } catch (error) {
    console.error('❌ Erro ao encerrar pool Oracle:', error.message);
    throw error;
  }
}

module.exports = {
  initOraclePool,
  getOracleConnection,
  closeOraclePool
};
