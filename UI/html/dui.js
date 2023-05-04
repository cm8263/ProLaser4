if (window.parent.origin !== "https://cfx-nui-inferno-tablet") throw "This isn't actually an error, you can safely ignore this!";

console.log("I'm running inside Inferno Tablet!");

window.parent.postMessage("Ping", "https://cfx-nui-inferno-tablet");

// TABLET
var map;
var dataTable;
var speedLimits = {};
var playerName;
var imgurApiKey;
var speedFilter = 0;
var mapMarkerPageOption = true
var mapMarkerPlayerOption = false
var legendWrapper;
var velocityUnit = 'mph'
var speedFilters = []
const imperialSpeedFilters = [0, 20, 30, 40, 50, 60, 70, 80, 90, 100];

var infowindow = new google.maps.InfoWindow()
const mapOptions = {
	center: new google.maps.LatLng(0, 0),
	zoom: 2,
	minZoom: 2,
	streetViewControl: false,
	mapTypeControl: false,
	gestureHandling: 'greedy',
 };

fetch('../../speedlimits.json')
  .then(response => response.json())
  .then(data => {
	speedLimits = data;
  })
  .catch(error => console.error('Unabled to fetch speedlimits.json:', error));
 
// Exit tablet hotkey 
$(document).keyup(function(event) {
	//			Esc
	if (event.keyCode == 27) 
	{
		sendDataToLua('CloseTablet', undefined);
		$('#loading-dialog-container').hide();	
		$('#view-record-container').hide();
		$('#print-result-dialog-container').hide();		
	}
} );
 
$(document).ready(function () {
	  var opacity = 0;
	  setInterval(function() {
		opacity += 0.2;
		if (opacity > 0.8) {
		  opacity = 0;
		}
		$("#brightness-layer").css("background-color", "rgba(0, 0, 0, " + opacity + ")");
	  }, 1000);
	
	
	
    $('#tablet').hide();
    $('#loading-dialog-container').hide();
	$('#view-record-container').hide();
	$('#print-result-dialog-container').hide();
	$('#closeTablet').click(function() { 
		mapMarkerPageOption = true;
		$('#btn-own').prop('checked', false);
		$('#btn-all-players').prop('checked', true);
		$('#btn-this-page').prop('checked', true);
		$('#btn-all-pages').prop('checked', false);		
				
		mapMarkerPlayerOption = false;
		dataTable.destroy();
		$('#clock-table-container').html(
			'<table id="clock-table" class="table table-striped table-bordered" cellspacing="0" width="100%">' +
			  '<thead>' +
				'<tr>' +
				  '<th class="rid">Record<br>ID</th>' +
				  '<th class="timestamp">Timestamp</th>' +
				  '<th class="speed">Speed<br>(' + velocityUnit + ')</th>' +
				  '<th class="distance">Distance<br>(' + rangeUnit + ')</th>' +
				  '<th class="player">Player</th>' +
				  '<th class="street">Street</th>' +
				  '<th class="mapping">Map</th>' +
				  '<th class="print">Print</th>' +
				'</tr>' +
			  '</thead>' +
			  '<tbody id="tBody">' +		   
			  '</tbody>' +
			'</table>'
		)
		sendDataToLua('CloseTablet', undefined);
	});
	
	$('#printPrintView').click( function() { 
		if (imgurApiKey != ''){
			$('#tablet').fadeOut();
			$('.printViewHeader').css('opacity', '0');
			$('#view-record').addClass('no-border');
			captureScreenshot();
			setTimeout(function(){
				$('#tablet').fadeIn();
				$('.printViewHeader').css('opacity', '1');
				$('#view-record').removeClass('no-border');
			}, 1000)
		} else {
			$('#copyButton').hide();
			$('#dialogMsg').text("Upload Failed");
			$('#urlDisplay').text("No Imgur API set. Contact a server developer.");
			$('#print-result-dialog-container').fadeIn();
		}
	});
	
	$('#closePrintView').click( function() { 
		map.setOptions({
		  zoomControl: true,
		});
		$('#view-record-container').fadeOut();
		$('.legend-wrapper').show();
		updateMarkers();
	});
	
	$('#copyButton').click( function() { 
		var textarea = document.createElement('textarea');
		textarea.value = $('#urlDisplay').text();
		document.body.appendChild(textarea);
		textarea.select();
		document.execCommand('copy');
		document.body.removeChild(textarea);
		$('#copyButton').text("Link Copied");
	});
	
	$('#closePrintDialog').click( function() { 
		$('#print-result-dialog-container').fadeOut();
	});
	
	// init map
	map = new google.maps.Map(
		document.getElementById('map'),
		mapOptions
	);

	map.mapTypes.set('gta_roadmap', roadmap);
	// sets default 'startup' map
	map.setMapTypeId('gta_roadmap');

	// Define an array of markers with custom icons and labels
	var markers = [ { icon: '', label: '<div class="legend-spacer" style="margin-top: -16px;">Own</div>' },
					{ icon: 'textures/map/green-dot-light.png', label: '< Speedlimit' },  
					{ icon: 'textures/map/yellow-dot-light.png', label: '> Speedlimit' },  
					{ icon: 'textures/map/red-dot-light.png', label: '> Speedlimit by 10 ' + velocityUnit +'+' },
					{ icon: '', label: '<div class="legend-spacer" style="margin-top: -8px;">Peers</div>' },
					{ icon: 'textures/map/green-dot.png', label: '< Speedlimit' },
					{ icon: 'textures/map/yellow-dot.png', label: '> Speedlimit' },  
					{ icon: 'textures/map/red-dot.png', label: '> Speedlimit by 10 ' + velocityUnit + '+' } ];

	// Create a new legend control
	var legend = document.createElement('div');
	legend.classList.add('legend-container');

	// Loop through the markers array and add each marker to the legend control
	markers.forEach(function(marker) {
	  var icon = marker.icon;
	  var label = marker.label;

	  var legendItem = document.createElement('div');
	  legendItem.classList.add('legend-item');

	  var iconImg = document.createElement('img');
	  iconImg.setAttribute('src', icon);
	  legendItem.appendChild(iconImg);

	  var labelSpan = document.createElement('span');
	  labelSpan.innerHTML = label;
	  legendItem.appendChild(labelSpan);

	  legend.appendChild(legendItem);
	});

	legendWrapper = document.createElement('div');
	legendWrapper.classList.add('legend-wrapper');
	legendWrapper.appendChild(legend);
	
    window.addEventListener('message', function (event) {
		if (!event.data.tablet) {
			if (event.data.action == 'SetConfigVars') {
				imgurApiKey = event.data.imgurApiKey;	
				recordLimit = event.data.recordLimit;
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
			} else if (event.data.action == 'SendDatabaseRecords') {
				playerName = event.data.name;
				databaseRecords = JSON.parse(event.data.table);
				updateTabletWindow(playerName, databaseRecords);
			} else if (event.data.action == 'SetTabletState') {
				if (!event.data.state) {
					$('#tablet').fadeOut();
				}   
			}
		} else {
			if (event.data.entrypoint) {
				resourceName = event.data.resource
				sendDataToLua("EntryPoint", undefined)
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
// ===== END MAIN SCRIPT ======

// ========= TABLET =========
// Define our custom map type
var roadmap = new google.maps.ImageMapType({
	getTileUrl: function (coords, zoom) {
		if (
			coords &&
			coords.x < Math.pow(2, zoom) &&
			coords.x > - 1 &&
			coords.y < Math.pow(2, zoom) &&
			coords.y > -1
		) {
			return (
				'textures/map/roadmap/' +
				zoom +
				'_' +
				coords.x +
				'_' +
				coords.y +
				'.jpg'
			);
		} else {
			return 'textures/map/roadmap/empty.jpg';
		}
	},
	tileSize: new google.maps.Size(256, 256),
	maxZoom: 5,
	minZoom: 2,
	zoom: 2,
	name: 'Roadmap',
});

function gtamp2googlepx(x, y) {
	// IMPORTANT
	// for this to work #map must be width:1126.69px; height:600px;
	// you can change this AFTER all markers are placed...
	//--------------------------------------
	//conversion increment from x,y to px,py
	var mx = 0.0503;
	var my = -0.0503; //-0.05003
	//math mVAR * cVAR
	var x = mx * x;
	var y = my * y;
	//offset for correction
	var x = x - 486.97;
	var y = y + 408.9;

	//return latlong coordinates
	return [x, y];
}


// Marker Function
function addMarker(id, x, y, content_html, icon) {
	//to ingame 2 google coords here, use function.
	var coords = gtamp2googlepx(x, y);
	var location = overlay
		.getProjection()
		.fromContainerPixelToLatLng(
			new google.maps.Point(coords[0], coords[1])
		);
	var marker = new google.maps.Marker({
		position: location,
		map: null,
		icon: 'textures/map/' + icon + '.png',
		optimized: false, //to prevent it from repeating on the x axis.

	});

	databaseRecords[id].googleLoc = location;
	databaseRecords[id].marker = marker;

	//when you click anywhere on the map, close all open windows...
	google.maps.event.addListener(marker, 'click', function () {
		infowindow.setContent(content_html);
		infowindow.open(map, marker);
		map.setCenter(new google.maps.LatLng(location));
		map.setZoom(6);

		google.maps.event.addListener(map, 'click', function () {
			infowindow.close();
		});
	});
}

function openInfo(element) {
    var elementRecord = databaseRecords[element.id];
    map.setCenter(new google.maps.LatLng(elementRecord.googleLoc));
    map.setZoom(5);
    infowindow.setContent(elementRecord.infoContent);
    infowindow.open(map, elementRecord.marker);
}

var loadedAlready = false
// Main window update function
function updateTabletWindow(playerName, databaseRecords){
	$('#tablet').fadeIn();
	$('#loading-dialog-container').fadeIn();
	
	overlay = new google.maps.OverlayView(); 
	overlay.draw = function () {};
	overlay.setMap(map);

	if (!loadedAlready){
		google.maps.event.addListenerOnce(map, 'tilesloaded', function () {
			loadedAlready = true;
			setTimeout(function() {
				processRecords(playerName, databaseRecords);
			}, 100)
		});
	} else {
		$('#map').attr("style", "");
		map = new google.maps.Map(document.getElementById('map'), mapOptions);
		overlay = new google.maps.OverlayView(); 
		overlay.draw = function () {};
		overlay.setMap(map);
		
		map.mapTypes.set('gta_roadmap', roadmap);
		map.setMapTypeId('gta_roadmap');

		google.maps.event.addListenerOnce(map, 'tilesloaded', function () {
			setTimeout(function() {
				processRecords(playerName, databaseRecords);
			}, 100)
		});
	}
}

function processRecords(playerName, databaseRecords){
	// Iterate through all records dynamically creating table, markers
	var tBodyRows = []
	for (var i = 0; i < databaseRecords.length; i++) {
		var record = databaseRecords[i];
		// Speedlimit conditional formatting
		var primaryStreet = record.street.includes('/')
			? [record.street.split('/')[0].trim()]
			: [record.street.trim()];
			
		var markerColor = 'green-dot';
		var speedString;
		var speedLimit = speedLimits[primaryStreet];
		
		if (speedLimit === undefined ) {
			speedString = '<td class="speed">' + record.speed + '</td>';
			console.log('^3Unable to locate speed limit of', primaryStreet);
		} else {
			if (record.speed < speedLimit) {
				speedString = '<td class="speed">' + record.speed + '</td>'; 
				markerColor = 'green-dot';
			} else if (record.speed > speedLimit + 10) {
				speedString = '<td class="speed" style="color: red">' + record.speed + '</td>';
				markerColor = 'red-dot';
			} else if (record.speed > speedLimit) {
				speedString = '<td class="speed" style="color: orange">' + record.speed + '</td>';
				markerColor = 'yellow-dot';
			}
		}

		
		// Generate marker info window content
		record.infoContent = '<b>RID: ' + record.rid + '</b><br>' + record.speed + velocityUnit + '<br>' + record.player;
		
		// Is own record conditional marker formatting
		if ( record.player == playerName ) {
			markerColor = markerColor + '-light'
		}
		
		// Add markers to map
		addMarker(i, record.targetX, record.targetY, record.infoContent, markerColor);
		
		// Add records to table
		var primaryStreet = record.street.includes('/')
			? [record.street.split('/')[0].trim()]
			: [record.street.trim()];
		
		tBodyRows.push(
			'<tr><td class="rid">' +
				record.rid +
			'</td>' +
			'<td class="timestamp">' + record.timestamp + '</td>' +
				speedString +
			'<td class="range">' + record.range + '</td>' +
			'<td class="player">' + record.player + '</td>' +
			'<td class="street" textContent="' + speedLimit + '">' + primaryStreet + '</td>' +
			'<td class="mapping"><button class="tableBtn" id=' + i +' onClick="openInfo(this)"><i class="fa-sharp fa-solid fa-map-location-dot"></i></button></td>' +
			'<td class="print"><button class="tableBtn" id=' + i +' onClick="openPrintView(this)"><i class="fa-sharp fa-solid fa-print"></i></button></td></tr>'
		);
	}
	$('#tBody').append(tBodyRows.join(''));
	
	// Now that all GMap elements have been correctly caluated, update css to custom position.
	
	// Regenerate dataTable after inserting new tBody elements
	//	inefficent should be using dataTable.add() but conditional formatting; lazy;
	$('#loading-message').html('<i class="fa fa-spinner fa-spin" aria-hidden="true"></i> Building Table..');
	dataTable = $('#clock-table').DataTable({
		destroy: true,
		paging: true,
		lengthChange: false,
		searching: true,
		info: true,
		autoWidth: false,
		order: [[ 1, 'desc' ]],
		columnDefs: [
						{
							targets: [6, 7], 
							orderable: false
						},
						{
							targets: [4, 5],
							render: function ( data, type, row ) {
								if (data.length > 14) {
									return data.substr(0, 14) + '...';
								} else {
									return data;
								}
							}
						}
					],
		"initComplete": function(settings, json) {
			// only display markers on this page
			$('#clock-table').DataTable().on('draw.dt', function() {
				updateMarkers();
				
				//limited retrieval datatable footer
				var rows = $('#clock-table').DataTable().rows().count();
				if (rows == recordLimit) {
					var info = $('#clock-table_info');
					var text = info.text();
					var newText = text + " (limited by config)";
					info.text(newText);
				}
			});

			// dynamic row calulation
			var containerHeight = $('#clock-table-container').height();
			var rowHeight = $('#clock-table tbody tr:first-child').height();
			var numRows = Math.floor(containerHeight / rowHeight);
			$('#clock-table').DataTable().page.len(numRows).draw(); 
		}
	});


	$('#loading-message').html('<i class="fa fa-spinner fa-spin" aria-hidden="true"></i> Configuring Filters..');
	
	// Table speed filter handling, Drop down creation.
	var speedFilterDropdown = '<div class="dropdown" style="float: left !important;">' +
			'<button class="btn btn-default dropdown-toggle" type="button" data-toggle="dropdown" style="height: 27px; line-height: 6px;">' +
			'<i class="fa-solid fa-filter"></i> Speed Filter <span class="caret"></span></button>' +
			'<ul class="dropdown-menu">';
	for (var i = 0; i < speedFilters.length; i++) {
	  speedFilterDropdown += '<li><a href="#" value="' + speedFilters[i] + '" class="text-center">' + speedFilters[i] + velocityUnit + '</a></li>';
	}
	speedFilterDropdown += '</ul></div>';
	$('#clock-table_filter').append(speedFilterDropdown);


	// Table speed filter handling
	$('.dropdown-menu a').click(function () {
		speedFilter = Number($(this).attr('value'))
		$.fn.dataTable.ext.search.push(function (
			settings,
			data,
			dataIndex
		) {
			return Number(data[2]) > speedFilter
				? true
				: false;
		});
		dataTable.draw();
		$.fn.dataTable.ext.search.pop();

		// after filtering table, update visible markers to match table
		updateMarkers();
	});
	
	// Map marker filters
	// Get all the button elements in the button groups
	const buttons = document.querySelectorAll('.btn-group input[type="radio"]');

	// Loop through each button and add a click event listener
	buttons.forEach(button => {
	  button.addEventListener('click', () => {
		// Get the value of the clicked button
		const buttonValue = button.nextElementSibling.textContent.trim();

		if (buttonValue == "All"){
			mapMarkerPageOption = false
			updateMarkers()
		} else if (buttonValue == "This Page") {
			mapMarkerPageOption = true
			updateMarkers()
		} else if (buttonValue == "Own") {
			mapMarkerPlayerOption = true
			updateMarkers()
		} else if (buttonValue == "All Players") {
			mapMarkerPlayerOption = false
			updateMarkers()
		} else if (buttonValue == "Off"){
			$('.legend-wrapper').addClass('hidden');
		} else if (buttonValue == "On"){
			$('.legend-wrapper').removeClass('hidden');
		}
	  });
	});
	
	// Add the legend after reinitalization
	$('#loading-message').html('<i class="fa fa-spinner fa-spin" aria-hidden="true"></i> Repositioning Map..');
	document.getElementById('map').style.cssText = 'position: relative; width: 40%; height: calc(100% - 141px); overflow: hidden; float: right; border: inset; z-index: 1; opacity:1;';
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(legendWrapper);
	$('#loading-dialog-container').fadeOut();
}

// updates markers based on mapMarkerPageOption mapMarkerPlayerOption
function updateMarkers() {
	var idsArray = [];
	if (mapMarkerPageOption) {
		var currentPageNodes = $('#clock-table').DataTable().rows({ page: 'current' }).nodes();
		$(currentPageNodes).each(function() {
			var node = $(this)
			var rowPlayerName = node.find('td:eq(4)').text();
			if (mapMarkerPlayerOption == false || mapMarkerPlayerOption && rowPlayerName == playerName)
			{
				var speed = Number(node.find('td:eq(2)').text());
				if (speed >= speedFilter){
					var id = parseInt(node.find('td:eq(6) button:last-child').prop('id'));
					idsArray.push(id);
				}
			}
		});
	} else {
		$('#clock-table').DataTable().rows().every(function() {
			var node = $(this.node())
			var rowPlayerName = node.find('td:eq(4)').text();
			if (mapMarkerPlayerOption == false || mapMarkerPlayerOption && rowPlayerName.trim() === playerName) {
				var speed = Number(node.find('td:eq(2)').text());
				if (speed >= speedFilter){
					var id = parseInt(node.find('td:eq(6) button:last-child').prop('id'));
					idsArray.push(id);
				}
			}
		});
	}
	hideMarkersExcept(databaseRecords, idsArray);
}

 
// update what markers should be shown
function filterMarkersBySpeed(dataList, speedFilter) {
	dataList.forEach(function(data) {
		if (Number(data.speed) > speedFilter) {
			if (data.marker) {
				data.marker.setMap(map);
			}
		} else {
			if (data.marker) {
				data.marker.setMap(null);
			}
		}
	});
}

 function hideMarkersExcept(dataList, activeMarkers) {
	for (let i = 0; i < dataList.length; i++) { 
		if (activeMarkers.includes(i)) {
			dataList[i].marker.setMap(map);
		} else {
			dataList[i].marker.setMap(null);
		}
	}
}

 function showAllMarkers(dataList) {
	for (let i = 0; i < dataList.length; i++) { 
		dataList[i].marker.setMap(map);
	}
}


// ==== PRINT VIEW ====
function openPrintView(element) {
    var elementRecord = databaseRecords[element.id];
	if ('serial' in elementRecord){
		$('#serial').text(elementRecord.serial);
	} else {
		var serial = generateSerial()
		databaseRecords[element.id].serial = serial
		$('#serial').text(serial);
	}
	
	$('#playerName').text(elementRecord.player);
	if(elementRecord.selfTestTimestamp != "00/00/0000 00:00") {
		$('#self-test-time').text(elementRecord.selfTestTimestamp);
		$('.testResult').addClass('pass');
		$('.testResult').text('PASS');
	} else {
		$('#self-test-time').text('N/A');
		$('.testResult').removeClass('pass');
		$('.testResult').text('N/A');
	}

	$('#recID').text(elementRecord.rid);
	$('#recDate').text(elementRecord.timestamp);
	$('#recSpeed').text(elementRecord.speed + ' ' + velocityUnit);
	$('#recRange').text(elementRecord.range);
	$('#recStreet').text(elementRecord.street);
	
	openInfo(element);
	// open marker
	hideMarkersExcept(databaseRecords, [Number(element.id)]);
	// hide infowindow
	infowindow.close();
	$('.legend-wrapper').hide()
	
	// access Date
	const now = new Date();
	const formattedDateTime = now.toISOString().replace('T', ' ').replace(/\.\d{3}Z/, '').slice(0, 16);
	$('#printFooterDate').text(formattedDateTime);
	
	map.setOptions({
	  zoomControl: false,
	  fullscreenControl: false,
	});
	
	// copy map window
	setTimeout(function(){ 
		document.getElementById('printMap').innerHTML = document.getElementById('map').innerHTML;
		document.getElementById('printMap').style.cssText = "position: relative; width: 400px; height: 275px; overflow: hidden; margin: auto;";
		$('#view-record-container').fadeIn();
	}, 1000)
}

// MISC FUNCTIONS PRINTING
function generateSerial() {
    var characters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    var randCharIndex1 = Math.floor(Math.random() * characters.length);
    var randCharIndex2 = Math.floor(Math.random() * characters.length);
    var char1 = characters.charAt(randCharIndex1);
    var char2 = characters.charAt(randCharIndex2);

    var randNum1 = Math.floor(Math.random() * (99 - 10) + 10).toString();
    var randNum2 = Math.floor(Math.random() * (999 - 100) + 100).toString();

    var serial = '100'+char1+randNum1+char2+randNum2
    return serial
}

function captureScreenshot() {
	html2canvas(document.querySelector("#view-record"), {scale: '1.5'}).then(canvas => { 
		const imgData = canvas.toDataURL('image/png');
		var dataUrl = imgData.replace(/^data:image\/(png|jpg);base64,/, "");;
		uploadImageToImgur(dataUrl);
	});
}

function uploadImageToImgur(dataUrl) {
  var apiUrl = 'https://api.imgur.com/3/image';

  var headers = {
    'Authorization': imgurApiKey
  };

  var body = new FormData();
  body.append('image', dataUrl);

  fetch(apiUrl, {
    method: 'POST',
    headers: headers,
    body: body
  })
  .then(function(response) {
    if (response.ok) {
      response.json().then(function(data) {
        console.log('Image uploaded to Imgur. URL:', data.data.link);
		$('#copyButton').show();
		$('#copyButton').text("Copy to Clipboard");
		$('#dialogMsg').text("Uploaded Successfully");
		$('#urlDisplay').text(data.data.link);
		$('#print-result-dialog-container').fadeIn();
      });
    } else {
        console.log('Image failed to upload to Imgur', response.statusText);
		$('#copyButton').hide();
		$('#dialogMsg').text("Upload Failed");
		$('#urlDisplay').text(response.statusText);
		$('#print-result-dialog-container').fadeIn();
    }
  })
  .catch(function(error) {
        console.log('Image failed to upload to Imgur', response.statusText);
		$('#copyButton').hide();
		$('#dialogMsg').text("Upload Failed");
		$('#urlDisplay').text(error);
		$('#print-result-dialog-container').fadeIn();
  });
}
