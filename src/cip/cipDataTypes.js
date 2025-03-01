// cipDataTypes.js
import { Buffer } from "buffer";

// CIP基础数据类型（符合ODVA规范）
const CIP_DATA_TYPES = {
  // 基本类型
  BOOL: { code: 0xC1, size: 1, encode: (v) => Buffer.from([v ? 0xFF : 0x00]) },
  SINT: { code: 0xC2, size: 1, encode: (v) => Buffer.from([v & 0xFF]) },
  INT: { code: 0xC3, size: 2, encode: (v, isBigEndian) => {
    const buf = Buffer.alloc(2);
    isBigEndian ? buf.writeInt16BE(v) : buf.writeInt16LE(v);
    return buf;
  }},
  DINT: { code: 0xC4, size: 4, encode: (v, isBigEndian) => {
    const buf = Buffer.alloc(4);
    isBigEndian ? buf.writeInt32BE(v) : buf.writeInt32LE(v);
    return buf;
  }},
  REAL: { code: 0xCA, size: 4, encode: (v, isBigEndian) => {
    const buf = Buffer.alloc(4);
    isBigEndian ? buf.writeFloatBE(v) : buf.writeFloatLE(v);
    return buf;
  }},
  STRING: { code: 0xDA, size: null, encode: (v) => {
    const lengthBuf = Buffer.from([v.length]);
    return Buffer.concat([lengthBuf, Buffer.from(v, "ascii")]);
  }},

  // 复合类型
  ARRAY: { code: 0xE0, size: null },  // 需根据元素类型动态计算
  STRUCT: { code: 0xE1, size: null }, // 结构体

  // 扩展类型（厂商自定义）
  LREAL: { code: 0xCB, size: 8, encode: (v, isBigEndian) => {
    const buf = Buffer.alloc(8);
    isBigEndian ? buf.writeDoubleBE(v) : buf.writeDoubleLE(v);
    return buf;
  }},
};

// 数据类型解码器
class CIPDataTypeDecoder {
  static decode(typeCode, data, isBigEndian = false) {
    const type = Object.values(CIP_DATA_TYPES).find(t => t.code === typeCode);
    if (!type) throw new Error(`Unsupported CIP data type: 0x${typeCode.toString(16)}`);

    switch (typeCode) {
      case CIP_DATA_TYPES.BOOL.code:
        return data.readUInt8(0) !== 0;
      case CIP_DATA_TYPES.SINT.code:
        return data.readInt8(0);
      case CIP_DATA_TYPES.INT.code:
        return isBigEndian ? data.readInt16BE(0) : data.readInt16LE(0);
      case CIP_DATA_TYPES.DINT.code:
        return isBigEndian ? data.readInt32BE(0) : data.readInt32LE(0);
      case CIP_DATA_TYPES.REAL.code:
        return isBigEndian ? data.readFloatBE(0) : data.readFloatLE(0);
      case CIP_DATA_TYPES.STRING.code: {
        const length = data.readUInt8(0);
        return data.slice(1, 1 + length).toString("ascii");
      }
      case CIP_DATA_TYPES.ARRAY.code:
        return this.decodeArray(data, isBigEndian);
      case CIP_DATA_TYPES.STRUCT.code:
        return this.decodeStruct(data, isBigEndian);
      default:
        return data; // 返回原始Buffer供自定义处理
    }
  }

  static decodeArray(data, isBigEndian) {
    const elementType = data.readUInt16BE(0); // 数组元素类型
    const elementCount = data.readUInt16BE(2); // 元素数量
    const elements = [];
    let offset = 4;

    for (let i = 0; i < elementCount; i++) {
      const elementSize = CIP_DATA_TYPES[elementType]?.size || 0;
      const elementData = data.slice(offset, offset + elementSize);
      elements.push(this.decode(elementType, elementData, isBigEndian));
      offset += elementSize;
    }
    return elements;
  }

  static decodeStruct(data, isBigEndian) {
    const memberCount = data.readUInt16BE(0); // 结构体成员数量
    const members = [];
    let offset = 2;

    for (let i = 0; i < memberCount; i++) {
      const memberType = data.readUInt16BE(offset);
      offset += 2;
      const memberSize = CIP_DATA_TYPES[memberType]?.size || 0;
      const memberData = data.slice(offset, offset + memberSize);
      members.push({
        type: memberType,
        value: this.decode(memberType, memberData, isBigEndian),
      });
      offset += memberSize;
    }
    return members;
  }
}

export default { CIP_DATA_TYPES, CIPDataTypeDecoder };