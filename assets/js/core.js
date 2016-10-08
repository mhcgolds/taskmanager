
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
});