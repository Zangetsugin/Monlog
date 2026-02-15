/*
 * Arduino Uno - Communication UART et SPI
 * Auteur: Emergent Labs
 * 
 * Fonctionnalités:
 * - UART: Communication PC <-> Arduino (115200 baud)
 * - SPI: Communication Master avec périphériques
 * - Protocole temps réel pour modifier/lire des valeurs
 * 
 * Commandes UART (depuis le PC):
 *   R<idx>        - Lire valeur à l'index idx (0-15)
 *   W<idx>,<val>  - Écrire valeur à l'index idx
 *   T             - Lire toute la table
 *   S<cmd>        - Envoyer commande SPI et recevoir réponse
 *   M<mode>       - Changer mode (0=UART, 1=SPI, 2=BOTH)
 *   P             - Ping (test connexion)
 */

#include <SPI.h>

// ==================== CONFIGURATION ====================
#define UART_BAUD_RATE    115200
#define TABLE_SIZE        16
#define SPI_CS_PIN        10      // Chip Select pour SPI
#define BUFFER_SIZE       64

// Modes de fonctionnement
#define MODE_UART_ONLY    0
#define MODE_SPI_ONLY     1
#define MODE_BOTH         2

// ==================== VARIABLES GLOBALES ====================
uint16_t dataTable[TABLE_SIZE];   // Table de données modifiable
uint8_t currentMode = MODE_BOTH;  // Mode par défaut
char rxBuffer[BUFFER_SIZE];       // Buffer réception UART
uint8_t rxIndex = 0;
bool commandReady = false;

// ==================== PROTOTYPES ====================
void uart_init(void);
void uart_send_string(const char* str);
void uart_send_value(uint16_t value);
void uart_process_command(void);

void spi_init(void);
uint8_t spi_transfer_byte(uint8_t data);
void spi_select(void);
void spi_deselect(void);

void table_init(void);
void table_print_all(void);

// ==================== SETUP ====================
void setup() {
  // Initialisation de la table avec valeurs par défaut
  table_init();
  
  // Initialisation UART
  uart_init();
  
  // Initialisation SPI
  spi_init();
  
  uart_send_string("\n=== Arduino UART/SPI Ready ===");
  uart_send_string("\nMode: BOTH | Baud: 115200");
  uart_send_string("\nCommandes: R<i>, W<i>,<v>, T, S<cmd>, M<m>, P\n");
}

// ==================== LOOP ====================
void loop() {
  // Lecture UART
  if (currentMode != MODE_SPI_ONLY) {
    while (Serial.available() > 0) {
      char c = Serial.read();
      
      if (c == '\n' || c == '\r') {
        if (rxIndex > 0) {
          rxBuffer[rxIndex] = '\0';
          commandReady = true;
        }
      } else if (rxIndex < BUFFER_SIZE - 1) {
        rxBuffer[rxIndex++] = c;
      }
    }
    
    if (commandReady) {
      uart_process_command();
      rxIndex = 0;
      commandReady = false;
    }
  }
  
  // Mode SPI autonome (exemple: lecture périodique)
  if (currentMode == MODE_SPI_ONLY) {
    // Exemple: lire un registre SPI toutes les secondes
    static unsigned long lastRead = 0;
    if (millis() - lastRead > 1000) {
      spi_select();
      uint8_t response = spi_transfer_byte(0x00); // Commande lecture
      spi_deselect();
      lastRead = millis();
    }
  }
}

// ==================== UART FUNCTIONS ====================
void uart_init(void) {
  Serial.begin(UART_BAUD_RATE);
  while (!Serial) {
    ; // Attendre connexion (pour Leonardo/Micro)
  }
}

void uart_send_string(const char* str) {
  Serial.print(str);
}

void uart_send_value(uint16_t value) {
  Serial.print(value);
}

void uart_process_command(void) {
  char cmd = rxBuffer[0];
  
  switch (cmd) {
    case 'P': // Ping
    case 'p':
      uart_send_string("PONG\n");
      break;
      
    case 'R': // Read - R<index>
    case 'r': {
      int idx = atoi(&rxBuffer[1]);
      if (idx >= 0 && idx < TABLE_SIZE) {
        uart_send_string("[R");
        Serial.print(idx);
        uart_send_string("] = ");
        uart_send_value(dataTable[idx]);
        uart_send_string("\n");
      } else {
        uart_send_string("ERR: Index invalide (0-15)\n");
      }
      break;
    }
    
    case 'W': // Write - W<index>,<value>
    case 'w': {
      char* comma = strchr(rxBuffer, ',');
      if (comma != NULL) {
        int idx = atoi(&rxBuffer[1]);
        uint16_t val = atoi(comma + 1);
        if (idx >= 0 && idx < TABLE_SIZE) {
          dataTable[idx] = val;
          uart_send_string("[W");
          Serial.print(idx);
          uart_send_string("] <- ");
          uart_send_value(val);
          uart_send_string(" OK\n");
        } else {
          uart_send_string("ERR: Index invalide (0-15)\n");
        }
      } else {
        uart_send_string("ERR: Format W<idx>,<val>\n");
      }
      break;
    }
    
    case 'T': // Table - afficher tout
    case 't':
      table_print_all();
      break;
      
    case 'S': // SPI transfer - S<byte_hex>
    case 's': {
      if (currentMode != MODE_UART_ONLY) {
        uint8_t cmdByte = (uint8_t)strtol(&rxBuffer[1], NULL, 16);
        spi_select();
        uint8_t response = spi_transfer_byte(cmdByte);
        spi_deselect();
        uart_send_string("SPI TX: 0x");
        Serial.print(cmdByte, HEX);
        uart_send_string(" | RX: 0x");
        Serial.print(response, HEX);
        uart_send_string("\n");
      } else {
        uart_send_string("ERR: SPI désactivé (mode UART)\n");
      }
      break;
    }
    
    case 'M': // Mode - M<0|1|2>
    case 'm': {
      int mode = atoi(&rxBuffer[1]);
      if (mode >= 0 && mode <= 2) {
        currentMode = mode;
        uart_send_string("Mode: ");
        switch (mode) {
          case 0: uart_send_string("UART_ONLY\n"); break;
          case 1: uart_send_string("SPI_ONLY\n"); break;
          case 2: uart_send_string("BOTH\n"); break;
        }
      } else {
        uart_send_string("ERR: Mode 0=UART, 1=SPI, 2=BOTH\n");
      }
      break;
    }
    
    default:
      uart_send_string("ERR: Commande inconnue\n");
      uart_send_string("Commandes: P, R<i>, W<i>,<v>, T, S<hex>, M<m>\n");
      break;
  }
}

// ==================== SPI FUNCTIONS ====================
void spi_init(void) {
  pinMode(SPI_CS_PIN, OUTPUT);
  spi_deselect();
  
  SPI.begin();
  SPI.setClockDivider(SPI_CLOCK_DIV16);  // 1 MHz (16MHz/16)
  SPI.setDataMode(SPI_MODE0);             // CPOL=0, CPHA=0
  SPI.setBitOrder(MSBFIRST);
}

void spi_select(void) {
  digitalWrite(SPI_CS_PIN, LOW);
}

void spi_deselect(void) {
  digitalWrite(SPI_CS_PIN, HIGH);
}

uint8_t spi_transfer_byte(uint8_t data) {
  return SPI.transfer(data);
}

// Transfert multi-octets
void spi_transfer_buffer(uint8_t* txBuf, uint8_t* rxBuf, uint8_t len) {
  spi_select();
  for (uint8_t i = 0; i < len; i++) {
    rxBuf[i] = SPI.transfer(txBuf[i]);
  }
  spi_deselect();
}

// ==================== TABLE FUNCTIONS ====================
void table_init(void) {
  for (int i = 0; i < TABLE_SIZE; i++) {
    dataTable[i] = i * 100;  // Valeurs par défaut
  }
}

void table_print_all(void) {
  uart_send_string("\n=== Data Table ===");
  for (int i = 0; i < TABLE_SIZE; i++) {
    if (i % 4 == 0) uart_send_string("\n");
    uart_send_string("[");
    if (i < 10) uart_send_string(" ");
    Serial.print(i);
    uart_send_string("]=");
    if (dataTable[i] < 1000) uart_send_string(" ");
    if (dataTable[i] < 100) uart_send_string(" ");
    if (dataTable[i] < 10) uart_send_string(" ");
    uart_send_value(dataTable[i]);
    uart_send_string("  ");
  }
  uart_send_string("\n");
}
