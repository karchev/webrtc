
// require module
var express = require('express');
var http = require('http');
var main = express();
var server = http.createServer(main);
var io  = require('socket.io').listen(server);
var compression = require('compression');
var bodyParser = require('body-parser')

// socket.io 설정
io.set('log level', 1);

// 리스너 추가
server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});

// express 설정
main.use(bodyParser.json());
main.use(bodyParser.urlencoded({ extended: true }));
main.get('/', function(req, res){ res.sendfile('client.html'); });
main.get('/index.html', function(req, res){ res.sendfile('client.html'); });
main.get('/client.html', function(req, res){ res.sendfile('client.html'); });


// 전역변수
var channels = {};
var sockets = {};

// 소켓 연결
io.sockets.on('connection', function (socket) {
    socket.channels = {};
    // 접속한 유저의 socket.id를 관리하기 위해 배열로 보관
    sockets[socket.id] = socket;
    // 디버그용
    console.log( socket.id + " connection accepted");
    // 소켓 연결 종료시
    socket.on('disconnect', function () {
        for (var channel in socket.channels) {
            part(channel);
        }
        // 디버그용
        console.log(socket.id + " disconnected");
        // 유저의 socket.id 말소
        delete sockets[socket.id];
    });

    // join 이벤트 드리븐
    socket.on('join', function (config) {
        // 디버그용
        console.log(socket.id + " join ", config);
        var channel = config.channel;
        var userdata = config.userdata;

        // 만약 유저에서 전달한 채널 정보가 이미 서버측에 존재하는 채널이라면
        if (channel in socket.channels) {
            console.log(socket.id + " ERROR: already joined ", channel);
            return;
        }
        // 만약 없는 채널이라면
        if (!(channel in channels)) {
            channels[channel] = {};
        }

        // 채널에 존재하는 모든 유저에게
        for (id in channels[channel]) {
            // peer_id로 socket.id 부여, jsep offer false로 설정
            channels[channel][id].emit('addPeer', {'peer_id': socket.id, 'should_create_offer': false});
            socket.emit('addPeer', {'peer_id': id, 'should_create_offer': true});
        }

        channels[channel][socket.id] = socket;
        socket.channels[channel] = channel;
    });

    // 채널 제거 함수
    function part(channel) {
        console.log(socket.id + " part");

        if (!(channel in socket.channels)) {
            console.log(socket.id + " ERROR: not in ", channel);
            return;
        }

        delete socket.channels[channel];
        delete channels[channel][socket.id];

        // 피어 제거
        for (id in channels[channel]) {
            channels[channel][id].emit('removePeer', {'peer_id': socket.id});
            socket.emit('removePeer', {'peer_id': id});
        }
    }
    socket.on('part', part);

    socket.on('relayICECandidate', function(config) {
        var peer_id = config.peer_id;
        var ice_candidate = config.ice_candidate;
        console.log(socket.id + " relaying ICE candidate to " + peer_id, ice_candidate);

        if (peer_id in sockets) {
            sockets[peer_id].emit('iceCandidate', {'peer_id': socket.id, 'ice_candidate': ice_candidate});
        }
    });

    socket.on('relaySessionDescription', function(config) {
        var peer_id = config.peer_id;
        var session_description = config.session_description;
        console.log(socket.id + " relaying session description to " + peer_id, session_description);

        if (peer_id in sockets) {
            sockets[peer_id].emit('sessionDescription', {'peer_id': socket.id, 'session_description': session_description});
        }
    });
    
    socket.on('transcriptBroadCast', function(e){
        console.log(JSON.stringify(e));
    })
});