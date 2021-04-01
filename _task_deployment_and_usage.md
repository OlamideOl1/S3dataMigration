# SRE Test Solution

This task has been completed using Nodejs. Also please note that the database used in this solution is `MariaDb`. Quite a lot of benchmarks tests and simulations were already completed using a sample `MariaDB` database as specified in the first project document I was given.

Adequate time will be required to modify all existing methods to use `PostgreSQL` and complete some benchmark tests to gauge performance index.

## Summary of development

This development employs a decoupled architecture; therefore, it will be able to resume from wherever it stops if the process is interrupted.

It consists of 3 major parts;

- The producer job written in Nodejs to push jobs to a queue.
- A queue to contain all jobs pending processing. The queue used for this task is based on `Redis`, therefore a `Redis` container was used for this task.
- Consumer jobs to pull jobs from this queue and process them.

## Resource Emulation for task

To properly emulate resources for this task, a `MariaDB` docker container was used as the Production database, the following programs were used to prepare simulate the resources for use.

- createSampleDBTable.js
This Nodejs program will create a sample table if it does not exist already with 2 columns; An auto generated ID column and another column for the `legacy` image name.
- jobWorker.js
This nodejs program to push sample jobs to a redis queue to simulate as much as 10 million jobs to be processed.
- jobProducer.js
This nodejs program to pick sample jobs from redis queue to simulate as much as 10 million jobs to be processed.
- flushQueue.js
This nodejs program to clear queue contents while testing.
- pushDummyS3objectsforTest.js
This Nodejs program was used to upload sample objects to s3 bucket using AWS S3.

## Task Resolution

The Nodejs programs are used for the migration task;
- s3JobProducer.js
This program retrieves all image prefixes from database that matches the legacy image prefix. It will then push these prefixes into a `redis` queue in batches to be processed by the consumer. After a batch is completed, it will also execute an update statement on the production database table using a temp table.
- s3JobConsumer.js
This program retrieves batches of image prefixes to be migrated, it will copy a selected legacy prefix from the legacy `s3 bucket` to the `new bucket`. If a copy is successful, it will insert the old image prefix and new image prefix to a temp table on db. After every completed batch, The s3JobProducer.js program will run a single update statement to update the production database prefixes using the temp update table.

This solution is decoupled, so it can always resume from where it stops and the `redis` data will be persisted to disk, it is also scalable as you can have several instances of the s3JobConsumer pulling from the queue.

## Solution Deployment.

For this solution, two deployment options are available in the git repository provided. `Option 1`makes use of AWS ECS to run the programs as tasks. `Option 2` makes use of docker-compose to run this program locally, or on an EC2 instance. Before proceeding to using either of these options, the terraform configuration file; `terraform.tfvars` MUST be updated. below are the configuration details to be provided;

- `ECR_S3_JOB_PRODUCER_REPOSITORY_NAME`=> Repository name for s3jobproducer image in ECR.  Example: "s3jobproducer"
- `ECR_S3_JOB_CONSUMER_REPOSITORY_NAME`=> Repository name for s3jobconsumer image in ECR.   Example: "s3jobconsumer"
- `TARGET_S3_BUCKET`=> Name of target / destinaton bucket to migrate objects from.   Example: "newproductionbucket"
- `SOURCE_S3_BUCKET`=> Name of source / legacy bucket to migrate objects to.   Example: "legacybucket"
- `LEGACY_S3_OBJECT_PREFIX`=> Image prefix (folder) in legacy bucket to migrate.    Example: "image"
- `TARGET_OBJECT_PREFIX`=> Image prefix to be used in target bucket.    Example: "avatar/"
- `TEMP_TABLE_FOR_UPDATE`=> A temporary table to be used for this migration. Should be a table name does not already exist. A default value has been provided.
- `DATABASE_HOST`=> Database host detail.  Example: "54.55.44.33"
- `DB_USER`=> Database user to be used for migration operation.     Example: "root"
- `DB_PASSWORD`=> Password for database user for migration operation.     Example: "123456"
- `DATABASE_NAME`=> Name of database for migration operation.     Example: "ImageDataDatabase"
- `DATABASE_TABLE_TO_UPDATE`=> Name of Table in database that contains the image prefixes to be updated.     Example: "ImageDataTable"
- `TABLE_COLUMN_NAME_TO_UPDATE`=> Name of Column in the provided database table contains the image prefixes to be updated.     Example: "ImagePath"
- `AWS_REGION`=> Default AWS Region to use for migration. A default value has been provided.
####Please Note!
The AWS Access key details below should only be provided when using the local / docker-compse deployment option, for ECS deployment option, do not specify these details, necessary roles are provided in terraform template
- `AWS_ACCESS_KEY_ID`=> This key ID will be generated for you using a terraform template using the least privileges required by the IAM user.
- `AWS_SECRET_ACCESS_KEY`=> This secret key will be generated for you using a terraform template using the least privileges required by the IAM user.

### Solution deployment on AWS ECS

Both the s3JobProducer and s3JobConsumer will be containerized, uploaded to AWS ECR and deployed together with a redis container, this deployment is done using `Terraform` to minimize configuration. Kindly follow the deployment steps below;
- Navigate to the project directory
- Run `docker-compose build` command to build docker images for s3JobProducer and s3JobConsumer from the project directory.
- Create a repository in ECR for s3JobProducer and s3JobConsumer.
- Tag and Push the new images to AWS ECR. `Take Note`, ensure you keep the repository name that was created.
- Update the ECR_S3_JOB_PRODUCER_REPOSITORY_NAME and ECR_S3_JOB_CONSUMER_REPOSITORY_NAME with the repository names created for s3JobProducer and s3JobProducer respectively.
- confirm all configuration variables have been provided.
- from the project directory, run `terraform init`.
- from the project directory, run `terraform apply`, type `yes` to confirm the deployment of the resources.
- run  `terraform destroy` to remove all provisioned resources once migration is complete. Only run this after task has completed as this will also destroy the persistent redis storage on `EFS`

Once terraform has completed resource provisioning, you can login to the ECS console to view the provisioned resources, the logs for the redis queue, s3JobProducer and the s3JobProducer containers are available in the task definition. To view them, open the tasks window, select the available task, and find the containers within the task.

Once the database has been successfully update, the task will terminate automatically and all 3 containers will stop.


### Solution deployment on docker-compose

To deploy this solution locally on a docker enabled host (locally OR an EC2 instance), follow the steps below. Note, make sure docker-compose installed on the host
- Navigate to the project directory
- ensure sure all configuration variables except `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` have been set in `terraform.tfvars`
- run `cd dockerComposeIamAccess` to change directory to folder named dockerComposeIamAccess.
- run `terraform apply -var-file ../terraform.tfvars` to create IAM access details to be used for the migration. This IAM user details will have the least privilege required for this migration. Please note that the policy definition used by terraform for the IAM user is written inline inside .`/dockerComposeIamAccess/iamUserForMigration.tf`
- The `secret key` and the `secret key id` will be printed on screen and are also stored in files named `s3MigAccessKeyID.txt` and `s3MigSecretAccessKey.txt` respectively.
- run `cd ../` to navigate to back to the project directory
- Open the `terraform.tfvars` file and update
- update the configuration variables `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `terraform.tfvars` with the generated `secret key` and `secret key id` respectively.
- Run `docker-compose build` command to build docker images for s3jobproducer and s3jobconsumer from the project directory.
- To start migration process, run the command `docker-compose up` to run in an interactive mode or `docker-compose up -d` for background processing.
- Once migration is complete, s3jobproducer and s3jobconsumer will stop.
- run `docker-compose down` to kill the process OR CTRL+C if running in interactive mode.
- run `cd dockerComposeIamAccess` to change directory to folder named dockerComposeIamAccess.
- run `terraform destroy -var-file ../terraform.tfvars` to destroy the provisioned IAM access details used for the migration.

## Performance and Scalability
- Performance: This deployment option is very effective as it leverages on the resources provided on `ECS Fargate`, The database quries are also very optimized using batch queries. using a benchmark test performed locally, using standalone deployment of with just 1 consumer, it could migrate about `5,900 records` per `second.`
- Scalability: Both deployment options are scalable, `on ECS`, the deployment can be made to run with multiple tasks by adjusting the number of desired tasks for the task definition resource in the main.tf file. `on docker-compose`, This solution will also prove to be scalable by adjusting the number of `replicas` for the `s3jobconsumer` container. You can scale up the s3jobconsumer container by adjusting the replicas section under the deploy section of s3jobconsumer OR you can run this command after the service has been started => `docker-compose scale s3jobconsumer=<number of replicas>`
- Failure proof / Resilience: This solution is also failure proof. As an `EFS` resource has been mounted on the `redis` container in ECS to ensure that if the task is terminated, the redis data will be `persisted` to EFS so the pending jobs will always be preserved in the queue. The `docker-compose` deployment option is also failure proof as the redis container has a `volume mount` to enable it persist data to disk even if the container is destroyed.

## User Privileges

#### The following privileges should be provided to the supplied Mariadb User.
- Create
- Drop
- Insert
- Update

#### For access to the s3 bucket, the Policy below will be applied to the created IAM user;
`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Stmt1615557370374",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectTagging",
        "s3:ListBucket",
        "s3:PutObject",
        "s3:PutObjectTagging"
      ],
      "Effect": "Allow",
      "Resource": [
        "arn:aws:s3:::${var.SOURCE_S3_BUCKET}",
        "arn:aws:s3:::${var.SOURCE_S3_BUCKET}/*",
        "arn:aws:s3:::${var.TARGET_S3_BUCKET}/*",
        "arn:aws:s3:::${var.TARGET_S3_BUCKET}"
      ]
    }
  ]
}`
- Please note that this policy will be automatically added to the create IAM user when using the docker-compose deployment option.
- When using the AWS ECS deployment option, please note that this policy will be attached to the `task_role` for the task definition. Please review the `main.tf` file for more details.
