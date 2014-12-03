/**
 * Created by fred on 12/3/14.
 */


var Snapshot = require('./src/Snapshot');


if(process.argv.length < 4 || process.argv[2] == '-h' || process.argv[2] == '--help') {
    console.log('Generates html snapshots and a xml sitemap of a website');
    console.log('Start with:');
    console.log('seo-snapshot uri folder');
}

var uri = process.argv[2];
var folder = process.argv[3];

console.log('Generating snapshot for ' + uri + ' in ' + folder + '...');

var snaphsot = new Snapshot(uri, folder);

snaphsot.generate(function (err) {
    if(err) {
        console.error(err);
    }
    else {
        console.log('Generated snapshot for ' + uri + ' in ' + folder)
    }
});

