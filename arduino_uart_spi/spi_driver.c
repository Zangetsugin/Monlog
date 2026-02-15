/*
 * spi_driver.c - Implémentation driver SPI pour AVR/Arduino
 * Mode Master uniquement
 */

#include "spi_driver.h"

// ==================== FONCTIONS ====================

void spi_drv_init(void) {
    // Configuration par défaut
    spi_config_t default_config = {
        .mode = SPI_MODE_0,
        .clock_div = SPI_CLOCK_DIV16,  // 1 MHz sur Arduino 16MHz
        .bit_order = SPI_MSB_FIRST
    };
    spi_drv_init_config(&default_config);
}

void spi_drv_init_config(spi_config_t* config) {
    // Configurer pins: MOSI, SCK, SS en sortie
    SPI_DDR |= (1 << SPI_MOSI) | (1 << SPI_SCK) | (1 << SPI_SS);
    // MISO en entrée
    SPI_DDR &= ~(1 << SPI_MISO);
    
    // SS HIGH par défaut (désactivé)
    spi_drv_cs_high();
    
    // Configuration SPCR:
    // SPE  = SPI Enable
    // MSTR = Master mode
    uint8_t spcr = (1 << SPE) | (1 << MSTR);
    
    // Mode SPI (CPOL, CPHA)
    spcr |= (config->mode & 0x0C);
    
    // Bit order
    if (config->bit_order == SPI_LSB_FIRST) {
        spcr |= (1 << DORD);
    }
    
    // Clock divider (bits SPR0, SPR1)
    spcr |= (config->clock_div & 0x03);
    
    SPCR = spcr;
    
    // SPI2X bit dans SPSR pour doubler la vitesse
    if (config->clock_div & 0x04) {
        SPSR |= (1 << SPI2X);
    } else {
        SPSR &= ~(1 << SPI2X);
    }
}

void spi_drv_set_mode(uint8_t mode) {
    SPCR = (SPCR & ~0x0C) | (mode & 0x0C);
}

void spi_drv_set_clock(uint8_t divider) {
    SPCR = (SPCR & ~0x03) | (divider & 0x03);
    if (divider & 0x04) {
        SPSR |= (1 << SPI2X);
    } else {
        SPSR &= ~(1 << SPI2X);
    }
}

void spi_drv_cs_low(void) {
    SPI_PORT &= ~(1 << SPI_SS);
}

void spi_drv_cs_high(void) {
    SPI_PORT |= (1 << SPI_SS);
}

uint8_t spi_drv_transfer(uint8_t data) {
    SPDR = data;
    // Attendre fin de transmission
    while (!(SPSR & (1 << SPIF)));
    return SPDR;
}

void spi_drv_transfer_buffer(uint8_t* tx_data, uint8_t* rx_data, uint8_t length) {
    for (uint8_t i = 0; i < length; i++) {
        uint8_t received = spi_drv_transfer(tx_data[i]);
        if (rx_data != NULL) {
            rx_data[i] = received;
        }
    }
}

void spi_drv_write(uint8_t data) {
    SPDR = data;
    while (!(SPSR & (1 << SPIF)));
}

uint8_t spi_drv_read(void) {
    return spi_drv_transfer(0x00);
}

void spi_drv_end(void) {
    SPCR &= ~(1 << SPE);  // Désactiver SPI
}
