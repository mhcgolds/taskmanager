
var express = require('express'),
    exphbs  = require('express-handlebars'),
    session = require('express-session'),
    app = express(),
    bodyParser = require('body-parser'),
    git = require("nodegit"),
    repository = null,
    Datastore = require('nedb'),
    db = {};
  
db.tasks = new Datastore({ filename: __dirname + "/db/tasks.json", autoload: true });
db.projects = new Datastore({ filename: __dirname + "/db/projects.json", autoload: true });
	
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
app.use("/css", express.static('./assets/css/'));
app.use("/js", express.static('./assets/js/'));

app.get('/', function (req, res) {
  if (!req.session.projects) {
    db.projects.find({}, function(err, projects) {
      req.session.projects = projects;
      res.redirect("/");
    });

    return;
  }

  var currentProject = getDefaultProject(req),
      docs = [],
      activeTask = null;

  if (currentProject) {
    db.tasks.find({ "project-id": currentProject._id }).exec(function(err, docs) {
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

      res.render('home', getDefaultViewData({ title: "Teste", tasks: docs, msg: getSessionMsg(req), activeTask: activeTask }, req));
    });
  }
  else {
    res.render('home', getDefaultViewData({ title: "Teste", tasks: [], msg: getSessionMsg(req), activeTask: null }, req));
  }
});

app.get('/task/add', function (req, res) {
  res.render('task-form', getDefaultViewData({ title: "Add Task", task: { id: 0 }, detail: false }, req));
});

app.get('/task/details/:id', function (req, res) {
  db.tasks.find({ "_id": req.params.id }, function(err, task) {
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

    if (req.session.watching) {
      db.projects.find({ _id: task["project-id"] }, function(err, project) {
        res.render('task-form', getDefaultViewData({ title: "Task Details", task: task, detail: true, watching: project[0].location }, req));
      });
    }
    else {
      res.render('task-form', getDefaultViewData({ title: "Task Details", task: task, detail: true, watching: false }, req));
    }
  });
});

app.get('/task/action/:id/:action', function (req, res) {
  var action = req.params.action,
      id = req.params.id;

  db.tasks.find({ "_id": id }, function(err, doc) {
    doc = doc[0];

    var msg = "Task " + doc.code + " is now ";

    if (action == "play" && ["1", "3"].indexOf(doc.status) > -1) {
      doc.status = "2";
      msg+= "started";
      req.session.watching = true;
    }
    else if ((action == "stop" || action == "pause") && doc.status == "2") {
      doc.status = (action == "stop" ? "1" : "3");
      msg+= (action == "stop" ? "stopped" : "paused");
      req.session.watching = false;
    }
    else if (action == "finish" && doc.status != "4") {
      if (doc.statue == "2") {
        req.session.watching = false;
      }

      doc.status = "4";
      msg+= "finished";
    }
    else {
      msg = "Invalid action on task " + doc.code;

      setSessionMsg(req, msg, 2);

      res.redirect('/task/details/' + id);
      return;
    }

    /*db.tasks.update({ "_id": id }, { $set: { status: doc.status } });
    db.tasks.update({ "_id": id }, { $push: { history: {status: doc.status, time: new Date() }}});*/

    setSessionMsg(req, msg, 1);

    if (doc.status == "2") {
      db.projects.find({ _id: doc["project-id"]}, function(err, projects) {
        var project = projects[0];

        git.Repository.open(project.location).then(function(repo) {
          repository = repo;
          res.redirect('/');
        }, function(error) {
          console.log("Repository error", project.location, error);
        });
      });
    }
    else {
      res.redirect('/');
    }
  });
});

app.get('/project/', function(req, res) {
  db.projects.find({}, function(err, projects) {
    res.render('project-home', getDefaultViewData({ title: "Projects", projects: projects }, req));
  });
});

app.get('/project/new/', function(req, res) {
    res.render('project-form', getDefaultViewData({ title: "New Project", project: {} }, req));
});

app.get('/project/details/:id', function(req, res) {
  db.projects.find({ _id: req.params.id }, function(err, projects) {
    if (!projects.length) {
      setSessionMsg(req, "Project not found", 2);
      res.redirect("/");
    }
    else {
      res.render('project-form', getDefaultViewData({ title: "Edit Project '" + projects[0].description + "'", project: projects[0] }, req));
    }
  });
});

app.get('/project/select/:id', function(req, res) {
    var id = req.params.id;

    req.session.projects.forEach(function(project) {
      project.default = (project._id == id);
    });

    db.projects.update({ }, { $set: { default: false }}, function() {
      db.projects.update({ _id: id }, { $set: { default: true }}, function() {
        res.redirect("/");
      });
    });
});

app.get('/current-files', function(req, res) {
  var fileList = [];

  git.Status.foreach(repository, function(fileName, statusCode) {
    fileList.push({
      name: fileName,
      code: statusCode
    });
  }).then(function() {
    res.send(fileList);
  });
});

app.post('/task/save', function (req, res) {
  var task = req.body;
  task.history = [];

  db.tasks.insert(task);
  setSessionMsg(req, "Task Saved", 1);
  res.redirect("/");
});

app.post('/project/save/:id?', function (req, res) {
  var project = req.body;
  project.default = false;

  if (!req.params.id) {
    db.projects.insert(project);
  }
  else {
    db.projects.update({ _id: req.params.id }, { $set: project });
  }

  setSessionMsg(req, "Project Updated", 1);
  res.redirect("/");
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

var getDefaultViewData = function(viewData, req) {
  viewData.projects = [];
  viewData["default-project"] = "No Project Selected";
  
  if (req.session.projects) {
    req.session.projects.forEach(function(p) {
      if (p.default) {
        viewData["default-project"] = p.description;
      }

      viewData.projects.push(p);
    });
  }

  return viewData;
}

var getDefaultProject = function(req) {
  if (req.session.projects) {
    var projects = req.session.projects.filter(function(p) {
      return p.default;
    });

    if (projects.length == 1) {
      return projects[0];
    }
  }

  return null;
}