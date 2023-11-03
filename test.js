// const net = require('net');
// const server = net.createServer();
// const port = Number(process.argv[2]);

// server.on('connection',socket=>{
//     console.log('client connected');
//     socket.write("hello\n");
//     socket.on('data',(data)=>console.log(data))
// })
// process.stdin.on('data',(data)=>{
//     console.log(data.toString());
// })
// server.listen(4000,'0.0.0.0',()=>{
//     console.log("server bound");
// })
var reqBuffer = Buffer.from('');
function foo(data)  {
    console.log("lmao");
    console.log(data.length);
    console.log(data.toString());
    reqBuffer=Buffer.concat([reqBuffer, data]);
    const last3Bytes = reqBuffer.slice(-3);
    console.log(last3Bytes.toString(),"----c[l");
    try {
      if(last3Bytes.toString()==="end")
      {
        reqBuffer=reqBuffer.slice(0,-3)
        console.log("im in");
        emitter.emit('receive_message', { connectionId, message: JSON.parse(reqBuffer.toString()) });
        reqBuffer = Buffer.from('');
      }
    } catch (e) {
      // console.error(`Cannot parse message from peer`, data.toString())
    }
  }
  var obj={
    type: "handshake",
    data: {
        nodeId : "9cc0-63d3-dca8-d843-efc4-a1c6-40d2-94d9"
    }
  }
  foo(Buffer.from(JSON.stringify(obj)))