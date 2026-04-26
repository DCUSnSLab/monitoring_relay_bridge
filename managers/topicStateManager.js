const topicCache = new Map();
/*
Map<vehicleId, TopicInfo[]>

예:
"car_1" => [
  { name: "/imu/data", type: "sensor_msgs/msg/Imu" },
  { name: "/camera/image/compressed", type: "sensor_msgs/msg/CompressedImage" }
]
*/

const pendingTopicListRequests = new Map();
/*
Map<vehicleId, Set<sessionId>>

예:
"car_1" => Set(["sess_1", "sess_2"])
*/

module.exports = {
    topicCache,
    pendingTopicListRequests,
};
