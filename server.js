// server.js
const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const validator = require('validator');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'chat_app'
});

let usernameABC, emailABC, photoABC;

var peers = {};

var peersStat = new Map();

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connecté à la base de données MySQL');
});

app.post('/register', upload.single('photo'), async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const photo = req.file ? req.file.buffer : null;

        // Validation des données
        if (!username || !email || !password) {
            return res.status(400).send('Tous les champs sont obligatoires');
        }

        if (!validator.isEmail(email)) {
            return res.status(400).send('Email invalide');
        }

        if (!validator.isStrongPassword(password, { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 })) {
            return res.status(400).send('Le mot de passe doit contenir au moins 8 caractères, dont une majuscule, une minuscule, un chiffre et un symbole');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = 'INSERT INTO users (username, email, password, photo) VALUES (?, ?, ?, ?)';
        db.query(sql, [username, email, hashedPassword, photo], (err, result) => {
            if (err) {
                return res.status(500).send('Erreur lors de l\'insertion dans la base de données');
            }
            usernameABC = username;
            emailABC = email;
            photoABC = photo;
            res.redirect('home.html');
        });
    } catch (error) {
        res.status(500).send('Erreur lors de l\'enregistrement de l\'utilisateur');
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Validation des données
    if (!email || !password) {
        return res.status(400).send('Tous les champs sont obligatoires');
    }

    if (!validator.isEmail(email)) {
        return res.status(400).send('Email invalide');
    }

    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], async (err, results) => {
        if (err) {
            return res.status(500).send('Erreur du serveur');
        }
        if (results.length > 0) {
            const match = await bcrypt.compare(password, results[0].password);
            if (match) {
                req.session.userId = results[0].id;
                usernameABC = results[0].username;
                emailABC = results[0].email;
                photoABC = results[0].photo;
                photoABC = photoABC.toString('base64');
                res.redirect('home.html');
            } else {
                return res.status(401).send('Email ou mot de passe incorrect');
            }
        } else {
            return res.status(401).send('Email ou mot de passe incorrect');
        }
    });
});

app.get('/profile', (req, res) => {
    const userId = req.session.userId;

    if (userId) {
        const sql = 'SELECT username, email, photo FROM users WHERE id = ?';
        db.query(sql, [userId], (err, results) => {
            if (err) {
                return res.status(500).send('Erreur du serveur');
            }
            if (results.length > 0) {
                const user = results[0];
                let profilePicture = null;
                if (user.photo) {
                    // Convertir le BLOB en base64
                    profilePicture = user.photo.toString('base64');
                }
                res.json({
                    username: user.username,
                    email: user.email,
                    profilePicture: profilePicture
                });
            } else {
                return res.status(401).send('Utilisateur non trouvé');
            }
        });
    } else {
        return res.status(401).send('Connexion requise');
    }
});


io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);


    socket.emit('login_0' , {username : usernameABC, email : emailABC, photo : photoABC});

    socket.on('login_request', (username) => {
        console.log(username);
        if (peers[username]) {
            socket.emit("isSignedIn", false)
            console.log("Sign-in error for : ",username);

        } else {
            peers[username] = socket;
            socket.name = username;
            socket.email= emailABC;
            socket.photo = photoABC
            socket.otherName = null;

            peersStat.set(username, ['online','no@user' ,socket.photo]);

            socket.emit("isSignedIn", true);
            console.log("Sign-in successful for : ",username);

            const obj = Object.fromEntries(peersStat);

            for (var i in peers) {
                peers[i].emit("peersList", [...peersStat]);
            }
        }
    });

    socket.on('request_to_talk', (otherUsername) => {
        var peerSocket = peers[otherUsername];
        if (peerSocket != null) {
            if ((peerSocket.otherName != null) && peersStat.get(otherUsername)[0] == "busy") {
                socket.emit("isAlreadyinRoom", { success: true, name: otherUsername });
                console.log(otherUsername, " cannot accept the offer");
            }
            else {
                socket.emit("isAlreadyinRoom", { success: false, name: otherUsername });
            }

        }
        else {
            socket.emit("peerSocketErr", false);
        }
    });

    socket.on('offer', (data) => {
        if (peers[data.name]) {
            var peerSocket = peers[data.name];
            if (peerSocket == null) {
                console.log("peerSocketErr");
                socket.emit("peerSocketErr");
            }
            else if (peerSocket.otherName == null) {
                peerSocket.emit("offer_data", { offer: data.offer, name: socket.name });
            }
            else {
                socket.emit("isAlreadyinRoom", { success: true, name: data.name });
            }
        }
        else {
            socket.emit("peerSocketErr");
        }
    });

    socket.on('answer', (data) => {
        var peerSocket = peers[data.name];

        if (peerSocket != null) {
            peerSocket.emit("answer_data", data.answer)
        }
    });

    socket.on('candidate', (data) => {
        var peerSocket = peers[data.name];
        if (peerSocket != null) {
            if (peerSocket.otherName != null) {
                peerSocket.emit("ice_candidate", data.candidate)
                console.log("candidate : ", data.candidate);
                for (var i in peers) {
                    peers[i].emit("peersList", [...peersStat]);
                }
            }

        }
    });

    socket.on('ready', (name) => {
        var peerSocket = peers[name];
        if (peerSocket != null) {
            socket.otherName = name;
            peerSocket.otherName = socket.name;
            peersStat.set(name, ['busy', socket.name, peerSocket.photo]);
            peersStat.set(socket.name, ['busy', name, socket.photo ]);
            peerSocket.emit("isReady", { success: true, peer1: socket.name, peer2 : peerSocket.name });
            socket.emit("isReady", { success: true, peer1: peerSocket.name, peer2 : socket.name });
            for (var i in peers) {
                peers[i].emit("peersList", [...peersStat]);
            }
        }
    });

    socket.on('notReady', (name) => {
        var peerSocket = peers[name];
        if (peerSocket != null) {
            peerSocket.emit("isNotReady")
        }
    });

    socket.on('leave', (name) => {
        var peerSocket = peers[name];
        if (peerSocket != null) {
            peerSocket.emit("user_is_leaving");
            socket.emit("user_is_leaving");
            peersStat.set(name, ['online','no@user', peerSocket.photo]);
            peersStat.set(socket.name, ['online','no@user', socket.photo]);
            peerSocket.otherName = null;
            socket.otherName = null;

            for (var i in peers) {
                peers[i].emit("peersList", [...peersStat]);
            }
            console.log("Room finished !");
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
        if (socket.name) {
            var disc_user = socket.name;
            delete peers[socket.name];
            peersStat.delete(disc_user);

            if (socket.otherName) {
                var peerSocket = peers[socket.otherName];
                if (peerSocket != null) {
                    peerSocket.otherName = null;
                    socket.otherName = null;
                    peerSocket.emit("other_user_disc");
                    peersStat.set(peerSocket.name, ['online','no@user', peerSocket.photo]);
                }
            }
            for (var i in peers) {
                peers[i].emit("peersList", [...peersStat]);
            }
        }
    });

});

const PORT = process.env.PORT || 1234;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});