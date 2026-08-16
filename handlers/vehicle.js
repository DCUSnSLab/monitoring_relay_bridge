// vehicle 관련
// vehicle list, disconnect, session

// vehicle list (server -> user)
function handleVehicleList(ws, vehicles) {
    const vehicleArray = Array.from(vehicles.entries()).map(([id, v]) => ({
        id: id,
        rosbridge_ip: v.rosbridge_ip,
        is_bag: v.is_bag
    }));

    ws.send(JSON.stringify({
        type: 'vehicle_list',
        vehicles: vehicleArray
    }));

    console.log(`Vehicle list: `, vehicleArray);
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