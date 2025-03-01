const { CIPClient, CIP_CLASS_IDS } = require("./cipClient");

async function main() {
  const client = new CIPClient("192.168.1.100");
  try {
    await client.connect();

    // Example 1: Read device Vendor ID
    const vendorId = await client.getAttribute(
      CIP_CLASS_IDS.IDENTITY,
      0x01, // Instance 1
      0x01  // Attribute 1 (Vendor ID)
    );
    console.log("Vendor ID:", vendorId.value);

    // Example 2: Write device parameter
    await client.setAttribute(
      CIP_CLASS_IDS.ASSEMBLY,
      0x01, // Instance 1
      0x03, // Attribute 3 (Output Data)
      1234  // Value to write
    );

    // Example 3: Get complete device information
    const identity = await client.getIdentityInfo();
    console.log("Device Info:", identity);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.disconnect();
  }
}

main();
