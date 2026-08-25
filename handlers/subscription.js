const {
    makeTopicKey,
    logCurrentUpstreamSubscriptions,
} = require('../managers/subscriptionManager');

const PERSISTENT_TOPICS = new Set(['/ublox_gps_node/fix']);

function handleSubscribe(ws, message, vehicles, topicSubscribers, upstreamSubscriptions, users, topicCache) {
    if (ws.clientInfo.role !== 'user') {
        console.log("Only users can subscribe");
        return;
    }

    if (!message.vehicle_id || !message.topic || !message.msg_type) {
        console.log("Subscribe message missing vehicle_id/topic/msg_type");
        return;
    }

    const vehicleId = message.vehicle_id;
    const topic = message.topic;
    const msgType = message.msg_type;
    const sessionId = ws.clientInfo.id;
    const topicKey = makeTopicKey(vehicleId, topic);

    if (!vehicles.has(vehicleId)) {
        console.log(`Vehicle not found: ${vehicleId}`);
        return;
    }

    if (!topicSubscribers.has(topicKey)) {
        topicSubscribers.set(topicKey, new Set());
    }

    const subs = topicSubscribers.get(topicKey);

    if (subs.has(sessionId)) {
        console.log(`Session ${sessionId} already subscribed to ${topicKey}`);
        return;
    }

    subs.add(sessionId);
    console.log(`Session ${sessionId} subscribed to ${topicKey}`);
    console.log(`Subscribers for ${topicKey}: (${subs.size}) ${[...subs]}`);

    if (!upstreamSubscriptions.has(topicKey)) {
        upstreamSubscriptions.set(topicKey, {
            vehicleId,
            topic,
            msgType,
            refCount: 0,
        });
    }

    const upstream = upstreamSubscriptions.get(topicKey);

    if (upstream.refCount === 0) {
        const vehicle = vehicles.get(vehicleId);

        if (vehicle && vehicle.ws) {
            vehicle.ws.send(JSON.stringify({
                type: "subscribe_topic",
                topic,
                msg_type: msgType,
            }));

            console.log(`📡 vehicle로 subscribe 전달: ${topicKey}`);
        }
    }

    upstream.refCount += 1;
    console.log(`Upstream refCount for ${topicKey}: ${upstream.refCount}`);
    logCurrentUpstreamSubscriptions(upstreamSubscriptions);
}

function handleUnsubscribe(ws, message, vehicles, topicSubscribers, upstreamSubscriptions) {
    if (ws.clientInfo.role !== 'user') {
        return;
    }

    if (!message.vehicle_id || !message.topic) {
        console.log("Unsubscribe message missing vehicle_id/topic");
        return;
    }

    const vehicleId = message.vehicle_id;
    const topic = message.topic;
    const sessionId = ws.clientInfo.id;
    const topicKey = makeTopicKey(vehicleId, topic);

    if (PERSISTENT_TOPICS.has(topic) && message.force !== true) {
        console.log(`Persistent topic unsubscribe ignored: ${topicKey}`);
        return;
    }

    const subs = topicSubscribers.get(topicKey);
    if (!subs || !subs.has(sessionId)) {
        console.log(`Session ${sessionId} is not subscribed to ${topicKey}`);
        return;
    }

    subs.delete(sessionId);
    console.log(`Session ${sessionId} unsubscribed from ${topicKey}`);

    const upstream = upstreamSubscriptions.get(topicKey);
    if (upstream) {
        upstream.refCount -= 1;
        console.log(`Upstream refCount for ${topicKey}: ${upstream.refCount}`);

        if (upstream.refCount <= 0) {
            upstreamSubscriptions.delete(topicKey);
            console.log(`Upstream subscription removed: ${topicKey}`);

            const vehicle = vehicles.get(vehicleId);
            if (vehicle && vehicle.ws) {
                vehicle.ws.send(JSON.stringify({
                    type: "unsubscribe_topic",
                    topic,
                }));
                console.log(`📡 vehicle로 unsubscribe 전달: ${topicKey}`);
            }
        }
    }

    if (subs.size === 0) {
        topicSubscribers.delete(topicKey);
        console.log(`Topic subscribers removed: ${topicKey}`);
    }

    logCurrentUpstreamSubscriptions(upstreamSubscriptions);
}


module.exports = {
    handleSubscribe,
    handleUnsubscribe,
}
