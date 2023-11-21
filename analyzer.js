const zmq = require('zeromq'), sock = zmq.socket('pull'); //Library for IPC to listen to messages from the producer.js script
const { WebcastPushConnection } = require('tiktok-live-connector'); //Library for scraping TikTok Live data
const fs = require('fs'); //Library for writing to file
const {Client, Query} = require('pg'); //Library for connecting to postgresql DB

var userData = new Map(); //Map that contains users TikTok lives data that we want to track. The users userId is used as the key
var printData = [];
const client = new Client({ //DB setup parameters
    host: "localhost",
    user: "postgres",
    port: 5432,
    database: "ttp"
})

sock.connect('tcp://127.0.0.1:3000'); //Socket for IPC comunication
client.connect(); //Connection to DB

sock.on('message', function(msg){ //IPC message handling
    let command = msg.toString();
    switch(command[0]){
        case '+':
            command = command.slice(1);
            let tiktokLiveConnection = new WebcastPushConnection(command);
            userData.set(command,
                {
                tiktokLiveConnection: tiktokLiveConnection,
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
            let tmp = userData.get(command);
            userData.delete(command);
            if(tmp.connection != undefined)
                tmp.connection.disconnect();
            printData.pop();
            console.clear();
            print();
            break;
    }
});

client.on('error', (err) => {
    console.error('DB error: ', err.stack)
})

process.on('SIGINT', () => {
    client.end();
    sock.close();
    process.exit();
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

function print(){ //Function that prints the data contained in the userData map
    let tmp;
    for (let [key, value] of userData) {
        printData.pop();
    }
    
    for (let [key, value] of userData) {
        if(!value.ended){
            tmp = {
                username: value.username,
                startDate: value.startDate,
                timeElapsed: value.timeElapsed,
                coins: value.coins,
                donations: value.donations,
                cpd: value.cpd,
                lastDonation: value.lastDonation,
                ended: value.ended};
        }
        else{
            tmp = {
                username: value.username,
                startDate: value.startDate,
                timeElapsed: value.timeElapsed,
                coins: value.coins,
                cps: value.cps,
                cph: value.cph,
                donations: value.donations,
                cpd: value.cpd,
                lastDonation: value.lastDonation,
                ended: value.ended};
        }
        printData.push(tmp);
    }

    console.table(printData);

    /*
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
        console.log(`-Average amount of coins per donation: ${data.cpd}`);
        console.log(`-Last donation: ${data.lastDonation}`);
        console.log("______________________________________");
    }
    */
}

function queryDB(query){
    client.query(query, (err, res)=>{
        if(err){
            console.error(err.message);
        }
    });
}

function analyze(key) { //Function for scraping TikTok Live data
    let tmp = userData.get(key);
    let tiktokLiveConnection = tmp.tiktokLiveConnection;
    
    tiktokLiveConnection.connect().then(state => { //Trying to connect to the live
        console.info(`Connected to roomId ${state.roomId}`);
    }).catch(err => {
        console.error('Failed to connect', err);
        return;
    })

    //Initialization of variables to track the data we are interested in
    let startTime = Date.now(); //Start of the analysis in milliseconds used to calculate the analysis duration in milliseconds
    let donations = 0; //Number of donations
    let startDate = new Date(); //Start of the analysis in Date object used for displaying purposes
    let mostRecent = new Date(); //Variable to track the most recent donation
    let coins = 0; //Number of coins


    tiktokLiveConnection.on('gift', data => { //Event triggered when the broadcaster receives a gift
        donations++;
        coins += data.diamondCount;
        mostRecent = new Date(); //Update the most recent donation
        
        userData.set(key, //We set the user's updated data in the map
            {
            connection: tiktokLiveConnection,
            username: key,
            startDate: startDate.toLocaleString("ja-JP"),
            timeElapsed: msToTime(Date.now()-startTime),
            coins: coins,
            donations: donations,
            cpd: coins/donations,
            lastDonation: mostRecent.toLocaleString("ja-JP"),
            ended: false});
        
        //After updating the data we print it to console
        console.clear();
        print();
    })
    //Event triggered when the livestream ends. Gets triggered both by the the user ending it and by loss of connection
    //Also triggered if the live gets banned by a moderator
    tiktokLiveConnection.on('disconnected', () => {
        let timeElapsed = Date.now()-startTime;
        let cs = coins/(timeElapsed/1000);
        let queryString =
        `INSERT INTO sessions (start, duration, coins, donations, uid, sid)`+
        ` VALUES ($1::text, $2::integer, $3::integer, $4::integer, $5::text, DEFAULT);`;

        let query = new Query(queryString, [startDate.toLocaleString("ja-JP"), timeElapsed, coins, donations, key]);
        //If a users disconnects and its username is still in the map we try to reconnect after 30 seconds
        //We do this because the disconnection might be caused by loss of connection and not by the user ending the stream
        //If the user is not present in the map that means that we removed it because we are no longer interested in analyzing the live
        if(userData.has(key)){
            new Promise(resolve => setTimeout(resolve, 30000));
            tiktokLiveConnection.connect().then(state => {
                console.info(`Connected to roomId ${state.roomId}`);
                return;
            }).catch(err => {
                queryDB(query);
                console.error('Failed to connect', err);
            })
            new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        //If the user is in the map we update the map with the latest data we gathered
        if(userData.has(key)){
            userData.set(key,
                {connection: tiktokLiveConnection,
                username: key,
                startDate: startDate.toLocaleString("ja-JP"),
                timeElapsed: msToTime(timeElapsed),
                coins: coins,
                cps: cs,
                cph: (3600*cs),
                donations: donations,
                cpd: coins/donations,
                lastDonation: mostRecent.toLocaleString("ja-JP"),
                ended: true});
            //We print the latest data
            console.clear();
            print();
        }

        if(!userData.has(key)){
            queryDB(query);
        }
    })
}