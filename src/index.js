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
    emitter.emit('_connect', connectionId);

    socket.on('close', () => {
      connections.delete(connectionId);
      emitter.emit('_disconnect', connectionId);
    });

    // socket.pipe(splitStream()).on('data', (message) => {
    //   // console.log("hello");// gọi mỗi khi truyền message
    //   console.log(message);
    //   emitter.emit('_message', { connectionId, message });
    // });
    socket.on('data', (data) => {
      try {
        console.log("lmao");
        console.log(data.toString());
        emitter.emit('_message', { connectionId, message: JSON.parse(data.toString()) });
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
  };

  const connect = (ip, port, cb) => {
    console.log(ip,port);
    const socket = new net.Socket();

    socket.connect(port, ip, () => {
      handleNewSocket(socket);
      console.log("socket connect----");
      // console.log(cb);
      cb && cb();
    });
    console.log("what");
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

  //
  // Layer 2 - create Nodes, assign IDs, handshake
  // and keep neighbors in a collection
  //
  const NODE_ID = randomuuid();
  console.log(NODE_ID);
  const neighbors = new Map();

  // A helper to find node id by connection id
  const findNodeId = (connectionId) => {
    for (let [nodeId, $connectionId] of neighbors) {
      if (connectionId === $connectionId) {
        return nodeId;
      }
    }
  };

  // Once connection is established, send the handshake message
  emitter.on('_connect', (connectionId) => {
    _send(connectionId, { type: 'handshake', data: { nodeId: NODE_ID } });
  });

  // On message we check whether it's a handshake and add
  // the node to the neighbors list
  emitter.on('_message', ({ connectionId, message }) => {
    const { type, data } = message;
    console.log(type);
    if (type === 'handshake') {
      const { nodeId } = data;

      neighbors.set(nodeId, connectionId);
      emitter.emit('connect', { nodeId });
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
    console.log("send---------");
    const connectionId = neighbors.get(nodeId);
    console.log("he2");
    // TODO handle no connection id error
    if (data.type==='file')
    {
     console.log("we2");
      const fileName=data.message.fileName
      const address=path.join(process.cwd(), "repo", fileName);
      const fileData = fs.readFileSync(address)
      console.log(address);
      console.log(fileData);
      data.message.data=fileData
    }
    _send(connectionId, { type: 'message', data });
  };


  const alreadySeenMessages = new Set();

  const sendPacket = (packet) => {
    console.log("sendPacket---------");
    console.log(neighbors.keys());
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
    console.log(address);
    console.log(packet);
    const content= Buffer.from(packet.message.data);
    console.log(content);
    fs.writeFileSync(address,content)
  })
  emitter.on('message', ({ nodeId, data: packet }) => {
    
    console.log(packet);
    // if (alreadySeenMessages.has(packet.id) || packet.ttl < 1) {
    //   return;
    // } else {
    //   alreadySeenMessages.add(packet.id);
    // }

    if (packet.type === 'broadcast') {
      emitter.emit('broadcast', { message: packet.message, origin: packet.origin });
      broadcast(packet.message, packet.id, packet.origin, packet.ttl - 1);
    }

    if (packet.type === 'direct') {
      if (packet.destination === NODE_ID) {
        emitter.emit('direct', { origin: packet.origin, message: packet.message });
      } else {
        direct(packet.destination, packet.message, packet.id, packet.origin, packet.ttl - 1);
      }
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
