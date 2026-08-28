# SNBusiness — Guía de configuración

App de finanzas personales 100% móvil: gastos con sub-ítems, servicios obligatorios,
deudas con cuotas, 5 vistas, recordatorios y alarmas, planes de pago con IA (Gemini),
exportación a Excel y sincronización con Firebase (correo + Google).

---

## 1. Correr la app en tu compu

```bash
npm install
npm run dev
```

Abre http://localhost:5173 (idealmente con las herramientas de desarrollador en modo móvil).

## 2. La IA (Gemini) — ya quedó configurada ✔

Tu clave está en el archivo **`.env`**:

```
VITE_GEMINI_API_KEY=AIzaSy…ExhA
VITE_GEMINI_MODEL=gemini-flash-latest
```

- El `.env` **no se sube a GitHub** (está en `.gitignore`) para proteger tu clave.
- También puedes pegar la clave dentro de la app: **Ajustes → Inteligencia artificial**
  (se guarda solo en el dispositivo). Útil para el APK sin recompilar.
- ⚠️ Recomendado: en [Google AI Studio](https://aistudio.google.com/api-keys) puedes
  poner restricciones a la clave. Cualquier clave incluida en una app instalable puede
  ser extraída; al ser nivel gratuito el riesgo es bajo, pero es bueno saberlo.
- Si Google retira un modelo, la app prueba automáticamente:
  `gemini-flash-latest → gemini-3.7-flash → gemini-flash-lite-latest → gemini-3.1-flash-lite`.

## 3. Firebase — ya quedó configurado ✔ (28-ago-2026)

El proyecto **`snbusiness`** ya existe en tu consola con todo activado:

- ✔ Authentication: **Correo/contraseña** y **Google** habilitados
- ✔ Firestore creada (`nam5`, modo producción) con reglas por usuario publicadas
- ✔ App web registrada; la configuración está en `.env` **y** como valor por
  defecto en `src/lib/firebase.ts` (la config web de Firebase es pública por
  diseño; la seguridad la dan las reglas). Gracias a esto, **el APK trae
  Firebase sin configurar secrets**.

Consola: https://console.firebase.google.com/project/snbusiness

Los pasos de abajo quedan como referencia por si algún día recreas el proyecto:

### 3.1 Crear el proyecto
1. Entra a https://console.firebase.google.com con tu cuenta de Google.
2. **Agregar proyecto** → nombre: `snbusiness` → puedes desactivar Analytics → Crear.

### 3.2 Activar la autenticación
1. Menú izquierdo → **Compilación → Authentication** → **Comenzar**.
2. Pestaña **Sign-in method** → habilita **Correo electrónico/contraseña**.
3. Habilita también **Google** (elige tu correo de soporte) → Guardar.

### 3.3 Activar la base de datos
1. **Compilación → Firestore Database** → **Crear base de datos**.
2. Ubicación: la más cercana (us-central o similar) → **Modo de producción**.
3. Pestaña **Reglas**, pega esto y publica:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

(Cada usuario solo puede leer/escribir SUS propios datos.)

### 3.4 Registrar la app web y copiar la configuración
1. Portada del proyecto → ícono **`</>`** (Web) → apodo: `snbusiness` → **Registrar**.
2. Te mostrará un bloque `firebaseConfig`. Copia cada valor en tu **`.env`**:

```
VITE_FIREBASE_API_KEY=AIza…            ← apiKey
VITE_FIREBASE_AUTH_DOMAIN=…            ← authDomain
VITE_FIREBASE_PROJECT_ID=…             ← projectId
VITE_FIREBASE_STORAGE_BUCKET=…         ← storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID=…    ← messagingSenderId
VITE_FIREBASE_APP_ID=…                 ← appId
```

3. Reinicia `npm run dev`. Verás la pantalla de inicio de sesión al abrir la app. ✔

> **Google en el APK:** el login con Google funciona perfecto en el navegador y en la
> PWA instalada. Dentro del APK (WebView) Google a veces lo bloquea; el correo/contraseña
> funciona siempre. Si quieres Google nativo en el APK, el siguiente paso sería el plugin
> `@capacitor-firebase/authentication` (requiere `google-services.json` y el SHA-1).

## 4. APK de Android (GitHub Actions)

El workflow ya compila el APK en cada push. Para que el APK incluya IA y Firebase,
agrega los **secrets** en GitHub:

1. Tu repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Crea estos secrets (los mismos valores del `.env`):
   `VITE_GEMINI_API_KEY`, `VITE_GEMINI_MODEL`, `VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
   `VITE_FIREBASE_APP_ID`.
3. Haz push → pestaña **Actions** → descarga el artefacto `finanzas-personales-debug`.

(Sin secrets el APK igual funciona: la clave de Gemini se puede pegar en Ajustes.)

## 5. Servidor MCP de 21st.dev (para seguir desarrollando con Claude)

Ya quedó el archivo **`.mcp.json`** del proyecto apuntando a `https://21st.dev/api/mcp`.
Solo falta tu clave:

1. Entra a https://21st.dev → **Sign in** → menú **API key** → copia la clave.
2. Defínela como variable de entorno de Windows (PowerShell):

```powershell
[Environment]::SetEnvironmentVariable('API_KEY_21ST', 'TU_CLAVE_AQUI', 'User')
```

3. Reinicia Claude Code y ejecuta `claude mcp list` → debe aparecer `21st ✓ connected`.

## 6. Estructura del proyecto

| Carpeta | Qué hay |
| --- | --- |
| `src/lib/` | Lógica: finanzas, deudas, IA, Excel, notificaciones, temas, sonidos, confeti |
| `src/store/` | Estado global (Zustand v2 con migración automática de datos viejos) |
| `src/components/` | Pantallas: home, month (5 vistas), debts, year, settings, onboarding, auth |
| `resources/` | Ícono fuente + splash (regenera con `node scripts/generate-icons.mjs`) |
| `.github/workflows/` | Compilación automática del APK |

## 7. Comandos útiles

```bash
npm run dev          # desarrollo
npm run build        # producción (dist/)
npx cap sync android # sincronizar Android tras instalar plugins
node scripts/generate-icons.mjs                        # regenerar íconos
npx @capacitor/assets generate --android --assetPath resources  # íconos Android
```
