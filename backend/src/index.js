require('dotenv').config();
const express = require('express');
const http = require('http');
const { initMqtt } = require('./mqttClient');
const { initDb } = require('./db/pg');

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = require('socket.io')(server, { cors: { origin: '*' } });

app.get('/health', (req, res) => res.json({ ok: true }));

// endpoint simulate - reusa el handler que procesa mensajes MQTT
app.post('/api/simulate', async (req, res) => {
  const { topic, payload } = req.body;
  try {
    const mqttHandler = require('./handlers/mqttHandler');
    await mqttHandler(topic, JSON.stringify(payload), io);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  await initDb();
  initMqtt(io);
  console.log(`Server listening on ${PORT}`);
});
