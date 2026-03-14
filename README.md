# Coomotor App 🚌

App móvil para Coomotor — React Native (Expo) + Node.js + PostgreSQL

---

## Estructura del Proyecto

```
coomotor/
├── backend/          # API Node.js + Express
│   ├── src/
│   │   ├── config/   # DB y setupDb
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── routes/
│   └── package.json
└── frontend/         # App Expo React Native
    ├── src/
    │   ├── context/
    │   ├── navigation/
    │   ├── screens/
    │   └── services/
    └── App.js
```

---

## 1. Requisitos previos

- Node.js >= 18
- PostgreSQL >= 14
- Expo CLI: `npm install -g expo-cli`
- Expo Go instalado en tu Android

---

## 2. Configuración del Backend

### Instalar dependencias
```bash
cd backend
npm install
```

### Configurar variables de entorno
```bash
cp .env.example .env
# Edita .env con tus datos de PostgreSQL
```

### Crear la base de datos
```sql
-- En psql o pgAdmin:
CREATE DATABASE coomotor_db;
```

### Inicializar tablas y crear admin por defecto
```bash
npm run setup-db
```

Esto crea las tablas y el admin por defecto:
- **Usuario:** `admin`
- **Contraseña:** `Admin@Coomotor2024`

### Iniciar servidor
```bash
npm run dev      # Desarrollo (nodemon)
npm start        # Producción
```

El servidor corre en: `http://localhost:3000`

---

## 3. Configuración del Frontend

### ⚠️ PASO IMPORTANTE: Configurar IP del servidor

Antes de correr el frontend, edita este archivo:
```
frontend/src/services/api.js
```

Cambia esta línea con la IP local de tu máquina:
```js
const BASE_URL = 'http://192.168.1.X:3000'; // <-- PON TU IP AQUÍ
```

Para encontrar tu IP:
- **Windows:** Ejecuta `ipconfig` en CMD → busca "Dirección IPv4"
- **Mac/Linux:** Ejecuta `ifconfig` → busca tu interfaz de red

> ⚠️ No uses `localhost` ni `127.0.0.1` — Expo Go en Android no puede alcanzarlos.
> Tu celular y tu PC deben estar en la **misma red WiFi**.

### Instalar dependencias
```bash
cd frontend
npm install
```

### Iniciar Expo
```bash
npx expo start
```

Escanea el QR con la app **Expo Go** en tu Android.

---

## 4. Roles y Acceso

| Rol | Cómo acceder | Dashboard |
|-----|-------------|-----------|
| `admin` | Solo por DB (creado automáticamente) | Panel de conductores |
| `user` | Registro en la app | Pantalla "En construcción" |
| `driver` | Credenciales creadas por admin | Pantalla "En construcción" |

### Credenciales Admin por defecto
```
Usuario: admin
Contraseña: Admin@Coomotor2024
```

> Cambia esto en el archivo `.env` antes del setup.

---

## 5. Endpoints API

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/register` | Registrar usuario |
| GET | `/api/auth/profile` | Perfil del usuario (requiere token) |

### Drivers (solo Admin)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/drivers` | Crear conductor (multipart/form-data) |
| GET | `/api/drivers` | Listar conductores |
| GET | `/api/drivers/:id` | Ver conductor |
| PATCH | `/api/drivers/:id/toggle-status` | Activar/Desactivar conductor |

---

## 6. Flujo de la App

```
App inicia
    ↓
¿Usuario logueado?
    ├── NO → Intro Screen
    │         ├── "Ya tengo cuenta" → Login
    │         └── "Quiero hacer parte" → Register
    │
    └── SÍ → ¿Qué rol?
               ├── admin → Admin Dashboard (registrar/ver conductores)
               └── user/driver → Dashboard "En Construcción"
```

---

## 7. Notas para el equipo

- Los cambios en `api.js` (la IP) no afectan a otros devs si cada uno configura la suya localmente.
- Para producción, usar variables de entorno en lugar de la IP hardcodeada.
- Los PDFs de licencias se guardan en `backend/uploads/licenses/`.
- Usar `npm run setup-db` solo **una vez** para inicializar la DB. Si lo corres de nuevo, no duplica el admin.

---

## 8. Variables de entorno `.env` (Backend)

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=coomotor_db
DB_USER=postgres
DB_PASSWORD=tu_contraseña
JWT_SECRET=clave_secreta_jwt
JWT_EXPIRES_IN=7d
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@Coomotor2024
ADMIN_EMAIL=admin@coomotor.com
```
