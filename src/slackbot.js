const botkit = require('botkit');
var moment = require('moment');
var zendesk = require('./zendesk.js');
var jira = require('./jira.js');
var bot;

const printJiraSummary = async (channel, user) => {
  bot.say({
    text: await jira.getJiraSummary(),
    channel: channel
  });
}

const printZendeskTickets = (channel, user) => {
  const renderTickets = (tickets) => {
    let appendedString = '';
    tickets.forEach(group => {
      appendedString += `${group.message}\n${group.listofTickets}`;
      return appendedString;
    });
    return appendedString;
  }
  zendesk.getZendeskTickets().then(tickets => {
    bot.say({
      attachments: [{"color": "#36a64f"}],
      channel: channel,
      text: `*Zendesk* \n ${renderTickets(tickets)}`
    });
  });
}

const configureGreetingCommand = async (controller) => {
  controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', (bot, message) => {
      bot.reply(message, `Hello, I am CAF-3PO, human cyborg relations. How might I serve you?`);
  });
}

const configureSummaryCommand = async (controller) => {
  controller.hears(['summary'], 'direct_message, direct_mention, mention', (bot, message) => {
    let channel = message.channel;
    bot.api.users.info({user: message.user}, (error, response) => {
      bot.say({
        text: `Hi ${response.user.name}, this is your daily summary. Just hang on for a bit.`,
        channel: channel
      });
      printJiraSummary(channel, response.user);
      printZendeskTickets(channel, response.user);
    });
  });
}


const configureMessagesCommands = async (controller) => {
  controller.hears(['messages'], 'direct_message,direct_mention,mention', async (bot, message) => {
    const groupHistory = new Promise((resolve, reject) =>
      bot.api.groups.list({}, (err, response) => {
        resolve(response.groups.filter(c => c.members.includes(message.user)).map(c => c.id));
      })
    );

    const channelHistory = new Promise((resolve, reject) =>
      bot.api.channels.list({}, (err, response) => {
        resolve(response.channels.filter(c => c.members.includes(message.user)).map(c => c.id));
      })
    );

    const imHistory = new Promise((resolve, reject) =>
      bot.api.im.list({}, (err, response) => {
        resolve(response.ims.filter(c => c.user == message.user).map(c => c.id));
      })
    );

    const mpimHistory = new Promise((resolve, reject) => 
      bot.api.mpim.list({}, (err, response) => {
        resolve(response.groups.filter(c => c.members.includes(message.user)).map( c => c.id ));
      })
    );

    const processChannelHistory = (item) => new Promise((resolve, reject) =>
      bot.api.channels.history({ channel: item }, (err, response) => {
        var obj = response.messages.filter(c => {
          if (message.text.length == 8) {
            dayIndex = 5;
          } else {
            var lastChar = message.text[message.text.length - 1];
            dayIndex = parseInt(lastChar);
          }
          var startDay = moment().startOf("day").isoWeekday(dayIndex).unix() * 1000;
          var endDay = moment().endOf("day").isoWeekday(dayIndex).unix() * 1000;
          var messageTs = c.ts * 1000;
          if (
            c.user == message.user &&
            messageTs > startDay &&
            messageTs < endDay
          ) {
            return c;
          }
        });
        var messageSummary = { channelName: item, messages: obj };
        resolve(allMessagesInChannels.push(messageSummary));
      })
    );

    const channelMessageSummary = (count, name) => {
      bot.say({
        text: `You sent ${count}messages in #${name} on ${moment().weekday(dayIndex).format("dddd")}`,
        channel: message.channel
      });
    };

    let groupHistoryResults = await groupHistory;
    let channelHistoryResults = await channelHistory;
    let imHistoryResults = await imHistory;
    let mpimHistoryResults = await mpimHistory;

    let allChannels = [
      ...groupHistoryResults,
      ...channelHistoryResults,
      ...imHistoryResults,
      ...mpimHistoryResults
    ];

    var allMessagesInChannels = [];
    var dayIndex = 1;

    for(item of channelHistoryResults) {
      await processChannelHistory(item);
    }

    bot.api.channels.list({}, (err, response) => {
      var channelNames = response.channels.map(c => ({ id: c.id, name: c.name }));
      allMessagesInChannels.forEach((channelInfo) => channelNames
        .filter(channelName => channelInfo.channelName === channelName.id)
        .forEach(channelName => { channelMessageSummary(channelInfo.messages.length,channelName.name);} ));
    });
  });
}

exports.initialize = async () => {
  let controller = botkit.slackbot({
    debug: false,
  });

  bot = controller.spawn({
    token: process.env.SLACK_TOKEN
  }).startRTM();

  configureGreetingCommand(controller);
  configureSummaryCommand(controller);
  configureMessagesCommands(controller);
};