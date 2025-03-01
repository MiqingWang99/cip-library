# cip-protocol
![npm](https://img.shields.io/npm/v/cip-protocol)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)

A CIP (Common Industrial Protocol) implementation for Node.js.

## Features
- Full CIP attribute read/write support
- EtherNet/IP encapsulation
- Security-enhanced session handling

## Installation
```bash
npm install cip-protocol

## QuickStart
const { CIPClient } = require("cip-protocol");
const client = new CIPClient("192.168.1.100");
await client.connect();
const vendorId = await client.getAttribute(0x01, 0x01, 0x01);
