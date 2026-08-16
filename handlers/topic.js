// topic 관리

function handleGetTopicList(ws, message, vehicles, pendingTopicListRequests, topicCache) {
    const vehicleId = message.vehicle_id;
    const sessionId = ws.clientInfo.id;
    const vehicle = vehicles.get(vehicleId);

    if (!vehicleId) {
        console.log("get_topic_list missing vehicle_id");
        return;
    }

    // 이 유저를 이 차량의 topic_list 갱신 대상(watcher)으로 등록.
    // 캐시 여부와 무관하게 등록해야, 이후 토픽이 바뀌었을 때도 계속 반영된다.
    if (!pendingTopicListRequests.has(vehicleId)) {
        pendingTopicListRequests.set(vehicleId, new Set());
    }
    pendingTopicListRequests.get(vehicleId).add(sessionId);

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
// 차량이 topic_list를 보낼 때마다(최초 + 변경 시) 캐시를 갱신하고,
// 이 차량을 보고 있는 watcher 유저 전원에게 push한다. (watcher는 유지 → 다음 변경도 반영)
function handleTopicList(ws, message, users, pendingTopicListRequests, topicCache) {
    const vehicleId = ws.clientInfo.id;

    topicCache.set(vehicleId, message.topics);

    const watchers = pendingTopicListRequests.get(vehicleId);
    if (!watchers || watchers.size === 0) {
        return;
    }

    const payload = JSON.stringify({
        ...message,
        vehicle_id: vehicleId
    });

    for (const sessionId of watchers) {
        const userWs = users.get(sessionId);
        if (userWs?.readyState === 1) {
            userWs.send(payload);
        }
    }
    // watcher를 지우지 않는다 → 이후 토픽 변경 시에도 계속 갱신 전달
}

// 유저가 특정 차량 보기를 종료할 때: topic_list 갱신 대상(watcher)에서 제거
function handleStopTopicList(ws, message, pendingTopicListRequests) {
    const vehicleId = message.vehicle_id;
    const sessionId = ws.clientInfo.id;
    if (!vehicleId) return;

    const watchers = pendingTopicListRequests.get(vehicleId);
    if (!watchers) return;

    watchers.delete(sessionId);
    if (watchers.size === 0) {
        pendingTopicListRequests.delete(vehicleId);
    }
    console.log(`🛑 topic_list watcher 제거: ${vehicleId} <- ${sessionId}`);
}

module.exports = {
    handleGetTopicList,
    handleTopicList,
    handleStopTopicList
};
