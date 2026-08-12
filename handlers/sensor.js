const { makeTopicKey } = require('../managers/subscriptionManager');

// 클라이언트별 송신 버퍼가 이 값을 넘으면, 밀렸다고 판단하고 이번 프레임은 버림(최신 우선)
// ⚠️ 임시 테스트 값이므로 데이터 샘플링 후 변경 필요
const MAX_BUFFERED_BYTES = 64 * 1024 * 1024; // 64MB (임시)

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

        if (!userWs || userWs.readyState !== 1) {
            continue;
        }

        // 백프레셔: 이 클라이언트의 송신 버퍼가 이미 많이 밀려 있으면
        // 이번 프레임은 드롭(최신 데이터 우선, 느린 클라이언트가 서버 메모리를 잠식하는 것 방지)
        if (userWs.bufferedAmount > MAX_BUFFERED_BYTES) {
            userWs._droppedFrames = (userWs._droppedFrames || 0) + 1;
            continue;
        }

        userWs.send(payload);
    }
}

// vehicle 바이너리 센서 데이터(포인트 클라우드/카메라 등) 팬아웃
//
// 바이너리 프레임 레이아웃:
//   [0..2)      uint16 (BE) headerLen (H)  - 헤더 JSON 바이트 길이
//   [2..2+H)    UTF-8 JSON header          - { type, vehicle_id, topic, msg_type, ...디코딩 메타 }
//   [2+H..end)  raw binary payload         - Float32 포인트 클라우드 / 압축 이미지 바이트
//
// 릴레이는 헤더만 읽어 라우팅하고, 원본 버퍼 전체를 그대로(복사·재직렬화 없이) 구독자에게 전달한다.
function handleBinarySensorData(ws, data, vehicles, users, topicSubscribers) {

    if (ws.clientInfo.role !== 'vehicle') {
        console.log('Only vehicles can send sensor data');
        return;
    }

    // 최소 헤더 길이 필드(2바이트)
    if (!Buffer.isBuffer(data) || data.length < 2) {
        console.log("Invalid binary frame (too short)");
        return;
    }

    const headerLen = data.readUInt16BE(0);
    if (data.length < 2 + headerLen) {
        console.log("Invalid binary frame (header length mismatch)");
        return;
    }

    let header;
    try {
        header = JSON.parse(data.toString('utf8', 2, 2 + headerLen));
    } catch (e) {
        console.log("Invalid binary frame header JSON");
        return;
    }

    const topic = header.topic;
    if (!topic) {
        console.log("Binary frame header missing topic");
        return;
    }

    const vehicleId = ws.clientInfo.id;
    const topicKey = makeTopicKey(vehicleId, topic);

    const session = vehicles.get(vehicleId);
    if (session) {
        session.last_seen = Date.now();
    }

    const subs = topicSubscribers.get(topicKey);
    if (!subs || subs.size === 0) {
        return;
    }

    for (const sessionId of subs) {
        const userWs = users.get(sessionId);

        if (!userWs || userWs.readyState !== 1) {
            continue;
        }

        // 백프레셔: 밀린 클라이언트는 이번 프레임 드롭(최신 우선)
        if (userWs.bufferedAmount > MAX_BUFFERED_BYTES) {
            userWs._droppedFrames = (userWs._droppedFrames || 0) + 1;
            continue;
        }

        // 같은 원본 버퍼를 모든 구독자에게 재사용(복사 없음), 바이너리 프레임으로 전송
        userWs.send(data, { binary: true });
    }
}

module.exports = { handleSensorData, handleBinarySensorData };
