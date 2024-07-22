const socket = io('');

let username, connectedUser;
let emailABC, photoABC;

let conversations = {};
let usersstat = [];
let peersMap;

let Send_dataChannel, Receive_dataChannel, peerConnection;
let flag_send_datachannel;

let incoming_popup_set = false;
let outgoing_popup_set = false;

let conn_offer, conn_answer;

let inLatest = [];

const homeButton = document.getElementById('homeButton');
const profileButton = document.getElementById('profileButton');
const settingsButton = document.getElementById('settingsButton');
const closeButton = document.getElementById('closeButton');
const fileInput = document.createElement('input');
fileInput.type = 'file';

homeButton.classList.add('active-button');

homeButton.addEventListener('click', () => handleButtonClick(homeButton));
profileButton.addEventListener('click', () => handleButtonClick(profileButton));
settingsButton.addEventListener('click', () => handleButtonClick(settingsButton));
closeButton.addEventListener('click', () => handleButtonClick(closeButton));

// const form = document.getElementById('signup');

// form.addEventListener('submit', (event) => {
//     event.preventDefault();
//     username = form.elements['Username'].value;
//     socket.emit('login_request', username);
// });


const chatInput = document.getElementById('chat-input');

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});

socket.on('login_0', (data) => {
    username = data.username;
    emailABC = data.email;
    photoABC = data.photo;
    socket.emit('login_request', username);
});

socket.on('connect_error', () => {
    alert("Failed to connect to server, please try again later !!");
});

socket.on('connect', () => {
    console.log("connected to http://localhost:1234/");
});

socket.on('isSignedIn', (success_flag) => {
    handleSignIn(success_flag);
});

socket.on('peersList', (data) => {
    handlepeersList(data);
});

socket.on('offer_data', (data) => {
    handleOffer(data.offer, data.name);
});

socket.on('answer_data', (answer) => {
    handleAnswer(answer);
});

socket.on('ice_candidate', (candidate) => {
    handleCandidate(candidate);
});

socket.on('isReady', (data) => {
    usersstat = [data.peer1, data.peer2];
    is_peer_ready(data.success, data.peer1);
});

socket.on('isAlreadyinRoom', (data) => {
    check_user_status(data.success, data.name);
});

socket.on('user_is_leaving', () => {
    usersstat = [];
    closeRoom();
});

socket.on('isNotReady', () => {
    user_is_not_ready();
});

socket.on('other_user_disc', () => {
    otherUserDisc();
});

socket.on('peerSocketErr', () => {
    console.log("peerSocketErr");
});

fileInput.addEventListener('change', handleFileSelect);

document.querySelector('.bi-folder-plus').addEventListener('click', () => {
    fileInput.click();
});

function handleButtonClick(button) {
    [homeButton, profileButton, settingsButton, closeButton].forEach(btn => {
        btn.classList.remove('active-button');
    });

    button.classList.add('active-button');

    if (button === homeButton) {
        console.log("homeButton");
    } else if (button === profileButton) {
        const profileModal = document.getElementById('profileModal');
        const profileUsername = document.getElementById('profileUsername');
        const profileId = document.getElementById('profileId');
        const closeProfileModal = document.getElementById('closeProfileModal');
        const profilePicture = document.getElementById('profilePicture');
        profilePicture.src = `data:image/jpeg;base64,${photoABC}`;

        profileUsername.textContent = `Username: ${username}`;
        profileId.textContent = `Email: ${emailABC}`;
        profileModal.style.display = 'block';

        closeProfileModal.addEventListener('click', () => {
            profileModal.style.display = 'none';
            profileButton.classList.remove('active-button');
            homeButton.classList.add('active-button');
        });
    } else if (button === settingsButton) {
        document.body.classList.toggle('light-mode');
        button.classList.remove('active-button');
        homeButton.classList.add('active-button');
    } else if (button === closeButton) {
        const confirmExit = confirm("Are you sure you want to exit?");
        if (confirmExit) {
            window.location.href = '/index.html';
        } else {
            button.classList.remove('active-button');
            homeButton.classList.add('active-button');
        }
    }
}

function handleSignIn(success_flag) {
    if (success_flag === false) {
        alert("Username " + username + " is already taken .. choose different one"); }}
//     } else {
//         document.getElementById('usernameModal').setAttribute('style', 'display:none');
//     }
// }

function handlepeersList(peersList) {
    console.log("peersList ",peersList)
    peersMap = new Map(peersList);
    console.log("peerMaop ",peersMap)
    const usersContainer = document.getElementById('usersContainer');
    usersContainer.innerHTML = "";

    if (peersMap.size > 1) {
        let id = 0;

        for (let [key, values] of peersMap) {
            console.log(" key , value  : ",key,values)
            if (username !== key) {
                const peerID = 'peer__' + id;

                const div = document.createElement('div');
                div.className = 'circle';

                const img = document.createElement('img');
                img.classList.add('labelG');
                img.src = `data:image/jpeg;base64,${values[2]}`;
                // img.src = 'user2.jpeg';
                img.alt = 'Circle Image';
                img.id = peerID;

                img.addEventListener('click', () => {
                    requestChat(key);
                });

                const p = document.createElement('p');
                p.textContent = key;

                div.appendChild(img);
                div.appendChild(p);
                usersContainer.appendChild(div);

                Update_user_status(peerID, values[0]);
                id++;
            }
        }
    } else {
        if (peersMap.key === username) {
            document.getElementById('usersContainer').innerHTML = "";
            console.log("single user = ", peersMap.key);
        }
    }
}

function Update_user_status(peerID, value) {
    switch (value) {
        case "online":
            document.getElementById(peerID).classList.replace('labelR', 'labelG');
            break;
        case "busy":
            document.getElementById(peerID).classList.replace('labelG', 'labelR');
            break;
        default:
            document.getElementById(peerID).classList.add('labelG');
            break;
    }
}

function requestChat(name) {
    if (usersstat.length == 2) {
        alert("If you want another room, please leave this room first !!");
    } else {
        const otherUsername = name;
        connectedUser = otherUsername;

        if (otherUsername.length > 0) {
            socket.emit("request_to_talk", otherUsername);
        }
    }
}

function check_user_status(notready, name) {
    if (notready === false) {
        show_loading();
        create_webrtc_initial_connection();
        Create_DataChannel(name);
        creating_offer();
    } else {
        alert("Peer user is in another room.. please try later !!");
    }
}

function show_loading() {
    document.getElementById('loadingDiv').style.display = 'block';
    outgoing_popup_set = true;
}

function hide_loading() {
    document.getElementById('loadingDiv').style.display = 'none';
    outgoing_popup_set = false;
}

function create_webrtc_initial_connection() {
    const configuration = {
        "iceServers": [
            {
                "urls": "stun:stun.1.google.com:19302"
            },
            {
                urls: 'turn:192.158.29.39:3478?transport=tcp',
                credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                username: '28224511:1379330808'
            }
        ]
    };
    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.onicecandidate = icecandidateAdded;
}

function icecandidateAdded(event) {
    if (event.candidate) {
        console.log("ICE candidate = " + event.candidate);
        socket.emit("candidate", { name: connectedUser, candidate: event.candidate });
    }
}

function Create_DataChannel(name) {
    const dataChannelOptions = {
        ordered: false,
        maxPacketLifeTime: 3000
    };

    const channelname = "webrtc_label_" + name;
    Send_dataChannel = peerConnection.createDataChannel(channelname, dataChannelOptions);
    console.log("Created DataChannel dataChannel = " + Send_dataChannel);

    Send_dataChannel.onerror = onSend_ChannelErrorState;
    Send_dataChannel.onmessage = onSend_ChannelMessageCallback;
    Send_dataChannel.onopen = onSend_ChannelOpenState;
    Send_dataChannel.onclose = onSend_ChannelCloseStateChange;
}

const onSend_ChannelOpenState = function(event) {
    flag_send_datachannel = true;
    console.log("dataChannel.OnOpen", event);
};

const onSend_ChannelMessageCallback = function(event) {
    console.log("dataChannel.OnMessage:", event);
    if (typeof event.data === 'string') {
        if (!conversations[connectedUser]) {
            conversations[connectedUser] = [];
        }
        const currentTime = new Date().toLocaleTimeString();
        conversations[connectedUser].push({ message: event.data, type: 'received', time: currentTime });
        const recvc = document.getElementById("recvC");
        const actual_flag = connectedUser === recvc.className;
        updateLatest(connectedUser, actual_flag);
    } else {
        receiveFile(event);
    }
};

const onSend_ChannelErrorState = function(error) {
    console.log("dataChannel.OnError:", error);
};

const onSend_ChannelCloseStateChange = function(event) {
    console.log("dataChannel.OnClose", event);
};

async function creating_offer() {
    try {
        const offer = await peerConnection.createOffer({ iceRestart: true });
        await peerConnection.setLocalDescription(offer);

        console.log("Created offer = " + peerConnection.localDescription);
        socket.emit("offer", { name: connectedUser, offer: offer });
    } catch (e) {
        hide_loading();
        alert("Failed to create offer:" + e);
    }
}

function handleOffer(offer, name) {
    console.log("Received offer : " + offer);
    connectedUser = name;
    conn_offer = offer;

    show_chat_request(name);
}

function show_chat_request(name) {
    document.getElementById('request_src').textContent = name + " is requesting for a chat";
    document.getElementById('callRequestDiv').style.display = 'block';
    incoming_popup_set = true;
}

function accept_answer() {
    create_webrtc_initial_connection();
    peerConnection.ondatachannel = receiveChannelCallback;
    peerConnection.setRemoteDescription(new RTCSessionDescription(conn_offer));
    create_answer();
}

function create_answer() {
    peerConnection.createAnswer()
        .then(function(answer) {
            peerConnection.setLocalDescription(answer);
            conn_answer = answer;
            console.log("Created answer = " + peerConnection.localDescription);
            socket.emit("answer", { name: connectedUser, answer: conn_answer });
        })
        .catch(function(err) {
            console.log(err.name + ': ' + err.message);
            alert("answer is failed");
            hideCallRequest();
        });
}

const receiveChannelCallback = function(event) {
    Receive_dataChannel = event.channel;
    Receive_dataChannel.onopen = onReceive_ChannelOpenState;
    Receive_dataChannel.onmessage = onReceive_ChannelMessageCallback;
    Receive_dataChannel.onerror = onReceive_ChannelErrorState;
    Receive_dataChannel.onclose = onReceive_ChannelCloseStateChange;
}

const onReceive_ChannelOpenState = function(event) {
    flag_send_datachannel = false;
    console.log("dataChannel.OnOpen", event);
};

const onReceive_ChannelMessageCallback = function(event) {
    console.log("dataChannel.OnMessage:", event);
    if (typeof event.data === 'string') {
        if (!conversations[connectedUser]) {
            conversations[connectedUser] = [];
        }
        const currentTime = new Date().toLocaleTimeString();
        conversations[connectedUser].push({ message: event.data, type: 'received', time: currentTime });
        const recvc = document.getElementById("recvC");
        const actual_flag = connectedUser === recvc.className;
        updateLatest(connectedUser, actual_flag);
    } else {
        receiveFile(event);
    }
};

const onReceive_ChannelErrorState = function(error) {
    console.log("dataChannel.OnError:", error);
};

const onReceive_ChannelCloseStateChange = function(event) {
    console.log("dataChannel.OnClose", event);
};

function handleAnswer(answer) {
    console.log("Received answer : " + answer);
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    socket.emit("ready", connectedUser);
}

function handleCandidate(candidate) {
    console.log("Received candidate : " + candidate);
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

function is_peer_ready(val, peername) {
    if (val === true) {
        hideCallRequest();
        hide_loading();

        show_chat_window(peername);

        incoming_popup_set = false;
        outgoing_popup_set = false;
    }
}

function reject_answer() {
    socket.emit("notReady", connectedUser);
    hideCallRequest();
}

function hideCallRequest() {
    document.getElementById('callRequestDiv').style.display = 'none';
    incoming_popup_set = false;
}

function show_chat_window(peername) {
    const chatdiv = document.getElementById("chat");
    const recvc = document.getElementById("recvC");
    recvc.innerHTML = '';

    recvc.className = peername;

    const img2 = document.createElement('img');
    for (let [key, values] of peersMap) {
        if (peername === key) {
            img2.src = `data:image/jpeg;base64,${values[2]}`;
        }
    }
    img2.alt = 'User Image';

    const h3 = document.createElement('h3');

    h3.textContent = peername;

    recvc.appendChild(img2);
    recvc.appendChild(h3);

    UpdateChatMessages(peername);

    chatdiv.style.display = "flex";
}

function UpdateChatMessages(user) {
    const chatBox = document.getElementById('convC');
    chatBox.innerHTML = '';
    if (conversations[user]) {
        conversations[user].forEach(({ message, type, time }) => {
            const div = document.createElement('div');
            div.className = 'msgcont';

            const messageElement = document.createElement('div');
            messageElement.className = 'smsgcont';
            messageElement.classList.add(type === 'sent' ? 'send' : 'received');

            const p = document.createElement('p');
            p.textContent = message;

            messageElement.appendChild(p);
            div.appendChild(messageElement);

            const timeElement = document.createElement('span');
            timeElement.className = 'time';
            timeElement.classList.add(type === 'sent' ? 'timeS' : 'timeR');
            timeElement.textContent = time;
            div.appendChild(timeElement);

            chatBox.appendChild(div);
        });
    }

    if (usersstat.length == 2) {
        if (user == usersstat[0] || user == usersstat[1]) {
            document.querySelector('.typeC').style.display = "flex";
            document.querySelector('.leave').style.display = "flex";
        } else {
            document.querySelector('.typeC').style.display = "none";
            document.querySelector('.leave').style.display = "none";
        }
    } else {
        document.querySelector('.typeC').style.display = "none";
        document.querySelector('.leave').style.display = "none";
    }
    chatBox.scrollTop = chatBox.scrollHeight;
}

function updateLatest(username, actual_flag) {
    if (!(inLatest.includes(username)) && conversations[username]) {
        const latestChat = document.getElementById('latestChat');
        const chatItem = document.createElement('div');
        chatItem.className = 'chatItem';
        chatItem.id = username;

        const img = document.createElement('img');
        for (let [key, values] of peersMap) {
            if (username === key) {
                img.src = `data:image/jpeg;base64,${values[2]}`;
            }
        }
        img.alt = 'User Image';

        const h3 = document.createElement('h2');
        h3.textContent = username;

        chatItem.appendChild(img);
        chatItem.appendChild(h3);

        chatItem.addEventListener('click', () => {
            for (let i = 0; i < inLatest.length; i++) {
                if (chatItem.id === inLatest[i]) {
                    document.getElementById(inLatest[i]).classList.replace('chatItem', 'chatItemselected');
                } else {
                    document.getElementById(inLatest[i]).classList.replace('chatItemselected', 'chatItem');
                }
            }

            const chatdiv = document.getElementById("chat");
            const recvc = document.getElementById("recvC");
            chatdiv.style.display = "flex";
            recvc.innerHTML = '';

            recvc.className = username;

            const img2 = document.createElement('img');
            for (let [key, values] of peersMap) {
                if (username === key) {
                    img2.src = `data:image/jpeg;base64,${values[2]}`;
                }
            }
            img2.alt = 'User Image';

            const h3 = document.createElement('h3');
            h3.textContent = username;

            recvc.appendChild(img2);
            recvc.appendChild(h3);

            UpdateChatMessages(username);
        });

        latestChat.appendChild(chatItem);

        inLatest.push(username);
    }
    if (actual_flag) {
        UpdateChatMessages(username);
        document.getElementById(username).classList.replace('chatItem', 'chatItemselected');
    }
}

function sendMessage() {
    const message = chatInput.value;

    if (message !== '') {
        if (!conversations[connectedUser]) {
            conversations[connectedUser] = [];
        }
        const currentTime = new Date().toLocaleTimeString();
        conversations[connectedUser].push({ message: message, type: 'sent', time: currentTime });

        if (flag_send_datachannel === true) {
            Send_dataChannel.send(message);
            updateLatest(connectedUser, true);
            chatInput.value = '';
            chatInput.focus();
        } else if (flag_send_datachannel === false) {
            Receive_dataChannel.send(message);
            updateLatest(connectedUser, true);
            chatInput.value = '';
            chatInput.focus();
        } else {
            alert("Error: WebRTC Data channel is not open.. Please leave room and try again");
        }
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        sendFile(file);
    }
}

function sendFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const arrayBuffer = event.target.result;
        if (flag_send_datachannel === true) {
            Send_dataChannel.send(arrayBuffer);
        } else if (flag_send_datachannel === false) {
            Receive_dataChannel.send(arrayBuffer);
        }

        // Ajouter l'aperçu du fichier envoyé à la zone de discussion
        const url = URL.createObjectURL(new Blob([arrayBuffer]));
        const fileName = file.name;

        const currentTime = new Date().toLocaleTimeString();
        conversations[connectedUser].push({ message: '[File sent]', type: 'sent', time: currentTime });

        const chatBox = document.getElementById('convC');
        const div = document.createElement('div');
        div.className = 'msgcont';

        const fileElement = document.createElement('div');
        fileElement.className = 'smsgcont send';

        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.textContent = fileName;
        link.target = '_blank';

        const preview = document.createElement('img');
        preview.src = url;
        preview.alt = 'File preview';
        preview.style.maxWidth = '100px'; // Définir la taille de l'aperçu en fonction de vos besoins
        preview.style.display = 'block';

        fileElement.appendChild(preview);
        fileElement.appendChild(link);
        div.appendChild(fileElement);

        const timeElement = document.createElement('span');
        timeElement.className = 'time timeS';
        timeElement.textContent = currentTime;
        div.appendChild(timeElement);

        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    };
    reader.readAsArrayBuffer(file);
}

function receiveFile(event) {
    const arrayBuffer = event.data;
    const blob = new Blob([arrayBuffer]);
    const url = URL.createObjectURL(blob);
    const fileName = 'received_file';  // Vous pouvez changer cette valeur en fonction de vos besoins

    const currentTime = new Date().toLocaleTimeString();
    conversations[connectedUser].push({  });

    const recvc = document.getElementById("recvC");
    const actual_flag = connectedUser === recvc.className;
    updateLatest(connectedUser, actual_flag);

    // Ajouter l'aperçu du fichier à la zone de discussion
    const chatBox = document.getElementById('convC');
    const div = document.createElement('div');
    div.className = 'msgcont';

    const fileElement = document.createElement('div');
    fileElement.className = 'smsgcont received';

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.textContent = fileName;
    link.target = '_blank';

    const preview = document.createElement('img');
    preview.src = url;
    preview.alt = 'File preview';
    preview.style.maxWidth = '100px'; // Définir la taille de l'aperçu en fonction de vos besoins
    preview.style.display = 'block';

    fileElement.appendChild(preview);
    fileElement.appendChild(link);
    div.appendChild(fileElement);

    const timeElement = document.createElement('span');
    timeElement.className = 'time timeR';
    timeElement.textContent = currentTime;
    div.appendChild(timeElement);

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function Leaveroom() {
    const confirmExit = confirm("Are you sure you want to leave the chat room?");
    if (confirmExit) {
        socket.emit("leave", connectedUser);
    }
}

function closeRoom() {
    Delete_webrtc_connection();
    for (let i = 0; i < inLatest.length; i++) {
        document.getElementById(inLatest[i]).classList.replace('chatItemselected', 'chatItem');
    }
    alert("Chat room have been closed !!");
}

function user_is_not_ready() {
    hide_loading();
    alert("User has rejected your request .. it seems user is busy now !!");
    Delete_webrtc_connection();
}

function otherUserDisc() {
    if (usersstat.length === 2) {
        Delete_webrtc_connection();
        alert("Other user has left from the chat !!");
    }
}

function Delete_webrtc_connection() {
    if (flag_send_datachannel === true) {
        Send_dataChannel.close();
        flag_send_datachannel = false;
    } else {
        if (Receive_dataChannel) {
            Receive_dataChannel.close();
        }
    }

    peerConnection.close();
    peerConnection = null;

    const chatdiv = document.getElementById("chat");

    chatdiv.style.display = "none";
}
