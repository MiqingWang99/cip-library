import { CIPClient, CIPParser } from "../src";

async function testCIPClient() {
    const client = new CIPClient("192.168.1.100"); // 替换为实际的设备IP
    try {
        await client.connect();

        const request = CIPParser.buildRequest(0x01); // 示例命令
        await client.send(request);

        const response = await client.receive();
        const parsedResponse = CIPParser.parseResponse(response);
        console.log("Parsed response:", parsedResponse);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        client.disconnect();
    }
}

testCIPClient();
