const mqtt = require('mqtt');
const handler = require('../handlers/mqttHandler');

function initMqtt(io) {
  const client = mqtt.connect(process.env.MQTT_URL);
  client.on('connect', () => {
    console.log('MQTT connected');
    client.subscribe('paradas/+/event');
    client.subscribe('buses/+/location');
  });
  client.on('message', (topic, msg) => {
    handler(topic, msg.toString(), io, client);
  });
  client.on('error', (err) => console.error('MQTT error', err));
}

module.exports = { initMqtt };
