# Alien ECU Engine - Desktop Version

## Installation

### Prérequis
- Node.js 18+
- npm ou yarn

### Installation des dépendances
```bash
npm install
```

### Lancement en développement
```bash
npm start
```

### Build pour Windows
```bash
npm run build:win
```
Le fichier `.exe` sera dans le dossier `dist/`

### Build pour Mac
```bash
npm run build:mac
```

### Build pour Linux
```bash
npm run build:linux
```

## Structure
```
alien-ecu-desktop/
├── src/
│   ├── main.js          # Process principal Electron + Backend
│   └── frontend/        # Interface React (à copier depuis /app/frontend/build)
├── assets/
│   └── icon.png         # Icône application
├── package.json
└── README.md
```

## Fonctionnalités
- Lecture fichiers .bin et .hex
- Vue Hex éditeur
- Maps 2D avec édition
- Désassembleur C166/ST10
- Checksums
- Export CSV

## Notes
Cette version embarque le backend Node.js/Express directement dans Electron.
Pas besoin de Python pour la version desktop.
