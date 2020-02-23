import * as common from './common';
import * as nodeApi from 'azure-devops-node-api';

import * as CoreApi from 'azure-devops-node-api/CoreApi';
import * as CoreInterfaces from 'azure-devops-node-api/interfaces/CoreInterfaces';

import Colors = require('colors/safe');
import { ReleaseQueryOrder, Artifact } from 'azure-devops-node-api/interfaces/ReleaseInterfaces';

function printBuildStatus(sucessfull: boolean, artifact: Artifact, message?: string) {
    let status;

    if (sucessfull) {
        status = Colors.green("OK ✔");
    } else {
        status = Colors.red("NOK ✘");
    }
    common.result(`${status} ${Colors.yellow(message || "")} ${artifact.definitionReference.version.name} ${artifact.definitionReference.artifactSourceVersionUrl.id}`);
}

export async function run(organizationUrl: string, projectName: string) {
    const webApi: nodeApi.WebApi = await common.getWebApi(organizationUrl);

    const coreApiObject: CoreApi.CoreApi = await webApi.getCoreApi();
    const releaseApi = await webApi.getReleaseApi();
    const buildApi = await webApi.getBuildApi();

    common.heading("Getting projects");

    const projects: CoreInterfaces.TeamProjectReference[] = await coreApiObject.getProjects();

    for (var projectReference in projects) {
        const project = projects[projectReference];

        if (projectName && project.name !== projectName) {
            continue;
        }

        common.heading(`Project: ${project.name}`);

        const releaseDefinitions = await releaseApi.getReleaseDefinitions(project.id);

        // Releaes are ordered per descending order, so first one seen wins in a given stage

        for (var releaseDefinitionName in releaseDefinitions) {
            let releaseDefinition = releaseDefinitions[releaseDefinitionName];

            // Hash table indexed per stage ig (environment id)
            // We could look at the name of the environment to get diferent ids with the same name, but opted not to
            // this would be more human and it would supported deletion and recreation of a stage with the same name
            let latestReleasePerStage = [];

            common.heading(`Examining Release Pipeline [${releaseDefinition.name}]`);

            // TODO: doesnt handle continuationtokens like it should.
            // Dependent on https://github.com/microsoft/azure-devops-node-api/issues/232
            const releases = await releaseApi.getDeployments(project.id, releaseDefinition.id, null, null, null, null, null, null, true, ReleaseQueryOrder.Descending);

            // WE SHOULD BE MORE CLEVER and check if the latest deploy of the same release was for multiple stages
            for (var releaseName in releases) {

                const release = releases[releaseName];

                const stageId = release.definitionEnvironmentId;
                const stageKey = `KEY_${stageId}`;

                if (!latestReleasePerStage[stageKey]) {

                    common.heading(`Currently Deployed Release: ${release.release.name} on [${release.releaseEnvironment.name}] (${release.id})`);

                    for (var artifactName in release.release.artifacts) {
                        let artifact = release.release.artifacts[artifactName];

                        if (artifact.type === "Build") {

                            // Only care about latest stages with builds
                            latestReleasePerStage[stageKey] = true;

                            let buildProjectId = artifact.definitionReference.project.id;
                            let buildId = Number.parseInt(artifact.definitionReference.version.id);
                            let buildNumber = artifact.definitionReference.version.name;

                            let build = await buildApi.getBuild(buildProjectId, buildId);

                            if (build === null) {
                                printBuildStatus(false, artifact, "Missing Pipeline");
                            }

                            const hasArtifacts = await (await buildApi.getArtifacts(buildProjectId, buildId))?.length > 0;

                            // If being retained, just continue
                            if (build.retainedByRelease) {
                                printBuildStatus(true, artifact,"Retaiend by Release");
                            } else if (build.keepForever) {
                                printBuildStatus(true, artifact, "Manual Retention");
                            } else {
                                printBuildStatus(false, artifact, "Not Being Retained");
                            }

                            if(hasArtifacts == false) {
                                printBuildStatus(false, artifact, "No Artifacts");
                            }
                        }
                    }
                }
            }
        }
    }
}

///////////////////////////////////////////////////// main

if (process.env["API_TOKEN"] === null) {
    console.error("You need to define an environment variable called API_TOKEN with your Personal access token (PAT)")
    process.exit(-3);
}

const yargs = require('yargs');

const argv: any = require('yargs')
    .usage('Usage: $0 --org organizationUrl --project projectName')
    .demandOption(['org'])
    .alias('org', 'organization')
    .alias('p', 'project')
    .describe('org', 'Organization url eg: https://dev.azure.com/myOrg')
    .describe('p', 'Team project name')
    .argv;

run(argv.org, argv.project)


