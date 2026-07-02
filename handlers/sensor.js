const { makeTopicKey } = require('../managers/subscriptionManager');

// vehicle sensor data 관리
function handleSensorData(ws, message, vehicles, users, topicSubscribers) {

    if (ws.clientInfo.role !== 'vehicle') {
        console.log('Only vehicles can send sensor data');
        return;
    }

    if (!message.topic || message.data === undefined) {
        console.log("Invalid sensor_data message");
        return;
    }

    const vehicleId = ws.clientInfo.id;
    const topic = message.topic;
    const topicKey = makeTopicKey(vehicleId, topic);

    const session = vehicles.get(vehicleId);
    if (session) {
        session.last_seen = Date.now();
    }

    const subs = topicSubscribers.get(topicKey);

    if (!subs || subs.size === 0) {
        return;
    }

    const payload = JSON.stringify({
        ...message,
        vehicle_id: vehicleId,
    });

    for (const sessionId of subs) {
        const userWs = users.get(sessionId);

        if (userWs && userWs.readyState === 1) {
            userWs.send(payload);
        }
    }
}

module.exports = { handleSensorData };
