(function() {
  const express = require('express');
  const app = express();
  const server = require('http').Server(app);
  const io = require('socket.io')(server);
  const compression = require('compression');
  const cookieParser = require('cookie-parser');
  const bodyParser = require('body-parser');
  const cookieSession = require('cookie-session');
  const multer = require('multer');
  const uidSafe = require('uid-safe');
  const path = require('path');
  const config = require('./config.json')
  const dbModule = require('./db');
  const s3 = require('./s3');

  app.use(compression());

  if (process.env.NODE_ENV != 'production') {
    app.use('/bundle.js', require('http-proxy-middleware')({target: 'http://localhost:8081/'}));
  }

  app.use(express.static(__dirname + '/uploads'));

  var diskStorage = multer.diskStorage({
    destination: (req, file, callback) => {
      callback(null, __dirname + '/uploads');
    },
    filename: (req, file, callback) => {
      uidSafe(24).then((uid) => {
        callback(null, uid + path.extname(file.originalname))
      })
    }
  })

  var uploader = multer({
    storage: diskStorage,
    limits: {
      fileSize: 2022840
    }
  });

  app.use(express.static('./public'));


  app.use(cookieParser());
  app.use(bodyParser.urlencoded({extended: false}));
  app.use(bodyParser.json({limit: 2022840}))

  app.use(cookieSession({
    name: 'session',
    secret: process.env.SECRET || 'It\'s better when it feels wrong' ,
    maxAge: 1000 * 60 * 60 * 24 * 14
  }));

  app.post('/new-question', (req, res) => {
    let question = req.body.qeustion;
    let answer = req.body.answer
    let section = req.body.sectionName

    dbModule.newQuestion(question, answer, section).then(() => {

      res.json({success: true})
    }).catch(err => {
      console.log('newQuestion post err: ', err)
    })
  })

  app.get('/faq', (req, res) => {

    dbModule.getFAQ().then((results) => {
      console.log('in get /questions: ', results)
      res.json({data: results})
    }).catch(err => {
      console.log('get questions err: ', err)
    })
  })

  app.post('/new-room', (req, res) => {
    let roomName = req.body.name;
    let description = req.body.description;
    let occupancy = req.body.occupancy;
    let price = req.body.price;
    let amenities = req.body.amenities;

    dbModule.newRoom(roomName, description, occupancy, price, amenities).then(() => {
      res.json({success: true})
    }).catch(err => {
      console.log('newRoom post err: ', err)
    })
  })

  app.get('/rooms', (req, res) => {

    dbModule.getAllRooms().then(results => {
      console.log('all rooms: ', results)
      res.json({data: results})
    }).catch(err => {
      console.log('get /rooms err: ', err)
    })
  })

  app.post('/update-contact', (req, res) => {
    let text = req.body
    console.log('about post text: ', text)

    dbModule.updateAddress(text).then(() => {
      res.json({success: true})
    }).catch(err => {
      console.log('post updateAbout err: ', )
    })
  })

  app.get('/contact', (req, res) => {

    dbModule.getAddress().then(results => {
      console.log('in /about: ', results)
      res.json({data: results})
    }).catch(err => {
      console.log('get /about err: ', err)
    })
  })

  app.post('/new-image', uploader.single('file'), (req, res) => {
    console.log('req.file: ', req.file)
    console.log('req.page: ', req)

    s3.upload(req.file).then(() => {
      console.log('req.file: success')
      let file = config.s3Url + req.file.filename
      res.json({success: true, image: file})
      dbModule.insertPageImage(file, req.body.page).then(() => {

      })
    }).catch(err => {
      console.log('post insertImage err: ', err)
      res.json({error: true})
    })

  })

  app.get('/info', (req, res) => {

    Promise.all([dbModule.getImages(),
                dbModule.getAllRooms()])
      .then((results) => {

      res.json({data: results})
    }).catch(err => {
      console.log('home getInfo err: ', err)
    })
  })

    app.get('*', function(req, res) {
      res.sendFile(__dirname + '/index.html');
    });

    server.listen(process.env.PORT || 8080)

  })();
