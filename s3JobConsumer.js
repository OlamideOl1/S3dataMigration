const mariadb = require('mariadb');
const Queue = require('bull');
const AWS = require('aws-sdk');

s3 = new AWS.S3({
  region: GetEnvironmentVar("AWS_REGION", 'us-east-1')
});

const targetS3Bucket = GetEnvironmentVar("TARGET_S3_BUCKET", "");
const sourceS3Bucket = GetEnvironmentVar("SOURCE_S3_BUCKET", "");
const targetObjectPrefix = GetEnvironmentVar("TARGET_OBJECT_PREFIX", "");
const tempTableforUpdate = GetEnvironmentVar("TEMP_TABLE_FOR_UPDATE", "");
const databaseHost = GetEnvironmentVar("DATABASE_HOST", "");
const dbUser = GetEnvironmentVar("DB_USER", "");
const dbPassword = GetEnvironmentVar("DB_PASSWORD", "");
const databaseName = GetEnvironmentVar("DATABASE_NAME", "");
const redisHost = GetEnvironmentVar("REDIS_HOST", "");

const redisPort = 6379;
const connectionLimit = 10;
var pushBucket = [];
var tempObjectList = [];

const dbConfig = {
  host: databaseHost,
  user: dbUser,
  password: dbPassword,
  database: databaseName,
  connectionLimit: connectionLimit,
};



var redisParam = {
  port: redisPort,
  host: redisHost,
  enableOfflineQueue: false
}

const objectQueue = new Queue('objectQueue', {
  redis: redisParam
});
const objectQueueSecondary = new Queue('objectQueue', {
  redis: redisParam
});

const s3CopyObject = (params) => {
  return new Promise((resolve, reject) => {
    s3.copyObject(params, (err, data) => {
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

var pool = mariadb.createPool(dbConfig);

objectQueue.process(function(job, done) {

  pushBucket = [];
  startDateTime = new Date();
  var params = {
    Bucket: targetS3Bucket
  };

  if (job.data.bucketObjects == "migrationcompleted") {
    console.log("migration is completed, will end gracefully.")
    objectQueue.close();
    pool.end();
    done();
    objectQueueSecondary.add({
        bucketObjects: "migrationcompleted"
      }).then(res => {
        console.log("migrationcompleted indicator sent successfully");
        objectQueueSecondary.close();
      })
      .catch(error => {
        console.log("add to queue failed see error = " + error.message);
      });
  }

  var promiseAll = job.data.bucketObjects.map(eachSourceObjectList => copyObjectToDestinationBucket(params, eachSourceObjectList));

  Promise.allSettled(promiseAll).then(function() {

    console.log("All objects pushed to destination bucket");
    batchQuery = "INSERT INTO " + tempTableforUpdate + " (OldImageName,NewImageName) values (?, ?)";

    if (pushBucket.length > 0) {
      processBatchQuery(batchQuery, pushBucket).then(function(res) {
        done();
      });
    } else {
      done();
    }
  });
}).catch(error => console.log("Error occured, have a look " + error.message));

async function copyObjectToDestinationBucket(params, eachSourceObjectList) {

  sourceObject = eachSourceObjectList.oldImagePath;
  params = {
    Bucket: targetS3Bucket
  };

  params.CopySource = "/" + sourceS3Bucket + "/" + sourceObject;
  var sourceObjectSplit = sourceObject.split('/');
  params.Key = targetObjectPrefix + sourceObjectSplit[sourceObjectSplit.length - 1];

  return s3CopyObject(params).then(function(res) {

    tempObjectList = [];
    tempObjectList.push(eachSourceObjectList.oldImagePath);
    tempObjectList.push(eachSourceObjectList.newImagePath);
    pushBucket.push(tempObjectList);
  }).catch(function(err) {
    console.log("Error occured during s3 bucket upload " + err);
  });
}


async function processBatchQuery(batchQuery, bulkList) {

  console.log("now attempting to send query");
  var res = await pool.batch(batchQuery, bulkList).catch(err => {

    if (err.code == "ER_GET_CONNECTION_TIMEOUT" || err.code == "ER_CONNECTION_TIMEOUT") {
      console.log("now retrying");
      return processBatchQuery(batchQuery, bulkList);
    } else {
      console.log("error has occured in reconnect and will not retry, please see details " + err.code + " // " + err.message)
      return err;
    }
  });

  if (res) {
    console.log("Batch insert successful, records affected = " + res.affectedRows);
    return res;
  }
}

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
