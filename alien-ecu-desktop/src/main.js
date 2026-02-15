const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');

let mainWindow;
let backendProcess;
let expressApp;
let server;

// ECU Parser and data storage
let currentFile = null;
let currentFilename = '';

// ============ EXPRESS BACKEND ============
function startExpressBackend() {
  expressApp = express();
  expressApp.use(cors());
  expressApp.use(express.json());
  
  const upload = multer({ storage: multer.memoryStorage() });
  
  // Status
  expressApp.get('/api/status', (req, res) => {
    res.json({
      status: 'running',
      file_loaded: currentFile !== null,
      filename: currentFilename,
      file_size: currentFile ? currentFile.length : 0
    });
  });
  
  // Upload
  expressApp.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    currentFile = req.file.buffer;
    currentFilename = req.file.originalname;
    
    // Parse file info
    const info = getFileInfo(currentFile);
    
    res.json({
      success: true,
      filename: currentFilename,
      size: currentFile.length,
      info: info
    });
  });
  
  // Hex view
  expressApp.get('/api/hex', (req, res) => {
    if (!currentFile) {
      return res.status(400).json({ error: 'No file loaded' });
    }
    
    const offset = parseInt(req.query.offset) || 0;
    const length = parseInt(req.query.length) || 512;
    
    const data = getHexView(currentFile, offset, length);
    res.json({
      offset,
      length,
      total_size: currentFile.length,
      data
    });
  });
  
  // Edit hex
  expressApp.post('/api/hex/edit', (req, res) => {
    if (!currentFile) {
      return res.status(400).json({ error: 'No file loaded' });
    }
    
    const { offset, value } = req.body;
    currentFile = Buffer.from(currentFile);
    currentFile[offset] = value & 0xFF;
    
    res.json({ success: true, offset, value });
  });
  
  // Strings
  expressApp.get('/api/strings', (req, res) => {
    if (!currentFile) {
      return res.status(400).json({ error: 'No file loaded' });
    }
    
    const minLength = parseInt(req.query.min_length) || 4;
    const strings = findStrings(currentFile, minLength);
    
    res.json({ count: strings.length, strings });
  });
  
  // Maps scan
  expressApp.get('/api/maps/scan', (req, res) => {
    if (!currentFile) {
      return res.status(400).json({ error: 'No file loaded' });
    }
    
    const maps = scanMaps(currentFile);
    res.json({ count: maps.length, maps });
  });
  
  // Get map
  expressApp.post('/api/maps/get', (req, res) => {
    if (!currentFile) {
      return res.status(400).json({ error: 'No file loaded' });
    }
    
    const { offset, rows, cols } = req.body;
    const map = getMapAtOffset(currentFile, offset, rows, cols);
    res.json(map);
  });
  
  // Edit map cell
  expressApp.post('/api/maps/edit', (req, res) => {
    if (!currentFile) {
      return res.status(400).json({ error: 'No file loaded' });
    }
    
    const { offset, row, col, value, rows, cols } = req.body;
    const cellOffset = offset + (row * cols + col) * 2;
    
    currentFile = Buffer.from(currentFile);
    currentFile.writeUInt16LE(value & 0xFFFF, cellOffset);
    
    res.json({ success: true, offset: cellOffset, value });
  });
  
  // Map operation
  expressApp.post('/api/maps/operation', (req, res) => {
    if (!currentFile) {
      return res.status(400).json({ error: 'No file loaded' });
    }
    
    const { offset, rows, cols, operation, value } = req.body;
    currentFile = applyMapOperation(currentFile, offset, rows, cols, operation, value);
    
    const map = getMapAtOffset(currentFile, offset, rows, cols);
    res.json({ success: true, operation, value, map });
  });
  
  // Export CSV
  expressApp.get('/api/maps/export', (req, res) => {
    if (!currentFile) {
      return res.status(400).json({ error: 'No file loaded' });
    }
    
    const offset = parseInt(req.query.offset);
    const rows = parseInt(req.query.rows);
    const cols = parseInt(req.query.cols);
    
    const csv = exportMapCSV(currentFile, offset, rows, cols);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=map_${offset.toString(16)}.csv`);
    res.send(csv);
  });
  
  // Known maps
  expressApp.get('/api/maps/known', (req, res) => {
    res.json({ maps: KNOWN_MAPS });
  });
  
  // Singles
  expressApp.get('/api/singles', (req, res) => {
    if (!currentFile) {
      return res.status(400).json({ error: 'No file loaded' });
    }
    
    const singles = scanSingles(currentFile);
    res.json({ count: singles.length, values: singles });
  });
  
  // Checksum
  expressApp.get('/api/checksum', (req, res) => {
    if (!currentFile) {
      return res.status(400).json({ error: 'No file loaded' });
    }
    
    const checksums = calculateChecksums(currentFile);
    res.json(checksums);
  });
  
  // Disassembly
  expressApp.get('/api/disasm', (req, res) => {
    if (!currentFile) {
      return res.status(400).json({ error: 'No file loaded' });
    }
    
    const offset = parseInt(req.query.offset) || 0;
    const count = parseInt(req.query.count) || 50;
    
    const instructions = disassemble(currentFile, offset, count);
    res.json({ offset, count: instructions.length, instructions });
  });
  
  // Functions
  expressApp.get('/api/functions', (req, res) => {
    if (!currentFile) {
      return res.status(400).json({ error: 'No file loaded' });
    }
    
    const functions = detectFunctions(currentFile);
    res.json({ count: functions.length, functions });
  });
  
  // Download
  expressApp.get('/api/download', (req, res) => {
    if (!currentFile) {
      return res.status(400).json({ error: 'No file loaded' });
    }
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=modified_${currentFilename}`);
    res.send(currentFile);
  });
  
  // Serve frontend
  expressApp.use(express.static(path.join(__dirname, 'frontend')));
  expressApp.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
  });
  
  server = expressApp.listen(8001, () => {
    console.log('Backend running on port 8001');
  });
}

// ============ ECU PARSER FUNCTIONS ============
const KNOWN_MAPS = [
  { name: 'KFZW', description: 'Ignition timing base map', category: 'Ignition', rows: 16, cols: 16, unit: '°KW' },
  { name: 'KFZW2', description: 'Ignition timing map 2', category: 'Ignition', rows: 16, cols: 16, unit: '°KW' },
  { name: 'LAMFA', description: 'Lambda target map', category: 'Fuel', rows: 16, cols: 16, unit: 'Lambda' },
  { name: 'KFPED', description: 'Pedal characteristic', category: 'Pedal', rows: 8, cols: 8, unit: '%' },
  { name: 'KFMIOP', description: 'Optimal torque map', category: 'Torque', rows: 16, cols: 16, unit: 'Nm' },
  { name: 'LAMSPTG', description: 'Lambda setpoint', category: 'Fuel', rows: 12, cols: 12, unit: 'Lambda' },
  { name: 'TVUB', description: 'Injection voltage correction', category: 'Injection', rows: 8, cols: 1, unit: 'ms' },
  { name: 'KFAGR', description: 'EGR valve map', category: 'EGR', rows: 16, cols: 16, unit: '%' },
];

function readWord(buffer, offset) {
  if (offset + 1 >= buffer.length) return 0;
  return buffer.readUInt16LE(offset);
}

function getFileInfo(buffer) {
  let ecuType = 'Unknown';
  let manufacturer = '';
  
  if (buffer[0] === 0x5A && buffer[1] === 0x5A) {
    ecuType = 'Bosch ME7.x';
  }
  
  const strings = findStrings(buffer, 4);
  for (const s of strings) {
    if (s.text.includes('P244') || s.text.includes('D244')) {
      manufacturer = 'PSA (Peugeot/Citroën)';
      ecuType = 'Bosch ME7.4.4';
    }
  }
  
  return {
    size: buffer.length,
    size_kb: buffer.length / 1024,
    ecu_type: ecuType,
    manufacturer,
    endian: 'Little Endian',
    word_size: 16
  };
}

function getHexView(buffer, offset, length) {
  const rows = [];
  for (let i = offset; i < Math.min(offset + length, buffer.length); i += 16) {
    const chunk = buffer.slice(i, Math.min(i + 16, buffer.length));
    const hexBytes = [];
    for (let j = 0; j < chunk.length; j++) {
      hexBytes.push({ offset: i + j, value: chunk[j] });
    }
    const ascii = Array.from(chunk).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
    rows.push({ offset: i, hex: hexBytes, ascii });
  }
  return rows;
}

function findStrings(buffer, minLength) {
  const strings = [];
  let current = '';
  let startOffset = 0;
  
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    if (b >= 32 && b < 127) {
      if (!current) startOffset = i;
      current += String.fromCharCode(b);
    } else {
      if (current.length >= minLength) {
        strings.push({ offset: startOffset, text: current, length: current.length });
      }
      current = '';
    }
  }
  
  if (current.length >= minLength) {
    strings.push({ offset: startOffset, text: current, length: current.length });
  }
  
  return strings;
}

function scanMaps(buffer) {
  const maps = [];
  const sizes = [[8, 8], [16, 16], [8, 16], [16, 8], [12, 12]];
  const checked = new Set();
  
  for (const [rows, cols] of sizes) {
    const sizeBytes = rows * cols * 2;
    
    for (let offset = 0; offset < buffer.length - sizeBytes; offset += 2) {
      if (Array.from(checked).some(o => Math.abs(offset - o) < 32)) continue;
      
      const values = [];
      for (let i = 0; i < rows * cols; i++) {
        values.push(readWord(buffer, offset + i * 2));
      }
      
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      if (min === max) continue;
      if (values.filter(v => v === 0xFFFF).length > values.length / 3) continue;
      if (values.filter(v => v === 0).length > values.length * 2 / 3) continue;
      
      // Check monotonicity
      let monotonic = 0;
      for (let r = 0; r < rows; r++) {
        const row = values.slice(r * cols, (r + 1) * cols);
        const inc = row.every((v, i) => i === 0 || v >= row[i-1]);
        const dec = row.every((v, i) => i === 0 || v <= row[i-1]);
        if (inc || dec) monotonic++;
      }
      
      if (monotonic >= Math.max(1, rows / 4)) {
        maps.push({
          offset,
          rows,
          cols,
          name: `MAP_${offset.toString(16).toUpperCase().padStart(4, '0')}`,
          description: `Auto-detected ${rows}x${cols} map`,
          min,
          max,
          avg: values.reduce((a, b) => a + b, 0) / values.length
        });
        checked.add(offset);
      }
    }
  }
  
  maps.sort((a, b) => a.offset - b.offset);
  return maps.slice(0, 100);
}

function getMapAtOffset(buffer, offset, rows, cols) {
  const data = [];
  const values = [];
  
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const val = readWord(buffer, offset + (r * cols + c) * 2);
      row.push(val);
      values.push(val);
    }
    data.push(row);
  }
  
  return {
    offset,
    rows,
    cols,
    name: `MAP_${offset.toString(16).toUpperCase().padStart(4, '0')}`,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    data,
    x_axis: Array.from({ length: cols }, (_, i) => i),
    y_axis: Array.from({ length: rows }, (_, i) => i)
  };
}

function applyMapOperation(buffer, offset, rows, cols, operation, value) {
  buffer = Buffer.from(buffer);
  
  for (let i = 0; i < rows * cols; i++) {
    const cellOffset = offset + i * 2;
    let current = readWord(buffer, cellOffset);
    let newVal;
    
    switch (operation) {
      case 'add': newVal = current + value; break;
      case 'subtract': newVal = current - value; break;
      case 'multiply': newVal = current * value; break;
      case 'divide': newVal = value !== 0 ? current / value : current; break;
      case 'percent': newVal = current * (1 + value / 100); break;
      default: newVal = current;
    }
    
    newVal = Math.max(0, Math.min(65535, Math.round(newVal)));
    buffer.writeUInt16LE(newVal, cellOffset);
  }
  
  return buffer;
}

function exportMapCSV(buffer, offset, rows, cols) {
  let csv = `# Map at offset 0x${offset.toString(16)}\n`;
  csv += `# Size: ${rows}x${cols}\n\n`;
  csv += ',' + Array.from({ length: cols }, (_, i) => i).join(',') + '\n';
  
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push(readWord(buffer, offset + (r * cols + c) * 2));
    }
    csv += r + ',' + row.join(',') + '\n';
  }
  
  return csv;
}

function scanSingles(buffer) {
  const singles = [];
  
  for (let offset = 0; offset < buffer.length - 2; offset += 2) {
    const value = readWord(buffer, offset);
    
    if (value > 0 && value < 0xFFF0) {
      const prev = offset >= 2 ? readWord(buffer, offset - 2) : 0;
      const next = offset + 2 < buffer.length ? readWord(buffer, offset + 2) : 0;
      
      if (Math.abs(value - prev) > 100 || Math.abs(value - next) > 100) {
        singles.push({
          offset,
          value,
          name: `VAL_${offset.toString(16).toUpperCase().padStart(4, '0')}`,
          size: 2
        });
      }
    }
  }
  
  return singles.slice(0, 500);
}

function calculateChecksums(buffer) {
  let sum8 = 0, sum16 = 0, xor8 = 0, xor16 = 0;
  
  for (let i = 0; i < buffer.length; i++) {
    sum8 = (sum8 + buffer[i]) & 0xFF;
    xor8 ^= buffer[i];
  }
  
  for (let i = 0; i < buffer.length - 1; i += 2) {
    const word = readWord(buffer, i);
    sum16 = (sum16 + word) & 0xFFFF;
    xor16 ^= word;
  }
  
  return { sum8, sum16, xor8, xor16, file_size: buffer.length };
}

// Simple C166 disassembler
const OPCODES = {
  0x00: ['ADD', 2], 0x20: ['SUB', 2], 0x40: ['CMP', 2], 0x50: ['AND', 2],
  0x60: ['OR', 2], 0x70: ['XOR', 2], 0xC2: ['PUSH', 2], 0xCC: ['POP', 2],
  0xDB: ['RET', 2], 0xE6: ['MOV', 4], 0xFC: ['NOP', 2], 0xCA: ['CALLA', 4],
  0xDA: ['CALLS', 4], 0xD7: ['CALLR', 2]
};

function disassemble(buffer, startOffset, count) {
  const instructions = [];
  let offset = startOffset;
  
  while (instructions.length < count && offset < buffer.length) {
    const opcode = buffer[offset];
    const info = OPCODES[opcode] || ['DB', 1];
    const [mnemonic, size] = info;
    
    const bytes = [];
    for (let i = 0; i < size && offset + i < buffer.length; i++) {
      bytes.push(buffer[offset + i].toString(16).toUpperCase().padStart(2, '0'));
    }
    
    let operands = '';
    if (size === 4 && offset + 3 < buffer.length) {
      const addr = readWord(buffer, offset + 2);
      operands = `0x${addr.toString(16).toUpperCase().padStart(4, '0')}`;
    } else if (size === 2 && offset + 1 < buffer.length) {
      const reg = buffer[offset + 1];
      operands = `R${reg & 0xF}, R${(reg >> 4) & 0xF}`;
    }
    
    instructions.push({
      offset,
      bytes: bytes.join(' '),
      mnemonic,
      operands,
      comment: '',
      is_branch: ['CALLA', 'CALLS', 'CALLR', 'RET'].includes(mnemonic)
    });
    
    offset += size;
  }
  
  return instructions;
}

function detectFunctions(buffer) {
  const functions = [];
  
  for (let offset = 0; offset < buffer.length - 4; offset += 2) {
    const opcode = buffer[offset];
    
    // Look for PUSH or common function prologues
    if (opcode === 0xC2) {
      const next = buffer[offset + 2];
      if (next === 0xC2 || next === 0xE6) {
        functions.push({
          offset,
          name: `sub_${offset.toString(16).toUpperCase().padStart(4, '0')}`,
          size: 0
        });
      }
    }
  }
  
  return functions.slice(0, 100);
}

// ============ ELECTRON WINDOW ============
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'default',
    backgroundColor: '#0a0a0f'
  });
  
  // Custom menu
  const menuTemplate = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Ouvrir fichier...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [{ name: 'ECU Files', extensions: ['bin', 'hex'] }]
            });
            if (!result.canceled && result.filePaths.length > 0) {
              // Load file via the web interface
              mainWindow.webContents.executeJavaScript(`
                fetch('http://localhost:8001/api/upload', {
                  method: 'POST',
                  body: (() => {
                    const fd = new FormData();
                    // This won't work directly, need file input
                    return fd;
                  })()
                });
              `);
            }
          }
        },
        { type: 'separator' },
        { label: 'Quitter', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'toggleDevTools', label: 'Outils développeur' },
        { type: 'separator' },
        { role: 'zoomIn', label: 'Zoom +' },
        { role: 'zoomOut', label: 'Zoom -' },
        { role: 'resetZoom', label: 'Zoom 100%' }
      ]
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'À propos',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Alien ECU Engine',
              message: 'Alien ECU Engine v1.0.0',
              detail: 'Logiciel de calibration ECU\nBosch ME7.4.4 / ME7.4.5\n\n© 2026 Alien ECU Team'
            });
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
  
  mainWindow.loadURL('http://localhost:8001');
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startExpressBackend();
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
