const WebSocket = require('ws')

const { vehicles } = require('./managers/vehicleManager');
const { users } = require('./managers/userManager');
const { topicSubscribers, upstreamSubscriptions } = require('./managers/subscriptionManager');
const { topicCache, pendingTopicListRequests } = require('./managers/topicStateManager');

const { handleRegister } = require("./handlers/register");
const { handleVehicleList } = require("./handlers/vehicle");
const { handleSubscribe, handleUnsubscribe } = require("./handlers/subscription");
const { handleSensorData, handleBinarySensorData } = require("./handlers/sensor");
const { handleTopicList, handleGetTopicList } = require("./handlers/topic");

const wss = new WebSocket.Server({ port: 8080 })

console.log("Relay Server running on port 8080")

// 드롭 로그: 5초마다 프레임을 버린 유저와 그 개수를 출력 (백프레셔 튜닝용)
setInterval(() => {
    for (const [id, userWs] of users) {
        if (userWs._droppedFrames) {
            console.log(`[drop] user=${id} dropped=${userWs._droppedFrames} buffered=${userWs.bufferedAmount}`);
            userWs._droppedFrames = 0;
        }
    }
}, 5000)

// 하트비트: 1초마다 모든 연결에 ping. 30초(30회) 연속 pong이 없으면 죽은 것으로 보고 terminate.
// 동시에 차량별 연결 상태(last_seen 기준)를 유저에게 broadcast → 대시보드가 색상으로 표시.
const PING_INTERVAL_MS = 1000;
const DEAD_AFTER_MISSED = 30; // 30 * 1s = 30초
const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
        if ((ws.missedPongs || 0) >= DEAD_AFTER_MISSED) {
            console.log(`[heartbeat] dead connection terminated: role=${ws.clientInfo?.role} id=${ws.clientInfo?.id}`);
            ws.terminate(); // 'close' 이벤트가 발생 → 기존 cleanup이 vehicles/users/구독 상태를 제거
            continue;
        }
        ws.missedPongs = (ws.missedPongs || 0) + 1;
        ws.ping();
    }

    // 차량 연결 상태 broadcast (대시보드 색상 표시용)
    // msAgo = 마지막으로 살아있음을 확인한 뒤 경과 시간(ms). null이면 아직 응답 없음.
    const now = Date.now();
    const statuses = [];
    for (const [id, session] of vehicles) {
        statuses.push({ id, msAgo: session.last_seen ? now - session.last_seen : null });
    }
    const statusMsg = JSON.stringify({ type: 'vehicle_status', statuses });
    for (const userWs of users.values()) {
        if (userWs.readyState === 1) {
            userWs.send(statusMsg);
        }
    }
}, PING_INTERVAL_MS);

wss.on('close', () => {
    clearInterval(heartbeat);
});

wss.on('connection', (ws) => {
    console.log('Client connected')

    ws.clientInfo = {
        role: null,
        id: null
    };

    // 하트비트: 연결 생존 추적. pong을 받으면 미응답 카운트 리셋 + (차량이면) last_seen 갱신.
    ws.missedPongs = 0;
    ws.on('pong', () => {
        ws.missedPongs = 0;
        if (ws.clientInfo.role === 'vehicle' && ws.clientInfo.id) {
            const session = vehicles.get(ws.clientInfo.id);
            if (session) session.last_seen = Date.now();
        }
    });

    ws.on('message', (data, isBinary) => {
        try{
            // 바이너리 프레임(포인트 클라우드/카메라 등)은 JSON 파싱 없이 헤더만 읽어 팬아웃
            if (isBinary) {
                if (!ws.clientInfo.role) {
                    console.log('Unregistered client tried to send binary data');
                    return;
                }
                handleBinarySensorData(ws, data, vehicles, users, topicSubscribers);
                return;
            }

            const message = JSON.parse(data);

            // console.log("📦 raw:", data.toString());

            if (message.type !== 'register' && !ws.clientInfo.role) {
                console.log('Unregistered client tried to send message');
                return;
            }

            switch (message.type) {
                case 'register':
                    handleRegister(ws, message, vehicles, users);
                    break;

                case 'vehicle_list':
                    handleVehicleList(ws, vehicles);
                    break;

                case 'subscribe':
                    // 필요한 경우만 차량에 요청(구독된 경우 요청x)
                    handleSubscribe(ws, message, vehicles, topicSubscribers, upstreamSubscriptions, users, topicCache);

                    // 무조건 차량에 요청
                    // handleSubscribe(ws, message, vehicles, subscriptions, users, topicCache);

                    // const vehicle = vehicles.get(message.vehicle_id);
                    //
                    // if (vehicle && vehicle.ws) {
                    //     vehicle.ws.send(JSON.stringify({
                    //         type: "subscribe_topic",
                    //         topic: message.topic,
                    //         msg_type: message.msg_type
                    //     }));
                    //
                    //     console.log("📡 vehicle로 subscribe 전달:", message.topic);
                    // }
                    break;

                case 'unsubscribe':
                    handleUnsubscribe(ws, message, vehicles, topicSubscribers, upstreamSubscriptions);
                    break;

                case 'sensor_data':
                    handleSensorData(ws, message, vehicles, users, topicSubscribers);
                    break;

                case 'topic_list':
                    handleTopicList(ws, message, users, pendingTopicListRequests, topicCache);
                    break;

                case 'get_topic_list':
                    handleGetTopicList(ws, message, vehicles, pendingTopicListRequests, topicCache);
                    break;
            }


        } catch(err) {
            console.log('error:', err);
        }
    });

    ws.on('close', () => {
        const role = ws.clientInfo.role;
        const id = ws.clientInfo.id;

        console.log(`${role} disconnected: ${id}`);

        if (role === 'vehicle') {
            const session = vehicles.get(id);

            if (session) {
                session.status = "offline";
                session.ws = null;
            }
            topicCache.delete(id);

            vehicles.delete(id);
        }

        if (role === 'user') {
            users.delete(id);

            for (const [topicKey, subs] of topicSubscribers) {
                if (!subs.has(id)) continue;

                subs.delete(id);
                console.log(`Session ${id} removed from ${topicKey}`);

                const upstream = upstreamSubscriptions.get(topicKey);
                if (upstream) {
                    upstream.refCount -= 1;
                    console.log(`Upstream refCount for ${topicKey}: ${upstream.refCount}`);

                    if (upstream.refCount <= 0) {
                        upstreamSubscriptions.delete(topicKey);
                        console.log(`Upstream subscription removed: ${topicKey}`);
                    }
                }

                if (subs.size === 0) {
                    topicSubscribers.delete(topicKey);
                    console.log(`Topic subscribers removed: ${topicKey}`);
                }
            }
        }

    })
})