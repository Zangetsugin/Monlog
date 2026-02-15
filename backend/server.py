"""
Alien ECU Engine - Backend Server
FastAPI server for ME7.4.4/ME7.4.5 calibration
"""
import os
import io
import struct
import json
from typing import List, Dict, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

from ecu_parser import ME7Parser, MapDefinition
from disassembler import C166Disassembler
from definitions_manager import DefinitionsManager, AxisDetector

app = FastAPI(title="Alien ECU Engine", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
current_file: Optional[bytes] = None
current_filename: str = ""
parser: Optional[ME7Parser] = None
disasm: Optional[C166Disassembler] = None
definitions_mgr: DefinitionsManager = DefinitionsManager()
axis_detector: Optional[AxisDetector] = None

# Models
class MapRequest(BaseModel):
    offset: int
    rows: int
    cols: int

class EditRequest(BaseModel):
    offset: int
    value: int

class MapEditRequest(BaseModel):
    offset: int
    row: int
    col: int
    value: int
    rows: int
    cols: int

class MapOperationRequest(BaseModel):
    offset: int
    rows: int
    cols: int
    operation: str  # add, subtract, multiply, divide, percent
    value: float

class HexEditRequest(BaseModel):
    offset: int
    value: int

class AnnotationRequest(BaseModel):
    offset: int
    text: str
    type: str = "comment"

class FunctionRenameRequest(BaseModel):
    offset: int
    name: str

# Routes
@app.get("/api/status")
async def status():
    return {
        "status": "running",
        "file_loaded": current_file is not None,
        "filename": current_filename,
        "file_size": len(current_file) if current_file else 0
    }

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    global current_file, current_filename, parser, disasm, axis_detector
    
    content = await file.read()
    
    # Support .hex files (Intel HEX format)
    if file.filename.lower().endswith('.hex'):
        content = parse_intel_hex(content)
    
    current_file = content
    current_filename = file.filename
    parser = ME7Parser(content)
    disasm = C166Disassembler(content)
    axis_detector = AxisDetector(content)
    
    # Auto-load ME7.4.4 PSA definition if detected
    if parser.ecu_info.get("type") == "Bosch ME7.4.4":
        definitions_mgr.load_definition("ME7.4.4 PSA TU5JP4")
    
    return {
        "success": True,
        "filename": file.filename,
        "size": len(content),
        "info": parser.get_file_info()
    }

def parse_intel_hex(hex_content: bytes) -> bytes:
    """Parse Intel HEX format to binary"""
    lines = hex_content.decode('ascii', errors='ignore').split('\n')
    data = bytearray()
    base_addr = 0
    
    for line in lines:
        line = line.strip()
        if not line.startswith(':'):
            continue
        
        try:
            byte_count = int(line[1:3], 16)
            address = int(line[3:7], 16)
            record_type = int(line[7:9], 16)
            
            if record_type == 0x00:  # Data record
                full_addr = base_addr + address
                while len(data) < full_addr:
                    data.append(0xFF)
                
                for i in range(byte_count):
                    byte_val = int(line[9 + i*2:11 + i*2], 16)
                    if full_addr + i < len(data):
                        data[full_addr + i] = byte_val
                    else:
                        data.append(byte_val)
                        
            elif record_type == 0x02:
                base_addr = int(line[9:13], 16) << 4
            elif record_type == 0x04:
                base_addr = int(line[9:13], 16) << 16
            elif record_type == 0x01:
                break
        except:
            continue
    
    return bytes(data)

@app.get("/api/file-info")
async def get_file_info():
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    return parser.get_file_info()

@app.get("/api/hex")
async def get_hex_view(offset: int = 0, length: int = 512):
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    return {
        "offset": offset,
        "length": length,
        "total_size": parser.size,
        "data": parser.get_hex_view(offset, length)
    }

@app.post("/api/hex/edit")
async def edit_hex(req: HexEditRequest):
    global current_file, parser, disasm
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    data = bytearray(current_file)
    if req.offset < len(data):
        data[req.offset] = req.value & 0xFF
        current_file = bytes(data)
        parser = ME7Parser(current_file)
        disasm = C166Disassembler(current_file)
    
    return {"success": True, "offset": req.offset, "value": req.value}

@app.get("/api/strings")
async def get_strings(min_length: int = 4):
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    strings = parser.find_strings(min_length)
    return {
        "count": len(strings),
        "strings": [{"offset": s.offset, "text": s.text, "length": s.length} for s in strings]
    }

@app.get("/api/maps/scan")
async def scan_maps():
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    maps = parser.scan_maps()
    return {
        "count": len(maps),
        "maps": [{
            "offset": m.offset,
            "rows": m.rows,
            "cols": m.cols,
            "name": m.name,
            "description": m.description,
            "min": m.min_val,
            "max": m.max_val,
            "avg": m.avg_val,
            "category": m.category
        } for m in maps]
    }

@app.get("/api/maps/known")
async def get_known_maps():
    """Get list of known ME7.4.4 maps from definitions"""
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    # Get maps from definition file
    defined_maps = definitions_mgr.get_defined_maps()
    
    return {
        "maps": [{
            "name": m.name,
            "description": m.description,
            "category": m.category,
            "rows": m.rows,
            "cols": m.cols,
            "x_axis": m.x_axis,
            "y_axis": m.y_axis,
            "unit": m.unit,
            "factor": m.factor
        } for m in defined_maps]
    }

@app.get("/api/definitions")
async def get_definitions():
    """Get available ECU definitions"""
    return {
        "definitions": definitions_mgr.get_available_definitions()
    }

@app.post("/api/definitions/load")
async def load_definition(name: str):
    """Load a specific ECU definition"""
    success = definitions_mgr.load_definition(name)
    return {"success": success, "name": name}

@app.get("/api/axes")
async def get_axes():
    """Get defined axes for current ECU"""
    axes = definitions_mgr.get_axes()
    return {
        "axes": {
            name: {
                "name": axis.name,
                "unit": axis.unit,
                "values": axis.values
            }
            for name, axis in axes.items()
        }
    }

@app.post("/api/maps/get")
async def get_map(req: MapRequest):
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    m = parser.get_map_at_offset(req.offset, req.rows, req.cols)
    
    # Detect axes automatically
    axes_info = {"x_axis": None, "y_axis": None}
    if axis_detector:
        axes_info = axis_detector.scan_for_axes(req.offset, req.rows, req.cols)
    
    return {
        "offset": m.offset,
        "rows": m.rows,
        "cols": m.cols,
        "name": m.name,
        "min": m.min_val,
        "max": m.max_val,
        "avg": m.avg_val,
        "data": m.data,
        "x_axis": axes_info.get("x_axis"),
        "y_axis": axes_info.get("y_axis"),
        "x_axis_type": axes_info.get("x_axis_type"),
        "y_axis_type": axes_info.get("y_axis_type")
    }

@app.post("/api/maps/edit")
async def edit_map_cell(req: MapEditRequest):
    global current_file, parser, disasm
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    cell_offset = req.offset + (req.row * req.cols + req.col) * 2
    
    data = bytearray(current_file)
    if cell_offset + 1 < len(data):
        data[cell_offset] = req.value & 0xFF
        data[cell_offset + 1] = (req.value >> 8) & 0xFF
        current_file = bytes(data)
        parser = ME7Parser(current_file)
        disasm = C166Disassembler(current_file)
    
    return {"success": True, "offset": cell_offset, "value": req.value}

@app.post("/api/maps/operation")
async def apply_map_operation(req: MapOperationRequest):
    """Apply operation to entire map (add, subtract, multiply, divide, percent)"""
    global current_file, parser, disasm
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    current_file = parser.apply_map_operation(
        req.offset, req.rows, req.cols, req.operation, req.value
    )
    parser = ME7Parser(current_file)
    disasm = C166Disassembler(current_file)
    
    # Return updated map
    m = parser.get_map_at_offset(req.offset, req.rows, req.cols)
    return {
        "success": True,
        "operation": req.operation,
        "value": req.value,
        "map": {
            "offset": m.offset,
            "rows": m.rows,
            "cols": m.cols,
            "min": m.min_val,
            "max": m.max_val,
            "data": m.data
        }
    }

@app.get("/api/maps/export")
async def export_map_csv(offset: int, rows: int, cols: int):
    """Export map to CSV"""
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    csv_content = parser.export_map_csv(offset, rows, cols)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=map_{offset:04X}.csv"}
    )

@app.get("/api/singles")
async def get_single_values():
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    singles = parser.scan_single_values()
    return {
        "count": len(singles),
        "values": [{
            "offset": s.offset, 
            "value": s.value, 
            "name": s.name, 
            "size": s.size,
            "description": s.description,
            "unit": s.unit
        } for s in singles]
    }

@app.get("/api/checksum")
async def calculate_checksum():
    """Calculate various checksums for the file"""
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    return parser.calculate_checksum()

@app.get("/api/disasm")
async def disassemble(offset: int = 0, count: int = 50):
    if not disasm:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    instructions = disasm.disassemble_range(offset, count)
    return {
        "offset": offset,
        "count": len(instructions),
        "instructions": [{
            "offset": i.offset,
            "bytes": i.bytes_hex,
            "mnemonic": i.mnemonic,
            "operands": i.operands,
            "comment": i.comment,
            "is_branch": i.is_branch,
            "branch_target": i.branch_target
        } for i in instructions]
    }

@app.get("/api/functions")
async def get_functions():
    """Detect and return functions"""
    if not disasm:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    functions = disasm.detect_functions()
    return {
        "count": len(functions),
        "functions": [{
            "offset": f.offset,
            "name": f.name,
            "size": f.size
        } for f in functions]
    }

@app.post("/api/functions/rename")
async def rename_function(req: FunctionRenameRequest):
    """Rename a function"""
    if not disasm:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    disasm.rename_function(req.offset, req.name)
    return {"success": True, "offset": req.offset, "name": req.name}

@app.get("/api/xrefs")
async def get_xrefs(offset: int):
    """Get cross-references to an address"""
    if not disasm:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    xrefs = disasm.get_xrefs_to(offset)
    return {
        "offset": offset,
        "count": len(xrefs),
        "xrefs": xrefs
    }

@app.post("/api/annotations/add")
async def add_annotation(req: AnnotationRequest):
    """Add annotation to an offset"""
    if not disasm:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    disasm.add_annotation(req.offset, req.text, req.type)
    return {"success": True, "offset": req.offset}

@app.delete("/api/annotations/{offset}")
async def remove_annotation(offset: int):
    """Remove annotation"""
    if not disasm:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    disasm.remove_annotation(offset)
    return {"success": True}

@app.get("/api/annotations")
async def get_annotations():
    """Get all annotations"""
    if not disasm:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    return {
        "annotations": disasm.export_annotations()
    }

@app.get("/api/download")
async def download_file():
    if not current_file:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    return StreamingResponse(
        io.BytesIO(current_file),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename=modified_{current_filename}"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
