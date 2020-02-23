# Azure Pipelines Check Releases

Script to check if deployed released are being retained (or even exist) and if it has artifacts.

This allows you to determine if you are able to redeploy or promote to the next stage.

If the artifacts are missing it doesn't mean you can't redeploy if you rely on artifacts external to the build (i.e. Docker container).

Disclaimer: This was a quick hack written on a plane, so no thorough testing has been performed and probably some edge cases are missing :)

## Pre requirements

node
run npm install on the main folder go install dependencies by issuing the command

> npm install --only=prod

A PAT token with the following scopes

* Build - Read
* Release - Read

Set an environment variable called API_TOKEN with the value of the token

In windows use 
> set API_TOKEN=XXXXXX
In Linux use
> export API_TOKEN=XXXXXX

The token is NOT persisted anywhere so you need to set it every time you start a new shell

## Usage

node check-releases.js --org http://dev.azure.com/REPLACEWITHORGNAME [--project projectName]

## Known issues

* If you redeploy older releases, it inspects those rather the most new releases (which have been supersed by the redeploy)
  * It should also reconsider the newer ones, but that option has not been taken for the sake of simplicity.
* It doesn't do any pagination, so if you have a high amount of data (team projects or deployments of a given release) some data may be missed. This can only be fixed after the [Azure DevOps node API supports continuation tokens](https://github.com/microsoft/azure-devops-node-api/).
* It doesn't inspect other retention lease types.
