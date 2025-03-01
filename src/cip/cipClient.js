const net = require("net");
const { Buffer } = require("buffer");
const debug = require("debug")("cip:client");
const CIPParser = require("./cipParser").default;

import { 
  CipConnOwner, 
  CipConnType, 
  CipConnPriority,
  ConnSizeFixedVar,
  CipXportDir,
  CipProdTrigger,
  CipXportClass 
} from "./CipConnFields";

// CIP service codes
const CIP_SERVICES = {
  GET_ATTRIBUTES: 0x01,   // Read attribute
  SET_ATTRIBUTES: 0x02,   // Write attribute
  RESET: 0x05,            // Reset device
  START_CONNECTION: 0x0E, // Create connection
  READ_TAG: 0x4C,         // Read tag (EtherNet/IP extension)
};

// Common CIP Class IDs
const CIP_CLASS_IDS = {
  IDENTITY: 0x01,         // Identity class
  MESSAGE_ROUTER: 0x02,   // Message Router class
  ASSEMBLY: 0x04,         // Assembly class (I/O)
  CONNECTION: 0x06,       // Connection class
};

class CIPClient {
  /**
   * Constructs a new CIPClient.
   * @param {string} host - The target host.
   * @param {number} [port=44818] - The port to connect to.
   */
  constructor(host, port = 44818, connectionParams = {}) {
    if (!host) throw new Error("Host is required");
    this.host = host;
    this.port = port;
    this.client = new net.Socket();
    this.sessionHandle = 0;              // EtherNet/IP session handle
    this.senderContext = Buffer.alloc(8);  // Sender context
    this._connected = false;
    this._setupListeners();

    // 使用连接参数常量
    this.connectionParams = {
      owner: CipConnOwner.EXCLUSIVE_OWNER,
      type: CipConnType.TYPE_PT2PT,
      priority: CipConnPriority.PRIOR_SCHED,
      ...connectionParams
    };
  }

  _setupListeners() {
    // Log socket errors and state changes
    this.client.on("error", (err) => {
      debug("Socket error: " + err.message);
    });
    this.client.on("close", () => {
      this._connected = false;
      debug("Socket closed");
    });
  }

  /**
   * Connects to the CIP server.
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      if (this._connected) return resolve();
      this.client.connect(this.port, this.host, () => {
        debug(`Connected to ${this.host}:${this.port}`);
        this._connected = true;
        resolve();
      });
      this.client.once("error", reject);
    });
  }

  /**
   * Disconnects from the CIP server.
   */
  disconnect() {
    if (this._connected) {
      this.client.end(() => {
        this.client.destroy();
        this._connected = false;
        debug("Connection closed");
      });
    }
  }

  /**
   * Sends raw data over the socket.
   * @param {Buffer|string} data - The data to send.
   * @returns {Promise<void>}
   */
  async send(data) {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data);
    }
    return new Promise((resolve, reject) => {
      this.client.write(data, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  /**
   * Receives data from the socket.
   * @param {number} [timeout=5000] - Timeout in milliseconds.
   * @returns {Promise<Buffer>}
   */
  async receive(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.client.removeListener("data", onData);
        reject(new Error("Timeout waiting for response"));
      }, timeout);

      const onData = (data) => {
        clearTimeout(timer);
        resolve(data);
      };

      this.client.once("data", onData);
    });
  }

  /**
   * Builds an EtherNet/IP encapsulation message.
   * @param {number} command - The encapsulation command.
   * @param {Buffer} data - The data to encapsulate.
   * @returns {Buffer} The complete message.
   */
  buildEncapMessage(command, data) {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data);
    }
    const encapHeader = Buffer.alloc(24);

    // 在header中使用连接参数位域
    encapHeader.writeUInt16LE(
      this.connectionParams.owner | 
      this.connectionParams.type |
      this.connectionParams.priority, 
      16);

    encapHeader.writeUInt16LE(command, 0);             // Command
    encapHeader.writeUInt16LE(data.length, 2);         // Length
    encapHeader.writeUInt32LE(this.sessionHandle, 4);    // Session Handle
    encapHeader.writeUInt32LE(0, 8);                     // Status
    this.senderContext.copy(encapHeader, 12, 0, 8);      // Sender Context
    return Buffer.concat([encapHeader, data]);
  }

  /**
   * Sends a CIP service request and returns the CIP response data.
   * @param {number} serviceCode - The CIP service code.
   * @param {Buffer} path - The object path.
   * @param {Buffer} [requestData=Buffer.alloc(0)] - Optional request data.
   * @returns {Promise<Buffer>} The CIP response data.
   */
  async sendCipRequest(serviceCode, path, requestData = Buffer.alloc(0)) {
    // Calculate path size in words (2 bytes per word)
    const pathSize = path.length / 2;
    // Build CIP data: [service code, path size, path, request data]
    const cipData = Buffer.concat([
      Buffer.from([serviceCode, pathSize]),
      path,
      requestData
    ]);

    const encapCommand = 0x0065; // SendRRData command
    const message = this.buildEncapMessage(encapCommand, cipData);

    await this.send(message);
    const response = await this.receive();

    // Check EtherNet/IP header for errors
    const encapStatus = response.readUInt32LE(8);
    if (encapStatus !== 0) {
      throw new Error(`EtherNet/IP Error: 0x${encapStatus.toString(16)}`);
    }
    // Return CIP data portion (skip the 24-byte header)
    return response.slice(24);
  }

  /**
   * Reads an attribute from a device.
   * @param {number} classId - The CIP class ID.
   * @param {number} instanceId - The instance ID.
   * @param {number} attributeId - The attribute ID.
   * @returns {Promise<Object>} The parsed attribute response.
   */
  async getAttribute(classId, instanceId, attributeId) {
    const path = CIPParser.buildObjectPath(classId, instanceId, attributeId);
    const cipResponse = await this.sendCipRequest(CIP_SERVICES.GET_ATTRIBUTES, path);
    return CIPParser.parseAttributeResponse(cipResponse);
  }

  /**
   * Writes an attribute to a device.
   * @param {number} classId - The CIP class ID.
   * @param {number} instanceId - The instance ID.
   * @param {number} attributeId - The attribute ID.
   * @param {*} value - The value to write.
   * @returns {Promise<Object>} The parsed set attribute response.
   */
  async setAttribute(classId, instanceId, attributeId, value) {
    const path = CIPParser.buildObjectPath(classId, instanceId, attributeId);
    const requestData = CIPParser.encodeData(value);
    const cipResponse = await this.sendCipRequest(CIP_SERVICES.SET_ATTRIBUTES, path, requestData);
    return CIPParser.parseSetAttributeResponse(cipResponse);
  }

  /**
   * Reads identity information from the device.
   * @returns {Promise<Object>} An object containing vendorId, productCode, and serialNumber.
   */
  async getIdentityInfo() {
    const vendorResponse = await this.getAttribute(CIP_CLASS_IDS.IDENTITY, 0x01, 0x01);
    const productResponse = await this.getAttribute(CIP_CLASS_IDS.IDENTITY, 0x01, 0x03);
    const serialResponse = await this.getAttribute(CIP_CLASS_IDS.IDENTITY, 0x01, 0x06);
    return {
      vendorId: vendorResponse.value,
      productCode: productResponse.value,
      serialNumber: serialResponse.value,
    };
  }
}

module.exports = { CIPClient, CIP_SERVICES, CIP_CLASS_IDS };
