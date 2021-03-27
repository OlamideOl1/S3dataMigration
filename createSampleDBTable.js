var numberOfObjectsToUpload = 200;

var bucketName = "legacybucket77";

const mariadb = require('mariadb/callback');

const pool = mariadb.createPool({
  host: "3.233.221.242",
  user: "root",
  password: 'Ab@123456',
  database: "userImageData",
  connectionLimit: 10
});
var tableName = "ImageData";
var tableColumnName = "Imagepath";

//set content for dummy object to be uploaded.
var objectBody = "this is a test content for objects to be uploaded";
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region
AWS.config.update({
  region: 'us-east-1'
});

// Create S3 service object
s3 = new AWS.S3({
  region: 'us-east-1'
});

// call S3 to retrieve upload file to specified bucket
var uploadParams = {
  Bucket: bucketName,
  Key: '',
  Body: objectBody,
  ACL: "private"
};
// var file = process.argv[3];

var response = await pool.query("CREATE TABLE IF NOT EXISTS " + tableName + " (ID int NOT NULL AUTO_INCREMENT , " + tableColumnName + " VARCHAR(255) , PRIMARY KEY (ID))");

var path = require('path');

for (var i = 0; i < numberOfObjectsToUpload; i++) {

  uploadParams.Key = "image/avatar" + i + ".txt";

  insertTableData(uploadParams.Key);

}

async function insertTableData(oldImagePath) {

  try {

    // const rows = await conn.query("SELECT 1 as val");
    // // rows: [ {val: 1}, meta: ... ]

    var objectUpdateQuery = "INSERT INTO " + tableName + "(" + tableColumnName + ") VALUES ('" + oldImagePath + "')";

    var res = await pool.query(objectUpdateQuery).catch(function() {
      console.log("Promise Rejected");
    });;
    // res: { affectedRows: 1, insertId: 1, warningStatus: 0 }
    if (res.affectedRows) {
      dbUpdateFlag = true;
    }

  } catch (err) {
    throw err;
  }
}
