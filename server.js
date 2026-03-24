const WebSocket = require('ws')

const { vehicles } = require('./managers/vehicleManager');
const { users } = require('./managers/userManager');
const { subscriptions } = require('./managers/subscriptionManager');
const topicCache = new Map();

const { handleRegister } = require("./handlers/register");
const { handleVehicleList } = require("./handlers/vehicle");
const { handleSubscribe, handleUnsubscribe } = require("./handlers/subscription");
const { handleSensorData } = require("./handlers/sensor");
const { handleTopicList, handleGetTopicList } = require("./handlers/topic");

const wss = new WebSocket.Server({ port: 8080 })

console.log("Relay Server running on port 8080")

wss.on('connection', (ws) => {
    console.log('Client connected')

    //websocket 연결된 것이 식별하기 위해 저장하는 메타데이터
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
                    handleSubscribe(ws, message, vehicles, subscriptions, users, topicCache);

                    const vehicle = vehicles.get(message.vehicle_id);

                    if (vehicle && vehicle.ws) {
                        vehicle.ws.send(JSON.stringify({
                            type: "subscribe_topic",
                            topic: message.topic,
                            msg_type: message.msg_type
                        }));

                        console.log("📡 vehicle로 subscribe 전달:", message.topic);
                    }
                    break;

                case 'unsubscribe':
                    handleUnsubscribe(ws, message, subscriptions);
                    break;

                case 'sensor_data':
                    handleSensorData(ws, message, vehicles, users, subscriptions);
                    break;

                case 'topic_list':
                    handleTopicList(ws, message, users, subscriptions, topicCache);
                    break;

                case 'get_topic_list':
                    handleGetTopicList(ws, message, vehicles);
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
        }

        if (role === 'user') {
            users.delete(id);

            for (const [vehicleId, subs] of subscriptions) {
                subs.delete(id);

                if (subs.size === 0) {
                    subscriptions.delete(vehicleId);
                }
            }
        }
    })
})