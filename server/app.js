const express = require('express');
const cors = require('cors');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5001;

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
app.use('/api/purchase', require('./routes/purchase'));

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

function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`).toString();
      const lines = out.split('\n');
      const pids = new Set();
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].endsWith(`:${port}`)) {
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0' && pid !== String(process.pid)) {
            pids.add(pid);
          }
        }
      });
      pids.forEach(pid => {
        try {
          execSync(`taskkill /F /PID ${pid}`);
          console.log(`⚡ Automatically freed existing server process (PID ${pid}) on port ${port}.`);
        } catch (e) {}
      });
    } else {
      execSync(`lsof -t -i:${port} | xargs kill -9 2>/dev/null || true`);
    }
  } catch (e) {
    // Ignore if no process found
  }
}

let retried = false;

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`\n🚀 CamDuct KNND Inventory Server running at http://localhost:${port}\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (!retried) {
        retried = true;
        console.log(`\n⚠️ Port ${port} is currently occupied. Automatically clearing existing process...`);
        killProcessOnPort(port);
        setTimeout(() => {
          startServer(port);
        }, 800);
      } else {
        console.error(`\n❌ Could not bind to port ${port}. Please check process permissions.\n`);
        process.exit(1);
      }
    } else {
      console.error(err);
    }
  });
}

startServer(PORT);

module.exports = app;
