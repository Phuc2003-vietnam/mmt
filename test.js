const net = require('net');
const server = net.createServer();
const port = Number(process.argv[2]);


server.on('connection',socket=>{
    console.log('client connected');
    socket.write("hello\n");
    socket.on('data',(data)=>console.log(data))
}) 
process.stdin.on('data',(data)=>{
    console.log(data.toString());
})
server.listen(4000,'0.0.0.0',()=>{
    console.log("server bound");
})