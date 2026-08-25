const { safeSend } = require("../utils/websocket");

const REQUEST_TIMEOUT_MS = 30000;
const pendingLoggingRequests = new Map();

function sendLoggingResponse(ws, payload) {
    const sent = safeSend(
        ws,
        JSON.stringify({
            type: "logging_response",
            request_id: payload.requestId || "",
            vehicle_id: payload.vehicleId || "",
            success: !!payload.success,
            logging_status: payload.loggingStatus || "",
            is_logging: payload.isLogging === true,
            bag_path: payload.bagPath || "",
            message: payload.message || "",
            error: payload.error || "",
        }),
        "logging response",
    );
    if (!sent) {
        console.warn(
            `[logging] response not sent: request_id=${payload.requestId || ""} vehicle=${payload.vehicleId || ""}`
        );
    }
}

function validateLoggingRequest(message) {
    if (typeof message.request_id !== "string" || !message.request_id.trim()) return "request_id is required";
    if (typeof message.vehicle_id !== "string" || !message.vehicle_id.trim()) return "vehicle_id is required";
    if (!["LoggingStart", "LoggingStop"].includes(message.is_logging)) return "is_logging must be LoggingStart or LoggingStop";
    if (!Array.isArray(message.topics) || !message.topics.every((topic) => typeof topic === "string")) return "topics must be a string array";
    if (typeof message.bag_name !== "string") return "bag_name must be a string";
    return null;
}

function handleLoggingRequest(ws, message, vehicles, users) {
    if (ws.clientInfo.role !== "user") {
        console.log("Only users can request logging");
        return;
    }

    const validationError = validateLoggingRequest(message);
    if (validationError) {
        console.warn(`[logging] invalid request: ${validationError}`);
        sendLoggingResponse(ws, {
            requestId: message.request_id,
            vehicleId: message.vehicle_id,
            success: false,
            error: validationError,
        });
        return;
    }

    const requestId = message.request_id;
    const vehicleId = message.vehicle_id;
    const vehicle = vehicles.get(vehicleId);
    console.log(
        `[logging] request received: request_id=${requestId} user=${ws.clientInfo.id} ` +
        `vehicle=${vehicleId} command=${message.is_logging} topics=${message.topics.length} bag_name=${message.bag_name || "(auto)"}`
    );

    if (!vehicle?.ws || vehicle.ws.readyState !== 1) {
        sendLoggingResponse(ws, { requestId, vehicleId, success: false, error: "Vehicle is not connected" });
        return;
    }
    if (pendingLoggingRequests.has(requestId)) {
        sendLoggingResponse(ws, { requestId, vehicleId, success: false, error: "Duplicate request_id" });
        return;
    }

    const timeout = setTimeout(() => {
        const pending = pendingLoggingRequests.get(requestId);
        if (!pending) return;
        pendingLoggingRequests.delete(requestId);
        console.error(
            `[logging] request timed out: request_id=${requestId} vehicle=${pending.vehicleId} user=${pending.userId}`
        );
        sendLoggingResponse(users.get(pending.userId), {
            requestId,
            vehicleId: pending.vehicleId,
            success: false,
            error: "Logging request timed out",
        });
    }, REQUEST_TIMEOUT_MS);
    timeout.unref?.();

    pendingLoggingRequests.set(requestId, {
        userId: ws.clientInfo.id,
        vehicleId,
        timeout,
    });

    const sent = safeSend(
        vehicle.ws,
        JSON.stringify({
            type: "logging_request",
            request_id: requestId,
            is_logging: message.is_logging,
            topics: message.topics,
            bag_name: message.bag_name,
        }),
        "logging request",
    );

    if (!sent) {
        clearTimeout(timeout);
        pendingLoggingRequests.delete(requestId);
        sendLoggingResponse(ws, {
            requestId,
            vehicleId,
            success: false,
            error: "Failed to forward logging request",
        });
        return;
    }

    console.log(
        `[logging] request forwarded: request_id=${requestId} vehicle=${vehicleId} command=${message.is_logging}`
    );
}

function handleLoggingResponse(ws, message, users) {
    if (ws.clientInfo.role !== "vehicle") {
        console.log("Only vehicles can send logging responses");
        return;
    }

    const requestId = message.request_id;
    const pending = pendingLoggingRequests.get(requestId);
    if (!pending) {
        console.log(`Unknown logging response: ${requestId}`);
        return;
    }
    if (pending.vehicleId !== ws.clientInfo.id) {
        console.log(`Ignored logging response from wrong vehicle: ${ws.clientInfo.id}`);
        return;
    }

    clearTimeout(pending.timeout);
    pendingLoggingRequests.delete(requestId);
    console.log(
        `[logging] response received: request_id=${requestId} vehicle=${pending.vehicleId} ` +
        `success=${message.success === true} is_logging=${message.is_logging === true} ` +
        `status=${message.logging_status || ""} bag_path=${message.bag_path || ""}`
    );

    sendLoggingResponse(users.get(pending.userId), {
        requestId,
        vehicleId: pending.vehicleId,
        success: message.success === true,
        loggingStatus: message.logging_status,
        isLogging: message.is_logging === true,
        bagPath: message.bag_path,
        message: message.message,
        error: message.error,
    });
}

function clearLoggingRequestsForClient(role, id, users) {
    for (const [requestId, pending] of pendingLoggingRequests) {
        const belongsToClient =
            (role === "user" && pending.userId === id) ||
            (role === "vehicle" && pending.vehicleId === id);
        if (!belongsToClient) continue;

        clearTimeout(pending.timeout);
        pendingLoggingRequests.delete(requestId);
        if (role === "vehicle") {
            sendLoggingResponse(users.get(pending.userId), {
                requestId,
                vehicleId: pending.vehicleId,
                success: false,
                error: "Vehicle disconnected during logging request",
            });
        }
    }
}

module.exports = {
    clearLoggingRequestsForClient,
    handleLoggingRequest,
    handleLoggingResponse,
};