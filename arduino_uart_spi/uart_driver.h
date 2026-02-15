/*
 * uart_driver.h - Driver UART bas niveau pour AVR/Arduino
 * Compatible ATmega328P (Arduino Uno)
 */

#ifndef UART_DRIVER_H
#define UART_DRIVER_H

#include <stdint.h>
#include <avr/io.h>
#include <avr/interrupt.h>

#ifdef __cplusplus
extern "C" {
#endif

// ==================== CONFIGURATION ====================
#define UART_BAUD       115200UL
#define F_CPU_VAL       16000000UL
#define UBRR_VALUE      ((F_CPU_VAL / (16UL * UART_BAUD)) - 1)

// Taille des buffers circulaires
#define UART_RX_BUFFER_SIZE   64
#define UART_TX_BUFFER_SIZE   64

// ==================== STRUCTURES ====================
typedef struct {
    volatile uint8_t buffer[UART_RX_BUFFER_SIZE];
    volatile uint8_t head;
    volatile uint8_t tail;
} uart_rx_buffer_t;

typedef struct {
    volatile uint8_t buffer[UART_TX_BUFFER_SIZE];
    volatile uint8_t head;
    volatile uint8_t tail;
} uart_tx_buffer_t;

// ==================== PROTOTYPES ====================

/**
 * @brief Initialise l'UART avec le baud rate configuré
 */
void uart_drv_init(void);

/**
 * @brief Vérifie si des données sont disponibles
 * @return Nombre d'octets disponibles
 */
uint8_t uart_drv_available(void);

/**
 * @brief Lit un octet (bloquant si buffer vide)
 * @return Octet lu
 */
uint8_t uart_drv_read(void);

/**
 * @brief Lit un octet (non bloquant)
 * @param data Pointeur pour stocker l'octet
 * @return 1 si succès, 0 si buffer vide
 */
uint8_t uart_drv_read_nonblock(uint8_t* data);

/**
 * @brief Envoie un octet
 * @param data Octet à envoyer
 */
void uart_drv_write(uint8_t data);

/**
 * @brief Envoie une chaîne de caractères
 * @param str Chaîne à envoyer (null-terminated)
 */
void uart_drv_print(const char* str);

/**
 * @brief Envoie un entier en décimal
 * @param value Valeur à envoyer
 */
void uart_drv_print_int(int16_t value);

/**
 * @brief Envoie un entier en hexadécimal
 * @param value Valeur à envoyer
 */
void uart_drv_print_hex(uint8_t value);

/**
 * @brief Vide le buffer de transmission
 */
void uart_drv_flush(void);

#ifdef __cplusplus
}
#endif

#endif // UART_DRIVER_H
