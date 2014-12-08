/*
 * seo-snapshot
 * Copyright (C) 2014 Frederic Robra
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of  MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program.  If not, see <http://www.gnu.org/licenses/>.
 */


'use strict';

var phantom = require('phantom');
var url = require('url');
var fs = require('fs');
var path = require('path');
var mkpath = require('mkpath');


var discardLink = /(\.pdf)|(feed)|(\.jpg)|(\.jpeg)|(\.png)|(#\w+)/gi;
var siteTimeout = 5000;


/**
 * Creates a Snapshot object to generate html and a sitemap
 * @param uri URI
 * @param snapshotFolder folder to save the snapshots
 * @constructor
 */
function Snapshot(uri, snapshotFolder) {
    this.uri = uri;

    /* check if relative link */
    if (!snapshotFolder.indexOf('/', 0)) {
        snapshotFolder = __dirname + '/' + snapshotFolder;
    }
    this.snapshotFolder = snapshotFolder;

    this.linkQueue = {};

}

/**
 * Generate html and sitemap for every link on the page
 * @param cb when generate is done
 */
Snapshot.prototype.generate = function (cb) {
    console.log('Get page: ' + this.uri);
    this.recursiveQueue(this.uri, function () {
        /* calculate sitemap */
        console.log('calculating sitemap...');

        //fs.writeFile(this.snapshotFolder + '/debug.json', JSON.stringify(this.linkQueue, null, 2), function (err) {
        //    if (err) {
        //        debug(err);
        //        cb(err);
        //    }
        //});

        /* remove all links with redirects and add count to redirect location */
        for (var link in this.linkQueue) {
            if (this.linkQueue.hasOwnProperty(link)) {
                if (this.linkQueue[link].redirect) {
                    var redirectLink = this.linkQueue[link].redirect;
                    this.linkQueue[redirectLink].count += this.linkQueue[link].count;
                    delete this.linkQueue[link];
                }
            }
        }

        /* get overall counts, to calculate the priority */
        var overallCount = 0;
        for (var link in this.linkQueue) {
            if (this.linkQueue.hasOwnProperty(link)) {
                overallCount += this.linkQueue[link].count;
            }
        }

        var sitemap;
        var time = new Date().toISOString();
        sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
        sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        for (var link in this.linkQueue) {
            if (this.linkQueue.hasOwnProperty(link)) {
                var priority = this.linkQueue[link].count / overallCount;
                sitemap += '  <url>\n';
                sitemap += '    <loc>' + link + '</loc>\n';
                sitemap += '    <lastmod>' + time + '</lastmod>\n';
                //sitemap += '    <changefreq>' + options.changefreq + '</changefreq>\n';
                sitemap += '    <priority>' + priority + '</priority>\n';
                sitemap += '  </url>\n';
            }
        }
        sitemap += '</urlset>\n';


        fs.writeFile(this.snapshotFolder + '/sitemap.xml', sitemap, function (err) {
            if (err) {
                debug(err);
                cb(err);
            }
            else {
                console.log('Saved sitemap.xml');
                cb()
            }
        });
    }.bind(this));

};

/**
 * Calls itself recursively for every link in linkQueue until they are visited
 * @param uri URI to start with
 * @param cb when all links are visited
 * @private
 */
Snapshot.prototype.recursiveQueue = function (uri, cb) {

    /* generate html from a single page and get the result */
    this.generateSinglePage(uri, function (err, result) {
        /* add links from result to linkQueue and visit the next one */
        if (err) {
            debug(err);
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


        }

        /* get the next not visited page and call this function recursively */
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
        if (!breaked) { /* all sites are visited */
            cb();
        }
    }.bind(this));
};

/**
 * Writes a single page
 * @param uri URI to snapshot
 * @param cb (err,result) result = {location, links, content, origin}
 */
Snapshot.prototype.generateSinglePage = function (uri, cb) {
    generateHtmlAndGetLinks(uri, function (err, result) {
        if (err) {
            debug(err);
            cb(err);
            return;
        }

        /* remove #! if it exists, so we can use the path to write to file */
        var file = this.snapshotFolder + url.parse(result.location.replace('/#!', '')).path;
        if (file.indexOf('/', file.length - 1) !== -1) { // path ends with '/'
            file += 'index.html';
        }
        else {
            file += '.html';
        }

        mkpath(path.dirname(file), function (err) {
            if (err) {
                debug(err);
            }
            else {
                fs.writeFile(file, result.content, function (err) {
                    if (err) {
                        debug(err);
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
    phantom.create({parameters: {'ignore-ssl-errors': 'true'}}, function (ph) {
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

                page.includeJs('http://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js', function () {

                    setTimeout(function () {
                        page.evaluate(function () { // Sandboxed execution
                            jQuery('.nofollow').remove();
                            jQuery('script').remove();
                            jQuery('meta[name=fragment]').remove();

                            var links = [];
                            var location = window.location.href;
                            jQuery('a').each(function () {
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
                    }, siteTimeout);
                });
            });
        });
    });
}


function debug(out) {
    if (out instanceof Error) {
        var err = out;
        out += err.stack;
    }
    out = (new Date()).toISOString() + ': ' + out + '\n';
    console.log('Debug: ' + out);
    //fs.appendFile('debug', out, function (err) {
    //    if (err) {
    //        console.log(err);
    //    }
    //})
}


module.exports = Snapshot;

