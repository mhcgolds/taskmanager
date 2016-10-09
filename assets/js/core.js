
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
                    var $ul = $fileList.find("ul").empty();

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

                        $('<li class="' + fileClass + '"><div class="prefix">' + prefix + '</div>' + file.name + '</li>').addClass('list-group-item').appendTo($ul);
                    });
                });
            }, 1000);
    }

    $('body')
        .on('click', '.repo-action-commit', function() { // Task Commit Action
            $("#commit-message").toggle().find("textarea").val("#" + $('[name="code"]').val() + " ").focus();
        })
        .on('click', '.repo-action-commit-send', function() { // Task Commit Send Action
        });
});