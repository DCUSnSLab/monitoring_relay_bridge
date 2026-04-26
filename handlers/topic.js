// topic 관리

function handleGetTopicList(ws, message, vehicles, pendingTopicListRequests, topicCache) {
    const vehicleId = message.vehicle_id;
    const sessionId = ws.clientInfo.id;
    const vehicle = vehicles.get(vehicleId);

    if (!vehicleId) {
        console.log("get_topic_list missing vehicle_id");
        return;
    }

    const cachedTopics = topicCache.get(vehicleId);
    if (cachedTopics) {
        ws.send(JSON.stringify({
            type: 'topic_list',
            vehicle_id: vehicleId,
            topics: cachedTopics
        }));
        console.log(`📤 캐시된 topic_list 즉시 전송: ${vehicleId}`);
        return;
    }

    if (!pendingTopicListRequests.has(vehicleId)) {
        pendingTopicListRequests.set(vehicleId, new Set());
    }

    pendingTopicListRequests.get(vehicleId).add(sessionId);

    if (vehicle?.ws) {
        vehicle.ws.send(JSON.stringify({
            type: 'get_topic_list'
        }));
        console.log(`📡 topic 요청 전달: ${vehicleId} -> ${sessionId}`);
    } else {
        console.log(`❌ vehicle 없음: ${vehicleId}`);
    }
}

// vehicle topic list (server -> user)
function handleTopicList(ws, message, users, pendingTopicListRequests, topicCache) {
    const vehicleId = ws.clientInfo.id;

    topicCache.set(vehicleId, message.topics);

    const waitingSessions = pendingTopicListRequests.get(vehicleId);

    console.log(`📡 vehicleId: ${vehicleId}`);
    console.log(`📡 waitingSessions: ${waitingSessions ? [...waitingSessions] : []}`);

    if (!waitingSessions || waitingSessions.size === 0) {
        return;
    }

    const payload = JSON.stringify({
        ...message,
        vehicle_id: vehicleId
    });

    for (const sessionId of waitingSessions) {
        const userWs = users.get(sessionId);
        if (userWs?.readyState === 1) {
            userWs.send(payload);
        }
    }

    pendingTopicListRequests.delete(vehicleId);
}

module.exports = {
    handleGetTopicList,
    handleTopicList
};
