const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
  try {
    const octokit = github.getOctokit(GITHUB_TOKEN);
    // load approvers from the config file
    let teamMembers_file = await octokit.repos.getContent({
      owner,
      repo,
      path: ".github/approvers.json",
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
        accept: "application/json",
      },
    });

    let teamMembers = JSON.parse(
      Buffer.from(teamMembers_file.data.content, "base64").toString("utf-8")
    );

    console.log(teamMembers);

    const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
    console.log(`GITHUB_TOKEN: ${GITHUB_TOKEN}`);
    const { context = {} } = github;
    const { pull_request } = context.payload;
    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context, undefined, 2);
    console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
