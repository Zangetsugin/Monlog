"""
ME7.4.4 / ME7.4.5 ECU Binary Parser
Support for Bosch ME7 Little Endian 16-bit
"""
import struct
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
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

@dataclass  
class SingleValue:
    """Single calibration value"""
    offset: int
    value: int
    name: str
    size: int  # 1 = byte, 2 = word

@dataclass
class StringFound:
    """String found in binary"""
    offset: int
    text: str
    length: int

class ME7Parser:
    """Parser for Bosch ME7.4.x ECU binaries"""
    
    # Known ME7.4.4 PSA map signatures/offsets
    KNOWN_MAPS_ME744 = {
        # Format: offset -> (name, rows, cols, description)
        0x1000: ('KFZW', 16, 16, 'Ignition timing base map'),
        0x2000: ('KFZW2', 16, 16, 'Ignition timing map 2'),
        0x4000: ('KFPED', 8, 8, 'Pedal characteristic'),
        0x6000: ('KFLDHFM', 16, 16, 'Air mass flow map'),
    }
    
    def __init__(self, data: bytes):
        self.data = data
        self.size = len(data)
        self.endian = '<'  # Little endian
        
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
        
        # Don't forget last string
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
            (4, 4), (4, 8), (8, 4), (6, 6)
        ]
        
        checked_offsets = set()
        
        for rows, cols in sizes_to_check:
            size_bytes = rows * cols * 2
            
            for offset in range(0, self.size - size_bytes, 2):
                # Skip if too close to already found map
                if any(abs(offset - o) < 64 for o in checked_offsets):
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
                
                # Check for structure (monotonicity)
                monotonic_rows = 0
                for r in range(rows):
                    row = values[r*cols:(r+1)*cols]
                    if (all(row[i] <= row[i+1] for i in range(len(row)-1)) or
                        all(row[i] >= row[i+1] for i in range(len(row)-1))):
                        monotonic_rows += 1
                
                # At least some structure
                if monotonic_rows >= max(1, rows // 4):
                    # Convert to 2D array
                    data_2d = []
                    for r in range(rows):
                        data_2d.append(values[r*cols:(r+1)*cols])
                    
                    maps_found.append(MapDefinition(
                        offset=offset,
                        rows=rows,
                        cols=cols,
                        name=f'MAP_{offset:04X}',
                        description=f'Auto-detected {rows}x{cols} map',
                        min_val=min(values),
                        max_val=max(values),
                        avg_val=avg,
                        data=data_2d
                    ))
                    checked_offsets.add(offset)
        
        # Sort by offset
        maps_found.sort(key=lambda m: m.offset)
        return maps_found[:100]  # Limit to 100 most relevant
    
    def scan_single_values(self) -> List[SingleValue]:
        """Scan for single calibration values"""
        singles = []
        
        # Common calibration value patterns
        for offset in range(0, self.size - 2, 2):
            value = self.read_word(offset)
            
            # Filter: likely calibration values (not code, not empty)
            if 0 < value < 0xFFF0 and value not in [0x0000, 0xFFFF]:
                # Check surrounding bytes for patterns
                prev = self.read_word(offset - 2) if offset >= 2 else 0
                next_v = self.read_word(offset + 2) if offset + 2 < self.size else 0
                
                # Isolated values or start of sequences
                if abs(value - prev) > 100 or abs(value - next_v) > 100:
                    singles.append(SingleValue(
                        offset=offset,
                        value=value,
                        name=f'VAL_{offset:04X}',
                        size=2
                    ))
        
        return singles[:500]  # Limit results
    
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
    
    def get_file_info(self) -> Dict:
        """Get basic file information"""
        # Try to detect ECU type from signatures
        ecu_type = 'Unknown'
        
        # Check for ME7 signatures
        header = self.data[:256]
        if b'ZZ' in header[:4]:
            ecu_type = 'Bosch ME7.x'
        
        # Look for version strings
        strings = self.find_strings(6)
        version_info = [s for s in strings if any(x in s.text.upper() for x in ['ME7', 'BOSCH', 'PSA', 'P244', 'D244'])]
        
        return {
            'size': self.size,
            'size_kb': self.size / 1024,
            'ecu_type': ecu_type,
            'endian': 'Little Endian',
            'word_size': 16,
            'version_strings': [{'offset': s.offset, 'text': s.text} for s in version_info[:10]],
            'header_hex': ' '.join(f'{b:02X}' for b in header[:64])
        }
