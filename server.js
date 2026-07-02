const WebSocket = require('ws')

const { vehicles } = require('./managers/vehicleManager');
const { users } = require('./managers/userManager');
const { topicSubscribers, upstreamSubscriptions } = require('./managers/subscriptionManager');
const { topicCache, pendingTopicListRequests } = require('./managers/topicStateManager');

const { handleRegister } = require("./handlers/register");
const { handleVehicleList } = require("./handlers/vehicle");
const { handleSubscribe, handleUnsubscribe } = require("./handlers/subscription");
const { handleSensorData } = require("./handlers/sensor");
const { handleTopicList, handleGetTopicList } = require("./handlers/topic");

const wss = new WebSocket.Server({ port: 8080 })

console.log("Relay Server running on port 8080")

wss.on('connection', (ws) => {
    console.log('Client connected')

    ws.clientInfo = {
        role: null,
        id: null
    };

    ws.on('message', (data) => {
        try{
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