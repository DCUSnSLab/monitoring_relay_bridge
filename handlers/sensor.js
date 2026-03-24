// vehicle sensor data 관련

function handleSensorData(ws, message, vehicles, users, subscriptions) {
    if (ws.clientInfo.role !== 'vehicle') {
        console.log('Only vehicles can send sensor data');
        return;
    }

    if (!message.topic || message.data === undefined) {
        console.log("Invalid sensor_data message");
        return;
    }

    const vehicleId = ws.clientInfo.id;

    const session = vehicles.get(vehicleId);
    if (session) {
        session.last_seen = Date.now();
    }

    const subs = subscriptions.get(vehicleId);

    if (!subs) return;

    const payload = JSON.stringify({
        ...message,
        vehicle_id: vehicleId
    });

    for (const userId of subs) {
        const userWs = users.get(userId);

        if (userWs && userWs.readyState === 1) {
            userWs.send(payload);
        }
    }
}

module.exports = { handleSensorData };