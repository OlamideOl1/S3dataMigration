const mariadb = require('mariadb');
var Queue = require('bull');
var timediff = require('timediff');

var connectionLimit = 10

var dbConfig = {
  host: "100.25.102.220",
  user: "root",
  password: 'Ab@123456',
  database: "userImageData",
  connectionLimit: connectionLimit,
  waitForConnections: true, // Default value.
  queueLimit: 0 // Unlimited - default value.
};


const objectQueue = new Queue('video transcoder', {

  redis: {
    port: 6379,
    host: "100.25.102.220",
    // maxRetriesPerRequest: null,
    // enableReadyCheck: false,
    enableOfflineQueue: false
  }
});

var targetObjectPrefix = "avatar/";

// var promiseAllCounter = 1;

var pool = mariadb.createPool(dbConfig);

var stageTableforMerge = "stageTableforMerge";

var startDateTime = new Date();

var targetS3Bucket = "newproductionbucket77";

var maxUploadPerInvocation = 16000000;

var setRecordsPerBatch = 20000;

var s3bulkList = [];

var allBatchPromiseList = [];

for (var i = 0; i < 20000000; i++) {

  var oldImagePath = "image/avatar" + i + ".txt";

  s3bulkList.push(oldImagePath);

}

loadS3toQueueDatabase(s3bulkList, 0, s3bulkList.length);


function loadS3toQueueDatabase(s3bulkList, startIndex, endIndex) {

  var loopEndIndex = ((endIndex - startIndex) < maxUploadPerInvocation) ? endIndex : (maxUploadPerInvocation + startIndex);

console.log("at first entry "+ loopEndIndex);

  var bulkList = [];

  var recordsPerBatch = setRecordsPerBatch;

  var eachList = [];

  var batchCounter = 1;

  var allBatchPromiseList = [];

  for (var i = startIndex; i < loopEndIndex; i++) {

    eachList = [];

    var oldImagePath = s3bulkList[i];

    var sourceObjectSplit = oldImagePath.split('/');

    var newImagePath = targetObjectPrefix + sourceObjectSplit[sourceObjectSplit.length - 1];

    eachList.push("'" + oldImagePath + "'");
    eachList.push("'" + newImagePath + "'");

    bulkList.push(eachList);

    // queueList.push(objectQueue.add({
    //   bucketObjects: oldImagePath})
    // .then(res => console.log("add to queue successful = " + error.message) )
    // .catch(error => console.log("add to queue failed see error = " + error.message)));

    if (batchCounter == recordsPerBatch || batchCounter == loopEndIndex) {

      batchQuery = "INSERT INTO " + stageTableforMerge + " (OldImageName,NewImageName) values (?, ?)";

      allBatchPromiseList.push(processBatchQuery(batchQuery, bulkList));

      recordsPerBatch = recordsPerBatch + setRecordsPerBatch;

      bulkList = [];

      // queueList = [];

    }

    // promiseAllCounter++;

    batchCounter++;

  }

  Promise.allSettled(allBatchPromiseList).then(function() {

    if(loopEndIndex == endIndex){

      console.log('ALL BATCH INSERT QUERIES ARE NOW COMPLETED');

      var endDateTime = new Date();

      var expended = timediff(startDateTime, endDateTime, 'YDHmS');

      console.log("process expended: " + expended.hours + ":" + expended.minutes + ":" + expended.seconds);

      pool.end();

      objectQueue.close();

    }else{

        console.log("Current set is done inserting, now commencing next set of batch upload");

        loadS3toQueueDatabase(s3bulkList, loopEndIndex, s3bulkList.length);

    }

  });

}

async function processBatchQuery(batchQuery, bulkList) {

  console.log("now attempting to send query");

  var res = await pool.batch(batchQuery, bulkList).catch(err => {

    //console.log("Batch insert failed, error = " + err.code);  //ER_GET_CONNECTION_TIMEOUT

    if (err.code == "ER_GET_CONNECTION_TIMEOUT" || err.code == "ER_CONNECTION_TIMEOUT") {

      console.log("now retrying");

      return processBatchQuery(batchQuery, bulkList);

    } else {
      console.log("error has occured in reconnect and will not retry, please see details " + err.code + " // " + err.message)

      return err;
    }
  });

  console.log("Batch insert successful, records affected = " + res.affectedRows);

}
