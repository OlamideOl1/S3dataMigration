const mariadb = require('mariadb');
var Queue = require('bull');
var timediff = require('timediff');

const databaseHost = GetEnvironmentVar("DATABASE_HOST", "");
const dbUser = GetEnvironmentVar("DB_USER", "");
const dbPassword = GetEnvironmentVar("DB_PASSWORD", "");
const databaseName = GetEnvironmentVar("DATABASE_NAME", "");
const legacyS3ObjectPrefix = GetEnvironmentVar("LEGACY_S3_OBJECT_PREFIX", "");
const targetObjectPrefix = GetEnvironmentVar("TARGET_OBJECT_PREFIX", "");
const tempTableforUpdate = GetEnvironmentVar("TEMP_TABLE_FOR_UPDATE", "");
const databaseTabletoUpdate = GetEnvironmentVar("DATABASE_TABLE_TO_UPDATE", "");
const tableColumnNametoUpdate = GetEnvironmentVar("TABLE_COLUMN_NAME_TO_UPDATE", "");
const targetS3Bucket = GetEnvironmentVar("TARGET_S3_BUCKET", "");
const redisHost = GetEnvironmentVar("REDIS_HOST", "");

const redisPort = 6379;
const sqlRowLimit = 5000000;
const maxUploadPerInvocation = 1000000;
const setRecordsPerBatch = 30000;
const startDateTime = new Date();
const connectionLimit = 10;

var dbConfig = {
  host: databaseHost,
  user: dbUser,
  password: dbPassword,
  database: databaseName,
  connectionLimit: connectionLimit,
};
var pool = mariadb.createPool(dbConfig);

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

// const objectQueueDrain = new Queue('objectQueue', {
//   redis: redisParamOffline
// });

const objectQueueOffline = new Queue('objectQueue', {
  redis: redisParamOffline
});

objectQueueOffline.empty()
  .then(res => objectQueue.clean(1))
  .then(res => objectQueue.clean(1, 'failed'))
  .then(res => objectQueueOffline.close())
  .catch(err => console.log("error occured here " + err.message));

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
          }).then(res => {
            console.log("migrationcompleted indicator sent successfully");
            objectQueue.close();
          })
          .catch(error => {
            console.log("add to queue failed see error = " + error.message);
          });

        pool.query("DROP TABLE IF EXISTS " + tempTableforUpdate)
          .then(res => pool.end())
          .catch(err => {
            console.log("error occured => " + err.message);
            pool.end();
          });
      }
    })
    // .then(res => process.exit();)
    .catch(err => console.log("error occured =>" + err.message));

}

async function selectFromDB() {
  var s3bulkList = [];
  try {
    const rows = await pool.query("select " + tableColumnNametoUpdate + " from " + databaseTabletoUpdate + " where " + tableColumnNametoUpdate + " like '" + legacyS3ObjectPrefix + "%' limit " + sqlRowLimit)
    s3bulkList = rows.map(element => element[tableColumnNametoUpdate]);
    if (s3bulkList.length > 0) {
      var response = await pool.query("CREATE TABLE IF NOT EXISTS " + tempTableforUpdate + " (ID int NOT NULL AUTO_INCREMENT, OldImageName VARCHAR(255), NewImageName VARCHAR(255), PRIMARY KEY (ID))")
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

//tempTableforUpdate

objectQueue.on('global:drained', function(jobId, progress) {
  console.log("now updating database");
  pool.query("UPDATE " + databaseTabletoUpdate + " t1 INNER JOIN " + tempTableforUpdate + " t2 ON t1." + tableColumnNametoUpdate + " = t2.OldImageName SET t1." + tableColumnNametoUpdate + " = t2.NewImageName")
    .then((res) => {
      console.log("response is " + res);
      console.log("now truncating");
      return pool.query("TRUNCATE TABLE " + tempTableforUpdate);
    }).then((res) => {
      //Previous batch now complete, check for pending
      initiateObjectSelection();
    })
    .catch(err => {
      //handle error
      console.log("error occured => " + err.message);
    });
});

function GetEnvironmentVar(varname, defaultvalue) {
  try {
    if (process.env[varname] != undefined) {
      var result = process.env[varname];
      return result.replace(/["]/g, '');
    } else {
      if (defaultvalue == "") {
        console.log("Please set a value for " + varname + " in terraform.tfvars, process will now end gracefully");
        process.exit();
      }
      return defaultvalue;
    }
  } catch (err) {
    console.log("error occured =>" + err.message);
    console.log("Please set a right value for " + varname + " in terraform.tfvars, process will now end gracefully");
    process.exit();
  }
}
