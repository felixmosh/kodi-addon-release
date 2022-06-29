const fs = require('fs');
const path = require('path');
const semver = require('semver');
const shell = require('shelljs');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const inquirer = require('inquirer');
const chalk = require('chalk');

function loadAddonXml(path) {
  const addon = fs.readFileSync(path, 'utf8');
  return new DOMParser().parseFromString(addon, 'text/xml');
}

function getCurrentVersion(doc) {
  return doc.documentElement.getAttribute('version');
}

function getAuthor(doc) {
  return doc.documentElement.getAttribute('provider-name');
}

function bump(doc, version) {
  doc.documentElement.setAttribute('version', version);
}

function getOrCreateNewsNode(doc) {
  const extensions = doc.documentElement.getElementsByTagName('extension');

  let metaDataExtension;
  for (let i = 0; i < extensions.length; i++) {
    const extension = extensions.item(i);
    if (extension.getAttribute('point') === 'xbmc.addon.metadata') {
      metaDataExtension = extension;
    }
  }

  if (!metaDataExtension) {
    metaDataExtension = doc.createElement('extension');
    metaDataExtension.setAttribute('point', 'xbmc.addon.metadata');
    doc.documentElement.appendChild(metaDataExtension);
  }

  let newsList = metaDataExtension.getElementsByTagName('news');
  if (newsList.length === 0) {
    const news = doc.createElement('news');
    metaDataExtension.appendChild(news);
    return news;
  }

  return newsList.item(0);
}

function createChangelog({ nickname, version, changes }) {
  const now = new Date();
  const date = [
    `${now.getDate()}`.padStart(2, '0'),
    `${now.getMonth() + 1}`.padStart(2, '0'),
    now.getFullYear(),
  ].join('.');

  const nicknamePart = !!nickname ? `by ${nickname} ` : '';
  return `v${version} - ${nicknamePart}[${date}]${changes}`;
}

function updateNews(doc, answers) {
  const changelog = createChangelog(answers);

  const news = getOrCreateNewsNode(doc);
  news.textContent = changelog;
}

function updateChangelog(answers) {
  const changelogFile = 'CHANGELOG.md';
  const filename = path.join(path.join(process.cwd(), changelogFile));
  if (!fs.existsSync(filename)) {
    fs.closeSync(fs.openSync(filename, 'w'));
    console.log(changelogFile + ' was created');
  }

  const currentContent = fs.readFileSync(filename, 'utf8');
  const changelog = createChangelog(answers);

  fs.writeFileSync(filename, '### ' + changelog + '\n\n' + currentContent);
}

function hook(name) {
  const hook = path.join('.git', 'hooks', name);
  if (fs.existsSync(hook)) {
    shell.exec(hook);
  }
}

function git(version) {
  const tag = `v${version}`;

  hook('pre-release');
  shell.exec('git add .');
  run('git commit -m "Version ' + version + '"', 'All files committed');
  run('git tag -a ' + tag + ' -m "Tag ' + tag + '"', 'Tag ' + tag + ' created');
  run('git push', 'Pushed to remote');
  run('git push --tags', 'Pushed new tag ' + tag + ' to remote');
  hook('post-release');
}

function run(cmd, msg) {
  shell.exec(cmd, { silent: true });
  console.log(msg);
}

function isExit(answers) {
  return answers.version === 'exit';
}

function saveChanges(doc, filepath) {
  fs.writeFileSync(filepath, new XMLSerializer().serializeToString(doc));
}

function release(options, callback) {
  const addonXMLFilePath = path.join(process.cwd(), 'addon.xml');

  if (!fs.existsSync(addonXMLFilePath)) {
    return callback(new Error(addonXMLFilePath + ' was not found!'));
  }

  const type = options.force || 'patch';

  const addonXml = loadAddonXml(addonXMLFilePath);

  const currentVersion = getCurrentVersion(addonXml);
  const author = getAuthor(addonXml);
  console.log(chalk.dim('Current version: ') + currentVersion + '\n');

  const newVersion = semver.inc(currentVersion, type) || type;

  const types = ['patch', 'minor', 'major'];
  const choices = types.map((type) => {
    const version = semver.inc(currentVersion, type);
    return { name: version + ' (Increment ' + type + ' version)', value: version };
  });

  if (!types.includes(type)) {
    choices.push({ name: newVersion + ' (Custom version)', value: newVersion });
  }

  inquirer
    .prompt([
      {
        type: 'list',
        name: 'version',
        message: 'Which version do you want to release ?',
        choices: choices.concat([
          new inquirer.Separator(),
          {
            name: "Exit (Don't release a new version)",
            value: 'exit',
          },
        ]),
        default: newVersion,
      },
      {
        type: 'confirm',
        name: 'updateChangelog',
        message: 'Do you want to update the changelog?',
        default: true,
        when: (answers) => !isExit(answers),
      },
      {
        type: 'input',
        name: 'nickname',
        message: 'What is your nickname? (for changelog)',
        default: author || '',
        when: (answers) => !isExit(answers) && answers.updateChangelog,
      },
      {
        type: 'input',
        name: 'changes',
        message: 'What were your changes? (; separated)',
        filter: (answer) => {
          const answers = answer
            .split(';')
            .map((line) => line.trim())
            .filter(Boolean);

          return answers.map((answer) => `\n- ${answer}`).join('');
        },
        transformer: (answer) =>
          answer
            .split(';')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((answer) => `\n- ${answer}`)
            .join(''),
        when: (answers) => !isExit(answers) && answers.updateChangelog,
      },
    ])
    .then((answers) => {
      if (isExit(answers)) {
        return callback();
      }

      const version = answers.version;
      bump(addonXml, version);
      console.log('\n' + chalk.dim('Version bumped to ') + version);

      if (answers.updateChangelog) {
        updateNews(addonXml, answers);
        updateChangelog(answers);
      }

      saveChanges(addonXml, addonXMLFilePath);

      git(version);
      callback();
    });
}

module.exports = release;
