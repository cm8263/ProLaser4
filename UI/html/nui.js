// LIDAR
var context = new AudioContext();
var audioPlayer = null;
var clockTone = createClockTone(context);
var timerHandle;
var timerDelta;
var sniperscope = false;
var clockVolume = 0.02;
var selfTestVolume = 0.02;
var recordLimit = -1
var version = -1
var clockToneMute;
var databaseRecords = [];
var resourceName;
var velocityUnit = 'mph'
var rangeUnit = 'ft'
var speedFilters = []
const imperialSpeedFilters = [0, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const metricSpeedFilters = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180];
 
$(document).ready(function () {
    $('#hud').hide();
    $('#lasergun').hide();
	$('#history-container').hide();
	
    window.addEventListener('message', function (event) {
        if (event.data.action == 'SetLidarDisplayState') {
            if (event.data.state) {
                $('#lasergun').fadeIn();
            } else {
                $('#lasergun').fadeOut();
            }
        } else if (event.data.action == 'SendClockData') {
            $('#speed').text(event.data.speed);
            $('#range').text(event.data.range + rangeUnit);
            $('#rangehud').text(event.data.range + rangeUnit);
            $('#timer').text('');
            $('#lock').hide();
            $('#arrowup').hide();
            $('#arrowdown').hide();
            if (event.data.towards == true) {
                $('#speedhud').text('- ' + event.data.speed);
                $('#arrowup').hide();
                $('#arrowdown').show();
                timer();
                clearInterval(clockToneMute);
				playClockTone();
            } else if (event.data.towards == false) {
                $('#speedhud').text('+ ' + event.data.speed);
                $('#arrowdown').hide();
                $('#arrowup').show();
                timer();
                clearInterval(clockToneMute);
				playClockTone();
            } else {
                $('#speedhud').text('/ ' + event.data.speed);
                clearInterval(clockToneMute);
                clockTone.vol.gain.exponentialRampToValueAtTime(0.00001,context.currentTime + 0.1
                );
				clearInterval(timerHandle);
            }
        } else if (event.data.action == 'SetDisplayMode') {
            if (event.data.mode == 'ADS') {
                $('#hud').show();
                $('#lasergun').hide();
            } else {
                $('#hud').hide();
                $('#lasergun').show();
            }
        } else if (event.data.action == 'SetSelfTestState') {
            if (event.data.state) {
				clearInterval(timerHandle);
				$('#timer').text('');
				$('#lock').hide();
                $('#lidar-home').show();
                $('#self-test-container').hide();
                if (event.data.sound) {
                    playSound('LidarCalibration');
                }
            } else {
                $('#lidar-home').hide();
                $('#self-test-container').show();
				$('#self-test-timer').show();
                timer();
            }
        } else if (event.data.action == 'SendSelfTestProgress') {
            $('#self-test-progress').text(event.data.progress);
			if (event.data.stopTimer){
				$('#self-test-timer').hide();
			}
        } else if (event.data.action == 'scopestyle') {
            if (sniperscope) {
                $('#hud').css('background-image', 'url(textures/hud_sight.png)'
                );
            } else {
                $('#hud').css('background-image', 'url(textures/hud_sniper.png)'
                );
            }
            sniperscope = !sniperscope;
        } else if (event.data.action == 'SetConfigVars') {
            selfTestVolume = event.data.selfTestSFX;
            clockVolume = event.data.clockSFX;
			resourceName = event.data.name;
			version = event.data.version;
			$('#tablet-version').text('v'+version);
			if (event.data.metric) {
				speedFilters = metricSpeedFilters;
				velocityUnit = 'km/h';
				rangeUnit = 'm';
				$('#unit').text(velocityUnit)
				$('.speed').html('Speed<br>(' + velocityUnit + ')')
				$('.distance').html('Distance<br>(' + rangeUnit + ')')
			} else {
				speedFilters = imperialSpeedFilters;
				velocityUnit = 'mph';
				rangeUnit = 'ft';
			}
        } else if (event.data.action == 'SetHistoryState') {
            if (event.data.state) {
                $('#lidar-home').hide();
                $('#history-container').show();
            } else {
                $('#lidar-home').show();
                $('#history-container').hide();
            }
        } else if (event.data.action == 'SendHistoryData') {
            $('#counter').text(event.data.counter);
            $('#timestamp').text('Date Time: ' + event.data.time);
            $('#clock').text('Speed Range: ' + event.data.clock);
        } else if (event.data.action == 'PlayButtonPressBeep') {
            playSound(event.data.file);
        } else if (event.data.action == 'SendBatteryAmount') {
            $('#battery').attr('src', 'textures/battery' + event.data.bars + '.png'
            );
		} else if (event.data.action == 'GetCurrentDisplayData') {
			var returnData = { }
			returnData.onHistory = $('#history-container').is(':visible') ? true : false;
			if (returnData.onHistory) {
				returnData.counter 	= $('#counter').text();
				returnData.time 	= $('#timestamp').text().replace('Date Time: ', '');
				returnData.clock 	= $('#clock').text().replace('Speed Range: ', '');
			} else {
				returnData.speed = $('#speed').text();
				returnData.range = $('#range').text().replace(rangeUnit, '');
				if ($('#arrowup').is(':visible')){
					returnData.arrow = 1;
				} else if ($('#arrowdown').is(':visible')) {
					returnData.arrow = -1;
				} else {
					returnData.arrow = 0;
				}
				returnData.elapsedTime = timerDelta;
				returnData.battery = $('#battery').attr('src');
			}
			sendDataToLua('ReturnCurrentDisplayData', returnData);
		} else if (event.data.action == 'SendPeersDisplayData') {
			$('#speed').text(event.data.speed);
            $('#range').text(event.data.range + rangeUnit);
			if ( event.data.arrow == 1){
				$('#arrowup').show();
				$('#arrowdown').hide();
			} else if ( event.data.arrow == -1 ) {
				$('#arrowup').hide();
				$('#arrowdown').show();
			} else {
				$('#arrowup').hide();
				$('#arrowdown').hide();
			}
			$('#battery').attr('src', event.data.battery );
			if (event.data.range != '----' + rangeUnit) {
				timer(event.data.elapsedTime);
			}
        }
    });
});


// ======= MAIN SCRIPT =======
// This function is used to send data back through to the LUA side 
function sendDataToLua( name, data ) {
	$.post( "https://"+ resourceName +"/" + name, JSON.stringify( data ), function( datab ) {
		if ( datab != "ok" ) {
			console.log( datab );
		}            
	} );
}

// Credit to xotikorukx playSound Fn.
function playSound(file) {
    if (audioPlayer != null) {
        audioPlayer.pause();
    }
	
    audioPlayer = new Audio('./sounds/' + file + '.ogg');
    audioPlayer.volume = selfTestVolume;
    var didPlayPromise = audioPlayer.play();

    if (didPlayPromise === undefined) {
        audioPlayer = null; //The audio player crashed. Reset it so it doesn't crash the next sound.
    } else {
        didPlayPromise
            .then(_ => {})
            .catch(error => {
                //This does not execute until the audio is playing.
                audioPlayer = null; //The audio player crashed. Reset it so it doesn't crash the next sound.
            });
    }
}

function createClockTone(audioContext) {
    let osc = audioContext.createOscillator();
    let vol = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.value = 0.5;
    vol.gain.value = 0.02;
    osc.connect(vol);
    vol.connect(audioContext.destination);
    osc.start(0);
    return { osc: osc, vol: vol };
}

String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var minutes = Math.floor(sec_num / 60000);
    var seconds = Math.floor((sec_num - minutes * 60000) / 1000);

    if (minutes < 10) {
        minutes = '0' + minutes;
    }
    if (seconds < 10) {
        seconds = '0' + seconds;
    }
    return minutes + ':' + seconds;
};

function timer( elapsedTime = 0 ) {
	var start = Date.now() - elapsedTime
	clearInterval(timerHandle);
    timerHandle = setInterval(function () {
        timerDelta = Date.now() - start; // milliseconds elapsed since start
        $('#lock').show();
        $('#timer').show();
        $('#timer').text(timerDelta.toString().toHHMMSS());
        $('#self-test-timer').text(timerDelta.toString().toHHMMSS());
    }, 500); // update about every second
}

function playClockTone() {
    clockTone.osc.frequency.exponentialRampToValueAtTime(
        2300,
        context.currentTime + 0.1
    );
    clockTone.vol.gain.exponentialRampToValueAtTime(
        clockVolume,
        context.currentTime + 0.01
    );
    clockToneMute = setInterval(function () {
        clockTone.vol.gain.exponentialRampToValueAtTime(
            0.00001,
            context.currentTime + 0.1
        );
    }, 300); // update about every second
}
// ===== END MAIN SCRIPT ======