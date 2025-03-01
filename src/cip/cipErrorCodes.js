// cipErrorCodes.js
const CIP_ERROR_CODES = {
    // 标准错误码（Volume 1, Appendix B）
    0x00: { name: "Success", description: "Operation successful" },
    0x01: { name: "ConnectionFailure", description: "Connection failed" },
    0x02: { name: "ResourceUnavailable", description: "Resource unavailable" },
    0x03: { name: "InvalidParameter", description: "Invalid parameter" },
    0x04: { name: "PathSegmentError", description: "Path segment error" },
    0x05: { name: "PathDestinationUnknown", description: "Destination path unknown" },
    0x06: { name: "PartialTransfer", description: "Partial data transfer" },
    0x07: { name: "ConnectionLost", description: "Connection lost" },
    0x08: { name: "ServiceNotSupported", description: "Service not supported" },
    0x09: { name: "InvalidAttributeValue", description: "Invalid attribute value" },
    0x0A: { name: "AttributeListError", description: "Attribute list error" },
    0x0B: { name: "AlreadyInRequestedMode", description: "Already in requested mode" },
    0x0C: { name: "ObjectStateConflict", description: "Object state conflict" },
    0x0D: { name: "ObjectAlreadyExists", description: "Object already exists" },
    0x0E: { name: "AttributeNotSettable", description: "Attribute not settable" },
    0x0F: { name: "PrivilegeViolation", description: "Insufficient privileges" },
    0x10: { name: "DevInWrongState", description: "Device is not in the correct mode" },
    0x11: { name: "ReplyDataTooLarge", description: "Response data packet is too large" },
    0x12: { name: "FragmentPrimitive", description: "Primitive value will be fragmented" },
    0x13: { name: "ConfigTooSmall", description: "Service did not provide enough data" },
    0x14: { name: "UndefinedAttr", description: "Attribute not supported in FIND" },
    0x15: { name: "ConfigTooBig", description: "Service provided data exceeds expectations" },
    0x16: { name: "ObjDoesNotExist", description: "Specified object does not exist" },
    0x17: { name: "NoFragmentation", description: "Fragmentation not activated" },
    0x18: { name: "DataNotSaved", description: "Attribute data not saved" },
    0x19: { name: "DataWriteFailure", description: "Attribute data write failure" },
    0x1A: { name: "RequestTooLarge", description: "Routing failure: request too large" },
    0x1B: { name: "ResponseTooLarge", description: "Routing failure: response too large" },
    0x1C: { name: "MissingListData", description: "Attribute data not found in the list" },
    0x1D: { name: "InvalidListStatus", description: "Returned attribute status list" },
    0x1E: { name: "ServiceError", description: "Embedded service failure" },
    0x1F: { name: "ConnRelatedFailure", description: "Connection handling error" },
    0x20: { name: "InvalidParameter", description: "Error in parameters associated with the request" },
    0x21: { name: "WriteOnceFailure", description: "Write once has been completed" },
    0x22: { name: "InvalidReply", description: "Received invalid reply" },
    0x23: { name: "CstNotSynchronized", description: "CST not synchronized" },
    // Reserved by CIP for future ext      = 0x24; //
    0x25: { name: "BadKeyInPath", description: "Electronic key failure in the path" },
    0x26: { name: "BadPathSize", description: "Invalid path size" },
    0x27: { name: "UnexpectedAttr", description: "Attribute cannot be set at this time" },
    0x28: { name: "InvalidMember", description: "Member ID does not exist in the list" },
    0x29: { name: "MemberNotSettable", description: "Cannot set member value" },
    0x2A: { name: "DnetGrp2OnlySrvr", description: "Only Dnet group 2 server error" },
    0x2B: { name: "DisqualifiedMode", description: "Redundant mode has been disqualified" },
    0x2C: { name: "PrimaryMode", description: "Redundant mode is primary" },
    0x2D: { name: "InstanceNotDeletable", description: "Requested object instance cannot be deleted" },
    0x2D: { name: "SecondaryMode", description: "Redundant mode is secondary" },
    0x2E: { name: "BadServiceForPath", description: "Service not supported for the specified path" },
    0x61: { name: "NvsBypass", description: "Special bypass update" },
    0xFB: { name: "PortNotSupported", description: "Message port not supported" },
    0xFF: { name: "GctGeneral", description: "GetConnTags ConnMngr service error" },
    // Extended error codes（0x1000-0xFFFF defined by yourself）
    0x1000: { name: "VendorSpecificError", description: "Self-defined error codes" },
  };
  
// 错误码解析器（支持扩展）
class CIPErrorParser {
  static parse(statusCode, extendedStatus = 0) {
    const error = CIP_ERROR_CODES[statusCode] || {
      name: "UnknownError",
      description: `未知错误 (Code: 0x${statusCode.toString(16)}`,
    };

    return {
      code: statusCode,
      extendedCode: extendedStatus,
      name: error.name,
      description: error.description,
      isRecoverable: this.isRecoverableError(statusCode),
    };
  }

  static isRecoverableError(code) {
    // 定义可恢复错误（例如临时资源不可用）
    const recoverableCodes = [0x02, 0x06, 0x07];
    return recoverableCodes.includes(code);
  }
}

export default { CIP_ERROR_CODES, CIPErrorParser };
