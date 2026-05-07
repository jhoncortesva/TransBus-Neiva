require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/drivers');
const routeRoutes = require('./routes/routes');
const setupDatabase = require('./config/setupDb');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads', 'licenses');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Coomotor API running', timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/routes', routeRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (err.message === 'Solo se permiten archivos PDF') {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Socket.io — ubicaciones en tiempo real
// Map: driverId -> { driverId, driverName, routeName, latitude, longitude, updatedAt }
const activeDrivers = new Map();

// Endpoint REST para que la tarea de fondo del frontend consulte conductores activos
app.get('/api/drivers/live', (req, res) => {
  res.json({ drivers: Array.from(activeDrivers.values()) });
});

io.on('connection', (socket) => {
  // Conductor comparte su ubicación
  socket.on('driver:update_location', (data) => {
    activeDrivers.set(data.driverId, { ...data, updatedAt: Date.now() });
    io.emit('drivers:locations', Array.from(activeDrivers.values()));
  });

  // Conductor deja de compartir
  socket.on('driver:stop_location', (data) => {
    activeDrivers.delete(data.driverId);
    io.emit('drivers:locations', Array.from(activeDrivers.values()));
  });

  // Usuario solicita conductores activos al conectarse
  socket.on('user:request_drivers', () => {
    socket.emit('drivers:locations', Array.from(activeDrivers.values()));
  });
});

setupDatabase()
  .catch(err => console.error('⚠️ DB setup error:', err.message))
  .finally(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Coomotor API running on port ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
      console.log(`🔌 Socket.io activo`);
    });
  });
