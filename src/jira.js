var moment = require('moment');
let request = require('request');

var DAYS_TO_FETCH = 365;

exports.getJiraSummary = async (user) => {
  const jiraQuery = `assignee="${user}" AND  status in ('To Do', 'In Progress', Reopened)`;
  var options = {
    method: 'POST',
    url: process.env.JIRA_HOST + '/rest/api/2/search',
    body: {jql: jiraQuery, "maxResults": 15, expand: ['changelog']},
    json: true,
    headers: {
      'Authorization': 'Basic ' + process.env.JIRA_AUTH,
      'Content-Type': 'application/json'
    }
  };

  const doRequest = (url)=> {
    return new Promise((resolve, reject)=>{
      request(options, (error, response, body) => {
        if(!error && response.statusCode == 200){
          resolve(body);
        } else {
          reject(error);
        }
      });
    });
  }

  let {issues,total} = await doRequest();
  let appendedString = `*JIRA* \n :open_book: You have ${total} issues open.`;
  for(let issue of issues) {
    appendedString += `\n${getIssueSummary(issue)} *Last Updated: ${moment(issue.fields.updated).fromNow()}*`;
  }
  appendedString += getStatusTransitionsString(issues);
  return appendedString;
}

const getIssueSummary = (issue) => {
  let appendedString = `><${process.env.JIRA_HOST}/browse/${issue.key}|${issue.key}> - `;
  let {summary} = issue.fields;
  summary = summary.length > 30 ? `${summary.substring(0, 30)}...` : summary;
  appendedString += summary;
  return appendedString;
}

const getStatusTransitions = (issues) => {
  if(issues == null)
    return;
  
  let statusTransitions = [];
  for (let issue of issues) {
    for (let history of issue.changelog.histories) {
  
      var yesterday = moment().subtract(DAYS_TO_FETCH,'d').startOf('day').unix();
      var changeDate = moment(history.created).unix();

      for (let item of history.items) {
        if (item.field == 'status' && changeDate > yesterday) {
          statusTransitions.push({from: item.fromString, to: item.toString, issue});
        }
      }
    }
  }
  return statusTransitions;
}

const getStatusTransitionsString = (issues) => {
  if(issues == null)
    return null;

  var transitions = getStatusTransitions(issues);

  if(transitions.length == 0)
    return `\n :rocket: You did nothing yesterday on your JIRA tickets.`;

  var appendedString = `\n :rocket: What you did ${DAYS_TO_FETCH} day(s) ago.`;

  let groupedTransitions = [];

  for (let transition of transitions) {
    if(!groupedTransitions[transition.issue.key]) {
      groupedTransitions[transition.issue.key] = [];
      groupedTransitions[transition.issue.key].push({
        issue: transition.issue,
        transit: [transition.from, transition.to]
      });
    } else {
      groupedTransitions[transition.issue.key][0].transit.push(transition.to);
    }
  }

  for (let key in groupedTransitions) {
    for(let {issue, transit} of groupedTransitions[key]) {
      appendedString += `\n${getIssueSummary(issue)} Moved from *'${transit.join(`' to '`)}'*`;
    }
  }
  return appendedString;
}

