debugger;



var Queue = require('bull');

var videoQueue = new Queue('video transcodingf', 'redis://52.86.55.47:6379');

videoQueue.getJobCounts().then(res => console.log('second Job Count:\n',res["waiting"]+res["active"]));

videoQueue.count().then(res => console.log('new count variable is :\n',res));

videoQueue.close();
