import { Socket } from "net";
import { Buffer } from "buffer";
const debug = require("debug")("cip:secure-client");
import CIPParser from "./cipParser";
import { randomBytes, createHmac } from "crypto";
import { 
  CipConnType,
  CipXportDir,
  CipProdTrigger
} from "./CipConnFields";

// 协议常量定义
const ENCAPSULATION_PROTOCOL = {
  COMMAND: {
    SEND_RRDATA: 0x0065,
    REGISTER_SESSION: 0x0065
  },
  STATUS: {
    SUCCESS: 0x0000
  }
};

const CIP_SECURITY = {
  SESSION_KEY_LENGTH: 32,
  RESPONSE_TIMEOUT: 8000  // 工业环境推荐8秒超时
};

class SecureCIPClient {
  constructor(host, port = 44818) {
    this.host = host;
    this.port = port;
    this.client = new Socket();
    
    // 安全增强属性
    this.sessionNonce = randomBytes(16); // 会话随机数
    this.sessionHandle = 0;
    this.sessionActive = false;
    this.securityContext = {
      lastActivity: Date.now(),
      sequenceNumber: 0
    };

    // 配置TCP socket安全参数
    this.client.setTimeout(CIP_SECURITY.RESPONSE_TIMEOUT);
    this.client.setKeepAlive(true, 60000);
  }

  // ---------------------- 安全连接管理 ----------------------
  async establishSecureSession() {
    if (this.sessionActive) {
      throw new Error("Session already established");
    }

    // 1. 注册会话（安全握手）
    const registerPacket = this.buildRegistrationPacket();
    await this.send(registerPacket);
    
    // 2. 验证会话响应
    const response = await this.receiveWithValidation();
    this.validateSessionResponse(response);
    
    // 3. 初始化安全参数
    this.sessionHandle = response.slice(4, 8).readUInt32LE();
    this.securityContext.sequenceNumber = 0;
    this.sessionActive = true;
    
    debug(`Secure session established (Handle: 0x${this.sessionHandle.toString(16)})`);
  }

  buildRegistrationPacket() {
    const packet = Buffer.alloc(28);
    // 使用预定义的传输方向和生产触发器
    packet.writeUInt8(
      CipXportDir.DIRECTION_CLIENT | 
      CipProdTrigger.TRIG_CYCLIC, 
      20
    );
    packet.writeUInt16LE(ENCAPSULATION_PROTOCOL.COMMAND.REGISTER_SESSION, 0);
    packet.writeUInt16LE(0x0004, 2);  // Protocol version
    this.sessionNonce.copy(packet, 4, 0, 16);
    return packet;
  }

  validateSessionResponse(response) {
    if (response.length < 8) {
      throw new Error("Invalid session response");
    }
    
    const statusCode = response.readUInt32LE(4);
    if (statusCode !== ENCAPSULATION_PROTOCOL.STATUS.SUCCESS) {
      throw new Error(`Session registration failed (Code: 0x${statusCode.toString(16)})`);
    }
  }

  // ---------------------- 增强型数据收发 ----------------------
  async sendSecureData(data) {
    if (this.connectionType !== CipConnType.TYPE_PT2PT) {
      throw new Error("Only point-to-point connections support secure data");
    }
    if (!this.sessionActive) {
      throw new Error("Secure session not established");
    }

    // 1. 生成消息认证码
    const sequenceBuf = Buffer.alloc(4);
    sequenceBuf.writeUInt32LE(++this.securityContext.sequenceNumber);
    
    const hmac = createHmac('sha256', this.sessionNonce);
    hmac.update(data).update(sequenceBuf);
    const mac = hmac.digest().slice(0, 8);  // 截取8字节MAC

    // 2. 构建安全数据包
    const securePacket = Buffer.concat([
      this.buildEncapHeader(),
      data,
      sequenceBuf,
      mac
    ]);

    // 3. 发送并更新活动时间
    await this.send(securePacket);
    this.securityContext.lastActivity = Date.now();
  }

  async receiveWithValidation() {
    const response = await this.receive();
    
    // 1. 基础完整性检查
    if (response.length < 24) {
      throw new Error("Invalid response length");
    }

    // 2. 验证会话句柄
    const handle = response.readUInt32LE(4);
    if (handle !== this.sessionHandle) {
      throw new Error("Session handle mismatch");
    }

    // 3. 验证消息认证码
    const payload = response.slice(24, -12);
    const receivedMac = response.slice(-8);
    const calculatedMac = this.calculateMac(payload);
    
    if (!calculatedMac.equals(receivedMac)) {
      throw new Error("MAC verification failed");
    }

    return payload;
  }

  calculateMac(payload) {
    const hmac = createHmac('sha256', this.sessionNonce);
    hmac.update(payload);
    return hmac.digest().slice(0, 8);
  }

  // ---------------------- 协议增强方法 ----------------------
  async safeGetAttribute(classId, instanceId, attributeId) {
    this.validateObjectIds(classId, instanceId, attributeId);
    
    const path = CIPParser.buildObjectPath(
      Number(classId),
      Number(instanceId),
      Number(attributeId)
    );
    
    try {
      const response = await this.sendCipRequest(
        CIP_SERVICES.GET_ATTRIBUTES, 
        path
      );
      return CIPParser.parseAttributeResponse(response);
    } catch (error) {
      error.metadata = { classId, instanceId, attributeId };
      throw error;
    }
  }

  validateObjectIds(...ids) {
    ids.forEach((id, index) => {
      if (!Number.isInteger(id) || id < 0 || id > 0xFFFF) {
        throw new Error(`Invalid object ID at position ${index}: ${id}`);
      }
    });
  }

  // ---------------------- 生命周期管理 ----------------------
  async gracefulShutdown() {
    try {
      if (this.sessionActive) {
        await this.sendSessionClose();
        debug("Session terminated gracefully");
      }
    } catch (error) {
      debug("Graceful shutdown failed:", error.message);
    } finally {
      this.client.destroy();
      this.sessionActive = false;
    }
  }

  async sendSessionClose() {
    const packet = Buffer.alloc(24);
    packet.writeUInt16LE(0x0066, 0);  // Unregister session command
    packet.writeUInt32LE(this.sessionHandle, 4);
    await this.send(packet);
  }
}

// 保留原有常量导出
export default { 
  CIPClient: SecureCIPClient, 
  CIP_SERVICES, 
  CIP_CLASS_IDS 
};
