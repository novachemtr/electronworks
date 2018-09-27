// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

require('isomorphic-fetch'); // or another library of choice.

const fs = require("fs");
const path = require("path");

var access_token="";
var Dropbox = require('dropbox').Dropbox;
const using_accesstoken=false;
var dbx = new Dropbox(/*{ accessToken: '' }*/ { clientId: 'gsh8fvavv5oifd0' });
var authUrl = dbx.getAuthenticationUrl('https://dropfox.firebaseapp.com/dropbox/oauth_receiver.html');

const { dialog } = require('electron').remote;

/**
 * List all files in a directory recursively in a synchronous fashion.
 *
 * @param {String} dir
 * @returns {IterableIterator<String>}
 */
function *walkSync(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const pathToFile = path.join(dir, file);
        const isDirectory = fs.statSync(pathToFile).isDirectory();
        if (isDirectory) {
            yield *walkSync(pathToFile);
        } else {
            yield pathToFile;
        }
    }
}


var fo = function (fullPath) {
  if (fs.existsSync(fullPath)) {
    this.fullPath = fullPath;
    var stats = fs.statSync(fullPath);    
    return { 
      sz: stats["size"],
      name: path.basename(fullPath),
      ext: path.extname(fullPath)      
    }
  }
};

var uploadFromDomEl= function(el) {
  
  var fl = el.find('a').text();
  el.find("span").text("uploading");
  var fz = fo(path.join(fl));
  fs.readFile(path.join(fl), 'utf8', function (err, contents) {
    if (err) {
      console.log('Error: ', err);
      el.find("span").text("failed");
    }
    dbx.filesUpload({ path: '/'+fz.name, contents: contents })
      .then(function (response) {
        console.log(response);
        el.find("span").text("finished");
      })
      .catch(function (err) {
        console.log(err);
        el.find("span").text("failed");
      });
  });

}

window.uploaderTimeout;

window.document.getElementById("start_run")
  .addEventListener("click",  _ => {
    if(!window.uploaderTimeout) {
      window.uploaderTimeout = setInterval(function() { 
        var idles = $('#party_items li span:contains("idle")');
        if(idles.length==0) {
          clearInterval(window.uploaderTimeout);
          window.uploaderTimeout=undefined;
        }
        var ups = $('#party_items li span:contains("uploading")');
        var it = 3-ups.length;
        for(var i=0;i<it;i++) {          
          var a = $(idles[i]).parent();
          setTimeout(function(){ uploadFromDomEl( a );},0);
        }
      }, 1000);
    }
    else {
      clearInterval(window.uploaderTimeout);
      window.uploaderTimeout=undefined;
    }
  });

var pr = window.document.getElementById("party_roll");
pr.addEventListener("click",  _ => {
    
    let path1= window.document.getElementById("party_value").value;
    if(path1==null||path1=="") {
      return;
    }
    let ul = $(window.document.getElementById("party_items"));
    ul.find("li").remove();

    let $el = $('.Grid');

    for (const filePath of walkSync(path1)) {
        let li = $('<li />');
        li.html("<a href='#'>"+filePath+"</a><span class='badge badge-primary badge-pill'>idle</span>");
        li.addClass('list-group-item d-flex justify-content-between align-items-center');
        if(filePath.endsWith('.png')||filePath.endsWith('.jpg')) {
          li.appendTo(ul);
          $(`<div class="Grid-item">
            <div class="Grid-action" style="position:absolute">
              <button onclick="rotate(this)" title="rotate">R</button>
              <button onclick="mustsee(this)" title="must see" >M</button>
              <button onclick="cover(this)" title="cover">C</button>
            </div>
            <div class="Grid-background" data-cover="false" data-mustsee="false" data-rotation="0" data-src="`+filePath.replace(/\\/g,"/")+`" ></div>            
          </div>`)
            .appendTo($el);
        }
    }
    window.ShowViewPort();
    return false;
});

window.document.getElementById("party").addEventListener("click",  _ => {
    let folder = dialog.showOpenDialog({properties: ['openDirectory']});
    window.document.getElementById("party_value").value = folder;
    return false;
});

window.addEventListener("message", receiveMessage, false);

function receiveMessage(event)
{
    var _dropboxjs_oauth_info = JSON.parse(event.data)._dropboxjs_oauth_info;
    var info = window.utils.parseQueryString(_dropboxjs_oauth_info);
    console.log(info);
    if(info) {
        if(info["https://dropfox.firebaseapp.com/dropbox/oauth_receiver.html#access_token"]) {
            access_token = info["https://dropfox.firebaseapp.com/dropbox/oauth_receiver.html#access_token"];
            dbx = new Dropbox({accessToken: access_token});
            dbx.filesListFolder({path: ''})
            .then(function(response) {
                console.log(response);
            })
            .catch(function(error) {
                console.log(error);
            });
        }
    }
    return;

  // ...
}

if(!using_accesstoken) {
  var sub = window.open(authUrl,"auth","width=600,height=600");
}


(function(window){
    window.utils = {
      parseQueryString: function(str) {
        var ret = Object.create(null);
  
        if (typeof str !== 'string') {
          return ret;
        }
  
        str = str.trim().replace(/^(\?|#|&)/, '');
  
        if (!str) {
          return ret;
        }
  
        str.split('&').forEach(function (param) {
          var parts = param.replace(/\+/g, ' ').split('=');
          // Firefox (pre 40) decodes `%3D` to `=`
          // https://github.com/sindresorhus/query-string/pull/37
          var key = parts.shift();
          var val = parts.length > 0 ? parts.join('=') : undefined;
  
          key = decodeURIComponent(key);
  
          // missing `=` should be `null`:
          // http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
          val = val === undefined ? null : decodeURIComponent(val);
  
          if (ret[key] === undefined) {
            ret[key] = val;
          } else if (Array.isArray(ret[key])) {
            ret[key].push(val);
          } else {
            ret[key] = [ret[key], val];
          }
        });
  
        return ret;
      }
    };



    function ShowViewPort() {
    var scroll = $(window).scrollTop();
    var window_height = window.innerHeight;
    var grid_height = $('.Grid').height();
    var grid_width = $('.Grid').width();
    var grid_offset = $('.Grid').offset().top;
      var one_height =  parseInt($('.Grid-item').first().css('margin-top'), 10) + $('.Grid-item').first().outerHeight();
    var one_width =  parseInt($('.Grid-item').first().css('margin-right'), 10) + $('.Grid-item').first().outerWidth();
    var total = $('.Grid-item').length;	
    var sized = Math.round((parseInt($('.Grid-item').first().css('margin-right'), 10) + grid_width) / one_width);	
    var from_top = scroll - grid_offset;
    var show_row = Math.ceil(window_height / one_height);
    var from_row = Math.floor(from_top / one_height );
    if(from_row<0)from_row =0;
    var start = from_row * sized;
  
    if( ((scroll - grid_offset) % one_height) > 50 ) {
        show_row++;
    }
    var stop = start + ( sized * show_row );	
    console.log("starting from",start,"to",stop);
    for(var i=start;i<=stop;i++) {
      var pin = $($('.Grid-item')[i]).find(".Grid-background").first();
      if(pin) {
        if(pin.data("state")!==true) {
          pin.css("background-image","url("+pin.data("src")+")");
          pin.data("statu",true);
        }
      }
    }
  }

  window.ShowViewPort = ShowViewPort;

  $(window).resize(function (event) {
    ShowViewPort();
  });
  $(window).scroll(function (event) {
    ShowViewPort();
  });



  })(window);



document.addEventListener('drop', function (e) {
  e.preventDefault();
  e.stopPropagation();
  for (let f of e.dataTransfer.files) {
      console.log('File(s) you dragged here: ', f.path)
      if(fs.statSync(f.path).isDirectory()) {
        document.getElementById("party_value").value = f.path
        pr.click();
      }
  }
  return false;
});

document.addEventListener('dragover', function (e) {
  e.preventDefault();
  e.stopPropagation();
});



