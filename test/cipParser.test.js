/* 
  The test suite covers:

  Path Building:
  – Validates that object paths are built correctly for complete or partial inputs.
  – Ensures that invalid or missing IDs trigger appropriate errors.

  Data Encoding:
  – Verifies encoding for different CIP data types (BOOL, SINT, INT, DINT/REAL, and STRING).
  – Checks that unsupported data types cause errors.

  Response Parsing:
  – Tests that valid attribute responses are decoded correctly (by stubbing the decoder).
  – Checks that error responses and improperly formatted responses result in thrown errors.

  Set Attribute Response:
  – Ensures that a successful response is recognized and errors are thrown for invalid responses.

  Complex Data Decoding:
  – Verifies that the complex data decoding method calls the underlying decoder as expected.
*/

const { expect } = require("chai");
const sinon = require("sinon");

const CIPParser = require("../cipParser").default;
const cipDataTypes = require("../cipDataTypes");
const cipErrorCodes = require("../cipErrorCodes");
const { CIP_DATA_TYPES, CIPDataTypeDecoder } = cipDataTypes;
const { CIPErrorParser } = cipErrorCodes;

describe("CIPParser", function () {
  describe("buildObjectPath", function () {
    it("should build a valid object path for valid IDs", function () {
      const path = CIPParser.buildObjectPath(1, 2, 3);
      expect(path).to.be.instanceof(Buffer);
      const expected = Buffer.from([0x20, 1, 0x24, 2, 0x30, 3]);
      expect(path.equals(expected)).to.be.true;
    });

    it("should build an object path when only classId is provided", function () {
      const path = CIPParser.buildObjectPath(10, undefined, undefined);
      const expected = Buffer.from([0x20, 10]);
      expect(path.equals(expected)).to.be.true;
    });

    it("should throw an error for invalid IDs", function () {
      expect(() => CIPParser.buildObjectPath(-1, 2, 3)).to.throw();
      expect(() => CIPParser.buildObjectPath(1, 70000, 3)).to.throw();
    });

    it("should throw an error if no IDs are provided", function () {
      expect(() => CIPParser.buildObjectPath()).to.throw(
        "At least one of classId, instanceId, or attributeId must be provided"
      );
    });
  });

  describe("encodeData", function () {
    it("should encode boolean values", function () {
      const trueBuf = CIPParser.encodeData(true, CIP_DATA_TYPES.BOOL);
      expect(trueBuf).to.deep.equal(Buffer.from([0xFF]));
      const falseBuf = CIPParser.encodeData(false, CIP_DATA_TYPES.BOOL);
      expect(falseBuf).to.deep.equal(Buffer.from([0x00]));
    });

    it("should encode SINT values", function () {
      const buf = CIPParser.encodeData(0xAB, CIP_DATA_TYPES.SINT);
      expect(buf).to.deep.equal(Buffer.from([0xAB & 0xFF]));
    });

    it("should encode INT values (little endian)", function () {
      const value = 0x1234;
      const buf = CIPParser.encodeData(value, CIP_DATA_TYPES.INT, false);
      const expected = Buffer.from([0x34, 0x12]);
      expect(buf).to.deep.equal(expected);
    });

    it("should encode INT values (big endian)", function () {
      const value = 0x1234;
      const buf = CIPParser.encodeData(value, CIP_DATA_TYPES.INT, true);
      const expected = Buffer.from([0x12, 0x34]);
      expect(buf).to.deep.equal(expected);
    });

    it("should encode DINT/REAL values (little endian)", function () {
      const value = 0x12345678;
      const buf = CIPParser.encodeData(value, CIP_DATA_TYPES.DINT, false);
      const expected = Buffer.alloc(4);
      expected.writeInt32LE(value, 0);
      expect(buf).to.deep.equal(expected);
    });

    it("should encode DINT/REAL values (big endian)", function () {
      const value = 0x12345678;
      const buf = CIPParser.encodeData(value, CIP_DATA_TYPES.DINT, true);
      const expected = Buffer.alloc(4);
      expected.writeInt32BE(value, 0);
      expect(buf).to.deep.equal(expected);
    });

    it("should encode STRING values", function () {
      const testStr = "Hello CIP";
      const buf = CIPParser.encodeData(testStr, CIP_DATA_TYPES.STRING);
      const lengthByte = buf[0];
      const strBuf = buf.slice(1);
      expect(lengthByte).to.equal(testStr.length);
      expect(strBuf.toString("ascii")).to.equal(testStr);
    });

    it("should truncate STRING values longer than 255 characters", function () {
      const longStr = "a".repeat(300);
      const buf = CIPParser.encodeData(longStr, CIP_DATA_TYPES.STRING);
      const lengthByte = buf[0];
      expect(lengthByte).to.equal(255);
      const strBuf = buf.slice(1);
      expect(strBuf.length).to.equal(255);
    });

    it("should throw an error for unsupported data types", function () {
      const unsupportedType = { code: 0xFFFF };
      expect(() => CIPParser.encodeData(123, unsupportedType)).to.throw("Unsupported data type");
    });
  });

  describe("parseAttributeResponse", function () {
    let decodeStub;
    beforeEach(function () {
      decodeStub = sinon.stub(CIPDataTypeDecoder, "decode");
    });
    afterEach(function () {
      decodeStub.restore();
    });

    it("should parse a valid response", function () {
      // Construct a fake response: status 0, then data type (2 bytes) and data.
      const fakeDataType = 0x1234;
      const fakeData = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
      const header = Buffer.alloc(4);
      header.writeUInt8(0x00, 0);
      header.writeUInt16BE(fakeDataType, 2);
      const fullResponse = Buffer.concat([header, fakeData]);
      decodeStub.returns("decodedValue");

      const result = CIPParser.parseAttributeResponse(fullResponse, false);
      expect(result).to.have.property("dataType", fakeDataType);
      expect(result).to.have.property("value", "decodedValue");
      expect(decodeStub.calledOnceWith(fakeDataType, fakeData, false)).to.be.true;
    });

    it("should throw an error if response length is less than 4 bytes", function () {
      const shortResponse = Buffer.from([0x00, 0x01, 0x02]);
      expect(() => CIPParser.parseAttributeResponse(shortResponse)).to.throw("Invalid response length");
    });

    it("should throw an error if status is not 0", function () {
      const response = Buffer.alloc(4);
      response.writeUInt8(0x01, 0); // error status
      response.writeUInt16BE(0x1234, 1);
      const fakeError = new Error("Test error");
      sinon.stub(CIPErrorParser, "parse").returns(fakeError);

      expect(() => CIPParser.parseAttributeResponse(response)).to.throw("Test error");
      CIPErrorParser.parse.restore();
    });

    it("should throw an error if response is not a Buffer", function () {
      expect(() => CIPParser.parseAttributeResponse("not a buffer")).to.throw("Response must be a Buffer");
    });

    it("should attach rawData to decode error", function () {
      const fakeDataType = 0x5678;
      const fakeData = Buffer.from([0xaa, 0xbb]);
      const header = Buffer.alloc(4);
      header.writeUInt8(0x00, 0);
      header.writeUInt16BE(fakeDataType, 2);
      const fullResponse = Buffer.concat([header, fakeData]);
      const decodeError = new Error("Decode failed");
      decodeStub.throws(decodeError);

      try {
        CIPParser.parseAttributeResponse(fullResponse);
      } catch (err) {
        expect(err).to.equal(decodeError);
        expect(err.rawData).to.equal(fakeData.toString("hex"));
      }
    });
  });

  describe("parseSetAttributeResponse", function () {
    it("should return success for a valid set attribute response", function () {
      const response = Buffer.from([0x00]);
      const result = CIPParser.parseSetAttributeResponse(response);
      expect(result).to.deep.equal({ success: true });
    });

    it("should throw an error for an empty response", function () {
      const emptyResponse = Buffer.alloc(0);
      expect(() => CIPParser.parseSetAttributeResponse(emptyResponse)).to.throw("Empty response for set attribute");
    });

    it("should throw an error if status is not 0", function () {
      const response = Buffer.from([0x01]);
      const fakeError = new Error("Set attribute failed");
      sinon.stub(CIPErrorParser, "parse").returns(fakeError);
      expect(() => CIPParser.parseSetAttributeResponse(response)).to.throw("Set attribute failed");
      CIPErrorParser.parse.restore();
    });

    it("should throw an error if response is not a Buffer", function () {
      expect(() => CIPParser.parseSetAttributeResponse("not a buffer")).to.throw("Response must be a Buffer");
    });
  });

  describe("decodeComplexData", function () {
    it("should decode complex data using CIPDataTypeDecoder", function () {
      const fakeTypeCode = 0x9999;
      const fakeData = Buffer.from([0x01, 0x02]);
      const stub = sinon.stub(CIPDataTypeDecoder, "decode").returns("complexValue");
      const result = CIPParser.decodeComplexData(fakeTypeCode, fakeData, true);
      expect(result).to.equal("complexValue");
      expect(stub.calledOnceWith(fakeTypeCode, fakeData, true)).to.be.true;
      stub.restore();
    });
  });
});
