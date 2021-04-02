// This program selects images matching a defined prefix from Database and uploads
// these prefixes are then batched and uploaded to a redis queue for asynchronous processig by a consumer job

const AWS = require('aws-sdk');
const mariadb = require('mariadb');
var Queue = require('bull');
var timediff = require('timediff');

var ecs = new AWS.ECS({
  region: GetEnvironmentVar("AWS_REGION", 'us-east-1'),
  apiVersion: '2014-11-13'
});

// retrive environmental variables
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

// The environmental variables below are set by terraform ONLY when running in ECS mode
const consumerServiceName = GetEnvironmentVar("CONSUMER_SERVICE_NAME", "dockercompose");
const producerServiceName = GetEnvironmentVar("PRODUCER_SERVICE_NAME", "dockercompose");
const clusterName = GetEnvironmentVar("CLUSTER_NAME", "dockercompose");


const redisPort = 6379;

// sql select limit - max number of rows returned by a select statement
const sqlRowLimit = 5000000;
// max number of jobs loaded to Queue concurrently
const maxUploadPerInvocation = 1000000;
// number of jobs to batch as one in queue
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

var redisParamOffline = {
  port: redisPort,
  host: redisHost,
}

//initiate new offline Quee
const objectQueueOffline = new Queue('objectQueue', {
  redis: redisParamOffline
});

// Clean queue before starting
objectQueueOffline.empty()
  .then(res => objectQueue.clean(1))
  .then(res => objectQueue.clean(1, 'failed'))
  .then(res => objectQueueOffline.close())
  .catch(err => console.log("error occured here " + err.message));

// Promisify the ecs updateService method.
// Thereby converting the method from Callback response to Promise response.

const ecsUpdateService = (params) => {
  return new Promise((resolve, reject) => {
    ecs.updateService(params, (err, data) => {
      if (err) {
        console.log("error occured =>" + err.message);
        // return reject(err);
        // throw err;
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

//initiate new database connection

let pool;
try {
  pool = mariadb.createPool(dbConfig);
  pool.query("SELECT 1").catch(err => {
    console.log("Connection to database failed, please review database connection details.");
    process.exit(1);
  });
} catch (err) {
  console.log("error occured => " + err.message);
  process.exit(1);
}

var redisParam = {
  port: redisPort,
  host: redisHost,
  enableOfflineQueue: false
}

//initiate new Queue
const objectQueue = new Queue('objectQueue', {
  redis: redisParam
});



var s3bulkList = [];
var allBatchPromiseList = [];

// Start job collection and load to queue
initiateJobSelection();


function initiateJobSelection() {

  //call function to select image prefixes to be moved
  selectFromDB()
    .then(res => {
      if (res.length > 0) {

        //if prefixes are found, load them to redis queue
        console.log("sending object prefixes to queue");
        loadS3ObjectstoQueue(res, 0, res.length);
      } else {
        console.log("No records selected for migration");

        pool.query("DROP TABLE IF EXISTS " + tempTableforUpdate)
          .then(res => {
            pool.end();
            console.log("temp table now dropped");
          })
          .catch(err => {
            console.log("error occured => " + err.message);
            pool.end();
          });


        if (consumerServiceName != "dockercompose") {

          console.log("migration completed, now setting consumer service task count to 0");

          var consumerParams = {
            desiredCount: 0,
            service: consumerServiceName,
            cluster: clusterName
          };

          // Now set task count to 0 for ecs producer service
          ecsUpdateService(consumerParams).then(function(res) {

            console.log("task count set to 0 for consumer, now setting task count to 0 for producer");
            var producerParams = {
              desiredCount: 0,
              service: producerServiceName,
              cluster: clusterName
            };
            // Now set task count to 0 for ecs consumer service
            return ecsUpdateService(producerParams).catch(function(err) {
              console.log("error occured while setting producer task count to 0 => " + err.message);
              //close redis queue
              objectQueue.close();
            });

          }).then(function(res) {
            //close redis queue
            objectQueue.close();
          }).catch(function(err) {
            console.log("Error occured while changing ecs consumer task count " + err);
            //close redis queue
            // objectQueue.close();
            // objectQueueSecondary.close();
            console.log("will now check Db for pending tasks again");
            initiateJobSelection();
          })
        } else {
          //send migration completed indicatotr to queue if no prefixes need to be moved.
          objectQueue.add({
              bucketObjects: "migrationcompleted"
            }).then(res => {
              console.log("migrationcompleted indicator sent successfully");

                objectQueue.close();

            })
            .catch(error => {
              console.log("add to queue failed see error = " + error.message);
            });
        }

      }
    })
    // .then(res => process.exit();)
    .catch(err => console.log("error occured =>" + err.message));
}

// function to select prefixes that need to be moved.
async function selectFromDB() {
  var s3bulkList = [];
  try {
    const rows = await pool.query("select " + tableColumnNametoUpdate + " from " + databaseTabletoUpdate + " where " + tableColumnNametoUpdate + " like '" + legacyS3ObjectPrefix + "%' limit " + sqlRowLimit)
    s3bulkList = rows.map(element => element[tableColumnNametoUpdate]);
    if (s3bulkList.length > 0) {
      var response = await pool.query("CREATE TABLE IF NOT EXISTS " + tempTableforUpdate + " (ID int NOT NULL AUTO_INCREMENT, OldImageName VARCHAR(255), NewImageName VARCHAR(255), PRIMARY KEY (ID))")
      console.log("temp table created successfully");
    }
    return s3bulkList;
  } catch (err) {
    throw err;
    return s3bulkList;
  }
}

// function to push prefixes that have to be processed to queue
function loadS3ObjectstoQueue(s3bulkList, startIndex, endIndex) {

  // number of jobs left to upload to queue is less than maxUploadPerInvocation, then use endIndex, else use maxUploadPerInvocation
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
    // get actual image name from OldImagepath
    var sourceObjectSplit = oldImagePath.split('/');
    // construct new image path
    var newImagePath = targetObjectPrefix + sourceObjectSplit[sourceObjectSplit.length - 1];

    s3ObejectforList.oldImagePath = oldImagePath;
    s3ObejectforList.newImagePath = newImagePath;

    bulkList.push(s3ObejectforList);

    if (batchCounter == recordsPerBatch || batchCounter == loopEndIndex) {
      // add object holding old and new image names to queue
      allBatchPromiseList.push(objectQueue.add({
          bucketObjects: bulkList
        }).then(res => console.log("add to queue successful"))
        .catch(error => {
          console.log("add to queue failed see error = " + error.message);
        }));
      //if number of prefixes left to upload to queue is less than size set in setRecordsPerBatch, then upload the remaining prefixes as a batch on their own
      recordsPerBatch += ((loopEndIndex - i - 1) < setRecordsPerBatch) ? (loopEndIndex - i - 1) : setRecordsPerBatch;
      bulkList = [];
    }
    batchCounter++;
  }

  // This promise event will trigger once current batch of queue upload is done. Will trigger next set of batch upload if there are more prefixes to upload.
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

// This event will trigger once redis queue is empty and all jobs are uploaded. it will initiate query to update production table with the new image prefix for all prefixes
// that were successfully uploaded by consumer job, reference table for update is => tempTableforUpdate. This table is populated by consumer for every succesful s3ObjectCopy

objectQueue.on('global:drained', function(jobId, progress) {
  console.log("now updating database with new image prefix");
  pool.query("UPDATE " + databaseTabletoUpdate + " t1 INNER JOIN " + tempTableforUpdate + " t2 ON t1." + tableColumnNametoUpdate + " = t2.OldImageName SET t1." + tableColumnNametoUpdate + " = t2.NewImageName")
    .then((res) => {
      console.log("response is " + res);
      console.log("now truncating");

      // remove prefixes from temp table after update
      return pool.query("TRUNCATE TABLE " + tempTableforUpdate);
    }).then((res) => {
      //Previous batch now complete, check for pending jobs to be processed and initiate them
      initiateJobSelection();
    })
    .catch(err => {
      //handle error
      console.log("error occured => " + err.message);
    });
});

// function to get value of env variable, and check if any is empty.
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
