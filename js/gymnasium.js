'use strict';

/* 
File:         gymnasium.js
Description:  library containing helper functions used on Gymnasium
Authors:      @mbifulco, @rediris
*/

// Polyfill for Array.prototype.filter() via @https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
if (!Array.prototype.filter){
  Array.prototype.filter = function(func, thisArg) {
    'use strict';
    if ( ! ((typeof func === 'Function' || typeof func === 'function') && this) )
        throw new TypeError();

    var len = this.length >>> 0,
        res = new Array(len), // preallocate array
        t = this, c = 0, i = -1;

    var kValue;
    if (thisArg === undefined){
      while (++i !== len){
        // checks to see if the key was set
        if (i in this){
          kValue = t[i]; // in case t is changed in callback
          if (func(t[i], i, t)){
            res[c++] = kValue;
          }
        }
      }
    }
    else{
      while (++i !== len){
        // checks to see if the key was set
        if (i in this){
          kValue = t[i];
          if (func.call(thisArg, t[i], i, t)){
            res[c++] = kValue;
          }
        }
      }
    }

    res.length = c; // shrink down array to proper size
    return res;
  };
}

// Polyfill for trim @https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim
if (!String.prototype.trim) {
  String.prototype.trim = function () {
    return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
  };
}

// Shuffle items
Array.prototype.shuffle = function () {
  let input = this;

  for (let i = input.length - 1; i >= 0; i--) {

    let randomIndex = Math.floor(Math.random() * (i + 1));
    let itemAtIndex = input[randomIndex];

    input[randomIndex] = input[i];
    input[i] = itemAtIndex;
  }
  return input;
}

// if-url-exist.js v1 via @https://stackoverflow.com/questions/10926880/using-javascript-to-detect-whether-the-url-exists-before-display-in-iframe
function urlExists(url, callback) {
  let request = new XMLHttpRequest;
  request.open('GET', url, true);
  request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
  request.setRequestHeader('Accept', '*/*');
  request.onprogress = function(event) {
    let status = event.target.status;
    let statusFirstNumber = (status).toString()[0];
    switch (statusFirstNumber) {
      case '2':
        request.abort();
        return callback(true);
      default:
        request.abort();
        return callback(false);
    };
  };
  request.send('');
};

// Create IE + others compatible event handler via @https://davidwalsh.name/window-iframe
var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
var eventer = window[eventMethod];
var messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

// function to help parse data options
function parseValue(str) {
  if ('true' === str) {
    return true;
  } else if ('false' === str) {
    return false;
  } else if (!isNaN(str * 1)) {
    return parseFloat(str);
  }

  return str;
}

// Create an array of options
function parseOptions(input, output) {
  input.split(';').forEach(function (option, _index) {
    var opt = option.split(':').map(function (el) {
      return el.trim();
    });
    if (opt[0]) {
      output[opt[0]] = parseValue(opt[1])
    };
  });
}

// Get URL Parameter
function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  var results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

function outputDebug(message) {
  if (debug) {
    console.log(message);
  }
}

// Store our data in session storage
function store(name,data,type) {
  if (!type) {
    console.warn('type is not set!');
  }
  if (window.sessionStorage) {
    sessionStorage.setItem(name, data);
  } else {
    console.warn('[job module] No browser support for sessionStorage!');
  }
}

var data;
var debug = getUrlParameter('debug') ? true : false;
var endpoint;
var fallback;
var lat;
var long;
var market;
var markets;
var nearestMarket;
var opts = {};
var url = new URL(window.location.href);

const geolocator = document.getElementById('geolocator');
const jobsContainer = document.getElementById('jobs-container');
const locationForm = document.getElementById('m');
const msgContainer = document.getElementById('messages');

function jobs() {
  if (typeof jobsContainer !== 'undefined' && jobsContainer !== null) {
    if (jobsContainer.hasAttribute('data-options')) {
      parseOptions(jobsContainer.getAttribute('data-options'),opts);
    }
    
    if (jobsContainer.hasAttribute('data-endpoint')) {
      endpoint = jobsContainer.getAttribute('data-endpoint');
    }
    
    if (jobsContainer.hasAttribute('data-fallback')) {
      fallback = jobsContainer.getAttribute('data-fallback');
    }
    
    // Add exception for `remote` option in the markets dropdown
    market = getUrlParameter('m') === 'remote' ? undefined : getUrlParameter('m');
    
    // If we have a market populated on page load, update the dropdown
    if (typeof market !== 'undefined' && market !== null && market.length) {
      updateDropdown(market);
    }
    
    // Clear results completely
    function clearResults() {
      jobsContainer.innerHTML = '';
    }
    
    // What to do when the select updates
    function selectChange() {
      var value = this.value
      if (value === 'remote') {
        market = undefined;
      } else {
        market = value;
      }
    
      let params = new URLSearchParams(url.search);
    
      // add "topic" parameter
      params.set('m', value);
    
      if(debug) {
        params.set('debug', true);
      }
    
      params.toString();
    
      window.history.pushState({}, '', '?' + params + '#location');
      
      outputDebug('[job module] market selected: ' + market);
    
      hideMsg();
      clearResults();
    
      conductData();
    }
    
    // Update dropdown to the selected option
    function updateDropdown(m) {
      document.querySelector('#m [value="' + m + '"]').selected = true;
    }
    
    function hideMsg() {
      // firstly, hide any visible messaging
      msgContainer.querySelectorAll('div').forEach(el => {
        el.classList.add('hide');
      });
    }
    
    // Show our messaging accordingly
    function showMsg(id) {
      // firstly, hide any visible messaging
      hideMsg();
    
      // show the element we want!
      document.getElementById(id).classList.remove('hide');
    }
    
    // AJAX fetch
    function fetchData(url) {
    
      var request = new XMLHttpRequest();
    
      request.open('GET', url, true);
    
      request.onload = function() {
    
        if (this.status >= 200 && this.status < 400) {
          if (typeof this.response !== "undefined" && this.response !== null) {
            var response = this.response;
    
            store('jobs', response);
    
            outputDebug('[job module] fetching data from endpoint: ' + endpoint);
    
            processData(response);
    
          } else {
            // No jobs in market (or there was no data)! Show the appropriate message.
            showMsg('error-results');
          }
        } else {
          // We reached our target server, but it returned an error
          showMsg('error-server');
        }
      };
    
      request.onerror = function() {
        // There was a connection error of some sort
        showMsg('error-connection');
      };
    
      request.send();
    }
    
    function conductData() {
      // If we have jobs stored locally already in the browser session...
      if (window.sessionStorage && sessionStorage.getItem('jobs')) {
        data = sessionStorage.getItem('jobs');
    
        outputDebug('[job module] data from sessionStorage');
    
        processData(data);
      } else {
        // Check if our endpoint is available
        urlExists(endpoint + '?limit=1', function(exists) {
          try {
            if (exists) {
    
              outputDebug('[job module] endpoint exists, fetching results');
    
              endpoint += '?limit=1500';
        
              fetchData(endpoint);
            }
            
            // If not, fall back on the local resour e
            if (!exists) {
              console.warn('[job module] original endpoint unavailable, reverting to local feed!');
              endpoint = fallback;
        
              fetchData(endpoint);
            }
          } catch (error) {
            console.warn('[job module] an error occurred, falling back to local feed! ', error);
            // expected output: ReferenceError: nonExistentFunction is not defined
            // Note - error messages will vary depending on browser
            endpoint = fallback;
        
            fetchData(endpoint);
          }
          
        });
      }
    }
    
    // Process our JSON data
    function processData(d) {
      data = JSON.parse(d);
    
      var items = data.items;
    
      // Wrap our jobs in headings or no?
      var optHeading = opts.heading ? opts.heading : false;
    
      // Do we have a specific category?
      var category = opts.category ? opts.category : false;
    
      // Set iteration limits
      var limit = opts.limit ? parseInt(opts.limit) : 10;
    
      if (category) {
        items = items.filter(item => item.category === category);
    
        outputDebug('[job module] showing jobs for a specific category: ' + category);
      }
    
      // Filter the jobs by market if we have a market param
      if ((typeof market !== 'undefined' && market !== null) && market.length) {
        items = items.filter(item => item.market === market);
    
        outputDebug('[job module] showing jobs for a specific market: ' + market);
      } else {
        // Off-site preference key
        // 0 = Unknown
        // 1 = On-Site
        // 2 = Off-Site
        // 3 = Either
        // 4 = Partial on-site
        items = items.filter(item => parseInt(item.remote) === 2);
        updateDropdown('remote');
    
        outputDebug('[job module] showing only remote options…');
      }
    
      // Randomize the results we show…
      items = items.shuffle();
    
      // How many results do we have?
      var numResults = items.length;
    
      outputDebug(`[job module] results: ${numResults} | limit: ${limit}`);
    
      if (numResults > 0) {
        
        // Start with an empty list
        var list = "";
    
        // hide our loading message
        document.getElementById('loading').classList.add('hide');
    
        if (numResults < limit) {
          limit = numResults;
        }
    
        // Generate job item
        for (var i = 0; i < limit; i++) {
          var el = items[i];
          list += '<li>';
          // Add optional heading prefix
          if (optHeading) {
            list += '<' + optHeading + '>';
          }
          list += '<a href="' + decodeURI(el.url) + '?utm_campaign=gymnasium" title="' + el.title + '"><span class="job-title">' + el.title + ' </span><span class="job-location"> ' + el.city + '</span></a>';
          if (optHeading) {
            list += '</' + optHeading + '>';
          }
          list += '</li>';
        }
    
        // close our list
        jobsContainer.innerHTML += `<ul>${list}</ul>`;
      } else {
        // No jobs in market! Show the appropriate message.
        showMsg('error-results');
      }
    }
    
    conductData();

    // Listen for change events from locationForm select
    locationForm.addEventListener('change', selectChange, false);
  }
}

jobs();

fetch(geolocator.getAttribute('data-markets'))
  .then(response => response.json())
  .then(data => markets = data.items);

function Gymnasium() {}

Gymnasium.prototype.setBackgroundColorOfElementFromImage = function (
  element,
  image
) {
  var canvas = document.createElement("canvas");
  var myImg = document.createElement("img");

  $(image).each(function (i, imgObj) {
    myImg.src = imgObj.src;

    $(myImg).one("load", function () {
      var context = canvas.getContext("2d");
      context.drawImage(myImg, 0, 0);

      data = context.getImageData(1, 1, 1, 1).data;

      var r = data[0];
      var g = data[1];
      var b = data[2];
      var a = data[3];

      $(element).css(
        "background-color",
        "rgba(" + r + "," + g + "," + b + "," + a + ")"
      );
    });
  });
};

///get a URL parameter passed in with HTTP GET
///NOTE: this function is not case sensitive
Gymnasium.prototype.getUrlParameter = function getUrlParameter(sParam) {
  var sPageURL = decodeURIComponent(window.location.search.substring(1)),
    sURLVariables = sPageURL.split("&"),
    sParameterName,
    i;

  for (i = 0; i < sURLVariables.length; i++) {
    sParameterName = sURLVariables[i].split("=");

    if (sParameterName[0].toLowerCase() === sParam.toLowerCase()) {
      return sParameterName[1] === undefined ? true : sParameterName[1];
    }
  }
};

Gymnasium.prototype.injectFBTrackingPixel = function () {
  var trackingPix = $(
    '<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=1074612282557779&ev=PageView&noscript=1" /></noscript>'
  );
  $("body").append(trackingPix);
  fbq("init", "1074612282557779");
  fbq("track", "PageView");
};

Gymnasium.prototype.RecordCourseEnrollment = function (
  firstName,
  lastName,
  emailAddress,
  courseId,
  callback
) {
  var data = {
    first_name: firstName,
    last_name: lastName,
    email: emailAddress,
    course: courseId,
    utm_campaign: courseId + " - Enrollment",
    carrot_type: "Gymnasium Enrollment",
    carrot_topic: "GYM-" + courseId,
    PROC: "AWUISubmitExternalLead",
  };
  Gymnasium.RecordCloudwallRecord(data, callback);
};

Gymnasium.prototype.RecordExamGrade = function (
  email,
  courseId,
  grade,
  callback
) {
  var data = {
    leadDestination: "cw-rc",
    email: email,
    score: grade,
    course_id: courseId,
    utm_campaign: courseId + " - Grade",
  };
  return Gymnasium.RecordCloudwallRecord(data, callback);
};

Gymnasium.prototype.RecordRegistration = function (
  emailAddress,
  firstName,
  lastName,
  cityId,
  callback
) {
  var data = {
    first_name: firstName,
    last_name: lastName,
    email: emailAddress,
    location: cityId,
    utm_campaign: "Registration",
    carrot_type: "Gymnasium Registration",
    carrot_topic: "GYM REG",
    PROC: "AWUISubmitExternalLead",
  };

  Intercom("trackEvent", "registration", data);
  return Gymnasium.RecordCloudwallRecord(data, callback);
};

Gymnasium.prototype.RecordCloudwallRecord = function (jsonData, callback) {
  jsonData.utm_source = "gymnasium.com";
  jsonData.utm_medium = "web";
  jsonData.utm_content = "not-provided";
  jsonData.utm_term = "not-provided";
  jsonData.agent_email = "gymleads@aquent.com";
  jsonData.agent_id = "1694600";
  jsonData.agent_name = "TALENT LEAD NURTURING";
  jsonData.carrot = "thegymnasium.com";
  jsonData.subdomain = CW_ENV;
  jsonData.language = "en_US";
  jsonData.medium = "1009";
  jsonData.referring_site = "thegymnasium.com";
  jsonData.status = "Talent";
  jsonData.referer = "thegymnasium.com";

  $.ajax("https://assets.aquent.com/apps/gym/lead-processor", {
    contentType: "application/json",
    dataType: "jsonp",
    data: jsonData,
  })
    .done(function (event) {
      //console.log("Success!\n", event);
    })
    .fail(function (event, textStatus, errorThrown) {
      //console.log("Failure:\n", textStatus, "\n", errorThrown);
    })
    .always(function (e) {
      //console.log("always:\n", e);
      if (callback) {
        callback();
      }
    });
};

// Facebook Pixel Code
!(function (f, b, e, v, n, t, s) {
  if (f.fbq) return;
  n = f.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!f._fbq) f._fbq = n;
  n.push = n;
  n.loaded = !0;
  n.version = "2.0";
  n.queue = [];
  t = b.createElement(e);
  t.async = !0;
  t.src = v;
  s = b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t, s);
})(window, document, "script", "//connect.facebook.net/en_US/fbevents.js");

// Initialize
var Gymnasium = new Gymnasium();

function getNearestMarket() {
  
}


function geoFindMe() {

  function success(position) {
    const latitude  = position.coords.latitude;
    const longitude = position.coords.longitude;
    lat = latitude;
    long = longitude;
    parseOptions(`coords: ${lat},${long}`,opts);

    console.log('opts [api]: ', window.opts);
  }

  function error() {
    console.warn('[geo] Unable to retrieve your location');
  }

  if (!navigator.geolocation) {
    console.warn('[geo] Geolocation is not supported by your browser');
  } else {
    navigator.geolocation.getCurrentPosition(success, error);
  }
}

geoFindMe();

// Listen for geolocator messages from our iframe
eventer(messageEvent,function(event) {
  // Reject messages that are not from a valid origin domain
  const regex = new RegExp('https:\/\/.*assets.aquent.com');
  if (regex.test(event.origin)) {
    // console.log('[geo] ' + event.data);

    parseOptions(event.data,opts);
    nearestMarket = window.opts.nearestMarket;

    console.log('opts [geo]: ', window.opts);
  
  }
}, false);
