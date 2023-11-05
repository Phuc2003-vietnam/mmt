const net = require('net');
const EventEmitter = require('events');
// const splitStream = require('./split-stream');
const fs = require("fs");
const path=require("path")
const random4digithex = () => Math.random().toString(16).split('.')[1].substr(0, 4);
const randomuuid = () => new Array(8).fill(0).map(() => random4digithex()).join('-');

module.exports = (options) => {

  const connections = new Map();
  const emitter = new EventEmitter();

  const NODE_ID = randomuuid();
  console.log("My Node_ID: "+NODE_ID);
  const neighbors = new Map();

  //gắn socket với id cụ thể đồng thời tạo event cho process và event cho socket
  const handleNewSocket = (socket) => {
    const socketId = randomuuid();
    connections.set(socketId, socket);    //id cua socket
    emitter.emit('receive_connection', socketId);

    socket.on('close', () => {
      connections.delete(socketId);
      emitter.emit('_disconnect', socketId);
    });
    var reqBuffer = Buffer.from('');

    let receivedChunkCount = 0; // can xu li data duoi dang buffer, cat tung chunk ra
    socket.on('data', (data) => {
      // console.log("socket.on data : Before data.toString()");
      // console.log("The length of buffer data: " + data.length);
      // var a= (JSON.parse(data.toString()))
      // console.log("socket.on data : After data.toString()");
      // var b= a.data.message
      // if (b && b.fileName) {
      //   console.log('Payload:', b.data.data.length);
      // } 
      // console.log("Length of chunk: "+data.length);
      // const last3Bytes = data.slice(-3);
      data=data.toString()
      var newData=''
      newData += data
      console.log("=====================================");
      console.log("The new Data is: " + newData);
      console.log("The length is: " + newData.length);
      console.log("--------------------------------");
      newData= newData.split('\2qn')
      console.log("The newDATA length after split is: " + newData.length + ". They are: "+newData);
      try {
        // if(last3Bytes.toString()==="end")
        // {
        //   data=data.slice(0,-3)
        //   console.log("im in");
        //   // console.log(data);
        //   // console.log(data.toString());
        //   emitter.emit('receive_message', { socketId, message: JSON.parse(data.toString()) });
        //   reqBuffer = Buffer.from('');
        // }
        // else{
        //   emitter.emit('receive_message', { socketId, message: JSON.parse(data.toString()) });
        // }
        for(var i=0;i<newData.length;i++)
        {
        console.log("newData[i]: "+newData[i]);
          // console.log(newData[i].toString(),"---------------------------------------");
          if(newData[i].length>1)
          emitter.emit('receive_message', { socketId, message: JSON.parse(newData[i])});
        }
      console.log("end on data -------------------------------");
      newData=null;   
      } catch (e) {
        // console.error(`Cannot parse message from peer`, data.toString())
        console.log(e);
      }
    });
  };


  const server = net.createServer((socket) => {handleNewSocket(socket)});


  const send = (socketId, message) => {
    const socket = connections.get(socketId);

    if (!socket) {
      throw new Error(`Attempt to send data to connection that does not exist ${socketId}`);
    }
    console.log(message.data.message);
    console.log(`IM Sending ${JSON.stringify(message).length} Bytes`);
    // const objectSize = Buffer.from(JSON.stringify(message)).length;
    // console.log(`Object size: ${objectSize}`);
    // console.log(JSON.stringify(message.data.message?.data));
    var a= JSON.stringify(message.data.message?.data)?.toString().length
    console.log(`Size of data.message.data in string: ${a}`);
    console.log(`Size of data.message in buffer: ${message.data.message?.data?.length}`);

    // socket.write(JSON.stringify({totalSize: JSON.stringify(message).length}))
    socket.write(JSON.stringify(message));
    socket.write('\2qn')
    // socket.end();
    // socket.write("end");

    //ở đây phải stringtify vì socket.write chỉ cho phép tuyền đi string hoặc là instance của Buffer
    //khi mà stringtify thì thằng  <Buffer 41 42 43> sẽ đưọc tự động structure thành object : { type: 'Buffer', data: [65,66,67] } (ma~ hex)
  };

  const connect = (ip, port, cb) => {
    const socket = new net.Socket();

    socket.connect(port, ip, () => {
      handleNewSocket(socket);
      cb && cb();
    });
    // Return a disconnect function so you can
    // exclude the node from the list
    return (cb) => socket.destroy(cb);  // cais nayf lam cc j v
  };


  const listen = (port, cb) => {
    server.listen(port, '0.0.0.0', cb);

    return (cb) => server.close(cb);
  };


  const close = (cb) => {
    for (let [socketId, socket] of connections) {
      socket.destroy();
    }

    server.close(cb);
  };



  const findNodeId = (socketId) => {
    for (let [nodeId, $socketId] of neighbors) {
      if (socketId === $socketId) {
        return nodeId;
      }
    }
  };

  const wrapMessage = (nodeId, data) => {
    // console.log("wrapMessage----");
    if(data.type==='handshake')
    {
      console.log("handshake");
      socketId=nodeId;
      send(socketId, data);
    }
    else{
      const socketId = neighbors.get(nodeId);
      // TODO handle no connection id error
      if (data.type==='file')
      {
        console.log("hello");
        const fileName=data.message.fileName
        const address=path.join(process.cwd(), "repo", fileName);
        const fileStream = fs.createReadStream(address,{
          highWaterMark: 8000
        });
        // const fileData = fs.readFileSync(address)
        fileStream.on('data', (chunk) => {
          console.log("The length of chunk read from file: "+chunk.length);
          // console.log(chunk);
          data.message.data=chunk
          send(socketId, { id:2114445,type: 'message', data });
        });
      
        console.log("111");
        // data.message.data=fileData
      }
      // send(socketId, { type: 'message', data });
    }
  };
  const sendPacket = (packet) => {
    // console.log("sendPacket----");
    for (const $nodeId of neighbors.keys()) {
      wrapMessage($nodeId, packet);      // lấy connection id của mình dùng để kết nối với node của người ta
    }
  };

  const sendFile = (message, id = randomuuid(), origin = NODE_ID, ttl = 255) => {
    // console.log("sendFile----");
    sendPacket({ id, ttl, type: 'file', message, origin });
  };
  const chat = (message, id = randomuuid(), origin = NODE_ID, ttl = 255) => {
    sendPacket({ id, ttl, type: 'chat', message, origin });
  };

  const direct = (destination, message, id = randomuuid(), origin = NODE_ID, ttl = 255) => {
    sendPacket({ id, ttl, type: 'direct', message, destination, origin });
  };

  emitter.on('receive_connection', (socketId) => {
    wrapMessage(socketId, {type: 'handshake', data: { nodeId: NODE_ID } });   
  });

  emitter.on('receive_message', ({ socketId, message }) => {
    const { type, data } = message;
    // console.log(message,'-----------------');
    if (type === 'handshake') {
      const { nodeId } = data;
      console.log("In the handshake =============");

      neighbors.set(nodeId, socketId);
      // emitter.emit('connect', { nodeId });
    }

    if (type === 'message') {
      const nodeId = findNodeId(socketId);

      // TODO handle no nodeId error

      emitter.emit('message', { nodeId, data });
    }
  });

  emitter.on('_disconnect', (socketId) => {
    const nodeId = findNodeId(socketId);

    // TODO handle no nodeId

    neighbors.delete(nodeId);
    emitter.emit('disconnect', { nodeId });
  });

  emitter.on('receive_file',(packet)=>{
    console.log("start receive_file------");

    const address=path.join(process.cwd(),"downloads",packet.message.fileName)
    // console.log(packet,"---lovead--");
    // console.log(packet.message.data.data,"dât.dât");
    // console.log(JSON.stringify(packet));
    const content= Buffer.from(packet.message.data);
    
    // console.log(content);
    fs.appendFileSync(address, content);

    // let file = fs.createWriteStream(address, { flags: "a" });
    // file.write(content)
    // file.end();

    // file.write(content)
    // console.log(content);
    // fs.writeFileSync(address,content)
    console.log("End receive_file------");

  })
  emitter.on('message', ({ nodeId, data: packet }) => {
    if (packet.type === 'chat') {
      console.log(packet.message.name + ": " + packet.message.text);
    }

    if (packet.type === 'file') {
        emitter.emit('receive_file', { origin: packet.origin, message: packet.message });
    }
  });

  return {
    listen, connect, close,
    chat, direct,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    id: NODE_ID,
    neighbors: () => neighbors.keys(),
    sendFile,
  };
};
