//누가 이 토픽을 보고 있는지 저장
const topicSubscribers = new Map();
/*
Map<topicKey, Set<sessionId>>

예:
"car_1::/imu/data" => Set(["sess_1", "sess_2"])
*/

// 토픽별 msg_type 보관 (차량 종료로 upstream을 지워도, 재접속 replay 시 subscribe_topic에 필요)
const topicMsgTypes = new Map();
/*
Map<topicKey, msgType>

예:
"car_1::/imu/data" => "sensor_msgs/msg/Imu"
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

function logCurrentUpstreamSubscriptions(subscriptions) {
    const separator = '='.repeat(72);
    const topicKeys = [...subscriptions.entries()]
        .filter(([, subscription]) => subscription.refCount > 0)
        .map(([topicKey]) => topicKey)
        .sort((left, right) => left.localeCompare(right));

    console.log(separator);
    console.log('현재 구독중인 토픽명');
    console.log('-'.repeat(72));
    console.log(topicKeys.length > 0 ? topicKeys.join('\n') : '(없음)');
    console.log(separator);
}

module.exports = {
    topicSubscribers,
    topicMsgTypes,
    upstreamSubscriptions,
    makeTopicKey,
    logCurrentUpstreamSubscriptions,
};
