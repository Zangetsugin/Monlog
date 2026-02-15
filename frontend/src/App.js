import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import {
  Upload, FileCode, Table2, Binary, Code2, FileText,
  Download, RefreshCw, Search, Settings, ChevronRight,
  Cpu, HardDrive, Gauge, Layers, Eye, Edit3, Save,
  ZoomIn, ZoomOut, Grid3X3, BarChart3, Box
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Tabs configuration
const TABS = [
  { id: 'hex', label: 'Hex Editor', icon: Binary },
  { id: 'maps', label: 'Maps 2D', icon: Grid3X3 },
  { id: 'maps3d', label: 'Maps 3D', icon: Box },
  { id: 'singles', label: 'Valeurs', icon: Gauge },
  { id: 'disasm', label: 'Désassembleur', icon: Code2 },
  { id: 'strings', label: 'Strings', icon: FileText },
];

function App() {
  const [activeTab, setActiveTab] = useState('hex');
  const [fileLoaded, setFileLoaded] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  // Data states
  const [hexData, setHexData] = useState([]);
  const [hexOffset, setHexOffset] = useState(0);
  const [maps, setMaps] = useState([]);
  const [selectedMap, setSelectedMap] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [singles, setSingles] = useState([]);
  const [disasmData, setDisasmData] = useState([]);
  const [disasmOffset, setDisasmOffset] = useState(0);
  const [strings, setStrings] = useState([]);

  // File upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setStatus('Chargement du fichier...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_URL}/api/upload`, formData);
      setFileInfo(res.data.info);
      setFileLoaded(true);
      setStatus('Fichier chargé avec succès!');
      
      // Load initial hex view
      loadHexView(0);
    } catch (err) {
      setStatus('Erreur: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Hex view
  const loadHexView = async (offset) => {
    try {
      const res = await axios.get(`${API_URL}/api/hex?offset=${offset}&length=512`);
      setHexData(res.data.data);
      setHexOffset(offset);
    } catch (err) {
      console.error(err);
    }
  };

  // Edit hex byte
  const editHexByte = async (offset, value) => {
    try {
      await axios.post(`${API_URL}/api/hex/edit`, { offset, value });
      loadHexView(hexOffset);
      setStatus(`Byte modifié @ 0x${offset.toString(16).toUpperCase()}`);
    } catch (err) {
      setStatus('Erreur modification');
    }
  };

  // Scan maps
  const scanMaps = async () => {
    setLoading(true);
    setStatus('Scan des maps...');
    try {
      const res = await axios.get(`${API_URL}/api/maps/scan`);
      setMaps(res.data.maps);
      setStatus(`${res.data.count} maps détectées`);
    } catch (err) {
      setStatus('Erreur scan');
    } finally {
      setLoading(false);
    }
  };

  // Load map
  const loadMap = async (map) => {
    setSelectedMap(map);
    try {
      const res = await axios.post(`${API_URL}/api/maps/get`, {
        offset: map.offset,
        rows: map.rows,
        cols: map.cols
      });
      setMapData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Edit map cell
  const editMapCell = async (row, col, value) => {
    if (!selectedMap || !mapData) return;
    try {
      await axios.post(`${API_URL}/api/maps/edit`, {
        offset: selectedMap.offset,
        row,
        col,
        value: parseInt(value),
        rows: selectedMap.rows,
        cols: selectedMap.cols
      });
      loadMap(selectedMap);
      setStatus(`Cellule [${row},${col}] modifiée`);
    } catch (err) {
      setStatus('Erreur modification');
    }
  };

  // Load singles
  const loadSingles = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/singles`);
      setSingles(res.data.values);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load disassembly
  const loadDisasm = async (offset) => {
    try {
      const res = await axios.get(`${API_URL}/api/disasm?offset=${offset}&count=100`);
      setDisasmData(res.data.instructions);
      setDisasmOffset(offset);
    } catch (err) {
      console.error(err);
    }
  };

  // Load strings
  const loadStrings = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/strings?min_length=4`);
      setStrings(res.data.strings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Download modified file
  const downloadFile = () => {
    window.open(`${API_URL}/api/download`, '_blank');
  };

  // Tab change handler
  useEffect(() => {
    if (!fileLoaded) return;
    
    switch (activeTab) {
      case 'hex':
        loadHexView(hexOffset);
        break;
      case 'maps':
      case 'maps3d':
        if (maps.length === 0) scanMaps();
        break;
      case 'singles':
        if (singles.length === 0) loadSingles();
        break;
      case 'disasm':
        if (disasmData.length === 0) loadDisasm(0);
        break;
      case 'strings':
        if (strings.length === 0) loadStrings();
        break;
    }
  }, [activeTab, fileLoaded]);

  // Color scale for map values
  const getMapCellColor = (value, min, max) => {
    if (max === min) return 'rgb(50, 50, 70)';
    const ratio = (value - min) / (max - min);
    
    // Blue -> Cyan -> Green -> Yellow -> Orange -> Red
    if (ratio < 0.2) {
      const t = ratio / 0.2;
      return `rgb(${Math.round(30 + t * 20)}, ${Math.round(60 + t * 80)}, ${Math.round(150 + t * 50)})`;
    } else if (ratio < 0.4) {
      const t = (ratio - 0.2) / 0.2;
      return `rgb(${Math.round(50 - t * 20)}, ${Math.round(140 + t * 60)}, ${Math.round(200 - t * 50)})`;
    } else if (ratio < 0.6) {
      const t = (ratio - 0.4) / 0.2;
      return `rgb(${Math.round(30 + t * 100)}, ${Math.round(200 - t * 20)}, ${Math.round(150 - t * 100)})`;
    } else if (ratio < 0.8) {
      const t = (ratio - 0.6) / 0.2;
      return `rgb(${Math.round(130 + t * 100)}, ${Math.round(180 - t * 60)}, ${Math.round(50 - t * 30)})`;
    } else {
      const t = (ratio - 0.8) / 0.2;
      return `rgb(${Math.round(230 + t * 25)}, ${Math.round(120 - t * 80)}, ${Math.round(20 + t * 20)})`;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <header className="h-14 bg-[#12121a] border-b border-[#2d2d3a] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Cpu className="w-6 h-6 text-cyan-400" />
          <h1 className="text-lg font-semibold text-white">ECU Calibration Tool</h1>
          <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">ME7.4.4</span>
        </div>
        
        <div className="flex items-center gap-4">
          {fileInfo && (
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <HardDrive className="w-4 h-4" />
                {fileInfo.size_kb?.toFixed(1)} KB
              </span>
              <span className="text-cyan-400">{fileInfo.ecu_type}</span>
            </div>
          )}
          
          {/* Upload button */}
          <label className="btn btn-primary cursor-pointer">
            <Upload className="w-4 h-4" />
            {fileLoaded ? 'Charger autre' : 'Charger .bin / .hex'}
            <input
              type="file"
              accept=".bin,.hex"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          
          {fileLoaded && (
            <button onClick={downloadFile} className="btn btn-success">
              <Download className="w-4 h-4" />
              Télécharger
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 bg-[#12121a] border-r border-[#2d2d3a] flex flex-col">
          <nav className="flex-1 py-2">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={!fileLoaded && tab.id !== 'hex'}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/10 text-cyan-400 border-r-2 border-cyan-400'
                    : 'text-gray-400 hover:bg-[#1a1a25] hover:text-white'
                } ${!fileLoaded && tab.id !== 'hex' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
          
          {/* Status */}
          <div className="p-4 border-t border-[#2d2d3a]">
            <div className="text-xs text-gray-500 mb-1">Status</div>
            <div className="text-sm text-gray-300 truncate">{status || 'Prêt'}</div>
            {loading && <div className="spinner mt-2" />}
          </div>
        </aside>

        {/* Content area */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {!fileLoaded ? (
            /* Welcome screen */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center animate-fadeIn">
                <Cpu className="w-20 h-20 text-cyan-400 mx-auto mb-6 opacity-50" />
                <h2 className="text-2xl font-semibold text-white mb-2">ECU Calibration Tool</h2>
                <p className="text-gray-400 mb-6">Bosch ME7.4.4 / ME7.4.5 - Little Endian 16-bit</p>
                <label className="btn btn-primary cursor-pointer text-lg px-8 py-3">
                  <Upload className="w-5 h-5" />
                  Charger un fichier .bin ou .hex
                  <input
                    type="file"
                    accept=".bin,.hex"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <div className="mt-8 text-sm text-gray-500">
                  <p>Supporte: Infineon C166 / ST10</p>
                  <p>PSA TU5JP4 • Peugeot 307 • Citroën</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Tab content */}
              <div className="flex-1 overflow-hidden p-4">
                {/* Hex Editor */}
                {activeTab === 'hex' && (
                  <HexEditor
                    data={hexData}
                    offset={hexOffset}
                    onOffsetChange={loadHexView}
                    onEdit={editHexByte}
                    fileSize={fileInfo?.size || 65536}
                  />
                )}

                {/* Maps 2D */}
                {activeTab === 'maps' && (
                  <Maps2DView
                    maps={maps}
                    selectedMap={selectedMap}
                    mapData={mapData}
                    onSelectMap={loadMap}
                    onScan={scanMaps}
                    onEditCell={editMapCell}
                    getColor={getMapCellColor}
                  />
                )}

                {/* Maps 3D */}
                {activeTab === 'maps3d' && (
                  <Maps3DView
                    maps={maps}
                    selectedMap={selectedMap}
                    mapData={mapData}
                    onSelectMap={loadMap}
                    onScan={scanMaps}
                  />
                )}

                {/* Singles */}
                {activeTab === 'singles' && (
                  <SinglesView singles={singles} onRefresh={loadSingles} />
                )}

                {/* Disassembler */}
                {activeTab === 'disasm' && (
                  <DisasmView
                    data={disasmData}
                    offset={disasmOffset}
                    onOffsetChange={loadDisasm}
                    fileSize={fileInfo?.size || 65536}
                  />
                )}

                {/* Strings */}
                {activeTab === 'strings' && (
                  <StringsView strings={strings} onRefresh={loadStrings} />
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ============ HEX EDITOR COMPONENT ============ */
function HexEditor({ data, offset, onOffsetChange, onEdit, fileSize }) {
  const [editingByte, setEditingByte] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [goToOffset, setGoToOffset] = useState('');

  const handleByteClick = (byteOffset, value) => {
    setEditingByte(byteOffset);
    setEditValue(value.toString(16).toUpperCase().padStart(2, '0'));
  };

  const handleByteEdit = (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(editValue, 16);
      if (!isNaN(val) && val >= 0 && val <= 255) {
        onEdit(editingByte, val);
      }
      setEditingByte(null);
    } else if (e.key === 'Escape') {
      setEditingByte(null);
    }
  };

  const goTo = () => {
    const off = parseInt(goToOffset, 16);
    if (!isNaN(off) && off >= 0 && off < fileSize) {
      onOffsetChange(off);
    }
  };

  return (
    <div className="h-full flex flex-col panel">
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-3 border-b border-[#2d2d3a]">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Aller à:</span>
          <input
            type="text"
            placeholder="0x0000"
            value={goToOffset}
            onChange={(e) => setGoToOffset(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goTo()}
            className="input w-24 font-mono text-sm"
          />
          <button onClick={goTo} className="btn btn-secondary">
            <Search className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOffsetChange(Math.max(0, offset - 512))}
            disabled={offset === 0}
            className="btn btn-secondary"
          >
            ← Précédent
          </button>
          <button
            onClick={() => onOffsetChange(Math.min(fileSize - 512, offset + 512))}
            disabled={offset + 512 >= fileSize}
            className="btn btn-secondary"
          >
            Suivant →
          </button>
        </div>
        
        <span className="text-sm text-gray-400 ml-auto">
          Offset: <span className="text-cyan-400 font-mono">0x{offset.toString(16).toUpperCase().padStart(4, '0')}</span>
          {' - '}
          <span className="text-cyan-400 font-mono">0x{Math.min(offset + 511, fileSize - 1).toString(16).toUpperCase().padStart(4, '0')}</span>
        </span>
      </div>

      {/* Hex view */}
      <div className="flex-1 overflow-auto p-4 font-mono text-sm">
        <div className="grid gap-1">
          {/* Header */}
          <div className="flex text-gray-500 text-xs pb-2 border-b border-[#2d2d3a]">
            <div className="w-20">Offset</div>
            <div className="flex-1 flex">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="w-7 text-center">{i.toString(16).toUpperCase()}</div>
              ))}
            </div>
            <div className="w-36 pl-4">ASCII</div>
          </div>

          {/* Data rows */}
          {data.map((row, idx) => (
            <div key={idx} className="flex items-center hover:bg-[#1a1a25]">
              <div className="w-20 text-cyan-400">
                {row.offset.toString(16).toUpperCase().padStart(8, '0')}
              </div>
              <div className="flex-1 flex">
                {row.hex.map((byte, i) => (
                  <div key={i} className="w-7">
                    {editingByte === byte.offset ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value.slice(0, 2))}
                        onKeyDown={handleByteEdit}
                        onBlur={() => setEditingByte(null)}
                        autoFocus
                        className="w-6 bg-cyan-500 text-black text-center rounded px-0"
                      />
                    ) : (
                      <span
                        onClick={() => handleByteClick(byte.offset, byte.value)}
                        className="hex-byte"
                      >
                        {byte.value.toString(16).toUpperCase().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="w-36 pl-4 text-gray-400">
                {row.ascii}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ MAPS 2D VIEW COMPONENT ============ */
function Maps2DView({ maps, selectedMap, mapData, onSelectMap, onScan, onEditCell, getColor }) {
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [customOffset, setCustomOffset] = useState('');
  const [customRows, setCustomRows] = useState('8');
  const [customCols, setCustomCols] = useState('8');

  const handleCellClick = (row, col, value) => {
    setEditingCell({ row, col });
    setEditValue(value.toString());
  };

  const handleCellEdit = (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(editValue);
      if (!isNaN(val) && val >= 0 && val <= 65535) {
        onEditCell(editingCell.row, editingCell.col, val);
      }
      setEditingCell(null);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const loadCustomMap = () => {
    const offset = parseInt(customOffset, 16);
    const rows = parseInt(customRows);
    const cols = parseInt(customCols);
    if (!isNaN(offset) && rows > 0 && cols > 0) {
      onSelectMap({ offset, rows, cols, name: `CUSTOM_${offset.toString(16).toUpperCase()}` });
    }
  };

  return (
    <div className="h-full flex gap-4">
      {/* Maps list */}
      <div className="w-72 panel flex flex-col">
        <div className="p-3 border-b border-[#2d2d3a] flex items-center justify-between">
          <h3 className="font-semibold text-white">Maps détectées</h3>
          <button onClick={onScan} className="btn btn-secondary text-xs py-1">
            <RefreshCw className="w-3 h-3" />
            Scan
          </button>
        </div>
        
        {/* Custom map input */}
        <div className="p-3 border-b border-[#2d2d3a] space-y-2">
          <div className="text-xs text-gray-400">Map manuelle:</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Offset (hex)"
              value={customOffset}
              onChange={(e) => setCustomOffset(e.target.value)}
              className="input text-xs flex-1 font-mono"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Lignes"
              value={customRows}
              onChange={(e) => setCustomRows(e.target.value)}
              className="input text-xs w-16"
            />
            <span className="text-gray-400">×</span>
            <input
              type="number"
              placeholder="Cols"
              value={customCols}
              onChange={(e) => setCustomCols(e.target.value)}
              className="input text-xs w-16"
            />
            <button onClick={loadCustomMap} className="btn btn-primary text-xs py-1 px-2">
              OK
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {maps.map((map, idx) => (
            <div
              key={idx}
              onClick={() => onSelectMap(map)}
              className={`p-3 border-b border-[#2d2d3a] cursor-pointer transition-colors ${
                selectedMap?.offset === map.offset
                  ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400'
                  : 'hover:bg-[#1a1a25]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-cyan-400 text-sm">
                  0x{map.offset.toString(16).toUpperCase().padStart(4, '0')}
                </span>
                <span className="text-xs text-gray-400">{map.rows}×{map.cols}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Min: {map.min} | Max: {map.max}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map viewer */}
      <div className="flex-1 panel flex flex-col">
        {mapData ? (
          <>
            <div className="p-3 border-b border-[#2d2d3a] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">{selectedMap?.name}</h3>
                <div className="text-xs text-gray-400">
                  Offset: 0x{selectedMap?.offset.toString(16).toUpperCase()} | 
                  {selectedMap?.rows}×{selectedMap?.cols} | 
                  Min: {mapData.min} | Max: {mapData.max}
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <div
                className="grid gap-px"
                style={{
                  gridTemplateColumns: `repeat(${mapData.cols}, minmax(45px, 1fr))`,
                }}
              >
                {mapData.data.map((row, ri) =>
                  row.map((value, ci) => (
                    <div
                      key={`${ri}-${ci}`}
                      className="map-cell h-8"
                      style={{ background: getColor(value, mapData.min, mapData.max) }}
                      onClick={() => handleCellClick(ri, ci, value)}
                    >
                      {editingCell?.row === ri && editingCell?.col === ci ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleCellEdit}
                          onBlur={() => setEditingCell(null)}
                          autoFocus
                        />
                      ) : (
                        <span className={value > (mapData.max + mapData.min) / 2 ? 'text-black' : 'text-white'}>
                          {value}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Grid3X3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Sélectionnez une map dans la liste</p>
              <p className="text-sm">ou créez une map manuelle</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ MAPS 3D VIEW COMPONENT ============ */
function Maps3DView({ maps, selectedMap, mapData, onSelectMap, onScan }) {
  return (
    <div className="h-full flex gap-4">
      {/* Maps list (same as 2D) */}
      <div className="w-72 panel flex flex-col">
        <div className="p-3 border-b border-[#2d2d3a] flex items-center justify-between">
          <h3 className="font-semibold text-white">Maps 3D</h3>
          <button onClick={onScan} className="btn btn-secondary text-xs py-1">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {maps.slice(0, 20).map((map, idx) => (
            <div
              key={idx}
              onClick={() => onSelectMap(map)}
              className={`p-3 border-b border-[#2d2d3a] cursor-pointer transition-colors ${
                selectedMap?.offset === map.offset
                  ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400'
                  : 'hover:bg-[#1a1a25]'
              }`}
            >
              <span className="font-mono text-cyan-400 text-sm">
                0x{map.offset.toString(16).toUpperCase()}
              </span>
              <span className="text-xs text-gray-400 ml-2">{map.rows}×{map.cols}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3D View */}
      <div className="flex-1 panel flex flex-col">
        {mapData ? (
          <>
            <div className="p-3 border-b border-[#2d2d3a]">
              <h3 className="font-semibold text-white">{selectedMap?.name} - Vue 3D</h3>
            </div>
            <div className="flex-1 relative bg-[#0a0a0f]">
              <Simple3DView data={mapData.data} min={mapData.min} max={mapData.max} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Box className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Sélectionnez une map pour la vue 3D</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Simple 3D visualization using CSS transforms */
function Simple3DView({ data, min, max }) {
  const rows = data.length;
  const cols = data[0]?.length || 0;
  
  const getHeight = (value) => {
    if (max === min) return 50;
    return 10 + ((value - min) / (max - min)) * 150;
  };

  const getColor = (value) => {
    if (max === min) return '#3b82f6';
    const ratio = (value - min) / (max - min);
    if (ratio < 0.5) {
      return `rgb(${Math.round(ratio * 2 * 255)}, ${Math.round(100 + ratio * 155)}, ${Math.round(255 - ratio * 155)})`;
    } else {
      return `rgb(255, ${Math.round(255 - (ratio - 0.5) * 2 * 200)}, ${Math.round((1 - ratio) * 100)})`;
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
      <div 
        className="relative"
        style={{
          transform: 'rotateX(55deg) rotateZ(-45deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {data.map((row, ri) =>
          row.map((value, ci) => (
            <div
              key={`${ri}-${ci}`}
              className="absolute transition-all duration-200"
              style={{
                width: '20px',
                height: `${getHeight(value)}px`,
                left: `${ci * 22}px`,
                top: `${ri * 22}px`,
                background: `linear-gradient(180deg, ${getColor(value)} 0%, ${getColor(value)}88 100%)`,
                transformOrigin: 'bottom',
                boxShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ============ SINGLES VIEW COMPONENT ============ */
function SinglesView({ singles, onRefresh }) {
  const [filter, setFilter] = useState('');
  
  const filtered = singles.filter(s => 
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    s.offset.toString(16).includes(filter.toLowerCase())
  );

  return (
    <div className="h-full panel flex flex-col">
      <div className="p-3 border-b border-[#2d2d3a] flex items-center gap-4">
        <h3 className="font-semibold text-white">Valeurs Singles</h3>
        <input
          type="text"
          placeholder="Filtrer..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input flex-1 max-w-xs"
        />
        <button onClick={onRefresh} className="btn btn-secondary">
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-sm text-gray-400">{filtered.length} valeurs</span>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-4 gap-2 p-4">
          {filtered.slice(0, 200).map((s, idx) => (
            <div key={idx} className="bg-[#1a1a25] rounded p-3 hover:bg-[#252535] transition-colors">
              <div className="text-xs text-cyan-400 font-mono">
                0x{s.offset.toString(16).toUpperCase().padStart(4, '0')}
              </div>
              <div className="text-lg font-semibold text-white mt-1">{s.value}</div>
              <div className="text-xs text-gray-500">
                0x{s.value.toString(16).toUpperCase().padStart(4, '0')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ DISASM VIEW COMPONENT ============ */
function DisasmView({ data, offset, onOffsetChange, fileSize }) {
  const [goToOffset, setGoToOffset] = useState('');

  const goTo = () => {
    const off = parseInt(goToOffset, 16);
    if (!isNaN(off) && off >= 0 && off < fileSize) {
      onOffsetChange(off);
    }
  };

  return (
    <div className="h-full panel flex flex-col">
      <div className="p-3 border-b border-[#2d2d3a] flex items-center gap-4">
        <h3 className="font-semibold text-white">Désassembleur C166/ST10</h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Offset (hex)"
            value={goToOffset}
            onChange={(e) => setGoToOffset(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goTo()}
            className="input w-24 font-mono text-sm"
          />
          <button onClick={goTo} className="btn btn-secondary">
            <Search className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOffsetChange(Math.max(0, offset - 100))}
            className="btn btn-secondary"
          >
            ← Prev
          </button>
          <button
            onClick={() => onOffsetChange(offset + 100)}
            className="btn btn-secondary"
          >
            Next →
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="disasm-line bg-[#1a1a25] sticky top-0 text-xs text-gray-500 font-semibold">
          <div>OFFSET</div>
          <div>BYTES</div>
          <div>MNEMONIC</div>
          <div>OPERANDS</div>
        </div>
        
        {data.map((inst, idx) => (
          <div key={idx} className="disasm-line">
            <div className="disasm-offset">
              {inst.offset.toString(16).toUpperCase().padStart(8, '0')}
            </div>
            <div className="disasm-bytes">{inst.bytes}</div>
            <div className="disasm-mnemonic">{inst.mnemonic}</div>
            <div className="disasm-operands">{inst.operands}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ STRINGS VIEW COMPONENT ============ */
function StringsView({ strings, onRefresh }) {
  const [filter, setFilter] = useState('');
  
  const filtered = strings.filter(s => 
    s.text.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="h-full panel flex flex-col">
      <div className="p-3 border-b border-[#2d2d3a] flex items-center gap-4">
        <h3 className="font-semibold text-white">Strings détectées</h3>
        <input
          type="text"
          placeholder="Rechercher..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input flex-1 max-w-xs"
        />
        <button onClick={onRefresh} className="btn btn-secondary">
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-sm text-gray-400">{filtered.length} strings</span>
      </div>
      
      <div className="flex-1 overflow-auto">
        {filtered.map((s, idx) => (
          <div key={idx} className="string-item">
            <div className="text-cyan-400">
              0x{s.offset.toString(16).toUpperCase().padStart(4, '0')}
            </div>
            <div className="text-white truncate">{s.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
