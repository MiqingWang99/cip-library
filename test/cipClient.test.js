/**
 * Test Coverage:
 * 
 * Connection Management:
 * – Testing that the client can connect to and disconnect from a real (dummy) server.
 * 
 * Data Sending and Receiving:
 * – Verifying that the client’s send() writes data and receive() correctly returns data (and times out as expected).
 * 
 * Message Building:
 * – Checking that buildEncapMessage() creates a header with the proper values.
 * 
 * CIP Request Handling:
 * – Testing sendCipRequest() behavior including error handling when the encapsulation status isn’t 0.
 * – For these tests, the send/receive methods are stubbed to simulate responses.
 * 
 * High-Level API Methods:
 * – Using Sinon to stub the CIPParser functions so that methods like getAttribute(), setAttribute(), and getIdentityInfo() can be tested in isolation.
 */


const net = require("net");
const { expect } = require("chai");
const sinon = require("sinon");

const { CIPClient, CIP_SERVICES, CIP_CLASS_IDS } = require("../cipClient");
const CIPParser = require("../cipParser").default; // We'll stub methods on CIPParser

describe("CIPClient", function () {
  // Increase timeout for tests that involve network operations
  this.timeout(5000);

  let server;
  let port;
  let clientSocket;

  // Create a dummy server for network integration tests
  beforeEach((done) => {
    server = net.createServer((socket) => {
      clientSocket = socket;
    });
    server.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      done();
    });
  });

  afterEach((done) => {
    if (clientSocket) {
      clientSocket.destroy();
      clientSocket = null;
    }
    server.close(done);
    sinon.restore(); // restore all stubs
  });

  describe("Connection management", () => {
    it("should connect to the server", async () => {
      const client = new CIPClient("127.0.0.1", port);
      await client.connect();
      expect(client._connected).to.be.true;
      client.disconnect();
    });

    it("should disconnect from the server", async () => {
      const client = new CIPClient("127.0.0.1", port);
      await client.connect();
      client.disconnect();
      // Delay slightly to allow disconnect callback to run
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(client._connected).to.be.false;
    });
  });

  describe("Data sending and receiving", () => {
    it("should send data to the server", async () => {
      const client = new CIPClient("127.0.0.1", port);
      await client.connect();

      // Listen on the server for data
      const dataPromise = new Promise((resolve) => {
        clientSocket.once("data", (data) => {
          resolve(data);
        });
      });

      const testData = Buffer.from("Hello, CIP!");
      await client.send(testData);
      const received = await dataPromise;
      expect(received.toString()).to.equal("Hello, CIP!");
      client.disconnect();
    });

    it("should receive data from the server", async () => {
      const client = new CIPClient("127.0.0.1", port);
      await client.connect();

      // Simulate server sending data after connection
      setTimeout(() => {
        clientSocket.write(Buffer.from("Response Data"));
      }, 100);

      const data = await client.receive(1000);
      expect(data.toString()).to.equal("Response Data");
      client.disconnect();
    });

    it("should timeout when no data is received", async () => {
      const client = new CIPClient("127.0.0.1", port);
      await client.connect();

      try {
        await client.receive(200);
        throw new Error("Expected timeout error");
      } catch (err) {
        expect(err.message).to.equal("Timeout waiting for response");
      }
      client.disconnect();
    });
  });

  describe("buildEncapMessage", () => {
    it("should build a valid EtherNet/IP message", () => {
      const client = new CIPClient("127.0.0.1", port);
      client.sessionHandle = 0x12345678;
      client.senderContext = Buffer.from("ABCDEFGH");
      const command = 0x0065;
      const data = Buffer.from("TestData");

      const message = client.buildEncapMessage(command, data);
      // The header is 24 bytes; verify specific fields
      expect(message.readUInt16LE(0)).to.equal(command);
      expect(message.readUInt16LE(2)).to.equal(data.length);
      expect(message.readUInt32LE(4)).to.equal(0x12345678);
      // Status should be 0
      expect(message.readUInt32LE(8)).to.equal(0);
      // Verify sender context (bytes 12-19)
      const context = message.slice(12, 20).toString();
      expect(context).to.equal("ABCDEFGH");
      // The remaining bytes should match our data
      const payload = message.slice(24).toString();
      expect(payload).to.equal("TestData");
    });
  });

  describe("sendCipRequest", () => {
    it("should return CIP data when encapsulation status is 0", async () => {
      const client = new CIPClient("127.0.0.1", port);

      // Stub send and receive to simulate a valid response.
      const fakeCipData = Buffer.from("CIP_RESPONSE");
      // Create a fake response: 24-byte header + fake CIP data.
      const fakeHeader = Buffer.alloc(24);
      fakeHeader.writeUInt32LE(0, 8); // encapStatus = 0
      const fakeResponse = Buffer.concat([fakeHeader, fakeCipData]);

      sinon.stub(client, "send").resolves();
      sinon.stub(client, "receive").resolves(fakeResponse);

      // Dummy path for testing
      const dummyPath = Buffer.from([0x20, 0x04]);

      const result = await client.sendCipRequest(CIP_SERVICES.GET_ATTRIBUTES, dummyPath);
      expect(result.toString()).to.equal("CIP_RESPONSE");
    });

    it("should throw an error when encapsulation status is non-zero", async () => {
      const client = new CIPClient("127.0.0.1", port);
      const fakeCipData = Buffer.from("ErrorData");
      const fakeHeader = Buffer.alloc(24);
      fakeHeader.writeUInt32LE(0xDEADBEEF, 8); // non-zero status
      const fakeResponse = Buffer.concat([fakeHeader, fakeCipData]);

      sinon.stub(client, "send").resolves();
      sinon.stub(client, "receive").resolves(fakeResponse);

      const dummyPath = Buffer.from([0x20, 0x04]);

      try {
        await client.sendCipRequest(CIP_SERVICES.GET_ATTRIBUTES, dummyPath);
        throw new Error("Expected error not thrown");
      } catch (err) {
        expect(err.message).to.include("EtherNet/IP Error: 0x");
      }
    });
  });

  describe("High-level API", () => {
    let client;
    beforeEach(() => {
      // Create a client and stub sendCipRequest so that no actual network call is made.
      client = new CIPClient("127.0.0.1", port);
    });

    it("getAttribute should call CIPParser and return parsed response", async () => {
      const fakePath = Buffer.from("FAKE_PATH");
      const fakeResponse = { value: 42 };
      const stubBuildPath = sinon.stub(CIPParser, "buildObjectPath").returns(fakePath);
      const stubSendRequest = sinon.stub(client, "sendCipRequest").resolves(Buffer.from("dummy"));
      const stubParse = sinon.stub(CIPParser, "parseAttributeResponse").returns(fakeResponse);

      const result = await client.getAttribute(0x01, 0x01, 0x01);
      expect(stubBuildPath.calledWith(0x01, 0x01, 0x01)).to.be.true;
      expect(stubSendRequest.calledOnce).to.be.true;
      expect(stubParse.calledOnce).to.be.true;
      expect(result).to.deep.equal(fakeResponse);
    });

    it("setAttribute should call CIPParser and return parsed response", async () => {
      const fakePath = Buffer.from("FAKE_PATH");
      const fakeRequestData = Buffer.from("DATA");
      const fakeResponse = { value: 1 };
      const stubBuildPath = sinon.stub(CIPParser, "buildObjectPath").returns(fakePath);
      const stubEncode = sinon.stub(CIPParser, "encodeData").returns(fakeRequestData);
      const stubSendRequest = sinon.stub(client, "sendCipRequest").resolves(Buffer.from("dummy"));
      const stubParse = sinon.stub(CIPParser, "parseSetAttributeResponse").returns(fakeResponse);

      const result = await client.setAttribute(0x01, 0x01, 0x02, "test");
      expect(stubBuildPath.calledWith(0x01, 0x01, 0x02)).to.be.true;
      expect(stubEncode.calledWith("test")).to.be.true;
      expect(stubSendRequest.calledOnce).to.be.true;
      expect(stubParse.calledOnce).to.be.true;
      expect(result).to.deep.equal(fakeResponse);
    });

    it("getIdentityInfo should aggregate identity attributes", async () => {
      const fakeAttr1 = { value: 100 };
      const fakeAttr3 = { value: 200 };
      const fakeAttr6 = { value: 300 };

      // Stub getAttribute to return specific values based on attribute id
      const stubGetAttribute = sinon.stub(client, "getAttribute");
      stubGetAttribute.withArgs(CIP_CLASS_IDS.IDENTITY, 0x01, 0x01).resolves(fakeAttr1);
      stubGetAttribute.withArgs(CIP_CLASS_IDS.IDENTITY, 0x01, 0x03).resolves(fakeAttr3);
      stubGetAttribute.withArgs(CIP_CLASS_IDS.IDENTITY, 0x01, 0x06).resolves(fakeAttr6);

      const result = await client.getIdentityInfo();
      expect(result).to.deep.equal({
        vendorId: 100,
        productCode: 200,
        serialNumber: 300,
      });
    });
  });
});
