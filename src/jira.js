var moment = require('moment');
let JiraApi = require('jira-client');

exports.getJiraSummary = async () => {
	let jira = new JiraApi({
    protocol: 'https',
    host: process.env.JIRA_HOST,
    username: process.env.JIRA_USER,
    password: process.env.JIRA_PASSWORD,
    apiVersion: '2',
    strictSSL: true
  });

  const response = () => { 
    return new Promise( async (resolve,reject)=> {
      try {
        const results = await jira.searchJira(
        `assignee="${process.env.JIRA_USER}" AND status in ('To Do', 'In Progress', Reopened)`
        ,{maxResults:15, expand:["changelog"]});
        resolve(results);
      } catch (err) {
        console.error(err);
        reject(err);
      }
    });
  }

	let {issues,total} = await response();
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
	
			var yesterday = getEarliestTimeStamp(1);
			var changeDate = moment(history.created).unix();

			for (let item of history.items) {
				if (item.field == 'status' && changeDate > yesterday) {
					statusTransitions.push({from: item.fromString, to: item.toString, issue: issue});
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

	var appendedString = `\n :rocket: What you did yesterday:`;
	for (let trans of transitions) {
		var issue = trans.issue;
		appendedString += `\n${getIssueSummary(issue)} Moved from *${trans.from}* to *${trans.to}*`;
	}
	return appendedString;
}

const getEarliestTimeStamp = (num) => moment().subtract(num,'d').startOf('day').unix();
const getDateWithoutTime = (date) => date.setHours(0,0,0,0);
