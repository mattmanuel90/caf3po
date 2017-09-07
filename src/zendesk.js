var Zendesk = require("zendesk-node-api");
var moment = require("moment");

var zendesk = new Zendesk({
	url: process.env.ZENDESK_URL,
	email: process.env.ZENDESK_EMAIL,
	token: process.env.ZENDESK_TOKEN
});

const groupTickets = (tickets) => {
	return new Promise((resolve, reject) => {
		let groupedTickets = [];
		for (let ticket of tickets) {
			if(!groupedTickets[ticket.status]) {
				groupedTickets[ticket.status] = [];
			}
			groupedTickets[ticket.status].push({
				id:ticket.id,
				status: ticket.status,
				subject: ticket.subject,
				updated_at: ticket.updated_at
			});
		}
		resolve(groupedTickets);
	});
}

exports.getZendeskTickets = async (status) => {
	let obj = [];
	let groupedTickets = await zendesk.search
	.list(`query=type:ticket status<closed`)
	.then(tickets => groupTickets(tickets));

	for (let group in groupedTickets ) {
		let message = `You have ${groupedTickets[group].length} ${group} zendesk tickets`;
		let listofTickets = '';
		for (let ticket of groupedTickets[group]) {
			listofTickets += `><${process.env.ZENDESK_URL}/agent/tickets/${ticket.id}|#${ticket.id}> - ${ticket.subject} *Last Updated: ${moment(ticket.updated_at).fromNow()}*\n`;
		}
		obj.push({message,listofTickets});
	}		
	return obj;
};