const mariadb = require('mariadb');
var Queue = require('bull');
var timediff = require('timediff');


const connectionLimit = 10;
const databaseHost = "34.229.161.96";
const dbUser = "root";
const dbPassword = 'Ab@123456';
const databaseName = "userImageData";

var dbConfig = {
  host: databaseHost,
  user: dbUser,
  password: dbPassword,
  database: databaseName,
  connectionLimit: connectionLimit,
};
var pool = mariadb.createPool(dbConfig);

const redisHost = "34.229.161.96";
const redisPort = 6379;

var redisParam = {
  port: redisPort,
  host: redisHost,
  enableOfflineQueue: false
}

var redisParamOffline = {
  port: redisPort,
  host: redisHost,
}

const objectQueue = new Queue('objectQueue', {
  redis: redisParam
});

const objectQueueOffline = new Queue('objectQueue', {
  redis: redisParamOffline
});

objectQueueOffline.empty()
  .then(res => objectQueue.clean(1))
  .then(res => objectQueue.clean(1, 'failed'))
  .catch(err => console.log("error occured here " + err.message));

var legacyS3ObjectPrefix = "image";
var targetObjectPrefix = "avatar/";
var stageTableforUpdate = "stageTableforUpdate";
var databaseTabletoUpdate = "ImageData";
var tableColumnNametoUpdate = "Imagepath";
var startDateTime = new Date();
var targetS3Bucket = "newproductionbucket77";
var sqlRowLimit = 5000000;
var maxUploadPerInvocation = 1000000;
var setRecordsPerBatch = 30000;
// var sqlRowLimit = 10;
// var maxUploadPerInvocation = 50;
// var setRecordsPerBatch = 3;

var s3bulkList = [];
var allBatchPromiseList = [];

initiateObjectSelection();

function initiateObjectSelection() {

  selectFromDB()
    .then(res => {
      if (res.length > 0) {
        loadS3ObjectstoQueue(res, 0, res.length);
      } else {
        console.log("No records selected for migration");
        //send migration completed indicatotr to queue
        objectQueue.add({
            bucketObjects: "migrationcompleted"
          }).then(res => console.log("migrationcompleted indicator sent successfully"))
          .catch(error => {
            console.log("add to queue failed see error = " + error.message);
          });
        objectQueue.close();
        objectQueueOffline.close();
        pool.query("DROP TABLE IF EXISTS " + stageTableforUpdate)
          .then(res => pool.end())
          .catch(err => {
            console.log("error occured => " + err.message);
            pool.end();
          });
      }
    })
    .catch(err => console.log("error occured =>" + err.message));

}

async function selectFromDB() {
  var s3bulkList = [];
  try {
    const rows = await pool.query("select " + tableColumnNametoUpdate + " from " + databaseTabletoUpdate + " where " + tableColumnNametoUpdate + " like '" + legacyS3ObjectPrefix + "%' limit " + sqlRowLimit)
    s3bulkList = rows.map(element => element[tableColumnNametoUpdate]);
    if (s3bulkList.length > 0) {
      var response = await pool.query("CREATE TABLE IF NOT EXISTS " + stageTableforUpdate + " (ID int NOT NULL AUTO_INCREMENT, OldImageName VARCHAR(255), NewImageName VARCHAR(255), PRIMARY KEY (ID))")
    }
    return s3bulkList;
  } catch (err) {
    throw err;
    return s3bulkList;
  }
}

function loadS3ObjectstoQueue(s3bulkList, startIndex, endIndex) {

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

    bulkList.push(s3ObejectforList);

    if (batchCounter == recordsPerBatch || batchCounter == loopEndIndex) {
      allBatchPromiseList.push(objectQueue.add({
          bucketObjects: bulkList
        }).then(res => console.log("add to queue successful"))
        .catch(error => {
          console.log("add to queue failed see error = " + error.message);
        }));
      recordsPerBatch += ((loopEndIndex - i - 1) < setRecordsPerBatch) ? (loopEndIndex - i - 1) : setRecordsPerBatch;
      bulkList = [];
    }
    batchCounter++;
  }

  Promise.allSettled(allBatchPromiseList).then(function() {

    if (loopEndIndex == endIndex) {
      console.log('Current batch of Queue upload now completed, Awaiting processing by agents to complete');
      var endDateTime = new Date();
      var expended = timediff(startDateTime, endDateTime, 'YDHmS');
      console.log("process expended: " + expended.hours + ":" + expended.minutes + ":" + expended.seconds);

    } else {
      console.log("Current set is done inserting, now commencing next set of batch upload");
      setTimeout(function() {
        console.log("now waiting");
        loadS3toQueueDatabase(s3bulkList, loopEndIndex, s3bulkList.length);
      }, 150);
    }
  });
}

//stageTableforUpdate

objectQueue.on('global:drained', function(jobId, progress) {
  console.log("now updating database");
  pool.query("UPDATE " + databaseTabletoUpdate + " t1 INNER JOIN " + stageTableforUpdate + " t2 ON t1." + tableColumnNametoUpdate + " = t2.OldImageName SET t1." + tableColumnNametoUpdate + " = t2.NewImageName")
    .then((res) => {
      console.log("response is " + res);
      console.log("now truncating");
      return pool.query("TRUNCATE TABLE " + stageTableforUpdate);
    }).then((res) => {
      //Previous batch now complete, check for pending
      initiateObjectSelection();
    })
    .catch(err => {
      //handle error
      console.log("error occured => " + err.message);
    });
});
