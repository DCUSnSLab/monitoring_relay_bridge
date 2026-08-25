// vehicle, user 등록

const { broadcastVehicleList } = require('./vehicle');
const { safeSend } = require('../utils/websocket');

// IPv4-mapped IPv6(::ffff:1.2.3.4) → 1.2.3.4 로 정리
function normalizeIp(addr) {
    if (!addr) return addr;
    return addr.replace(/^::ffff:/, '');
}

function handleRegister(ws, message, vehicles, users, upstreamSubscriptions) {
    if (ws.clientInfo.role) {
        return;
    }

    if (!message.role) {
        console.log('Register message missing role');
        return;
    }

    if (message.role === 'vehicle') {
        const ip = normalizeIp(ws._socket.remoteAddress);

        // 1) id 미지정('' 또는 'default') → 이동체 IP를 id로 사용
        let vehicleId = message.vehicle_id;
        if (!vehicleId || vehicleId === 'default') {
            vehicleId = ip;
        }

        // 2) 같은 id로 "현재 살아있는" 다른 이동체가 이미 접속 중이면 → 진짜 중복이므로 id 뒤에 IP 부착.
        //    (기존 연결이 죽어 있으면 = 같은 차량의 재접속이므로 그대로 교체. LTE에서 IP가 바뀌어도 OK)
        const existing = vehicles.get(vehicleId);
        const existingAlive =
            existing && existing.ws &&
            existing.ws.readyState === 1 &&
            (Date.now() - (existing.last_seen || 0) < 5000);
        if (existingAlive) {
            vehicleId = `${vehicleId}_${ip}`;
            console.log(`Duplicate live vehicle id → uniquified: ${message.vehicle_id} -> ${vehicleId}`);
        }

        let session;

        if (vehicles.has(vehicleId)) {
            session = vehicles.get(vehicleId);

            if (session.ws) {
                session.ws.close();
            }

            session.ws = ws;
            session.status = 'online';
            session.last_seen = Date.now();
            session.ip = ip;
            session.is_bag = !!message.is_bag;

            console.log(`Vehicle reconnected: ${vehicleId} (is_bag=${!!message.is_bag})`);

        } else {
            session = {
                ws: ws,
                status: 'online',
                last_seen: Date.now(),
                ip: ip,
                is_bag: !!message.is_bag
            };

            vehicles.set(vehicleId, session);

            console.log(`Vehicle registered: ${vehicleId} (is_bag=${!!message.is_bag})`);
        }

        if (message.is_bag) {
            console.log(`📼 BAG source connected: ${vehicleId}`);
        }

        broadcastVehicleList(users, vehicles);

        console.log("vehicle ip: ", ip);

        ws.clientInfo.role ='vehicle';
        ws.clientInfo.id = vehicleId;

        // 차량 소켓은 연결이 바뀌면 기존 upstream 구독을 알지 못하므로,
        // 현재 참조 중인 구독을 새 소켓에 모두 다시 전달한다.
        for (const upstream of upstreamSubscriptions.values()) {
            if (upstream.vehicleId !== vehicleId || upstream.refCount <= 0) {
                continue;
            }

            safeSend(ws, JSON.stringify({
                type: 'subscribe_topic',
                topic: upstream.topic,
                msg_type: upstream.msgType,
            }), 'subscription replay');
            console.log(`Replayed vehicle subscription: ${vehicleId}::${upstream.topic}`);
        }

        console.log('Connected vehicle:', vehicles.size);
    }

    if (message.role === 'user') {
        if (!message.user_id) {
            console.log("User register missing user_id");
            return;
        }

        if (users.has(message.user_id)) {
            const oldWs = users.get(message.user_id);
            if (oldWs) {
                oldWs.close();
            }
            console.log(`Disconnect the same user who is currently connected: ${message.user_id}`);
        }

        ws.clientInfo.role ='user';
        ws.clientInfo.id = message.user_id;

        users.set(message.user_id, ws);

        console.log(`user registered: ${message.user_id}`);
        console.log('Connected user:', users.size);
    }

}

module.exports = { handleRegister };
