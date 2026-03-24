// vehicle 관련
// vehicle list, disconnect, session

// vehicle list (server -> user)
function handleVehicleList(ws, vehicles) {
    ws.send(JSON.stringify({
        type: 'vehicle_list',
        vehicles: [...vehicles.keys()]
    }));

    console.log(`Vehicle list: ${JSON.stringify(...vehicles.keys())}`);
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
    handleVehicleList,
    handleVehicleDisconnect,
    getVehicleSession
};