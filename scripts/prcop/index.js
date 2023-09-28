const core = require("@actions/core");
const github = require("@actions/github");
const { Octokit } = require("@octokit/rest");

async function run() {
  try {
    const octokit = new Octokit();
    const { context = {} } = github;
    const { owner, repo } = context.repo;
    const pr_author = context.payload.pull_request.user.login;
    const pull_number = context.payload.pull_request.number;

    let requested_reviewers = await octokit.pulls.listRequestedReviewers({
      owner,
      repo,
      pull_number,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    let teamMembers_file = await octokit.repos.getContent({
      owner,
      repo,
      path: ".github/approvers.json",
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
        accept: "application/json",
      },
    });

    let userData = requested_reviewers.data.users;
    userData = userData.map((user) => {
      return { user: user.login, id: user.id, node_id: user.node_id };
    });

    let teamData = requested_reviewers.data.teams;
    teamData = teamData.map((team) => {
      return { team: team.slug, id: team.id, node_id: team.node_id };
    });

    let teamMembers = JSON.parse(
      Buffer.from(teamMembers_file.data.content, "base64").toString("utf-8")
    );

    for (const key in teamMembers) {
      let team_members = teamMembers[key];
      team_members = team_members.filter((member) => member !== pr_author);
      teamMembers[key] = team_members;
    }

    // create a map of team members
    let teamMembersMap = {};
    teamData.forEach((team) => {
      const teamName = team.team;
      teamMembersMap[teamName] = {
        team_id: team.id,
        member_assigned: false,
        team_members: teamMembers[teamName].map((member) => ({
          login: member,
          pr_requests: 0,
          assigned_this_pr: false,
        })),
      };
    });

    console.log("Members Map 1: " ,JSON.stringify(teamMembersMap));

    // update teamMembersMap with PRs assigned to each member from userData
    userData.forEach((user) => {
      const userLogin = user.user;
      for (const key in teamMembers) {
        let team_name = key;
        let team_members = teamMembers[key];
        if (team_members.includes(userLogin)) {
          if (teamMembersMap[team_name]) {
            teamMembersMap[team_name].team_members.forEach((member) => {
              if (member.login === userLogin) {
                member.assigned_this_pr = true;
                teamMembersMap[team_name].member_assigned = true;
              }
            });
          }
        }
      }
    });

    console.log("Members Map 2: " ,JSON.stringify(teamMembersMap));

    // get open pull requests
    let open_pull_requests = await octokit.pulls.list({
      owner,
      repo,
      state: "open",
    });

    console.log("Open PRS:",JSON.stringify(open_pull_requests.data));

    // get teams that are not assigned
    let teams_not_assigned = [];
    for (const key in teamMembersMap) {
      if (!teamMembersMap[key].member_assigned) {
        teams_not_assigned.push({ ...teamMembersMap[key], team_name: key });
      }
    }

    // for each user in teams_not_assigned get the number of PRs assigned

    let open_pull_requests_json = open_pull_requests.data;
    let active_reviewers = open_pull_requests_json.map(
      (pr) => pr.requested_reviewers
    );

    active_reviewers = active_reviewers.flat();
    active_reviewers.forEach((reviewer) => {
      teams_not_assigned.forEach((team) => {
        team.team_members.forEach((member) => {
          if (member.login === reviewer.login) {
            member.pr_requests += 1;
          }
        });
      });
    });

    active_reviewers = active_reviewers.map((reviewer) => {
      return {
        login: reviewer.login,
        id: reviewer.id,
        node_id: reviewer.node_id,
      };
    });

    // sort team members based on number of PRs assigned in ascending order
    teams_not_assigned.forEach((team) => {
      team.team_members.sort((a, b) => a.pr_requests - b.pr_requests);
    });

    // assign the PR to the member with least number of PRs for each team that is needed to approve the PR
    teams_not_assigned.forEach(async (team) => {
      if (team.team_members.length > 0) {
        let member = team.team_members[0];
        await octokit.pulls.requestReviewers({
          owner,
          repo,
          pull_number,
          reviewers: [member.login],
        });
      }
    });
    // console.log(active_reviewers);
    console.log(JSON.stringify(teams_not_assigned));
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
