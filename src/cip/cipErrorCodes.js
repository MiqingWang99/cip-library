// cipErrorCodes.js
const CIP_ERROR_CODES = {
    // Standard Error codes (Volume 1, Appendix B)
    0x00: { name: "Success", description: "Operation successful" },
    0x01: { name: "ConnectionFailure", description: "Connection failed" },
    0x02: { name: "ResourceUnavailable", description: "Resource unavailable" },
    0x03: { name: "InvalidParameter", description: "Invalid parameter" },
    0x04: { name: "PathProcessingFailure", description: "Path processing failure" },
    0x05: { name: "PathDestinationUnknown", description: "Destination path unknown" },
    0x06: { name: "PartialTransfer", description: "Partial data transfer" },
    0x07: { name: "ConnectionLost", description: "Connection lost" },
    0x08: { name: "ServiceNotSupported", description: "Service not supported" },
    0x09: { name: "AttributeNotSupported", description: "Attribute not supported" },
    0x0A: { name: "AttributeListError", description: "Attribute list error" },
    0x0B: { name: "AlreadyInRequestedMode", description: "Already in requested mode" },
    0x0C: { name: "ObjectStateConflict", description: "Object state conflict" },
    0x0D: { name: "ObjectAlreadyExists", description: "Object already exists" },
    0x0E: { name: "AttributeNotSettable", description: "Attribute not settable" },
    0x0F: { name: "PrivilegeViolation", description: "Insufficient privileges" },
    0x10: { name: "DeviceStateConflict", description: "Device is not in the correct mode" },
    0x11: { name: "ReplyDataTooLarge", description: "Response data packet is too large" },
    0x12: { name: "FragmentationOfPrimitive", description: "Primitive value will be fragmented" },
    0x13: { name: "NotEnoughData", description: "Not enough data" },
    0x14: { name: "AttributeNotFound", description: "Attribute not found" },
    0x15: { name: "TooMuchData", description: "Service provided data exceeds expectations" },
    0x16: { name: "ObjectDoesNotExist", description: "Specified object does not exist" },
    0x17: { name: "NoFragmentation", description: "Fragmentation not activated" },
    0x18: { name: "DataNotSaved", description: "Attribute data not saved" },
    0x19: { name: "DataWriteFailure", description: "Attribute data write failure" },
    0x1A: { name: "RequestTooLarge", description: "Routing failure: request too large" },
    0x1B: { name: "ResponseTooLarge", description: "Routing failure: response too large" },
    0x1C: { name: "MissingListData", description: "Attribute data not found in the list" },
    0x1D: { name: "InvalidListStatus", description: "Returned attribute status list" },
    0x1E: { name: "ServiceError", description: "Embedded service failure" },
    0x1F: { name: "ConnectionRelatedFailure", description: "Connection handling error" },
    0x21: { name: "WriteOnceFailure", description: "Write once has been completed" },
    0x22: { name: "InvalidReply", description: "Received invalid reply" },
    0x23: { name: "BufferInvalidSize", description: "Buffer size mismatch" },
    0x24: { name: "InvalidAttributeData", description: "Invalid attribute data" },
    0x25: { name: "InvalidKeySegmentInPath", description: "Electronic key failure in the path" },
    0x26: { name: "InvalidPathSize", description: "Invalid path size" },
    0x27: { name: "UnexpectedAttribute", description: "Attribute cannot be set at this time" },
    0x28: { name: "InvalidMember", description: "Member ID does not exist in the list" },
    0x29: { name: "MemberNotSettable", description: "Cannot set member value" },
    0x2A: { name: "DnetGroup2OnlyServer", description: "Only Dnet group 2 server error" },
    0x2B: { name: "DisqualifiedRedundancyMode", description: "Redundant mode has been disqualified" },
    0x2C: { name: "PrimaryMode", description: "Redundant mode is primary" },
    0x2D: { name: "InstanceNotDeletable", description: "Requested object instance cannot be deleted" },
    0x2E: { name: "SecondaryMode", description: "Redundant mode is secondary" },
    0x2F: { name: "InvalidServiceForPath", description: "Service not supported for the specified path" },
    0x61: { name: "NvsUpdateInProgress", description: "Special bypass update" },
    0xFB: { name: "MessagePortNotSupported", description: "Message port not supported" },
    0xFF: { name: "GeneralError", description: "General error" },
    // Extended error codes (0x1000-0xFFFF defined by yourself)
    0x1000: { name: "VendorSpecificError", description: "Vendor specific error codes" },
};

// Error code parser (extensible)
class CIPErrorParser {
    static parse(statusCode, extendedStatus = 0) {
        const error = CIP_ERROR_CODES[statusCode] || {
            name: "UnknownError",
            description: `Unknown error (Code: 0x${statusCode.toString(16)})`,
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
        // Define recoverable errors (e.g., temporary resource unavailable)
        const recoverableCodes = [0x02, 0x06, 0x07];
        return recoverableCodes.includes(code);
    }
}

export default { CIP_ERROR_CODES, CIPErrorParser };
