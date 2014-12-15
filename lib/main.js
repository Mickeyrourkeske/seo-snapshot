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

var Snapshot = require('./Snapshot');


if (process.argv.length < 4 || process.argv[2] == '-h' || process.argv[2] == '--help') {
    console.log('Generates html snapshots and a xml sitemap of a website');
    console.log('Start with:');
    console.log('seo-snapshot uri folder');
}
else {
    var uri = process.argv[2];
    var folder = process.argv[3];
    /* check if relative link */
    if (folder.indexOf('/', 0) === -1) {
        folder = process.cwd() + folder;
    }


    console.log('Generating snapshot for ' + uri + ' in ' + folder + '...');
    var snaphsot = new Snapshot(uri, folder);

    snaphsot.generate(function (err) {
        if (err) {
            console.error(err);
        }
        else {
            console.log('Generated snapshot for ' + uri + ' in ' + folder)
        }
    });
}
