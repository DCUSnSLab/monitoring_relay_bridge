const WebSocket = require('ws');

function logSendError(operation, ws, err) {
    console.error(
        `[websocket] ${operation} failed: role=${ws.clientInfo?.role} id=${ws.clientInfo?.id}`,
        err.message,
    );
}

function safeSend(ws, payload, operation = 'send') {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        return false;
    }

    try {
        ws.send(payload, (err) => {
            if (err) logSendError(operation, ws, err);
        });
        return true;
    } catch (err) {
        logSendError(operation, ws, err);
        return false;
    }
}

function safePing(ws) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        return false;
    }

    try {
        ws.ping(undefined, undefined, (err) => {
            if (err) logSendError('ping', ws, err);
        });
        return true;
    } catch (err) {
        logSendError('ping', ws, err);
        return false;
    }
}

module.exports = {
    safePing,
    safeSend,
};
