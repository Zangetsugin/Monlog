"""
ECU Definitions Manager
Load and manage map/scalar definitions from JSON files
"""
import os
import json
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
import struct

@dataclass
class AxisDefinition:
    """Axis definition for maps"""
    name: str
    unit: str
    values: List[float]

@dataclass
class MapDefinitionDef:
    """Map definition from definition file"""
    name: str
    description: str
    category: str
    rows: int
    cols: int
    x_axis: Optional[str]
    y_axis: Optional[str]
    unit: str
    factor: float = 1.0
    offset_value: float = 0.0
    min_typical: Optional[int] = None
    max_typical: Optional[int] = None

@dataclass
class ScalarDefinition:
    """Scalar value definition"""
    name: str
    description: str
    category: str
    unit: str
    size: int
    factor: float = 1.0
    offset_value: float = 0.0
    typical_value: Optional[int] = None
    min_value: Optional[int] = None
    max_value: Optional[int] = None

class DefinitionsManager:
    """Manager for ECU definitions"""
    
    def __init__(self, definitions_dir: str = None):
        if definitions_dir is None:
            definitions_dir = os.path.join(os.path.dirname(__file__), 'definitions')
        self.definitions_dir = definitions_dir
        self.definitions: Dict[str, dict] = {}
        self.current_def: Optional[dict] = None
        self._load_all_definitions()
    
    def _load_all_definitions(self):
        """Load all definition files"""
        if not os.path.exists(self.definitions_dir):
            os.makedirs(self.definitions_dir)
            return
        
        for filename in os.listdir(self.definitions_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(self.definitions_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        key = data.get('name', filename.replace('.json', ''))
                        self.definitions[key] = data
                except Exception as e:
                    print(f"Error loading {filename}: {e}")
    
    def get_available_definitions(self) -> List[Dict]:
        """Get list of available definitions"""
        return [
            {
                "name": name,
                "ecu_type": data.get("ecu_type", "Unknown"),
                "manufacturer": data.get("manufacturer", "Unknown"),
                "engine": data.get("engine", ""),
                "description": data.get("description", "")
            }
            for name, data in self.definitions.items()
        ]
    
    def load_definition(self, name: str) -> bool:
        """Load a specific definition"""
        if name in self.definitions:
            self.current_def = self.definitions[name]
            return True
        return False
    
    def get_axes(self) -> Dict[str, AxisDefinition]:
        """Get all defined axes"""
        if not self.current_def:
            return {}
        
        axes = {}
        for axis_name, axis_data in self.current_def.get("axes", {}).items():
            axes[axis_name] = AxisDefinition(
                name=axis_data.get("name", axis_name),
                unit=axis_data.get("unit", ""),
                values=axis_data.get("values", [])
            )
        return axes
    
    def get_axis_values(self, axis_name: str) -> List[float]:
        """Get values for a specific axis"""
        if not self.current_def:
            return []
        
        axes = self.current_def.get("axes", {})
        if axis_name in axes:
            return axes[axis_name].get("values", [])
        return []
    
    def get_defined_maps(self) -> List[MapDefinitionDef]:
        """Get all defined maps"""
        if not self.current_def:
            return []
        
        maps = []
        for map_data in self.current_def.get("maps", []):
            maps.append(MapDefinitionDef(
                name=map_data.get("name", "Unknown"),
                description=map_data.get("description", ""),
                category=map_data.get("category", "Other"),
                rows=map_data.get("rows", 8),
                cols=map_data.get("cols", 8),
                x_axis=map_data.get("x_axis"),
                y_axis=map_data.get("y_axis"),
                unit=map_data.get("unit", ""),
                factor=map_data.get("factor", 1.0),
                offset_value=map_data.get("offset", 0.0),
                min_typical=map_data.get("min_typical"),
                max_typical=map_data.get("max_typical")
            ))
        return maps
    
    def get_defined_scalars(self) -> List[ScalarDefinition]:
        """Get all defined scalars"""
        if not self.current_def:
            return []
        
        scalars = []
        for scalar_data in self.current_def.get("scalars", []):
            scalars.append(ScalarDefinition(
                name=scalar_data.get("name", "Unknown"),
                description=scalar_data.get("description", ""),
                category=scalar_data.get("category", "Other"),
                unit=scalar_data.get("unit", ""),
                size=scalar_data.get("size", 2),
                factor=scalar_data.get("factor", 1.0),
                offset_value=scalar_data.get("offset", 0.0),
                typical_value=scalar_data.get("typical_value"),
                min_value=scalar_data.get("min"),
                max_value=scalar_data.get("max")
            ))
        return scalars
    
    def get_map_info(self, map_name: str) -> Optional[Dict]:
        """Get info for a specific map"""
        if not self.current_def:
            return None
        
        for map_data in self.current_def.get("maps", []):
            if map_data.get("name") == map_name:
                return map_data
        return None


class AxisDetector:
    """Automatic axis detection in binary data"""
    
    def __init__(self, data: bytes):
        self.data = data
        self.size = len(data)
    
    def read_word(self, offset: int) -> int:
        """Read 16-bit word (little endian)"""
        if offset + 1 >= self.size:
            return 0
        return struct.unpack('<H', self.data[offset:offset+2])[0]
    
    def detect_axis_before_map(self, map_offset: int, axis_length: int) -> Optional[Dict]:
        """Try to detect axis values before a map
        
        ME7 typically stores axes just before the map data:
        [Y-axis values][X-axis values][Map data]
        """
        # Try to find X-axis (immediately before map)
        x_axis_start = map_offset - axis_length * 2
        if x_axis_start < 0:
            return None
        
        x_values = []
        for i in range(axis_length):
            x_values.append(self.read_word(x_axis_start + i * 2))
        
        # Check if this looks like an axis (monotonically increasing)
        x_axis = None
        if self._is_valid_axis(x_values):
            x_axis = {
                "offset": x_axis_start,
                "values": x_values,
                "type": self._guess_axis_type(x_values)
            }
        
        # Try to find Y-axis (before X-axis)
        y_axis_start = x_axis_start - axis_length * 2
        y_axis = None
        
        if y_axis_start >= 0:
            y_values = []
            for i in range(axis_length):
                y_values.append(self.read_word(y_axis_start + i * 2))
            
            if self._is_valid_axis(y_values):
                y_axis = {
                    "offset": y_axis_start,
                    "values": y_values,
                    "type": self._guess_axis_type(y_values)
                }
        
        return {
            "x_axis": x_axis,
            "y_axis": y_axis
        }
    
    def _is_valid_axis(self, values: List[int]) -> bool:
        """Check if values look like a valid axis"""
        if len(values) < 2:
            return False
        
        # Check for monotonicity (increasing or decreasing)
        increasing = all(values[i] <= values[i+1] for i in range(len(values)-1))
        decreasing = all(values[i] >= values[i+1] for i in range(len(values)-1))
        
        if not (increasing or decreasing):
            return False
        
        # Check for reasonable range
        if max(values) == 0:
            return False
        
        # Check that values are not all the same
        if min(values) == max(values):
            return False
        
        # Check for reasonable spread
        spread = max(values) - min(values)
        if spread < 10:  # Too narrow
            return False
        
        return True
    
    def _guess_axis_type(self, values: List[int]) -> Dict:
        """Try to guess what type of axis this is"""
        min_val = min(values)
        max_val = max(values)
        length = len(values)
        
        # RPM axis detection
        if 400 <= min_val <= 1000 and 5000 <= max_val <= 9000:
            return {
                "type": "RPM",
                "unit": "tr/min",
                "confidence": 0.9
            }
        
        # Load/Charge axis (typically 0-150% or similar)
        if min_val < 50 and 100 <= max_val <= 200:
            return {
                "type": "Load",
                "unit": "%",
                "confidence": 0.7
            }
        
        # Temperature axis
        if -50 <= min_val <= 0 and 80 <= max_val <= 150:
            return {
                "type": "Temperature",
                "unit": "°C",
                "confidence": 0.7
            }
        
        # Voltage axis (typically 6-20V range, scaled)
        if 60 <= min_val <= 100 and 150 <= max_val <= 250:
            return {
                "type": "Voltage",
                "unit": "V",
                "factor": 0.1,
                "confidence": 0.6
            }
        
        # Pressure axis
        if max_val > 1000 and max_val < 5000:
            return {
                "type": "Pressure",
                "unit": "mbar",
                "confidence": 0.5
            }
        
        # Unknown
        return {
            "type": "Unknown",
            "unit": "",
            "confidence": 0.2
        }
    
    def scan_for_axes(self, map_offset: int, rows: int, cols: int) -> Dict:
        """Comprehensive axis scanning for a map"""
        result = {
            "x_axis": None,
            "y_axis": None,
            "x_axis_offset": None,
            "y_axis_offset": None
        }
        
        # Strategy 1: Check immediately before map
        axis_data = self.detect_axis_before_map(map_offset, cols)
        if axis_data:
            if axis_data.get("x_axis"):
                result["x_axis"] = axis_data["x_axis"]["values"]
                result["x_axis_offset"] = axis_data["x_axis"]["offset"]
                result["x_axis_type"] = axis_data["x_axis"]["type"]
            if axis_data.get("y_axis"):
                result["y_axis"] = axis_data["y_axis"]["values"]
                result["y_axis_offset"] = axis_data["y_axis"]["offset"]
                result["y_axis_type"] = axis_data["y_axis"]["type"]
        
        # If X-axis not found with cols, try with rows (some maps have different axis lengths)
        if not result["x_axis"] and rows != cols:
            axis_data = self.detect_axis_before_map(map_offset, rows)
            if axis_data and axis_data.get("x_axis"):
                result["x_axis"] = axis_data["x_axis"]["values"][:cols] if len(axis_data["x_axis"]["values"]) >= cols else axis_data["x_axis"]["values"]
                result["x_axis_offset"] = axis_data["x_axis"]["offset"]
        
        # Generate default axes if not found
        if not result["x_axis"]:
            result["x_axis"] = list(range(cols))
            result["x_axis_type"] = {"type": "Index", "unit": "", "confidence": 0}
        
        if not result["y_axis"]:
            result["y_axis"] = list(range(rows))
            result["y_axis_type"] = {"type": "Index", "unit": "", "confidence": 0}
        
        return result
