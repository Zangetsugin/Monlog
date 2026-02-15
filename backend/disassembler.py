"""
C166/ST10 Disassembler for Bosch ME7
Simplified disassembler for Infineon C166/ST10 architecture
"""
from typing import List, Dict, Tuple
from dataclasses import dataclass

@dataclass
class Instruction:
    """Disassembled instruction"""
    offset: int
    bytes_hex: str
    mnemonic: str
    operands: str
    comment: str = ''

class C166Disassembler:
    """
    Simple C166/ST10 disassembler
    Based on Infineon C166 instruction set
    """
    
    # C166 Opcodes (simplified)
    OPCODES = {
        0x00: ('ADD', 'Rwn, Rwm'),
        0x02: ('ADD', 'Rwn, #data3'),
        0x04: ('ADD', 'Rwn, [Rwm]'),
        0x06: ('ADD', 'Rwn, #data16'),
        0x08: ('ADDB', 'Rbn, Rbm'),
        0x0A: ('ADDB', 'Rbn, #data3'),
        0x10: ('ADDC', 'Rwn, Rwm'),
        0x18: ('ADDCB', 'Rbn, Rbm'),
        0x20: ('SUB', 'Rwn, Rwm'),
        0x22: ('SUB', 'Rwn, #data3'),
        0x26: ('SUB', 'Rwn, #data16'),
        0x28: ('SUBB', 'Rbn, Rbm'),
        0x30: ('SUBC', 'Rwn, Rwm'),
        0x40: ('CMP', 'Rwn, Rwm'),
        0x42: ('CMP', 'Rwn, #data3'),
        0x46: ('CMP', 'Rwn, #data16'),
        0x48: ('CMPB', 'Rbn, Rbm'),
        0x50: ('AND', 'Rwn, Rwm'),
        0x56: ('AND', 'Rwn, #data16'),
        0x58: ('ANDB', 'Rbn, Rbm'),
        0x60: ('OR', 'Rwn, Rwm'),
        0x66: ('OR', 'Rwn, #data16'),
        0x68: ('ORB', 'Rbn, Rbm'),
        0x70: ('XOR', 'Rwn, Rwm'),
        0x76: ('XOR', 'Rwn, #data16'),
        0x78: ('XORB', 'Rbn, Rbm'),
        0x80: ('CMPI1', 'Rwn, #data4'),
        0x82: ('CMPI2', 'Rwn, #data4'),
        0x84: ('CMPD1', 'Rwn, #data4'),
        0x86: ('CMPD2', 'Rwn, #data4'),
        0x88: ('SHL', 'Rwn, Rwm'),
        0x8A: ('SHL', 'Rwn, #data4'),
        0x8C: ('SHR', 'Rwn, Rwm'),
        0x8E: ('SHR', 'Rwn, #data4'),
        0x90: ('ROL', 'Rwn, Rwm'),
        0x92: ('ROL', 'Rwn, #data4'),
        0x94: ('ROR', 'Rwn, Rwm'),
        0x96: ('ROR', 'Rwn, #data4'),
        0xA0: ('MOVB', 'Rbn, Rbm'),
        0xA2: ('MOVB', 'Rbn, #data4'),
        0xA4: ('MOVB', '[Rwn], Rbm'),
        0xA8: ('MOVBZ', 'Rwn, Rbm'),
        0xAC: ('MOVBS', 'Rwn, Rbm'),
        0xC0: ('MOVBZ', 'Rwn, #data4'),
        0xC2: ('PUSH', 'reg'),
        0xC4: ('MOV', '[Rwn], Rwm'),
        0xC8: ('MOV', 'Rwn, [Rwm]'),
        0xCA: ('CALLA', 'cc, caddr'),
        0xCC: ('POP', 'reg'),
        0xD0: ('JMPR', 'cc, rel'),
        0xD1: ('JMPR', 'cc, rel'),
        0xD4: ('JMPA', 'cc, caddr'),
        0xD7: ('CALLR', 'rel'),
        0xDA: ('CALLS', 'seg, caddr'),
        0xDB: ('RET', ''),
        0xDC: ('JMPI', 'cc, [Rwn]'),
        0xE0: ('MOV', 'Rwn, #data4'),
        0xE2: ('MOV', 'Rwn, Rwm'),
        0xE4: ('MOVB', '[Rwn+], Rbm'),
        0xE6: ('MOV', 'Rwn, #data16'),
        0xE8: ('MOV', '[Rwn], #data16'),
        0xEA: ('JMPS', 'seg, caddr'),
        0xF0: ('MOV', 'Rwn, [Rwm+]'),
        0xF2: ('MOV', 'Rwn, [Rwm]'),
        0xF4: ('MOVB', 'Rbn, [Rwm+]'),
        0xF6: ('MOV', '[Rwn], Rwm'),
        0xFA: ('EXTP', 'Rwm, #page'),
        0xFB: ('EXTS', 'Rwm, #seg'),
        0xFC: ('NOP', ''),
    }
    
    # Condition codes
    CC_CODES = {
        0x0: 'cc_UC',   # Unconditional
        0x1: 'cc_NET',  # Not equal / Not zero
        0x2: 'cc_Z',    # Zero / Equal
        0x3: 'cc_NZ',   # Not zero
        0x4: 'cc_V',    # Overflow
        0x5: 'cc_NV',   # No overflow
        0x6: 'cc_N',    # Negative
        0x7: 'cc_NN',   # Not negative
        0x8: 'cc_C',    # Carry
        0x9: 'cc_NC',   # No carry
        0xA: 'cc_SGT',  # Signed greater than
        0xB: 'cc_SLE',  # Signed less or equal
        0xC: 'cc_SLT',  # Signed less than
        0xD: 'cc_SGE',  # Signed greater or equal
        0xE: 'cc_UGT',  # Unsigned greater than
        0xF: 'cc_ULE',  # Unsigned less or equal
    }
    
    def __init__(self, data: bytes):
        self.data = data
        self.size = len(data)
    
    def read_byte(self, offset: int) -> int:
        if offset >= self.size:
            return 0
        return self.data[offset]
    
    def read_word(self, offset: int) -> int:
        if offset + 1 >= self.size:
            return 0
        return self.data[offset] | (self.data[offset + 1] << 8)
    
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
        
        # Try to decode
        if opcode in self.OPCODES:
            mnemonic, operands_fmt = self.OPCODES[opcode]
            
            # Determine instruction size and decode operands
            if 'data16' in operands_fmt or 'caddr' in operands_fmt:
                inst_size = 4
                if offset + 3 < self.size:
                    data16 = self.read_word(offset + 2)
                    reg = self.read_byte(offset + 1)
                    operands = operands_fmt.replace('#data16', f'#0x{data16:04X}')
                    operands = operands.replace('caddr', f'0x{data16:04X}')
                    operands = operands.replace('Rwn', f'R{reg & 0xF}')
                    operands = operands.replace('Rwm', f'R{(reg >> 4) & 0xF}')
            elif 'rel' in operands_fmt:
                inst_size = 2
                rel = self.read_byte(offset + 1)
                # Signed relative
                if rel > 127:
                    rel = rel - 256
                target = offset + 2 + rel * 2
                cc = (opcode >> 4) & 0xF
                cc_name = self.CC_CODES.get(cc, 'cc_?')
                operands = f'{cc_name}, 0x{target:04X}'
            elif 'data4' in operands_fmt or 'data3' in operands_fmt:
                inst_size = 2
                byte2 = self.read_byte(offset + 1)
                data = byte2 & 0xF
                reg = (byte2 >> 4) & 0xF
                operands = operands_fmt.replace('#data4', f'#{data}')
                operands = operands.replace('#data3', f'#{data}')
                operands = operands.replace('Rwn', f'R{reg}')
                operands = operands.replace('Rbn', f'RL{reg}')
            elif operands_fmt:
                inst_size = 2
                byte2 = self.read_byte(offset + 1)
                rn = byte2 & 0xF
                rm = (byte2 >> 4) & 0xF
                operands = operands_fmt.replace('Rwn', f'R{rn}')
                operands = operands.replace('Rwm', f'R{rm}')
                operands = operands.replace('Rbn', f'RL{rn}')
                operands = operands.replace('Rbm', f'RL{rm}')
                operands = operands.replace('reg', f'R{byte2 & 0xF}')
            else:
                inst_size = 2
        
        # Build hex string
        bytes_hex = ' '.join(f'{self.read_byte(offset + i):02X}' for i in range(inst_size))
        
        return Instruction(
            offset=offset,
            bytes_hex=bytes_hex,
            mnemonic=mnemonic,
            operands=operands,
            comment=comment
        ), inst_size
    
    def disassemble_range(self, start: int, count: int = 50) -> List[Instruction]:
        """Disassemble a range of instructions"""
        instructions = []
        offset = start
        
        while len(instructions) < count and offset < self.size:
            inst, size = self.disassemble_instruction(offset)
            instructions.append(inst)
            offset += max(size, 1)  # At least 1 byte
        
        return instructions
    
    def find_functions(self) -> List[Dict]:
        """Find potential function entry points"""
        functions = []
        
        for offset in range(0, self.size - 4, 2):
            # Look for CALL targets
            opcode = self.read_byte(offset)
            
            # Common function prologue patterns
            if opcode == 0xC2:  # PUSH
                # Check if followed by more PUSHes or MOV
                next_op = self.read_byte(offset + 2)
                if next_op in [0xC2, 0xE6, 0xF0]:
                    functions.append({
                        'offset': offset,
                        'name': f'sub_{offset:04X}',
                        'type': 'detected'
                    })
        
        return functions[:100]  # Limit results
