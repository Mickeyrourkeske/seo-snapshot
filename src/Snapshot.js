/**
 * Created by fred on 12/1/14.
 */

var phantom = require('phantom');
var env = require('jsdom').env;
var fs = require('fs');


function Snapshot(uri, snapshotFolder) {
    this.uri = uri;
    this.snapshotFolder = snapshotFolder;
}


Snapshot.prototype.generate = function (cb) {


    generateHtmlAndGetLinks(this.uri, cb);
};


function generateHtmlAndGetLinks(uri, cb) {
    phantom.create(function (ph) {
        ph.createPage(function (page) {
            page.set('viewportSize', {
                width: 1280,
                height: 800
            });
            page.open(uri, function (status) {
                console.log('Opened ' + uri + ' ' + status);

                page.injectJs('jquery', function () {

                    setTimeout(function () {
                        page.evaluate(function () {
                            $('.nofollow').remove();
                            $('script').remove();
                            $('meta[name=fragment]').remove();

                            var links = [];
                            $('a').each(function () {
                                links.push(this.href);
                            });
                            var location = window.location.href;
                            var content = $('html')[0].outerHTML;

                            return {
                                location: location,
                                links: links,
                                content: content
                            };
                        }, function (result) {

                            console.log(result.location);
                            console.log(result.links);
                            fs.writeFile('tmp', result.content, function (err) {
                                cb(err);
                            });

                            ph.exit();
                        });
                    }, 5000);
                })
            });
        });
    });
}


module.exports = Snapshot;

