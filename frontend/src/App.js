import React, { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Upload, FileCode, Table2, Binary, Code2, FileText,
  Download, RefreshCw, Search, Settings, ChevronRight,
  Cpu, HardDrive, Gauge, Layers, Eye, Edit3, Save,
  ZoomIn, ZoomOut, Grid3X3, BarChart3, Box, Plus, Minus,
  Percent, X, Check, FileDown, Hash, Target, GitBranch,
  GripVertical, HelpCircle, FileUp, Pencil, Grid, Waves,
  ChevronLeft, ChevronRight as ChevronRightIcon, MapPin
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Alien Logo SVG Component
const AlienLogo = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="25" width="60" height="50" rx="5" fill="#1a1a2e" stroke="#8b5cf6" strokeWidth="2"/>
    <rect x="25" y="15" width="4" height="12" fill="#8b5cf6"/>
    <rect x="35" y="15" width="4" height="12" fill="#8b5cf6"/>
    <rect x="45" y="15" width="4" height="12" fill="#8b5cf6"/>
    <rect x="55" y="15" width="4" height="12" fill="#8b5cf6"/>
    <rect x="65" y="15" width="4" height="12" fill="#8b5cf6"/>
    <rect x="25" y="73" width="4" height="12" fill="#8b5cf6"/>
    <rect x="35" y="73" width="4" height="12" fill="#8b5cf6"/>
    <rect x="45" y="73" width="4" height="12" fill="#8b5cf6"/>
    <rect x="55" y="73" width="4" height="12" fill="#8b5cf6"/>
    <rect x="65" y="73" width="4" height="12" fill="#8b5cf6"/>
    <rect x="10" y="35" width="12" height="4" fill="#8b5cf6"/>
    <rect x="10" y="45" width="12" height="4" fill="#8b5cf6"/>
    <rect x="10" y="55" width="12" height="4" fill="#8b5cf6"/>
    <rect x="78" y="35" width="12" height="4" fill="#8b5cf6"/>
    <rect x="78" y="45" width="12" height="4" fill="#8b5cf6"/>
    <rect x="78" y="55" width="12" height="4" fill="#8b5cf6"/>
    <ellipse cx="50" cy="48" rx="18" ry="20" fill="#a855f7"/>
    <ellipse cx="42" cy="45" rx="6" ry="8" fill="#0f0f1a"/>
    <ellipse cx="58" cy="45" rx="6" ry="8" fill="#0f0f1a"/>
    <ellipse cx="40" cy="43" rx="2" ry="3" fill="#c4b5fd"/>
    <ellipse cx="56" cy="43" rx="2" ry="3" fill="#c4b5fd"/>
  </svg>
);

// Resizable Panel Component - IMPROVED with offset for grip
const ResizablePanel = ({ children, defaultWidth, minWidth = 200, maxWidth = 600, side = 'left' }) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);

  const startResize = useCallback((e) => {
    setIsResizing(true);
    e.preventDefault();
    e.stopPropagation();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      let newWidth = side === 'left' ? e.clientX - rect.left : rect.right - e.clientX;
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(newWidth);
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, minWidth, maxWidth, side]);

  return (
    <div ref={panelRef} className="relative flex" style={{ width: `${width}px`, minWidth: `${minWidth}px` }}>
      <div className="flex-1 overflow-hidden">{children}</div>
      {/* Grip décalé de 12px vers l'extérieur */}
      <div
        className={`absolute top-0 ${side === 'left' ? '-right-3' : '-left-3'} w-6 h-full cursor-col-resize flex items-center justify-center z-20`}
        onMouseDown={startResize}
      >
        <div className="w-1 h-16 bg-purple-500/30 rounded-full hover:bg-purple-500/60 transition-colors" />
      </div>
    </div>
  );
};

// Offset Slider Component
const OffsetSlider = ({ value, max, onChange, step = 512 }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-xs text-purple-400/60 w-16">0x0000</span>
      <div className="flex-1 relative h-6 flex items-center">
        <input
          type="range"
          min={0}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full h-2 bg-purple-900/30 rounded-lg appearance-none cursor-pointer slider-alien"
        />
        <div 
          className="absolute top-1/2 -translate-y-1/2 h-2 bg-purple-500/50 rounded-l-lg pointer-events-none"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-purple-400/60 w-16 text-right">0x{max.toString(16).toUpperCase()}</span>
    </div>
  );
};

// Tabs configuration
const TABS = [
  { id: 'hex', label: 'Hex Editor', icon: Binary },
  { id: 'maps', label: 'Maps 2D', icon: Grid3X3 },
  { id: 'singles', label: 'Valeurs', icon: Gauge },
  { id: 'disasm', label: 'Désassembleur', icon: Code2 },
  { id: 'functions', label: 'Fonctions', icon: GitBranch },
  { id: 'strings', label: 'Strings', icon: FileText },
  { id: 'checksum', label: 'Checksum', icon: Hash },
];

function App() {
  const [activeTab, setActiveTab] = useState('hex');
  const [fileLoaded, setFileLoaded] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // Data states
  const [hexData, setHexData] = useState([]);
  const [hexOffset, setHexOffset] = useState(0);
  const [maps, setMaps] = useState([]);
  const [knownMaps, setKnownMaps] = useState([]);
  const [selectedMap, setSelectedMap] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [singles, setSingles] = useState([]);
  const [disasmData, setDisasmData] = useState([]);
  const [disasmOffset, setDisasmOffset] = useState(0);
  const [functions, setFunctions] = useState([]);
  const [strings, setStrings] = useState([]);
  const [checksums, setChecksums] = useState(null);
  const [xdfMaps, setXdfMaps] = useState([]);

  // File upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.xdf')) {
      handleXdfImport(file);
      return;
    }

    setLoading(true);
    setStatus('Chargement du fichier...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_URL}/api/upload`, formData);
      setFileInfo(res.data.info);
      setFileLoaded(true);
      setStatus('Fichier chargé avec succès!');
      setMaps([]);
      setSingles([]);
      setDisasmData([]);
      setFunctions([]);
      setStrings([]);
      loadHexView(0);
    } catch (err) {
      setStatus('Erreur: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // XDF Import
  const handleXdfImport = async (file) => {
    setLoading(true);
    setStatus('Import XDF...');
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      const tables = xml.querySelectorAll('XDFTABLE');
      const importedMaps = [];
      
      tables.forEach((table) => {
        const title = table.querySelector('title')?.textContent || 'Unknown';
        const address = table.querySelector('XDFAXIS[id="z"] EMBEDDEDDATA')?.getAttribute('mmedaddress');
        const rows = parseInt(table.querySelector('XDFAXIS[id="y"]')?.getAttribute('indexcount') || '1');
        const cols = parseInt(table.querySelector('XDFAXIS[id="x"]')?.getAttribute('indexcount') || '1');
        
        if (address) {
          importedMaps.push({
            name: title,
            offset: parseInt(address, 16),
            rows: rows || 8,
            cols: cols || 8,
            description: `Imported from XDF`,
            category: 'XDF Import'
          });
        }
      });
      
      setXdfMaps(importedMaps);
      setStatus(`${importedMaps.length} maps importées depuis XDF`);
    } catch (err) {
      setStatus('Erreur import XDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Navigation functions
  const goToHexOffset = (offset) => {
    setHexOffset(offset);
    loadHexView(offset);
    setActiveTab('hex');
  };

  const goToMapOffset = (offset) => {
    const map = { offset, rows: 8, cols: 8, name: `MAP_${offset.toString(16).toUpperCase()}` };
    setSelectedMap(map);
    loadMap(map);
    setActiveTab('maps');
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
      const [scanned, known] = await Promise.all([
        axios.get(`${API_URL}/api/maps/scan`),
        axios.get(`${API_URL}/api/maps/known`)
      ]);
      const allMaps = [...scanned.data.maps, ...xdfMaps];
      setMaps(allMaps);
      setKnownMaps(known.data.maps || []);
      setStatus(`${allMaps.length} maps détectées`);
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
      setStatus(`Cellule [${row},${col}] = ${value}`);
    } catch (err) {
      setStatus('Erreur modification');
    }
  };

  // Apply map operation
  const applyMapOperation = async (operation, value) => {
    if (!selectedMap) return;
    try {
      const res = await axios.post(`${API_URL}/api/maps/operation`, {
        offset: selectedMap.offset,
        rows: selectedMap.rows,
        cols: selectedMap.cols,
        operation,
        value
      });
      setMapData(res.data.map);
      setStatus(`Opération ${operation} appliquée`);
    } catch (err) {
      setStatus('Erreur opération');
    }
  };

  // Export map CSV
  const exportMapCSV = () => {
    if (!selectedMap) return;
    window.open(`${API_URL}/api/maps/export?offset=${selectedMap.offset}&rows=${selectedMap.rows}&cols=${selectedMap.cols}`, '_blank');
  };

  // Load other data
  const loadSingles = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/singles`);
      setSingles(res.data.values);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadDisasm = async (offset) => {
    try {
      const res = await axios.get(`${API_URL}/api/disasm?offset=${offset}&count=100`);
      setDisasmData(res.data.instructions);
      setDisasmOffset(offset);
    } catch (err) { console.error(err); }
  };

  const loadFunctions = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/functions`);
      setFunctions(res.data.functions);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadStrings = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/strings?min_length=4`);
      setStrings(res.data.strings);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadChecksums = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/checksum`);
      setChecksums(res.data);
    } catch (err) { console.error(err); }
  };

  const downloadFile = () => {
    window.open(`${API_URL}/api/download`, '_blank');
  };

  // Tab change handler
  useEffect(() => {
    if (!fileLoaded) return;
    switch (activeTab) {
      case 'hex': loadHexView(hexOffset); break;
      case 'maps': if (maps.length === 0) scanMaps(); break;
      case 'singles': if (singles.length === 0) loadSingles(); break;
      case 'disasm': if (disasmData.length === 0) loadDisasm(0); break;
      case 'functions': if (functions.length === 0) loadFunctions(); break;
      case 'strings': if (strings.length === 0) loadStrings(); break;
      case 'checksum': loadChecksums(); break;
      default: break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, fileLoaded]);

  // Color scale for map
  const getMapCellColor = (value, min, max) => {
    if (max === min) return 'rgb(50, 50, 70)';
    const ratio = (value - min) / (max - min);
    if (ratio < 0.25) return `rgb(${Math.round(30 + ratio*200)}, ${Math.round(30 + ratio*120)}, ${Math.round(80 + ratio*280)})`;
    if (ratio < 0.5) return `rgb(${Math.round(80 + (ratio-0.25)*240)}, ${Math.round(60)}, ${Math.round(150 + (ratio-0.25)*120)})`;
    if (ratio < 0.75) return `rgb(${Math.round(140 + (ratio-0.5)*240)}, ${Math.round(40 + (ratio-0.5)*160)}, ${Math.round(180 - (ratio-0.5)*120)})`;
    return `rgb(${Math.round(200 + (ratio-0.75)*160)}, ${Math.round(80 + (ratio-0.75)*320)}, ${Math.round(150 - (ratio-0.75)*200)})`;
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <header className="h-14 bg-gradient-to-r from-[#12121a] to-[#1a1525] border-b border-purple-900/30 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <AlienLogo className="w-10 h-10" />
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">Alien ECU Engine</h1>
            <span className="text-[10px] text-purple-400/60">ME7.4.4 / ME7.4.5</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {fileInfo && (
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1"><HardDrive className="w-4 h-4 text-purple-400" />{fileInfo.size_kb?.toFixed(1)} KB</span>
              <span className="text-purple-300">{fileInfo.ecu_type}</span>
            </div>
          )}
          
          <button onClick={() => setShowHelp(!showHelp)} className="btn-alien-sm" title="Aide"><HelpCircle className="w-4 h-4" /></button>
          
          <label className="btn-alien-sm cursor-pointer" title="Importer XDF">
            <FileUp className="w-4 h-4" />XDF
            <input type="file" accept=".xdf" onChange={handleFileUpload} className="hidden" />
          </label>
          
          <label className="btn-alien cursor-pointer">
            <Upload className="w-4 h-4" />{fileLoaded ? 'Charger autre' : 'Charger .bin / .hex'}
            <input type="file" accept=".bin,.hex" onChange={handleFileUpload} className="hidden" />
          </label>
          
          {fileLoaded && (
            <button onClick={downloadFile} className="btn-alien-success">
              <Download className="w-4 h-4" />Sauvegarder
            </button>
          )}
        </div>
      </header>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHelp(false)}>
          <div className="bg-[#12121a] border border-purple-500/30 rounded-lg p-6 max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-purple-300 mb-4">Guide d'utilisation</h2>
            <div className="space-y-3 text-sm text-purple-200/80">
              <p><strong className="text-purple-400">📁 Charger:</strong> Cliquez sur "Charger .bin" pour ouvrir votre dump ECU</p>
              <p><strong className="text-purple-400">📊 Éditer map:</strong> Cliquez sur une cellule, tapez la valeur, Entrée pour valider</p>
              <p><strong className="text-purple-400">🔧 Outils:</strong> Boutons +/-/×/% pour modifier toute la map</p>
              <p><strong className="text-purple-400">📈 Vue filaire:</strong> Bouton "Filaire" pour voir la map en 3D</p>
              <p><strong className="text-purple-400">🔍 Strings:</strong> 2 boutons pour aller voir l'adresse en Hex ou Maps 2D</p>
              <p><strong className="text-purple-400">📏 Slider:</strong> Utilisez le slider pour naviguer dans tout le fichier</p>
              <p><strong className="text-purple-400">↔️ Redimensionner:</strong> Glissez la barre violette entre les panneaux</p>
            </div>
            <button onClick={() => setShowHelp(false)} className="btn-alien mt-4 w-full justify-center">Compris !</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 bg-gradient-to-b from-[#12121a] to-[#0f0f18] border-r border-purple-900/20 flex flex-col">
          <nav className="flex-1 py-2">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={!fileLoaded && tab.id !== 'hex'}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-purple-500/10 text-purple-300 border-r-2 border-purple-500'
                    : 'text-gray-400 hover:bg-purple-500/5 hover:text-purple-200'
                } ${!fileLoaded && tab.id !== 'hex' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <tab.icon className="w-4 h-4" />{tab.label}
              </button>
            ))}
          </nav>
          
          {xdfMaps.length > 0 && (
            <div className="px-4 py-2 border-t border-purple-900/20">
              <div className="text-xs text-green-400">✓ {xdfMaps.length} maps XDF</div>
            </div>
          )}
          
          <div className="p-4 border-t border-purple-900/20">
            <div className="text-xs text-purple-400/50 mb-1">Status</div>
            <div className="text-sm text-purple-200 truncate">{status || 'Prêt'}</div>
            {loading && <div className="spinner-alien mt-2" />}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {!fileLoaded ? (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#0f0f18] to-[#1a1025]">
              <div className="text-center animate-fadeIn">
                <AlienLogo className="w-32 h-32 mx-auto mb-6 animate-float" />
                <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-purple-300 bg-clip-text text-transparent mb-2">Alien ECU Engine</h2>
                <p className="text-purple-300/60 mb-8">Bosch ME7.4.4 / ME7.4.5 - Little Endian 16-bit</p>
                <div className="flex gap-4 justify-center">
                  <label className="btn-alien-large cursor-pointer">
                    <Upload className="w-5 h-5" />Charger .bin / .hex
                    <input type="file" accept=".bin,.hex" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden p-4">
              {activeTab === 'hex' && (
                <HexEditor
                  data={hexData}
                  offset={hexOffset}
                  onOffsetChange={(o) => { setHexOffset(o); loadHexView(o); }}
                  onEdit={editHexByte}
                  fileSize={fileInfo?.size || 65536}
                />
              )}
              {activeTab === 'maps' && (
                <Maps2DView
                  maps={maps}
                  knownMaps={knownMaps}
                  xdfMaps={xdfMaps}
                  selectedMap={selectedMap}
                  mapData={mapData}
                  onSelectMap={loadMap}
                  onScan={scanMaps}
                  onEditCell={editMapCell}
                  onOperation={applyMapOperation}
                  onExport={exportMapCSV}
                  getColor={getMapCellColor}
                  fileSize={fileInfo?.size || 65536}
                />
              )}
              {activeTab === 'singles' && <SinglesView singles={singles} onRefresh={loadSingles} />}
              {activeTab === 'disasm' && (
                <DisasmView data={disasmData} offset={disasmOffset} onOffsetChange={loadDisasm} fileSize={fileInfo?.size || 65536} />
              )}
              {activeTab === 'functions' && (
                <FunctionsView functions={functions} onRefresh={loadFunctions} onGoTo={(o) => { setActiveTab('disasm'); loadDisasm(o); }} />
              )}
              {activeTab === 'strings' && (
                <StringsView strings={strings} onRefresh={loadStrings} onGoToHex={goToHexOffset} onGoToMap={goToMapOffset} />
              )}
              {activeTab === 'checksum' && <ChecksumView checksums={checksums} onRefresh={loadChecksums} />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ============ HEX EDITOR ============ */
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
      if (!isNaN(val) && val >= 0 && val <= 255) onEdit(editingByte, val);
      setEditingByte(null);
    } else if (e.key === 'Escape') setEditingByte(null);
  };

  const goTo = () => {
    const off = parseInt(goToOffset, 16);
    if (!isNaN(off) && off >= 0 && off < fileSize) onOffsetChange(off);
  };

  return (
    <div className="h-full flex flex-col panel-alien">
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-3 border-b border-purple-900/20 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-purple-300/60">Aller à:</span>
          <input type="text" placeholder="0x0000" value={goToOffset} onChange={(e) => setGoToOffset(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goTo()} className="input-alien w-24 font-mono text-sm" />
          <button onClick={goTo} className="btn-alien-sm"><Search className="w-4 h-4" /></button>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => onOffsetChange(Math.max(0, offset - 512))} disabled={offset === 0} className="btn-alien-sm">
            <ChevronLeft className="w-4 h-4" /> Préc
          </button>
          <button onClick={() => onOffsetChange(Math.min(fileSize - 512, offset + 512))} disabled={offset + 512 >= fileSize} className="btn-alien-sm">
            Suiv <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
        
        <span className="text-sm text-purple-300/60">
          <span className="text-purple-300 font-mono">0x{offset.toString(16).toUpperCase().padStart(4, '0')}</span>
        </span>
      </div>

      {/* Slider de défilement total */}
      <div className="px-4 py-2 border-b border-purple-900/20 bg-purple-500/5">
        <OffsetSlider value={offset} max={Math.max(0, fileSize - 512)} onChange={onOffsetChange} step={256} />
      </div>

      {/* Hex data */}
      <div className="flex-1 overflow-auto p-4 font-mono text-sm">
        <div className="grid gap-1">
          <div className="flex text-purple-400/50 text-xs pb-2 border-b border-purple-900/20">
            <div className="w-20">Offset</div>
            <div className="flex-1 flex">
              {[...Array(16)].map((_, i) => <div key={i} className="w-7 text-center">{i.toString(16).toUpperCase()}</div>)}
            </div>
            <div className="w-36 pl-4">ASCII</div>
          </div>

          {data.map((row, idx) => (
            <div key={idx} className="flex items-center hover:bg-purple-500/5 rounded">
              <div className="w-20 text-purple-400">{row.offset.toString(16).toUpperCase().padStart(8, '0')}</div>
              <div className="flex-1 flex">
                {row.hex.map((byte, i) => (
                  <div key={i} className="w-7">
                    {editingByte === byte.offset ? (
                      <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value.slice(0, 2).toUpperCase())}
                        onKeyDown={handleByteEdit} onBlur={() => setEditingByte(null)} autoFocus
                        className="w-6 bg-purple-500 text-black text-center rounded px-0 font-mono" />
                    ) : (
                      <span onClick={() => handleByteClick(byte.offset, byte.value)} className="hex-byte-alien"
                        title={`Dec: ${byte.value}`}>
                        {byte.value.toString(16).toUpperCase().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="w-36 pl-4 text-purple-300/40">{row.ascii}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ MAPS 2D VIEW ============ */
function Maps2DView({ maps, knownMaps, xdfMaps, selectedMap, mapData, onSelectMap, onScan, onEditCell, onOperation, onExport, getColor, fileSize }) {
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [customOffset, setCustomOffset] = useState('');
  const [customRows, setCustomRows] = useState('8');
  const [customCols, setCustomCols] = useState('8');
  const [showTools, setShowTools] = useState(false);
  const [operationValue, setOperationValue] = useState('');
  const [viewMode, setViewMode] = useState('values'); // 'values' or 'wireframe'
  const [mapsOffset, setMapsOffset] = useState(0);

  const handleCellClick = (row, col, value) => {
    setEditingCell({ row, col });
    setEditValue(value.toString());
  };

  const handleCellEdit = (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(editValue);
      if (!isNaN(val) && val >= 0 && val <= 65535) onEditCell(editingCell.row, editingCell.col, val);
      setEditingCell(null);
    } else if (e.key === 'Escape') setEditingCell(null);
  };

  const loadCustomMap = () => {
    const offset = parseInt(customOffset, 16);
    const rows = parseInt(customRows);
    const cols = parseInt(customCols);
    if (!isNaN(offset) && rows > 0 && cols > 0) {
      onSelectMap({ offset, rows, cols, name: `CUSTOM_${offset.toString(16).toUpperCase()}` });
    }
  };

  // Navigate maps by offset
  const navigateMaps = (direction) => {
    if (!selectedMap) return;
    const step = selectedMap.rows * selectedMap.cols * 2;
    const newOffset = direction === 'next' 
      ? Math.min(selectedMap.offset + step, fileSize - step)
      : Math.max(0, selectedMap.offset - step);
    onSelectMap({ ...selectedMap, offset: newOffset, name: `MAP_${newOffset.toString(16).toUpperCase()}` });
  };

  const allMaps = [...maps];

  return (
    <div className="h-full flex gap-2">
      {/* Maps list */}
      <ResizablePanel defaultWidth={300} minWidth={220} maxWidth={450} side="left">
        <div className="h-full panel-alien flex flex-col">
          <div className="p-3 border-b border-purple-900/20 flex items-center justify-between">
            <h3 className="font-semibold text-purple-200">Maps ({allMaps.length})</h3>
            <button onClick={onScan} className="btn-alien-sm"><RefreshCw className="w-3 h-3" /> Scan</button>
          </div>
          
          {/* Known maps */}
          {(knownMaps.length > 0 || xdfMaps.length > 0) && (
            <div className="p-2 border-b border-purple-900/20 max-h-24 overflow-auto">
              <div className="flex flex-wrap gap-1">
                {knownMaps.slice(0, 6).map((m, idx) => (
                  <span key={`k${idx}`} className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">{m.name}</span>
                ))}
                {xdfMaps.slice(0, 6).map((m, idx) => (
                  <span key={`x${idx}`} className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded cursor-pointer"
                    onClick={() => onSelectMap(m)}>{m.name.substring(0, 12)}</span>
                ))}
              </div>
            </div>
          )}
          
          {/* Custom map */}
          <div className="p-3 border-b border-purple-900/20 space-y-2">
            <div className="text-xs text-purple-400/50">Map manuelle:</div>
            <input type="text" placeholder="Offset hex" value={customOffset} onChange={(e) => setCustomOffset(e.target.value)}
              className="input-alien text-xs w-full font-mono" />
            <div className="flex gap-2 items-center">
              <input type="number" value={customRows} onChange={(e) => setCustomRows(e.target.value)} className="input-alien text-xs w-14" />
              <span className="text-purple-400/50">×</span>
              <input type="number" value={customCols} onChange={(e) => setCustomCols(e.target.value)} className="input-alien text-xs w-14" />
              <button onClick={loadCustomMap} className="btn-alien-sm px-3">OK</button>
            </div>
          </div>
          
          {/* Maps list */}
          <div className="flex-1 overflow-auto">
            {allMaps.map((map, idx) => (
              <div key={idx} onClick={() => onSelectMap(map)}
                className={`p-3 border-b border-purple-900/10 cursor-pointer transition-all ${
                  selectedMap?.offset === map.offset ? 'bg-purple-500/10 border-l-2 border-l-purple-500' : 'hover:bg-purple-500/5'
                }`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-purple-400 text-sm">0x{map.offset.toString(16).toUpperCase().padStart(4, '0')}</span>
                  <span className="text-xs text-purple-300/50">{map.rows}×{map.cols}</span>
                </div>
                {map.name && !map.name.startsWith('MAP_') && <div className="text-xs text-green-400 truncate">{map.name}</div>}
                <div className="text-xs text-purple-400/40">Min: {map.min} | Max: {map.max}</div>
              </div>
            ))}
          </div>
        </div>
      </ResizablePanel>

      {/* Map viewer */}
      <div className="flex-1 panel-alien flex flex-col ml-4">
        {mapData ? (
          <>
            <div className="p-3 border-b border-purple-900/20 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-purple-200">{selectedMap?.name || 'Map'}</h3>
                <div className="text-xs text-purple-400/50">
                  0x{selectedMap?.offset.toString(16).toUpperCase()} | {selectedMap?.rows}×{selectedMap?.cols} | Min: {mapData.min} | Max: {mapData.max}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* View toggle */}
                <button onClick={() => setViewMode(viewMode === 'values' ? 'wireframe' : 'values')}
                  className={`btn-alien-sm ${viewMode === 'wireframe' ? 'bg-purple-500/30' : ''}`}>
                  {viewMode === 'values' ? <><Waves className="w-4 h-4" /> Filaire</> : <><Grid className="w-4 h-4" /> Valeurs</>}
                </button>
                <button onClick={() => setShowTools(!showTools)} className={`btn-alien-sm ${showTools ? 'bg-purple-500/30' : ''}`}>
                  <Settings className="w-4 h-4" /> Outils
                </button>
                <button onClick={onExport} className="btn-alien-sm"><FileDown className="w-4 h-4" /> CSV</button>
              </div>
            </div>
            
            {/* Navigation slider + buttons */}
            <div className="px-3 py-2 border-b border-purple-900/20 bg-purple-500/5 flex items-center gap-4">
              <button onClick={() => navigateMaps('prev')} className="btn-alien-sm"><ChevronLeft className="w-4 h-4" /> Préc</button>
              <div className="flex-1">
                <OffsetSlider 
                  value={selectedMap?.offset || 0} 
                  max={fileSize - (selectedMap?.rows || 8) * (selectedMap?.cols || 8) * 2} 
                  onChange={(o) => onSelectMap({ ...selectedMap, offset: o, name: `MAP_${o.toString(16).toUpperCase()}` })}
                  step={selectedMap?.rows * selectedMap?.cols * 2 || 128}
                />
              </div>
              <button onClick={() => navigateMaps('next')} className="btn-alien-sm">Suiv <ChevronRightIcon className="w-4 h-4" /></button>
            </div>
            
            {/* Tools panel */}
            {showTools && (
              <div className="p-3 border-b border-purple-900/20 bg-purple-500/5">
                <div className="text-xs text-purple-400/50 mb-2">Modifier toute la map:</div>
                <div className="flex gap-2 items-center flex-wrap">
                  <input type="number" placeholder="Valeur" value={operationValue} onChange={(e) => setOperationValue(e.target.value)}
                    className="input-alien text-sm w-24" />
                  <button onClick={() => onOperation('add', parseFloat(operationValue))} className="btn-alien-sm"><Plus className="w-4 h-4" /></button>
                  <button onClick={() => onOperation('subtract', parseFloat(operationValue))} className="btn-alien-sm"><Minus className="w-4 h-4" /></button>
                  <button onClick={() => onOperation('multiply', parseFloat(operationValue))} className="btn-alien-sm">×</button>
                  <button onClick={() => onOperation('percent', parseFloat(operationValue))} className="btn-alien-sm"><Percent className="w-4 h-4" /></button>
                </div>
              </div>
            )}
            
            {/* Map display */}
            <div className="flex-1 overflow-auto p-4">
              {viewMode === 'values' ? (
                /* Values view */
                <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${mapData.cols}, minmax(48px, 1fr))` }}>
                  {mapData.data.map((row, ri) =>
                    row.map((value, ci) => (
                      <div key={`${ri}-${ci}`} className="map-cell-alien h-9 text-xs"
                        style={{ background: getColor(value, mapData.min, mapData.max) }}
                        onClick={() => handleCellClick(ri, ci, value)}
                        title={`[${ri},${ci}] = ${value}`}>
                        {editingCell?.row === ri && editingCell?.col === ci ? (
                          <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleCellEdit} onBlur={() => setEditingCell(null)} autoFocus
                            className="w-full h-full bg-white text-black text-center font-mono text-xs" />
                        ) : (
                          <span className="text-white font-mono drop-shadow">{value}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Wireframe 3D view */
                <div className="w-full h-full flex items-center justify-center">
                  <Wireframe3D data={mapData.data} min={mapData.min} max={mapData.max} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-purple-400/40">
            <div className="text-center">
              <Grid3X3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Sélectionnez une map</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ WIREFRAME 3D VIEW ============ */
function Wireframe3D({ data, min, max }) {
  const rows = data.length;
  const cols = data[0]?.length || 0;
  
  const getHeight = (value) => {
    if (max === min) return 50;
    return 20 + ((value - min) / (max - min)) * 120;
  };

  const getColor = (value) => {
    const ratio = (value - min) / (max - min);
    return `hsl(${270 - ratio * 60}, 70%, ${40 + ratio * 30}%)`;
  };

  return (
    <div className="relative" style={{ transform: 'perspective(800px) rotateX(50deg) rotateZ(-30deg)', transformStyle: 'preserve-3d' }}>
      <svg width={cols * 30 + 100} height={rows * 25 + 150} className="overflow-visible">
        {/* Grid lines */}
        {data.map((row, ri) => (
          <g key={`row-${ri}`}>
            {row.map((value, ci) => {
              const x = ci * 28 + ri * 12;
              const y = ri * 20 - getHeight(value);
              const nextX = ci < cols - 1 ? (ci + 1) * 28 + ri * 12 : null;
              const nextY = ci < cols - 1 ? ri * 20 - getHeight(row[ci + 1]) : null;
              const belowX = ri < rows - 1 ? ci * 28 + (ri + 1) * 12 : null;
              const belowY = ri < rows - 1 ? (ri + 1) * 20 - getHeight(data[ri + 1][ci]) : null;
              
              return (
                <g key={`${ri}-${ci}`}>
                  {/* Horizontal line */}
                  {nextX !== null && (
                    <line x1={x + 50} y1={y + 100} x2={nextX + 50} y2={nextY + 100}
                      stroke={getColor(value)} strokeWidth="1.5" opacity="0.8" />
                  )}
                  {/* Vertical line */}
                  {belowX !== null && (
                    <line x1={x + 50} y1={y + 100} x2={belowX + 50} y2={belowY + 100}
                      stroke={getColor(value)} strokeWidth="1.5" opacity="0.8" />
                  )}
                  {/* Point */}
                  <circle cx={x + 50} cy={y + 100} r="3" fill={getColor(value)} />
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ============ STRINGS VIEW - WITH GO TO BUTTONS ============ */
function StringsView({ strings, onRefresh, onGoToHex, onGoToMap }) {
  const [filter, setFilter] = useState('');
  const [selectedString, setSelectedString] = useState(null);
  
  const filtered = strings.filter(s => s.text.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="h-full panel-alien flex flex-col">
      <div className="p-3 border-b border-purple-900/20 flex items-center gap-4">
        <h3 className="font-semibold text-purple-200">Strings ({filtered.length})</h3>
        <input type="text" placeholder="Rechercher..." value={filter} onChange={(e) => setFilter(e.target.value)}
          className="input-alien flex-1 max-w-xs" />
        <button onClick={onRefresh} className="btn-alien-sm"><RefreshCw className="w-4 h-4" /></button>
      </div>
      
      {/* Selected string actions */}
      {selectedString && (
        <div className="px-4 py-2 border-b border-purple-900/20 bg-purple-500/10 flex items-center gap-4">
          <span className="text-sm text-purple-300">
            Sélection: <span className="font-mono">0x{selectedString.offset.toString(16).toUpperCase()}</span>
          </span>
          <button onClick={() => { onGoToHex(selectedString.offset); }} className="btn-alien-sm">
            <Binary className="w-4 h-4" /> Voir en Hex
          </button>
          <button onClick={() => { onGoToMap(selectedString.offset); }} className="btn-alien-sm">
            <Grid3X3 className="w-4 h-4" /> Voir en Maps 2D
          </button>
        </div>
      )}
      
      <div className="flex-1 overflow-auto">
        {filtered.map((s, idx) => (
          <div key={idx} 
            onClick={() => setSelectedString(s)}
            className={`string-item-alien cursor-pointer ${selectedString?.offset === s.offset ? 'bg-purple-500/20' : ''}`}>
            <div className="text-purple-400 font-mono">0x{s.offset.toString(16).toUpperCase().padStart(4, '0')}</div>
            <div className="text-purple-100 truncate font-mono flex-1">{s.text}</div>
            <div className="flex gap-1">
              <button onClick={(e) => { e.stopPropagation(); onGoToHex(s.offset); }} 
                className="p-1 hover:bg-purple-500/30 rounded" title="Voir en Hex">
                <Binary className="w-3 h-3 text-purple-400" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onGoToMap(s.offset); }}
                className="p-1 hover:bg-purple-500/30 rounded" title="Voir en Maps 2D">
                <Grid3X3 className="w-3 h-3 text-purple-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ OTHER VIEWS (simplified) ============ */
function SinglesView({ singles, onRefresh }) {
  const [filter, setFilter] = useState('');
  const filtered = singles.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()) || s.offset.toString(16).includes(filter.toLowerCase()));

  return (
    <div className="h-full panel-alien flex flex-col">
      <div className="p-3 border-b border-purple-900/20 flex items-center gap-4">
        <h3 className="font-semibold text-purple-200">Valeurs ({filtered.length})</h3>
        <input type="text" placeholder="Filtrer..." value={filter} onChange={(e) => setFilter(e.target.value)} className="input-alien flex-1 max-w-xs" />
        <button onClick={onRefresh} className="btn-alien-sm"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-4 gap-3">
          {filtered.slice(0, 200).map((s, idx) => (
            <div key={idx} className="bg-purple-500/5 border border-purple-900/20 rounded-lg p-3">
              <div className="text-xs text-purple-400 font-mono">0x{s.offset.toString(16).toUpperCase().padStart(4, '0')}</div>
              <div className="text-xl font-bold text-purple-100 mt-1">{s.value}</div>
              <div className="text-xs text-purple-400/50">0x{s.value.toString(16).toUpperCase().padStart(4, '0')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DisasmView({ data, offset, onOffsetChange, fileSize }) {
  const [goToOffset, setGoToOffset] = useState('');
  const goTo = () => { const off = parseInt(goToOffset, 16); if (!isNaN(off)) onOffsetChange(off); };

  return (
    <div className="h-full panel-alien flex flex-col">
      <div className="p-3 border-b border-purple-900/20 flex items-center gap-4 flex-wrap">
        <h3 className="font-semibold text-purple-200">Désassembleur C166</h3>
        <input type="text" placeholder="Offset" value={goToOffset} onChange={(e) => setGoToOffset(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && goTo()} className="input-alien w-24 font-mono text-sm" />
        <button onClick={goTo} className="btn-alien-sm"><Search className="w-4 h-4" /></button>
        <button onClick={() => onOffsetChange(Math.max(0, offset - 100))} className="btn-alien-sm"><ChevronLeft className="w-4 h-4" /></button>
        <button onClick={() => onOffsetChange(offset + 100)} className="btn-alien-sm"><ChevronRightIcon className="w-4 h-4" /></button>
      </div>
      <div className="px-4 py-2 border-b border-purple-900/20 bg-purple-500/5">
        <OffsetSlider value={offset} max={fileSize - 200} onChange={onOffsetChange} step={100} />
      </div>
      <div className="flex-1 overflow-auto">
        <div className="disasm-header-alien"><div>OFFSET</div><div>BYTES</div><div>INSTR</div><div>OPERANDS</div></div>
        {data.map((inst, idx) => (
          <div key={idx} className={`disasm-line-alien ${inst.is_branch ? 'bg-yellow-500/5' : ''}`}>
            <div className="disasm-offset-alien">{inst.offset.toString(16).toUpperCase().padStart(8, '0')}</div>
            <div className="disasm-bytes-alien">{inst.bytes}</div>
            <div className={`disasm-mnemonic-alien ${inst.is_branch ? 'text-yellow-400' : ''}`}>{inst.mnemonic}</div>
            <div className="disasm-operands-alien">{inst.operands}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunctionsView({ functions, onRefresh, onGoTo }) {
  const [filter, setFilter] = useState('');
  const filtered = functions.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="h-full panel-alien flex flex-col">
      <div className="p-3 border-b border-purple-900/20 flex items-center gap-4">
        <h3 className="font-semibold text-purple-200">Fonctions ({filtered.length})</h3>
        <input type="text" placeholder="Filtrer..." value={filter} onChange={(e) => setFilter(e.target.value)} className="input-alien flex-1 max-w-xs" />
        <button onClick={onRefresh} className="btn-alien-sm"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-auto">
        {filtered.map((f, idx) => (
          <div key={idx} onClick={() => onGoTo(f.offset)}
            className="flex items-center justify-between p-3 border-b border-purple-900/10 hover:bg-purple-500/5 cursor-pointer">
            <div className="flex items-center gap-3">
              <GitBranch className="w-4 h-4 text-purple-400" />
              <div>
                <div className="font-mono text-purple-300">{f.name}</div>
                <div className="text-xs text-purple-400/50">0x{f.offset.toString(16).toUpperCase()}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecksumView({ checksums, onRefresh }) {
  if (!checksums) return <div className="h-full panel-alien flex items-center justify-center"><div className="spinner-alien" /></div>;

  return (
    <div className="h-full panel-alien flex flex-col">
      <div className="p-3 border-b border-purple-900/20 flex items-center justify-between">
        <h3 className="font-semibold text-purple-200">Checksums</h3>
        <button onClick={onRefresh} className="btn-alien-sm"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(checksums).map(([key, value]) => (
            <div key={key} className="bg-purple-500/5 border border-purple-900/20 rounded-lg p-4">
              <div className="text-sm text-purple-400/60 uppercase">{key.replace(/_/g, ' ')}</div>
              <div className="text-2xl font-mono text-purple-200 mt-1">
                {typeof value === 'number' ? `0x${value.toString(16).toUpperCase()}` : value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
