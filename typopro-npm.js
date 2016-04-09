/*
**  TypoPRO -- Fonts for Professional Typography
**  Copyright (c) 2013-2016 Ralf S. Engelschall <rse@engelschall.com>
**
**  Permission is hereby granted, free of charge, to any person obtaining
**  a copy of this software and associated documentation files (the
**  "Software"), to deal in the Software without restriction, including
**  without limitation the rights to use, copy, modify, merge, publish,
**  distribute, sublicense, and/or sell copies of the Software, and to
**  permit persons to whom the Software is furnished to do so, subject to
**  the following conditions:
**
**  The above copyright notice and this permission notice shall be included
**  in all copies or substantial portions of the Software.
**
**  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
**  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
**  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
**  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
**  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
**  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
**  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/* global process: false */
/* global __dirname: false */
/* global require: false */
/* global console: false */
/* eslint no-console: 0 */

/*
 *  typopro-npm.js: NPM install-time integration
 */

/*  core requirements  */
var child_process = require("child_process");
var fs            = require("fs");
var path          = require("path");
var zlib          = require("zlib");

/*  extra requirements  */
var sprintf       = require("sprintfjs");
var promise       = require("promise");
var request       = require("request");
var tar           = require("tar");
var rimraf        = require("rimraf");

/*  download data from URL  */
var downloadData = function (url) {
    return new promise(function (resolve, reject) {
        var options = {
            method: "GET",
            url: url,
            encoding: null,
            headers: {
                "User-Agent": "NPM/TypoPRO (typopro-npm.js)"
            }
        };
        (new promise(function (resolve /*, reject  */) {
            if (typeof process.env.http_proxy === "string" && process.env.http_proxy !== "") {
                options.proxy = process.env.http_proxy;
                console.log("-- using proxy ($http_proxy): " + options.proxy);
                resolve();
            }
            else {
                child_process.exec("npm config get proxy", function (error, stdout /*, stderr */) {
                    if (error === null) {
                        stdout = stdout.toString().replace(/\r?\n$/, "");
                        if (stdout.match(/^https?:\/\/.+/)) {
                            options.proxy = stdout;
                            console.log("-- using proxy (npm config get proxy): " + options.proxy);
                        }
                    }
                    resolve();
                });
            }
        })).then(function () {
            console.log("-- download: " + url);
            var filesize = function (size) {
                return sprintf("%d", size)
                    .replace(/(\d+)(\d{3})(\d{3})$/, "$1.$2.$3")
                    .replace(/(\d+)(\d{3})$/, "$1.$2")
            }
            var req = request(options, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    process.stdout.write("\r-- download: " + filesize(body.length) + " bytes received.     \n");
                    resolve(body);
                }
                else
                    reject("download failed: " + error);
            });
            var len = 0;
            req.on("response", function (response) {
            });
            req.on("data", function (data) {
                len += data.length;
                process.stdout.write(sprintf("\r-- download: %10s bytes received... ", filesize(len)));
            });
        });
    });
};

/*  extract a tarball (*.tar.gz)  */
var extractTarball = function (tarball, destdir, stripdirs) {
    return new promise(function (resolve, reject) {
        fs.createReadStream(tarball)
            .pipe(zlib.createGunzip())
            .pipe(tar.Extract({ path: destdir, strip: stripdirs }))
            .on("error", function (error) { reject(error); })
            .on("end", function () { resolve(); });
    });
};

/*  common configuration  */
var pkg = require(path.join(__dirname, "package.json"))
var destfile = path.join(__dirname, pkg.name + ".tgz");
var destdir1 = path.join(__dirname, pkg.name);
var destdir2 = path.join(__dirname, pkg.name, pkg.name.replace(/^typopro-/, ""));
var destdir3 = path.join(__dirname, pkg.name.replace(/^typopro-/, ""));

/*  main procedure  */
if (process.argv.length !== 3) {
    console.log("ERROR: invalid number of arguments");
    process.exit(1);
}
if (process.argv[2] === "install") {
    /*  installation procedure  */
    if (!fs.existsSync(destdir3)) {
        console.log("++ fetching externalized TypoPRO distribution content");
        var url = pkg.homepage + "/archive/" + pkg.version + ".tar.gz";
        downloadData(url).then(function (data) {
            console.log("++ unpacking externalized TypoPRO distribution content");
            fs.writeFileSync(destfile, data, { encoding: null });
            extractTarball(destfile, destdir1, 1).then(function () {
                fs.renameSync(destdir2, destdir3);
                rimraf.sync(destdir1);
                fs.unlinkSync(destfile);
                console.log("-- OK: installed local copy of externalized TypoPRO distribution content");
            }, function (error) {
                console.log(chalk.red("** ERROR: failed to extract: " + error));
            });
        }, function (error) {
            console.log(chalk.red("** ERROR: failed to download: " + error));
        });
    }
}
else if (process.argv[2] === "uninstall") {
    /*  uninstallation procedure  */
    if (fs.existsSync(destdir3)) {
        console.log("++ deleting local copy of externalized TypoPRO distribution content");
        rimraf(destdir3, function (error) {
            if (error !== null)
                console.log("** ERROR: " + error);
            else
                console.log("-- OK: done");
        });
    }
}
else {
    console.log("ERROR: invalid argument");
    process.exit(1);
}

