declare module "cip-protocol" {
    export class CIPClient {
      constructor(host: string, port?: number);
      connect(): Promise<void>;
      getAttribute(classId: number, instanceId: number, attributeId: number): Promise<{ value: any }>;
    }
  }