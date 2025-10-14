# Guia de Instalação do Oracle Instant Client para IIS

## Problema
Erro: `NJS-116: password verifier type 0x939 is not supported by node-oracledb in Thin mode`

Este erro ocorre porque o modo Thin do node-oracledb não suporta o tipo de verificador de senha usado pelo Oracle. A solução é usar o modo Thick com o Oracle Instant Client.

---

## Passo 1: Download do Oracle Instant Client

1. Acesse: https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html

2. Baixe a versão **19c** ou superior do **Basic Package (ZIP)**
   - Arquivo: `instantclient-basic-windows.x64-19.x.x.x.zip`
   - Tamanho aproximado: 80-100 MB

3. **IMPORTANTE**: Você precisará fazer login com uma conta Oracle (gratuita)

---

## Passo 2: Extrair e Instalar

1. Extraia o arquivo ZIP para: `C:\oracle\instantclient_19_11`
   - O caminho final deve ser: `C:\oracle\instantclient_19_11\oci.dll`
   - **NÃO** use espaços no caminho (evite "Program Files")

2. Verifique se os seguintes arquivos existem na pasta:
   - `oci.dll`
   - `oraociei19.dll` (ou similar)
   - `ociw32.dll` (para 32-bit, se aplicável)

---

## Passo 3: Adicionar ao PATH do Sistema (Opcional mas Recomendado)

1. Abra "Configurações do Sistema" → "Variáveis de Ambiente"
2. Em "Variáveis do Sistema", encontre a variável `Path`
3. Clique em "Editar" → "Novo"
4. Adicione: `C:\oracle\instantclient_19_11`
5. Clique em "OK" para salvar

---

## Passo 4: Configurar a Aplicação

### A) Se estiver usando o arquivo `.env.production`:

O arquivo já foi criado em `C:\dev\FNHREvento\backend\.env.production`

Verifique se o caminho está correto:
```env
ORACLE_CLIENT_LIB_DIR=C:\oracle\instantclient_19_11
```

### B) Se o caminho de instalação for diferente:

Edite o arquivo `.env.production` e ajuste a variável:
```env
ORACLE_CLIENT_LIB_DIR=C:\seu\caminho\para\instantclient
```

---

## Passo 5: Copiar Arquivos para o Servidor IIS

1. Copie TODO o conteúdo de `C:\dev\FNHREvento\backend\` para `C:\inetpub\wwwroot\fnhrevento\backend\`

2. Certifique-se de que os seguintes arquivos foram copiados:
   - `.env.production`
   - `web.config`
   - `server.js`
   - `package.json`
   - Pasta `node_modules` completa
   - Todas as pastas: `config`, `controllers`, `middlewares`, `models`, `routes`, `services`, `utils`

---

## Passo 6: Configurar Variável de Ambiente no IIS

### Opção A: Via web.config (Recomendado)

Edite o `web.config` no servidor e adicione dentro da tag `<iisnode>`:

```xml
<iisnode
  node_env="production"
  nodeProcessCountPerApplication="1"
  ...
>
  <environmentVariables>
    <add name="ORACLE_CLIENT_LIB_DIR" value="C:\oracle\instantclient_19_11" />
    <add name="NODE_ENV" value="production" />
  </environmentVariables>
</iisnode>
```

### Opção B: Via IIS Manager

1. Abra o IIS Manager
2. Selecione o site/aplicação (fnrhevento/backend)
3. Clique em "Configuration Editor"
4. Na seção (Section), selecione: `system.webServer/iisnode`
5. Expanda "environmentVariables"
6. Adicione:
   - Name: `ORACLE_CLIENT_LIB_DIR`
   - Value: `C:\oracle\instantclient_19_11`

---

## Passo 7: Instalar Visual C++ Redistributable (Se necessário)

O Oracle Instant Client requer o Visual C++ Redistributable:

1. Baixe: https://aka.ms/vs/17/release/vc_redist.x64.exe
2. Execute o instalador
3. Reinicie o servidor se solicitado

---

## Passo 8: Reiniciar o IIS

```cmd
iisreset
```

Ou via IIS Manager:
1. Clique com o botão direito no servidor
2. Selecione "Stop"
3. Aguarde alguns segundos
4. Selecione "Start"

---

## Passo 9: Testar a Conexão

1. Acesse o backend: `http://localhost:3000/health`
2. Verifique os logs do iisnode em: `C:\inetpub\wwwroot\fnhrevento\backend\iisnode\`
3. Procure pela mensagem: `✅ Oracle Client nativo inicializado (modo Thick habilitado)`

---

## Verificação de Problemas Comuns

### Erro: "Cannot find module 'oracledb'"
- Certifique-se de que `node_modules` foi copiado corretamente
- Execute `npm install` na pasta do backend no servidor

### Erro: "The specified module could not be found"
- Verifique se o Visual C++ Redistributable está instalado
- Verifique se o caminho em `ORACLE_CLIENT_LIB_DIR` está correto
- Certifique-se de que `oci.dll` existe no caminho especificado

### Erro: "ORA-12154: TNS:could not resolve the connect identifier"
- Verifique as variáveis: `ORACLE_HOST`, `ORACLE_PORT`, `ORACLE_SERVICE_NAME`
- Teste a conectividade de rede com o servidor Oracle

### Ainda mostra "modo Thin"
- Verifique se `.env.production` está na pasta correta
- Verifique se `NODE_ENV=production` está configurado
- Reinicie o IIS completamente com `iisreset`

---

## Arquivos de Log

Logs do iisnode ficam em:
- `C:\inetpub\wwwroot\fnhrevento\backend\iisnode\`

Para habilitar logs detalhados, edite `web.config`:
```xml
<iisnode
  loggingEnabled="true"
  devErrorsEnabled="true"
  debuggingEnabled="true"
  ...
/>
```

---

## Contato e Suporte

Se ainda tiver problemas:
1. Verifique os logs do iisnode
2. Verifique os logs do console do Node.js
3. Teste a conexão Oracle manualmente com SQL*Plus ou SQL Developer

---

**Data de criação**: 2025-10-14
**Versão do node-oracledb**: Verifique em `package.json`
