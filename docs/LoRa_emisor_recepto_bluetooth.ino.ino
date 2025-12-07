#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <BLEEddystoneURL.h>
#include <BLEEddystoneTLM.h>
#include <BLEBeacon.h>

#include "LoRaWan_APP.h"

// ============================
// CONFIGURACIÓN LoRa
// ============================
#define RF_FREQUENCY            915000000 // Hz
#define TX_OUTPUT_POWER         5         // dBm
#define LORA_BANDWIDTH          0
#define LORA_SPREADING_FACTOR   7
#define LORA_CODINGRATE         1
#define LORA_PREAMBLE_LENGTH    8
#define LORA_FIX_LENGTH_PAYLOAD_ON false
#define LORA_IQ_INVERSION_ON    false

#define BUFFER_SIZE             128  // payload máximo
char txpacket[BUFFER_SIZE];

bool lora_idle = true;
static RadioEvents_t RadioEvents;

// ============================
// CONFIGURACIÓN BLE
// ============================
int scanTime = 5;  // segundos
BLEScan *pBLEScan;

// ============================
// CÓDIGO DE SEGURIDAD
// ============================
#define BUS_SECURITY_CODE "1234"  // Código de seguridad esperado en manufacturerData para aceptar el bus

// ============================
// CALLBACK BLE
// ============================
class MyAdvertisedDeviceCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) override {
    if(advertisedDevice.haveManufacturerData()) {
        // Obtenemos manufacturerData directamente como String de Arduino
        String data = advertisedDevice.getManufacturerData();

        // Filtramos solo caracteres imprimibles para evitar símbolos basura
        String cleanData = "";
        for (int i = 0; i < data.length(); i++) {
            if (isPrintable(data[i])) {
                cleanData += data[i];
            }
        }

        // Se espera formato: bus_id,numero_pasajeros,codigo
        int idx1 = cleanData.indexOf(',');
        int idx2 = cleanData.lastIndexOf(',');
        if(idx1 > 0 && idx2 > idx1) {
            String bus_id = cleanData.substring(0, idx1);
            bus_id.trim(); // limpia espacios y caracteres invisibles
            int numero_pasajeros = cleanData.substring(idx1 + 1, idx2).toInt();
            String codigo_recibido = cleanData.substring(idx2 + 1);
            codigo_recibido.trim();

            if(codigo_recibido == BUS_SECURITY_CODE) {
                // Limpiamos txpacket antes de usar
                memset(txpacket, 0, BUFFER_SIZE);

                // Preparar paquete JSON
                snprintf(txpacket, BUFFER_SIZE,
                         "{\"bus_id\":\"%s\",\"parada_id\":\"stop-01\",\"evento\":\"bus_detectado\",\"numero_pasajeros\":%d}",
                         bus_id.c_str(), numero_pasajeros);

                Serial.printf("Bus detectado válido: %s\n", txpacket);

                // Enviar por LoRa si el módulo está libre
                if(lora_idle) {
                    Radio.Send((uint8_t*)txpacket, strlen(txpacket));
                    lora_idle = false;
                }
            } else {
                Serial.println("Código de seguridad inválido");
            }
        } else {
            Serial.println("Formato de manufacturerData inválido");
        }
    }
  }
};

// ============================
// FUNCIONES LoRa
// ============================
void OnTxDone(void) {
    Serial.println("TX done");
    lora_idle = true;
}

void OnTxTimeout(void) {
    Radio.Sleep();
    Serial.println("TX timeout");
    lora_idle = true;
}

// ============================
// SETUP
// ============================
void setup() {
    Serial.begin(115200);
    Serial.println("Inicializando BLE y LoRa...");

    // -------------------
    // Inicializar BLE
    // -------------------
    BLEDevice::init("");
    pBLEScan = BLEDevice::getScan();
    pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
    pBLEScan->setActiveScan(true);
    pBLEScan->setInterval(100);
    pBLEScan->setWindow(99);

    // -------------------
    // Inicializar LoRa
    // -------------------
    Mcu.begin(HELTEC_BOARD, SLOW_CLK_TPYE);

    RadioEvents.TxDone = OnTxDone;
    RadioEvents.TxTimeout = OnTxTimeout;

    Radio.Init(&RadioEvents);
    Radio.SetChannel(RF_FREQUENCY);
    Radio.SetTxConfig(MODEM_LORA, TX_OUTPUT_POWER, 0, LORA_BANDWIDTH,
                      LORA_SPREADING_FACTOR, LORA_CODINGRATE,
                      LORA_PREAMBLE_LENGTH, LORA_FIX_LENGTH_PAYLOAD_ON,
                      true, 0, 0, LORA_IQ_INVERSION_ON, 3000);
}

// ============================
// LOOP
// ============================
void loop() {
    // -------------------
    // Escaneo BLE
    // -------------------
    BLEScanResults *foundDevices = pBLEScan->start(scanTime, false);
    Serial.printf("Dispositivos encontrados: %d\n", foundDevices->getCount());
    pBLEScan->clearResults();
    
    // -------------------
    // Procesar eventos LoRa
    // -------------------
    Radio.IrqProcess();
    
    delay(2000);
}

