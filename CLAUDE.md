# CLAUDE.md — prisma-front

> Contexto interno para sesiones de Claude Code que trabajen **solo en este repo**. Para el mapa
> completo del sistema P.R.I.S.M.A. (otros repos, decretos, flujos de negocio) ver el CLAUDE.md del
> workspace, un nivel arriba (`EP2/CLAUDE.md`).

## 1. Rol del repo

`prisma-front` es el SPA en React que usan docentes y administradores del sistema P.R.I.S.M.A. Es el
único punto de entrada del usuario: hace login, muestra el dashboard, gestiona PACI y colegios, expone
el panel de administración/soporte, y conduce el flujo estrella del producto — la generación de una
rúbrica/material adaptado vía un chat agéntico con checkpoints Human-in-the-loop (HITL).

## 2. Stack real

- **React 19.2** + **React Router 7** (`react-router-dom`), **Vite 8** (no Create React App, pese a lo
  que dice `README.md` — ese README es boilerplate de CRA sin actualizar, ignorarlo).
- **Tailwind CSS 3.4** (`tailwind.config.js`, `postcss.config.js`).
- **Axios 1.15** para todas las llamadas HTTP.
- **react-markdown 10** + **remark-gfm 4** para renderizar el Markdown que emiten los agentes.
- **Vitest 4** + **@testing-library/react 16** + `jsdom` para tests. Cobertura configurada al 95%
  (`vitest.config.js`, provider v8) — hay un `.test.jsx`/`.test.js` junto a casi cada archivo fuente.
- Sin TypeScript, sin Redux/Zustand: estado global vía React Context (`AuthContext`,
  `ActiveSessionContext`).

## 3. Estructura de carpetas clave (`src/`)

```
src/
  pages/            Una página por ruta (LoginPage, DashboardPage, PACIPage, AjustadorPage,
                     NuevaSesionPage, SesionPage, HistorialPage, AyudaPage, SoportePage,
                     AdminPanelPage, ColegiosPage, ProfilePage, ForbiddenPage)
  components/
    layout/         MainContainer, SideNav (nav filtrado por rol), TopNav
    features/       HitlReviewModal, MarkdownView, ComplianceNotice, FeedbackWidget,
                     CreatePACIModal/EditPACIModal/ViewPACIModal, CreateColegioModal/EditColegioModal/ViewColegioModal
    ui/             Button, Input, Modal, Badge, UserAvatar, SessionToast, FloatingSessionIndicator
  context/          AuthContext (sesión + rol), ActiveSessionContext (tracking global de la sesión
                     de chat activa, con polling propio y persistencia en localStorage)
  services/         Un archivo por dominio; ver §4. `services/index.js` es el barrel (incompleto:
                     solo re-exporta authService, dashboardService, chatService, api — el resto se
                     importa directo desde su archivo)
  constants/api.js  URLs de todos los endpoints, construidas a partir de las env vars VITE_*
  utils/            localStorage.js (wrapper de storage de sesión), stripMetadatos.js
```

## 4. Autenticación e integración con otros servicios — CONFIRMADO EN CÓDIGO

**Todo el tráfico REST pasa por el BFF (`prisma-bff`), excepto el chat agéntico.** Esto ya está
implementado, no es un objetivo pendiente:

- Variable **`VITE_BFF_URL`** (fallback `http://localhost:3010` si no está definida — usa `??`, no
  `||`). Es la única base URL de backend "de datos" que existe en el código.
- Las variables históricas `VITE_API_BASE_URL`, `VITE_ADMIN_API_URL`, `VITE_API_PERFIL_ALUMNO_URL` **ya
  no existen** en `src/` (no hay ninguna referencia). Sí queda un resto muerto: `constants/api.js`
  define `VITE_DOCS_API_URL` (con `||`, no `??`) pero **no se usa en ningún endpoint** — es dead code,
  no lo reactives sin revisar antes si hace falta.
- **No hay un único cliente Axios compartido.** Cada archivo de servicio crea su propia instancia de
  Axios apuntando a `VITE_BFF_URL`, todas con el mismo patrón (interceptor de request que agrega
  `Authorization: Bearer <token>`, interceptor de response que llama `handleAuthFailure` en 401):
  `services/api.js`, `services/bffApi.js` (el más completo — expone auth, colegios, professors,
  dashboard, admin users), `services/paciService.js`, `services/jobsService.js`,
  `services/adminPanelService.js`, `services/colegioService.js` (este último es un thin wrapper sobre
  `bffApi`). Si agregás un servicio nuevo, seguí el mismo patrón (o mejor, extendé `bffApi.js`).
- El **chat HITL (`chatService.js`) es la única excepción**: usa su propia instancia Axios con
  `baseURL: import.meta.env.VITE_CHAT_API_URL ?? ''` — vacío en prod para forzar same-origin. En dev
  pasa por el **proxy de Vite** (`vite.config.js`) que reenvía `/chat`, `/health`, `/feedback` al
  `CHAT_BACKEND_URL` (default `http://localhost:8000`, o una URL de ngrok — el proxy agrega el header
  `ngrok-skip-browser-warning`). En prod, el mismo ruteo lo hace `nginx.conf.template` (ver §7).
- **JWT**: se guarda en `localStorage` vía `utils/localStorage.js` (`prisma_access_token`,
  `prisma_refresh_token`, `prisma_user`) y se inyecta como `Authorization: Bearer` en cada instancia de
  Axios. `AuthContext` decodifica el JWT (payload base64, sin verificar firma) para chequear expiración
  cada 60s; si expiró, limpia sesión y redirige a `/login`. `services/authSession.js` centraliza el
  redirect-a-login en 401 (`handleAuthFailure`) con un lock (`redirectInProgress`) para no disparar
  múltiples redirects si varias llamadas fallan a la vez, y evita loops si el 401 vino del propio
  `/api/auth/login`.
- **Roles**: `AuthContext` deriva `isAdmin = role === 'ADMIN' || role === 'SUPERADMIN'` e
  `isSuperAdmin = role === 'SUPERADMIN'`. Es decir, el front ya maneja **tres roles**
  (`TEACHER`/implícito, `ADMIN`, `SUPERADMIN`), no solo `ADMIN`/`TEACHER` — `SUPERADMIN` protege
  `/colegios` (`ColegiosPage`, gestión multi-colegio) vía `SuperAdminRoute` en `App.jsx`, y `SideNav`
  filtra ítems de navegación con `item.superAdminOnly` / `item.adminOnly`.

## 5. Flujo de chat HITL

- **`NuevaSesionPage.jsx`** sube PACI + material y arranca la sesión (`chatService.startSession` →
  `POST /chat/start`, multipart).
- **`SesionPage.jsx`** es el corazón del flujo: hidrata con `GET /chat/:id/state` y después se
  suscribe con `chatService.subscribeToSessionState(...)`, que hace **polling** al mismo endpoint cada
  3s. Cada lectura pasa por `applyState()`, que vuelca `messages`, `hitl_data` (abre `HitlReviewModal`),
  `error`, `workflow_status`, `warnings` y `phase`. El polling se corta solo en las fases terminales
  (`completed` / `error`) y tolera hasta 5 fallos consecutivos antes de rendirse.
- **`context/ActiveSessionContext.jsx`** mantiene una **segunda suscripción independiente**, a nivel
  de app completa, para poder mostrar `FloatingSessionIndicator` y `SessionToast` aunque el usuario
  navegue fuera de `SesionPage`. Persiste el estado en `localStorage` (`prisma_active_session`) y
  retoma el polling al montar si la sesión seguía `running`.

> **Por qué polling y no SSE (migración de 2026-08-27).** El chat tenía dos `EventSource` al mismo
> stream. Se reemplazaron porque API Gateway corta cualquier respuesta a los **30s** y un flujo
> completo tarda **5-15 minutos**, así que el SSE impedía poner `prisma_workflow` detrás del gateway.
> El cambio fue solo de front: `GET /chat/:id/state` ya leía de DynamoDB.
>
> De yapa desaparecieron dos gotchas que estaban documentados acá:
> 1. El backend entregaba `hitl_required` a **una sola** conexión (cola compartida), y `SesionPage`
>    tenía que "espejar" el `phase`/`hitlData` del contexto por las dudas. Leer el estado **no lo
>    consume**, así que las dos suscripciones ven lo mismo y ese `useEffect` se eliminó.
> 2. El JWT viajaba como `?token=<jwt>` en la URL porque `EventSource` no admite headers. Ahora va
>    en el header `Authorization` como cualquier otra llamada.
>
> **Lo único que se perdió:** `currentStep` ("Agente 2 trabajando…") salía del evento `agent_start`,
> que no se espeja a DynamoDB. El front ya lee `state.current_step` si aparece; falta agregarlo a
> `sync_to_dynamo()` y a la respuesta de `/state` en `prisma_workflow`.
- **`HitlReviewModal.jsx`**: modal bloqueante (sin botón de cerrar, intercepta `Escape` con
  `stopPropagation` en fase de captura, el click en el overlay no cierra). Dos pestañas — *Análisis PACI
  (Agente 1)* y *Planificación Adaptada (Agente 2)* — cuyo contenido Markdown se renderiza con
  `MarkdownView`. Decisión: `onRespond({ approved, reason })`; el rechazo exige `reason` no vacío.
  `chatService.sendHitlDecision` postea `POST /chat/:id/hitl` con `{ approved, reason }` — **no** manda
  `agent_to_retry` (ya no existe ese campo; el workflow decide el reintento del lado del backend).
- **`MarkdownView.jsx`** aplica `stripMetadatos()` (regex sobre `---METADATOS---...---FIN_METADATOS---`)
  antes de pasarle el string a `react-markdown`; no usa `dangerouslySetInnerHTML`.
- **`ComplianceNotice.jsx`** / **`SessionToast.jsx`** distinguen tres estados terminales con paleta
  distinta: éxito (lima), bloqueo normativo `workflow_status === 'compliance_blocked'` (naranja, ícono
  `gavel`, texto "Documento no conforme a normativa") y error de sistema genérico (rojo). `SesionPage`
  deriva un `phaseKey` combinando `phase` + `workflowStatus` para mapear a `PHASE_CONFIG` (incluye
  `compliance_blocked`, `completed_degraded`, `cancelled`, `error_hitl_rejected`, `error`).
- El job event-driven (S3/Lambda) vive en `jobsService.js` (`POST /api/jobs/upload` vía BFF) — es un
  camino totalmente distinto al chat HITL y no comparte componentes con `SesionPage`.

## 6. Variables de entorno (`.env.example`)

```env
# Todas las llamadas REST pasan por el BFF (prisma-bff) en :3010
VITE_BFF_URL=http://localhost:3010

# Backend del agente PRISMA (chat/stream). Dejar vacío en build de producción
# para que las peticiones usen URLs relativas y pasen por el proxy/nginx.
VITE_CHAT_API_URL=

# Solo para dev: a qué host reenvía Vite /chat, /health, /feedback (proxy de vite.config.js)
CHAT_BACKEND_URL=http://localhost:8000
```

El `.env` local del repo (no versionado) trae `VITE_BFF_URL` apuntando a otro puerto (3006) y
`CHAT_BACKEND_URL` a una URL de ngrok — normal en desarrollo, no lo tomes como el valor "correcto".

## 7. Build / despliegue de producción

- `Dockerfile` + `nginx.conf.template`: la imagen sirve la SPA compilada y usa nginx como **puerta
  única** (reverse-proxy), sustituyendo `${BFF_UPSTREAM}` y `${WORKFLOW_UPSTREAM}` vía `envsubst` al
  arrancar el contenedor:
  - `location /api/` → `${BFF_UPSTREAM}` (todo pasa por el BFF).
  - `location /chat/`, `/health`, `/feedback/` → `${WORKFLOW_UPSTREAM}` directo, con
    `proxy_buffering off`, `proxy_cache off` y `proxy_read_timeout 1h` (necesario para SSE) — estas
    locations re-declaran sus propios `proxy_set_header` porque **no heredan** los definidos a nivel de
    `server {}` en nginx.
  - `resolver ${NGINX_RESOLVER}` con `valid=10s`: necesario porque en Fargate las IPs de los upstreams
    son efímeras.
- `.github/workflows/deploy-ecr.yml`: build & push de la imagen a ECR en cada push a `main`, seguido de
  un force-redeploy del servicio ECS (`prisma-cluster`/`prisma-app` por defecto).

## 8. Comandos

```bash
npm install
npm run dev        # vite dev server en :3002 (abre navegador; ver vite.config.js)
npm run build      # build de producción → dist/
npm run preview    # sirve el build
npm test           # vitest (cobertura mínima 95% configurada, no necesariamente cumplida)
```

No hay script `lint` en `package.json` pese a que el `eslintConfig` en `package.json` referencia
`react-app`/`react-app/jest` (config heredada de CRA, no verificada contra la config real de ESLint del
proyecto).

## 9. Gotchas / cosas no obvias

- **`authService.refreshToken` está roto en el código real**: llama `bffApi.refresh(refreshToken)`
  (`src/services/authService.js:73`), pero `bffApi.js` **no exporta ningún método `refresh`** — solo lo
  simula el mock en `authService.test.js`. Además `refreshToken` nunca se invoca desde ningún componente
  de la app (solo desde el test). En la práctica no hay renovación automática de token: cuando expira,
  `AuthContext` simplemente cierra sesión y redirige a `/login`. Si vas a implementar refresh real, hay
  que agregar `refresh` a `bffApi.js` primero.
- **`README.md` es boilerplate de Create React App sin actualizar** (dice `npm start` levanta en :3000,
  menciona `eject`, etc.). No refleja la realidad del proyecto (Vite, :3002). No confiar en él.
- **`services/index.js` es un barrel incompleto**: solo re-exporta `authService`, `dashboardService`,
  `chatService`, `api`. `paciService`, `jobsService`, `adminPanelService`, `colegioService`, `bffApi` se
  importan siempre directo desde su archivo (`from '../services/xxxService'`), no desde el barrel.
- **Múltiples instancias de Axios en paralelo, todas contra el mismo BFF**, en vez de un cliente HTTP
  único compartido — ver §4. Repetir el patrón (interceptor de auth + `handleAuthFailure` en 401) si se
  agrega un servicio nuevo, para no perder el manejo de sesión expirada.
- **`VITE_CHAT_API_URL ?? ''`**: usar `??` (no `||`) es intencional — `''` es un valor válido (same-origin
  en prod) y `'' || fallback` caería mal al fallback. El mismo patrón se repite en `VITE_BFF_URL ?? '...'`
  en cada servicio.
- **Doble suscripción simultánea** al estado de la misma sesión cuando el usuario está dentro de
  `SesionPage`: una desde el contexto global (`ActiveSessionContext`, arrancada por `startTracking`) y
  otra desde la propia página. Es deliberado. Con polling ya no causa problemas —leer el estado no lo
  consume—, pero duplica las llamadas a `GET /state`.
- **`chatService.pollSession` NO es el helper de polling del chat.** Es código muerto: solo resuelve al
  llegar a una fase terminal, no expone `awaiting_hitl` y muere con el primer error de red. El que usa
  la app es **`subscribeToSessionState`**.
- **`CHAT_ENDPOINTS.STREAM` quedó sin uso** en el front tras la migración a polling. El endpoint SSE
  sigue existiendo en el backend; la constante se dejó a propósito por si hace falta debuggear contra
  él, pero ningún componente la referencia.
- **`HitlReviewModal` no puede cerrarse sin decidir** — si necesitás un "salir sin decidir" para QA/debug,
  no existe en la UI; hay que cancelar la sesión completa (`chatService.cancelSession`) desde el header
  de `SesionPage`.
- **`AuthContext` decodifica el JWT sin verificar firma** (solo lee `exp` del payload en base64) para el
  chequeo de expiración cada 60s — es solo para UX (cerrar sesión proactivamente), no un control de
  seguridad; la validación real de firma la hace cada microservicio backend.
- **Cobertura de tests configurada al 95%** (`vitest.config.js`) para lines/functions/branches/statements
  — no verificado en esta sesión si el repo la cumple actualmente; correr `npm test -- --coverage` antes
  de asumirlo.
