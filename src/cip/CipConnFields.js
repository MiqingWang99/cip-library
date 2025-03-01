// Network Connection Parameters (Bit-fields within 16-bit value)

// Connection Owner
export const CipConnOwner = {
    EXCLUSIVE_OWNER: 0x0000,
    REDUNDANT_OWNER: 0x8000
};

// Connection Type
export const CipConnType = {
    TYPE_NULL: 0x0000,
    TYPE_MULTICAST: 0x2000,
    TYPE_PT2PT: 0x4000
};

// Connection Priority
export const CipConnPriority = {
    PRIOR_LOW: 0x0000,
    PRIOR_HIGH: 0x0400,
    PRIOR_SCHED: 0x0800,
    PRIOR_URGENT: 0x0C00
};

// Connection data size is fixed or variable
export const ConnSizeFixedVar = {
    CONN_SIZE_FIXED: 0x0000,
    CONN_SIZE_VARIABLE: 0x0200
};

// Connection Transport Direction, Production Trigger, and Transport Class values

// Transport direction
export const CipXportDir = {
    DIRECTION_CLIENT: 0x00,
    DIRECTION_SERVER: 0x80
};

// Production Trigger
export const CipProdTrigger = {
    TRIG_CYCLIC: 0x00,
    TRIG_COS: 0x10,
    TRIG_APP: 0x20,
    TRIG_APP_ONLY: 0x80 // The trigger shall be used only internally, it is not defined by the CIP spec
};

// Transport Class
export const CipXportClass = {
    XPORT_CLASS_0: 0,
    XPORT_CLASS_1: 1,
    XPORT_CLASS_2: 2,
    XPORT_CLASS_3: 3,
    XPORT_CLASS_4: 4,
    XPORT_CLASS_5: 5
};

// 使用 Object.freeze 来确保这些常量对象不会被修改
Object.freeze(CipConnOwner);
Object.freeze(CipConnType);
Object.freeze(CipConnPriority);
Object.freeze(ConnSizeFixedVar);
Object.freeze(CipXportDir);
Object.freeze(CipProdTrigger);
Object.freeze(CipXportClass); 