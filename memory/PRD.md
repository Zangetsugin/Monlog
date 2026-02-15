# Alien ECU Engine - PRD

## Projet
**Nom:** Alien ECU Engine  
**Version:** 1.0.0  
**Date:** 15 Janvier 2026

## Description
Logiciel de calibration ECU pour Bosch ME7.4.4/ME7.4.5 PSA (Peugeot 307, Citroën C4).
Architecture Little Endian 16-bit pour microcontrôleurs Infineon C166/ST10.

## User Personas
- **Préparateur moteur** : Modification de cartographies pour optimisation performances
- **Développeur ECU** : Analyse et reverse engineering de firmwares
- **Passionné automobile** : Apprentissage et exploration de données ECU

## Core Requirements
- [x] Lecture fichiers .bin et .hex
- [x] Vue Hex éditeur avec édition byte par byte
- [x] Maps 2D avec visualisation couleur et édition
- [x] Outils d'édition de maps (+, -, ×, %)
- [x] Export maps en CSV
- [x] Scan automatique de maps
- [x] Maps ME7.4.4 connues (KFZW, KFPED, LAMFA...)
- [x] Désassembleur C166/ST10 (~80 opcodes)
- [x] Détection de fonctions
- [x] Viewer de strings
- [x] Calcul de checksums (sum8, sum16, sum32, xor, crc16)
- [x] Système de définitions JSON
- [x] Détection automatique d'axes (RPM, Load, Temp...)

## What's Been Implemented (Jan 2026)
1. **Backend Python (FastAPI)**
   - Parser ME7 avec support Little Endian 16-bit
   - Désassembleur C166/ST10 complet
   - Gestionnaire de définitions JSON
   - Détecteur d'axes automatique
   - APIs REST complètes

2. **Frontend React**
   - Design "Alien" thème violet
   - Logo alien dans puce
   - 7 onglets (Hex, Maps 2D, Valeurs, Désassembleur, Fonctions, Strings, Checksum)
   - Visualisation maps avec gradient de couleurs
   - Affichage des axes détectés

3. **Définitions ME7.4.4 PSA**
   - 14 maps connues documentées
   - 6 valeurs scalaires
   - Axes prédéfinis (RPM, Load, Temp, Voltage)

## P0 - Critical (Done)
- [x] Upload/Download fichiers
- [x] Vue Hex éditeur
- [x] Maps 2D avec édition
- [x] Scan automatique

## P1 - Important (Done)
- [x] Désassembleur C166
- [x] Détection fonctions
- [x] Checksums
- [x] Export CSV

## P2 - Nice to Have (Done)
- [x] Définitions JSON
- [x] Détection axes
- [x] Maps connues ME7.4.4

## Backlog / Future
- [ ] Import de définitions externes (.xml WinOLS, .xdf TunerPro)
- [ ] Vue 3D des maps
- [ ] Comparaison de fichiers (diff)
- [ ] Correction automatique de checksum Bosch
- [ ] Support ME7.4.5, ME7.1.1
- [ ] Version desktop (Electron/Tauri)

## Fichiers Clés
- `/app/backend/server.py` - API FastAPI
- `/app/backend/ecu_parser.py` - Parser ME7
- `/app/backend/disassembler.py` - Désassembleur C166
- `/app/backend/definitions_manager.py` - Gestionnaire définitions
- `/app/backend/definitions/me744_psa.json` - Définitions ME7.4.4 PSA
- `/app/frontend/src/App.js` - Application React
