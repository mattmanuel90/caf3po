const botkit = require('botkit');
var moment = require('moment');
var zendesk = require('./zendesk.js');
var jira = require('./jira.js');
var bot;

const printJiraSummary = async (channel, user) => {
  bot.say({
    text: await jira.getJiraSummary(user),
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
  zendesk.getZendeskTickets(user).then(tickets => {
    bot.say({
      attachments: [{"color": "#36a64f"}],
      channel: channel,
      text: `*Zendesk* \n ${renderTickets(tickets)}`
    });
  });
}

const configureGreetingCommand = async (controller) => {
  controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', (bot, message) => {
      bot.reply(message, `Hello, I am CAF-3PO, human cyborg relations. How can I help you?`);
  });
}

const configureSummaryCommand = async (controller) => {
  controller.hears(['summary'], 'direct_message, direct_mention, mention', (bot, message) => {
    let channel = message.channel;
    let emailToBeUsed = "";

    const fetchActivity = async (c, emailToBeUsed) => {
      await printJiraSummary(channel, emailToBeUsed);
      await printZendeskTickets(channel, emailToBeUsed);
      c.next();
    }

    bot.api.users.info({user: message.user}, (error, response) => {

      bot.startConversation(message, (err, convo) => {
        var emailToBeUsed = '';

        convo.addMessage({
          text: `Hi ${response.user.name}, Just want to remind you what you did yesterday on JIRA and Zendesk.`,
          action: 'promptQuestion'
        }, 'summaryGreeting');

        convo.addMessage({
          text: `Sweet! Okay checking activity on {{vars.email}}`,
          action: 'fetchSummaryActivity'
        }, 'emailConfirmation');

        convo.beforeThread('fetchSummaryActivity',  async (con, next) => {
          await printZendeskTickets(channel, emailToBeUsed);
          await printJiraSummary(channel, emailToBeUsed);
          await next();
        });

        convo.addMessage({
          text: `Do you need anymore help?`
        }, 'fetchSummaryActivity');

        convo.addQuestion(`*Q:* Can I assume that your account on both services is ${response.user.profile.email}?`, [
        {
          pattern: bot.utterances.yes,
          callback: (res, con) => {
            emailToBeUsed = response.user.profile.email;
            con.setVar('email', emailToBeUsed);
            con.gotoThread('emailConfirmation');
            con.next();
          }
        },
        {
          pattern: bot.utterances.no,
          callback: (res, con) => {
            con.say(`My baaaaaad`);
            con.ask('*Q:* Aight, so what email shall I use?',(res, con) => {
              emailToBeUsed = `${res.text.split('|')[1].slice(0, -1)}`;
              con.setVar('email', emailToBeUsed);
              con.gotoThread('emailConfirmation');
              con.next();
            });
            con.next();
          }
        },
        {
          pattern: bot.utterances.quit,
          callback: (res, con) => {
            con.say(`No worries`);
            con.next();
          }
        },
        {
          default: true,
          callback: (res,con) =>{
            con.repeat();
            con.next();
          }
        }
        ], {} , 'promptQuestion');
        convo.gotoThread('summaryGreeting');
      });
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