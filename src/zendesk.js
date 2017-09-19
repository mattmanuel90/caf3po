var Zendesk = require('zendesk-node-api');
var moment = require('moment');

var zendesk = new Zendesk({
  url: process.env.ZENDESK_URL,
  email: process.env.ZENDESK_EMAIL,
  token: process.env.ZENDESK_TOKEN
});

const groupTickets = (tickets) => {
  return new Promise((resolve, reject) => {
    let groupedTickets = [];
    for (let {id, status, subject, updated_at} of tickets) {
      if(!groupedTickets[status]) {
        groupedTickets[status] = [];
      }
      groupedTickets[status].push({id, status, subject, updated_at});
    }
    resolve(groupedTickets);
  });
}
exports.getZendeskTickets = async (user) => {
  let text = [];

  let groupedTicketsUnassigned = await zendesk.search
  .list(`query=type:ticket status:new group:${process.env.ZENDESK_DEFAULT_GROUP}`)
  .then(tickets => groupTickets(tickets));

  let groupedTicketsAssigned = await zendesk.search
  .list(`query=type:ticket status<closed assignee:${process.env.ZENDESK_DEFAULT_GROUP_USER} assignee:${user}`)
  .then(tickets => groupTickets(tickets));

  const renderTickets = (groupedTickets) => {
    for (let group in groupedTickets ) {
      let message = `You have ${groupedTickets[group].length} ${group} zendesk tickets`;
      let listofTickets = '';
      for (let ticket of groupedTickets[group]) {
        listofTickets += `><${process.env.ZENDESK_URL}/agent/tickets/${ticket.id}|#${ticket.id}> - ${ticket.subject} *Last Updated: ${moment(ticket.updated_at).fromNow()}*\n`;
      }
      text.push({message,listofTickets});
    }
  }

  renderTickets(groupedTicketsUnassigned);
  renderTickets(groupedTicketsAssigned);

  return text;
};