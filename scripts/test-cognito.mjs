/**
 * test-cognito.mjs — Prueba el login de Cognito de punta a punta (Authorization Code + PKCE)
 * sin tocar el front. Levanta un server en :3002, abre el navegador, atrapa el `code`,
 * lo canjea por tokens y te muestra los claims.
 *
 * Uso:  node scripts/test-cognito.mjs <APP_CLIENT_ID>
 *
 * Requiere Node 18+ (fetch nativo). Sin dependencias.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// ---- Config (ajustá si cambia tu pool) -------------------------------------
const DOMAIN = 'us-east-1h1ug5pyas.auth.us-east-1.amazoncognito.com';
const REGION = 'us-east-1';
const USER_POOL_ID = 'us-east-1_h1uG5pYAS';
const PORT = 3002;
const REDIRECT_URI = `http://localhost:${PORT}/auth/callback`;
const SCOPES = 'openid email profile';
// ----------------------------------------------------------------------------

const CLIENT_ID = process.argv[2];
if (!CLIENT_ID) {
  console.error('\n  Falta el App Client ID.\n');
  console.error('  Uso:  node scripts/test-cognito.mjs <APP_CLIENT_ID>\n');
  console.error('  Lo encontrás en: Cognito > tu pool > App integration > App clients\n');
  process.exit(1);
}

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const verifier = b64url(crypto.randomBytes(32));
const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
const state = b64url(crypto.randomBytes(16));

const authUrl =
  `https://${DOMAIN}/oauth2/authorize?` +
  new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });

const decodeJwt = (token) => {
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
};

const page = (title, body, color) => `<!doctype html><meta charset="utf-8">
<body style="font-family:system-ui;background:#0b1020;color:#e6edf3;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center"><h1 style="color:${color}">${title}</h1><p style="opacity:.7">${body}</p></div>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (!url.pathname.startsWith('/auth/callback')) {
    res.writeHead(404).end();
    return;
  }

  const err = url.searchParams.get('error');
  if (err) {
    const desc = url.searchParams.get('error_description') || '';
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(page('Error', err, '#f85149'));
    console.error(`\n  Cognito devolvio un error: ${err}\n  ${desc}\n`);
    server.close();
    process.exit(1);
  }

  if (url.searchParams.get('state') !== state) {
    // Un callback rezagado (pestana abierta de una corrida anterior, o un prefetch
    // del navegador) NO debe matar la corrida actual: lo ignoramos y seguimos
    // escuchando el bueno. El state igual se valida: solo pasa el que coincide.
    res.writeHead(200, { 'Content-Type': 'text/html' })
      .end(page('Callback viejo', 'Ignorado. Segui en la pestana nueva.', '#d29922'));
    console.warn('  AVISO  llego un callback con state viejo -> ignorado.');
    console.warn('         (es una pestana de una corrida anterior; cerrala)');
    return;
  }

  const code = url.searchParams.get('code');
  res.writeHead(200, { 'Content-Type': 'text/html' })
     .end(page('Listo', 'Volve a la terminal.', '#3fb950'));

  console.log('\n  [1/2] Codigo recibido. Canjeandolo por tokens...');

  const tokenRes = await fetch(`https://${DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const data = await tokenRes.json();

  if (!tokenRes.ok) {
    console.error(`\n  Fallo el canje (HTTP ${tokenRes.status}):`);
    console.error('  ', JSON.stringify(data, null, 2));
    console.error(`
  Causas tipicas:
    invalid_client  -> el App Client tiene un secret generado. Debe ser PUBLIC CLIENT sin secret.
    invalid_grant   -> el redirect_uri no coincide EXACTO con el registrado en Allowed callback URLs.
    unauthorized    -> falta tildar "Authorization code grant" en el App Client.
`);
    server.close();
    process.exit(1);
  }

  console.log('  [2/2] Tokens obtenidos.\n');

  const id = decodeJwt(data.id_token);
  const access = decodeJwt(data.access_token);

  console.log('  ---------- ID TOKEN (claims) ----------');
  console.log(JSON.stringify(id, null, 2));
  console.log('\n  ---------- CHEQUEOS ----------');

  const check = (ok, label, extra = '') =>
    console.log(`  ${ok ? 'OK  ' : 'FALTA'}  ${label}${extra ? '  ->  ' + extra : ''}`);

  // Solo estos son roles reales. Cognito agrega grupos autogenerados por cada
  // IdP federado (ej: "<poolId>_Google") que NO son roles y hay que ignorar.
  const ROLES = ['SUPERADMIN', 'ADMIN', 'TEACHER'];
  const groups = id['cognito:groups'] || [];
  const role = ROLES.find((r) => groups.includes(r));
  const noise = groups.filter((g) => !ROLES.includes(g));

  check(!!id.email, 'claim email', id.email);
  check(!!id.name, 'claim name', id.name);
  check(id.email_verified === true, 'email_verified',
        id.email_verified === true ? 'true' : 'false -> mapea email_verified en el IdP de Google');
  check(!!role, 'rol resuelto', role || 'ninguno -> asignale un grupo al usuario en Cognito');
  check(!!data.refresh_token, 'refresh_token emitido');
  check(id.token_use === 'id', 'token_use = id');
  check(access.token_use === 'access', 'access token valido');

  if (noise.length) {
    console.log(`  AVISO  grupos a ignorar   ->  ${noise.join(', ')}`);
    console.log('         (autogenerados por Cognito, NO son roles. Filtra por lista blanca.)');
  }

  const idp = id.identities?.[0]?.providerName || 'Cognito (usuario local)';
  console.log(`  INFO   proveedor usado  ->  ${idp}`);
  console.log(`  INFO   expira en        ->  ${data.expires_in}s`);

  console.log('\n  ---------- PARA LA FASE B (API Gateway JWT authorizer) ----------');
  console.log(`  issuer   = https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`);
  console.log(`  audience = ${CLIENT_ID}`);
  console.log('  identitySource = $request.header.Authorization\n');

  // El token se escribe a un archivo (gitignoreado) en vez de pedirte que copies
  // ~1200 caracteres a mano: en el curl se interpola con $(cat ...).
  const tokenFile = path.join(process.cwd(), 'scripts', '.id_token');
  fs.writeFileSync(tokenFile, data.id_token, 'utf8');

  console.log('  ---------- PROBAR TU API GATEWAY ----------');
  console.log(`  Token completo guardado en: scripts/.id_token  (expira en ${data.expires_in}s)\n`);
  console.log('  Git Bash:');
  console.log('    API="https://TU-API-ID.execute-api.us-east-1.amazonaws.com"');
  console.log('    curl -i -H "Authorization: Bearer $(cat scripts/.id_token)" "$API/api/loquesea"\n');
  console.log('  PowerShell:');
  console.log('    $API = "https://TU-API-ID.execute-api.us-east-1.amazonaws.com"');
  console.log('    curl.exe -i -H "Authorization: Bearer $(Get-Content scripts/.id_token)" "$API/api/loquesea"\n');

  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`\n  Servidor escuchando en ${REDIRECT_URI}`);
  console.log('  Abriendo el navegador...\n');
  console.log(`  Si no se abre solo, pega esta URL:\n\n  ${authUrl}\n`);
  spawn('cmd', ['/c', 'start', '""', authUrl], { stdio: 'ignore', detached: true }).unref();
});
