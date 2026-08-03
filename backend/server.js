require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { initSocket } = require('./socket');

const authRoutes = require('./routes/authRoutes');
const reportRoutes = require('./routes/reportRoutes');
const alertRoutes = require('./routes/alertRoutes');
const userRoutes = require('./routes/userRoutes');
const familyRoutes = require('./routes/familyRoutes');

const app = express();
const server = http.createServer(app);

initSocket(server);

app.use(cors());
app.use(express.json());

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.use('/api', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/users', userRoutes);
app.use('/api/family', familyRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'GeoSafe API' });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const file = req.path === '/' ? 'index.html' : req.path.replace(/^\//, '');
  const safe = path.normalize(file).replace(/^(\.\.(\/|\\|$))+/, '');
  res.sendFile(path.join(frontendPath, safe), (err) => {
    if (err) res.sendFile(path.join(frontendPath, 'index.html'));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`GeoSafe server running on http://localhost:${PORT}`);
});
