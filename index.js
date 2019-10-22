const express = require(`express`);
const { json, urlencoded } = require(`body-parser`);
const app = express();
const server = require(`http`).createServer(app);
const io = require(`socket.io`).listen(server);
const fileUpload = require("express-fileupload");
const path = require(`path`);
const fs = require("fs");

// app.use(express.limit("50mb"));
app.use(urlencoded({ extended: true }));
app.use(json());

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "tmp/"
  })
);

app.set(`views`, __dirname + `/views`);
app.set(`view engine`, `ejs`);
app.use(express.static(__dirname + "/views"));

app.get(`/`, (req, res) => {
  res.render(`index`);
});

app.post(`/upload`, (req, res) => {
  const data = req.files.data;
  const name = data.name;
  data.mv(path.join(__dirname + "/uploads/" + name), err => {
    if (err) return res.status(400).json(err);
    res.json({
      url: "/audio/" + name
    });
  });
});

app.get(`/audio/:file`, (req, res) => {
  const { file } = req.params;
  // res.json({ data: Audios[file].data });
  res.sendFile(path.join(__dirname, `/uploads/${file}`));
});

const serverPort = 3000;
server.listen(serverPort, () => {
  console.log(`Server running on port ${serverPort}`);
});
