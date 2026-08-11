const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API Routes ───────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/planning', require('./routes/planning'));
app.use('/api/users',    require('./routes/users'));

// ─── SPA Fallback ─────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// ─── Error Handler ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`\n🚀 CamDuct KNND Inventory Server running at http://localhost:${port}\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${port} is in use, trying http://localhost:${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error(err);
    }
  });
}

startServer(PORT);

module.exports = app;
