module.exports = {
    ROLES: {
        ADMIN: "ADMIN",
        PROCUREMENT_MANAGER: "PROCUREMENT_MANAGER",
        PROCUREMENT: "PROCUREMENT"
    },
    PO_STATUS: {
        DRAFT: "DRAFT",
        ISSUED: "ISSUED",
        CANCELLED: "CANCELLED",
        COMPLETED: "COMPLETED"
    },
    INQUIRY_STATUS: {
        OPEN: "OPEN",
        VENDOR_SELECTED: "VENDOR_SELECTED",
        CLOSED: "CLOSED",
        CANCELLED: "CANCELLED"
    },
    PAYMENT_TYPES: {
        ADVANCE: "ADVANCE",
        CREDIT: "CREDIT",
        ADVANCE_PLUS_BALANCE: "ADVANCE_PLUS_BALANCE",
        CUSTOM: "CUSTOM"
    },
    SESSION: {
        COOKIE_NAME: "login_session",
        MAX_AGE: 60 * 60 * 1000 // 1 hour
    }
};
