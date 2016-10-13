
var express = require('express'),
    exphbs  = require('express-handlebars'),
    session = require('express-session'),
    app = express(),
    bodyParser = require('body-parser'),
    git = require("nodegit"),
    repository = null,
    Datastore = require('nedb'),
    db = {},
    moment = require('moment');
  
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
app.use("/css", express.static('./node_modules/select2/dist/css'));
app.use("/js", express.static('./node_modules/moment/min/'));
app.use("/js", express.static('./node_modules/select2/dist/js'));
app.use("/js", express.static('./assets/js/'));

var activeTaskId = null;

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
      finishedTasks = [],
      activeTask = null;

  if (currentProject) {
    db.tasks.find({ "project-id": currentProject._id }).exec(function(err, docs) {
      docs.forEach(function(doc) {
        var status = "",
            icon = "",
            typeIcon = "";

          doc.estminutes = lpad(doc.estminutes, 2);

        switch (Number(doc.status)) {
          case 1: 
            status = "primary"; 
            icon = "stop-circle";
            break;
          case 2: 
            status = "green";
            icon = "play-circle"; 
            activeTask = doc;
            activeTaskId = doc._id;
            break;
          case 3: 
            status = "yellow";
            icon = "pause-circle"; 
            break;
          case 4: 
            status = "green";
            icon = "check-circle"; 
            taskTotalTime(doc);
            finishedTasks.push(doc);
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

      docs = docs.filter(function(doc) {
        return doc.status != "2" && doc.status != "4";
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

        activeTask.esthours = Number(activeTask.esthours);
        activeTask.estminutes = Number(activeTask.estminutes);

        // http://stackoverflow.com/a/39961449/1267304
        var totalTimeInMins = Math.floor(totalTime / (1000 * 60)), // Get total minutes of work done
            estTimeInMins = (activeTask.esthours * 60) + activeTask.estminutes, //converting esitmated time to minutes
            resultTimeInMins = estTimeInMins - totalTimeInMins, //calculating result time
            resultHours = Math.floor(resultTimeInMins / 60), //getting number of hours. Math.floor is rounding off to lower integer
            resultMinutes = resultTimeInMins % 60; //calculating number of minutes. This is like getting the remainder.

        if (resultMinutes.toString().length == 1) resultMinutes = "0" + resultMinutes;

        activeTask.estminutes = resultMinutes;
        activeTask.esthours = resultHours;

        req.session.watching = true;
        startWatch(activeTask["project-id"], function() {
          res.render('home', getDefaultViewData({ title: "Teste", tasks: docs, msg: getSessionMsg(req), activeTask: activeTask, finishedTasks: finishedTasks }, req));  
        });
      }
      else {
        res.render('home', getDefaultViewData({ title: "Teste", tasks: docs, msg: getSessionMsg(req), activeTask: activeTask, finishedTasks: finishedTasks }, req));
      }
    });
  }
  else {
    res.render('home', getDefaultViewData({ title: "Teste", tasks: [], msg: getSessionMsg(req), activeTask: null }, req));
  }
});

app.get('/task/add', function (req, res) {
  var date = new Date(),
      deadline = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();

  res.render('task-form', getDefaultViewData({ title: "Add Task", task: { id: 0, deadline: deadline }, detail: false }, req));
});

app.get('/task/details/:id', function (req, res) {
  db.tasks.find({ "_id": req.params.id }, function(err, task) {
    task = task[0];
    task.finished = false;
    task.stopped = false;
    task.playing = false;

    taskTotalTime(task);

    task["create-timestamp"] = task.create.getTime();

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

      task.history.forEach(function(item) {
        item.timestamp = item.time.getTime();

        switch (Number(item.status)) {
          case 1: 
            item["action-description"] =  "Stopped";
            break;
          case 2: 
            item["action-description"] =  "Working";
            break;
          case 3: 
            item["action-description"] =  "Paused";
            break;
          case 4: 
            item["action-description"] =  "Finished";
            break;
        }
      });
    }

    var edit = (!task.finished),
        detail = (task.finished);

    if (req.session.watching) {
      db.projects.find({ _id: task["project-id"] }, function(err, project) {
        res.render('task-form', getDefaultViewData({ title: "Task Details", task: task, edit: edit, detail: detail, watching: project[0].location, canStart: (activeTaskId == null) }, req));
      });
    }
    else {
      res.render('task-form', getDefaultViewData({ title: "Task Details", task: task, edit: edit, detail: detail, watching: false, canStart: (activeTaskId == null) }, req));
    }
  });
});

app.get('/task/action/:id/:action', function (req, res) {
  var action = req.params.action,
      id = req.params.id;

  db.tasks.find({ "_id": id }, function(err, doc) {
    doc = doc[0];

    var msg = "Task " + doc.code + " is now ";

    if (action == "play" && ["1", "3", 1, 3].indexOf(doc.status) > -1) {
      doc.status = "2";
      msg+= "started";
      req.session.watching = true;
      activeTaskId = doc._id;
    }
    else if ((action == "stop" || action == "pause") && doc.status == "2") {
      doc.status = (action == "stop" ? "1" : "3");
      msg+= (action == "stop" ? "stopped" : "paused");
      req.session.watching = false;
      activeTaskId = null;
    }
    else if (action == "finish" && doc.status != "4") {
      if (doc.statue == "2") {
        req.session.watching = false;
      }

      doc.status = "4";
      msg+= "finished";
      activeTaskId = null;
    }
    else {
      msg = "Invalid action on task " + doc.code;

      setSessionMsg(req, msg, 2);

      res.redirect('/task/details/' + id);
      return;
    }

    db.tasks.update({ "_id": id }, { $set: { status: doc.status } });
    db.tasks.update({ "_id": id }, { $push: { history: {status: doc.status, time: new Date() }}});

    setSessionMsg(req, msg, 1);

    if (doc.status == "2") {
      if (req.session.watching) {
        // Stop current watch to start a new one
      }

      startWatch(doc["project-id"], function() {
        res.redirect('/');
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

app.post('/task/save/:id?', function (req, res) {
  var task = req.body;

  if (!req.params.id) {
    task.history = [];
    task.status = 1;
    task.create = (new Date());

    db.tasks.insert(task, function() {
      setSessionMsg(req, "Task Saved", 1);
      res.redirect("/");
    });
  }
  else {
    db.tasks.update({ _id: req.params.id }, { $set: task }, function() {
      setSessionMsg(req, "Task Updated", 1);
      res.redirect("/");
    });
  }
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

var startWatch = function(projectId, callback) {
  db.projects.find({ _id: projectId}, function(err, projects) {
    var project = projects[0];

    git.Repository.open(project.location).then(function(repo) {
      repository = repo;
      callback();
    }, function(error) {
      console.log("Repository error", project.location, error);
    });
  });
}

var taskTotalTime = function(task) {
  var history = task.history.sort(function(a, b) {
        return a.time.getTime() > b.time.getTime();
      }),
      prevTime = null,
      totalMinutes = 0;

  history.forEach(function(h, index) {
    var time = moment(h.time.getTime());

    if (index > 0) {
      prevTime = moment(history[index - 1].time.getTime());

      totalMinutes+= Math.abs(time.diff(prevTime, 'minutes'));
    }
  });
  
  if (totalMinutes > 59) {
    task["end-time-hours"] = lpad(Math.floor(totalMinutes / 60));
    task["end-time-minutes"] = lpad(Math.floor(totalMinutes % 60));
  }
  else {
    task["end-time-hours"] = lpad(0);
    task["end-time-minutes"] = lpad(totalMinutes);
  }
};

var lpad = function(value, places) {
  var str = "", 
      i = places;
  
  while (i > 0) { 
    str+= "0"; 
    i-=1; 
  }; 

  return (str + value.toString()).slice(-places); 
};