#include "LoRaWan_APP.h"
#include "Arduino.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>  // Librería para parsear JSON

#define RF_FREQUENCY                915000000
#define TX_OUTPUT_POWER             14
#define LORA_BANDWIDTH              0
#define LORA_SPREADING_FACTOR       7
#define LORA_CODINGRATE             1
#define LORA_PREAMBLE_LENGTH        8
#define LORA_SYMBOL_TIMEOUT         0
#define LORA_FIX_LENGTH_PAYLOAD_ON  false
#define LORA_IQ_INVERSION_ON        false

#define RX_TIMEOUT_VALUE            1000
#define BUFFER_SIZE                 128  // Aumentado para paquetes JSON

// Configura aquí tu red Wi-Fi
const char* WIFI_SSID = ""; //Llena con el SSID de tu red
const char* WIFI_PASS = ""; //Llena con la contraseña de tu red

// Configura la URL de tu API
const char* API_URL = "http://tu ip/telemetria"; // Reemplaza con tu IP

char rxpacket[BUFFER_SIZE];
static RadioEvents_t RadioEvents;

int16_t rssi, rxSize;
bool lora_idle = true;

void setup() {
    Serial.begin(115200);
    Mcu.begin(HELTEC_BOARD, SLOW_CLK_TPYE);

    // Conectar a Wi-Fi
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    Serial.print("Conectando a Wi-Fi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nConectado a Wi-Fi!");

    // Configuración LoRa
    RadioEvents.RxDone = OnRxDone;
    Radio.Init(&RadioEvents);
    Radio.SetChannel(RF_FREQUENCY);
    Radio.SetRxConfig(MODEM_LORA, LORA_BANDWIDTH, LORA_SPREADING_FACTOR,
                      LORA_CODINGRATE, 0, LORA_PREAMBLE_LENGTH,
                      LORA_SYMBOL_TIMEOUT, LORA_FIX_LENGTH_PAYLOAD_ON,
                      0, true, 0, 0, LORA_IQ_INVERSION_ON, true);
}

void loop() {
    if(lora_idle) {
        lora_idle = false;
        Serial.println("Entrando en modo RX LoRa...");
        Radio.Rx(0);
    }
    Radio.IrqProcess();
}

// ----------------------
// CALLBACK: paquete recibido
// ----------------------
void OnRxDone(uint8_t *payload, uint16_t size, int16_t rssi_val, int8_t snr) {
    rssi = rssi_val;
    rxSize = size;
    memcpy(rxpacket, payload, size);
    rxpacket[size] = '\0';
    Radio.Sleep();
    lora_idle = true;

    Serial.printf("Paquete recibido: \"%s\" | RSSI: %d | longitud: %d\r\n", rxpacket, rssi, rxSize);

    // ----------------------
    // Parsear JSON directamente
    // ----------------------
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, rxpacket);

    if(error) {
        Serial.println("Formato de paquete inválido (JSON no válido)");
        return;
    }

    const char* bus_id = doc["bus_id"];
    const char* parada_id = doc["parada_id"];
    const char* evento = doc["evento"];
    int numero_pasajeros = doc["numero_pasajeros"];

    // Construir JSON para enviar al API
    String jsonPayload;
    serializeJson(doc, jsonPayload);

    Serial.println("JSON a enviar: " + jsonPayload);

    // POST al API
    if(WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(API_URL);
        http.addHeader("Content-Type", "application/json");

        int httpResponseCode = http.POST(jsonPayload);
        if(httpResponseCode > 0){
            Serial.printf("POST exitoso! Código: %d\n", httpResponseCode);
        } else {
            Serial.printf("Error POST: %s\n", http.errorToString(httpResponseCode).c_str());
        }
        http.end();
    } else {
        Serial.println("No conectado a Wi-Fi. No se pudo enviar al API.");
    }
}
