const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

const childProcess = require('child_process');
const { WebcastPushConnection } = require('tiktok-live-connector');
const fs = require('fs'); 
var userData = new Map();

const options =
"Actions list:"
+"\nPress 'a' to add a user"
+"\nPress 'r' to remove a user"
+"\nPress 'q' to quit\n";

var userIds = [];
userIds[0] = 'jkbnjs2001';
userIds[1] = 'its_me_playgod';
userIds[2] = 'diasgta5kz';

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

function analyze(item, index, arr) {
    let tiktokLiveConnection = new WebcastPushConnection(item);
    
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
        donations++;
        coins += data.diamondCount;
        mostRecent = new Date();

        userData.set(item,
            {
            username: item,
            startDate: startDate.toLocaleString(),
            timeElapsed: msToTime(Date.now()-startTime),
            coins: coins,
            donations: donations,
            cpd: coins/donations,
            lastDonation: mostRecent.toLocaleString(),
            ended: false});

        console.clear();
        console.log(options);
        userData.forEach(print);
    })

    tiktokLiveConnection.on('disconnected', () => {
        let connected = false;

        for(let i = 0; i < 40 && !connected; i++){ //Tries reconnecting every 15sec for 15min
            new Promise(resolve => setTimeout(resolve, 15000));
            tiktokLiveConnection.connect().then(state => {
                console.info(`Connected to roomId ${state.roomId}`);
                connected = true;
            }).catch(err => {
                console.error('Failed to connect', err);
            })
        }

        if(!connected){
            let timeElapsed = Date.now()-startTime;
            let cs = coins/(timeElapsed/1000);

            let logString = 
            `Username: ${item}\n`+
            `Analysis starting time: ${startDate.toLocaleString()}\n`+
            `Analysis duration: ${msToTime(timeElapsed)}\n`+
            `Total amount of coins: ${coins}\n`+
            `Coins per second: ${cs}\n`+
            `Estimated hourly rate: ${3600*cs}\n`+
            `Total amount of donations: ${donations}\n`+
            `Average amount of coind per donation: ${coins/donations}\n`+
            `Last donation: ${mostRecent.toLocaleString()}\n`+
            "______________________________________\n";

            fs.appendFileSync('/home/mod/Desktop/ttp/summaries.txt', logString);

            userData.set(item,
                {username: item,
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
            console.log(options);
            userData.forEach(print);
        }
    })
}

userIds.forEach(analyze)