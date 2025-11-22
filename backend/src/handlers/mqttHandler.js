const { z } = require('zod');
const { saveEvent } = require('../db/pg');

// esquema simple con Zod (extiéndelo según lo necesites)
const EventSchema = z.object({
  msgId: z.string().optional(),
  type: z.string(),
  stopId: z.string(),
  busId: z.string().optional(),
  ts: z.string().optional(),
  meta: z.any().optional()
});

module.exports = async function mqttHandler(topic, message, io) {
  try {
    let payload;
    try { payload = JSON.parse(message); } catch(e) { payload = { raw: message }; }
    // validate basic shape if possible
    try { EventSchema.parse(payload); } catch (e) { console.warn('Validation failed', e.errors); }

    // Save to DB (the function should do dedupe by msgId)
    await saveEvent(topic, payload);

    // Emit normalized event to connected clients
    io.emit('parada_event', { topic, payload });

    console.log('Processed MQTT message', topic, payload.msgId || '');
  } catch (err) {
    console.error('Error processing mqtt msg', err);
  }
};
