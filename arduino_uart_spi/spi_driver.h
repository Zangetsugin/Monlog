/*
 * spi_driver.h - Driver SPI bas niveau pour AVR/Arduino
 * Compatible ATmega328P (Arduino Uno)
 */

#ifndef SPI_DRIVER_H
#define SPI_DRIVER_H

#include <stdint.h>
#include <avr/io.h>

#ifdef __cplusplus
extern "C" {
#endif

// ==================== CONFIGURATION PINS ====================
// Arduino Uno SPI pins:
// MOSI = PB3 (pin 11)
// MISO = PB4 (pin 12)
// SCK  = PB5 (pin 13)
// SS   = PB2 (pin 10) - utilisé comme CS

#define SPI_DDR     DDRB
#define SPI_PORT    PORTB
#define SPI_MOSI    PB3
#define SPI_MISO    PB4
#define SPI_SCK     PB5
#define SPI_SS      PB2

// ==================== MODES SPI ====================
#define SPI_MODE_0  0x00  // CPOL=0, CPHA=0
#define SPI_MODE_1  0x04  // CPOL=0, CPHA=1
#define SPI_MODE_2  0x08  // CPOL=1, CPHA=0
#define SPI_MODE_3  0x0C  // CPOL=1, CPHA=1

// ==================== CLOCK DIVIDERS ====================
#define SPI_CLOCK_DIV2    0x04
#define SPI_CLOCK_DIV4    0x00
#define SPI_CLOCK_DIV8    0x05
#define SPI_CLOCK_DIV16   0x01
#define SPI_CLOCK_DIV32   0x06
#define SPI_CLOCK_DIV64   0x02
#define SPI_CLOCK_DIV128  0x03

// ==================== BIT ORDER ====================
#define SPI_MSB_FIRST   0
#define SPI_LSB_FIRST   1

// ==================== STRUCTURES ====================
typedef struct {
    uint8_t mode;       // SPI_MODE_0 à SPI_MODE_3
    uint8_t clock_div;  // Diviseur d'horloge
    uint8_t bit_order;  // MSB ou LSB first
} spi_config_t;

// ==================== PROTOTYPES ====================

/**
 * @brief Initialise le SPI en mode Master avec config par défaut
 */
void spi_drv_init(void);

/**
 * @brief Initialise le SPI avec configuration personnalisée
 * @param config Structure de configuration
 */
void spi_drv_init_config(spi_config_t* config);

/**
 * @brief Configure le mode SPI
 * @param mode SPI_MODE_0 à SPI_MODE_3
 */
void spi_drv_set_mode(uint8_t mode);

/**
 * @brief Configure la vitesse SPI
 * @param divider Diviseur d'horloge
 */
void spi_drv_set_clock(uint8_t divider);

/**
 * @brief Active le chip select (LOW)
 */
void spi_drv_cs_low(void);

/**
 * @brief Désactive le chip select (HIGH)
 */
void spi_drv_cs_high(void);

/**
 * @brief Transfère un octet (full-duplex)
 * @param data Octet à envoyer
 * @return Octet reçu
 */
uint8_t spi_drv_transfer(uint8_t data);

/**
 * @brief Transfère plusieurs octets
 * @param tx_data Buffer d'envoi
 * @param rx_data Buffer de réception (peut être NULL)
 * @param length Nombre d'octets
 */
void spi_drv_transfer_buffer(uint8_t* tx_data, uint8_t* rx_data, uint8_t length);

/**
 * @brief Envoie un octet (ignore la réponse)
 * @param data Octet à envoyer
 */
void spi_drv_write(uint8_t data);

/**
 * @brief Lit un octet (envoie 0x00)
 * @return Octet lu
 */
uint8_t spi_drv_read(void);

/**
 * @brief Désactive le SPI
 */
void spi_drv_end(void);

#ifdef __cplusplus
}
#endif

#endif // SPI_DRIVER_H
