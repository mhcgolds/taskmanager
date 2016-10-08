
var express = require('express'),
    exphbs  = require('express-handlebars'),
    session = require('express-session'),
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

app.use(session({
  secret: 'tskmgrkey',
  resave: false,
  saveUninitialized: true
}));

app.use("/theme", express.static('./theme/'));
app.use("/js", express.static('./assets/js/'));

app.get('/', function (req, res) {
  db.find({}).exec(function(err, docs) {
    var activeTask = null;

    docs.forEach(function(doc) {
      var status = "",
          icon = "",
          typeIcon = "";

      switch (Number(doc.status)) {
        case 1: 
          status = "primary"; 
          icon = "stop-circle";
          break;
        case 2: 
          status = "green";
          icon = "play-circle"; 
          activeTask = doc;
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

      switch (Number(doc.type)) {
        case 1: typeIcon = "asterisk"; break;
        case 2: typeIcon = "wrench"; break;
        case 3: typeIcon = "bug"; break;
      }

      doc["type-icon"] = typeIcon;
    });

    if (activeTask) {
      var totalTime = 0,
          lastTime = null;

      activeTask.history.forEach(function(history) {
        if (lastTime && history.status != "2") {
          totalTime+= history.time.getTime() - lastTime.getTime();
        }

        lastTime = history.time;
      });

      totalTime+= (new Date()).getTime() - lastTime.getTime();

      var t1 = Math.floor(totalTime / 60000),
          min = activeTask.estminutes;

      activeTask.estminutes = 60 - (t1 % activeTask.estminutes);
      activeTask.esthours = (Math.floor(t1 / min) > 0 ? (activeTask.esthours - Math.floor(t1 / min)) : 0);
    }
    
    docs = docs.filter(function(doc) {
      return doc.status != "2";
    });

    res.render('home', { title: "Teste", tasks: docs, msg: getSessionMsg(req), activeTask: activeTask });
  });
});

app.get('/task/add', function (req, res) {
  res.render('task-form', { title: "Add Task", task: { id: 0 }, detail: false });
});

app.get('/task/details/:id', function (req, res) {
  db.find({ "_id": req.params.id }, function(err, task) {
    task = task[0];
    task.finished = false;
    task.stopped = false;
    task.playing = false;

    if (task.status == "1" || task.status == "3") task.stopped = true;
    else if (task.status == "2") task.playing = true;
    else if (task.status == "4") task.finished = true;

    if (task.history.length == 0) {
      task.history = null;
    }
    else {
      task.history = task.history.sort(function(a, b) {
        return a.time.getTime() < b.time.getTime();
      });
    }

    res.render('task-form', { title: "Task Details", task: task, detail: true });
  });
});

app.get('/task/action/:id/:action', function (req, res) {
  var action = req.params.action,
      id = req.params.id;

  db.find({ "_id": id }, function(err, doc) {
    doc = doc[0];

    var msg = "Task " + doc.code + " is now ";

    if (action == "play" && ["1", "3"].indexOf(doc.status) > -1) {
      doc.status = "2";
      msg+= "started";
    }
    else if ((action == "stop" || action == "pause") && doc.status == "2") {
      doc.status = (action == "stop" ? "1" : "3");
      msg+= (action == "stop" ? "stopped" : "paused");
    }
    else if (action == "finish" && doc.status != "4") {
      doc.status = "4";
      msg+= "finished";
    }
    else {
      msg = "Invalid action on task " + doc.code;

      setSessionMsg(req, msg, 2);

      res.redirect('/task/details/' + id);
      return;
    }

    db.update({ "_id": id }, { $set: { status: doc.status } });
    db.update({ "_id": id }, { $push: { history: {status: doc.status, time: new Date() }}});

    setSessionMsg(req, msg, 1);

    res.redirect('/');
  });
});

app.post('/task/save', function (req, res) {
  var task = req.body;
  task.history = [];

  db.insert(task);
  res.render('home', { title: "Teste", message: "Task Saved!" });
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});

var setSessionMsg = function(req, msg, type) {
  req.session.msg = {
    text: msg,
    type: type
  };
};

var getSessionMsg = function(req) {
  var msg = "";
  if (req.session && req.session.msg) {
    msg = {
      text: req.session.msg.text,
      type: req.session.msg.type,
    }

    req.session.msg = null;
  }

  return msg;
};