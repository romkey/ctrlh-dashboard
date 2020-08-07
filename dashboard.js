$(document).ready(function() {
    let client;
    let transforms = {};

    transforms['transform_hours'] = function(value) {
	let d = new Date(value*1000);

	return d.getHours() + ':' + d.getMinutes();
    };

    transforms['transform_temperature'] = function(value) {
	return String((Number(value)*9/5+32).toFixed(1)) + '°F';
    };

    transforms['transform_pms'] = function(value, ddc_type, ddc) {
	return ddc["pm1"] + '/' + ddc["pm25"] + '/' + ddc["pm10"];
    };

    transforms['transform_lock'] = function(value, ddc_type, ddc) {
	if(ddc['action'] === 'unlocked' || ddc['action'] === 'already unlocked')
	    return '<i class="fas fa-lock-open" style="color: red;"></i>';
	else
	    return '<i class="fas fa-lock" style="color: green;"></i>';
    };

    transforms['transform_access_list'] = function(value, ddc_type, ddc) {
	let results = '';

	ddc["queue"].reverse().forEach(function(item) {
	    let datetime = '';

	    try {
		datetime = new Date(item['payload']['timestamp']*1000).toISOString();
	    } catch(e) {
		console.error('transform_access_list: invalid timestamp ' + item['payload']['timestamp']);
	    }
		
	    results += "<li class='list-group-item'>" + item["payload"]["door"] + " " + item["payload"]["person"] + " " + item["payload"]["action"] + "<br><time class='embedded-timeago' datetime='" + datetime + "'></time></li>";
	});

	return results;
    };

    transforms['transform_bps'] = function(value, ddc_type, ddc) {
	if(value == 0)
	    return '0bps';

	const sizes = [ 'Bps', 'KBbps', 'MBps', 'GBps', 'TBps', 'PBps', 'EBps', 'ZBps', 'YBps' ];
	const i = Math.floor(Math.log(value) / Math.log(1024));
	return parseFloat((value / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
    }

    initImageHTML('.load-image-html'); 
    initServerHTML('.load-server-html'); 
    initWeatherHTML('.load-weather-html');
    initAQIHTML('.load-aqi-html'); 
    init3DPrinterHTML('.load-3dprinter-html');
    initDeviceHTML('.load-device-html');
    initLEDHTML('.load-led-html');
    initRoomHTML('.load-room-html');

    // https://github.com/rmm5t/jquery-timeago
    $('.timeago').timeago();

    // enable lightbox
    $(document).on('click', '[data-toggle="lightbox"]', function(event) {
        event.preventDefault();
        $(this).ekkoLightbox();
    });
    
    // MQTT/Homebus setup - should be wrapped in a Homebus class
    client = new Paho.Client(credentials.MQTT_SERVER, 4569, credentials.MQTT_UUID + new Date().getTime());
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;

    let options = {
	useSSL: true,
	userName: credentials.MQTT_USERNAME,
	password: credentials.MQTT_PASSWORD,
	onSuccess:onConnect,
	onFailure:doFail,
	reconnect: true
    };

    client.connect(options); 

// we loaded the credentials in separate JS
// this is still not at all secure but it allows us to decouple management of this page and its content
// from management of the credentials, and lets us not check them into Github
// (despite the fact that they're flapping in the window here on the web)
// they should be for an account with read-only access only to the topic used for the hydroponics

function onConnect() {
    client.subscribe('/projectors');

    // laser access 
    client.subscribe('/homebus/device/8a6f30c2-7adc-44aa-bf0b-aeea197a02c0');

    // modern devices - subscribe using the DDC
    [ 'org.homebus.experimental.image',
      'org.homebus.experimental.server-status',
      'org.homebus.experimental.led-status',
      'org.homebus.experimental.led-update',
      'org.homebus.experimental.weather',
      'org.homebus.experimental.aqi-pm25',
      'org.homebus.experimental.aqi-o3',
      'org.homebus.experimental.air-sensor',
      'org.homebus.experimental.air-quality-sensor',
      'org.homebus.experimental.light-sensor',
      'org.homebus.experimental.system', 
      'org.homebus.experimental.diagnostic', 
      'org.homebus.experimental.3dprinter',
      'org.homebus.experimental.printer', 
      'org.homebus.experimental.switch',
      'org.homebus.experimental.network-bandwidth',
      'org.homebus.experimental.network-active-hosts',
      'org.pdxhackerspace.experimental.access',
      'org.pdxhackerspace.access',
      'org.homebus.experimental.component.queue',
      'org.homebus.experimental.solar-clock' ].forEach(function(ddc) {
	  // this should be a call to the Homebus library
          client.subscribe('homebus/device/+/' + ddc);
      });
}

function doFail(e) {
    console.log(e);
    console.log("doFail");
}

function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.log("onConnectionLost:" + responseObject.errorMessage);
    }
    console.log("connection lost");
}

// shamelessly taken from https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
function formatBytes(bytes, decimals = 2) {
}

// much of this should be inside a Homebus JS class
function onMessageArrived(message) {
    $('.activity-bar').addClass('hr-green');
    setTimeout(function () {
        $('.activity-bar').removeClass('hr-green');
    }, 1000);

//    console.log('onMessageArrived:' + message.payloadString);
//    console.log('topic is ' + message.destinationName, message); 

    let data = {};

    try {
        data = JSON.parse(message.payloadString);
    } catch(error) {
        console.error("JSON parsing error");
        console.error(message.payloadString);
        return;
    }

    let source, timestamp, ddc, payload; 

    // is it a new style message?
    if(data["source"]) {
        source = data["source"];
        timestamp = data["timestamp"];
        try {
            ddc = data["contents"]["ddc"];
            payload = data["contents"]["payload"];
        } catch(error) {
            return;
        }
    }

    if(timestamp) {
        setTimeago('#last_updated_container', timestamp);
    }

    if(!source) return;
    
    if(ddc === 'org.homebus.experimental.image') {
	onImage(source, ddc, timestamp, payload); 
	return; 
    }

    if(ddc === 'org.homebus.experimental.server-status') {
	onServer(source, ddc, timestamp, payload);
	return;
    }

    if(ddc === 'org.homebus.experimental.3dprinter') {
	on3DPrinter(source, ddc, timestamp, payload);
	return;
    }

    onGeneric(source, ddc, timestamp, payload);
}

function setTimeago(container, timestamp) {
    let d;

    try {
	d = new Date(timestamp*1000);
	$(container + ' .timeago').timeago('update', d.toISOString()); 
    } catch(error) {
	console.error('setTimeago() error:', error, timestamp);
    }
}

function onGeneric(source, ddc, timestamp, payload) {
//    console.info('onGeneric', source, ddc, timestamp, String(payload).substr(0, 23));

//    $('#log').prepend('<tr><td>' + source + '</td><td>' + ddc + '</td><td><pre>' + JSON.stringify(payload).substr(0, 200) + '</pre></td></tr>');

    for(prop in payload) {
	let rewritten_ddc = ddc.replace(/\./g, '-');
	let sel1 = '.' + source + '.' + rewritten_ddc + ' .' + prop;
	let sel2 = '#' + source + ' .' + rewritten_ddc + '.' + prop; 
	let sels = [sel1, sel2].join(', ');

	$(sels).each(function(index) {
	    let transformer_name = $(this).attr('data-transform');

	    if(transformer_name && transforms.hasOwnProperty(transformer_name)) {
		try {
		    let f = transforms[transformer_name];
		    $(this).attr('data-value', payload[prop]);
		    $(this).html(f(payload[prop], ddc, payload));
		} catch(error) {
		    console.error('transformer failed: ' + transformer_name, error);
		}
	    } else
		$(this).html(payload[prop]);
	});

	sels = [ sel1 + ' .embedded-timeago', sel2 + ' .embedded-timeago' ].join(', ');
	$(sels).timeago();
    }

    if(timestamp)
	setTimeago('#' + source, timestamp);
}


function onProjectors(projectors) {
    return;
    if (projectors["name"] == "Unit 2") {
        id = "#unit2_projector_status";
    }
    if (projectors["name"] == "Unit 3") {
        id = "#unit3_projector_status";
    }
    $(id).text(projectors["status"]);
}

function onLaserCutterAccess(access, message) {
    if(onLaserCutterAccess.last_access == message.payloadString) 
	return;

    onLaserCutterAccess.last_access = message.payloadString;

    $('#laser-cutter-access ul').prepend("<li class='list-group-item'>" + access["action"] + " by " + access["person"] + "</li>");
}

function onPrinter(printer) {
    let data = printer['org.homebus.experimental.printer'];
    let system = data["system"];
    let status = data["status"];
    $(".printer-name").text(system["model"]);
    $(".printer-status").text(status["status"]);
    $(".pages-printed").text(status["total_page_count"]);
}

function onLight(msg, container) {
    if(msg['org.homebus.light-switch']['state'] == 'on') 
    	$('#' + container + ' .brightness').text(msg['org.homebus.light-switch']['brightness'] + '%'); 
    else
    	$('#' + container + ' .brightness').text('off');
}

function onImage(src, ddc, timestamp, payload) {
    // the following replace helps match against ekko-lightbox which uses new Image when initializing
    let data = 'data:' + payload['mime_type'] + ';base64,' +payload['data'].replace(/\n/g,'');
    let container = '#' + src;

    if ($(container + ' a[data-toggle="lightbox"]').attr('href') == $('.ekko-lightbox img').attr('src')) $('.ekko-lightbox img').attr('src', data);

    try {
	$(container + ' a[data-toggle="lightbox"]').attr("data-footer", "Last updated: " + new Date(timestamp*1000).toISOString());
    } catch(error) {
	console.error('BAD TIMESTAMP', timestamp, src, error);
    }

    $(container + ' img').attr('src', data);
    $(container + ' a[data-toggle="lightbox"]').attr('href', data);
    let d = new Date();
    if (d - timestamp * 1000 > 5*60*1000) $(container + ' img').attr('src', 'test-pattern.jpg');

    setTimeago(container, timestamp);
}

// from https://stackoverflow.com/questions/36098913/convert-seconds-to-days-hours-minutes-and-seconds
function secondsToDhms(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600*24));
    var h = Math.floor(seconds % (3600*24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);

    var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
    var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}

function onServer(src, ddc, timestamp, payload) {
  let sel = '#' + src + ' .' + 'org-homebus-experimental-server-status.';

  $(sel + 'hostname').text(payload['system']['hostname']); 
  $(sel + 'uptime').text(secondsToDhms(payload['system']['uptime'])); 
  $(sel + 'load').text(payload['load']['one_minute'] + '/' + payload['load']['five_minutes'] + '/' + payload['load']['fifteen_minutes']); 
  $(sel + 'memory').text(formatBytes(payload['memory']['free']*1024) + ' free/' + formatBytes(payload['memory']['total']*1024) + ' total'); 

  setTimeago('#' + src, timestamp); 
}

//
//    $(id + ' .server-filesystem-info').remove();
//    filesystems = ''
//    payload['filesystems'].forEach(function(item, index) {
//        filesystems += '<tr class="server-filesystem-info"><td></td><td>' + item['mount_point'] + '</td><td>' + (100 - Number(item['used_percentage'])) + '% free</td></tr>';
//    });

//    $(id + ' .server-filesystems').after(filesystems);

function onVendo(msg) {
    $('#vendo-temperature').text(msg['environment']['temperature']);
    $('#vendo-humidity').text(msg['environment']['humidity']);
}

function on3DPrinter(src, ddc, timestamp, payload) {
    let id = '#' + src;

    $(id + ' .status').text(payload['status']['state']);
    $(id + ' .filename').text(payload['job']['file']);
    if(payload['job']['progress']) {
        $(id + ' .print-progress').text(payload['job']['progress'].toFixed(2) + '%');
        $(id + ' .print-progress').attr('aria-valuenow', payload['job']['progress'].toFixed(2));
        $(id + ' .print-progress').css("width", + payload['job']['progress'].toFixed(2) + '%');
    }
    $(id + ' .print-time').text(payload['job']['print_time']);
    $(id + ' .print-time-remaining').text(payload['job']['print_time_remaining']);
    if (payload['status']['state'] != 'idle') {
        $(id + ' .job').show();
    }
    $(id + ' .tool-temp').text(payload['temperatures']['tool0_actual']);
    $(id + ' .tool-temp-target').text(payload['temperatures']['tool0_target']);
    $(id + ' .bed-temp').text(payload['temperatures']['bed_actual']);
    $(id + ' .bed-temp-target').text(payload['temperatures']['bed_target']);

    setTimeago(id, timestamp);
}

// Multiline Function String - Nate Ferrero - Public Domain
// from https://stackoverflow.com/questions/4376431/javascript-heredoc
function heredoc(fn) {
    return fn.toString().match(/\/\*\s*([\s\S]*?)\s*\*\//m)[1];
};

function initImageHTML(selector) {
    let cameraHTML = heredoc(function() {
	/*
	  <a data-toggle='lightbox' data-gallery='{GALLERY}' data-title='{NAME}'>
            <h2>{NAME}</h2>
            <img src='test-pattern.jpg' loading='lazy' class='img-fluid img-thumbnail' >
          </a>
          <p>
	    <time class='timeago'></time>
          </p>
	*/
    });

    $(selector).each(function(index) {
	let gallery = $(this).attr('data-gallery-name');
	let name = $(this).attr('data-name');
	let named_html = cameraHTML.replace('{NAME}', name).replace('{NAME}', name);

	if(gallery)
	    named_html = named_html.replace('{GALLERY}', gallery);
	else
	    named_html = named_html.replace(" data-gallery={GALLERY}", '');

	$(this).html(named_html);
    });
};

function init3DPrinterHTML(selector) {
    let printerHTML = heredoc(function() {
	/*
	  <h6 class='status'></h6>
  	  <div class='job' style='display: none'>
	  <ul>
	  <li>Filename: <span class='filename'></span></li>
	  <li>Progress: <span class='print-progress'></span>%</li>
	  <li>Time Remaining: <span class='print-time'></span> of <span class='print-time-remaining'></span> sec</li>
          </ul>
	  </div>
	  <table class='table'>
	  <tr><th>temp</th><th>actual</th><th>target</th></tr>
	  <tr><td>tool</td><td><span class='tool-temp'></span>°C</td><td><span class='tool-temp-target'></span>°C</td></tr>
	  <tr><td>bed</td><td><span class='bed-temp'></span>°C</td><td><span class='bed-temp-target'></span>°C</td></tr>
	  </table>
          <p>
	    <time class='timeago'></time>
          </p>
	*/});

    $(selector).html(printerHTML);
};

function initServerHTML(selector) {
    let serverHTML = heredoc(function() {
	/*
	  <h3 class='org-homebus-experimental-server-status hostname'></a>
	  </h3>
	  <table class='table table-striped'>
	  <tr>
	  <td>
	  Uptime:
	  </td>
	  <td class='org-homebus-experimental-server-status uptime'>
	  
	  </td>
	  </tr>
	  <tr>
	  <td>
	  Load average:
	  </td>
	  <td class='org-homebus-experimental-server-status load'>
	  
	  </td>
	  </tr>
	  <tr>
	  <td>
	  Memory:
	  </td>
	  <td class='org-homebus-experimental-server-status memory'>
	  </td>
	  </tr>
	  <tr>
	  <td class='org-homebus-experimental-server-status filesystems'>
          Filesystems:
	  </td>
	  </tr>
	  </table>
          <p>
    	    <time class='timeago'></time>
          </p>
	*/
    });
    $(selector).html(serverHTML);
};

function initWeatherHTML(selector) {
    let weatherHTML = heredoc(function() {
	/*
          <h2>Weather</h2>
	  <table class='table'>
	  <tr>
	  <td>Temperature</td>
	  <td class='org-homebus-experimental-weather temperature' data-transform='transform_temperature'></td>
	  </tr>
	  <tr>
	  <td>Humidity</td>
	  <td><span class='org-homebus-experimental-weather humidity'></span>%</td>
	  </tr>
	  <tr>
	  <td>Pressure</td>
	  <td class='org-homebus-experimental-weather pressure'></td>
	  </tr>
	  <tr>
	  <td>Conditions</td>
	  <td class=' org-homebus-experimental-weather conditions_long'></td>
	  </tr>
	  </table>
	  <p>
            <time class='timeago'></time>
	  </p>
	*/
    });
    $(selector).html(weatherHTML);
};

function initAQIHTML(selector) {
    let AQIHTML = heredoc(function() {
	/*	    
		    <h2>AQI</h2>
		    <table class='table'>
		    <tr>
		    <td>PM2.5</td>
		    <td class='org-homebus-experimental-aqi-pm25 aqi'></td>
		    <td class='org-homebus-experimental-aqi-pm25 condition'></td>
		    </tr>
		    <tr>
		    <td>O3</td>
		    <td class='org-homebus-experimental-aqi-o3 aqi'></td>
		    <td class='org-homebus-experimental-aqi-o3 condition'></td>
		    </tr>
		    </table>
		    <p class='org-homebus-experimental-aqi-pm org-homebus-experimental-aqi-o3'>
		      <time class='timeago'></time>
		    </p>
	*/
    });
    $(selector).html(AQIHTML);
};

function initDeviceHTML(selector) {
    let deviceHTML = heredoc(function() {
	/*
	  <h3 class='org-homebus-experimental-system name'></h3>
	  <table class='table  table-striped'>
	  <tr>
	  <td>Platform</td><td class='org-homebus-experimental-system platform'></td>
	  </tr>
	  <tr>
	  <td>Build</td><td class='org-homebus-experimental-system build'></td>
	  </tr>
	  <tr>
	  <td>IP address</td><td class='org-homebus-experimental-system ip'></td>
	  </tr>
	  <tr>
	  <td>MAC address</td><td class='org-homebus-experimental-system mac_addr'></td>
	  </tr>
	  <tr>
	  <td>Platform</td><td class='org-homebus-experimental-system platform'></td>
	  </tr>
	  <tr>
	  <td>Uptime</td><td class='org-homebus-experimental-diagnostic uptime'></td>
	  </tr>
	  <tr>
	  <td>RSSI</td><td class='org-homebus-experimental-diagnostic rssi'></td>
	  </tr>
	  <tr>
	  <td>Free Heap</td><td class='org-homebus-experimental-diagnostic freeheap'></td>
	  </tr>
	  </table>
	  <p>
	    <time class='timeago'></time>
	  </p>
	*/
    });
    $(selector).html(deviceHTML);
};

function initLEDHTML(selector) {
    let ledHTML = heredoc(function() {
	/*
          <td>{NAME}</td>
          <td class='org-homebus-experimental-led-update preset'></td>
          <td class='org-homebus-experimental-led-update animation'></td>
          <td class='org-homebus-experimental-led-update speed'></td>
          <td class='org-homebus-experimental-led-update brightness'></td>
	*/
    });

    $(selector).each(function(index) {
	let name = $(this).attr('data-name');
	let named_html = ledHTML.replace('{NAME}', name).replace('{NAME}', name);

	$(this).html(named_html);
    });
};

function initRoomHTML(selector) {
    let roomHTML = heredoc(function() {
	/*
          <td id='{DOOR_UUID}'><span class='org-pdxhackerspace-experimental-access action' data-transform='transform_lock'></span></td>
          <td>{NAME}</td>
          <td id='{LIGHT_UUID}'><span class='org-homebus-experimental-switch state'></span></td>
          <td><span class='org-homebus-experimental-air-sensor temperature' data-transform='transform_temperature'></span></td>
          <td><span class='org-homebus-experimental-air-sensor humidity'></span>%</td>
          <td><span class='org-homebus-experimental-air-quality-sensor pm1' data-transform='transform_pms'></span></td>
          <td class='org-homebus-experimental-air-quality-sensor tvoc'></td>
          <td class='org-homebus-experimental-light-sensor lux'></td>
          <td class='org-homebus-experimental-light-sensor ir'></td>
	*/
    });

    $(selector).each(function(index) {
	let name = $(this).attr('data-name');
	let door_uuid = $(this).attr('data-door-uuid');
	let light_uuid = $(this).attr('data-light-uuid');
	let named_html = roomHTML.replace('{NAME}', name).replace('{NAME}', name);

	if(door_uuid)
	    named_html = named_html.replace('{DOOR_UUID}', door_uuid);

	if(light_uuid)
	    named_html = named_html.replace('{LIGHT_UUID}', light_uuid);

	$(this).html(named_html);
    });
};


});
