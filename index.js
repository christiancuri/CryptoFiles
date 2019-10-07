const express = require(`express`);
const {json} = require(`body-parser`);
const app = express();
const server = require(`http`).createServer(app);
const io = require(`socket.io`).listen(server);
const fileUpload = require('express-fileupload')
const path = require(`path`)

app.use(json());
app.use(fileUpload({
  useTempFiles : true,
  tempFileDir : 'tmp/'
}));

app.set(`views`, __dirname + `/views`);
app.set(`view engine`, `ejs`);
app.use(express.static(__dirname + '/views'));



app.get(`/`, (req, res) => {
  res.render(`index`);
});

const Audios = {}

app.post(`/upload`, (req, res) => {
  Audios[req.body.name] = { data: req.body.data }
  res.json({
    url: '/audio/' + req.body.name
  })
  // console.log(req.files)
  // const data = req.files.data
  // const name = data.md5 + '.' + data.name
  // const name = data.name
  // data.mv(path.join(__dirname + '/uploads/' + name), err => {
    // if (err) return res.status(400).json(err)
    // res.json({
      // url: '/audio/' + name
    // })
  // })
})

app.get(`/audio/:file`, (req, res) => {
  const { file } = req.params
  res.json({data: Audios[file].data})
  // res.sendFile(path.join(__dirname, `./uploads/${file}`))
})

const serverPort = 3000;
server.listen(serverPort, () => {
  console.log(`Server running on port ${serverPort}`);
});