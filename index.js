process.env["NTBA_FIX_319"] = 1; // Fix of 319 error

require('dotenv').config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const mongoose = require("mongoose");
const cron = require('node-cron');

const token = process.env.BOT_API;
const PORT = process.env.PORT;
const DB_URL = process.env.DB_URL;
const DB_PORT = process.env.DB_PORT;
const DB_NAME = process.env.DB_NAME;
const DB_COLLECTION = process.env.DB_COLLECTION;
const TIMEZONE = process.env.TIMEZONE;

const app = express();
const mongoClient = new MongoClient(`${DB_URL}:${DB_PORT}`, { useNewUrlParser: true, useUnifiedTopology: true });
const bot = new TelegramBot(token, { polling: true });
const Schema = mongoose.Schema;

const userScheme = new Schema({
  telegramId: String,
  firstName: String,
  lastName: String,
  userName: String
});

const nowTime = () => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();
  return `${h}:${m}:${s}`;
};

bot.onText(/\/help/, msg => {
  const { id, first_name, last_name, username } = msg.from;

  bot.sendMessage(
    id,
    `Hello, ${first_name}! I'm @CanIDrinkCoffeeBot.\n`
    + '\n'
    + 'I will help you know who on call and could you do some coffee.\n'
    + '\n'
    + '/help - Help message.\n'
    + '/startcall - Let me know that you are on call.\n'
    + '/endcall - Let me know that you finished call.\n'
    + '/iwantcoffee - I will show you list of that bastards who on call right now.'
  );
  console.log(`${nowTime()} ${first_name} ${last_name} (${username}) [${id}] asked for help`);
});

bot.onText(/\/startcall/, msg => {
  const { id, first_name, last_name, username } = msg.from;
  const user = {
    telegramId: id,
    firstName: first_name,
    lastName: last_name,
    userName: username
  };

  mongoose.connect(`${DB_URL}:${DB_PORT}/${DB_NAME}`, { useNewUrlParser: true, useUnifiedTopology: true });

  const User = mongoose.model(DB_COLLECTION, userScheme);
  User.findOne({ telegramId: id }, function(err, docs) {
    if(err) return console.log(err);

    !docs
      ? User.create(user, function(err, doc){
        mongoose.disconnect();
        if(err) return console.log(err);
        bot.sendMessage(id, "Ok! Don't forget to tell me that you finished call.");
      })
      : bot.sendMessage(id, "Hey! You are already in the callers list!");
  });

  console.log(`${nowTime()} ${first_name} ${last_name} (${username}) [${id}] started call`);
});

bot.onText(/\/endcall/, msg => {
  const { id, first_name, last_name, username } = msg.from;

  mongoose.connect(`${DB_URL}:${DB_PORT}/${DB_NAME}`, { useNewUrlParser: true, useUnifiedTopology: true });

  const User = mongoose.model(DB_COLLECTION, userScheme);
  User.findOne({ telegramId: id }, function(err, docs) {
    if(err) return console.log(err);

    docs
      ? User.remove({ telegramId: id }, function(err, doc){
        mongoose.disconnect();
        if(err) return console.log(err);
        bot.sendMessage(id, "Thank you. I've removed you from callers list.");
      })
      : bot.sendMessage(id, "You didn't even start call.");
  });

  console.log(`${nowTime()} ${first_name} ${last_name} (${username}) [${id}] finished call`);
});

bot.onText(/\/iwantcoffee/, msg => {
  const { id, first_name, last_name, username } = msg.from;

  mongoose.connect(`${DB_URL}:${DB_PORT}/${DB_NAME}`, { useNewUrlParser: true, useUnifiedTopology: true });

  const User = mongoose.model(DB_COLLECTION, userScheme);
  User.find({}, function(err, docs) {
    if(err) return console.log(err);

    let message = '';

    if (docs.length) {
      docs.map(guy => message += `${guy.firstName} (@${guy.userName})\n`);

      bot.sendMessage(
        id,
        "I'm sorry, you can't use the coffee machine because of:\n"
        + message
      );
    } else {
      bot.sendMessage(id, "As I know right, nobody on a call right now. Enjoy your coffee.");
    }
  });

  console.log(`${nowTime()} ${first_name} ${last_name} (${username}) [${id}] asked list of people who on call`);
});

app.listen(PORT, () => console.log(`Server works on ${PORT}`));

cron.schedule('* 22 * * *', () => {
  mongoose.connect(`${DB_URL}:${DB_PORT}/${DB_NAME}`, { useNewUrlParser: true, useUnifiedTopology: true });

  const User = mongoose.model(DB_COLLECTION, userScheme);
  User.remove({ telegramId: id }, function(err, doc){
    mongoose.disconnect();
    if(err) return console.log(err);
  })
}, {
  scheduled: true,
  timezone: TIMEZONE
});