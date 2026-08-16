// vehicle, user 등록

const { broadcastVehicleList } = require('./vehicle');
const { safeSend } = require('../utils/websocket');

function handleRegister(ws, message, vehicles, users, upstreamSubscriptions) {
    if (ws.clientInfo.role) {
        return;
    }

    if (!message.role) {
        console.log('Register message missing role');
        return;
    }

    if (message.role === 'vehicle') {
        if (!message.vehicle_id) {
            console.log("Vehicle register missing vehicle_id");
            return;
        }

        const ip = ws._socket.remoteAddress;
        const rosbridge_ip = message.rosbridge_ip;

        let session;

        if (vehicles.has(message.vehicle_id)) {
            session = vehicles.get(message.vehicle_id);

            if (session.ws) {
                session.ws.close();
            }

            session.ws = ws;
            session.status = 'online';
            session.last_seen = Date.now();
            session.ip = ip;
            session.rosbridge_ip = rosbridge_ip;
            session.is_bag = !!message.is_bag;

            console.log(`Vehicle reconnected: ${message.vehicle_id} (is_bag=${!!message.is_bag})`);

        } else {
            session = {
                ws: ws,
                status: 'online',
                last_seen: Date.now(),
                ip: ip,
                rosbridge_ip: rosbridge_ip,
                is_bag: !!message.is_bag
            };

            vehicles.set(message.vehicle_id, session);

            console.log(`Vehicle registered: ${message.vehicle_id} (is_bag=${!!message.is_bag})`);
        }

        if (message.is_bag) {
            console.log(`📼 BAG source connected: ${message.vehicle_id}`);
        }

        broadcastVehicleList(users, vehicles);

        console.log("vehicle ip: ", ip);
        console.log("rosbridge:", rosbridge_ip);

        ws.clientInfo.role ='vehicle';
        ws.clientInfo.id = message.vehicle_id;

        // 차량 소켓은 연결이 바뀌면 기존 upstream 구독을 알지 못하므로,
        // 현재 참조 중인 구독을 새 소켓에 모두 다시 전달한다.
        for (const upstream of upstreamSubscriptions.values()) {
            if (upstream.vehicleId !== message.vehicle_id || upstream.refCount <= 0) {
                continue;
            }

            safeSend(ws, JSON.stringify({
                type: 'subscribe_topic',
                topic: upstream.topic,
                msg_type: upstream.msgType,
            }), 'subscription replay');
            console.log(`Replayed vehicle subscription: ${message.vehicle_id}::${upstream.topic}`);
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
