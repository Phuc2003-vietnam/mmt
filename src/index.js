const net = require('net');
const EventEmitter = require('events');
const splitStream = require('./split-stream');
const fs = require("fs");
const path=require("path")
const random4digithex = () => Math.random().toString(16).split('.')[1].substr(0, 4);
const randomuuid = () => new Array(8).fill(0).map(() => random4digithex()).join('-');

module.exports = (options) => {

  const connections = new Map();
  const emitter = new EventEmitter();

  //gắn socket với id cụ thể
  const handleNewSocket = (socket) => {
    const connectionId = randomuuid();
    connections.set(connectionId, socket);    //id cua socket
    emitter.emit('receive_connection', connectionId);

    socket.on('close', () => {
      connections.delete(connectionId);
      emitter.emit('_disconnect', connectionId);
    });
    var reqBuffer = Buffer.from('');

    // socket.pipe(splitStream()).on('data', (message) => {
    //   // console.log("hello");// gọi mỗi khi truyền message
    //   console.log(message);
    //   emitter.emit('_message', { connectionId, message });
    // });
    socket.on('data', (data) => {
      console.log("lmao");
      console.log("Length of chunk: "+data.length);
      console.log("String of chunk: "+data.toString());
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
    });
  };


  const server = net.createServer((socket) => {handleNewSocket(socket)});

  // A method to "raw" send data by the connection ID
  // intended to internal use only
  const _send = (connectionId, message) => {
    const socket = connections.get(connectionId);

    if (!socket) {
      throw new Error(`Attempt to send data to connection that does not exist ${connectionId}`);
    }
    socket.write(JSON.stringify(message));
    socket.write("end");

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
    for (let [connectionId, socket] of connections) {
      socket.destroy();
    }

    server.close(cb);
  };


  const NODE_ID = randomuuid();
  console.log(NODE_ID);
  const neighbors = new Map();


  const findNodeId = (connectionId) => {
    for (let [nodeId, $connectionId] of neighbors) {
      if (connectionId === $connectionId) {
        return nodeId;
      }
    }
  };


  emitter.on('receive_connection', (connectionId) => {
    _send(connectionId, { type: 'handshake', data: { nodeId: NODE_ID } });
  });

  emitter.on('receive_message', ({ connectionId, message }) => {
    const { type, data } = message;
    console.log(message,'-----------------');
    if (type === 'handshake') {
      const { nodeId } = data;

      neighbors.set(nodeId, connectionId);
      // emitter.emit('connect', { nodeId });
    }

    if (type === 'message') {
      const nodeId = findNodeId(connectionId);

      // TODO handle no nodeId error

      emitter.emit('message', { nodeId, data });
    }
  });

  emitter.on('_disconnect', (connectionId) => {
    const nodeId = findNodeId(connectionId);

    // TODO handle no nodeId

    neighbors.delete(nodeId);
    emitter.emit('disconnect', { nodeId });
  });


  const send = (nodeId, data) => {
    const connectionId = neighbors.get(nodeId);
    // TODO handle no connection id error
    if (data.type==='file')
    {
     console.log("we2");
      const fileName=data.message.fileName
      const address=path.join(process.cwd(), "repo", fileName);
      const fileData = fs.readFileSync(address)
      data.message.data=fileData
      console.log(data);
      console.log(JSON.stringify(data));

    }
    _send(connectionId, { type: 'message', data });
  };



  const sendPacket = (packet) => {
    for (const $nodeId of neighbors.keys()) {
      send($nodeId, packet);      // lấy connection id của mình dùng để kết nối với node của người ta
    }
  };

  const sendFile = (message, id = randomuuid(), origin = NODE_ID, ttl = 255) => {
    console.log("sendfile---------");
    sendPacket({ id, ttl, type: 'file', message, origin });
  };
  const broadcast = (message, id = randomuuid(), origin = NODE_ID, ttl = 255) => {
    sendPacket({ id, ttl, type: 'broadcast', message, origin });
  };

  const direct = (destination, message, id = randomuuid(), origin = NODE_ID, ttl = 255) => {
    sendPacket({ id, ttl, type: 'direct', message, destination, origin });
  };

  emitter.on('direct',(packet)=>{
    const address=path.join(process.cwd(),"downloads",packet.message.fileName)
    // console.log(address);
    console.log("DIRECT--------");
    console.log(packet);
    console.log(packet.message.data.data);
    const content= Buffer.from(packet.message.data);
    console.log(content);
    fs.writeFileSync(address,content)
  })
  emitter.on('message', ({ nodeId, data: packet }) => {
    if (packet.type === 'broadcast') {
      // emitter.emit('broadcast', { message: packet.message, origin: packet.origin });
      // broadcast(packet.message, packet.id, packet.origin, packet.ttl - 1);
      // console.log(packet.message);
      console.log(packet.message.name + ": " + packet.message.text);
    }

    if (packet.type === 'file') {
      console.log("i am here");
        emitter.emit('direct', { origin: packet.origin, message: packet.message });
    }
  });

  return {
    listen, connect, close,
    broadcast, direct,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    id: NODE_ID,
    neighbors: () => neighbors.keys(),
    sendFile,
  };
};
