"""
C166/ST10 Disassembler for Bosch ME7
Complete disassembler for Infineon C166/ST10 architecture
With function detection and annotations support
"""
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field

@dataclass
class Instruction:
    """Disassembled instruction"""
    offset: int
    bytes_hex: str
    mnemonic: str
    operands: str
    comment: str = ''
    is_branch: bool = False
    branch_target: int = -1

@dataclass
class Function:
    """Detected function"""
    offset: int
    name: str
    size: int
    calls: List[int] = field(default_factory=list)
    called_by: List[int] = field(default_factory=list)
    annotations: List[str] = field(default_factory=list)

@dataclass
class Annotation:
    """User annotation"""
    offset: int
    text: str
    type: str = "comment"  # comment, label, bookmark

class C166Disassembler:
    """
    Complete C166/ST10 disassembler
    Based on Infineon C166 instruction set architecture
    """
    
    # Complete C166 Opcodes
    OPCODES = {
        # Arithmetic Instructions
        0x00: ('ADD', 'Rwn, Rwm', 2),
        0x02: ('ADD', 'Rwn, #data3', 2),
        0x04: ('ADD', 'Rwn, [Rwm]', 2),
        0x06: ('ADD', 'Rwn, #data16', 4),
        0x08: ('ADDB', 'Rbn, Rbm', 2),
        0x0A: ('ADDB', 'Rbn, #data3', 2),
        0x0C: ('ADDB', 'Rbn, [Rwm]', 2),
        0x0E: ('ADDB', 'Rbn, #data16', 4),
        
        0x10: ('ADDC', 'Rwn, Rwm', 2),
        0x12: ('ADDC', 'Rwn, #data3', 2),
        0x14: ('ADDC', 'Rwn, [Rwm]', 2),
        0x16: ('ADDC', 'Rwn, #data16', 4),
        0x18: ('ADDCB', 'Rbn, Rbm', 2),
        0x1A: ('ADDCB', 'Rbn, #data3', 2),
        0x1C: ('ADDCB', 'Rbn, [Rwm]', 2),
        0x1E: ('ADDCB', 'Rbn, #data16', 4),
        
        0x20: ('SUB', 'Rwn, Rwm', 2),
        0x22: ('SUB', 'Rwn, #data3', 2),
        0x24: ('SUB', 'Rwn, [Rwm]', 2),
        0x26: ('SUB', 'Rwn, #data16', 4),
        0x28: ('SUBB', 'Rbn, Rbm', 2),
        0x2A: ('SUBB', 'Rbn, #data3', 2),
        0x2C: ('SUBB', 'Rbn, [Rwm]', 2),
        0x2E: ('SUBB', 'Rbn, #data16', 4),
        
        0x30: ('SUBC', 'Rwn, Rwm', 2),
        0x32: ('SUBC', 'Rwn, #data3', 2),
        0x34: ('SUBC', 'Rwn, [Rwm]', 2),
        0x36: ('SUBC', 'Rwn, #data16', 4),
        0x38: ('SUBCB', 'Rbn, Rbm', 2),
        0x3A: ('SUBCB', 'Rbn, #data3', 2),
        0x3C: ('SUBCB', 'Rbn, [Rwm]', 2),
        0x3E: ('SUBCB', 'Rbn, #data16', 4),
        
        # Compare Instructions
        0x40: ('CMP', 'Rwn, Rwm', 2),
        0x42: ('CMP', 'Rwn, #data3', 2),
        0x44: ('CMP', 'Rwn, [Rwm]', 2),
        0x46: ('CMP', 'Rwn, #data16', 4),
        0x48: ('CMPB', 'Rbn, Rbm', 2),
        0x4A: ('CMPB', 'Rbn, #data3', 2),
        0x4C: ('CMPB', 'Rbn, [Rwm]', 2),
        0x4E: ('CMPB', 'Rbn, #data16', 4),
        
        # Logical Instructions
        0x50: ('AND', 'Rwn, Rwm', 2),
        0x52: ('AND', 'Rwn, #data3', 2),
        0x54: ('AND', 'Rwn, [Rwm]', 2),
        0x56: ('AND', 'Rwn, #data16', 4),
        0x58: ('ANDB', 'Rbn, Rbm', 2),
        0x5A: ('ANDB', 'Rbn, #data3', 2),
        0x5C: ('ANDB', 'Rbn, [Rwm]', 2),
        0x5E: ('ANDB', 'Rbn, #data16', 4),
        
        0x60: ('OR', 'Rwn, Rwm', 2),
        0x62: ('OR', 'Rwn, #data3', 2),
        0x64: ('OR', 'Rwn, [Rwm]', 2),
        0x66: ('OR', 'Rwn, #data16', 4),
        0x68: ('ORB', 'Rbn, Rbm', 2),
        0x6A: ('ORB', 'Rbn, #data3', 2),
        0x6C: ('ORB', 'Rbn, [Rwm]', 2),
        0x6E: ('ORB', 'Rbn, #data16', 4),
        
        0x70: ('XOR', 'Rwn, Rwm', 2),
        0x72: ('XOR', 'Rwn, #data3', 2),
        0x74: ('XOR', 'Rwn, [Rwm]', 2),
        0x76: ('XOR', 'Rwn, #data16', 4),
        0x78: ('XORB', 'Rbn, Rbm', 2),
        0x7A: ('XORB', 'Rbn, #data3', 2),
        0x7C: ('XORB', 'Rbn, [Rwm]', 2),
        0x7E: ('XORB', 'Rbn, #data16', 4),
        
        # Compare and Increment/Decrement
        0x80: ('CMPI1', 'Rwn, #data4', 2),
        0x82: ('CMPI2', 'Rwn, #data4', 2),
        0x84: ('CMPD1', 'Rwn, #data4', 2),
        0x86: ('CMPD2', 'Rwn, #data4', 2),
        
        # Shift Instructions
        0x88: ('SHL', 'Rwn, Rwm', 2),
        0x8A: ('SHL', 'Rwn, #data4', 2),
        0x8C: ('SHR', 'Rwn, Rwm', 2),
        0x8E: ('SHR', 'Rwn, #data4', 2),
        0x90: ('ROL', 'Rwn, Rwm', 2),
        0x92: ('ROL', 'Rwn, #data4', 2),
        0x94: ('ROR', 'Rwn, Rwm', 2),
        0x96: ('ROR', 'Rwn, #data4', 2),
        0x98: ('ASHR', 'Rwn, Rwm', 2),
        0x9A: ('ASHR', 'Rwn, #data4', 2),
        
        # Move Instructions
        0xA0: ('MOVB', 'Rbn, Rbm', 2),
        0xA2: ('MOVB', 'Rbn, #data4', 2),
        0xA4: ('MOVB', '[Rwn], Rbm', 2),
        0xA6: ('MOVB', 'Rbm, [Rwn]', 2),
        0xA8: ('MOVBZ', 'Rwn, Rbm', 2),
        0xAA: ('MOVBZ', 'Rwn, #data4', 2),
        0xAC: ('MOVBS', 'Rwn, Rbm', 2),
        0xAE: ('MOVBS', 'Rwn, #data4', 2),
        
        # Bit Instructions
        0xB0: ('BCLR', 'bitoff.bitno', 2),
        0xB1: ('BCLR', 'bitoff.bitno', 2),
        0xB2: ('BSET', 'bitoff.bitno', 2),
        0xB3: ('BSET', 'bitoff.bitno', 2),
        0xB4: ('BCMP', 'bitoff.bitno', 2),
        0xB5: ('BCMP', 'bitoff.bitno', 2),
        0xB6: ('BMOV', 'bitoff.bn, bitoff.bm', 4),
        0xB7: ('BMOVN', 'bitoff.bn, bitoff.bm', 4),
        0xB8: ('BAND', 'bitoff.bn, bitoff.bm', 4),
        0xB9: ('BOR', 'bitoff.bn, bitoff.bm', 4),
        0xBA: ('BXOR', 'bitoff.bn, bitoff.bm', 4),
        0xBB: ('BFLDH', 'bitoff, #mask, #data', 4),
        0xBC: ('BFLDL', 'bitoff, #mask, #data', 4),
        
        # More Move Instructions
        0xC0: ('MOVBZ', 'Rwn, #data4', 2),
        0xC2: ('PUSH', 'reg', 2),
        0xC4: ('MOV', '[Rwn], Rwm', 2),
        0xC6: ('MOV', 'Rwm, [Rwn]', 2),
        0xC8: ('MOV', 'Rwn, [Rwm+]', 2),
        0xCA: ('CALLA', 'cc, caddr', 4),
        0xCC: ('POP', 'reg', 2),
        0xCE: ('SCXT', 'reg, #data16', 4),
        
        # Branch Instructions
        0x0D: ('JMPR', 'cc_UC, rel', 2),
        0x1D: ('JMPR', 'cc_NET, rel', 2),
        0x2D: ('JMPR', 'cc_Z, rel', 2),
        0x3D: ('JMPR', 'cc_NZ, rel', 2),
        0x4D: ('JMPR', 'cc_V, rel', 2),
        0x5D: ('JMPR', 'cc_NV, rel', 2),
        0x6D: ('JMPR', 'cc_N, rel', 2),
        0x7D: ('JMPR', 'cc_NN, rel', 2),
        0x8D: ('JMPR', 'cc_C, rel', 2),
        0x9D: ('JMPR', 'cc_NC, rel', 2),
        0xAD: ('JMPR', 'cc_SGT, rel', 2),
        0xBD: ('JMPR', 'cc_SLE, rel', 2),
        0xCD: ('JMPR', 'cc_SLT, rel', 2),
        0xDD: ('JMPR', 'cc_SGE, rel', 2),
        0xED: ('JMPR', 'cc_UGT, rel', 2),
        0xFD: ('JMPR', 'cc_ULE, rel', 2),
        
        0xD4: ('JMPA', 'cc, caddr', 4),
        0xD5: ('JMPA', 'cc, caddr', 4),
        0xD7: ('CALLR', 'rel', 2),
        0xDA: ('CALLS', 'seg, caddr', 4),
        0xDB: ('RET', '', 2),
        0xDC: ('JMPI', 'cc, [Rwn]', 2),
        0xDF: ('RETS', '', 2),
        
        # More Move Instructions
        0xE0: ('MOV', 'Rwn, #data4', 2),
        0xE2: ('MOV', 'Rwn, Rwm', 2),
        0xE4: ('MOVB', '[Rwn+], Rbm', 2),
        0xE6: ('MOV', 'Rwn, #data16', 4),
        0xE8: ('MOV', '[Rwn], #data16', 4),
        0xEA: ('JMPS', 'seg, caddr', 4),
        0xEB: ('JMPS', 'seg, caddr', 4),
        0xEC: ('MOVB', 'Rbn, [Rwm+]', 2),
        0xEE: ('MOVB', 'Rbn, #data16', 4),
        
        0xF0: ('MOV', 'Rwn, [Rwm+]', 2),
        0xF2: ('MOV', 'Rwn, [Rwm]', 2),
        0xF4: ('MOVB', 'Rbn, [Rwm]', 2),
        0xF6: ('MOV', '[Rwn], Rwm', 2),
        0xF8: ('MOV', '[Rwn+], Rwm', 2),
        0xFA: ('EXTP', 'Rwm, #page', 4),
        0xFB: ('EXTS', 'Rwm, #seg', 4),
        0xFC: ('NOP', '', 2),
        0xFE: ('SRST', '', 4),
        0xFF: ('IDLE', '', 4),
        
        # Multiplication/Division
        0x0B: ('MUL', 'Rwn, Rwm', 2),
        0x1B: ('MULU', 'Rwn, Rwm', 2),
        0x2B: ('DIV', 'Rwn', 2),
        0x3B: ('DIVU', 'Rwn', 2),
        0x4B: ('DIVL', 'Rwn', 2),
        0x5B: ('DIVLU', 'Rwn', 2),
        
        # Negation/Complement
        0x01: ('NEG', 'Rwn', 2),
        0x11: ('NEGB', 'Rbn', 2),
        0x21: ('CPL', 'Rwn', 2),
        0x31: ('CPLB', 'Rbn', 2),
        
        # Trap and Interrupt
        0x9B: ('TRAP', '#trap7', 2),
        0xAB: ('EINIT', '', 2),
        0xBB: ('RETI', '', 2),
        0xCB: ('DISWDT', '', 4),
        0xEB: ('SRVWDT', '', 4),
    }
    
    # Condition codes
    CC_CODES = {
        0x0: 'cc_UC',    # Unconditional
        0x1: 'cc_NET',   # Not equal / Not zero
        0x2: 'cc_Z',     # Zero / Equal
        0x3: 'cc_NZ',    # Not zero
        0x4: 'cc_V',     # Overflow
        0x5: 'cc_NV',    # No overflow
        0x6: 'cc_N',     # Negative
        0x7: 'cc_NN',    # Not negative
        0x8: 'cc_C',     # Carry
        0x9: 'cc_NC',    # No carry
        0xA: 'cc_SGT',   # Signed greater than
        0xB: 'cc_SLE',   # Signed less or equal
        0xC: 'cc_SLT',   # Signed less than
        0xD: 'cc_SGE',   # Signed greater or equal
        0xE: 'cc_UGT',   # Unsigned greater than
        0xF: 'cc_ULE',   # Unsigned less or equal
    }
    
    # Special Function Registers (SFRs) for ME7
    SFR_NAMES = {
        0xFE00: 'DPP0',
        0xFE02: 'DPP1',
        0xFE04: 'DPP2',
        0xFE06: 'DPP3',
        0xFE08: 'CSP',
        0xFE0A: 'MDH',
        0xFE0C: 'MDL',
        0xFE0E: 'CP',
        0xFE10: 'SP',
        0xFE12: 'STKOV',
        0xFE14: 'STKUN',
        0xFE16: 'ADDRSEL1',
        0xFE18: 'ADDRSEL2',
        0xFE1A: 'ADDRSEL3',
        0xFE1C: 'ADDRSEL4',
        0xFF00: 'P0L',
        0xFF02: 'P0H',
        0xFF04: 'P1L',
        0xFF06: 'P1H',
        0xFF10: 'ADDAT',
        0xFF12: 'ADCON',
        0xFFAC: 'TFR',
        0xFFAE: 'WDT',
    }
    
    def __init__(self, data: bytes):
        self.data = data
        self.size = len(data)
        self.annotations: Dict[int, Annotation] = {}
        self.functions: Dict[int, Function] = {}
        self._detected_functions = False
    
    def read_byte(self, offset: int) -> int:
        if offset >= self.size:
            return 0
        return self.data[offset]
    
    def read_word(self, offset: int) -> int:
        if offset + 1 >= self.size:
            return 0
        return self.data[offset] | (self.data[offset + 1] << 8)
    
    def add_annotation(self, offset: int, text: str, ann_type: str = "comment"):
        """Add user annotation"""
        self.annotations[offset] = Annotation(offset, text, ann_type)
    
    def remove_annotation(self, offset: int):
        """Remove annotation"""
        if offset in self.annotations:
            del self.annotations[offset]
    
    def get_sfr_name(self, addr: int) -> Optional[str]:
        """Get Special Function Register name"""
        return self.SFR_NAMES.get(addr)
    
    def disassemble_instruction(self, offset: int) -> Tuple[Instruction, int]:
        """Disassemble single instruction, return instruction and size"""
        if offset >= self.size:
            return Instruction(offset, '', 'END', '', 'End of data'), 0
        
        opcode = self.read_byte(offset)
        
        # Default: unknown instruction
        mnemonic = 'DB'
        operands = f'0x{opcode:02X}'
        comment = ''
        inst_size = 1
        is_branch = False
        branch_target = -1
        
        # Check for annotation
        if offset in self.annotations:
            comment = self.annotations[offset].text
        
        # Try to decode
        if opcode in self.OPCODES:
            mnemonic, operands_fmt, inst_size = self.OPCODES[opcode]
            
            # Branch/Jump instructions
            if mnemonic in ['JMPR', 'CALLR']:
                is_branch = True
                rel = self.read_byte(offset + 1)
                if rel > 127:
                    rel = rel - 256
                branch_target = offset + 2 + rel * 2
                operands = operands_fmt.replace('rel', f'0x{branch_target:04X}')
                
            elif mnemonic in ['JMPA', 'CALLA', 'JMPS', 'CALLS']:
                is_branch = True
                if inst_size >= 4:
                    addr = self.read_word(offset + 2)
                    branch_target = addr
                    operands = operands_fmt.replace('caddr', f'0x{addr:04X}')
                    # Check if target is a known function
                    if addr in self.functions:
                        comment = f"; -> {self.functions[addr].name}"
                        
            elif mnemonic in ['RET', 'RETS', 'RETI']:
                is_branch = True
                comment = "; Return"
                
            elif 'data16' in operands_fmt:
                if offset + 3 < self.size:
                    data16 = self.read_word(offset + 2)
                    reg = self.read_byte(offset + 1)
                    operands = operands_fmt.replace('#data16', f'#0x{data16:04X}')
                    operands = operands.replace('Rwn', f'R{reg & 0xF}')
                    operands = operands.replace('Rwm', f'R{(reg >> 4) & 0xF}')
                    operands = operands.replace('Rbn', f'RL{reg & 0xF}')
                    # Check for SFR access
                    sfr_name = self.get_sfr_name(data16)
                    if sfr_name:
                        comment = f"; {sfr_name}"
                        
            elif 'data4' in operands_fmt or 'data3' in operands_fmt:
                byte2 = self.read_byte(offset + 1)
                data = byte2 & 0xF
                reg = (byte2 >> 4) & 0xF
                operands = operands_fmt.replace('#data4', f'#{data}')
                operands = operands.replace('#data3', f'#{data}')
                operands = operands.replace('Rwn', f'R{reg}')
                operands = operands.replace('Rbn', f'RL{reg}')
                
            elif operands_fmt:
                byte2 = self.read_byte(offset + 1)
                rn = byte2 & 0xF
                rm = (byte2 >> 4) & 0xF
                operands = operands_fmt.replace('Rwn', f'R{rn}')
                operands = operands.replace('Rwm', f'R{rm}')
                operands = operands.replace('Rbn', f'RL{rn}')
                operands = operands.replace('Rbm', f'RL{rm}')
                operands = operands.replace('reg', f'R{byte2 & 0xF}')
            else:
                pass
        
        # Build hex string
        bytes_hex = ' '.join(f'{self.read_byte(offset + i):02X}' for i in range(inst_size))
        
        return Instruction(
            offset=offset,
            bytes_hex=bytes_hex,
            mnemonic=mnemonic,
            operands=operands,
            comment=comment,
            is_branch=is_branch,
            branch_target=branch_target
        ), inst_size
    
    def disassemble_range(self, start: int, count: int = 50) -> List[Instruction]:
        """Disassemble a range of instructions"""
        instructions = []
        offset = start
        
        while len(instructions) < count and offset < self.size:
            inst, size = self.disassemble_instruction(offset)
            
            # Add function label if this is a function start
            if offset in self.functions:
                inst.comment = f"; === {self.functions[offset].name} ===" + (f" {inst.comment}" if inst.comment else "")
            
            instructions.append(inst)
            offset += max(size, 1)
        
        return instructions
    
    def detect_functions(self) -> List[Function]:
        """Detect function entry points and boundaries"""
        if self._detected_functions:
            return list(self.functions.values())
        
        functions = []
        call_targets = set()
        
        # First pass: find all CALL targets
        offset = 0
        while offset < self.size - 4:
            opcode = self.read_byte(offset)
            
            if opcode == 0xCA:  # CALLA
                target = self.read_word(offset + 2)
                call_targets.add(target)
                offset += 4
            elif opcode == 0xDA:  # CALLS
                target = self.read_word(offset + 2)
                call_targets.add(target)
                offset += 4
            elif opcode == 0xD7:  # CALLR
                rel = self.read_byte(offset + 1)
                if rel > 127:
                    rel = rel - 256
                target = offset + 2 + rel * 2
                call_targets.add(target)
                offset += 2
            else:
                offset += 1
        
        # Second pass: identify function prologues
        for offset in range(0, self.size - 4, 2):
            opcode = self.read_byte(offset)
            
            is_function = False
            
            # Check if this is a CALL target
            if offset in call_targets:
                is_function = True
            
            # Check for common function prologues
            # PUSH reg
            if opcode == 0xC2:
                next_op = self.read_byte(offset + 2) if offset + 2 < self.size else 0
                if next_op in [0xC2, 0xE6, 0xF0, 0xC4]:  # More PUSHes or MOVs
                    is_function = True
            
            # SCXT (save context)
            if opcode == 0xCE:
                is_function = True
            
            if is_function:
                func_name = f'sub_{offset:04X}'
                
                # Try to estimate function size (until RET/RETS)
                func_size = 0
                scan_offset = offset
                while scan_offset < min(offset + 1000, self.size):
                    scan_op = self.read_byte(scan_offset)
                    if scan_op in [0xDB, 0xDF]:  # RET, RETS
                        func_size = scan_offset - offset + 2
                        break
                    scan_offset += 1
                
                func = Function(
                    offset=offset,
                    name=func_name,
                    size=func_size,
                    calls=[],
                    called_by=[],
                    annotations=[]
                )
                functions.append(func)
                self.functions[offset] = func
        
        self._detected_functions = True
        return functions
    
    def get_function_at(self, offset: int) -> Optional[Function]:
        """Get function containing the given offset"""
        for func in self.functions.values():
            if func.offset <= offset < func.offset + func.size:
                return func
        return None
    
    def rename_function(self, offset: int, new_name: str):
        """Rename a function"""
        if offset in self.functions:
            self.functions[offset].name = new_name
    
    def get_xrefs_to(self, offset: int) -> List[int]:
        """Get cross-references to an address"""
        xrefs = []
        scan_offset = 0
        
        while scan_offset < self.size - 4:
            opcode = self.read_byte(scan_offset)
            
            target = -1
            
            if opcode == 0xCA or opcode == 0xDA:  # CALLA, CALLS
                target = self.read_word(scan_offset + 2)
                inst_size = 4
            elif opcode == 0xD7:  # CALLR
                rel = self.read_byte(scan_offset + 1)
                if rel > 127:
                    rel = rel - 256
                target = scan_offset + 2 + rel * 2
                inst_size = 2
            elif opcode in [0xD4, 0xD5]:  # JMPA
                target = self.read_word(scan_offset + 2)
                inst_size = 4
            elif (opcode & 0x0F) == 0x0D:  # JMPR variants
                rel = self.read_byte(scan_offset + 1)
                if rel > 127:
                    rel = rel - 256
                target = scan_offset + 2 + rel * 2
                inst_size = 2
            else:
                inst_size = 1
            
            if target == offset:
                xrefs.append(scan_offset)
            
            scan_offset += inst_size
        
        return xrefs
    
    def export_annotations(self) -> List[Dict]:
        """Export all annotations"""
        return [
            {
                "offset": ann.offset,
                "text": ann.text,
                "type": ann.type
            }
            for ann in self.annotations.values()
        ]
    
    def import_annotations(self, annotations: List[Dict]):
        """Import annotations"""
        for ann in annotations:
            self.annotations[ann["offset"]] = Annotation(
                offset=ann["offset"],
                text=ann["text"],
                type=ann.get("type", "comment")
            )
