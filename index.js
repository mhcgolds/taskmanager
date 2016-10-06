
var express = require('express'),
    exphbs  = require('express-handlebars'),
    app = express(),
    bodyParser = require('body-parser'),
    Datastore = require('nedb'),
    db = new Datastore({ filename: __dirname + "/db/tasks.json", autoload: true });
	
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
})); 

app.use("/theme", express.static('./theme/'));

app.get('/', function (req, res) {
  db.find({}).exec(function(err, docs) {
    docs.forEach(function(doc) {
      var status = "",
          icon = "";

      switch (Number(doc.status)) {
        case 1: 
          status = "primary"; 
          icon = "stop-circle";
          break;
        case 2: 
          status = "green";
          icon = "play-circle"; 
          break;
        case 3: 
          status = "yellow";
          icon = "pause-circle"; 
          break;
        case 4: 
          status = "green";
          icon = "check-circle"; 
          break;
      }

      doc["status-class"] = status;
      doc["status-icon"] = icon;
    });

    res.render('home', { title: "Teste", tasks: docs });
  });
});

app.get('/task/add', function (req, res) {
  res.render('task-form', { title: "Add Task", task: { id: 0 }, detail: false });
});

app.get('/task/details/:id', function (req, res) {
  db.find({"_id": req.params.id}, function(err, doc) {
    doc = doc[0];
    doc.finished = false;
    doc.stopped = false;
    doc.playing = false;

    if (doc.status == "1" || doc.status == "3") doc.stopped = true;
    else if (doc.status == "2") doc.playing = true;
    else if (doc.status == "4") doc.finished = true;

    res.render('task-form', { title: "Task Details", task: doc, detail: true });
  });
});

app.post('/task/save', function (req, res) {
  db.insert(req.body);
  res.render('home', { title: "Teste", message: "Task Saved!" });
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});