"use strict";
const path = require('path');
const npm = require('npm');
const glob = require('glob');
const co = require('co');
var fsp = require('fs-promise');
const pkgJson = require('./package.json');

function dasherize(s) {
  // Modified slighltly from
  // https://github.com/jprichardson/string.js/blob/27d105d9735e4745b3a001f9fc3a7a1b1a66bbf3/lib/string.js#L128
  return s
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/([A-Z])/g, '-$1')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function sentencerize(s) {
  return s
    .trim()
    .replace(/[_\s]+/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/ +/g, ' ')
    .trim()
}



function generatePackage(dirname){
  const parsed = path.parse(dirname);
  const fontDirname = parsed.base;
  const baseDirname = parsed.dir;

  const p = pkgJson;
  const baseName = p.name.replace(/^typopro-/, '@typopro/');
  const fontName = fontDirname.replace(/^TypoPRO-/, '');
  const pkgName = dasherize(fontName).replace(/^-/, '');

  const description = p.description
    .replace(/^Fonts/, sentencerize(fontName))

  return {
    name: `${baseName}-${pkgName}`,
    version: p.version,
    description,
    homepage: `${p.homepage}/tree/${p.version}/${baseDirname}/${fontDirname}`,
    license: p.license,
    author: p.author,
    keywords: p.keywords,
    repository: p.repository,
    bugs: p.bugs,
  }
}

function* publishPackage (dirname) {
  const pkg = generatePackage(dirname);
  yield fsp.writeFile(
    path.join(dirname, 'package.json'),
    JSON.stringify(pkg)
  );

  function npmGrant(cb) {
    npm.commands.access(['grant', 'read-write', 'typopro:developers', pkg.name], cb)
  }

  function npmPublish(cb) {
    npm.commands.publish([dirname], cb);
  }
  console.log(`Publishing ${dirname}`);
  try {
    try {
      yield npmGrant;
    } catch(e) {
      // ignore.
    }
    yield npmPublish;
    console.log(`${dirname} published`);
  } catch(e) {
    if (/cannot publish over/.test(e.message)) {
      console.log(`${dirname} was published`);
    } else {
      console.log(e);
    }
  }
}


function* processDirs() {
  function getDirs(cb) {
    glob('**/TypoPRO-*/', cb);
  }

  const dirs = yield getDirs;
  function npmLoad(cb) {
    const config = {
      loaded: false,
      access: 'public'
    };
    npm.load(config, cb);
  }
  yield npmLoad;
  yield dirs.map(publishPackage);
};

if (!module.parent) {
  co(processDirs);
}
