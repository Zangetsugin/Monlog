# Arduino UART & SPI Communication

## 📋 Description
Projet de communication UART et SPI pour Arduino Uno en C.
Permet de modifier et lire des valeurs en temps réel via le port série.

## 🔧 Configuration

| Paramètre | Valeur |
|-----------|--------|
| UART Baud | 115200 |
| SPI Clock | 1 MHz (DIV16) |
| SPI Mode | Mode 0 (CPOL=0, CPHA=0) |
| CS Pin | D10 |

## 📁 Fichiers

```
arduino_uart_spi/
├── arduino_uart_spi.ino  # Sketch principal (ouvrir avec Arduino IDE)
├── uart_driver.h/.c      # Driver UART bas niveau (optionnel)
├── spi_driver.h/.c       # Driver SPI bas niveau (optionnel)
└── README.md
```

## 🚀 Installation

1. Ouvrir `arduino_uart_spi.ino` avec Arduino IDE
2. Sélectionner **Board: Arduino Uno**
3. Sélectionner le port COM
4. Cliquer sur **Upload**

## 💻 Commandes UART

Ouvrir le **Moniteur Série** (115200 baud, Newline):

| Commande | Description | Exemple |
|----------|-------------|---------|
| `P` | Ping (test connexion) | `P` → `PONG` |
| `R<idx>` | Lire valeur à l'index | `R5` → `[R5] = 500` |
| `W<idx>,<val>` | Écrire valeur | `W3,1234` → `[W3] <- 1234 OK` |
| `T` | Afficher toute la table | `T` → tableau complet |
| `S<hex>` | Envoyer commande SPI | `S55` → `SPI TX: 0x55 \| RX: 0xFF` |
| `M<mode>` | Changer mode | `M0`=UART, `M1`=SPI, `M2`=BOTH |

## 📊 Table de Données

- 16 valeurs uint16_t (0-65535)
- Index 0 à 15
- Modifiable en temps réel via UART

## 🔌 Connexions SPI

| Arduino Pin | Fonction | Périphérique |
|-------------|----------|-------------|
| D10 | CS (SS) | Chip Select |
| D11 | MOSI | Data Out |
| D12 | MISO | Data In |
| D13 | SCK | Clock |

## 📝 Exemple Session

```
=== Arduino UART/SPI Ready ===
Mode: BOTH | Baud: 115200

> P
PONG

> T
=== Data Table ===
[ 0]=   0  [ 1]= 100  [ 2]= 200  [ 3]= 300
[ 4]= 400  [ 5]= 500  [ 6]= 600  [ 7]= 700
[ 8]= 800  [ 9]= 900  [10]=1000  [11]=1100
[12]=1200  [13]=1300  [14]=1400  [15]=1500

> W5,9999
[W5] <- 9999 OK

> R5
[R5] = 9999

> S55
SPI TX: 0x55 | RX: 0x00
```

## 🔧 Utilisation Avancée (Drivers C Purs)

Les fichiers `uart_driver.c/h` et `spi_driver.c/h` sont des drivers bas niveau utilisant directement les registres AVR. Ils peuvent être utilisés:

1. **Avec Arduino IDE**: Inclure dans le sketch
2. **Avec avr-gcc**: Compiler directement

```c
// Exemple avec driver UART pur
#include "uart_driver.h"

void setup() {
    uart_drv_init();
    uart_drv_print("Hello!\n");
}

void loop() {
    if (uart_drv_available()) {
        uint8_t data = uart_drv_read();
        uart_drv_print("Reçu: ");
        uart_drv_print_hex(data);
        uart_drv_print("\n");
    }
}
```

## 📜 Licence
MIT - Libre d'utilisation
