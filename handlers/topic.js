// topic 관련

function handleGetTopicList(ws, message, vehicles) {
    const vehicleId = message.vehicle_id;
    const session = vehicles.get(vehicleId);

    if (session?.ws) {
        session.ws.send(JSON.stringify({
            type: 'get_topic_list'
        }));
        console.log("📡 topic 요청 전달:", vehicleId);
    } else {
        console.log("❌ vehicle 없음:", vehicleId);
    }
}

// vehicle topic list (server -> user)
function handleTopicList(ws, message, users, subscriptions, topicCache) {
    const vehicleId = ws.clientInfo.id;

    topicCache.set(vehicleId, message.topics);

    const subs = subscriptions.get(vehicleId);

    console.log("📡 vehicleId:", vehicleId);
    console.log("📡 subs:", subs);

    if (!subs) return;

    const payload = JSON.stringify(message);

    for (const userId of subs) {
        const userWs = users.get(userId);
        if (userWs?.readyState === 1) { //유저 소켓이 살아있으면 send, 1 == websocket.open
            userWs.send(payload);
        }
    }
}

module.exports = {
    handleGetTopicList,
    handleTopicList
};
