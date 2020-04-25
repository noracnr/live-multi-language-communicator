'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
// Imports the Google Cloud client library
const speech = require('@google-cloud/speech');

// Creates a client
var client = new speech.SpeechClient();

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  if (req.url.substring(1,6) === 'room=' && req.url.indexOf('&username=') !== 6) {
    fileServer.serveFile('/main.html', 200, {}, req, res);
  } else {
    fileServer.serve(req, res);
  }
}).listen(8080, () => {
  console.log('listening on *:8080');
});

var rooms = {};

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  var clientAddress = socket.handshake.address;
  console.log(new Date(), '- Client connected: {', socket.id, '} @', clientAddress);

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });

  socket.on('create or join', function(username,room) {
    if (!room || !username) {
      log('No room id or username', socket.id);
      socket.disconnect();
    } else {
      log('Received '+username+'\'s request to create or join room ' + room);


      if (rooms[room] === undefined) {
        log('Client ID' + socket.id + ' created room ' + room);
        rooms[room] = {};
        socket.join(room);
        socket.socketID = username+'@'+room;
        socket.emit('created', room, socket.id);
        rooms[room][username] = socket;
      } else if (Object.keys(rooms[room]).indexOf(username) !== -1) {
        console.log('-User ', username, ' already in room ', room);
        log('-User ', username, ' already in room ', room);
        socket.disconnect();
      } else if (Object.keys(rooms[room]).length >= 2) {
        log('Larger than numClients', socket.id);
        socket.emit('full', room);
        socket.disconnect();
      } else {
        log('Client ID ' + socket.id + ' joined room ' + room);
        io.sockets.in(room).emit('join', room);
        socket.join(room);
        socket.socketID = username+ '@' + room;
        socket.emit('joined', room, socket.id);
        rooms[room][username] = socket;
        io.sockets.in(room).emit('ready');
      }
    }
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

  socket.on('subtitles request', function(message, toUser, language) {
    var fromUser = socket.socketID.split('@')[0];
    var room = socket.socketID.split('@')[1];

    if (typeof (rooms[room][toUser]) !== 'undefined') {
      rooms[room][toUser].emit('subtitles request', message, fromUser, language);
  } else {
      console.log('- BAD PARAMS FROM SOCKET ID', socket.id, 'due to toUser socket in this room',room,' not exist');
      socket.disconnect();
  }
  });

});
