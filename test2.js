const EventEmitter = require("events");
const emitter = new EventEmitter();
var change = 1;
emitter.on("hello", () => console.log(change));
change = 2;
emitter.emit("hello");
console.log("ưhat");
