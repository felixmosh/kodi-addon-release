var fs = require('fs');
var path = require('path');
var semver = require('semver');
var shell = require('shelljs');
var xmldom = require('xmldom');
var inquirer = require('inquirer');

require('array.prototype.find');

var addonFile = 'addon.xml';

function getCurrentVersion() {
	var addon = fs.readFileSync(path.join(process.cwd(), addonFile), 'utf8');
	var doc = new xmldom.DOMParser().parseFromString(addon);
	return doc.documentElement.getAttribute('version');
}

function bump(version) {
	var filename = path.join(process.cwd(), addonFile);
	var addon = fs.readFileSync(filename, 'utf8');
	var doc = new xmldom.DOMParser().parseFromString(addon);
	doc.documentElement.setAttribute('version', version);
	fs.writeFileSync(filename, new xmldom.XMLSerializer().serializeToString(doc));
}

function hook(name) {
	var hook = path.join('.git', 'hooks', name);
	if (fs.existsSync(hook)) {
		shell.exec(hook);
	}
}

function git(version, tag) {
	hook('pre-release');
	shell.exec('git add .');
	run('git commit -m "Version ' + version + '"', 'All files committed');
	run('git tag -a ' + tag + ' -m "Tag ' + tag + '"', 'Tag ' + tag + ' created');
	run('git push', 'Pushed to remote');
	run('git push --tags', 'Pushed new tag ' + tag + ' to remote');
	hook('post-release');
}

function run(cmd, msg) {
	shell.exec(cmd, {silent: true});
	console.log(msg);
}

function updateChangelog(version, nickname, changes) {
	var changelogFile = 'changelog.txt';
	var filename = path.join(path.join(process.cwd(), changelogFile));
	if (!fs.existsSync(filename)) {
		fs.closeSync(fs.openSync(filename, 'w'));
		console.log(changelogFile + ' was created');
	}

	var file = fs.readFileSync(filename, 'utf8');
	var ts_hms = new Date();
	var date = ("0" + (ts_hms.getDate())).slice(-2) + '/' +
		("0" + (ts_hms.getMonth() + 1)).slice(-2) + '/' +
		ts_hms.getFullYear();

	var changelog = version + ' - ' + ((nickname !== '') ? 'by ' + nickname + '' : '') + '(' + date + ')';
	changelog += changes + '\n\n';

	fs.writeFileSync(filename, changelog + file);
}

function release(type, callback) {
	if (!fs.existsSync(addonFile)) {
		callback(new Error(addonFile + ' was not found!'));
	} else {
		var type = type || 'patch';
		var currentVersion = getCurrentVersion();
		console.log(currentVersion);
		var newVersion = semver.inc(currentVersion, type) || type;

		var types = ['major', 'minor', 'patch'];
		var choices = types.map(function (type) {
			var version = semver.inc(currentVersion, type);
			return {name: version + ' (Increment ' + type + ' version)', value: version};
		});

		if (types.indexOf(type) < 0) {
			choices.push({name: newVersion + ' (Custom version)', value: newVersion});
		}

		inquirer.prompt([{
			type: 'list',
			name: 'version',
			message: 'Which version do you want to release ?',
			choices: choices.concat([new inquirer.Separator(), {
				name: 'Exit (Don\'t release a new version)',
				value: 'exit'
			}]),
			default: newVersion
		}, {
			type: 'confirm',
			name: 'updateChangelog',
			message: 'Do you want to update the changelog?',
			default: true
		}, {
			type: 'input',
			name: 'nickname',
			message: 'What is your nickname? (for changelog)',
			when: function (answers) {
				return answers.updateChangelog;
			}
		}, {
			type: 'input',
			name: 'changes',
			message: 'What was your changes? (; separated)',
			filter: function (answer) {
				answer = answer.split(';');
				answer = answer.filter(function (line) {
					return line !== '';
				});
				answer = answer.map(function (line) {
					return line.trim();
				});
				return (answer.length) ? '\n- ' + answer.join('\n- ') : '';
			},
			when: function (answers) {
				return answers.updateChangelog;
			}
		}], function (answers) {
			var version = answers.version;
			if (version !== 'exit') {
				bump(version);
				console.log('Version bumped to ' + version);

				if (answers.updateChangelog) {
					updateChangelog(version, answers.nickname, answers.changes);
				}

				var tag = 'v' + version;
				git(version, tag);
				callback();
			} else {
				callback();
			}
		});
	}
}
module.exports = release;