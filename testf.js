const net = require('net');
const socket = new net.Socket();


socket.connect(port=4000, ip='10.0.29.88', () => {
  socket.write("trello dued")
  console.log("socket connect----");
  socket.on('data',(data)=>console.log(data))

});

{
  'userId'
  
}