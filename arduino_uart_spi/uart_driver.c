/*
 * uart_driver.c - Implémentation driver UART pour AVR/Arduino
 * Utilise les interruptions pour RX/TX non-bloquant
 */

#include "uart_driver.h"
#include <string.h>

// ==================== VARIABLES GLOBALES ====================
static uart_rx_buffer_t rx_buf = {{0}, 0, 0};
static uart_tx_buffer_t tx_buf = {{0}, 0, 0};

// ==================== INTERRUPTIONS ====================

// Interruption réception UART
ISR(USART_RX_vect) {
    uint8_t data = UDR0;
    uint8_t next_head = (rx_buf.head + 1) % UART_RX_BUFFER_SIZE;
    
    // Stocker si buffer non plein
    if (next_head != rx_buf.tail) {
        rx_buf.buffer[rx_buf.head] = data;
        rx_buf.head = next_head;
    }
}

// Interruption transmission UART (buffer vide)
ISR(USART_UDRE_vect) {
    if (tx_buf.head != tx_buf.tail) {
        UDR0 = tx_buf.buffer[tx_buf.tail];
        tx_buf.tail = (tx_buf.tail + 1) % UART_TX_BUFFER_SIZE;
    } else {
        // Plus de données, désactiver l'interruption TX
        UCSR0B &= ~(1 << UDRIE0);
    }
}

// ==================== FONCTIONS ====================

void uart_drv_init(void) {
    // Configurer baud rate
    UBRR0H = (uint8_t)(UBRR_VALUE >> 8);
    UBRR0L = (uint8_t)(UBRR_VALUE);
    
    // Activer TX et RX + interruption RX
    UCSR0B = (1 << RXEN0) | (1 << TXEN0) | (1 << RXCIE0);
    
    // Format: 8 bits données, 1 bit stop, pas de parité
    UCSR0C = (1 << UCSZ01) | (1 << UCSZ00);
    
    // Activer interruptions globales
    sei();
}

uint8_t uart_drv_available(void) {
    return (UART_RX_BUFFER_SIZE + rx_buf.head - rx_buf.tail) % UART_RX_BUFFER_SIZE;
}

uint8_t uart_drv_read(void) {
    // Attendre données
    while (rx_buf.head == rx_buf.tail);
    
    uint8_t data = rx_buf.buffer[rx_buf.tail];
    rx_buf.tail = (rx_buf.tail + 1) % UART_RX_BUFFER_SIZE;
    return data;
}

uint8_t uart_drv_read_nonblock(uint8_t* data) {
    if (rx_buf.head == rx_buf.tail) {
        return 0;  // Buffer vide
    }
    
    *data = rx_buf.buffer[rx_buf.tail];
    rx_buf.tail = (rx_buf.tail + 1) % UART_RX_BUFFER_SIZE;
    return 1;
}

void uart_drv_write(uint8_t data) {
    uint8_t next_head = (tx_buf.head + 1) % UART_TX_BUFFER_SIZE;
    
    // Attendre si buffer plein
    while (next_head == tx_buf.tail);
    
    tx_buf.buffer[tx_buf.head] = data;
    tx_buf.head = next_head;
    
    // Activer interruption TX
    UCSR0B |= (1 << UDRIE0);
}

void uart_drv_print(const char* str) {
    while (*str) {
        uart_drv_write(*str++);
    }
}

void uart_drv_print_int(int16_t value) {
    char buf[7];
    int8_t i = 0;
    uint8_t neg = 0;
    
    if (value < 0) {
        neg = 1;
        value = -value;
    }
    
    do {
        buf[i++] = '0' + (value % 10);
        value /= 10;
    } while (value > 0);
    
    if (neg) {
        uart_drv_write('-');
    }
    
    while (i > 0) {
        uart_drv_write(buf[--i]);
    }
}

void uart_drv_print_hex(uint8_t value) {
    const char hex[] = "0123456789ABCDEF";
    uart_drv_write(hex[(value >> 4) & 0x0F]);
    uart_drv_write(hex[value & 0x0F]);
}

void uart_drv_flush(void) {
    // Attendre que le buffer TX soit vide
    while (tx_buf.head != tx_buf.tail);
    // Attendre que le dernier octet soit envoyé
    while (!(UCSR0A & (1 << TXC0)));
}
