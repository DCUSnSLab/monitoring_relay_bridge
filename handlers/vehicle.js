// vehicle 관련
// vehicle list, disconnect, session

const { safeSend } = require('../utils/websocket');

function makeVehicleListMessage(vehicles) {
    const vehicleArray = Array.from(vehicles.entries()).map(([id, v]) => ({
        id,
        is_bag: v.is_bag,
    }));

    return {
        vehicleArray,
        payload: JSON.stringify({
            type: 'vehicle_list',
            vehicles: vehicleArray,
        }),
    };
}

// vehicle list (server -> user)
function handleVehicleList(ws, vehicles) {
    const { vehicleArray, payload } = makeVehicleListMessage(vehicles);
    safeSend(ws, payload, 'vehicle_list response');

    console.log(`Vehicle list: `, vehicleArray);
}

function broadcastVehicleList(users, vehicles) {
    const { payload } = makeVehicleListMessage(vehicles);

    for (const userWs of users.values()) {
        safeSend(userWs, payload, 'vehicle_list broadcast');
    }
}

function handleVehicleDisconnect(ws, vehicles) {
    const vehicleId = ws.clientInfo.id;

    if (!vehicleId) return;

    const session = vehicles.get(vehicleId);

    if (session) {
        session.status = "offline";
        session.ws = null;

        console.log(`🚗 Vehicle offline: ${vehicleId}`);
    }
}


function getVehicleSession(vehicleId, vehicles) {
    return vehicles.get(vehicleId);
}


module.exports = {
    broadcastVehicleList,
    handleVehicleList,
    handleVehicleDisconnect,
    getVehicleSession
};
