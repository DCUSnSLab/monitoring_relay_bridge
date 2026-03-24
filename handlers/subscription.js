// subscribe, unsubscribe

// 구독 등록
function handleSubscribe(ws, message, vehicles, subscriptions, users, topicCache) {
    if (ws.clientInfo.role !== 'user') {
        console.log("Only users can subscribe");
        return;
    }

    if (!message.vehicle_id) {
        console.log("Subscribe message missing vehicle_id");
        return;
    }

    const vehicleId = message.vehicle_id;
    const userId = ws.clientInfo.id;

    if (!vehicles.has(vehicleId)) {
        console.log(`Vehicle not found: ${vehicleId}`);
        return;
    }

    if (!subscriptions.has(vehicleId)) {
        subscriptions.set(vehicleId, new Set());
    }

    const subs = subscriptions.get(vehicleId);

    if (!subs.has(userId)) {
        subs.add(userId);
        console.log(`User ${userId} subscribed to ${vehicleId}`);
    }
    console.log(`Subscribers: (${subs.size}) ${[...subs]}`);

    const topics = topicCache.get(vehicleId);

    if (topics) {
        ws.send(JSON.stringify({
            type: 'topic_list',
            vehicle_id: vehicleId,
            topics
        }));

        console.log("📤 캐시된 topic_list 전송");
    }
}

function handleUnsubscribe(ws, message, subscriptions) {
    if (ws.clientInfo.role !== 'user') {
        return;
    }

    if (!message.vehicle_id) {
        console.log("Subscribe message missing vehicle_id");
        return;
    }

    const vehicleId = message.vehicle_id;
    const userId = ws.clientInfo.id;

    if (subscriptions.has(vehicleId)) {
        const subs = subscriptions.get(vehicleId);
        subs.delete(userId);

        console.log(`User ${userId} unsubscribed from ${vehicleId}`);
        console.log(`Subscribers: (${subs.size}) ${[...subs]}`);

        if (subs.size === 0) {
            subscriptions.delete(vehicleId);
        }
    }
}

module.exports = {
    handleSubscribe,
    handleUnsubscribe,
}