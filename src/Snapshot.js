/**
 * Created by fred on 12/1/14.
 */

var phantom = require('phantom');
var url = require('url');
var fs = require('fs');
var path = require('path');
var mkpath = require('mkpath');


var discardLink = /(\.pdf)|(feed)|(\.jpg)|(\.jpeg)|(\.png)/gi;

function Snapshot(uri, snapshotFolder) {
    this.uri = uri;

    if (!snapshotFolder.indexOf('/', 0)) {
        snapshotFolder = __dirname + '/' + snapshotFolder;
    }
    this.snapshotFolder = snapshotFolder;

    this.linkQueue = {};
}


Snapshot.prototype.generate = function (cb) {

    console.log('Get page: ' + this.uri);
    this.recursiveQueue(this.uri, cb);

};

Snapshot.prototype.recursiveQueue = function (uri, cb) {

    this.generateSinglePage(uri, function (err, result) {
        if (err) {
            console.log(err);
        }
        else {
            /* add new links and increment them */
            for (var i = 0; i < result.links.length; i++) {
                if (!this.linkQueue.hasOwnProperty(result.links[i])) {
                    this.linkQueue[result.links[i]] = {
                        count: 0,
                        visit: false
                    };
                    console.log('Add new link: ' + result.links[i]);
                }
                this.linkQueue[result.links[i]].count++;
            }
            /* if the current location is new */
            if (!this.linkQueue.hasOwnProperty(result.location)) {
                this.linkQueue[result.location] = {
                    count: 0
                }
            }
            /* we visited the current location */
            this.linkQueue[result.location].visit = true;

            /* check if we got redirected to result.location */
            if (result.location !== result.origin) {
                /* add origin to location */
                if (!this.linkQueue[result.location].origins) {
                    this.linkQueue[result.location].origins = [];
                }
                this.linkQueue[result.location].origins.push(result.origin);

                /* check if the origin location is new */
                if (!this.linkQueue.hasOwnProperty(result.origin)) {
                    this.linkQueue[result.origin] = {
                        count: 0
                    }
                }
                /* we somehow visited the origin site */
                this.linkQueue[result.origin].visit = true;
                /* add redirect to origin location */
                this.linkQueue[result.origin].redirect = result.location;
            }


            console.log(JSON.stringify(this.linkQueue, null, 2));

            var breaked = false;
            for (var link in this.linkQueue) {
                if (this.linkQueue.hasOwnProperty(link)) {
                    if (!this.linkQueue[link].visit) {
                        if (!link.match(discardLink)) {
                            console.log('Get page: ' + link);
                            this.recursiveQueue(link, cb);
                            breaked = true;
                            break;
                        }
                        else {
                            this.linkQueue[link].visit = true;
                            this.linkQueue[link].discard = true;
                        }
                    }
                }
            }
            if (!breaked) {
                cb();
            }
        }
    }.bind(this));
};


Snapshot.prototype.generateSinglePage = function (uri, cb) {
    generateHtmlAndGetLinks(uri, function (err, result) {
        if (err) {
            //TODO
            console.log(err);
            cb(err);
        }

        var file = this.snapshotFolder + url.parse(result.location.replace('/#!', '')).path;
        if (file.indexOf('/', file.length - 1) !== -1) { // path ends with '/'
            file += 'index.html';
        }
        else {
            file += '.html';
        }

        mkpath(path.dirname(file), function (err) {
            if (err) {
                //TODO
                console.log(err);
            }
            else {
                fs.writeFile(file, result.content, function (err) {
                    if (err) {
                        //TODO
                        console.log(err);
                    }
                    else {
                        console.log('Saved ' + file);
                    }
                });
            }
        });


        cb(undefined, result);
    }.bind(this));
};


function generateHtmlAndGetLinks(uri, cb) {
    phantom.create(function (ph) {
        ph.createPage(function (page) {
            page.set('viewportSize', {
                width: 1280,
                height: 800
            });
            page.open(uri, function (status) {
                if (status !== 'success') {
                    cb(new Error('Opened ' + uri + ' ' + status));
                    return;
                }

                page.injectJs('jquery', function () {

                    setTimeout(function () {
                        page.evaluate(function () {
                            $('.nofollow').remove();
                            $('script').remove();
                            $('meta[name=fragment]').remove();

                            var links = [];
                            var location = window.location.href;
                            $('a').each(function () {
                                links.push(this.href);
                            });
                            var content = $('html')[0].outerHTML;

                            return {
                                location: location,
                                links: links,
                                content: content
                            };
                        }, function (result) {
                            ph.exit();

                            try {
                                // remove links which point to somewhere else
                                var links = [];
                                for (var i = 0; i < result.links.length; i++) {
                                    if (url.parse(result.location).hostname === url.parse(result.links[i]).hostname) {
                                        links.push(result.links[i]);
                                    }
                                }

                                result.links = links;
                                result.origin = uri;

                                cb(undefined, result);
                            }
                            catch (err) {
                                cb(err);
                            }
                        });
                    }, 5000);
                });
            });
        });
    });
}


module.exports = Snapshot;

