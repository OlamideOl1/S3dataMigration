const mariadb = require('mariadb');
var Queue = require('bull');
var timediff = require('timediff');

var connectionLimit = 10

var dbConfig = {
  host: "34.229.161.96",
  user: "root",
  password: 'Ab@123456',
  database: "userImageData",
  connectionLimit: connectionLimit,
  waitForConnections: true, // Default value.
  queueLimit: 0 // Unlimited - default value.
};

const redisHost = "34.229.161.96";
const redisPort = 6379;

var redisParam = {
  port: redisPort,
  host: redisHost,
  // maxRetriesPerRequest: null,
  // enableReadyCheck: false,
  enableOfflineQueue: false
}

var redisParamOffline = {
  port: redisPort,
  host: redisHost,
  // maxRetriesPerRequest: null,
  // enableReadyCheck: false,
  // enableOfflineQueue: false
}



const objectQueue = new Queue('objectQueue', {
  redis: redisParam
});

const executionCompleteQueue = new Queue('executionCompleteQueue', {
  redis: redisParamOffline
});

executionCompleteQueue.count().then(res => {

  if (res) {

    console.log('executionCompleteQueue count is not empty :\n');

    console.log('Producer node has already completed successfully, set RERUN_UPLOAD in variable file to true to start process again:\n');

    executionCompleteQueue.close();

    process.exit();
  }

  executionCompleteQueue.close();

}).catch(err => {

  console.log('Redis server is not running, review it is available on: ' + redisHost + " : " + redisPort);

  executionCompleteQueue.close();

  process.exit();

});

var targetObjectPrefix = "avatar/";

//var pool = mariadb.createPool(dbConfig);

var stageTableforMerge = "stageTableforMerge";

var startDateTime = new Date();

var targetS3Bucket = "newproductionbucket77";

var maxUploadPerInvocation = 1000000;

var setRecordsPerBatch = 30000;

var s3bulkList = [];

var allBatchPromiseList = [];

for (var i = 0; i < 25; i++) {

  var oldImagePath = "image/avatar" + i + ".txt";

  s3bulkList.push(oldImagePath);

}

loadS3toQueueDatabase(s3bulkList, 0, s3bulkList.length);

function loadS3toQueueDatabase(s3bulkList, startIndex, endIndex) {

  var loopEndIndex = ((endIndex - startIndex) < maxUploadPerInvocation) ? endIndex : (maxUploadPerInvocation + startIndex);

  var bulkList = [];

  var recordsPerBatch = setRecordsPerBatch;

  var eachList = [];

  var batchCounter = 1;

  var allBatchPromiseList = [];

  for (var i = startIndex; i < loopEndIndex; i++) {

    eachList = [];

    var s3ObejectforList = {
      oldImagePath: "",
      newImagePath: ""
    }

    var oldImagePath = s3bulkList[i];

    var sourceObjectSplit = oldImagePath.split('/');

    var newImagePath = targetObjectPrefix + sourceObjectSplit[sourceObjectSplit.length - 1];

    s3ObejectforList.oldImagePath = oldImagePath;
    s3ObejectforList.newImagePath = newImagePath;

    // s3ObejectforList.oldImagePath = "'" + oldImagePath + "'";
    // s3ObejectforList.newImagePath = "'" + newImagePath + "'";

    bulkList.push(s3ObejectforList);

    if (batchCounter == recordsPerBatch || batchCounter == loopEndIndex) {

      allBatchPromiseList.push(objectQueue.add({
          bucketObjects: bulkList
        }).then(res => console.log("add to queue successful"))
        .catch(error => {
          console.log("add to queue failed see error = " + error.message);
          // Will now remove last item (failed item) from db batch so it will not get loaded to database

          //bulkList.pop(eachList);

        }));

      //recordsPerBatch = recordsPerBatch + setRecordsPerBatch;

	  recordsPerBatch += (( loopEndIndex - i - 1) < setRecordsPerBatch) ? (loopEndIndex - i - 1) : setRecordsPerBatch;

      bulkList = [];

    }

    batchCounter++;

  }

  Promise.allSettled(allBatchPromiseList).then(function() {

    if (loopEndIndex == endIndex) {

      console.log('ALL QUEUE UPLOAD ARE NOW COMPLETED');

      var endDateTime = new Date();

      var expended = timediff(startDateTime, endDateTime, 'YDHmS');

      console.log("process expended: " + expended.hours + ":" + expended.minutes + ":" + expended.seconds);

      //    pool.end();

      objectQueue.close();

    } else {

      console.log("Current set is done inserting, now commencing next set of batch upload");

      //  loadS3toQueueDatabase(s3bulkList, loopEndIndex, s3bulkList.length);

      setTimeout(function() {
        console.log("now waiting");
        loadS3toQueueDatabase(s3bulkList, loopEndIndex, s3bulkList.length);
      }, 150);

    }

  });

}
