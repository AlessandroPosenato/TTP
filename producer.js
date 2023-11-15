var prompt = require('prompt-sync')({sigint: true});

var command;
var zmq = require('zeromq') , sock = zmq.socket('push');
const options =
"Actions list:"+
"\n+<username> to add user"+
"\n-<username> to remove user\n"

sock.bindSync('tcp://127.0.0.1:3000');
console.log('Producer bound to port 3000');

while(true){
    console.clear();
    console.log(options);
    command =  prompt();
    sock.send(command);
}