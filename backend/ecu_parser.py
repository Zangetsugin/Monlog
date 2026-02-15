"""
ME7.4.4 / ME7.4.5 ECU Binary Parser
Support for Bosch ME7 Little Endian 16-bit
With known maps definitions for PSA TU5JP4
"""
import struct
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
import re

@dataclass
class MapDefinition:
    """Definition of a calibration map"""
    offset: int
    rows: int
    cols: int
    name: str
    description: str
    min_val: int
    max_val: int
    avg_val: float
    data: List[List[int]]
    x_axis: Optional[List[int]] = None
    y_axis: Optional[List[int]] = None
    unit: str = ""
    category: str = "Unknown"

@dataclass  
class SingleValue:
    """Single calibration value"""
    offset: int
    value: int
    name: str
    size: int  # 1 = byte, 2 = word
    description: str = ""
    unit: str = ""

@dataclass
class StringFound:
    """String found in binary"""
    offset: int
    text: str
    length: int

# ============ KNOWN ME7.4.4 PSA MAPS ============
# These are typical offsets for ME7.4.4 PSA (Peugeot/Citroën TU5JP4)
# Offsets may vary slightly between versions

KNOWN_MAPS_ME744_PSA = {
    # Ignition maps
    "KFZW": {
        "description": "Ignition timing base map (°KW)",
        "category": "Ignition",
        "rows": 16, "cols": 16,
        "unit": "°KW",
        "search_pattern": b'\x00\x08\x10\x18\x20',  # Typical timing values
    },
    "KFZW2": {
        "description": "Ignition timing map 2 (high load)",
        "category": "Ignition",
        "rows": 16, "cols": 16,
        "unit": "°KW",
    },
    "KFZWOP": {
        "description": "Optimal ignition timing",
        "category": "Ignition",
        "rows": 16, "cols": 16,
        "unit": "°KW",
    },
    
    # Fuel maps
    "KFPED": {
        "description": "Pedal characteristic map",
        "category": "Fuel",
        "rows": 8, "cols": 8,
        "unit": "%",
    },
    "LAMFA": {
        "description": "Lambda target map (AFR)",
        "category": "Fuel",
        "rows": 16, "cols": 16,
        "unit": "Lambda",
    },
    "LAMSPTG": {
        "description": "Lambda setpoint gasoline",
        "category": "Fuel",
        "rows": 12, "cols": 12,
        "unit": "Lambda",
    },
    "KFTARIKS": {
        "description": "Injector constant correction",
        "category": "Fuel",
        "rows": 8, "cols": 8,
        "unit": "ms",
    },
    "TVUB": {
        "description": "Injection time voltage correction",
        "category": "Fuel",
        "rows": 8, "cols": 1,
        "unit": "ms",
    },
    
    # Torque/Load maps
    "KFMIOP": {
        "description": "Optimal torque map",
        "category": "Torque",
        "rows": 16, "cols": 16,
        "unit": "Nm",
    },
    "KFMIRL": {
        "description": "Relative torque map",
        "category": "Torque",
        "rows": 16, "cols": 16,
        "unit": "%",
    },
    "LDRXN": {
        "description": "Load request normalized",
        "category": "Torque",
        "rows": 16, "cols": 16,
        "unit": "%",
    },
    
    # Boost/Turbo (if applicable)
    "KFLDRL": {
        "description": "Boost pressure target",
        "category": "Turbo",
        "rows": 16, "cols": 16,
        "unit": "mbar",
    },
    "KFLDHFM": {
        "description": "Air mass flow map",
        "category": "Airflow",
        "rows": 16, "cols": 16,
        "unit": "kg/h",
    },
    
    # Rev limiter
    "NMAX": {
        "description": "RPM limiter",
        "category": "Limiters",
        "rows": 1, "cols": 1,
        "unit": "RPM",
    },
    "VMAX": {
        "description": "Speed limiter",
        "category": "Limiters",
        "rows": 1, "cols": 1,
        "unit": "km/h",
    },
    
    # EGR
    "KFAGR": {
        "description": "EGR valve map",
        "category": "EGR",
        "rows": 16, "cols": 16,
        "unit": "%",
    },
    
    # Idle
    "KFNW": {
        "description": "Idle RPM target",
        "category": "Idle",
        "rows": 8, "cols": 8,
        "unit": "RPM",
    },
}

# Known single values for ME7.4.4
KNOWN_SINGLES_ME744 = {
    "NMAX": {"description": "Rev limiter", "unit": "RPM", "typical": 6500},
    "VMAX": {"description": "Speed limiter", "unit": "km/h", "typical": 250},
    "ZWGRU": {"description": "Base ignition timing", "unit": "°KW", "typical": 15},
    "LAMSBG": {"description": "Lambda base value", "unit": "", "typical": 14700},
}


class ME7Parser:
    """Parser for Bosch ME7.4.x ECU binaries"""
    
    def __init__(self, data: bytes):
        self.data = data
        self.size = len(data)
        self.endian = '<'  # Little endian
        self.ecu_info = self._detect_ecu_type()
        
    def _detect_ecu_type(self) -> Dict:
        """Detect ECU type from signatures"""
        info = {
            "type": "Unknown",
            "version": "",
            "manufacturer": "",
            "hardware": "",
            "software": ""
        }
        
        # Check for ME7 signature
        if self.data[:2] == b'ZZ':
            info["type"] = "Bosch ME7.x"
            
        # Look for PSA identifiers
        strings = self.find_strings(4)
        for s in strings:
            text = s.text.upper()
            if 'P244' in text or 'D244' in text:
                info["manufacturer"] = "PSA (Peugeot/Citroën)"
                info["type"] = "Bosch ME7.4.4"
            if 'ME7.4.4' in text:
                info["version"] = "ME7.4.4"
            if 'ME7.4.5' in text:
                info["version"] = "ME7.4.5"
            if 'TU5JP4' in text:
                info["hardware"] = "TU5JP4"
                
        return info
        
    def read_byte(self, offset: int) -> int:
        """Read single byte"""
        if offset >= self.size:
            return 0
        return self.data[offset]
    
    def read_word(self, offset: int) -> int:
        """Read 16-bit word (little endian)"""
        if offset + 1 >= self.size:
            return 0
        return struct.unpack('<H', self.data[offset:offset+2])[0]
    
    def read_dword(self, offset: int) -> int:
        """Read 32-bit dword (little endian)"""
        if offset + 3 >= self.size:
            return 0
        return struct.unpack('<I', self.data[offset:offset+4])[0]
    
    def write_byte(self, offset: int, value: int) -> bytes:
        """Write single byte"""
        new_data = bytearray(self.data)
        if offset < len(new_data):
            new_data[offset] = value & 0xFF
        return bytes(new_data)
    
    def write_word(self, offset: int, value: int) -> bytes:
        """Write 16-bit word and return modified data"""
        new_data = bytearray(self.data)
        new_data[offset:offset+2] = struct.pack('<H', value & 0xFFFF)
        return bytes(new_data)
    
    def get_hex_view(self, offset: int, length: int = 256) -> List[Dict]:
        """Get hex view of data"""
        rows = []
        for i in range(offset, min(offset + length, self.size), 16):
            chunk = self.data[i:min(i+16, self.size)]
            hex_bytes = [{'offset': i+j, 'value': b} for j, b in enumerate(chunk)]
            ascii_str = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
            rows.append({
                'offset': i,
                'hex': hex_bytes,
                'ascii': ascii_str
            })
        return rows
    
    def find_strings(self, min_length: int = 4) -> List[StringFound]:
        """Find all ASCII strings in binary"""
        strings = []
        current = ''
        start_offset = 0
        
        for i, b in enumerate(self.data):
            if 32 <= b < 127:
                if not current:
                    start_offset = i
                current += chr(b)
            else:
                if len(current) >= min_length:
                    strings.append(StringFound(
                        offset=start_offset,
                        text=current,
                        length=len(current)
                    ))
                current = ''
        
        if len(current) >= min_length:
            strings.append(StringFound(
                offset=start_offset,
                text=current,
                length=len(current)
            ))
            
        return strings
    
    def scan_maps(self, min_size: int = 4, max_size: int = 32) -> List[MapDefinition]:
        """Scan for potential calibration maps"""
        maps_found = []
        sizes_to_check = [
            (8, 8), (16, 16), (8, 16), (16, 8),
            (10, 10), (12, 12), (8, 10), (10, 8),
            (4, 4), (4, 8), (8, 4), (6, 6),
            (1, 8), (1, 16),  # 1D tables
        ]
        
        checked_offsets = set()
        
        for rows, cols in sizes_to_check:
            size_bytes = rows * cols * 2
            
            for offset in range(0, self.size - size_bytes, 2):
                if any(abs(offset - o) < 32 for o in checked_offsets):
                    continue
                
                values = []
                for i in range(rows * cols):
                    values.append(self.read_word(offset + i * 2))
                
                # Filter criteria
                if min(values) == max(values):
                    continue
                if values.count(0xFFFF) > len(values) // 3:
                    continue
                if values.count(0) > len(values) * 2 // 3:
                    continue
                
                avg = sum(values) / len(values)
                
                # Check for structure
                monotonic_rows = 0
                for r in range(rows):
                    row = values[r*cols:(r+1)*cols]
                    if (all(row[i] <= row[i+1] for i in range(len(row)-1)) or
                        all(row[i] >= row[i+1] for i in range(len(row)-1))):
                        monotonic_rows += 1
                
                if monotonic_rows >= max(1, rows // 4):
                    data_2d = []
                    for r in range(rows):
                        data_2d.append(values[r*cols:(r+1)*cols])
                    
                    # Try to match with known maps
                    map_name = f'MAP_{offset:04X}'
                    map_desc = f'Auto-detected {rows}x{cols} map'
                    map_cat = 'Auto-detected'
                    
                    maps_found.append(MapDefinition(
                        offset=offset,
                        rows=rows,
                        cols=cols,
                        name=map_name,
                        description=map_desc,
                        min_val=min(values),
                        max_val=max(values),
                        avg_val=avg,
                        data=data_2d,
                        category=map_cat
                    ))
                    checked_offsets.add(offset)
        
        maps_found.sort(key=lambda m: m.offset)
        return maps_found[:100]
    
    def get_known_maps(self) -> List[Dict]:
        """Return list of known ME7.4.4 maps"""
        return [
            {
                "name": name,
                "description": info["description"],
                "category": info["category"],
                "rows": info["rows"],
                "cols": info["cols"],
                "unit": info["unit"]
            }
            for name, info in KNOWN_MAPS_ME744_PSA.items()
        ]
    
    def scan_single_values(self) -> List[SingleValue]:
        """Scan for single calibration values"""
        singles = []
        
        for offset in range(0, self.size - 2, 2):
            value = self.read_word(offset)
            
            if 0 < value < 0xFFF0 and value not in [0x0000, 0xFFFF]:
                prev = self.read_word(offset - 2) if offset >= 2 else 0
                next_v = self.read_word(offset + 2) if offset + 2 < self.size else 0
                
                if abs(value - prev) > 100 or abs(value - next_v) > 100:
                    # Try to identify known values
                    name = f'VAL_{offset:04X}'
                    desc = ""
                    unit = ""
                    
                    for known_name, known_info in KNOWN_SINGLES_ME744.items():
                        if abs(value - known_info["typical"]) < known_info["typical"] * 0.2:
                            name = f'{known_name}_{offset:04X}'
                            desc = known_info["description"]
                            unit = known_info["unit"]
                            break
                    
                    singles.append(SingleValue(
                        offset=offset,
                        value=value,
                        name=name,
                        size=2,
                        description=desc,
                        unit=unit
                    ))
        
        return singles[:500]
    
    def get_map_at_offset(self, offset: int, rows: int, cols: int) -> MapDefinition:
        """Extract map at specific offset"""
        values = []
        for i in range(rows * cols):
            values.append(self.read_word(offset + i * 2))
        
        data_2d = []
        for r in range(rows):
            data_2d.append(values[r*cols:(r+1)*cols])
        
        return MapDefinition(
            offset=offset,
            rows=rows,
            cols=cols,
            name=f'MAP_{offset:04X}',
            description=f'Manual {rows}x{cols} map',
            min_val=min(values),
            max_val=max(values),
            avg_val=sum(values) / len(values),
            data=data_2d
        )
    
    def apply_map_operation(self, offset: int, rows: int, cols: int, 
                           operation: str, value: float) -> bytes:
        """Apply operation to entire map"""
        new_data = bytearray(self.data)
        
        for i in range(rows * cols):
            cell_offset = offset + i * 2
            current = self.read_word(cell_offset)
            
            if operation == 'add':
                new_val = int(current + value)
            elif operation == 'subtract':
                new_val = int(current - value)
            elif operation == 'multiply':
                new_val = int(current * value)
            elif operation == 'divide' and value != 0:
                new_val = int(current / value)
            elif operation == 'percent':
                new_val = int(current * (1 + value / 100))
            else:
                new_val = current
            
            # Clamp to 16-bit
            new_val = max(0, min(65535, new_val))
            new_data[cell_offset:cell_offset+2] = struct.pack('<H', new_val)
        
        return bytes(new_data)
    
    def export_map_csv(self, offset: int, rows: int, cols: int) -> str:
        """Export map to CSV format"""
        lines = []
        lines.append(f"# Map at offset 0x{offset:04X}")
        lines.append(f"# Size: {rows}x{cols}")
        lines.append("")
        
        # Header row
        lines.append("," + ",".join(str(i) for i in range(cols)))
        
        # Data rows
        for r in range(rows):
            row_data = []
            for c in range(cols):
                val = self.read_word(offset + (r * cols + c) * 2)
                row_data.append(str(val))
            lines.append(f"{r}," + ",".join(row_data))
        
        return "\n".join(lines)
    
    def calculate_checksum(self) -> Dict:
        """Calculate various checksums for Bosch ME7"""
        # Simple checksums
        sum8 = sum(self.data) & 0xFF
        sum16 = sum(struct.unpack('<' + 'H' * (self.size // 2), 
                   self.data[:self.size // 2 * 2])) & 0xFFFF
        sum32 = sum(struct.unpack('<' + 'I' * (self.size // 4),
                   self.data[:self.size // 4 * 4])) & 0xFFFFFFFF
        
        # XOR checksum
        xor8 = 0
        for b in self.data:
            xor8 ^= b
        
        xor16 = 0
        for i in range(0, self.size - 1, 2):
            xor16 ^= self.read_word(i)
        
        # CRC-like (simple)
        crc = 0xFFFF
        for b in self.data:
            crc ^= b
            for _ in range(8):
                if crc & 1:
                    crc = (crc >> 1) ^ 0xA001
                else:
                    crc >>= 1
        
        # Bosch ME7 specific areas (if detectable)
        # RSA area typically at end of file
        rsa_offset = self.size - 256 if self.size >= 256 else 0
        rsa_sum = sum(self.data[rsa_offset:]) & 0xFFFF
        
        return {
            "sum8": sum8,
            "sum16": sum16,
            "sum32": sum32,
            "xor8": xor8,
            "xor16": xor16,
            "crc16": crc,
            "rsa_area_sum": rsa_sum,
            "file_size": self.size
        }
    
    def get_file_info(self) -> Dict:
        """Get basic file information"""
        strings = self.find_strings(6)
        version_info = [s for s in strings if any(x in s.text.upper() 
                       for x in ['ME7', 'BOSCH', 'PSA', 'P244', 'D244', 'TU5'])]
        
        checksums = self.calculate_checksum()
        
        return {
            'size': self.size,
            'size_kb': self.size / 1024,
            'ecu_type': self.ecu_info.get('type', 'Unknown'),
            'ecu_version': self.ecu_info.get('version', ''),
            'manufacturer': self.ecu_info.get('manufacturer', ''),
            'hardware': self.ecu_info.get('hardware', ''),
            'endian': 'Little Endian',
            'word_size': 16,
            'version_strings': [{'offset': s.offset, 'text': s.text} for s in version_info[:10]],
            'header_hex': ' '.join(f'{b:02X}' for b in self.data[:64]),
            'checksums': checksums
        }
