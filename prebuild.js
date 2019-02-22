
/* Used to convert the doc files to html pages that can be used in the windows */
const fs = require('fs');
const path = require('path');
const showdown  = require('showdown');
var converter = new showdown.Converter();
converter.setOption('openLinksInNewWindow', 'true');
var docFolder = "docs";
var outputFolder = path.join("src", "page", "doctohtml");
fs.readdir(docFolder, function(err, items) {
    for(var i=0; i<items.length; i++) {
        var file = path.join(docFolder, items[i]);
        var outputFile = path.join(outputFolder, items[i].split('.').slice(0, -1).join('.') + ".html");
        console.log("Converting: " + file);
        fs.readFile(file, 'utf8', (err, data) => {
            if(err) {
                throw err;
            }
            try {
                fs.writeFileSync(outputFile, converter.makeHtml(data));
                console.log("Output: " + outputFile);
            } catch (e) {
                console.log(e);
                //Do nothing I guess?
            }
        });
        
    }
});

