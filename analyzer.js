var zmq = require('zeromq'), sock = zmq.socket('pull');

const { WebcastPushConnection } = require('tiktok-live-connector');
const fs = require('fs'); 
var userData = new Map();
const logFilePath = '/home/mod/Desktop/ttp/summaries.txt';

sock.connect('tcp://127.0.0.1:3000');

sock.on('message', function(msg){
    let command = msg.toString();
    switch(command[0]){
        case '+':
            command = command.slice(1);
            userData.set(command,
                {
                username: command,
                startDate: "dd/mm/yyyy",
                timeElapsed: "0",
                coins: 0,
                donations: 0,
                cpd: 0,
                lastDonation: "never",
                ended: false});
            analyze(command);
            break;

        case '-':
            command = command.slice(1);
            userData.delete(command);
            break;
    }
});

function msToTime(ms) {
    let seconds = (ms / 1000).toFixed(1);
    let minutes = (ms / (1000 * 60)).toFixed(1);
    let hours = (ms / (1000 * 60 * 60)).toFixed(1);
    let days = (ms / (1000 * 60 * 60 * 24)).toFixed(1);
    if (seconds < 60) return seconds + " Sec";
    else if (minutes < 60) return minutes + " Min";
    else if (hours < 24) return hours + " Hrs";
    else return days + " Days"
}

function print(data, key, map){
    if(!data.ended){
        console.log(`Username: ${data.username}`);
        console.log(`Start time: ${data.startDate}`);
        console.log(`Time passed: ${data.timeElapsed}`);
        console.log(`Coins: ${data.coins}😱`);
        console.log(`Donations: ${data.donations}`);
        console.log(`Coins per donation: ${data.cpd}`);
        console.log(`Last donation: ${data.lastDonation}`);
        console.log("______________________________________");
    }
    else{
        console.log(`Stream ended. Analysis summary:`);
        console.log(`-Username: ${data.username}`);
        console.log(`-Analysis starting time: ${data.startDate}`);
        console.log(`-Analysis duration: ${data.timeElapsed}`);
        console.log(`-Total amount of coins: ${data.coins}😱`);
        console.log(`-Coins per second: ${data.cps}😶`);
        console.log(`-Estimated hourly rate: ${data.cph}😳`);
        console.log(`-Total amount of donations: ${data.donations}`);
        console.log(`-Average amount of coind per donation: ${data.cpd}`);
        console.log(`-Last donation: ${data.lastDonation}`);
        console.log("______________________________________");
    }
}

function analyze(key) {
    let tiktokLiveConnection = new WebcastPushConnection(key);
    
    tiktokLiveConnection.connect().then(state => {
        console.info(`Connected to roomId ${state.roomId}`);
    }).catch(err => {
        console.error('Failed to connect', err);
        return;
    })

    let startTime = Date.now();
    let donations = 0;
    let startDate = new Date();
    let mostRecent = new Date();
  
    let coins = 0;


    tiktokLiveConnection.on('gift', data => {
        if(!userData.has(key)){
            tiktokLiveConnection.disconnect();
            return;
        }

        donations++;
        coins += data.diamondCount;
        mostRecent = new Date();
        
        userData.set(key,
            {
            username: key,
            startDate: startDate.toLocaleString(),
            timeElapsed: msToTime(Date.now()-startTime),
            coins: coins,
            donations: donations,
            cpd: coins/donations,
            lastDonation: mostRecent.toLocaleString(),
            ended: false});
        

        console.clear();
        userData.forEach(print);
    })

    tiktokLiveConnection.on('disconnected', () => {

        if(userData.has(key)){
            new Promise(resolve => setTimeout(resolve, 30000));
            tiktokLiveConnection.connect().then(state => {
                console.info(`Connected to roomId ${state.roomId}`);
                return;
            }).catch(err => {
                console.error('Failed to connect', err);
            })
        }

        let timeElapsed = Date.now()-startTime;
        let cs = coins/(timeElapsed/1000);

        let logString = 
        `Username: ${key}\n`+
        `Analysis starting time: ${startDate.toLocaleString()}\n`+
        `Analysis duration: ${msToTime(timeElapsed)}\n`+
        `Total amount of coins: ${coins}\n`+
        `Coins per second: ${cs}\n`+
        `Estimated hourly rate: ${3600*cs}\n`+
        `Total amount of donations: ${donations}\n`+
        `Average amount of coind per donation: ${coins/donations}\n`+
        `Last donation: ${mostRecent.toLocaleString()}\n`+
        "______________________________________\n";

        fs.appendFileSync(logFilePath, logString);

        if(userData.has(key)){
            userData.set(key,
                {username: key,
                startDate: startDate.toLocaleString(),
                timeElapsed: msToTime(timeElapsed),
                coins: coins,
                cps: cs,
                cph: (3600*cs),
                donations: donations,
                cpd: coins/donations,
                lastDonation: mostRecent.toLocaleString(),
                ended: true});
            console.clear();
            userData.forEach(print);
        }
    })
}