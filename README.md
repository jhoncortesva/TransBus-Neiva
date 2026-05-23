# TransBus Neiva

App movil para TransBus Neiva — React Native (Expo SDK 52) + Node.js/Express + PostgreSQL + Socket.io

---

## Estructura del Proyecto

```
transbus-neiva/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js               # Pool de conexiones pg
│   │   │   └── setupDb.js          # Crea tablas y admin por defecto al arrancar
│   │   ├── controllers/
│   │   │   ├── authController.js   # login, register, getProfile, changePassword, updatePhoto
│   │   │   └── driverController.js # createDriver, getDrivers, getDriver, updateDriver, toggleStatus
│   │   ├── middleware/
│   │   │   └── auth.js             # authMiddleware (JWT) + requireRole
│   │   ├── routes/
│   │   │   ├── auth.js             # /api/auth/*
│   │   │   ├── drivers.js          # /api/drivers/*
│   │   │   └── routes.js           # /api/routes/*
│   │   └── index.js                # Entrada: Express + Socket.io + setupDb
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.js          # Estado global: user, token, tracking, toggleTracking
│   │   ├── navigation/
│   │   │   └── AppNavigator.js         # Stacks por rol (admin / user / driver)
│   │   ├── screens/
│   │   │   ├── IntroScreen.js
│   │   │   ├── LoginScreen.js
│   │   │   ├── RegisterScreen.js
│   │   │   ├── AdminDashboard.js       # Registrar / editar / listar conductores y rutas
│   │   │   ├── UserDashboard.js        # Dashboard con mapa y accesos rapidos
│   │   │   ├── MapScreen.js            # Mapa GPS a pantalla completa
│   │   │   ├── RoutesScreen.js         # Lista de rutas con busqueda y favoritos
│   │   │   ├── RouteDetailScreen.js    # Mapa de ruta, conductores activos, notificaciones
│   │   │   └── SettingsScreen.js       # Contrasena, soporte, politica de privacidad
│   │   └── services/
│   │       ├── api.js                  # Fetch wrapper con BASE_URL y token JWT
│   │       └── socket.js               # Cliente Socket.io (singleton)
│   ├── android/
│   ├── app.json
│   └── App.js
├── docker-compose.yml
└── .env.example
```

---

## Desarrollo con Docker (recomendado)

El backend y PostgreSQL estan configurados con Docker para evitar problemas de versiones. Solo se necesita tener Docker instalado.

```bash
# 1. Copiar y configurar variables de entorno
cp .env.example .env
# Editar .env y cambiar JWT_SECRET por una clave segura

# 2. Levantar backend + base de datos
docker compose up --build
```

El backend queda disponible en `http://localhost:3000`. Las tablas se crean automaticamente al arrancar.

```bash
# Detener servicios
docker compose down

# Detener y eliminar datos de la base de datos
docker compose down -v
```

---

## Flujo del Backend

```
Peticion HTTP
      │
      ▼
  index.js  <── Configura Express, Socket.io, llama setupDb() al arrancar
      │
      ▼
  routes/auth.js  |  routes/drivers.js  |  routes/routes.js
      │
      ▼
  middleware/auth.js
      ├── authMiddleware   → verifica JWT del header Authorization: Bearer <token>
      └── requireRole('admin') → bloquea si el rol no coincide
      │
      ▼
  controllers/
      ├── authController.js    → consulta/modifica tabla users
      └── driverController.js  → consulta/modifica tablas drivers + users
      │
      ▼
  config/db.js  →  PostgreSQL (Railway en prod / Docker en dev)
```

### Socket.io — Tiempo real

```
Conductor emite  driver:update_location  →  servidor guarda en activeDrivers Map
                 { driverId, driverName,     broadcast drivers:locations a todos
                   routeName, lat, lng }  →  sendPushToSubscribers() notifica usuarios cercanos

Usuario emite    user:request_drivers    →  servidor responde con snapshot actual

RouteDetailScreen filtra la lista recibida por routeName === ruta seleccionada
```

---

## Flujo del Frontend

```
App.js
  └── AuthProvider (AuthContext.js)
        │  Al arrancar: carga token + user de AsyncStorage
        ▼
  AppNavigator.js
        ├── Sin sesion     → IntroScreen → Login / Register
        ├── role=admin     → AdminDashboard
        └── role=user/driver → UserDashboard → MapScreen
                                             → RoutesScreen → RouteDetailScreen
                                             → SettingsScreen
        ▼
  Pantalla activa
        │  Datos remotos → services/api.js    (fetch + JWT)
        │  Tiempo real   → services/socket.js (Socket.io)
        ▼
  Backend en Railway
```

---

## Como opera Railway (produccion)

```
git push origin main
      │
      ▼
Railway detecta el push y redespliega automaticamente (~1 min)
      │
      ├── Backend Service
      │     Ejecuta: npm install && node src/index.js
      │     setupDb() crea/migra tablas (ALTER TABLE IF NOT EXISTS — nunca destruye datos)
      │     Variables de entorno configuradas en Railway Dashboard
      │
      └── PostgreSQL Plugin
            Base de datos persistente en la nube
            Inyecta DATABASE_URL automaticamente al backend
```

---

## Requisitos de Desarrollo

### Backend

| Herramienta | Version minima | Notas |
|---|---|---|
| Docker | 24+ | Recomendado — levanta backend + DB sin configuracion manual |
| Node.js | 18 LTS | Solo si se ejecuta sin Docker |

### Frontend (Android)

| Herramienta | Version minima | Notas |
|---|---|---|
| Node.js | 18 LTS | Requerido siempre |
| Java JDK | 17 | Requerido por Gradle |
| Android Studio | Hedgehog (2023.1)+ | Incluye SDK Manager |
| Android SDK | API 34 | Target del proyecto; minimo API 24 |

```bash
# Node 18 con nvm
nvm install 18 && nvm use 18

# JDK 17 en Ubuntu/Debian
sudo apt install openjdk-17-jdk
```

### Dispositivo movil

| Requisito | Valor |
|---|---|
| Android minimo | 7.0 (API 24) |
| Google Play Services | Obligatorio (Maps + notificaciones push) |
| GPS | Obligatorio |

Se recomienda dispositivo fisico — el emulador no tiene GPS real ni Google Maps funcional por defecto.

---

## Configuracion y Arranque

### Backend con Docker

```bash
cp .env.example .env
docker compose up --build
```

### Backend sin Docker

```bash
cd backend
npm install

# Crear backend/.env con:
# DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD  (o DATABASE_URL para Railway)
# JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL

node src/index.js
```

### Frontend (Android)

```bash
cd frontend
npm install

# Desarrollo
npx expo run:android

# APK release
npx expo run:android --variant release
# Salida: android/app/build/outputs/apk/release/app-release.apk
```

**Google Maps API Key** — configurar en `app.json` bajo `android.config.googleMaps.apiKey`. Debe tener habilitadas Maps SDK for Android y Geocoding API en Google Cloud Console.

#### Notificaciones Push (FCM V1) — primer despliegue

Las credenciales de Firebase no se incluyen en el repositorio.

**Paso 1 — `google-services.json`**

1. Firebase Console → Project Settings → General → descargar `google-services.json`
2. Copiar a `frontend/android/app/google-services.json` (excluido por .gitignore)

**Paso 2 — Service Account Key para EAS**

```bash
cd frontend
eas credentials
# Android → release → Google Service Account
# → Manage your Google Service Account Key for Push Notifications (FCM V1)
# → Set up a Google Service Account Key for Push Notifications (FCM V1)
# Subir el JSON desde: Firebase Console → Project Settings → Service accounts → Generate new private key
```

```bash
npx expo run:android --variant release
```

---

## Endpoints API

### Auth (`/api/auth`)

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/login` | — | Iniciar sesion |
| POST | `/register` | — | Registrar usuario |
| GET | `/profile` | JWT | Perfil del usuario autenticado |
| PATCH | `/change-password` | JWT | Cambiar contrasena |
| PATCH | `/update-photo` | JWT | Actualizar foto de perfil (base64) |
| PATCH | `/push-sub` | JWT | Suscribir a notificaciones: `{ push_token, route_name, latitude, longitude }` |
| DELETE | `/push-sub` | JWT | Cancelar suscripcion: `{ route_name }` |

### Drivers (`/api/drivers`) — solo Admin

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/` | Crear conductor (multipart/form-data + PDF licencia) |
| GET | `/` | Listar todos los conductores |
| GET | `/live` | Conductores activos en tiempo real |
| GET | `/:id` | Ver conductor |
| PUT | `/:id` | Editar datos del conductor |
| PATCH | `/:id/toggle-status` | Activar / Desactivar conductor |

### Routes (`/api/routes`)

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/` | — | Listar todas las rutas |
| GET | `/:id` | — | Ver ruta con coordenadas IDA/VUELTA y POIs |
| POST | `/` | Admin | Crear ruta |
| PUT | `/:id` | Admin | Editar ruta |
| DELETE | `/:id` | Admin | Eliminar ruta |

---

## Roles y Funcionalidades

| Rol | Acceso | Funcionalidades |
|-----|--------|-----------------|
| `admin` | Creado por setupDb | Gestionar conductores y rutas (crear, editar, activar/desactivar) |
| `user` | Registro en la app | Mapa GPS, rutas con favoritos, conductores en tiempo real, notificaciones push |
| `driver` | Credenciales creadas por admin | Todo lo de user + compartir ubicacion en tiempo real |

### Credenciales Admin por defecto

```
Usuario:    admin
Contrasena: Admin@TransBus2024
```

Configurable en `.env` antes del primer arranque.

---

## Variables de Entorno

```env
# JWT
JWT_SECRET=clave_secreta_muy_larga

# Admin por defecto (solo afecta el primer arranque)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@TransBus2024
ADMIN_EMAIL=admin@transbus.com

# Base de datos (sin Docker)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=transbus_db
DB_USER=postgres
DB_PASSWORD=tu_contrasena

# O conexion Railway (tiene prioridad si esta definida)
DATABASE_URL=postgresql://...
```
