
$(function() {
    var $remainingTime = $("#remaining-time");

    if ($remainingTime.length > 0) {
        var timeInterval = window.setInterval(function() {
            var timeText = this.text().split(":").map(Number);

            if (timeText[1] > 0) {
                timeText[1]-= 1;
            }
            else {
                timeText[0]-= 1;
                timeText[1] = 59;
            }

            this.text(timeText[0] + ":" + String("00" + timeText[1]).slice(-2));

            if (timeText[0] == 0 && timeText[1] == 0) {
                window.clearInterval(timeInterval);
            }
        }.bind($remainingTime), 60000);
    }

    var $fileList = $("#file-list");

    if ($fileList.length > 0) {
        var lastWatch = null,
            listInterval = window.setInterval(function() {
                $.get("/current-files").success(function(data) {
                    var $ul = $fileList.find("ul").empty(),
                        fileChanges = 0;

                    data.forEach(function(file) {
                        var icon = "";

                        switch (file.code) {
                            case 128:   fileClass = "new"; prefix = "New"; break; 
                            case 256:   prefix = "Modified";
                            case 1024:  prefix = "Type Changed";
                            case 2048:  fileClass = "modified"; prefix = "Renamed"; break;
                            case 512:   fileClass = "deleted"; prefix = "Deleted"; break;
                            case 16384: fileClass = "ignored"; prefix = "Ignored"; break;
                            case 32768: fileClass = "conflicted"; prefix = "Conflicted"; break;
                        }

                        if (file.code != 16384) { // don't show ignored
                            fileChanges+= 1;
                            $('<li class="' + fileClass + '"><div class="prefix">' + prefix + '</div>' + file.name + '</li>').addClass('list-group-item').appendTo($ul);
                        }
                    });
                    
                    if (fileChanges == 0) {
                        $ul.next().text("No file changes detected.");
                    }
                    else {
                        $ul.next().text(fileChanges + " files changed.");
                    }
                });
            }, 1000);
    }

    $historyTable = $(".history-table");

    if ($historyTable.length > 0) {
        $historyTable.find("tr:gt(0)").each(function() {
            var $first = $(this).find("td:first"),
                time = moment($first.data("timestamp")),
                prevTime = null;

            $first.text(time.format('DD/MM/YYYY HH:mm:ss'));

            if (["0", "4"].indexOf($(this).data("status").toString()) == -1) {
                if ($(this).index() > 1) {
                    var timestamp = $(this).prev().find("td:first").data("timestamp");
                    
                    if (typeof (timestamp) == "date") {
                        timestamp = timestamp.getTime();
                    }

                    prevTime = moment(timestamp);
                }
                else {
                    prevTime = moment();
                }

                var $last = $(this).prev().find("td:last"),
                    minutes = Math.abs(time.diff(prevTime, 'minutes')),
                    label = minutes + " mins";

                if (minutes > 59) {
                    var hours = Math.floor(minutes / 60),
                        minutes = Math.floor(minutes % 60);

                    label = hours + " hrs " + minutes + " mins";
                }

                if (!isNaN(minutes)) {
                    $last.text(label);
                }
            }
        });
    }

    $('body')
        .on('click', '.repo-action-commit', function() { // Task Commit Action
            $("#commit-message").toggle().find("textarea").val("#" + $('[name="code"]').val() + " ").focus();
        })
        .on('click', '.repo-action-commit-send', function() { // Task Commit Send Action
        });

    $('.alert').delay(3000).fadeOut(1000);
});