import { Buffer } from "buffer";
const debug = require("debug")("cip:parser");
const log = debug; // alias for clarity

import cipDataTypes from "./cipDataTypes";
const { CIP_DATA_TYPES, CIPDataTypeDecoder } = cipDataTypes;
import cipErrorCodes from "./cipErrorCodes";
const { CIPErrorParser } = cipErrorCodes;

// Path segment type constants
const PATH_SEGMENTS = {
  CLASS: 0x20,
  INSTANCE: 0x24,
  ATTRIBUTE: 0x30
};

class CIPParser {
  /**
   * Constructs an object path Buffer from provided class, instance, and attribute IDs.
   * At least one identifier must be provided.
   *
   * @param {number} classId - The class ID.
   * @param {number} instanceId - The instance ID.
   * @param {number} attributeId - The attribute ID.
   * @returns {Buffer} The constructed object path.
   * @throws {Error} If an ID is invalid or if none are provided.
   */
  static buildObjectPath(classId, instanceId, attributeId) {
    const validateId = (id, name) => {
      if (id === undefined || id === null) return false;
      if (!Number.isInteger(id) || id < 0 || id > 0xFFFF) {
        throw new Error(`Invalid ${name} ID: Must be an integer between 0 and 65535`);
      }
      return true;
    };

    const hasValidId =
      validateId(classId, "Class") ||
      validateId(instanceId, "Instance") ||
      validateId(attributeId, "Attribute");

    if (!hasValidId) {
      throw new Error("At least one of classId, instanceId, or attributeId must be provided");
    }

    const path = [];
    if (classId !== undefined && classId !== null) {
      path.push(PATH_SEGMENTS.CLASS, classId);
    }
    if (instanceId !== undefined && instanceId !== null) {
      path.push(PATH_SEGMENTS.INSTANCE, instanceId);
    }
    if (attributeId !== undefined && attributeId !== null) {
      path.push(PATH_SEGMENTS.ATTRIBUTE, attributeId);
    }
    const buffer = Buffer.from(path);
    log("Built object path: %s", buffer.toString("hex"));
    return buffer;
  }

  /**
   * Encodes a value into a Buffer using the specified CIP data type.
   *
   * @param {*} value - The value to encode.
   * @param {Object} dataType - The CIP data type object.
   * @param {boolean} [isBigEndian=false] - Whether to encode using big-endian byte order.
   * @returns {Buffer} The encoded data.
   * @throws {Error} If the data type is unsupported.
   */
  static encodeData(value, dataType = CIP_DATA_TYPES.DINT, isBigEndian = false) {
    const throwUnsupported = (type) => {
      throw new Error(`Unsupported data type: 0x${type.toString(16)}`);
    };

    switch (dataType.code) {
      case CIP_DATA_TYPES.BOOL.code:
        return Buffer.from([value ? 0xFF : 0x00]);

      case CIP_DATA_TYPES.SINT.code:
        return Buffer.from([value & 0xFF]);

      case CIP_DATA_TYPES.INT.code:
        return isBigEndian
          ? Buffer.from([(value >> 8) & 0xFF, value & 0xFF])
          : Buffer.from([value & 0xFF, (value >> 8) & 0xFF]);

      case CIP_DATA_TYPES.DINT.code:
      case CIP_DATA_TYPES.REAL.code: {
        const buf = Buffer.alloc(4);
        isBigEndian
          ? buf.writeInt32BE(value, 0)
          : buf.writeInt32LE(value, 0);
        return buf;
      }

      case CIP_DATA_TYPES.STRING.code: {
        const maxLength = 255;
        const str = String(value).substring(0, maxLength);
        const strBuffer = Buffer.from(str, "ascii");
        // Prefix the string with its length
        return Buffer.concat([Buffer.from([strBuffer.length]), strBuffer]);
      }

      default:
        throwUnsupported(dataType.code);
    }
  }

  /**
   * Parses a CIP attribute response Buffer.
   *
   * @param {Buffer} response - The response Buffer.
   * @param {boolean} [isBigEndian=false] - Whether the contained data is big-endian.
   * @returns {Object} An object with the data type and decoded value.
   * @throws {Error} If the response is invalid or indicates an error.
   */
  static parseAttributeResponse(response, isBigEndian = false) {
    // 当解析到连接类(0x06)时
    if (classId === CIP_CLASS_IDS.CONNECTION) {
      const connStatus = response.readUInt16BE(4);
      return {
        // 使用CipConnFields的位域常量解析状态
        isRedundant: !!(connStatus & CipConnOwner.REDUNDANT_OWNER),
        transportClass: connStatus & 0x000F
      };
    }

    if (!Buffer.isBuffer(response)) {
      throw new Error("Response must be a Buffer");
    }
    if (response.length < 4) {
      throw new Error(`Invalid response length: ${response.length} bytes`);
    }

    const status = response.readUInt8(0);
    if (status !== 0x00) {
      const extendedStatus = response.length >= 3 ? response.readUInt16BE(1) : 0;
      const error = CIPErrorParser.parse(status, extendedStatus);
      error.rawResponse = response.toString("hex");
      throw error;
    }

    const dataTypeCode = response.readUInt16BE(2);
    const data = response.slice(4);

    try {
      const value = CIPDataTypeDecoder.decode(dataTypeCode, data, isBigEndian);
      return {
        dataType: dataTypeCode,
        value: value
      };
    } catch (decodeError) {
      decodeError.rawData = data.toString("hex");
      throw decodeError;
    }
  }

  /**
   * Parses a CIP set attribute response.
   *
   * @param {Buffer} response - The response Buffer.
   * @returns {Object} An object indicating a successful operation.
   * @throws {Error} If the response indicates an error.
   */
  static parseSetAttributeResponse(response) {
    if (!Buffer.isBuffer(response)) {
      throw new Error("Response must be a Buffer");
    }
    if (response.length < 1) {
      throw new Error("Empty response for set attribute");
    }

    const status = response.readUInt8(0);
    if (status !== 0x00) {
      const error = CIPErrorParser.parse(status);
      error.operation = "SET_ATTRIBUTE";
      throw error;
    }

    return { success: true };
  }

  /**
   * Decodes complex CIP data.
   *
   * @param {number} typeCode - The CIP data type code.
   * @param {Buffer} data - The Buffer containing the data.
   * @param {boolean} [isBigEndian=false] - Whether the data is big-endian.
   * @returns {*} The decoded value.
   */
  static decodeComplexData(typeCode, data, isBigEndian = false) {
    return CIPDataTypeDecoder.decode(typeCode, data, isBigEndian);
  }
}

export default CIPParser;
