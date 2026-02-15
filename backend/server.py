"""
ECU Calibration Tool - Backend Server
FastAPI server for ME7.4.4/ME7.4.5 calibration
"""
import os
import io
import struct
from typing import List, Dict, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ecu_parser import ME7Parser, MapDefinition
from disassembler import C166Disassembler

app = FastAPI(title="ECU Calibration Tool", version="1.0.0")

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

class HexEditRequest(BaseModel):
    offset: int
    value: int

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
    global current_file, current_filename, parser, disasm
    
    content = await file.read()
    
    # Support .hex files (Intel HEX format)
    if file.filename.lower().endswith('.hex'):
        content = parse_intel_hex(content)
    
    current_file = content
    current_filename = file.filename
    parser = ME7Parser(content)
    disasm = C166Disassembler(content)
    
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
                # Extend data if needed
                while len(data) < full_addr:
                    data.append(0xFF)
                
                for i in range(byte_count):
                    byte_val = int(line[9 + i*2:11 + i*2], 16)
                    if full_addr + i < len(data):
                        data[full_addr + i] = byte_val
                    else:
                        data.append(byte_val)
                        
            elif record_type == 0x02:  # Extended segment address
                base_addr = int(line[9:13], 16) << 4
            elif record_type == 0x04:  # Extended linear address  
                base_addr = int(line[9:13], 16) << 16
            elif record_type == 0x01:  # EOF
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
    
    # Modify byte
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
            "avg": m.avg_val
        } for m in maps]
    }

@app.post("/api/maps/get")
async def get_map(req: MapRequest):
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    m = parser.get_map_at_offset(req.offset, req.rows, req.cols)
    return {
        "offset": m.offset,
        "rows": m.rows,
        "cols": m.cols,
        "name": m.name,
        "min": m.min_val,
        "max": m.max_val,
        "avg": m.avg_val,
        "data": m.data
    }

@app.post("/api/maps/edit")
async def edit_map_cell(req: MapEditRequest):
    global current_file, parser, disasm
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    # Calculate byte offset
    cell_offset = req.offset + (req.row * req.cols + req.col) * 2
    
    # Modify word (16-bit little endian)
    data = bytearray(current_file)
    if cell_offset + 1 < len(data):
        data[cell_offset] = req.value & 0xFF
        data[cell_offset + 1] = (req.value >> 8) & 0xFF
        current_file = bytes(data)
        parser = ME7Parser(current_file)
        disasm = C166Disassembler(current_file)
    
    return {"success": True, "offset": cell_offset, "value": req.value}

@app.get("/api/singles")
async def get_single_values():
    if not parser:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    singles = parser.scan_single_values()
    return {
        "count": len(singles),
        "values": [{"offset": s.offset, "value": s.value, "name": s.name, "size": s.size} for s in singles]
    }

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
            "comment": i.comment
        } for i in instructions]
    }

@app.get("/api/functions")
async def get_functions():
    if not disasm:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    functions = disasm.find_functions()
    return {
        "count": len(functions),
        "functions": functions
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

@app.get("/api/checksum")
async def calculate_checksum():
    if not current_file:
        raise HTTPException(status_code=400, detail="No file loaded")
    
    # Simple checksums
    sum8 = sum(current_file) & 0xFF
    sum16 = sum(struct.unpack('<' + 'H' * (len(current_file) // 2), current_file[:len(current_file)//2*2])) & 0xFFFF
    
    return {
        "checksum_8bit": sum8,
        "checksum_16bit": sum16,
        "size": len(current_file)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
