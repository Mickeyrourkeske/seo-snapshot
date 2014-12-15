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

var fs = require('fs');
var path = require('path');
var program = require('commander');

var Snapshot = require('./Snapshot');
var thisPackage = require('../package.json');


program
    .version(thisPackage.version)
    .usage('-i http://website.org -o folder [options]')
    .option('-i, --input [uri]', 'Website to generate a snapshot from')
    .option('-o, --output [folder]', 'Folder to put output in')
    .option('-t, --timeout [ms]', 'Time to wait for a site to load completly', parseInt)
    .option('-c, --changefreq [frequent]', 'Changefreq to put in sitemap.xml [always, hourly, daily, weekly, monthly, yearly, never]')
    .option('-d, --delete', 'Delete old ouput folder after completion')
    .option('-s, --sitemap', 'Save only the sitemap.xml')
    .parse(process.argv);

if (!program.input || !program.output) {
    console.log('Generates html snapshots and a xml sitemap of a website');
    program.help();
}
else {
    var uri = program.input;
    var folder = program.output;
    var tmpFolder;
    var options = {};
    /* check if relative link */
    if (folder.indexOf('/', 0) === -1) {
        folder = process.cwd() + '/' + folder;
    }

    console.log('Generating snapshot for ' + uri + ' in ' + folder + '...');
    /* write the snapshot to .tmp and move it when we are done */
    if (program.delete) {
        tmpFolder = folder;
        folder += '.tmp';
    }
    /* add timout to options */
    if(program.timeout) {
        options.siteTimeout = program.timeout;
    }
    /* only save the sitemap? */
    if(program.sitemap) {
        options.saveHtml = false;
    }
    /* get the changefreq if exists */
    if(program.changefreq) {
        options.changefreq = program.changefreq;
    }

    var snaphsot = new Snapshot(uri, folder, options);

    snaphsot.generate(function (err) {
        if (err) {
            console.error(err);
        }
        else {
            if (program.delete) {
                try {
                    rmRecursiveSync(tmpFolder);
                    fs.renameSync(folder, tmpFolder);
                    folder = tmpFolder;
                }
                catch (err) {
                    console.log('could not delete old folder');
                }
            }

            console.log('Generated snapshot for ' + uri + ' in ' + folder)
        }
    });
}


function rmRecursiveSync(dir) {
    var list = fs.readdirSync(dir);
    for (var i = 0; i < list.length; i++) {
        var filename = path.join(dir, list[i]);
        var stat = fs.statSync(filename);

        if (filename == "." || filename == "..") {
            /* pass files */
        } else if (stat.isDirectory()) {
            /* rmRecursiveSync recursively */
            rmRecursiveSync(filename);
        } else {
            /* rm fiilename */
            fs.unlinkSync(filename);
        }
    }
    fs.rmdirSync(dir);
}


