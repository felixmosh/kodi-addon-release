# kodi-addon-release
> Bump KODI addon version, create tag, update changelog, commit and release the addon in one step.

## Installation

Install with npm

```shell
npm install -g kodi-addon-release
```

## Usage

```shell
kodi-release
```

By default, this will
* execute .git/hooks/pre-release (if present)
* increment the patch version (ex: from 1.2.0 to 1.2.1) in the package.json file using the [Semantic Versioning specification](http://semver.org/)
* commit the package.json file
* create a Git tag for the new version
* push to the remote server
* execute .git/hooks/post-release (if present)

Force a specific version

```shell
kodi-release -f 1.3.0-alpha
```
