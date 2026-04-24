# Coomotor App 🚌

App móvil para Coomotor — React Native (Expo SDK 52) + Node.js/Express + PostgreSQL + Socket.io

---

## Estructura del Proyecto

```
coomotor/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js          # Pool de conexiones pg (reutilizado en toda la app)
│   │   │   └── setupDb.js     # Crea tablas y admin por defecto al arrancar
│   │   ├── controllers/
│   │   │   ├── authController.js    # login, register, getProfile, changePassword, updatePhoto
│   │   │   └── driverController.js  # createDriver, getDrivers, getDriver, updateDriver, toggleStatus
│   │   ├── middleware/
│   │   │   └── auth.js        # authMiddleware (JWT) + requireRole
│   │   ├── routes/
│   │   │   ├── auth.js        # /api/auth/*
│   │   │   └── drivers.js     # /api/drivers/*
│   │   └── index.js           # Entrada: Express + Socket.io + setupDb
│   └── package.json
└── frontend/
    ├── src/
    │   ├── context/
    │   │   └── AuthContext.js     # Estado global: user, token, tracking, toggleTracking
    │   ├── navigation/
    │   │   └── AppNavigator.js    # Stacks por rol (admin / user / driver)
    │   ├── screens/
    │   │   ├── IntroScreen.js
    │   │   ├── LoginScreen.js
    │   │   ├── RegisterScreen.js
    │   │   ├── AdminDashboard.js  # Registrar / editar / listar conductores
    │   │   ├── UserDashboard.js   # Dashboard usuario/conductor con mapa y accesos rápidos
    │   │   ├── MapScreen.js       # Mapa GPS a pantalla completa
    │   │   ├── RoutesScreen.js    # Lista de rutas con búsqueda y favoritos
    │   │   ├── RouteDetailScreen.js # Mapa de ruta, conductores activos, notificaciones
    │   │   └── SettingsScreen.js  # Cambio de contraseña, soporte, política de privacidad
    │   └── services/
    │       ├── api.js             # Fetch wrapper con BASE_URL y token JWT
    │       └── socket.js          # Cliente Socket.io (singleton)
    ├── app.json
    └── App.js
```

---

## Flujo del Backend

```
Petición HTTP
      │
      ▼
  index.js  ←── Configura Express, Socket.io, llama setupDb() al arrancar
      │
      ▼
  routes/auth.js  o  routes/drivers.js
      │
      │  (middleware aplicado antes del controller)
      ▼
  middleware/auth.js
      ├── authMiddleware   → verifica JWT del header Authorization: Bearer <token>
      └── requireRole('admin') → bloquea si el rol no coincide
      │
      ▼
  controllers/
      ├── authController.js    → consulta/modifica tabla users
      └── driverController.js  → consulta/modifica tablas drivers + users (transacción)
      │
      ▼
  config/db.js  →  PostgreSQL (Railway en prod / local en dev)
```

**Ejemplo — admin edita un conductor:**
`PUT /api/drivers/:id` → `authMiddleware` verifica JWT → `requireRole('admin')` verifica rol → `updateDriver()` actualiza `drivers` y `users` en una transacción → responde JSON.

### Socket.io — Tiempo real (dentro de index.js)

```
Conductor emite  driver:update_location  →  servidor guarda en activeDrivers Map
                 { driverId, driverName,     (incluye routeName para filtrado)
                   routeName, lat, lng }  →  broadcast drivers:locations a todos

Usuario emite    user:request_drivers    →  servidor responde con snapshot actual

RouteDetailScreen filtra la lista recibida por routeName === ruta seleccionada
```

---

## Flujo del Frontend

```
App.js
  └── AuthProvider (AuthContext.js)
        │  Al arrancar: carga token + user de AsyncStorage
        │  Expone: user, token, login, logout, updateUser,
        │          tracking, toggleTracking (GPS + socket)
        ▼
  AppNavigator.js
        │  Lee user.role para decidir qué stack mostrar
        ├── Sin sesión   → IntroScreen → Login / Register
        ├── role=admin   → AdminDashboard
        └── role=user/driver → UserDashboard → MapScreen
                                             → RoutesScreen → RouteDetailScreen
                                             → SettingsScreen
        ▼
  Pantalla activa
        │  Datos remotos → services/api.js   (fetch + JWT)
        │  Tiempo real   → services/socket.js (Socket.io)
        ▼
  Backend en Railway
```

**Ejemplo — inicio de sesión:**
`LoginScreen` → `authAPI.login()` → `POST /api/auth/login` → respuesta `{ token, user }` → `AuthContext.login()` persiste en AsyncStorage → `AppNavigator` detecta el cambio y redirige al dashboard correcto.

---

## Cómo opera Railway

```
git push origin main
      │
      ▼
Railway detecta el push y redespliega automáticamente (~1 min)
      │
      ├── Backend Service
      │     Ejecuta: npm install && node src/index.js
      │     setupDb() crea/migra tablas al arrancar (ALTER TABLE IF NOT EXISTS — nunca destruye datos)
      │     URL pública: https://coomotortrans-production.up.railway.app
      │     Variables de entorno configuradas en Railway Dashboard
      │
      └── PostgreSQL Plugin
            Base de datos persistente en la nube
            Inyecta DATABASE_URL automáticamente al backend
```

En **desarrollo local** el backend se corre con `node src/index.js` apuntando a una PostgreSQL local,
y `frontend/src/services/api.js` → `BASE_URL` se cambia a la IP local del equipo (`192.168.x.x:3000`)
para que el dispositivo en la misma red WiFi lo encuentre.

---

## Requisitos de Desarrollo

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Node.js | **18 LTS** | Versiones anteriores fallan (operador `??`) |
| npm | 9+ | Incluido con Node 18 |
| Java JDK | **17** | Requerido por Gradle para builds Android |
| Android Studio | Hedgehog (2023.1)+ | Incluye SDK Manager y emulador |
| Android SDK | API 34 (Android 14) | Target del proyecto; mínimo API 24 |

```bash
# Instalar Node 18 con nvm
nvm install 18 && nvm use 18

# JDK 17 en Ubuntu/Debian
sudo apt install openjdk-17-jdk
```

### Dispositivo móvil

| Requisito | Valor |
|---|---|
| Android mínimo | 7.0 (API 24) |
| Android recomendado | 10+ (API 29+) |
| Google Play Services | Obligatorio (Maps + notificaciones) |
| GPS | Obligatorio (funciones de ubicación) |

> Se recomienda **dispositivo físico** — el emulador no tiene GPS real ni Google Maps funcional por defecto.

---

## Configuración y Arranque

### Backend (local)

```bash
cd backend
npm install

# Crear .env con:
# DATABASE_URL=...  (o DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD)
# JWT_SECRET=clave_secreta
# ADMIN_USERNAME=admin
# ADMIN_PASSWORD=Admin@Coomotor2024
# ADMIN_EMAIL=admin@coomotor.com

node src/index.js   # setupDb() crea las tablas automáticamente al arrancar
```

### Frontend (Android)

```bash
cd frontend
npm install

# Probar en dispositivo/emulador (modo desarrollo con logs en vivo)
npx expo run:android

# Generar APK distribuible
npx expo run:android --variant release
# APK → android/app/build/outputs/apk/release/app-release.apk
```

> **Google Maps API Key** — debe estar activa en Google Cloud Console con
> *Maps SDK for Android* y *Geocoding API* habilitadas. Se configura en
> `app.json` → `android.config.googleMaps.apiKey`.

---

## Endpoints API

### Auth (`/api/auth`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/login` | — | Iniciar sesión → devuelve `token` + `user` (incluye `assignedRoute` para conductores) |
| POST | `/register` | — | Registrar usuario |
| GET | `/profile` | JWT | Perfil del usuario autenticado |
| PATCH | `/change-password` | JWT | Cambiar contraseña |
| PATCH | `/update-photo` | JWT | Actualizar foto de perfil (base64) |

### Drivers (`/api/drivers`) — solo Admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/` | Crear conductor (multipart/form-data + PDF licencia) |
| GET | `/` | Listar todos los conductores (incluye `assigned_route`) |
| GET | `/:id` | Ver conductor |
| PUT | `/:id` | Editar datos del conductor (nombre, doc, email, placa, ruta, contraseña opcional) |
| PATCH | `/:id/toggle-status` | Activar / Desactivar conductor |

---

## Roles y Funcionalidades

| Rol | Acceso | Pantallas |
|-----|--------|-----------|
| `admin` | Creado automáticamente por `setupDb` | AdminDashboard: registrar, editar, activar/desactivar conductores; asignar rutas |
| `user` | Registro en la app | Mapa GPS, lista de rutas con favoritos, detalle de ruta con conductores activos y notificaciones |
| `driver` | Credenciales creadas por admin | Igual que user + botón "Compartir ubicación" (visible solo en ruta asignada) |

### Credenciales Admin por defecto
```
Usuario:    admin
Contraseña: Admin@Coomotor2024
```
> Configurable en `.env` antes del primer arranque.

---

## Variables de Entorno — Backend (`.env`)

```env
PORT=3000

# Base de datos local
DB_HOST=localhost
DB_PORT=5432
DB_NAME=coomotor_db
DB_USER=postgres
DB_PASSWORD=tu_contraseña

# O bien, conexión Railway (tiene prioridad si está definida)
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=clave_secreta_muy_larga
JWT_EXPIRES_IN=7d

# Admin por defecto
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@Coomotor2024
ADMIN_EMAIL=admin@coomotor.com

# Email (nodemailer — opcional)
EMAIL_USER=...
EMAIL_PASS=...
```
