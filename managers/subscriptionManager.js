//누가 이 토픽을 보고 있는지 저장
const topicSubscribers = new Map();
/*
Map<topicKey, Set<sessionId>>

예:
"car_1::/imu/data" => Set(["sess_1", "sess_2"])
*/

// 토픽을 차량에 실제 구독 걸었는지 저장
const upstreamSubscriptions = new Map();
/*
Map<topicKey, {
  vehicleId,
  topic,
  msgType,
  refCount
}>

예:
"car_1::/imu/data" => {
  vehicleId: "car_1",
  topic: "/imu/data",
  msgType: "sensor_msgs/msg/Imu",
  refCount: 2
}
*/

function makeTopicKey(vehicleId, topic) {
    return `${vehicleId}::${topic}`;
}

module.exports = {
    topicSubscribers,
    upstreamSubscriptions,
    makeTopicKey,
};
