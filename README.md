# SRE Test Solution


## Summary of development

This development employs a decoupled architecture; therefore, it will be able to resume from wherever it stops if the process is interrupted.

It consists of 3 major parts;

- The producer job written in Nodejs to push jobs to a queue.
- A queue to contain all jobs pending processing. The queue used for this task is based on `Redis`, therefore a `Redis` container was used for this task.
- Consumer jobs to pull jobs from this queue and process them.

## Resource Emulation for task

To properly emulate resources for this task, a `MariaDB` docker container was used as the Production database, all scripts required to simulate this task are containerd in the `task-Emulation` folder. The following programs were used to prepare simulate the resources for use.

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

#### Note!, Run npm install in this directory before using any of these scripts to install the necessary npm modules.

## Task Resolution

The Nodejs programs are used for the migration task;
- s3JobProducer.js
This program retrieves all image prefixes from database that matches the legacy image prefix. It will then push these prefixes into a `redis` queue in batches to be processed by the consumer. After a batch is completed, it will also execute an update statement on the production database table using a temp table.
- s3JobConsumer.js
This program retrieves batches of image prefixes to be migrated, it will copy a selected legacy prefix from the legacy `s3 bucket` to the `new bucket`. If a copy is successful, it will insert the old image prefix and new image prefix to a temp table on db. After every completed batch, The s3JobProducer.js program will run a single update statement to update the production database prefixes using the temp update table.

This solution is decoupled, so it can always resume from where it stops and the `redis` data will be persisted to disk, it is also scalable as you can have several instances of the s3JobConsumer pulling from the queue.

## Solution Deployment.

For this solution, the terraform configuration file; `terraform.tfvars` MUST be updated. below are the configuration details to be provided;

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
- `CONSUMER_TASK_COUNT`=> Number of tasks to be started by the ECS consumer service. A default value of 1 will be used.

### Solution deployment on AWS ECS

Both the s3JobProducer and s3JobConsumer will be containerized, uploaded to AWS ECR and deployed together with a redis container, this deployment is done using `Terraform` to minimize configuration. Kindly follow the deployment steps below;
- Navigate to the project directory
- change directory into `application-Containerization`
- Run `docker-compose build` command to build docker images for s3JobProducer and s3JobConsumer from the project directory.
- Create a repository in ECR for s3JobProducer and s3JobConsumer.
- Tag and Push the new images to AWS ECR. `Take Note`, ensure you keep the repository name that was created.
- navigate to the directory named `terraform-Deployment-Files` in the project directory.
- Update the ECR_S3_JOB_PRODUCER_REPOSITORY_NAME and ECR_S3_JOB_CONSUMER_REPOSITORY_NAME in the `terraform.tfvars` file with the `repository names` created for s3JobProducer and s3JobProducer respectively.
- confirm all configuration variables have been provided.
- from the project directory, run `terraform init`.
- from the project directory, run `terraform apply`, type `yes` to confirm the deployment of the resources.
- run  `terraform destroy` to remove all provisioned resources once migration is complete. Only run this after task has completed as this will also destroy the persistent redis storage on `EFS`

Once terraform has completed resource provisioning, you can login to the ECS console to view the provisioned resources, the redis container and the s3JobProducer will be in the ECS service named s3Mig_producer_service, while the s3JobConsumer container will be in the ECS service named s3Mig_consumer_service. These two services are separated and are able to communicate using Route 53 service discovery.
You can view the logs for each container in their respective task definition page. To view them, open the tasks window, select the available task, and find the containers within the task.

Once the database has been successfully updated, the s3JobProducer will call the `updateService` API to change the `desired task` count to 0 on both  ECS services i.e s3Mig_producer_service and s3Mig_consumer_service.

`Pleaes Note:` The s3Mig_producer_service and s3Mig_consumer_service may take close to 5 mins to get stable at first launch. This is due to the amount of time spent in allocating EFS and mounting it on redis.

## Performance and Scalability
- Performance: This deployment option is very effective as it leverages on the resources provided on `ECS Fargate`, The database quries are also very optimized using batch queries. using a benchmark test performed locally, using standalone deployment of with just 1 consumer, it could migrate about `5,900 records` per `second.`

- Scalability: this solution fully scalable, `on ECS`, the s3JobConsumer container is on a separate ECS service. This enables it to `scale independently` by modifying the `desired task count`. You can also modify the `CONSUMER_TASK_COUNT` in the `tarraform.tfvars` file, this will adjust the desire task count value the next time you run `terraform apply`.

- Failure proof / Resilience: This solution is also failure proof. As an `EFS` resource has been mounted on the `redis` container in ECS to ensure that if the task is terminated, the redis data will be `persisted` to EFS so the pending jobs will always be preserved in the queue.

## User Privileges

#### The following privileges should be provided to the supplied Mariadb User.
- Create
- Drop
- Insert
- Update
