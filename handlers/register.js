// vehicle, user 등록

function handleRegister(ws, message, vehicles, users) {
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

        let session;

        if (vehicles.has(message.vehicle_id)) {
            session = vehicles.get(message.vehicle_id);

            if (session.ws) {
                session.ws.close();
            }

            session.ws = ws;
            session.status = 'online';
            session.last_seen = Date.now();

            console.log(`Vehicle reconnected: ${message.vehicle_id}`);

        } else {
            session = {
                ws: ws,
                status: 'online',
                last_seen: Date.now()
            };

            vehicles.set(message.vehicle_id, session);

            console.log(`Vehicle registered: ${message.vehicle_id}`);
        }

        ws.clientInfo.role ='vehicle';
        ws.clientInfo.id = message.vehicle_id;

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